import * as T from './vendor/three.module.js';
import {MeshBVH} from './vendor/mesh-bvh.js';
const nativeTrees=new WeakMap();
export function surfaceTree(g){
 let tree=nativeTrees.get(g);
 if(!tree){tree=new MeshBVH(g,{indirect:true});nativeTrees.set(g,tree);}
 return tree;
}


export function nativeAnchor(g,f){
 const box=g.boundingBox;
 return new T.Vector3(...f.map((x,i)=>T.MathUtils.lerp(box.min.getComponent(i),box.max.getComponent(i),x)));
}
export function addSurfaceLesson(g,s,group,materials,annotations,wedges){
 const seed=nativeAnchor(g,s.nativePoint),p=g.attributes.position,n=g.attributes.normal;
 const extent=g.boundingBox.getSize(new T.Vector3()),scale=Math.max(...extent.toArray());
 const base=new T.Vector3(),out=new T.Vector3(),tmp=new T.Vector3();
 let best=Infinity;
 for(let i=0;i<p.count;i++){
  tmp.fromBufferAttribute(p,i);const d=tmp.distanceToSquared(seed);
  if(d<best){best=d;base.copy(tmp);out.fromBufferAttribute(n,i).normalize();}
 }
 const radius=Math.max(.002,scale*s.extent);
 if(s.surface==='dent'){
  if(s.depth){
   out.set(0,s.normal[1]<0?-1:1,0);
   base.copy(seed);
  }
  const geo=g.clone(),deltas=[new Float32Array(p.count*3),new Float32Array(p.count*3)];
  for(let i=0;i<p.count;i++){
   tmp.fromBufferAttribute(p,i).sub(base);
   const z=tmp.dot(out),r=tmp.addScaledVector(out,-z).length();
   for(let j=0;j<2;j++){
    const range=s.spread?.[j]||radius*(j?1.2:.82);
    const w=1-T.MathUtils.smoothstep(r,s.depth?range*.55:0,range);
    const depth=(s.depth||.22*radius)*w*(1-T.MathUtils.smoothstep(Math.abs(z),s.depth?.42*range:.25*radius,s.depth?.75*range:.65*radius));
    for(let k=0;k<3;k++)deltas[j][3*i+k]=-depth*out.getComponent(k);
   }
  }
  geo.morphAttributes.position=deltas.map(d=>new T.BufferAttribute(d,3));geo.morphTargetsRelative=true;
  const mesh=new T.Mesh(geo,materials.bone);mesh.userData.dispose=true;mesh.userData.bone=s.bone;group.add(mesh);wedges.push(mesh);
 }else{
  const mesh=new T.Mesh(g,materials.bone);mesh.userData.bone=s.bone;group.add(mesh);
  const normal=new T.Vector3(...s.normal);normal.addScaledVector(out,-normal.dot(out)).normalize();
  const pts=[],ids=g.index.array,v=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
  for(let i=0;i<ids.length;i+=3){
   for(let k=0;k<3;k++)v[k].fromBufferAttribute(p,ids[i+k]);
   const face=new T.Vector3().subVectors(v[1],v[0]).cross(new T.Vector3().subVectors(v[2],v[0]));
   if(face.dot(out)<=0)continue;
   const d=v.map(a=>normal.dot(a)-normal.dot(base)),ends=[];
   for(let k=0;k<3;k++){const j=(k+1)%3;if((d[k]>=0)!==(d[j]>=0))ends.push(v[k].clone().lerp(v[j],d[k]/(d[k]-d[j])));}
   if(ends.length!==2)continue;
   const dir=ends[1].clone().sub(ends[0]),off=ends[0].clone().sub(base);
   const a=dir.lengthSq(),b=off.dot(dir),disc=b*b-a*(off.lengthSq()-radius*radius);
   if(disc<=0||a<1e-16)continue;
   const t0=Math.max(0,(-b-Math.sqrt(disc))/a),t1=Math.min(1,(-b+Math.sqrt(disc))/a);
   if(t0<t1)pts.push(ends[0].clone().addScaledVector(dir,t0),ends[0].clone().addScaledVector(dir,t1));
  }
  const geo=new T.BufferGeometry().setFromPoints(pts),edge=new T.LineSegments(geo,materials.line);
  edge.userData.dispose=true;group.add(edge);annotations.push(edge);
 }
 return base;
}
