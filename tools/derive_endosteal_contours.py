"""Estimate primary endosteal contours of the same male from the marrow-to-cortex transition.
Sparse contours in the native acquisition plane; no raw scan distributed."""
from pathlib import Path
import json,gzip,io,requests
import numpy as np
from scipy import ndimage as nd
from skimage.filters import threshold_otsu
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,required=True,help='Folder containing the original male CT and both LOWER_EXTREMITY seg.nrrd masks.')
parser.add_argument('--bones',nargs='+',choices=['FEMUR','TIBIA','FIBULA'],default=['FEMUR','TIBIA'],help='Anatomical structures present in both masks.')
parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
P=args.source;CT=P/'01_Male.nii.gz'
rev='9cdfccfc74a42ea657c2adf055513e6371239f49';dirs=np.linspace(0,2*np.pi,96,endpoint=False);result={}
for side in ['RIGHT','LEFT']:
 fname='LOWER_EXTREMITY_'+side+'.seg.nrrd';src=P/fname
 head,body=src.read_bytes().split(b'\n\n',1);hh=head.decode().splitlines();sizes=list(map(int,next(l for l in hh if l.startswith('sizes:')).split(':')[1].split()))
 ch,xn,yn,zn=sizes if len(sizes)==4 else [1]+sizes
 h=dict(l.split(':=',1)for l in hh if ':='in l);target={}
 for k,g in h.items():
  if k.endswith('_Name') and g in [name+'_'+side for name in args.bones]:
   pre=k[:-4];bb=list(map(int,h[pre+'Extent'].split()));target[g]=(int(h[pre+'Layer']),int(h[pre+'LabelValue']),bb)
 with gzip.GzipFile(fileobj=io.BytesIO(body))as ms,gzip.open(CT)as ct:
  tasks=sorted([(z,g,layer,val,bb)for g,(layer,val,bb)in target.items() for z in range(bb[4],bb[5],3)])
  for z,g,layer,val,bb in tasks:
   ms.seek(z*xn*yn*ch);plane=np.frombuffer(ms.read(xn*yn*ch),'B').reshape(yn,xn,ch)[:,:,layer]==val
   if plane.sum()<100:continue
   labels,n=nd.label(plane);plane=(labels==np.bincount(labels.ravel())[1:].argmax()+1)
   if plane.sum()<100:continue
   yy,xx=np.where(plane);y0,y1=max(0,yy.min()-3),min(yn,yy.max()+4);x0,x1=max(0,xx.min()-3),min(xn,xx.max()+4);mask=nd.binary_fill_holes(plane[y0:y1,x0:x1])
   ct.seek(352+z*xn*yn*2);data=np.frombuffer(ct.read(xn*yn*2),'<u2').reshape(yn,xn)[y0:y1,x0:x1].astype(float)
   data=nd.gaussian_filter(data,.48)
   core=nd.binary_erosion(mask,iterations=2);values=data[core]
   if values.size<30 or np.ptp(values)<100:continue
   low,high=np.percentile(values,[10,90]);threshold=float(threshold_otsu(values))
   if high-low<260:continue
   lumen=nd.binary_fill_holes((data<threshold)&core);labs,n=nd.label(lumen)
   if not n:continue
   ymid,xmid=nd.center_of_mass(mask);j,i=np.unravel_index(np.argmin(np.where(lumen,(np.indices(mask.shape)[0]-ymid)**2+(np.indices(mask.shape)[1]-xmid)**2,1e20)),mask.shape)
   lumen=labs==labs[j,i];yc,xc=nd.center_of_mass(lumen)
   if not np.isfinite(yc+xc) or not lumen[round(yc),round(xc)]:continue
   rr=np.arange(0,55,.25);Y=yc+np.sin(dirs[:,None])*rr/.9375;X=xc+np.cos(dirs[:,None])*rr/.9375
   trace=nd.map_coordinates(data,[Y,X],order=1,mode='nearest');inside=nd.map_coordinates(mask.astype(float),[Y,X],order=1,mode='constant')>.5
   cross=(trace[:,1:]>threshold)&(trace[:,:-1]<=threshold)&inside[:,1:]
   if not np.all(cross.any(axis=1)):continue
   k=cross.argmax(axis=1)+1;rows=np.arange(len(k));radii=rr[k-1]+.25*(threshold-trace[rows,k-1])/(trace[rows,k]-trace[rows,k-1])
   ext=rr[np.argmax(~inside,axis=1)]
   if not np.all((radii>1.8)&(radii<ext-.45)):continue
   rec=[z,round((x0+xc)*.9375,3),round((y0+yc)*.9375,3),int(round(threshold)),int(round(high-low))]+np.round(radii,2).tolist()
   result.setdefault(side.title()+' '+g.split('_')[0].lower(),[]).append(rec)
for name,s in result.items():print(name,len(s),[s[0][0],s[-1][0]],'gaps',[(a[0],b[0])for a,b in zip(s,s[1:]) if b[0]-a[0]>9])
args.out.write_text(json.dumps({'format':'native-lps-mm-polar96','method':'Otsu threshold in eroded native bone mask; rays from central marrow component to inner cortical transition; 3 mm slice spacing, 0.25 mm ray sampling, skip gaps >9 mm.','source_sha256':'2ad6bb4129aa529e0d8d0f059694fccb4d996867cff3cfdf3c1cf1f4250fc776','bones':result},separators=(',',':')),encoding='utf8')
