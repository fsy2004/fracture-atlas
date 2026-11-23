"""Split the pinned CC BY-SA male GLBs without decoding or simplifying their meshes."""
import argparse
from copy import deepcopy
from hashlib import sha256
import itertools
import json
from pathlib import Path
import struct

LAYERS={
    'bones':'skeletal_male.glb',
    'muscles':'muscular_male.glb',
    'vessels':'cardiovascular_male.glb',
    'nerves':'nervous_male.glb',
}
REGIONS=('head','trunk','upper','lower')
ROOT=Path(__file__).resolve().parents[1]

def read_glb(data):
    magic,version,total=struct.unpack_from('<4sII',data)
    assert magic==b'glTF' and version==2 and total==len(data)
    size,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    doc=json.loads(data[20:20+size])
    count,kind=struct.unpack_from('<II',data,20+size)
    assert kind==0x004e4942
    return doc,data[28+size:28+size+count]

def write_glb(doc,binary):
    header=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()
    header+=b' '*(-len(header)%4)
    blob=bytes(binary)+b'\0'*(-len(binary)%4)
    size=12+8+len(header)+8+len(blob)
    return struct.pack('<4sIIII',b'glTF',2,size,len(header),0x4e4f534a)+header+struct.pack('<II',len(blob),0x004e4942)+blob

def transform(point,node):
    if 'matrix' in node:
        a=node['matrix']
        return tuple(sum(a[i+4*j]*point[j] for j in range(3))+a[i+12] for i in range(3))
    scale=node.get('scale',(1,1,1))
    offset=node.get('translation',(0,0,0))
    x,y,z,w=node.get('rotation',(0,0,0,1))
    a,b,c=[v*s for v,s in zip(point,scale)]
    u,v,t=2*(y*c-z*b),2*(z*a-x*c),2*(x*b-y*a)
    return (a+w*u+y*t-z*v+offset[0],b+w*v+z*u-x*t+offset[1],c+w*t+x*v-y*u+offset[2])

def bounds(doc,node):
    points=[]
    for primitive in doc['meshes'][node['mesh']]['primitives']:
        p=doc['accessors'][primitive['attributes']['POSITION']]
        points.extend(transform(v,node) for v in itertools.product(*zip(p['min'],p['max'])))
    return [[round(f(v[i] for v in points),6) for i in range(3)] for f in (min,max)]

def region_for(box):
    x,y,z=[(a+b)/2 for a,b in zip(*box)]
    if y>=1.39:return 'head'
    if y<=.79:return 'lower'
    if x*x>=.17**2:return 'upper'
    return 'trunk'

def partition(doc,binary,indices):
    subset={'asset':doc['asset'],'extensionsUsed':doc['extensionsUsed'],'extensionsRequired':doc['extensionsRequired'],
            'scene':0,'scenes':[{'nodes':list(range(len(indices)))}],
            'nodes':[],'meshes':[],'accessors':[],'bufferViews':[],'buffers':[{}]}
    buffer=bytearray()
    mapping={'meshes':{},'accessors':{},'bufferViews':{}}
    def copy(kind,index):
        m=mapping[kind]
        if index in m:return m[index]
        item=deepcopy(doc[kind][index])
        new=len(subset[kind])
        m[index]=new
        subset[kind].append(item)
        if kind=='bufferViews':
            start=item.get('byteOffset',0);end=start+item['byteLength']
            buffer.extend(b'\0'*(-len(buffer)%4))
            item['byteOffset']=len(buffer)
            buffer.extend(binary[start:end])
        elif kind=='accessors' and 'bufferView' in item:
            item['bufferView']=copy('bufferViews',item['bufferView'])
        elif kind=='meshes':
            for primitive in item['primitives']:
                primitive['attributes']={k:copy('accessors',i) for k,i in primitive['attributes'].items()}
                if 'indices' in primitive:primitive['indices']=copy('accessors',primitive['indices'])
                compressed=primitive['extensions']['KHR_draco_mesh_compression']
                compressed['bufferView']=copy('bufferViews',compressed['bufferView'])
        return new
    for i in indices:
        node=deepcopy(doc['nodes'][i])
        assert not node.get('children'),'expected flat anatomy scene'
        node['mesh']=copy('meshes',node['mesh'])
        subset['nodes'].append(node)
    subset['buffers'][0]['byteLength']=len(buffer)
    return write_glb(subset,buffer)

def main(source,output):
    output.mkdir(parents=True,exist_ok=True)
    records=json.loads((source/'sources.json').read_text())
    manifest={'license':'CC-BY-SA-4.0','revision':records['revision'],'regions':REGIONS,'layers':{},'coverage':{}}
    owners={}
    for layer,filename in LAYERS.items():
        raw=(source/filename).read_bytes()
        declared=next(item for item in records['assets'] if item['file']==filename)
        assert sha256(raw).hexdigest()==declared['sha256']
        doc,binary=read_glb(raw)
        assert 'KHR_draco_mesh_compression' in doc['extensionsRequired'] and not doc.get('images')
        manifest['layers'][layer]={}
        selections={region:[] for region in REGIONS}
        structure_counts={}
        skipped=[]
        for i,node in enumerate(doc['nodes']):
            if 'mesh' not in node:continue
            label=node['name'].strip()
            # Repeated nodes are kept in their primary system only. Retain the
            # intact skeletal companion even when another GLB contains that bone.
            key=label.casefold()
            if layer!='bones' and key in owners and owners[key]!=layer:
                skipped.append(label)
                continue
            owners.setdefault(key,layer)
            box=bounds(doc,node)
            region=region_for(box)
            selections[region].append(i)
            triangles=sum(doc['accessors'][p['indices']]['count']//3 for p in doc['meshes'][node['mesh']]['primitives'])
            structure_counts[i]=(label,box,triangles)
        for region,indices in selections.items():
            if not indices:raise ValueError(f'Uncovered region {layer}/{region}')
            content=partition(doc,binary,indices)
            name=f'{layer}-{region}.glb'
            (output/name).write_bytes(content)
            manifest['layers'][layer][region]={
                'file':name,'bytes':len(content),'sha256':sha256(content).hexdigest(),
                'triangles':sum(structure_counts[i][2] for i in indices),'nodes':len(indices),
            }
        manifest['coverage'][layer]={'count':sum(len(x) for x in selections.values()),'source':declared,'duplicates':skipped}
        manifest.setdefault('structures',{})[layer]={structure_counts[i][0]:{
            'region':region,'bounds':structure_counts[i][1]
        } for region,indices in selections.items() for i in indices}
        print(layer,manifest['coverage'][layer]['count'],'retained',len(skipped),'already present',flush=True)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf8')
    (output/'NOTICE').write_bytes((source/'NOTICE').read_bytes())

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('--out',type=Path,default=ROOT/'models/soft-tissue')
    args=parser.parse_args()
    main(args.source,args.out)
