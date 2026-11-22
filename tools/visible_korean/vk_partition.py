from pathlib import Path
import numpy as np,json,gzip,hashlib
from shapely import build_area,MultiLineString,constrained_delaunay_triangles
from shapely.geometry import box
from vk_mesh import mesh,h,parts
from mesh_weld import heal
def configure(source,atlas,out,landmarks):
 global P,D,M,land,A,t,idx,meta
 P=Path(source);D=Path(out);M=json.loads((D/'manifest.json').read_text());land=json.loads(Path(landmarks).read_text());A=np.array(M['groups']['vk-head']['rotation']);t=np.array(M['groups']['vk-head']['translation_mm'])
 idx={e['name']:e['mesh']for e in json.loads((atlas/'index.json').read_text())};meta={e['mesh']:e for e in json.loads((atlas/'detail.json').read_text())['entries']}
def split_poly(poly,dist):
 low=[];high=[]
 ds=[dist(p) for p in poly]
 for i,p in enumerate(poly):
  q=poly[(i+1)%len(poly)];a,b=ds[i],ds[(i+1)%len(poly)]
  if abs(a)<1e-10:a=0.
  if abs(b)<1e-10:b=0.
  if a<=0:low.append(p)
  if a>=0:high.append(p)
  if a*b<0:
   new=p+(q-p)*(a/(a-b));low.append(new);high.append(new)
 return [g for g in [low,high] if len(g)>=3]
def finalize(tris):
 a=np.round(np.array(tris).reshape(-1,3),6)
 v,f=np.unique(a,axis=0,return_inverse=True);f=f.reshape(-1,3);q=v[f];ar=np.linalg.norm(np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]),axis=1);f=f[ar>1e-10]
 return heal(v,f)
def cut(name,srcname,axis,kn):
 v,f=mesh(P/(srcname+'.stl'))
 s=kn[:,0].copy();x=kn[:,1].copy();other=3-axis
 # Prevent inserting a grid plane virtually coincident with existing STL vertices.
 s+=0.000013
 def mid(coord):return np.interp(coord,s,x)
 def side(p):return p[0]-mid(p[axis])
 tris=[[],[]]; yzsegments=[]
 for ids in f:
  q=v[ids]
  # Retain unmodified remote triangles whenever the expression has a constant sign;
  # subdivide all triangles that cross sample planes to keep the exterior mesh conforming.
  start=np.searchsorted(s,q[:,axis].min(),side='right');end=np.searchsorted(s,q[:,axis].max(),side='left');cells=[list(q)]
  for val in s[start:end]:
   cells=[new for poly in cells for new in split_poly(poly,lambda p:p[axis]-val)]
  for poly in cells:
   ds=np.array([side(p) for p in poly]);lo=[];hi=[];cut=[]
   for i,p in enumerate(poly):
    q=poly[(i+1)%len(poly)];a,b=ds[i],ds[(i+1)%len(poly)]
    if a<=0:lo.append(p)
    if a>=0:hi.append(p)
    if a*b<0:
     new=p+(q-p)*a/(a-b);lo.append(new);hi.append(new);cut.append(new)
   for g,res in [(lo,tris[0]),(hi,tris[1])]:
    if len(g)>=3:res.extend([[g[0],g[j],g[j+1]]for j in range(1,len(g)-1)])
   if len(cut)==2:
    uv=np.round(np.array(cut)[:,[axis,other]],6)
    if np.linalg.norm(uv[0]-uv[1])>1e-7:yzsegments.append(uv)
 poly=build_area(MultiLineString(yzsegments))
 assert poly.area>1e-4,(name,len(yzsegments),poly)
 bands=np.r_[poly.bounds[0]-.05,s[(s>poly.bounds[0])&(s<poly.bounds[2])],poly.bounds[2]+.05];cap=0
 for l,r in zip(bands[:-1],bands[1:]):
  region=poly.intersection(box(l,-500,r,500))
  if region.area<1e-12:continue
  faces=constrained_delaunay_triangles(region)
  for face in faces.geoms:
   uv=np.array(face.exterior.coords)[:3];a=np.zeros((3,3));a[:,axis]=uv[:,0];a[:,other]=uv[:,1];a[:,0]=mid(uv[:,0]);n=np.cross(a[1]-a[0],a[2]-a[0])
   if n[0]<0:a=a[[0,2,1]]
   tris[0].append(a);tris[1].append(a[[0,2,1]]);cap+=1
 rows=[]
 for si,data in enumerate(tris):
  vv,ff=finalize(data);orig=vv.copy();world=(vv@A.T+t)*.001;payload=world.astype('<f4').tobytes()+ff.astype('<u4').tobytes();gz=gzip.compress(payload,compresslevel=6,mtime=0)
  sideName=['Right','Left'][si]+' '+name;file=sideName.lower().replace(' ','-')+'.bin.gz';(D/file).write_bytes(gz)
  edges=np.sort(np.concatenate([ff[:,[0,1]],ff[:,[1,2]],ff[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True);q=world[ff];vol=np.einsum('ij,ij->i',q[:,0],np.cross(q[:,1],q[:,2])).sum()/6
  ent={'name':sideName,'mesh':idx[sideName],'group':'vk-head','file':file,'vertices':len(vv),'indices':ff.size,'triangles':len(ff),'previous_triangles':meta[idx[sideName]]['indices']//3,'packed_bytes':len(gz),'packed_raw_sha256':h(payload),'stl_sha256':h((P/(srcname+'.stl')).read_bytes()),'sha256':h(gz),'stl_path':'Skeletal system, cranium/'+srcname+'.stl','bounds_m':[world.min(0).tolist(),world.max(0).tolist()],'boundary_edges':int((counts==1).sum()),'nonmanifold_edges':int((counts>2).sum()),'signed_volume_cm3':round(vol*1e6,3),'segmentation':'Photo-guided side partition of an author-labelled bilateral surface. The merged donor surface is preserved. Internal and fused interfaces are interpolated from surface traces and median anatomical landmarks.','paired_source':'Bilateral '+name,'traced_axis':axis,'section_image_mm':.5,'cap_triangles':cap,'partition_landmark_count':len(s),'original_bilateral_triangles':len(f)}
  rows.append(ent);print(sideName,len(ff),ent['boundary_edges'],ent['nonmanifold_edges'],ent['signed_volume_cm3'],'cap',cap,flush=True)
 return rows
def partition(source,atlas,out,landmarks):
 configure(source,atlas,out,landmarks)
 add=[]
 for name,axis in [('Nasal bone',2),('Maxilla',1),('Parietal bone',1)]:add+=cut(name.lower(),name,axis,np.asarray(land[name]))
 M['entries']=[e for e in M['entries']if e['name'] not in {r['name']for r in add}]+add
 (D/'manifest.json').write_text(json.dumps(M,indent=2)+'\n')
