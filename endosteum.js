import * as T from './vendor/three.module.js';
const tau=2*Math.PI;
const samplers=new WeakMap();
export function canalSampler(rows,transform,mirrored=false){
 let byTransform=samplers.get(rows);if(!byTransform){byTransform=new WeakMap();samplers.set(rows,byTransform);}
 let pair=byTransform.get(transform);if(!pair){pair=[];byTransform.set(transform,pair);}
 return pair[Number(mirrored)]??=makeSampler(rows,transform,mirrored);
}
function makeSampler(rows,transform,mirrored){
 const r=new T.Matrix3().set(...transform.rotation.flat()),inv=r.clone().transpose(),t=new T.Vector3(...transform.translation_mm);
 const raw=p=>new T.Vector3(mirrored?-p.x:p.x,p.y,p.z).multiplyScalar(1000).sub(t).applyMatrix3(inv);
 function sample(z){
  let lo=0,hi=rows.length-1;if(z<rows[lo][0]||z>rows[hi][0])return null;
  while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][0]>z)hi=m;else lo=m;}
  const a=rows[lo],b=rows[hi];if(b[0]-a[0]>9)return null;return [a,b,(z-a[0])/(b[0]-a[0])];
 }
 const mix=(a,b,f)=>a+(b-a)*f;
 return {
  centre(p){const v=raw(p),s=sample(v.z);if(!s)return null;const [a,b,f]=s;
   v.x=mix(a[1],b[1],f);v.y=mix(a[2],b[2],f);v.applyMatrix3(r).add(t).multiplyScalar(.001);
   if(mirrored)v.x*=-1;return v;
  },
  distance(p){const v=raw(p),s=sample(v.z);if(!s)return NaN;const [a,b,f]=s;
   const x=v.x-mix(a[1],b[1],f),y=v.y-mix(a[2],b[2],f),angle=((Math.atan2(y,x)+tau)%tau)*96/tau;
   const k=Math.floor(angle)%96,j=(k+1)%96,u=angle-Math.floor(angle);
   return Math.hypot(x,y)-mix(mix(a[5+k],a[5+j],u),mix(b[5+k],b[5+j],u),f);
  }
 };
}
export function endostealLoop(flat,mid,toWorld,toFlat,sampler){
 const c=sampler.centre(toWorld(mid));if(!c)return null;const origin=toFlat(c);
 if(!(sampler.distance(toWorld(origin))<0))return null;
 const out=[];
 for(const rim of flat){
  if(!(sampler.distance(toWorld(rim))>.15))return null;
  let lo=0,hi=1;
  for(let j=0;j<14;j++){const t=(lo+hi)/2,s=sampler.distance(toWorld(origin.clone().lerp(rim,t)));if(!Number.isFinite(s))return null;if(s>0)hi=t;else lo=t;}
  out.push(origin.clone().lerp(rim,(hi+lo)/2));
 }
 return {centre:origin,inner:out};
}
