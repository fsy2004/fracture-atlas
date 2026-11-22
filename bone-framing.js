import * as T from './vendor/three.module.js';

// Fit the selected surface in perspective, including its depth. The projected
// outline of a long, curved bone need not be centred on its world bounding box.
export function frameBone(mesh,direction,fov,aspect,fill=.77,screenUp=new T.Vector3(0,1,0)){
 const z=direction.clone().normalize(),up=screenUp.clone().normalize();
 if(Math.abs(up.dot(z))>1-1e-13)up.set(0,0,Math.abs(z.y)>.9?-Math.sign(z.y):1);
 if(Math.abs(up.dot(z))>1-1e-13)up.set(1,0,0);
 const x=new T.Vector3().crossVectors(up,z).normalize(),y=new T.Vector3().crossVectors(z,x);
 const meshes=Array.isArray(mesh)?mesh:[mesh],bounds=new T.Box3(),partBox=new T.Box3();
 let count=0;
 for(const part of meshes){
  part.updateWorldMatrix(true,false);
  if(!part.geometry.boundingBox)part.geometry.computeBoundingBox();
  bounds.union(partBox.copy(part.geometry.boundingBox).applyMatrix4(part.matrixWorld));count+=part.geometry.attributes.position.count;
 }
 const origin=bounds.getCenter(new T.Vector3()),coords=new Float32Array(count*3);
 const ky=Math.tan(T.MathUtils.degToRad(fov/2))*fill,kx=ky*aspect;
 let xmax=-Infinity,xmin=Infinity,ymax=-Infinity,ymin=Infinity,zmax=-Infinity,offset=0;
 const v=new T.Vector3();
 for(const part of meshes){
  const pos=part.geometry.attributes.position,morphed=part.morphTargetInfluences?.some(weight=>weight!==0);
  for(let i=0;i<pos.count;i++){
   if(morphed)part.getVertexPosition(i,v);else v.fromBufferAttribute(pos,i);
   v.applyMatrix4(part.matrixWorld).sub(origin);
   const u=v.dot(x),h=v.dot(y),d=v.dot(z);
   coords[offset++]=u;coords[offset++]=h;coords[offset++]=d;
   xmax=Math.max(xmax,u+kx*d);xmin=Math.min(xmin,u-kx*d);
   ymax=Math.max(ymax,h+ky*d);ymin=Math.min(ymin,h-ky*d);zmax=Math.max(zmax,d);
  }
 }
 const distance=Math.max((xmax-xmin)/(2*kx),(ymax-ymin)/(2*ky),zmax+.002);
 let cx=(xmax+xmin)/2,cy=(ymax+ymin)/2;
 for(let iter=0;iter<5;iter++){
  let l=Infinity,r=-Infinity,b=Infinity,t=-Infinity,wl=0,wr=0,wb=0,wt=0;
  for(let j=0;j<coords.length;j+=3){
   const w=1/(distance-coords[j+2]),u=(coords[j]-cx)*w,h=(coords[j+1]-cy)*w;
   if(u<l){l=u;wl=w;}if(u>r){r=u;wr=w;}
   if(h<b){b=h;wb=w;}if(h>t){t=h;wt=w;}
  }
  cx+=(r+l)/(wl+wr);cy+=(t+b)/(wb+wt);
  if(Math.abs(r+l)<1e-6&&Math.abs(t+b)<1e-6)break;
 }
 const target=origin.addScaledVector(x,cx).addScaledVector(y,cy);
 return {target,position:target.clone().addScaledVector(z,distance)};
}
