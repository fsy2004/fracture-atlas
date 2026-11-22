import * as T from './vendor/three.module.js';

// All positions are in atlas metres. An unrestored bending wedge can remain attached
// to the proximal main fragment. A small outward displacement exposes its two faces.
export function createWedgePose(items){
 const pieces=items.filter(i=>i.shell);
 if(pieces.length!==3)return null;
 const [distal,wedge,proximal]=pieces;
 function rotationOf(part){
  const q=new T.Quaternion().setFromEuler(new T.Euler(part.turn.x,part.turn.y,part.turn.z));
  if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);
  const axis=new T.Vector3(q.x,q.y,q.z),angle=2*Math.acos(T.MathUtils.clamp(q.w,-1,1));
  return {angle,axis:axis.lengthSq()>1e-14?axis.normalize():new T.Vector3(0,1,0)};
 }
 const d=rotationOf(distal),r=rotationOf(proximal);
 const wedgeRest=wedge.anchor.clone().sub(proximal.anchor),wedgeOffset=new T.Vector3();
 const s=T.MathUtils.smoothstep;
 // travelScale and spinScale are the UI target relative to the preset amplitudes.
 return (time,travelScale=1,spinScale=1)=>{
  const horizontal=s(time,.28,.61),late=s(time,.65,1),opening=s(time,.10,.26),chip=s(time,.14,.42);
  proximal.pivot.quaternion.setFromAxisAngle(r.axis,r.angle*spinScale*s(time,.32,.70));
  distal.pivot.quaternion.setFromAxisAngle(d.axis,d.angle*spinScale*s(time,.40,.80));
  proximal.pivot.position.copy(proximal.anchor).addScaledVector(proximal.shift,horizontal*travelScale);
  distal.pivot.position.set(
   distal.anchor.x+distal.shift.x*horizontal*travelScale,
   distal.anchor.y+(distal.shift.y*late-.002*(opening-late))*travelScale,
   distal.anchor.z+distal.shift.z*horizontal*travelScale
  );
  // Carry the wedge about the same joint-centred pivot, rather than rotating it
  // in place about the cut while the main proximal fragment swings about the hip.
  wedge.pivot.quaternion.copy(proximal.pivot.quaternion);
  wedgeOffset.copy(wedgeRest);wedgeOffset.x-=.003*chip*travelScale;
  wedge.pivot.position.copy(wedgeOffset).applyQuaternion(proximal.pivot.quaternion).add(proximal.pivot.position);
 };
}
