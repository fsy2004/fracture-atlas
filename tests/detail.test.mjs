import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {decodeSurfaces} from '../detail.js';
import {section,atLevel} from '../geometry.js';
import {makeObservation,wristLandmarks} from '../observation.js';
import {courses} from '../courses.js';

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
test('wrist courses retain their intended radiocarpal involvement after mesh registration',()=>{
 const course=courses.find(c=>c.id==='radius'),g=meshes.get(index.find(m=>m.name==='Right radius').mesh);
 for(const [k,v] of course.variants.entries()){
  const spec=v.cuts[0],a=new T.Vector3(...(spec.anchor||atLevel(g,spec.axis,spec.level)));
  const parts=section(g,spec.normal,a.toArray()).map(({geo,outline},i)=>({
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
