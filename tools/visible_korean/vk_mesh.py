from pathlib import Path
import json,numpy as np,gzip,hashlib
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree
P=None
ROOT=None
def h(b):return hashlib.sha256(b).hexdigest()
def mesh(path):
 b=path.read_bytes();n=int.from_bytes(b[80:84],'little');arr=np.ndarray((n,3,3),'<f4',b,96,(50,12,4)).reshape(-1,3)
 v,f=np.unique(arr,axis=0,return_inverse=True);f=f.reshape(-1,3);return v.astype(float),f
def parts(v,f):
 e=f.ravel();n,l=connected_components(coo_matrix((np.ones(len(e)),(e,np.roll(f,1,axis=1).ravel())),shape=(len(v),len(v))),directed=False)
 groups=[]
 for k in range(n):
  ids=np.where(l==k)[0];u=f[l[f[:,0]]==k];lut=np.empty(len(v),int);lut[ids]=np.arange(len(ids));groups.append((v[ids],lut[u]))
 return sorted(groups,key=lambda g:-len(g[1]))
def sample(v,f,n,rng):
 tri=v[f];area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
 t=tri[rng.choice(len(f),size=n,p=area/area.sum())];uv=rng.random((len(t),2));mask=uv.sum(axis=1)>1;uv[mask]=1-uv[mask];return t[:,0]+(t[:,1]-t[:,0])*uv[:,:1]+(t[:,2]-t[:,0])*uv[:,1:]
def fix_fit(a,b,w=None):
 w=np.ones(len(a))/len(a) if w is None else w/w.sum();c=w@a;d=w@b;U,S,V=np.linalg.svd((a-c).T@((b-d)*w[:,None]));D=np.eye(3);D[-1,-1]=np.linalg.det(V.T@U.T);r=V.T@D@U.T;return r,d-r@c
