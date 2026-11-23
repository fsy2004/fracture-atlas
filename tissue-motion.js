import * as T from './vendor/three.module.js';

const maxDrivers=4;
const influence={muscles:.86,vessels:.60,nerves:.48};
const one=new T.Vector3(1,1,1),identity=new T.Quaternion();
const smooth=(r,a,b)=>T.MathUtils.smoothstep(r,a,b);

function fields(actors,wedges,group){
 const result=[];
 for(const actor of actors){
  const mesh=actor.shell||actor.pivot.children.find(child=>child.isMesh&&child.geometry);
  if(!mesh)continue;
  const geometry=mesh.geometry;
  if(!geometry.boundingBox)geometry.computeBoundingBox();
  const box=geometry.boundingBox,size=box.getSize(new T.Vector3());
  const centre=box.getCenter(new T.Vector3());
  const extent=Math.max(size.x,size.y,size.z);
  const end=centre.clone().sub(actor.anchor);
  if(actor.jointAxis&&end.length()<extent*.32)end.copy(actor.jointAxis).multiplyScalar(-extent*.30);
  if(end.length()>.100)end.setLength(.100);
  const transverse=[size.x,size.y,size.z].sort((a,b)=>a-b)[1];
  const radius=T.MathUtils.clamp(transverse*.72,.012,.065);
  result.push({kind:'rigid',actor,start:actor.anchor.clone(),end:actor.anchor.clone().add(end),radius});
 }
 for(const mesh of wedges){
  const morph=mesh.geometry.morphAttributes.position;if(!morph?.length)continue;
  const ids=morph.map(delta=>{
   let peak=0,index=0;
   for(let i=0;i<delta.count;i++){
    const length=Math.hypot(delta.getX(i),delta.getY(i),delta.getZ(i));
    if(length>peak){peak=length;index=i;}
   }
   return index;
  });
  const centre=new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,ids[0]);
  const values=morph.map((delta,i)=>new T.Vector3().fromBufferAttribute(delta,ids[i]));
  result.push({kind:'compression',mesh,values,start:centre,end:centre.clone(),radius:.027});
 }
 const frame=group.matrixWorld;
 return result.slice(0,maxDrivers).map(field=>({...field,start:field.start.applyMatrix4(frame),end:field.end.applyMatrix4(frame)}));
}

function materialFor(base,uniforms,response){
 const material=base.clone();
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms,{tissueResponse:{value:response}});
  shader.vertexShader=`
uniform mat4 followMatrix[4];
uniform vec4 followStart[4];
uniform vec4 followEnd[4];
uniform float tissueResponse;
vec3 followTissue(vec3 p) {
 vec3 movement = vec3(0.0);
 float total = 0.0;
 for (int i=0; i<4; i++) {
  vec3 start = followStart[i].xyz, v = followEnd[i].xyz-start;
  float along = clamp(dot(p-start, v)/max(dot(v,v), 0.0000001), 0.0, 1.0);
  float r = followStart[i].w;
  float distanceToBone = distance(p,start+v*along);
  float w = (1.0-smoothstep(r*.34,r,distanceToBone))*followEnd[i].w;
  vec3 displaced = (followMatrix[i]*vec4(p,1.0)).xyz;
  movement += (displaced-p)*w;
  total += w;
 }
 return p + movement*tissueResponse/max(1.0,total);
}
`+shader.vertexShader.replace('#include <project_vertex>',`
 vec3 restTissue = (modelMatrix*vec4(transformed,1.0)).xyz;
 vec4 atlasTissuePosition = vec4(followTissue(restTissue),1.0);
 vec4 mvPosition = viewMatrix*atlasTissuePosition;
 gl_Position = projectionMatrix*mvPosition;
`).replace('#include <worldpos_vertex>',`
 #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION )
  vec4 worldPosition = atlasTissuePosition;
 #endif
`);
 };
 material.customProgramCacheKey=()=> 'atlas-linked-tissues';
 return material;
}

