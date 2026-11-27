import * as T from './vendor/three.module.js';
import {atLevel,branchSection,section,sliceMetrics} from './geometry.js';
import {nativeAnchor,surfaceTree} from './surface-lessons.js';

const v=a=>new T.Vector3(...a);
const direction=(i,sign)=>new T.Vector3().setComponent(i,sign);
const dispose=p=>[p.geo,p.face,p.outline].forEach(g=>g.dispose());

function concatenate(geometries,reverse=false){
 const result=new T.BufferGeometry();
 for(const key of ['position','normal']){
  if(!geometries.every(g=>g.hasAttribute(key)))continue;
  const count=geometries.reduce((sum,g)=>sum+g.attributes[key].count,0);
  const values=new Float32Array(count*3);
  let offset=0;
  for(const g of geometries){
   const a=g.attributes[key].array;
   if(reverse){
    for(let i=0;i<a.length;i+=9)for(let j=0;j<9;j++){
     values[offset+i+j]=(key==='normal'?-1:1)*a[i+(j<3?j:j<6?j+3:j-3)];
    }
   }else values.set(a,offset);
   offset+=a.length;
  }
  result.setAttribute(key,new T.BufferAttribute(values,3));
 }
 result.computeBoundingBox();
 return result;
}

// Intersect inward-facing halfspaces while retaining the untouched exterior of
// every rejected piece. Only the final fragment faces line the resulting defect.
export function extractFragment(g,planes){
 const first=planes[0];
 let [outside,inside]=section(g,first.normal.toArray(),first.point.toArray());
 const rejected=[outside];
 for(const {normal,point} of planes.slice(1)){
  const next=branchSection(inside,normal.toArray(),point.toArray());
  dispose(inside);
  rejected.push(next[0]);
  inside=next[1];
 }
 inside.geo.computeBoundingBox();
 const retained={
  geo:concatenate(rejected.map(p=>p.geo)),face:concatenate([inside.face],true),
  outline:inside.outline.clone()
 };
 for(const p of rejected)dispose(p);
 return [retained,inside];
}

function fittedHead(femur){
 if(femur.userData.headCentre)return femur.userData.headCentre.clone();
 return nativeAnchor(femur,[.84,.945,.52]);
}

export function acetabularPlan(femur,hip){
 const head=fittedHead(femur),x=direction(0,1);
 const medialHit=surfaceTree(hip).raycastFirst(new T.Ray(head,x),T.DoubleSide);
 if(!medialHit)throw Error('无法定位髋臼底');
 const headHit=surfaceTree(femur).raycastFirst(new T.Ray(head,x),T.DoubleSide);
 const radius=headHit?.distance??.023;
 // Clearances at the peripheral articular crown are smaller than at its centre.
 // Couple after the initial seating pulse so the reduced native gap does not close.
 const clearance=Math.min(.00005,Math.max(0,medialHit.distance-radius));
 const travel=.034, socket=medialHit.point;
 const planes=[
  {normal:x,point:head.clone().addScaledVector(x,.005)}
 ];
 // The polygon encloses the projected head and frees only the local acetabular
 // wall. It is intentionally not a full transverse cut of the hemipelvis.
 const opening=Math.max(.027,radius+.0055);
 for(let i=0;i<10;i++){
  const angle=i*Math.PI/5,radial=v([0,Math.cos(angle),Math.sin(angle)]);
  planes.push({normal:radial.clone().negate(),point:socket.clone().addScaledVector(radial,opening)});
 }
 return {head,socket,radius,opening,planes,clearance,travel};
}

export function displaceAcetabularWall(travel,clearance){
 return Math.max(0,travel-clearance);
}

export function bendTarget(geometry,anchor,spec){
 const a=spec.axis,sign=spec.bend.end==='positive'?1:-1;
 const along=direction(a,sign),toward=v(spec.bend.direction);
 toward.addScaledVector(along,-toward.dot(along)).normalize();
 const hinge=new T.Vector3().crossVectors(along,toward).normalize(),delta=new T.Vector3(),rot=new T.Quaternion();
 const size=geometry.boundingBox.getSize(new T.Vector3()).getComponent(a);
 const normal=v(spec.normal).normalize(),localNeck=Boolean(spec.neckLevel);
 const deform=(point,weight=1)=>{
  delta.copy(point).sub(anchor);
  const signed=localNeck?-normal.dot(delta):delta.dot(along);
  const phase=T.MathUtils.smoothstep(signed,0,Math.max(.004,size*.065));
  rot.setFromAxisAngle(hinge,T.MathUtils.degToRad(spec.bend.angle)*phase*weight);
  return point.clone().sub(anchor).applyQuaternion(rot).add(anchor);
 };
 return {deform,toward};
}

