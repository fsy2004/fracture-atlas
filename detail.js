import * as T from './vendor/three.module.js';

// The map takes landmarks in the old lesson frame back into the native assembly.
// It is never applied to a high-detail vertex.
export function landmarkMap(entry,offset){
 const linear=new T.Matrix3().set(...entry.linear.flat()).transpose().invert();
 return {linear,translation:new T.Vector3(...entry.translation_mm).multiplyScalar(.001),
  offset:new T.Vector3(...offset).multiplyScalar(.001)};
}
export function landmark(g,point){
 const p=new T.Vector3(...point),map=g.userData.landmarkMap;
 return map?p.sub(map.translation).applyMatrix3(map.linear).add(map.offset):p;
}
export function planeNormal(g,normal){
 const n=new T.Vector3(...normal),map=g.userData.landmarkMap;
 return (map?n.applyMatrix3(map.linear):n).normalize().toArray();
}
export function alignPreview(g,map){
 const attr=g.attributes.position,p=new T.Vector3();
 for(let i=0;i<attr.count;i++){
  p.fromBufferAttribute(attr,i).sub(map.translation).applyMatrix3(map.linear).add(map.offset);
  attr.setXYZ(i,p.x,p.y,p.z);
 }
 attr.needsUpdate=true;g.userData.landmarkMap=map;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
}

export async function decodeSurfaces(manifest,bytes){
 const magic=new Uint8Array(bytes,0,2);
 const packed=magic[0]===31&&magic[1]===139
  ?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():bytes;
 if(manifest.format!=='native-f32-mm-v1')throw Error('精细网格与坐标版本不匹配');
 const surfaces=new Map(),offset=manifest.display_offset_mm;
 for(const m of manifest.entries){
  const src=new Float32Array(packed,m.offset,3*m.vertices),positions=new Float32Array(src.length);
  for(let i=0;i<src.length;i++)positions[i]=(src[i]+offset[i%3])*.001;
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.BufferAttribute(positions,3));
  g.setIndex(new T.BufferAttribute(new Uint16Array(packed,m.offset+src.byteLength,m.indices),1));
  g.userData.landmarkMap=landmarkMap(m,offset);
  if(m.head_fit)g.userData.headCentre=new T.Vector3(...m.head_fit.centre_mm).add(new T.Vector3(...offset)).multiplyScalar(.001);
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();surfaces.set(m.mesh,g);
 }
 return surfaces;
}


// Reuse right-sided motion definitions in a temporary reflected coordinate frame.
// Reflecting this mesh again at the scene root restores the actual left anatomy.
export function inReflectedFrame(source){
 const g=source.clone(),reflect=new T.Matrix3().set(-1,0,0,0,1,0,0,0,1);
 g.userData={...source.userData};
 g.scale(-1,1,1);
 const indices=g.index.array;
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const map=source.userData.landmarkMap;
 if(map)g.userData.landmarkMap={linear:reflect.clone().multiply(map.linear).multiply(reflect),
  translation:map.translation.clone().applyMatrix3(reflect),offset:map.offset.clone().applyMatrix3(reflect)};
 if(source.userData.digit){
  const d=source.userData.digit,flip=a=>[-a[0],a[1],a[2]];
  g.userData.digit={...d,proximal_m:flip(d.proximal_m),distal_m:flip(d.distal_m),axis:flip(d.axis),
   transverse:flip(d.transverse)};
 }
 if(source.userData.headCentre)g.userData.headCentre=source.userData.headCentre.clone().applyMatrix3(reflect);
 return g;
}