// Local deformation is driven by the accepted bone pose. Tissue far from the
// active fragment stays in its rest position, and no rupture is inferred.
export function linkSoftTissues(entry,registration,boneGroup,actors,wedges){
 const bound=fields(actors,wedges,boneGroup);
 if(!bound.length)return null;
 entry.root.applyMatrix4(registration.matrix);
 entry.root.updateMatrixWorld(true);
 for(const t of entry.tags){
  t.point.applyMatrix4(registration.matrix);
  t.rest=t.point.clone();
 }
 const mates=[],patched=new Map(),probes=new Map();
 const segment=new T.Vector3(),projected=new T.Vector3(),sample=new T.Vector3();
 function weight(point,field){
  segment.copy(field.end).sub(field.start);
  const t=T.MathUtils.clamp(projected.copy(point).sub(field.start).dot(segment)/Math.max(segment.lengthSq(),1e-7),0,1);
  projected.copy(field.start).addScaledVector(segment,t);
  return 1-smooth(projected.distanceTo(point),field.radius*.34,field.radius);
 }
 const matrices=Array.from({length:maxDrivers},()=>new T.Matrix4());
 const start=Array.from({length:maxDrivers},()=>new T.Vector4(0,0,0,1));
 const end=Array.from({length:maxDrivers},()=>new T.Vector4());
 const uniforms={followMatrix:{value:matrices},followStart:{value:start},followEnd:{value:end}};
 for(const [i,field] of bound.entries()){
  start[i].set(...field.start.toArray(),field.radius);
  end[i].set(...field.end.toArray(),1);
 }
 entry.root.traverse(node=>{
  if(!node.isMesh)return;
  if(node.userData.atlasLayer==='bones'){
   mates.push([node,node.visible,null]);node.visible=false;return;
  }
  const original=node.material;
  const response=influence[node.userData.atlasLayer]??.5;
  if(node.visible){
   const positions=node.geometry.attributes.position,step=Math.max(1,Math.ceil(positions.count/32));
   for(let j=0;j<positions.count;j+=step){
    sample.fromBufferAttribute(positions,j).applyMatrix4(node.matrixWorld);
    for(const [i,field] of bound.entries()){
     const score=weight(sample,field)*(1+Math.min(.1,sample.distanceTo(field.start))*5);
     const id=node.userData.atlasLayer+'/'+i;
     if(score>0&&score>(probes.get(id)?.score||0))probes.set(id,{score,point:sample.clone(),response});
    }
   }
  }
  const key=original.uuid+'/'+response;
  if(!patched.has(key))patched.set(key,materialFor(original,uniforms,response));
  mates.push([node,node.frustumCulled,original]);
  node.material=patched.get(key);
  node.frustumCulled=false;
 });
 const into=new T.Matrix4().copy(boneGroup.matrixWorld).invert();
 const nodeTransform=new T.Matrix4(),originShift=new T.Matrix4();
 const vector=new T.Vector3(),displaced=new T.Vector3(),movement=new T.Vector3();
 function deform(point,response){
  let total=0;movement.set(0,0,0);
  for(const [i,field] of bound.entries()){
   const amount=weight(point,field);
   displaced.copy(point).applyMatrix4(matrices[i]).sub(point);
   movement.addScaledVector(displaced,amount);total+=amount;
  }
  return movement.multiplyScalar(response/Math.max(1,total));
 }
 return {
  update(){
   for(const [i,field] of bound.entries()){
    if(field.kind==='rigid'){
     const {pivot,anchor}=field.actor;
     originShift.makeTranslation(-anchor.x,-anchor.y,-anchor.z);
     nodeTransform.compose(pivot.position,pivot.quaternion,one).multiply(originShift);
    }else{
     vector.set(0,0,0);
     for(const [j,value] of field.values.entries())vector.addScaledVector(value,field.mesh.morphTargetInfluences[j]||0);
     nodeTransform.compose(vector,identity,one);
    }
    matrices[i].copy(boneGroup.matrixWorld).multiply(nodeTransform).multiply(into);
   }
   for(const tag of entry.tags)tag.point.copy(tag.rest).add(deform(tag.rest,influence[tag.layer]??.5));
   let largest=0;
   for(const probe of probes.values())largest=Math.max(largest,deform(probe.point,probe.response).length());
   return largest;
  },
  dispose(){
   for(const [node,state,material] of mates){
    if(material){node.material=material;node.frustumCulled=state;}
    else node.visible=state;
   }
   for(const material of patched.values())material.dispose();
  }
 };
}
