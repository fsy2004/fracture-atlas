import * as T from './vendor/three.module.js';
import {surfaceTree} from './surface-lessons.js';

function sample(geometry,matrix){
 const attr=geometry.attributes.position,points=[];
 const step=Math.max(1,Math.ceil(attr.count/1250));
 for(let i=0;i<attr.count;i+=step)points.push(new T.Vector3().fromBufferAttribute(attr,i).applyMatrix4(matrix));
 return points;
}
function average(points){
 return points.reduce((mean,p)=>mean.add(p),new T.Vector3()).multiplyScalar(1/points.length);
}
function principal(points,centre){
 const box=new T.Box3().setFromPoints(points),size=box.getSize(new T.Vector3()).toArray();
 const index=size.indexOf(Math.max(...size));
 const sign=new T.Vector3().setComponent(index,1),axis=sign.clone(),next=new T.Vector3();
 const diffs=points.map(p=>p.clone().sub(centre));
 for(let i=0;i<15;i++){
  next.set(0,0,0);
  for(const d of diffs)next.addScaledVector(d,d.dot(axis));
  if(next.lengthSq()<1e-15)break;
  axis.copy(next.normalize());
 }
 if(axis.dot(sign)<0)axis.negate();
 return {axis,extent:size[index],elongation:size[index]/Math.max(.0001,...size.filter((_,i)=>i!==index))};
}
function bestRotation(covariance,guess){
 const [xx,xy,xz,yx,yy,yz,zx,zy,zz]=covariance;
 const n=[
  [xx+yy+zz,yz-zy,zx-xz,xy-yx],
  [yz-zy,xx-yy-zz,xy+yx,zx+xz],
  [zx-xz,xy+yx,-xx+yy-zz,yz+zy],
  [xy-yx,zx+xz,yz+zy,-xx-yy+zz]
 ];
 // A positive shift makes the largest eigenvalue dominant in magnitude.
 const pad=Math.max(...n.map(row=>row.reduce((s,v)=>s+Math.abs(v),0)));
 let q=[guess.w,guess.x,guess.y,guess.z];
 for(let i=0;i<35;i++){
  const next=n.map((row,r)=>row.reduce((sum,value,k)=>sum+value*q[k],pad*q[r]));
  const norm=Math.hypot(...next);
  if(norm<1e-18)return guess;
  q=next.map(value=>value/norm);
 }
 return new T.Quaternion(q[1],q[2],q[3],q[0]).normalize();
}
function fit(rows,guess){
 const source=average(rows.map(r=>r.source)),target=average(rows.map(r=>r.target));
 const a=new T.Vector3(),b=new T.Vector3(),covariance=new Float64Array(9);
 let norm=0;
 for(const r of rows){
  a.copy(r.source).sub(source);b.copy(r.target).sub(target);
  norm+=a.lengthSq();
  const x=a.toArray(),y=b.toArray();
  for(let j=0;j<3;j++)for(let k=0;k<3;k++)covariance[j*3+k]+=x[j]*y[k];
 }
 if(norm<1e-12)return null;
 const orientation=bestRotation(covariance,guess);
 let product=0;
 for(const r of rows)product+=a.copy(r.source).sub(source).applyQuaternion(orientation).dot(b.copy(r.target).sub(target));
 const scale=T.MathUtils.clamp(product/norm,.78,1.27);
 const offset=target.clone().sub(source.clone().applyQuaternion(orientation).multiplyScalar(scale));
 return {orientation,matrix:new T.Matrix4().compose(offset,orientation,new T.Vector3().setScalar(scale)),scale};
}

