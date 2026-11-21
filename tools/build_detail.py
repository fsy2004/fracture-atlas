"""Pack native anatomical surfaces. Registration matrices move legacy lesson landmarks only.
Input folder contains verified <FMA ID>.stl files from the commit recorded in detail.json.
Uses NumPy and SciPy. No nonuniform scaling, vertex smoothing or triangle subdivision.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

SOURCE = "https://github.com/Kevin-Mattheus-Moerman/BodyParts3D"
COMMIT = "2c83c698788cff57f6317bddcf712e7acfbea7d8"
ROOT = Path(__file__).resolve().parents[1] / "models"

def split_mesh(vertices, faces):
    graph = coo_matrix((np.ones(faces.size), (faces.ravel(), np.roll(faces, 1, axis=1).ravel())),
                       shape=(len(vertices), len(vertices)))
    _, labels = connected_components(graph, directed=False)
    pieces = []
    for label in np.unique(labels):
        triangles = faces[labels[faces[:, 0]] == label]
        ids, inverse = np.unique(triangles, return_inverse=True)
        pieces.append((vertices[ids], inverse.reshape(-1, 3)))
    return sorted(pieces, key=lambda pair: -len(pair[1]))

def head_landmark(vertices):
    # Robust sphere fit on the medial surface of the right proximal humerus/femur.
    top=vertices[vertices[:,1]>vertices[:,1].max()-50]
    patch=top[top[:,0]>top[:,0].max()-28]
    keep=np.ones(len(patch),dtype=bool)
    for _ in range(8):
        active=patch[keep];mean=active.mean(axis=0);local=active-mean
        design=np.column_stack((2*local,np.ones(len(local))))
        sol=np.linalg.lstsq(design,(local*local).sum(axis=1),rcond=None)[0]
        centre=mean+sol[:3];radius=np.sqrt(sol[3]+sol[:3]@sol[:3])
        residual=np.linalg.norm(patch-centre,axis=1)-radius
        keep=np.abs(residual)<max(1.2,np.quantile(np.abs(residual),.76))
    return dict(centre_mm=centre.tolist(),radius_mm=float(radius),fitted_vertices=int(keep.sum()),
                patch_rms_mm=float(np.sqrt(np.mean(residual[keep]**2))))

def main(folder,fetch):
    folder.mkdir(parents=True,exist_ok=True)
    released=ROOT/'detail.json'
    # The versioned manifest is also the calibration table for the existing lessons.
    calibration={e['mesh']:e for e in json.loads(released.read_text())['entries']}
    checks={e['id']:e['source_sha256'] for e in calibration.values()}
    index=json.loads((ROOT/'index.json').read_text())
    body=(ROOT/'bones.bin').read_bytes()
    entries=[];packed=bytearray()
    for key in dict.fromkeys(m['id'] for m in index):
        asset=folder/(key+'.stl')
        if fetch and not asset.exists():
            url=f'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/{COMMIT}/assets/BodyParts3D_data/stl/{key}.stl'
            with urlopen(url,timeout=90) as response:
                raw=response.read()
            if checks.get(key) and hashlib.sha256(raw).hexdigest()!=checks[key]:
                raise ValueError(f'Source mismatch: {key}')
            asset.write_bytes(raw)
        raw=asset.read_bytes()
        if checks.get(key) and hashlib.sha256(raw).hexdigest()!=checks[key]:
            raise ValueError(f'Source mismatch: {key}')
        count=int.from_bytes(raw[80:84],'little')
        assert len(raw)==84+50*count
        p=np.ndarray((count,3,3),'<f4',raw,96,(50,12,4)).reshape(-1,3)
        v,f=np.unique(p[:,[0,2,1]]*[1,1,-1],axis=0,return_inverse=True)
        f=f.reshape(-1,3)
        targets=[m for m in index if m['id']==key]
        parts=split_mesh(v,f) if len(targets)>1 else [(v,f)]
        assert len(parts)==len(targets),(key,len(parts))
        # Preserve medial/lateral identities in the multi-part sesamoid files.
        source_order=np.argsort([v.mean(0)[0] for v,f in parts])
        refs=[np.frombuffer(body,'<f4',3*m['vertices'],m['offset']).reshape(-1,3)*1000 for m in targets]
        target_order=np.argsort([v.mean(0)[0] for v in refs])
        for j,k in zip(source_order,target_order):
            m=targets[k];v,f=parts[j]
            assert len(v)<65536 and np.all(np.isfinite(v))
            # Keep the STL float32 coordinates. All bones use the same rigid axis convention.
            raw_positions=v.astype('<f4').tobytes()
            offset=len(packed)
            packed.extend(raw_positions)
            packed.extend(f.astype('<u2').tobytes())
            packed.extend(bytes(-len(packed)%4))
            info=calibration[m['mesh']]
            entries.append(dict(mesh=m['mesh'],id=key,offset=offset,vertices=len(v),indices=f.size,
                                source_sha256=hashlib.sha256(raw).hexdigest(),
                                native_xyz_sha256=hashlib.sha256(raw_positions).hexdigest(),
                                linear=info['linear'],translation_mm=info['translation_mm']))
            if key in ('FMA23130','FMA24474','FMA23131','FMA24475'):
                left=m['name'].startswith('Left')
                sign=np.array([-1 if left else 1,1,1])
                result=head_landmark(v*sign)
                result['centre_mm']=(np.array(result['centre_mm'])*sign).tolist()
                entries[-1]['head_fit']=result
    manifest=dict(source=SOURCE,commit=COMMIT,license="CC BY-SA 2.1 JP",credit="BodyParts3D, Copyright © 2008 Life Science Integrated Database Center",
                  license_url="https://creativecommons.org/licenses/by-sa/2.1/jp/",format="native-f32-mm-v1",
                  display_offset_mm=[0,4.171,-100],
                  buffer_sha256=hashlib.sha256(packed).hexdigest(),entries=entries)
    (ROOT/'detail.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf8')
    (ROOT/'detail.bin.gz').write_bytes(gzip.compress(bytes(packed),compresslevel=6,mtime=0))
    print(len(entries),sum(m['indices']//3 for m in entries),len(packed),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder',type=Path);p.add_argument('--fetch',action='store_true');args=p.parse_args();main(args.folder,args.fetch)
