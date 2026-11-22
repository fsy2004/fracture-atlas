import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../vendor/three.module.js';
import {specimenLibrary} from '../specimen.js';
import {courses} from '../courses.js';
import {joints} from '../joints.js';
import {digitalCut} from '../digit-frame.js';
import {plateauSite,applyPlateauBed} from '../plateau.js';
const read=u=>Promise.resolve(new Response(fs.readFileSync(new URL('../'+u,import.meta.url))));
const lib=specimenLibrary(read);await lib.init();

test('all 201 structures have a specimen or explicit regional estimate; accessory meshes cannot replace them',()=>{
 const index=JSON.parse(fs.readFileSync(new URL('../models/index.json',import.meta.url))),names=new Set();
 for(const x of index)names.add(names.has(x.name)?x.name+' '+x.mesh:x.name);
 assert.equal(names.size,201);assert.equal([...names].filter(n=>lib.isAddition(n)).length,88);
 for(const name of names)assert.ok(lib.required(name,null,null).length,name);
 assert.match(lib.label(lib.required('Right palatine bone',null,null)),/估计区/);
 assert.ok(lib.region('Left parietal bone'));assert.ok(lib.region('Xiphoid process'));
});
test('wrist fractures and both carpal dislocation diagnoses use native same-side wrist bones',()=>{
 const wrist=courses.find(c=>c.id==='radius'),joint=joints.find(c=>c.id==='lunate-dislocation');
 for(const side of ['Left','Right'])for(const c of [wrist,joint])for(const v of c.variants){
  const keys=lib.required(side+' radius',c,v);
  assert.ok(keys.length>=3);
  assert.ok(keys.every(key=>key.startsWith('openskeleton-N187928-'+side.toLowerCase()+'-arm|')));
 }
 assert.ok(joint.variants[0].cuts.some(s=>s.bone.endsWith('lunate')));
 assert.ok(joint.variants[1].fixed.includes('Right lunate'));
 assert.ok(joint.variants[1].cuts.some(s=>s.bone.endsWith('capitate')));
});
test('plateau depression is local and independently adjustable on real native bone',async()=>{
 const keys=lib.required('Right tibia',null,null);await lib.load(keys);lib.trim(keys);
 const g=lib.get('Right tibia'),site=plateauSite(g),m=applyPlateauBed(new T.Mesh(g.clone()),site);
 const c=site.centre.clone(),rim=c.clone().add(new T.Vector3(site.rx*1.4,0,0));
 m.morphTargetInfluences[0]=1;
 assert.ok(Math.abs(c.y-m.userData.deformPoint(c).y-.005)<1e-9);
 assert.ok(rim.distanceTo(m.userData.deformPoint(rim))<1e-9);
 m.morphTargetInfluences[0]=0;assert.ok(c.equals(m.userData.deformPoint(c)));
});
test('measured digit axes produce the requested obliquity on both sides in the teaching frame',async()=>{
 for(const side of ['Right','Left']){
  const name='Middle phalanx of '+side.toLowerCase()+' index finger',keys=lib.required(name,null,null);
  await lib.load(keys);lib.trim(keys);const g=lib.get('Middle phalanx of right index finger',side==='Left');
  for(const degrees of [0,38]){
   const z={shift:[0,0,0],turn:[0,0,0]};
   const cut=digitalCut(g,{axis:1,level:.5,normal:[0,-1,0],minus:z,plus:z},degrees);
   assert.ok(Math.abs(Math.abs(new T.Vector3(...cut.normal).dot(cut.digitAxis))-Math.cos(degrees*Math.PI/180))<1e-6);
  }
 }
});