// Fit a local teaching atlas to the actual intact model present in this
// scene. Distances are checked on both uncensored surfaces before use.
export function fitTissueSkeleton(source,targetGeometry,targetWorld,focus){
 if(!source?.geometry||!targetGeometry?.attributes?.position)return null;
 const from=sample(source.geometry,source.matrixWorld),to=sample(targetGeometry,targetWorld);
 if(from.length<30||to.length<30)return null;
 const centre=average(from),goal=average(to);
 const a=principal(from,centre),b=principal(to,goal);
 if(Math.min(a.extent,b.extent)<.007)return null;
 const inversed=new T.Matrix4().copy(targetWorld).invert();
 const tree=surfaceTree(targetGeometry),look=new T.Vector3(),row={point:new T.Vector3()};
 const collect=(matrix,points=from)=>points.map(point=>{
  look.copy(point).applyMatrix4(matrix).applyMatrix4(inversed);
  const result=tree.closestPointToPoint(look,row);
  return {source:point,target:result.point.clone().applyMatrix4(targetWorld),distance:result.distance};
 }).sort((first,second)=>first.distance-second.distance);
 const sourceTree=surfaceTree(source.geometry);
 const inverseSource=new T.Matrix4().copy(source.matrixWorld).invert();
 const back=new T.Vector3(),reverse={point:new T.Vector3()},at=new T.Vector3();
 const compareBack=(matrix,points=to)=>{
  const undo=new T.Matrix4().copy(matrix).invert();
  return points.map(point=>{
   back.copy(point).applyMatrix4(undo).applyMatrix4(inverseSource);
   const hit=sourceTree.closestPointToPoint(back,reverse);
   return at.copy(hit.point).applyMatrix4(source.matrixWorld).applyMatrix4(matrix).distanceTo(point);
  });
 };
 const radius=b.extent;
 const elongated=Math.min(a.elongation,b.elongation)>1.21;
 const goalAxis=b.axis.clone().multiplyScalar(a.axis.dot(b.axis)<0?-1:1);
 const aligned=new T.Quaternion().setFromUnitVectors(a.axis,goalAxis);
 const choices=elongated?[new T.Quaternion(),aligned]:[new T.Quaternion()];
 let best=null;
 function quality(matrix,points=from,reversePoints=to){
  const distances=[...collect(matrix,points).map(row=>row.distance),...compareBack(matrix,reversePoints)].sort((a,b)=>a-b);
  return {median:distances[Math.floor(distances.length*.5)],p90:distances[Math.floor(distances.length*.9)]};
 }
 const acceptable=({median,p90})=>median<=Math.min(.0065,Math.max(.0014,radius*.041))&&
  p90<=Math.min(.014,Math.max(.003,radius*.087));
 function examine(choices,iterations){
  for(const q of choices){
   const k=T.MathUtils.clamp(b.extent/a.extent,.78,1.27);
   const offset=goal.clone().sub(centre.clone().applyQuaternion(q).multiplyScalar(k));
   let estimate={orientation:q,matrix:new T.Matrix4().compose(offset,q,new T.Vector3().setScalar(k)),scale:k};
   for(let i=0;i<iterations;i++){
    const rows=collect(estimate.matrix);
    const fitted=fit(rows.slice(0,Math.floor(rows.length*.78)),estimate.orientation);
    if(!fitted)break;
    estimate=fitted;
   }
   const {median,p90}=quality(estimate.matrix);
   if(!best||p90+median<best.p90+best.median)best={...estimate,median,p90,extent:radius};
  }
 }
 examine(choices,10);
 if(best&&!acceptable(best)){
  // Fingers and feet may have a different resting twist across the specimens.
  const axis=elongated?goalAxis:new T.Vector3(0,1,0);
  const alternatives=[-Math.PI/3,Math.PI/3].map(angle=>new T.Quaternion().setFromAxisAngle(axis,angle).multiply(aligned));
  examine([best.orientation,...alternatives],22);
 }
 if(!best)return null;
 if(acceptable(best))return {...best,accepted:true};
 if(!focus)return {...best,accepted:false};

 // Compare the original, fixed population on each side of the injury window.
 // A different-shaped epiphysis at the far end must not misalign the injury site.
 const window=T.MathUtils.clamp(radius*.38,.012,.055);
 const focusedPoint=new T.Vector3();
 const nearFrom=from.filter(point=>focusedPoint.copy(point).applyMatrix4(best.matrix).distanceTo(focus)<window);
 const nearTo=to.filter(point=>point.distanceTo(focus)<window);
 if(Math.min(nearFrom.length,nearTo.length)<32)return {...best,accepted:false};
 let local=best;
 for(let i=0;i<14;i++){
  const rows=collect(local.matrix,nearFrom);
  const candidate=fit(rows.slice(0,Math.floor(rows.length*.8)),local.orientation);
  if(!candidate)break;
  if(candidate.orientation.angleTo(best.orientation)>Math.PI/6||Math.abs(candidate.scale-best.scale)>.09)break;
  local=candidate;
 }
 const localQuality=quality(local.matrix,nearFrom,nearTo);
 const sourceFocus=focus.clone().applyMatrix4(best.matrix.clone().invert());
 const stable=focusedPoint.copy(sourceFocus).applyMatrix4(local.matrix).distanceTo(focus)<Math.min(.008,window*.26);
 const accepted=stable&&acceptable(localQuality);
 return accepted?{...local,...localQuality,extent:radius,accepted,local:true}:{...best,accepted:false};
}
