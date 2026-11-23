import * as T from './vendor/three.module.js';

const deg=T.MathUtils.radToDeg;
const round=n=>Math.round(n*10)/10;
const mm=n=>round(n*1000);
function moved(item,point){
 return point.clone().sub(item.anchor).applyQuaternion(item.pivot.quaternion).add(item.pivot.position);
}
function twist(q,axis){
 return deg(2*Math.atan2(new T.Vector3(q.x,q.y,q.z).dot(axis),q.w));
}
function angleDifference(current,rest,plane){
 const measure=d=>plane==='frontal'?Math.atan2(-d.x,-d.y):Math.atan2(d.z,-d.y);
 const diff=measure(current)-measure(rest);
 return deg(Math.atan2(Math.sin(diff),Math.cos(diff)));
}
function angularWords(item,axis){
 const direction=axis.clone().applyQuaternion(item.pivot.quaternion);
 const flex=angleDifference(direction,axis,'sagittal');
 const abd=angleDifference(direction,axis,'frontal');
 const spin=twist(item.pivot.quaternion,axis.clone().negate());
 return [[flex,'屈曲','后伸'],[abd,'外展','内收'],[spin,'内旋','外旋']]
  .filter(([n])=>Math.abs(n)>=1)
  .map(([n,positive,negative])=>(n>0?positive:negative)+' '+round(Math.abs(n))+'°');
}
function forearmWords(near,far,axis){
 const proximal=axis.clone().negate();
 return [[near,'近段'],[far,'远段']].map(([item,segment])=>[twist(item.pivot.quaternion,proximal),segment])
  .filter(([rotation])=>Math.abs(rotation)>=1)
  .map(([rotation,segment])=>segment+(rotation>0?'旋前 ':'旋后 ')+round(Math.abs(rotation))+'°');
}
function fractureWords(near,far,axis){
 const delta=moved(far,far.cutReference).sub(moved(near,far.cutReference));
 const length=delta.dot(axis),side=delta.addScaledVector(axis,-length).length();
 const q=near.pivot.quaternion.clone().invert().multiply(far.pivot.quaternion).normalize();
 const angle=deg(axis.angleTo(axis.clone().applyQuaternion(q)));
 const roll=Math.abs(twist(q,axis));
 const words=[];
 if(mm(side)>=.2)words.push('侧方移位 '+mm(side)+' mm');
 if(Math.abs(mm(length))>=.2)words.push((length>0?'分离移位 ':'缩短移位 ')+mm(Math.abs(length))+' mm');
 if(angle>=1)words.push('成角移位 '+round(angle)+'°');
 if(roll>=1)words.push('旋转移位 '+round(Math.min(roll,360-roll))+'°');
 return words;
}
function line(group,colour,dashed){
 const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);
 const material=dashed?new T.LineDashedMaterial({color:colour,dashSize:.006,gapSize:.003}):new T.LineBasicMaterial({color:colour});
 const item=new T.Line(geo,material);
 item.frustumCulled=false;item.userData.dispose=true;item.userData.ownMaterial=true;
 group.add(item);return item;
}
function endpoints(line,a,b){
 const pos=line.geometry.attributes.position;
 pos.setXYZ(0,a.x,a.y,a.z);pos.setXYZ(1,b.x,b.y,b.z);pos.needsUpdate=true;
 if(line.material.isLineDashedMaterial)line.computeLineDistances();
}

// Compare axes in the anatomical frame used by the actual specimen and its posed
// fragments. Mirroring the whole assembly preserves the anatomical sign.
export function motionGuide(group,items,primary,mode,span){
 const parts=items.filter(item=>item.name===primary&&item.cutReference);
 const near=parts.find(item=>item.segment==='近端'),far=parts.find(item=>item.segment==='远端');
 const ball=items.find(item=>item.jointAxis&&item.posture);
 const axis=ball?.jointAxis.clone().negate()||
  (near&&far?far.segmentCentre.clone().sub(near.segmentCentre).normalize():null);
 if(!axis||axis.lengthSq()<.5)return null;
 // The proximal femoral segment has an anatomical reference at the fitted
 // head centre. Use that axis only in these specifically modelled examples.
 const pivot=ball||(mode==='proximal-femur'&&near?.headCentre?near:far);
 const movementAxis=pivot===near?near.cutReference.clone().sub(near.headCentre).normalize():axis;
 if(ball&&movementAxis.y>0)movementAxis.negate();
 const longitudinal=Math.min(.090,Math.max(.013,span*.48)),radial=longitudinal*.23;
 const origin=(ball?ball.anchor:pivot.cutReference).clone();
 const projection=movementAxis.clone().multiplyScalar(longitudinal);
 const cross=new T.Vector3(0,0,1).addScaledVector(movementAxis,-movementAxis.z).normalize().multiplyScalar(radial);
 if(cross.lengthSq()<1e-8)cross.set(radial,0,0);
 const axisEnd=origin.clone().add(projection),crossEnd=axisEnd.clone().add(cross);
 const a=line(group,0x6f887e,true),b=line(group,0x17695b,false);
 const c=line(group,0xa08569,true),d=line(group,0x955631,false);
 const other=ball?null:pivot===near?far:near;
 const opposing=other?line(group,0x48685a,false):null;
 const opposingEnd=origin.clone().addScaledVector(axis,other===near?-longitudinal:longitudinal);
 endpoints(a,origin,axisEnd);endpoints(c,axisEnd,crossEnd);
 return {
  update(visible){
   for(const item of [a,b,c,d,opposing])if(item)item.visible=visible;
   if(visible){
    endpoints(b,moved(pivot,origin),moved(pivot,axisEnd));
    endpoints(d,moved(pivot,axisEnd),moved(pivot,crossEnd));
    if(opposing)endpoints(opposing,moved(other,origin),moved(other,opposingEnd));
   }
   if(ball)return angularWords(ball,movementAxis);
   const fracture=fractureWords(near,far,axis);
   if(pivot===near)return [...angularWords(near,movementAxis).map(word=>'近段'+word),...fracture];
   return mode==='forearm'?[...forearmWords(near,far,axis),...fracture]:fracture;
  }
 };
}