export function greenstickGeometry(g,anchor,spec){
 const geometry=g.clone(),p=g.attributes.position,target=bendTarget(g,anchor,spec);
 const displacements=new Float32Array(p.count*3),point=new T.Vector3();
 for(let i=0;i<p.count;i++){
  point.fromBufferAttribute(p,i);
  target.deform(point).sub(point).toArray(displacements,i*3);
 }
 geometry.morphTargetsRelative=true;
 const attribute=new T.BufferAttribute(displacements,3);
 geometry.morphAttributes.position=[attribute,attribute.clone()];
 const pair=section(g,spec.normal,anchor.toArray());
 const outline=selectedRim(pair[0].outline,anchor,target.toward,-1);
 pair.forEach(dispose);
 return {geometry,outline};
}

export function selectedRim(source,anchor,direction,sign){
 const p=source.attributes.position,points=[],a=new T.Vector3(),b=new T.Vector3();
 for(let i=0;i<p.count;i+=2){
  a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);
  if((a.dot(direction)+b.dot(direction)-2*anchor.dot(direction))*sign>0)points.push(a.clone(),b.clone());
 }
 return new T.BufferGeometry().setFromPoints(points);
}

export function physisFragments(g,anchor,type,side){
 const up=v([0,1,0]), medial=v([1,0,0]);
 if(type===2){
  // A flat half through the physis merges into an oblique metaphyseal limb.
  const parts=section(g,[.70*side,1,0],anchor.toArray(),.70);
  return side>0?parts:parts.reverse();
 }
 if(type===3)return extractFragment(g,[
  {normal:up.multiplyScalar(side),point:anchor},
  {normal:medial,point:anchor}
 ]);
 if(type===4)return section(g,[1,.35,0],anchor.toArray());
 const parts=section(g,[0,1,0],anchor.toArray());
 return side>0?parts:parts.reverse();
}

export function virtualPhysis(g,anchor,type){
 const plane=section(g,[0,1,0],anchor.toArray());
 const face=plane[0].face;
 const geometry=face.clone(),p=geometry.attributes.position;
 if(type===6){
  const cutoff=anchor.x+.003,positions=[];
  for(let i=0;i<p.count;i+=3){
   const points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j));
   const clipped=[];
   points.forEach((a,j)=>{
    const b=points[(j+1)%3],inside=a.x<=cutoff;
    if(inside)clipped.push(a);
    if(inside!==(b.x<=cutoff))clipped.push(a.clone().lerp(b,(cutoff-a.x)/(b.x-a.x)));
   });
   for(let j=1;j+1<clipped.length;j++)positions.push(...clipped[0].toArray(),...clipped[j].toArray(),...clipped[j+1].toArray());
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.deleteAttribute('normal');geometry.computeVertexNormals();
 }
 const outline=plane[0].outline.clone();
 plane.forEach(dispose);
 const shell=[];
 const centre=anchor.clone(),position=outline.attributes.position;
 const trim=type===6?anchor.x+.003:Infinity;
 const spread=point=>{
  const radial=point.clone().sub(centre);radial.y=0;
  return point.addScaledVector(radial.normalize(),.0013).sub(centre);
 };
 for(let i=0;i<position.count;i+=2){
  let a=new T.Vector3().fromBufferAttribute(position,i),b=new T.Vector3().fromBufferAttribute(position,i+1);
  if(a.x>trim&&b.x>trim)continue;
  if(a.x>trim)a=a.lerp(b,(trim-a.x)/(b.x-a.x));
  if(b.x>trim)b=b.lerp(a,(trim-b.x)/(a.x-b.x));
  a=spread(a);b=spread(b);
  const top=a.clone().setY(1),bottom=a.clone().setY(-1);
  const right=b.clone().setY(1),left=b.clone().setY(-1);
  shell.push(...top.toArray(),...left.toArray(),...bottom.toArray(),...top.toArray(),...right.toArray(),...left.toArray());
 }
 const band=new T.BufferGeometry();band.setAttribute('position',new T.Float32BufferAttribute(shell,3));band.computeVertexNormals();
 outline.dispose();
 return {geometry,band};
}

export function fractureAnchor(g,spec){
 const {axis=1,level}=spec;
 return spec.nativePoint?nativeAnchor(g,spec.nativePoint):v(atLevel(g,axis,level));
}

export function sectionWidth(g,anchor,axis){
 const normal=direction(axis,1);
 return sliceMetrics(g,anchor,normal,direction((axis+1)%3,1))?.width||.020;
}
