import * as T from './vendor/three.module.js';

// Axial impaction: shorten the receiving bone locally while its distant cortex stays fixed.
// The intact point on the mobile fragment can then reach the deformed fracture bed.
export function prepareImpaction(receiver,driver,origin){
 const axis=driver.shift.clone().normalize(),depth=driver.shift.length();
 const thickness=Math.max(.012,depth*4.5),pt=new T.Vector3();
 function deltas(geometry){
  const p=geometry.attributes.position,out=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
   const h=pt.fromBufferAttribute(p,i).sub(origin).dot(axis);
   const weight=1-T.MathUtils.smoothstep(h,0,thickness);
   pt.copy(axis).multiplyScalar(depth*weight).toArray(out,i*3);
  }
  return new T.BufferAttribute(out,3);
 }
 for(const mesh of [receiver.shell,receiver.face]){
  mesh.geometry.morphTargetsRelative=true;
  mesh.geometry.morphAttributes.position=[deltas(mesh.geometry)];
  mesh.updateMorphTargets();
 }
 const edge=receiver.edge.geometry.attributes.position,base=edge.array.slice(),edgeDelta=deltas(receiver.edge.geometry).array;
 let previous=-1;
 return ()=>{
  const amount=T.MathUtils.clamp(pt.copy(driver.pivot.position).sub(driver.anchor).dot(axis)/depth,0,1.75);
  if(amount===previous)return;
  receiver.shell.morphTargetInfluences[0]=receiver.face.morphTargetInfluences[0]=amount;
  for(let i=0;i<base.length;i++)edge.array[i]=base[i]+amount*edgeDelta[i];
  edge.needsUpdate=true;previous=amount;
 };
}


// Anterior-ring compression. Preserve the posterior hemipelvis and deform the narrow
// band at the ramus fracture as its rigid rotation would otherwise cross the opposing bed.
export function prepareRamusCompression(item,origin,normal){
 const plane=normal.clone().normalize(),width=.055,localNormal=new T.Vector3(),quaternion=new T.Quaternion();
 const point=new T.Vector3(),restPoint=new T.Vector3(),projected=new T.Vector3(),worldPoint=new T.Vector3();
 const surfaces=[item.shell,item.face,item.edge].map(mesh=>{
  const g=mesh.geometry,attr=g.attributes.position,base=attr.array.slice();
  if(mesh.isMesh)mesh.userData.restSurface=g.clone();
  const active=[];
  for(let i=0;i<attr.count;i++){
   point.fromBufferAttribute(attr,i);
   const h=plane.dot(projected.subVectors(origin,point));
   if(h<-.00001||h>=width)continue;
   active.push({i,h,w:1-T.MathUtils.smoothstep(h,0,width)});
  }
  return {g,mesh,base,active,attr,normals:g.attributes.normal?.array.slice()};
 });
 let last='';
 return ()=>{
  const key=item.pivot.position.toArray().concat(item.pivot.quaternion.toArray()).join(',');
  if(key===last)return;last=key;
  const spin=item.pivot.quaternion,pos=item.pivot.position;
  localNormal.copy(plane).applyQuaternion(quaternion.copy(spin).invert());
  for(const {g,mesh,base,active,attr,normals} of surfaces){
   for(const {i,h,w} of active){
    restPoint.fromArray(base,i*3);
    projected.copy(restPoint).addScaledVector(plane,h).sub(item.anchor).applyQuaternion(spin).add(pos);
    const closure=plane.dot(projected.sub(origin));
    worldPoint.copy(restPoint).sub(item.anchor).applyQuaternion(spin).add(pos);
    const intrusion=plane.dot(worldPoint.sub(origin));
    const depth=Math.max(0,closure*w,intrusion);
    point.copy(restPoint).addScaledVector(localNormal,-depth);attr.setXYZ(i,point.x,point.y,point.z);
   }
   attr.needsUpdate=true;g.computeBoundingBox();
   if(mesh.isMesh){
    // Keep anatomical smooth normals outside the compressed band.
    const normal=g.attributes.normal;normal.array.set(normals);
    for(let i=0;i<base.length;i+=9){
     if(attr.array[i]===base[i]&&attr.array[i+3]===base[i+3]&&attr.array[i+6]===base[i+6])continue;
     const j=i/3;restPoint.fromBufferAttribute(attr,j);
     worldPoint.fromBufferAttribute(attr,j+1).sub(restPoint);
     projected.fromBufferAttribute(attr,j+2).sub(restPoint);point.crossVectors(worldPoint,projected).normalize();
     for(let k=0;k<3;k++)normal.setXYZ(j+k,point.x,point.y,point.z);
    }
    normal.needsUpdate=true;
   }
  }
 };
}
