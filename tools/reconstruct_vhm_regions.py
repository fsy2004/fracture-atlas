"""Build CT-referenced regions of a partially fused sternum and isolate sacrum at S5/Co1.
Run from the workspace with torso-evidence source crops, in native LPS millimetres.
The intact-source voxel shape is shared. Joined portions of the two sternal interfaces
are interpolated from the adjacent corticated margin, not asserted to be visible sutures.
"""
from pathlib import Path
import json,hashlib,gzip
import numpy as np
import scipy.ndimage as nd
from skimage.measure import marching_cubes
from scipy.sparse.csgraph import connected_components
from scipy.sparse import coo_matrix

import argparse,io,struct
parser=argparse.ArgumentParser(description='Reconstruct CT-referenced tissue regions from the original VHM volume and author labels.')
parser.add_argument('--source',type=Path,required=True,help='Folder with 01_Male.nii.gz, THORAX.seg.nrrd and SPINAL_COLUMN.seg.nrrd')
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args();P=args.source;D=args.out;D.mkdir(exist_ok=True,parents=True)
repo=Path(__file__).resolve().parents[1]
meta=json.loads((repo/'models/vhm/manifest.json').read_text())
ids={m['name']:m['mesh'] for m in json.loads((repo/'models/index.json').read_text())}
def registered_crop(stem):
 bounds={'sternum':([205,100,1320],[299,204,1560]),'sacrum':([190,218,965],[325,355,1140])}
 lo,hi=bounds[stem];xs=np.arange(int(lo[0]/.9375),int(hi[0]/.9375)+1);ys=np.arange(int(lo[1]/.9375),int(hi[1]/.9375)+1);nz=hi[2]-lo[2]+1
 with gzip.open(P/'01_Male.nii.gz')as fh:
  h=fh.read(352);assert struct.unpack_from('<4h',h,40)==(3,520,552,1873) and struct.unpack_from('<h',h,70)==(512,)
  fh.seek(352+lo[2]*520*552*2);ct=np.frombuffer(fh.read(nz*520*552*2),'<u2').reshape(nz,552,520)[:,ys][:,:,xs]
 name='THORAX' if stem=='sternum' else 'SPINAL_COLUMN';head,data=(P/(name+'.seg.nrrd')).read_bytes().split(b'\n\n',1)
 lines=head.decode().splitlines();values=dict(l.split(':=',1) for l in lines if ':=' in l)
 dims=list(map(int,next(l for l in lines if l.startswith('sizes:')).split(':')[1].split()));ch,nx,ny,depth=dims if len(dims)==4 else [1]+dims
 prefix=next(k[:-4] for k,v in values.items() if k.endswith('_Name') and v==stem.upper())
 layer=int(values[prefix+'Layer']);value=int(values[prefix+'LabelValue'])
 with gzip.GzipFile(fileobj=io.BytesIO(data))as fh:
  fh.seek(lo[2]*nx*ny*ch);a=np.frombuffer(fh.read(nz*nx*ny*ch),'B').reshape(nz,ny,nx,ch)
  mask=(a[:,ys][:,:,xs,layer]==value)
 return {'ct':ct,'mask':mask,'offset':np.array([xs[0]*.9375,ys[0]*.9375,lo[2]])}
out={k:meta[k] for k in ['source','revision','license','credit','source_url','citations']};out['entries']=[]
out['ct_sha256']='2ad6bb4129aa529e0d8d0f059694fccb4d996867cff3cfdf3c1cf1f4250fc776'
def sheet(X,Y,kind):
 # X-Y dependent landmarks on the sagittal orthogonal reconstructions.
 if kind=='MS':
  xs=[231,238,242,246,250,254,258,262,266,270,279];zs=[1488.2,1488.5,1489.3,1490.5,1491.0,1491.3,1491.1,1490.2,1489.1,1490.1,1492.0]
  return np.interp(X,xs,zs)-.29*(Y-157.)
 if kind=='XS':
  return np.interp(X,[232,238,242,246,250,254,258,262,266,270,275],[1386,1386,1383.4,1382.5,1383.0,1383.3,1384,1384.7,1385.8,1385.,1384.5])-.30*(Y-126)
 return np.interp(X,[237,244,250,254,258,263,269,275],[1010.7,1010.8,1011.8,1011.6,1011.0,1011.4,1012.8,1014.2])+.38*(Y-334)
