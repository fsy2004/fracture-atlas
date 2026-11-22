import * as T from './vendor/three.module.js';

// Source sagittal section passes through the central opposed scaphoid/lunate surface.
// Left landmarks have been reflected into the shared right-sided teaching frame.
const points={"Right":{"dorsal_m":[-0.26556601999999996,0.8162518700000001,0.00850024],"volar_m":[-0.26556601999999996,0.82261597,0.02131178],"shaft":[0.15200171593128955,0.9490930399079522,-0.2758946899674328]},"Left":{"dorsal_m":[-0.26441673,0.81522627,0.0082106],"volar_m":[-0.26441673,0.8213652499999999,0.02051858],"shaft":[0.12528454389124408,0.9584039604585641,-0.25644810710805]}};
export function measuredWrist(g){
 const group=g.userData.group||'';
 if(!group.startsWith('openskeleton-N187928-'))return null;
 const e=points[group.includes('left-arm')?'Left':'Right'];
 const dorsal=new T.Vector3(...e.dorsal_m),volar=new T.Vector3(...e.volar_m),axis=new T.Vector3(...e.shaft);
 const ray=volar.clone().sub(dorsal);
 const palmar=T.MathUtils.radToDeg(Math.atan2(ray.y,ray.z)-Math.atan2(-axis.z,axis.y));
 return {dorsal,volar,axis,palmar};
}
export function bartonSurface(s,g,variant){
 const rim=measuredWrist(g);if(!rim||variant<2)return s;
 const origin=rim.dorsal.lerp(rim.volar,variant===2?.32:.68);
 const fraction=origin.sub(g.boundingBox.min).divide(g.boundingBox.getSize(new T.Vector3()));
 return {...s,anchor:undefined,nativePoint:fraction.toArray(),normal:[0,1,variant===2?1.55:-1.55]};
}
