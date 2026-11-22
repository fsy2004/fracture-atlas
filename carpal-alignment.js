import * as T from './vendor/three.module.js';

// Keep each point attached to its original mesh. All three landmarks use the same donor.
export function carpalAlignment(group,items,lessonMesh,course){
 if(!['radius','lunate-dislocation'].includes(course.id))return null;
 const mobileParts=items.filter(i=>i.shell),meshes=new Map();
 group.traverse(o=>{
  if(!o.isMesh||!o.userData.bone||o.material?.opacity<.3)return;
  const list=meshes.get(o.userData.bone)||[];list.push(o);meshes.set(o.userData.bone,list);
 });
 const lunate=lessonMesh('Right lunate');if(!lunate)return null;
 const centre=lunate.boundingBox.getCenter(new T.Vector3()),vec=new T.Vector3();
 function attach(name,seed,surface){
  const shells=mobileParts.filter(p=>p.name===name).map(p=>p.shell);
  const candidates=shells.length?shells:meshes.get(name)||[];
  let best=null,dist=Infinity;
  for(const mesh of candidates){
   if(!surface){return {mesh,point:seed.clone(),name};}
   const p=mesh.geometry.attributes.position;
   for(let j=0;j<p.count;j++){
    vec.fromBufferAttribute(p,j);const d=vec.distanceToSquared(seed);
    if(d<dist){dist=d;best={mesh,point:vec.clone(),name};}
   }
  }
  return best;
 }
 const refs=[attach('Right radius',centre,true),attach('Right lunate',centre,false),attach('Right capitate',centre,true)];
 if(refs.some(x=>!x))return null;
 const guides=new T.Group();group.add(guides);guides.renderOrder=10;
 const inks=[0x226b61,0xa55524,0x355e86],labels=['桡骨月骨窝','月骨体','头状骨头'];
 const points=refs.map((_,i)=>{
  const dot=new T.Mesh(new T.SphereGeometry(.00135,12,8),new T.MeshBasicMaterial({color:inks[i],depthTest:false}));dot.renderOrder=11;guides.add(dot);return dot;
 });
 const g=new T.BufferGeometry(),pos=new T.Float32BufferAttribute(new Float32Array(9),3);g.setAttribute('position',pos);
 const line=new T.Line(g,new T.LineBasicMaterial({color:0x214d49,depthTest:false}));line.frustumCulled=false;line.renderOrder=10;guides.add(line);
 return {update(visible){
  guides.visible=visible;if(!visible)return [];
  group.updateWorldMatrix(true,true);
  return refs.map(({mesh,point},i)=>{
   const p=group.worldToLocal(mesh.localToWorld(point.clone()));points[i].position.copy(p);
   pos.setXYZ(i,p.x,p.y,p.z);pos.needsUpdate=true;return {text:labels[i],point:p};
  });
 },dispose(){guides.removeFromParent();guides.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}};
}
