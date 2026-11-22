"""Pack the 113 eligible Visible Human Male STL meshes into separate browser assets.

Obtain inputs with fetch_vhm.py. --baseline accepts the published full manifest
or the original 13-bone manifest. Existing baseline files are verified in place.
Positions are float32 metres followed by uint32 triangle indices, little endian.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree

AXIS = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], dtype=float)
ORD = 'first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth'.split()
LABEL = {
    'CUBOID':'cuboid bone', 'INTERMEDIATE_CUNEIFORM':'intermediate cuneiform bone',
    'LATERAL_CUNEIFORM':'lateral cuneiform bone','MEDIAL_CUNEIFORM':'medial cuneiform bone',
    'TRIQUETRUM':'triquetral','HIP':'hip bone',
}

def atlas_key(path):
    name = Path(path).stem
    if name == 'SKULL_MANDIBLE':
        return 'Mandible', 'axial'
    if name.startswith('VERTEBRA_'):
        region, number = name[9:10], int(name[10:])
        if region == 'C' and number < 3:
            return ('Atlas','Axis')[number-1], 'axial'
        return (ORD[number-1].title()+' '+{'C':'cervical','T':'thoracic','L':'lumbar'}[region]+' vertebra','axial')
    stem, side = name.rsplit('_',1)
    title = side.title()
    folder = Path(path).parent.name
    if stem.startswith('RIB_'):
        return title+' '+ORD[int(stem.split('_')[1])-1]+' rib','axial'
    part = 'hand' if folder.startswith('HAND') else 'shoulder' if folder.startswith('UPPER') else 'leg'
    if stem == 'NAVICULAR':
        key = 'Navicular bone of '+side.lower()+' foot'
    elif stem.startswith(('METACARPAL_', 'METATARSAL_')):
        kind, num = stem.split('_')
        key = title+' '+ORD[int(num)-1]+' '+kind.lower()+' bone'
    else:
        key = title+' '+LABEL.get(stem,stem.lower())
    return key,side.lower()+'-'+part

def read_stl(file, expected):
    b=file.read_bytes()
    if hashlib.sha256(b).hexdigest()!=expected:
        raise ValueError(f'Source SHA-256 mismatch for {file}')
    nf=int.from_bytes(b[80:84],'little')
    if len(b)!=84+50*nf:raise ValueError('Invalid binary STL: '+str(file))
    xyz=np.ndarray((nf,3,3),'<f4',b,96,(50,12,4)).reshape(-1,3)
    v,i=np.unique(xyz,axis=0,return_inverse=True)
    return v.astype(float),i.reshape(-1,3)

def centre(v,f):
    t=v[f];a=np.linalg.norm(np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]),axis=1)
    return np.average(t.mean(axis=1),weights=a,axis=0)

def shared_registration(src,dst):
    # Every named bone contributes one surface area weighted centre. Scale stays 1.
    mx,my=src.mean(0),dst.mean(0)
    u,_,vt=np.linalg.svd((src-mx).T@(dst-my))
    signs=np.diag([1,1,np.linalg.det(vt.T@u.T)])
    r=vt.T@signs@u.T;t=my-r@mx
    assert abs(np.linalg.det(r)-1)<1e-8
    residual=np.linalg.norm(src@r.T+t-dst,axis=1)
    return {'rotation':r.tolist(),'translation_mm':t.tolist(),'method':'Rigid Kabsch registration of named bone surface area centroids','centroid_rms_mm':round(float(np.sqrt(np.mean(residual**2))),3)}

def sample(v,f,n,rng):
    tri=v[f];a=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
    tr=tri[rng.choice(len(f),n,p=a/a.sum())];uv=rng.random((n,2));ix=uv.sum(axis=1)>1;uv[ix]=1-uv[ix]
    return tr[:,0]+(tr[:,1]-tr[:,0])*uv[:,:1]+(tr[:,2]-tr[:,0])*uv[:,1:]

def topology(xyz,faces):
    a,b,c=xyz[faces[:,0]],xyz[faces[:,1]],xyz[faces[:,2]]
    area2=np.linalg.norm(np.cross(b-a,c-a),axis=1)
    edges=np.sort(np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]]),axis=1)
    graph=coo_matrix((np.ones(len(edges),dtype='uint8'),(edges[:,0],edges[:,1])),shape=(len(xyz),len(xyz)))
    comps=connected_components(graph,directed=False,return_labels=False)
    _,counts=np.unique(np.ascontiguousarray(edges,dtype='<u4').view('<u8'),return_counts=True)
    origin=xyz.mean(0)
    cc=float(np.einsum('ij,ij->i',a-origin,np.cross(b-origin,c-origin)).sum()/6*1e6)
    return dict(connected_components=int(comps),boundary_edges=int(np.sum(counts==1)),
                nonmanifold_edges=int(np.sum(counts>2)),degenerate_faces=int(np.sum(area2<1e-12)),signed_volume_cm3=round(cc,2))

def main(a):
    a.out.mkdir(parents=True,exist_ok=True)
    original=json.loads(a.baseline.read_text(encoding='utf-8-sig'));manifest=dict(original)
    preserved={x['name']:x for x in original['entries']}
    groups=manifest['groups'].copy()
    index=json.loads((a.atlas/'index.json').read_text())
    ids={x['name']:x['mesh'] for x in index}
    detail=json.loads((a.atlas/'detail.json').read_text());old={x['mesh']:x for x in detail['entries']}
    native=gzip.decompress((a.atlas/'detail.bin.gz').read_bytes())
    data=json.loads((a.source/'sources-113.json').read_text())
    names=[atlas_key(e['path'])[0] for e in data]
    if len(names)!=113 or len(set(names))!=113 or any(n not in ids for n in names):raise ValueError('Unmapped or duplicate names: '+str(set(names)-ids.keys()))
    def reference(name):
        e=old[ids[name]];n=e['vertices'];o=e['offset']
        vv=np.frombuffer(native,'<f4',3*n,o).reshape(-1,3)+detail['display_offset_mm']
        ff=np.frombuffer(native,'<u2',e['indices'],o+12*n).reshape(-1,3)
        return vv,ff
    # Calculate registration only for previously unrepresented anatomical regions.
    markers={g:[] for g in ['left-hand','right-hand','axial'] if g not in groups}
    for e in data:
        name,g=atlas_key(e['path'])
        if g in markers:
            v,f=read_stl(a.source/Path(e['path']).name,e['SHA256'])
            markers[g].append((name,centre(v,f),centre(*reference(name))))
    for g,points in markers.items():
        groups[g]=shared_registration(np.stack([p for _,p,_ in points]),np.stack([q for _,_,q in points]))
        groups[g]['anchors']=[nm for nm,_,_ in points]
        print('registered',g,'anchors',len(points),'rms',groups[g]['centroid_rms_mm'],flush=True)
    out_rows={};qa={};rng=np.random.default_rng(27421)
    for i,e in enumerate(data):
        name,group=atlas_key(e['path']);v,f=read_stl(a.source/Path(e['path']).name,e['SHA256'])
        transform=groups[group];r=np.asarray(transform['rotation']);t=np.asarray(transform['translation_mm'])
        xyz=((v@r.T+t)*.001).astype('<f4');indices=f.astype('<u4')
        b=xyz.tobytes()+indices.tobytes();raw_hash=hashlib.sha256(b).hexdigest()
        file=name.lower().replace(' ','-')+'.bin.gz';dst=a.out/file
        if name in preserved and dst.is_file():
            blob=dst.read_bytes()
            if hashlib.sha256(blob).hexdigest()!=preserved[name]['sha256'] or hashlib.sha256(gzip.decompress(blob)).hexdigest()!=raw_hash:
                raise ValueError('Existing asset no longer matches its frozen transform: '+name)
        else:
            blob=gzip.compress(b,compresslevel=6,mtime=0);temp=dst.with_suffix('.tmp');temp.write_bytes(blob);temp.replace(dst)
        sha=hashlib.sha256(blob).hexdigest()
        if name in preserved:
            row=preserved[name]
            if raw_hash!=row['packed_raw_sha256'] or len(b)!=row['vertices']*12+row['indices']*4:raise ValueError(name)
            # zlib/GZIP headers may differ between platforms even with identical decoded geometry.
            if sha!=row['sha256']:row={**row,'sha256':sha,'packed_bytes':len(blob)}
        else:
            ov,of=reference(name);source_sample=sample(xyz*1000,indices,3500,rng)
            target_sample=sample(ov,of,8000,rng);dist,_=cKDTree(target_sample).query(source_sample)
            row=dict(name=name,mesh=ids[name],group=group,file=file,vertices=len(v),indices=indices.size,
                triangles=len(f),previous_triangles=old[ids[name]]['indices']//3,packed_bytes=len(blob),
                packed_raw_sha256=raw_hash,stl_sha256=e['SHA256'],stl_path=e['path'],sha256=sha,
                bounds_m=[xyz.min(0).tolist(),xyz.max(0).tolist()],donor_to_atlas_surface_sample_median_mm=round(float(np.median(dist)),2),
                donor_to_atlas_surface_sample_p95_mm=round(float(np.quantile(dist,.95)),2))
        qa[name]=topology(xyz,indices);out_rows[name]=row
        if (i+1)%20==0:print('verified',i+1,flush=True)
    manifest['groups']=groups;manifest['entries']=[out_rows.pop(x['name']) for x in original['entries']]+list(out_rows.values())
    tmp=a.out/'manifest.json.new';tmp.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8');tmp.replace(a.out/'manifest.json')
    if a.audit:a.audit.write_text(json.dumps(qa,indent=2)+'\n',encoding='utf-8')
    print('finished',len(manifest['entries']),'meshes',sum(e['triangles'] for e in manifest['entries']),'triangles',sum(e['packed_bytes'] for e in manifest['entries']),'gzip bytes')
    print('topology variations',[(k,v)for k,v in qa.items() if v['boundary_edges'] or v['nonmanifold_edges'] or v['degenerate_faces'] or v['connected_components']!=1 or v['signed_volume_cm3']<=0])
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for key in ('source','baseline','atlas','out'):parser.add_argument('--'+key,type=Path,required=True)
    parser.add_argument('--audit',type=Path);main(parser.parse_args())
