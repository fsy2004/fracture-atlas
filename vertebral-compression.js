import * as T from './vendor/three.module.js';
import {surfaceTree} from './surface-lessons.js';

const yAxis=new T.Vector3(0,1,0);
const noRays=NaN;

function endplateField(geometry){
 const box=geometry.boundingBox,size=box.getSize(new T.Vector3());
 const tree=surfaceTree(geometry),ray=new T.Ray(new T.Vector3(),yAxis);
 const nx=36,nz=41,floor=new Float64Array(nx*nz);floor.fill(noRays);
 for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){
  ray.origin.set(box.min.x+size.x*ix/(nx-1),box.min.y-.004,box.min.z+size.z*iz/(nz-1));
  const hit=tree.raycastFirst(ray,T.DoubleSide);
  if(hit)floor[iz*nx+ix]=hit.point.y;
 }
 const contactAt=iz=>{
  const mid=Math.floor(nx/2);
  return Number.isFinite(floor[iz*nx+mid])||Number.isFinite(floor[iz*nx+mid-1]);
 };
 // The anterior component of the midline projection lies in front of the
 // canal. Ignore a missing sample at the extreme anterior rim.
 let iz=nz-2;
 while(iz>Math.floor(nz*.68)&&!contactAt(iz))iz--;
 while(iz>Math.floor(nz*.38)&&(contactAt(iz-1)||contactAt(iz-2)))iz--;
 const wall=T.MathUtils.clamp(iz/(nz-1),.40,.77);
 function inferiorAt(x,z){
  const gx=T.MathUtils.clamp((x-box.min.x)/size.x*(nx-1),0,nx-1),
   gz=T.MathUtils.clamp((z-box.min.z)/size.z*(nz-1),0,nz-1);
  const ix=Math.min(nx-2,Math.floor(gx)),iz=Math.min(nz-2,Math.floor(gz));
  let value=0,total=0;
  for(let a=0;a<=1;a++)for(let b=0;b<=1;b++){
   const y=floor[(iz+b)*nx+ix+a],weight=(a?gx-ix:1-gx+ix)*(b?gz-iz:1-gz+iz);
   if(!Number.isFinite(y))continue;
   total+=weight;value+=y*weight;
  }
  // At a grazing silhouette the rays may miss. Fade the deformation on
  // incompletely sampled cells instead of inventing a displaced lower wall.
  return total>.001?[value/total,T.MathUtils.smoothstep(total,.20,.80)]:[box.min.y,0];
 }
 return {size,box,wall,inferiorAt};
}

export function vertebralCompression(geometry,kind){
 const {size,box,wall,inferiorAt}=endplateField(geometry);
 const vertex=geometry.attributes.position,normals=geometry.attributes.normal;
 const point=new T.Vector3(),n=new T.Vector3(),changed=new T.Vector3();
 const protectedRim=Math.min(.0016,size.y*.055);
 const span=1-wall;
 const step=Math.min(.0003,size.y*.018);
 const draw=(x,y,z,broad)=>{
  const forward=(z-box.min.z)/size.z,body=T.MathUtils.smoothstep(forward,wall+span*.05,wall+span*.39);
  if(body<=0)return 0;
  const [floor,support]=inferiorAt(x,z),height=Math.max(0,y-floor-protectedRim);
  const lateral=1-T.MathUtils.clamp((x-box.min.x)/size.x,0,1);
  const weight=kind==='lateral'?Math.pow(lateral,broad?.6:1):
   T.MathUtils.smoothstep(forward,wall+span*(broad?.13:.24),broad?.94:1);
  // At fixed X and Z, Y maps to a strictly increasing function. Its slope
  // is at least 1−0.32 (1−0.32×1.3 at the adjustment stop), so a compressed
  // upper endplate cannot fold below the lower one in the same column.
  return -height*(broad?.32:.26)*weight*body*support;
 };
 const forms=[false,true].map(broad=>{
  const positions=new Float32Array(vertex.count*3),normalDelta=new Float32Array(vertex.count*3);
  for(let i=0;i<vertex.count;i++){
   const {x,y,z}=point.fromBufferAttribute(vertex,i);
   const displacement=draw(x,y,z,broad);
   if(!displacement)continue;
   positions[3*i+1]=displacement;
   n.fromBufferAttribute(normals,i);
   const dx=(draw(x+step,y,z,broad)-draw(x-step,y,z,broad))/(2*step);
   const dy=1+(draw(x,y+step,z,broad)-draw(x,y-step,z,broad))/(2*step);
   const dz=(draw(x,y,z+step,broad)-draw(x,y,z-step,broad))/(2*step);
   const ny=n.y/dy;
   changed.set(n.x-dx*ny,ny,n.z-dz*ny).normalize().sub(n);
   changed.toArray(normalDelta,3*i);
  }
  return {position:new T.BufferAttribute(positions,3),normal:new T.BufferAttribute(normalDelta,3)};
 });
 return {position:forms.map(d=>d.position),normal:forms.map(d=>d.normal)};
}
