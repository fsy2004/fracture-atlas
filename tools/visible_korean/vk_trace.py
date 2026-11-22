from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter1d,distance_transform_edt
from scipy.interpolate import interp1d
from PIL import Image,ImageDraw
from vk_mesh import mesh
P=Path(__file__).resolve().parent
# Manually placed control regions on the same donor's mapped photographs, in preview pixels.
# Narrow matched-filter path optimization refines them only within the local landmark corridor.
controls={'Parietal bone':[(117,30),(145,28),(181,20),(216,29),(241,21),(262,33),(287,38),(299,45),(333,24),(361,39),(398,39),(434,40),(460,40),(477,43),(505,39),(535,40),(559,39),(584,41),(606,45)],
'Nasal bone':[(7,50),(17,49),(34,49),(52,49),(70,51),(86,49),(101,49),(117,51),(138,51),(145,53)],
'Maxilla':[(64,63),(81,64),(92,61),(106,63),(124,61),(146,64),(168,62),(194,60),(218,59),(238,61),(258,63),(282,64),(307,64)]}
def estimate(name):
 d=np.load(P/(name+'-map.npz'));x=d['xx'];y=d['yy'];c=d['contrast'];a=d['a'];valid=np.abs(d['depth'])<1000
 anchors=np.array(controls[name]);prior=np.interp(np.arange(len(y)),anchors[:,0],anchors[:,1]);Y,X=np.indices(c.shape);pad={'Parietal bone':8.5,'Nasal bone':5.5,'Maxilla':7.5}[name]
 margin=distance_transform_edt(valid);e=np.clip(c,-9,9);score=e-(.65 if name=='Parietal bone' else 1.1)*((X-prior[:,None])/3.0)**2
 score[(abs(X-prior[:,None])>pad)|(margin<3.)]=-10000
 # Outside source bone, real per-bone end is open, so priors are extended only to cover the volume.
 bad=score.max(1)<-1000
 score[bad]=-(X[bad]-prior[bad,None])**2
 back=np.zeros(c.shape,int);tot=score[0].copy();ids=np.arange(len(x))
 for r in range(1,len(y)):
  dp=tot[:,None]-(ids[:,None]-ids[None,:])**2*.65
  back[r]=np.argmax(dp,axis=0);tot=score[r]+dp.max(0)
 p=[int(np.argmax(tot))]
 for r in range(len(y)-1,0,-1):p.append(int(back[r,p[-1]]))
 p=np.array(p[::-1]);path=gaussian_filter1d(x[p],1.5)
 # Superior sagittal sinus (parietal), dorsal nasal crest, and median palatal crest provide
 # independent anatomical localization but do not measure the hidden internal interface.
 ok=(~bad)&(np.arange(len(y))>=anchors[0,0])&(np.arange(len(y))<=anchors[-1,0])
 sampled=np.arange(max(0,anchors[0,0]),min(len(y),anchors[-1,0]+1),4);y0=y[sampled];xx=path[sampled]
 print(name,'calibrated x mean/range',xx.mean(),xx.min(),xx.max(),'contrast median vs flanks',np.median(c[ok,p[ok]]),np.median(c[ok,np.clip(p[ok]+7,0,len(x)-1)]),'coverage mm',len(sampled)*.8)
 knots=np.vstack([y0,xx]).T.tolist()
 im=Image.fromarray(np.uint8(a));dr=ImageDraw.Draw(im);dr.line([(float(i),int(j)) for j,i in enumerate((path-x[0])/.2) if ok[j]],fill=(0,220,255),width=1);im.resize((im.width*2,im.height*2)).save(P/(name+'-review.png'))
 return knots
def trace(source):
 global P
 P=Path(source)
 import json
 (P/'traced-landmarks.json').write_text(json.dumps({n:estimate(n) for n in controls},indent=2))
