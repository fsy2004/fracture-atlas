import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {decodeSurfaces,landmark,planeNormal,inReflectedFrame} from '../detail.js';
import {section,atLevel,branchSection,shortShaftCut} from '../geometry.js';
import {makeObservation,wristLandmarks} from '../observation.js';
import {courses} from '../courses.js';
import {supplementalCourses} from '../supplemental.js';
import {nativeAnchor} from '../surface-lessons.js';

const load=name=>fs.readFileSync(new URL('../models/'+name,import.meta.url));
const index=JSON.parse(load('index.json')),details=JSON.parse(load('detail.json'));
const compressed=load('detail.bin.gz');
const meshes=await decodeSurfaces(details,compressed.buffer.slice(compressed.byteOffset,compressed.byteOffset+compressed.byteLength));
test('every indexed male bone resolves to its verified higher-resolution surface',()=>{
 assert.equal(createHash('sha256').update(gunzipSync(compressed)).digest('hex'),details.buffer_sha256);
 assert.equal(meshes.size,index.length);
 for(const bone of index){
  const mesh=meshes.get(bone.mesh);assert.ok(mesh, bone.name);
  assert.ok(mesh.attributes.position.array.every(Number.isFinite),bone.name);
  assert.ok(mesh.index.array.every(i=>i<mesh.attributes.position.count),bone.name);
 }
});
for(const side of ['Right','Left'])test(side+' native wrist preserves its intended radiocarpal involvement',()=>{
 const course=courses.find(c=>c.id==='radius');
 const native=meshes.get(index.find(m=>m.name===side+' radius').mesh);
 const originalMap=native.userData.landmarkMap;
 const g=side==='Right'?native:inReflectedFrame(native);
 assert.equal(native.userData.landmarkMap,originalMap);
 for(const [k,v] of course.variants.entries()){
  const spec=v.cuts[0],a=spec.anchor?landmark(g,spec.anchor):new T.Vector3(...atLevel(g,spec.axis,spec.level));
  const parts=section(g,spec.anchor?planeNormal(g,spec.normal):spec.normal,a.toArray()).map(({geo,outline},i)=>({
   name:spec.bone,shell:new T.Mesh(geo),edge:new T.LineSegments(outline),pivot:new T.Group(),anchor:a,moving:i===0
  }));
  const obs=makeObservation({course,variant:k,source:spec,geometry:g,anchor:a,parts,group:new T.Group(),context:[],joint:false});
  assert.equal(obs.crosses,k>=2,v.name);
  if(k===0){
   const rim=wristLandmarks(g);
   for(const point of [rim.dorsal,rim.volar])assert.ok(point.clone().sub(a).dot(new T.Vector3(...spec.normal))<0);
  }
 }
});

test('all native meshes share one world transform and retain the released source coordinates',()=>{
 const packed=gunzipSync(compressed);
 for(const m of details.entries){
  const g=meshes.get(m.mesh),attr=g.attributes.position;
  const file=packed.subarray(m.offset,m.offset+m.vertices*12);
  assert.equal(createHash('sha256').update(file).digest('hex'),m.native_xyz_sha256);
  const raw=new Float32Array(file.buffer,file.byteOffset,file.length/4);
  for(let j=0;j<raw.length;j++)assert.ok(Math.abs(attr.array[j]*1000-raw[j]-details.display_offset_mm[j%3])<.00015);
  if(m.head_fit){
   assert.ok(m.head_fit.fitted_vertices>100&&m.head_fit.patch_rms_mm<1.5);
   assert.ok(m.head_fit.radius_mm>15&&m.head_fit.radius_mm<32);
  }
 }
});

for(const side of ['Right','Left'])test(side+' native Y-shaped distal femoral fracture retains the crease and both condylar caps',()=>{
 const native=meshes.get(index.find(m=>m.name===side+' femur').mesh),g=side==='Right'?native:inReflectedFrame(native);
 const anchor=atLevel(g,1,.095),[,distal]=section(g,[0,-1,0],anchor,.85);
 for(const child of branchSection(distal,[1,0,0],anchor)){
  const p=child.face.attributes.position,normal=child.face.attributes.normal;
  let vertical=0,oblique=0;
  for(let i=0;i<p.count;i+=3){
   const x=Math.abs(normal.getX(i));if(x>.999)vertical++;if(x>.3&&x<.9)oblique++;
  }
  assert.ok(vertical>20&&oblique>20,'both cuts must be visible inside each condyle');
 }
});

for(const side of ['Right','Left'])test(side+' calcaneal fracture labels agree with native opposed talar surface',()=>{
 const lookup=name=>{
  const g=meshes.get(index.find(i=>i.name===name.replace('Right',side)).mesh);
  return side==='Left'?inReflectedFrame(g):g;
 };
 const c=courses.find(c=>c.id==='calcaneus'),g=lookup('Right calcaneus');
 for(const [i,v] of c.variants.entries()){
  const s=v.cuts[0],a=s.nativePoint?nativeAnchor(g,s.nativePoint):new T.Vector3(...atLevel(g,s.axis,s.level));
  const parts=section(g,s.normal,a.toArray()).map(({geo,outline},j)=>({
   name:s.bone,shell:new T.Mesh(geo),edge:new T.LineSegments(outline),pivot:new T.Group(),anchor:a,moving:j===0
  }));
  const obs=makeObservation({course:c,variant:i,source:s,geometry:g,anchor:a,parts,group:new T.Group(),context:[],lookupGeometry:lookup});
  assert.ok(obs.patch);assert.equal(obs.crosses,i===1,v.name);
 }
});
test('transverse and oblique digital fractures follow the native shaft',()=>{
 for(const c of supplementalCourses)for(const v of c.variants)for(const s of v.cuts){
  if(s.shaftAngle===undefined)continue;
  for(const side of ['Right','Left']){
   const name=s.bone.replace(/right/i,x=>x==='Right'?side:side.toLowerCase());
   const g=meshes.get(index.find(i=>i.name===name).mesh);
   const along=new T.Vector3(...atLevel(g,s.axis,.74)).sub(new T.Vector3(...atLevel(g,s.axis,.26))).normalize();
   const n=new T.Vector3(...shortShaftCut(g,s,s.shaftAngle).normal);
   assert.ok(Math.abs(Math.abs(n.dot(along))-Math.cos(s.shaftAngle*Math.PI/180))<1e-8);
  }
 }
});
