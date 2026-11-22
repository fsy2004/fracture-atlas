import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {teachingTargets} from '../motion-presets.js';
import {buildKinematics,shaftFrame} from '../kinematics.js';

test('visible defaults are restricted to designated displaced presentations',()=>{
 assert.deepEqual(teachingTargets({id:'tibia',variant:1},8,4.5),{travel:12,spin:12});
 for(const clinical of [
  {id:'clavicle',variant:0},{id:'radius',variant:0,selectedShape:'oblique'},
  {id:'femur',variant:0,wedge:true},{id:'neck',variant:2},{id:'tibia',variant:1,legacyMotion:true},
  {id:'shoulder',variant:0},{id:'radial-head',variant:0}
 ])assert.deepEqual(teachingTargets(clinical,3,4),{travel:3,spin:4});
});

test('helical shortening opens before lateral clearance and reports net axial displacement',()=>{
 const previous=globalThis.document;
 const output={},node=()=>({dataset:{},append(){},replaceChildren(){},setAttribute(){}});
 globalThis.document={getElementById:id=>(output[id]??=node()),createElement:node};
 try{
  const T0=()=>new T.Vector3(),part={anchor:T0(),pivot:new T.Group(),shift:T0(),turn:T0(),tuned:'shaft'};
  const frame=shaftFrame(T0(),new T.Vector3(0,1,0),false);
  const apply=buildKinematics([part],[],['shorten'],frame,30,false,{},()=>{},{id:'tibia',variant:1});
  apply(0);assert.ok(part.pivot.position.length()<1e-12);
  apply(.2);assert.ok(Math.abs(part.pivot.position.y+.013)<1e-12);
  assert.match(output.liveValues.textContent,/轴向分离 13 mm/);
  apply(1);assert.ok(Math.abs(part.pivot.position.y-.012)<1e-12);
  assert.match(output.liveValues.textContent,/轴向缩短 12 mm/);
  assert.ok(part.pivot.position.x<-.03);
  const old=buildKinematics([part],[],['rotate'],frame,30,false,{rotate:35},()=>{},{id:'tibia',variant:1,legacyMotion:true});
  old(1,false);assert.ok(part.pivot.position.length()<1e-12);
  const zero=buildKinematics([part],[],['rotate'],frame,30,false,{rotate:0},()=>{},{id:'tibia',variant:1});
  zero(1);assert.ok(part.pivot.position.length()<1e-12);assert.ok(Math.abs(part.pivot.quaternion.w-1)<1e-12);
 }finally{globalThis.document=previous;}
});

test('saved physical amplitudes override a newly strengthened example',()=>{
 const previous=globalThis.document;
 const node=()=>({dataset:{},append(){},replaceChildren(){},setAttribute(){}});
 globalThis.document={getElementById:node,createElement:node};
 try{
  const make=()=>({pivot:new T.Group(),anchor:new T.Vector3(),shift:new T.Vector3(0,-.008,0),turn:new T.Vector3(0,Math.PI/40,0)});
  const a=make(),b=make(),clinical={id:'tibia',variant:1};
  buildKinematics([a],[],[],null,0,false,{},()=>{},clinical)(1,false);
  buildKinematics([b],[],[],null,0,false,{travel:8,spin:4.5},()=>{},clinical)(1,false);
  assert.ok(Math.abs(a.pivot.position.length()-.012)<1e-12);
  assert.ok(Math.abs(b.pivot.position.length()-.008)<1e-12);
  assert.ok(Math.abs(a.pivot.quaternion.angleTo(new T.Quaternion())-12*Math.PI/180)<1e-9);
  assert.ok(Math.abs(b.pivot.quaternion.angleTo(new T.Quaternion())-4.5*Math.PI/180)<1e-9);
 }finally{globalThis.document=previous;}
});
