"""Compare the released triangle soup to the pinned source STL files, including winding."""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import numpy as np

def records(triangles):
    array=np.ascontiguousarray(triangles,dtype='<f4').reshape(-1,9)
    return np.sort(array.view('V36').ravel())

def load_regional_buffers(root):
    regions=json.loads((root/'detail-regions.json').read_text(encoding='utf-8-sig'))
    lookup={}
    for part in regions.values():
        gz=(root/part['file']).read_bytes()
        assert hashlib.sha256(gz).hexdigest()==part['sha256'],part['file']
        raw=gzip.decompress(gz)
        for mesh_id,offset in part['offsets'].items():
            lookup[mesh_id]=(raw,offset)
    return lookup

def verify(folder):
    root=Path(__file__).resolve().parents[1]/'models'
    manifest=json.loads((root/'detail.json').read_text(encoding='utf-8-sig'))
    lookup=load_regional_buffers(root)
    count=0
    for key in {m['id'] for m in manifest['entries']}:
        raw=(folder/(key+'.stl')).read_bytes()
        n=int.from_bytes(raw[80:84],'little')
        src=np.ndarray((n,3,3),'<f4',raw,96,(50,12,4))
        expected=src[:,:,[0,2,1]]*np.array([1,1,-1],dtype='<f4')
        actual=[]
        for m in (m for m in manifest['entries'] if m['id']==key):
            assert hashlib.sha256(raw).hexdigest()==m['source_sha256'],key
            packed,offset=lookup[m['mesh']]
            v=np.frombuffer(packed,'<f4',m['vertices']*3,offset).reshape(-1,3)
            f=np.frombuffer(packed,'<u2',m['indices'],offset+v.nbytes).reshape(-1,3)
            actual.append(v[f])
        assert np.array_equal(records(expected),records(np.concatenate(actual))),key
        count+=n
    print(f'{len(manifest["entries"])} structures, {count} triangles match native STL coordinates and winding.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder',type=Path)
    verify(parser.parse_args().folder)