def pack(source,atlas,output):
 global P,ROOT
 P,ROOT=Path(source),Path(atlas)
 pf=Path(output);pf.mkdir(exist_ok=True);src=json.loads(Path(__file__).with_name('source-lock.json').read_text())
 names={'Ethmoid bone':'Ethmoid','Vomer':'Vomer','Frontal bone':'Frontal bone','Hyoid bone':'Hyoid bone','Occipital bone':'Occipital bone','Sphenoid bone':'Sphenoid bone','Zygomatic bone':'zygomatic bone','Temporal bone':'temporal bone','Mandible':'Mandible','Maxilla':'maxilla','Nasal bone':'nasal bone','Parietal bone':'parietal bone'}
 idx={e['name']:e['mesh'] for e in json.loads((ROOT/'index.json').read_text('utf-8-sig'))}
 dm=json.loads((ROOT/'detail.json').read_text('utf-8-sig'));packed=gzip.decompress((ROOT/'detail.bin.gz').read_bytes());bv={};bf={}
 for e in dm['entries']:
  o,n=e['offset'],e['vertices'];bv[e['mesh']]=np.frombuffer(packed,'<f4',count=n*3,offset=o).reshape(-1,3)+dm['display_offset_mm'];bf[e['mesh']]=np.frombuffer(packed,'<u2',count=e['indices'],offset=o+n*12).reshape(-1,3)
 objects={};pairs={};rng=np.random.default_rng(20261122);a={};b={};orig={}
 axial=np.array([[1,0,0],[0,0,1],[0,-1,0.]])
 for k,name in names.items():
  v,f=mesh(P/(k+'.stl'));orig[k]=h((P/(k+'.stl')).read_bytes())
  src_groups=parts(v,f);v=v@axial.T
  if name in ['zygomatic bone','temporal bone']:
   assert len(src_groups)==2
   for side,(vv,ff) in zip(['Right','Left'],sorted(src_groups,key=lambda g:g[0][:,0].mean())):
    key=side+' '+name;objects[key]=(vv@axial.T,ff,k);pairs[key]=[key]
  elif name in ['nasal bone','parietal bone','maxilla']:
   key='Bilateral '+name;objects[key]=(v,f,k);pairs[key]=[s+' '+name for s in ['Right','Left']]
  else:
   objects[name]=(v,f,k);pairs[name]=[name]
 for k,(v,f,_) in objects.items():
  a[k]=sample(v,f,2400,rng);b[k]=np.concatenate([sample(bv[idx[n]],bf[idx[n]],6000,rng) for n in pairs[k]])
 atlas_keys=[k for k in a if k!='Hyoid bone'];R,t=fix_fit(np.array([a[k].mean(0) for k in atlas_keys]),np.array([b[k].mean(0) for k in atlas_keys]));trees={k:cKDTree(b[k]) for k in atlas_keys}
 for j in range(50):
  aa=[];bb=[];ww=[]
  for k in atlas_keys:
   d,ix=trees[k].query(a[k]@R.T+t);m=d<np.quantile(d,.85);aa.append(a[k][m]);bb.append(b[k][ix[m]]);ww.append(np.full(m.sum(),1/m.sum()))
  R1,t1=fix_fit(np.vstack(aa),np.vstack(bb),np.concatenate(ww));err=np.max(np.abs(R1-R))+.002*np.linalg.norm(t1-t);R,t=R1,t1
  if err<2e-6:break
 output={'format':'vhm-f32m-u32-v1','source':'Visible Korean male head','revision':'22759852','license':'CC BY-NC 4.0','license_url':'https://creativecommons.org/licenses/by-nc/4.0/','source_url':'https://doi.org/10.5281/zenodo.22759852','credit':'Chung Yoh Kim and Jin Seo Park, Visible Korean male head dataset, version 2, 2026. Native organ STL meshes reconstructed from anatomical segmentation of one 67-year-old man.','citations':['https://doi.org/10.5281/zenodo.22759852'],'coordinate_contract':'Source millimetres to atlas metres by one rigid head transform. +X patient left, +Y superior, +Z anterior after transform.','groups':{'vk-head':{'rotation':(R@axial).tolist(),'translation_mm':t.tolist()}},'entries':[],'paired_regions':[],'context':[]}
 for k,(v,f,source) in objects.items():
  v=(v@R.T+t)*.001;data=v.astype('<f4').tobytes()+f.astype('<u4').tobytes();zf=gzip.compress(data,compresslevel=6,mtime=0);file=k.lower().replace(' ','-')+'.bin.gz';(pf/file).write_bytes(zf);ee=np.sort(np.concatenate((f[:,[0,1]],f[:,[0,2]],f[:,[1,2]])),axis=1);_,cnt=np.unique(ee,axis=0,return_counts=True);tr=v[f];area=np.linalg.norm(np.cross(tr[:,1]-tr[:,0],tr[:,2]-tr[:,0]),axis=1);signed=np.einsum('ij,ij->i',tr[:,0],np.cross(tr[:,1],tr[:,2])).sum()/6
  entry={'name':k,'mesh':idx.get(k),'group':'vk-head','file':file,'vertices':len(v),'indices':f.size,'triangles':len(f),'previous_triangles':sum(len(bf[idx[n]]) for n in pairs[k]),'packed_bytes':len(zf),'packed_raw_sha256':h(data),'stl_sha256':orig[source],'sha256':h(zf),'stl_path':'Skeletal system, cranium/'+source+'.stl','bounds_m':[v.min(0).tolist(),v.max(0).tolist()],'boundary_edges':int((cnt==1).sum()),'nonmanifold_edges':int((cnt>2).sum()),'degenerate_faces':int((area<1e-15).sum()),'signed_volume_cm3':round(signed*1e6,3),'component_count':len(parts(v,f))}
  cat='context' if k=='Mandible' else 'paired_regions' if k.startswith('Bilateral') else 'entries';output[cat].append(entry);print(k,entry['triangles'],entry['previous_triangles'],entry['boundary_edges'],entry['nonmanifold_edges'],entry['signed_volume_cm3'])
 (pf/'manifest.json').write_text(json.dumps(output,indent=2)+'\n',encoding='utf-8')
