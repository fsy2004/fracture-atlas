import * as T from './vendor/three.module.js';
import {sliceMetrics} from './geometry.js';

// Digit axes join the proximal and distal articular regions on this particular donor.
// Fractions follow the anatomical long axis even when the interphalangeal joint is flexed.
export function digitalCut(g,s,angle){
 const d=g.userData.digit;if(!d)return null;
 const distal=new T.Vector3(...d.axis),side=new T.Vector3(...d.transverse);
 const f=s.axis===1?1-s.level:s.level,[lo,hi]=d.projection_extent_m;
 const probe=new T.Vector3(...d.proximal_m);
 probe.addScaledVector(distal,T.MathUtils.lerp(lo,hi,f)-probe.dot(distal));
 const a=sliceMetrics(g,probe,distal,side)?.centre||probe;
 const sign=s.normal[s.axis]*(s.axis===1?-1:1)<0?-1:1,theta=T.MathUtils.degToRad(angle);
 const normal=distal.clone().multiplyScalar(sign*Math.cos(theta)).addScaledVector(side,Math.sin(theta)).normalize();
 return intrinsicDigitMotion({...s,normal:normal.toArray(),second:s.second?side.toArray():undefined,digitAnchor:a,digitAxis:distal},distal,side);
}

// Convert signed teaching motions from a neutral right digit into its current native posture.
// Digital shaft and transverse axes are already in the right-template frame at this point.
export function intrinsicDigitMotion(spec,axis,transverse){
 const distal=axis.clone().normalize(),side=transverse.clone().addScaledVector(distal,-transverse.dot(distal)).normalize();
 const face=new T.Vector3().crossVectors(distal,side).normalize();
 const hand=spec.axis===1;
 const basis=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(side,hand?distal.clone().negate():face,hand?face:distal));
 const inv=basis.clone().invert(),rad=Math.PI/180;
 function convert(m){
  const move=new T.Vector3(...m.shift).applyQuaternion(basis);
  const rot=new T.Quaternion().setFromEuler(new T.Euler(...m.turn.map(x=>x*rad)));
  const e=new T.Euler().setFromQuaternion(basis.clone().multiply(rot).multiply(inv));
  return {...m,shift:move.toArray(),turn:[e.x/rad,e.y/rad,e.z/rad]};
 }
 const branches=spec.second?(spec.branches||[{shift:[-1,0,0],turn:[0,0,0]},{shift:[1,0,0],turn:[0,0,0]}]).map(convert):undefined;
 return {...spec,minus:convert(spec.minus),plus:convert(spec.plus),branches};
}
