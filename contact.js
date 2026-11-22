import * as T from './vendor/three.module.js';
import {MeshBVH,CENTER} from './vendor/mesh-bvh.js';

const EPS=.00005; // 0.05 mm computational tolerance, in model metres.
const normalA=new T.Vector3(),normalB=new T.Vector3(),segment=new T.Line3();
const rayDir=new T.Vector3(.719,.327,.614).normalize();
const cache=new WeakMap();
function straddles(tri,normal,origin){
 const d=normal.dot(origin),a=normal.dot(tri.a)-d,b=normal.dot(tri.b)-d,c=normal.dot(tri.c)-d;
 return Math.min(a,b,c)<-EPS&&Math.max(a,b,c)>EPS;
}
function solid(shell,cap,morph){
 if(!cap&&!morph&&cache.has(shell))return cache.get(shell);
 const g=new T.BufferGeometry(),p=shell.attributes.position;
 if(cap){
  const c=cap.attributes.position,coords=new Float32Array(p.array.length+c.array.length);
  coords.set(p.array);coords.set(c.array,p.array.length);g.setAttribute('position',new T.BufferAttribute(coords,3));
 }else{
  g.setAttribute('position',morph?p.clone():p);if(shell.index)g.setIndex(shell.index.clone());
 }
 const bvh=new MeshBVH(g,{strategy:CENTER,maxLeafTris:8});
 const triangles=g.index.count/3,count=Math.min(48,triangles);
 const probeIndices=Array.from({length:count},(_,k)=>3*Math.min(triangles-1,Math.floor((k+.5)*triangles/count)));
 const samples=probeIndices.map(()=>new T.Vector3());
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),tri=new T.Triangle(a,b,c),normal=new T.Vector3();
 function updateSamples(){
  const idx=g.index.array,pos=g.attributes.position;
  for(const [i,j] of probeIndices.entries()){
   a.fromBufferAttribute(pos,idx[j]);b.fromBufferAttribute(pos,idx[j+1]);c.fromBufferAttribute(pos,idx[j+2]);
   tri.getMidpoint(samples[i]).addScaledVector(tri.getNormal(normal),-EPS*2.5);
  }
 }
 updateSamples();g.computeBoundingBox();
 const data={g,bvh,samples,updateSamples};
 if(!cap&&!morph)cache.set(shell,data);
 return data;
}
export function contactBody(mesh,cap=null,name=''){
 const morph=!!mesh.morphTargetInfluences,capGeo=cap?.geometry||cap,dynamic=!!mesh.userData.restSurface;
 let meshData,restData;
 const capNormals=capGeo?.attributes.normal;
 const capDirection=capNormals?.count?new T.Vector3().fromBufferAttribute(capNormals,0).normalize():null;
 return {mesh,name,capDirection,world:new T.Matrix4(),box:new T.Box3(),lastMorph:'',
  data(){return meshData||=solid(mesh.userData.restSurface||mesh.geometry,cap?.userData?.restSurface||capGeo,morph||dynamic);},
  restData(){return morph||dynamic?(restData||=solid(mesh.userData.restSurface||mesh.geometry,cap?.userData?.restSurface||capGeo,false)):this.data();},
  sync(){
   this.world.copy(mesh.matrixWorld);
   if(morph||dynamic){
    const key=dynamic?String(mesh.geometry.attributes.position.version):mesh.morphTargetInfluences.join('/');
    if(key!==this.lastMorph){
     const d=this.data(),pos=d.g.attributes.position,pt=new T.Vector3();
     const shellCount=mesh.geometry.attributes.position.count;
     for(let i=0;i<pos.count;i++){
      if(i<shellCount)mesh.getVertexPosition(i,pt);
      else if(cap?.isMesh)cap.getVertexPosition(i-shellCount,pt);
      else pt.fromBufferAttribute(capGeo.attributes.position,i-shellCount);
      pos.setXYZ(i,pt.x,pt.y,pt.z);
     }
     d.bvh.refit();d.g.computeBoundingBox();d.updateSamples();this.lastMorph=key;
    }
   }
   const geo=(morph||dynamic?this.data().g:mesh.geometry);
   if(!geo.boundingBox)geo.computeBoundingBox();this.box.copy(geo.boundingBox).applyMatrix4(this.world);
  }
 };
}
function inside(s,point){
 const near=s.bvh.closestPointToPoint(point,{},EPS,EPS);if(near&&near.distance<=EPS)return false;
 const hits=s.bvh.raycast(new T.Ray(point,rayDir),T.DoubleSide,EPS,Infinity).sort((a,b)=>a.distance-b.distance);
 let count=0,last=-Infinity;
 for(const h of hits)if(h.distance-last>1e-7){count++;last=h.distance;}
 return count%2===1;
}
// A cap normal proposes a separating axis. Project every current vertex of both solids
// before accepting it, including the caps themselves and any deformed vertices.
function separatedOnCap(a,b){
 for(const planeBody of [a,b]){
  if(!planeBody.capDirection)continue;
  const n=planeBody.capDirection.clone().transformDirection(planeBody.world);
  const range=body=>{
   const m=body.world.elements,p=body.data().g.attributes.position.array;
   const x=n.x*m[0]+n.y*m[1]+n.z*m[2],y=n.x*m[4]+n.y*m[5]+n.z*m[6],z=n.x*m[8]+n.y*m[9]+n.z*m[10];
   const offset=n.x*m[12]+n.y*m[13]+n.z*m[14];let lo=Infinity,hi=-Infinity;
   for(let j=0;j<p.length;j+=3){const d=x*p[j]+y*p[j+1]+z*p[j+2];lo=Math.min(lo,d);hi=Math.max(hi,d);}
   return [lo+offset,hi+offset];
  };
  const [u,v]=range(a),[w,q]=range(b);if(v<=w+EPS||q<=u+EPS)return true;
 }
 return false;
}
// Returns a world-space witness. Ignore coincident rims and coplanar resting contact.
export function penetration(a,b){
 // A shared plane or line has zero overlap volume, including cut caps after an axial turn.
 for(const axis of ['x','y','z']){
  const overlap=Math.min(a.box.max[axis],b.box.max[axis])-Math.max(a.box.min[axis],b.box.min[axis]);
  if(overlap<=EPS)return null;
 }
 const transform=new T.Matrix4().copy(a.world).invert().multiply(b.world);
 const A=a.data(),B=b.data();
 let witness=null;
 A.bvh.bvhcast(B.bvh,transform,{intersectsTriangles:(t,u)=>{
  t.getNormal(normalA);u.getNormal(normalB);
  if(!straddles(t,normalB,u.a)||!straddles(u,normalA,t.a))return false;
  if(!t.intersectsTriangle(u,segment)||segment.distance()<EPS)return false;
  witness=segment.getCenter(new T.Vector3()).applyMatrix4(a.world);return true;
 }});
 if(witness)return witness;
 const invert=transform.clone().invert();
 for(const [subject,other,toLocal,world] of [[B,A,transform,b.world],[A,B,invert,a.world]]){
  for(const v of subject.samples){
   const q=v.clone().applyMatrix4(toLocal);
   if(other.g.boundingBox?.containsPoint(q)&&inside(other,q)){
    if(separatedOnCap(a,b))return null;
    return v.clone().applyMatrix4(world);
   }
  }
 }
 return null;
}
export function makeContactSet(bodies){
 const pairs=[];
 for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
  const a=bodies[i],b=bodies[j];
  if(!(a.active||b.active)||a.mesh.parent===b.mesh.parent&&!a.mesh.morphTargetInfluences&&!b.mesh.morphTargetInfluences)continue;
  pairs.push({a,b,rest:new T.Matrix4().copy(a.mesh.matrixWorld).invert().multiply(b.mesh.matrixWorld),baseline:undefined});
 }
 return {count:pairs.length,sync(){for(const b of bodies)b.sync();},check(){
  this.sync();let nativeHit=null;
  for(const pair of pairs){
   const {a,b,rest}=pair;
   const current=new T.Matrix4().copy(a.world).invert().multiply(b.world);
   const deformed=[a,b].some(x=>x.mesh.morphTargetInfluences?.some(w=>w>1e-6));
   if(!deformed&&current.elements.every((n,k)=>Math.abs(n-rest.elements[k])<1e-7))continue;
   if(!a.box.intersectsBox(b.box))continue;
   const hit=penetration(a,b);if(!hit)continue;
   if(pair.baseline===undefined){
    // The complete pose might already contain a source overlap. Compare the native rest pose.
    const restBody=(body,matrix)=>({world:matrix,box:body.restData().g.boundingBox.clone().applyMatrix4(matrix),data:()=>body.restData()});
    pair.baseline=!!penetration(restBody(a,new T.Matrix4()),restBody(b,rest));
   }
   if(!pair.baseline)return {kind:'bone',name:a.name+' / '+b.name,point:hit};
   // If two native surfaces already overlap, distinguish newly buried sample points.
   const checkSamples=(subject,other,toRest,toNow)=>{
    const data=subject.data(),dst=other.data();
    for(const [index,point] of data.samples.entries()){
     const q=point.clone().applyMatrix4(toNow);
     if(!dst.g.boundingBox.containsPoint(q)||!inside(dst,q))continue;
     const old=subject.restData().samples[index].clone().applyMatrix4(toRest),restDst=other.restData();
     if(!restDst.g.boundingBox.containsPoint(old)||!inside(restDst,old))return point.clone().applyMatrix4(subject.world);
    }
    return null;
   };
   const inv=rest.clone().invert(),nowInv=current.clone().invert();
   const newer=checkSamples(b,a,rest,current)||checkSamples(a,b,inv,nowInv);
   if(newer)return {kind:'bone',name:a.name+' / '+b.name,point:newer};
   if(!nativeHit)nativeHit={kind:'native',name:a.name+' / '+b.name,point:hit};
  }
  return nativeHit;
 }};
}

// Sweep in progress space and refine the first sampled violation from the uninjured pose.
export function firstLimit(probe,steps=48){
 let previous=0;
 for(let i=1;i<=steps;i++){
  const t=i/steps,reason=probe(t);
  if(reason){let lo=previous,hi=t;for(let j=0;j<9;j++){const mid=(lo+hi)/2;if(probe(mid))hi=mid;else lo=mid;}
   return {time:lo,reason};}
  previous=t;
 }return {time:1,reason:null};
}
