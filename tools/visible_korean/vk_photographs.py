import numpy as np
from pathlib import Path
from numba import njit
from scipy.ndimage import map_coordinates,gaussian_filter,sobel
from PIL import Image
from vk_mesh import mesh
P=None
rgb=None
@njit
def raster(v,f,x0,y0,W,H,step,sign):
 out=np.full((H,W),-9999.)
 for r in range(len(f)):
  a,b,c=v[f[r,0]],v[f[r,1]],v[f[r,2]];x1,y1,z1=a;x2,y2,z2=b;x3,y3,z3=c
  den=(y2-y3)*(x1-x3)+(x3-x2)*(y1-y3)
  if abs(den)<1e-11:continue
  ix0=max(0,int(np.ceil((min(x1,x2,x3)-x0)/step)));ix1=min(W-1,int(np.floor((max(x1,x2,x3)-x0)/step)));iy0=max(0,int(np.ceil((min(y1,y2,y3)-y0)/step)));iy1=min(H-1,int(np.floor((max(y1,y2,y3)-y0)/step)))
  for iy in range(iy0,iy1+1):
   y=y0+iy*step
   for ix in range(ix0,ix1+1):
    x=x0+ix*step;u=((y2-y3)*(x-x3)+(x3-x2)*(y-y3))/den;w=((y3-y1)*(x-x3)+(x1-x3)*(y-y3))/den;t=1-u-w
    if u>=0 and w>=0 and t>=0:out[iy,ix]=max(out[iy,ix],sign*(u*z1+w*z2+t*z3))
 return out*sign
def overview(src,axes,sign,drange,xmin,xmax):
 v,f=mesh(P/(src+'.stl'));uu=axes[1];step=.20;xx=np.arange(xmin,xmax,step);yy=np.arange(np.floor(v[:,uu].min())-.1,np.ceil(v[:,uu].max())+.1,step);x,y=np.meshgrid(xx,yy);depth=raster(v[:,axes],f,xx[0],yy[0],len(xx),len(yy),step,sign);inside=np.abs(depth)<8000
 samples=[]
 for dz in drange:
  loc=[0,0,0];loc[0]=x;loc[uu]=y;loc[axes[2]]=np.where(inside,depth-sign*dz,0)
  samples.append(np.stack([map_coordinates(rgb[...,c],(468+loc[2]*2,-loc[1]*2,loc[0]*2),order=1) for c in range(3)],axis=-1))
 a=np.mean(samples,axis=0);a[~inside,:]=0;gray=a.mean(axis=-1)
 stain=(a[...,0]-a[...,1])*.7+(255-gray)*.3
 contrast=stain-gaussian_filter(stain,sigma=(2,9))
 shaded=np.zeros_like(a);val=np.clip(150-contrast*9,0,255);shaded[:]=val[:,:,None];shaded[~inside,:]=0
 im=Image.fromarray(np.uint8(np.concatenate([a,shaded],axis=1)));im.save(P/(src+'-mapped.png'))
 np.savez(P/(src+'-map.npz'),xx=xx,yy=yy,depth=depth,stain=stain,contrast=contrast,a=a)
def project(source,rgb_volume):
 global P,rgb
 P=Path(source);rgb=rgb_volume
 overview('Parietal bone',[0,1,2],1,[.35,.75,1.25,1.75,2.15],94,114)
 overview('Nasal bone',[0,2,1],-1,[.0,.25,.5,.75],94,114)
 overview('Maxilla',[0,1,2],-1,[.0,.4,.75,1.,1.25],91,116)
