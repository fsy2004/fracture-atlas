import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3();
export function plateauSite(g){
 const b=g.boundingBox,top=b.max.y,extent=b.max.y-b.min.y,p=g.attributes.position,n=g.attributes.normal,cap=new T.Box3(),point=V();
 for(let i=0;i<p.count;i++)if(p.getY(i)>top-.075*extent)cap.expandByPoint(point.fromBufferAttribute(p,i));
 const size=cap.getSize(V()),cx=cap.min.x+size.x*.27,cz=cap.min.z+size.z*.52;
 const centre=V();let min=Infinity;
 for(let i=0;i<p.count;i++){
  if(p.getY(i)<top-extent*.045||n.getY(i)<.5)continue;
  const d=(p.getX(i)-cx)**2+(p.getZ(i)-cz)**2;
  if(d<min){min=d;centre.fromBufferAttribute(p,i);}
 }
 return {centre,rx:size.x*.15,rz:size.z*.20,split:centre.clone().add(new T.Vector3(-size.x*.14,-size.y*.14,0))};
}
export function applyPlateauBed(mesh,site){
 const p=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,{centre,rx,rz}=site;
 function amount(x,y,z,width){
  const r=Math.hypot((x-centre.x)/rx,(z-centre.z)/rz)/width;
  return -.005*(1-T.MathUtils.smoothstep(r,.52,1))*(1-T.MathUtils.smoothstep(centre.y-y,.006,.022));
 }
 const ns=[],targets=[1,1.20].map(width=>{
  const delta=new Float32Array(3*p.count),dn=new Float32Array(3*p.count),v=V(),h=.00012;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=amount(x,y,z,width);
   delta[3*i+1]=f;if(!f)continue;
   const dx=(amount(x+h,y,z,width)-amount(x-h,y,z,width))/(2*h);
   const dy=(amount(x,y+h,z,width)-amount(x,y-h,z,width))/(2*h);
   const dz=(amount(x,y,z+h,width)-amount(x,y,z-h,width))/(2*h);
   v.fromBufferAttribute(normal,i);const ny=v.y/(1+dy);v.set(v.x-ny*dx,ny,v.z-ny*dz).normalize();
   dn.set([v.x-normal.getX(i),v.y-normal.getY(i),v.z-normal.getZ(i)],3*i);
  }
  ns.push(new T.BufferAttribute(dn,3));return new T.BufferAttribute(delta,3);
 });
 mesh.geometry.morphTargetsRelative=true;mesh.geometry.morphAttributes.position=targets;mesh.geometry.morphAttributes.normal=ns;mesh.updateMorphTargets();
 mesh.userData.deformPoint=p=>{
  const [a,b]=mesh.morphTargetInfluences,q=p.clone();q.y+=a*amount(p.x,p.y,p.z,1)+b*amount(p.x,p.y,p.z,1.2);return q;
 };
 return mesh;
}
// Keep the fracture outline on its deformed fragment. Its original point order is fixed.
export function followPlateauRim(part,site){
 const a=part.edge.geometry.attributes.position,rest=a.array.slice(),point=V(),{rx,rz,centre}=site;
 let key='';return ()=>{
  const [n,b]=part.shell.morphTargetInfluences,next=n+'/'+b;if(next===key)return;key=next;
  for(let i=0;i<a.count;i++){point.fromArray(rest,i*3);const r=Math.hypot((point.x-centre.x)/rx,(point.z-centre.z)/rz);
   const depth=1-T.MathUtils.smoothstep(centre.y-point.y,.006,.022);
   a.setY(i,point.y-.005*depth*(n*(1-T.MathUtils.smoothstep(r,.52,1))+b*(1-T.MathUtils.smoothstep(r/1.2,.52,1))));
  }a.needsUpdate=true;
 };
}


// Section across the actual superior surface, sampled on this donor in the healthy pose.
// Preserve the same surface correspondence as the condylar block separates and subsides.
export function plateauProfile(group,source,site,beds,treeFor){
 const {centre,rx}=site,ray=new T.Ray(V(),new T.Vector3(0,-1,0)),refs=[],tree=treeFor(source);
 const region=beds.filter(m=>m.userData.bone==='Right tibia'||m.userData.plateauShell);
 for(let i=0;i<=40;i++){
  ray.origin.set(centre.x+(i/40-.5)*rx*3.3,source.boundingBox.max.y+.01,centre.z);
  const h=tree.raycastFirst(ray,T.DoubleSide);if(!h)continue;
  let owner=region[0],dist=Infinity;
  for(const m of region){const q=treeFor(m.geometry).closestPointToPoint(h.point);if(q&&q.distance<dist){owner=m;dist=q.distance;}}
  if(owner)refs.push({m:owner,p:h.point.clone()});
 }
 if(refs.length<5)return null;
 const node=new T.Group();group.add(node);
 const rest=new T.BufferGeometry().setFromPoints(refs.map(r=>r.p));
 const a=new T.Line(rest,new T.LineDashedMaterial({color:0x296b64,dashSize:.0018,gapSize:.001,depthTest:false}));a.computeLineDistances();a.renderOrder=11;
 const live=rest.clone(),b=new T.Line(live,new T.LineBasicMaterial({color:0xa94c2c,depthTest:false}));b.frustumCulled=false;b.renderOrder=12;node.add(a,b);
 return {update(visible){
  node.visible=visible;if(!visible)return [];
  group.updateWorldMatrix(true,true);
  let max=0,tip=null;refs.forEach(({m,p},i)=>{
   const local=m.userData.deformPoint?.(p)||p.clone(),current=group.worldToLocal(m.localToWorld(local));
   live.attributes.position.setXYZ(i,current.x,current.y,current.z);
   if(p.y-local.y>max){max=p.y-local.y;tip=current;}
  });live.attributes.position.needsUpdate=true;
  return tip&&max>.00015?[{point:tip,text:'平台局部压低 '+(max*1000).toFixed(1)+' mm'}]:[];
 },dispose(){node.removeFromParent();node.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}};
}