for src,names in [('sternum',['Manubrium','Body of sternum','Xiphoid process']),('sacrum',['Sacrum'])]:
 q=registered_crop(src);mask=q['mask'];ct=q['ct'];o=q['offset']
 labels,num=nd.label(mask);mask=labels==np.bincount(labels.ravel())[1:].argmax()+1
 # Use smooth signed distance at the original sampling grid; never count subdivision as precision.
 mask=nd.binary_fill_holes(mask)
 outer=nd.gaussian_filter(nd.distance_transform_edt(mask,sampling=[1,.9375,.9375])-nd.distance_transform_edt(~mask,sampling=[1,.9375,.9375]),.55)
 z,y,x=np.ogrid[:mask.shape[0],:mask.shape[1],:mask.shape[2]]
 X=o[0]+x*.9375;Y=o[1]+y*.9375;Z=o[2]+z
 h1=Z-sheet(X,Y,'MS');h2=Z-sheet(X,Y,'XS');hc=Z-sheet(X,Y,'SC')
 vhm=meta['groups']['axial'];R=np.array(vhm['rotation']);trans=np.array(vhm['translation_mm'])
 for name in names:
  region={'Manubrium':h1,'Body of sternum':np.minimum(-h1,h2),'Xiphoid process':-h2,'Sacrum':hc}[name]
  field=np.minimum(outer,region);v,f,_,_=marching_cubes(field.astype('f4'),level=0,allow_degenerate=False)
  v=v[:,::-1]*[.9375,.9375,1]+o
  xyz=((v@R.T+trans)*.001).astype('<f4');f=f.astype('<u4')
  # Discard disconnected residual islands near interdigitating ends.
  edges=np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]])
  n,comp=connected_components(coo_matrix((np.ones(len(edges)),edges.T),shape=(len(xyz),)*2),directed=False)
  keep=comp==np.bincount(comp).argmax();idx=np.cumsum(keep)-1;f=idx[f[np.all(keep[f],axis=1)]].astype('<u4');xyz=xyz[keep]
  a,b,c=xyz[f].astype('f8').transpose(1,0,2);cen=xyz.mean(0);vol=np.einsum('ij,ij->',a-cen,np.cross(b-cen,c-cen))/6
  if vol<0:f=f[:,[0,2,1]].copy()
  edges=np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1)
  _,cnt=np.unique(edges,axis=0,return_counts=True);assert (cnt==2).all(),(name,np.unique(cnt,return_counts=True))
  raw=xyz.tobytes()+f.tobytes();file=name.lower().replace(' ','-')+'.bin.gz';b=gzip.compress(raw,compresslevel=6,mtime=0);(D/file).write_bytes(b)
  out['entries'].append(dict(name=name,mesh=ids[name],group='axial',file=file,vertices=len(xyz),indices=f.size,triangles=len(f),bounds_m=[xyz.min(0).tolist(),xyz.max(0).tolist()],packed_bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),packed_raw_sha256=hashlib.sha256(raw).hexdigest(),relation='CT-referenced anatomical region' if src=='sternum' else 'CT-referenced exclusion of coccyx',boundary_edges=0,nonmanifold_edges=0,volume_cm3=abs(float(vol))*1e6))
  print(name,len(f),round(abs(vol)*1e6,1))
 out['segmentation_'+src]=hashlib.sha256((P/('THORAX.seg.nrrd' if src=='sternum' else 'SPINAL_COLUMN.seg.nrrd')).read_bytes()).hexdigest()
(D/'manifest.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf8')
