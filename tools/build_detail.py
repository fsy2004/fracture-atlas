"""Register the pinned anatomical STL surfaces to the indexed atlas for the lesson anchors.
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
from scipy.spatial import cKDTree
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

def sample_surface(v, f, rng, count):
    triangles = v[f]
    area = np.linalg.norm(np.cross(triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0]),axis=1)
    t = triangles[rng.choice(len(f), count, p=area/area.sum())]
    uv = rng.random((count,2))
    uv[uv.sum(axis=1)>1] = 1-uv[uv.sum(axis=1)>1]
    return t[:, 0]+uv[:, :1]*(t[:, 1]-t[:, 0])+uv[:, 1:]*(t[:, 2]-t[:, 0])

def register(v, f, ref, triangles):
    rng = np.random.default_rng(241)
    points = sample_surface(v,f,rng,3200)
    dest = sample_surface(ref,triangles,rng,9500)
    tree = cKDTree(dest)
    # Start from the common anatomical frame; fit proper rotation, translation and a uniform scale.
    transform=np.eye(3)
    shift=(ref.min(0)+ref.max(0)-v.min(0)-v.max(0))/2
    for _ in range(55):
        dist, indices = tree.query(points@transform+shift)
        keep = dist <= np.quantile(dist,.92)
        x,y = points[keep],dest[indices[keep]]
        xc,yc = x-x.mean(0),y-y.mean(0)
        u,s,vt = np.linalg.svd(xc.T@yc)
        sign=np.sign(np.linalg.det(u@vt))
        rotation=(u*np.array([1,1,sign]))@vt
        scale=np.clip((s[0]+s[1]+s[2]*sign)/(xc*xc).sum(),.88,1.12)
        transform=scale*rotation
        shift=y.mean(0)-x.mean(0)@transform
    aligned=v@transform+shift
    extent=np.ptp(ref,axis=0)
    axis=int(np.argmax(extent))
    if extent[axis]>2.5*np.partition(extent,-2)[-2]:
        # Endpoints anchor the old joint positions for elongated long bones.
        factor=extent[axis]/np.ptp(aligned[:,axis])
        centre=(aligned.max(0)+aligned.min(0))/2
        translation=(ref[:,axis].max()+ref[:,axis].min())/2-centre[axis]
        transform*=factor
        shift=(shift-centre)*factor+centre
        shift[axis]+=translation
        aligned=v@transform+shift
    residual=tree.query(points@transform+shift)[0]
    return aligned,transform,shift,float(np.quantile(residual,.95))

def main(folder,fetch):
    folder.mkdir(parents=True,exist_ok=True)
    released=ROOT/'detail.json'
    checks={m['id']:m['source_sha256'] for m in json.loads(released.read_text())['entries']} if released.exists() else {}

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
            faces=np.frombuffer(body,'<u2',m['indices'],m['offset']+12*m['vertices']).reshape(-1,3)
            aligned,rot,shift,p95=register(v,f,refs[k],faces)
            assert len(v)<65536 and np.all(np.isfinite(aligned))
            # Packed positions use 0.033 mm increments relative to per-bone origin.
            origin=aligned.min(0)
            q=np.rint((aligned-origin)*30)
            assert q.max()<65536
            offset=len(packed)
            packed.extend(q.astype('<u2').tobytes());packed.extend(f.astype('<u2').tobytes())
            entries.append(dict(mesh=m['mesh'],id=key,offset=offset,origin_mm=origin.tolist(),vertices=len(v),
                                indices=f.size,source_sha256=hashlib.sha256(raw).hexdigest(),
                                linear=rot.tolist(),translation_mm=shift.tolist(),sampled_p95_mm=round(p95,2)))
    manifest=dict(source=SOURCE,commit=COMMIT,license="CC BY-SA 2.1 JP",credit="BodyParts3D, Copyright © 2008 Life Science Integrated Database Center",
                  license_url="https://creativecommons.org/licenses/by-sa/2.1/jp/",position_units_per_mm=30,
                  buffer_sha256=hashlib.sha256(packed).hexdigest(),entries=entries)
    (ROOT/'detail.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf8')
    (ROOT/'detail.bin.gz').write_bytes(gzip.compress(bytes(packed),compresslevel=6,mtime=0))
    print(len(entries),sum(m['indices']//3 for m in entries),len(packed),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder',type=Path);p.add_argument('--fetch',action='store_true');args=p.parse_args();main(args.folder,args.fetch)
