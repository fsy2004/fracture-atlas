import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildKinematics,shaftFrame} from '../kinematics.js';

const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function withControls(fn){
 const previous=globalThis.document;
 const node=()=>({dataset:{},append(){},replaceChildren(){},setAttribute(){}});
 globalThis.document={createElement:node,getElementById:node};
 try{fn();}finally{globalThis.document=previous;}
}
function part(anchor){
 return {pivot:new T.Group(),anchor,turn:vec(),shift:vec(),tuned:'shaft'};
}
test('pure angulation keeps the selected cortical hinge stationary',()=>withControls(()=>{
 const a=vec(.1,.7,-.04),piece=part(a),rim=new T.BufferGeometry();
 rim.setFromPoints([a.clone().add(vec(.01,0,0)),a.clone().add(vec(-.01,0,0))]);
 piece.edge={geometry:rim};
 const frame=shaftFrame(vec(),vec(0,1,0),false);
 const apply=buildKinematics([piece],[],['angle'],frame,20,false,{angle:22},()=>{});
 for(const t of [0,.57,.81,1]){
  apply(t,false);
  const actual=vec(.01,0,0).applyQuaternion(piece.pivot.quaternion).add(piece.pivot.position);
  assert.ok(actual.distanceTo(a.clone().add(vec(.01,0,0)))<1e-7);
 }
 assert.ok(Math.abs(piece.pivot.quaternion.angleTo(new T.Quaternion())*180/Math.PI-22)<1e-8);
}));
test('overlap clears the cross section before shortening and preserves the distance between paired segments',()=>withControls(()=>{
 const a=vec(.15,.72,-.03),bones=[part(a),part(a)],frame=shaftFrame(vec(),vec(.14,.97,-.19),false);
 const apply=buildKinematics(bones,[],['rotate','shorten'],frame,25,false,{rotate:24,shorten:12},()=>{});
 for(const t of [0,.34,.56,.73,1]){
  apply(t,false);
  const d=bones[0].pivot.position.clone().sub(a);
  if(t<=.56)assert.ok(Math.abs(d.dot(frame.axis))<1e-12);
  if(t>=.56)assert.ok(Math.abs(d.dot(frame.side)-.025*1.03)<1e-12);
  const ends=[vec(-.018,-.10,.01),vec(.012,-.1,-.007)];
  const world=ends.map((p,j)=>p.clone().applyQuaternion(bones[j].pivot.quaternion).add(bones[j].pivot.position));
  assert.ok(Math.abs(world[0].distanceTo(world[1])-ends[0].distanceTo(ends[1]))<1e-12);
 }
 const d=bones[0].pivot.position.clone().sub(a);
 assert.ok(Math.abs(d.dot(frame.axis)-.012)<1e-12);
}));
test('ball-joint spin preserves its centre, independently of translation',()=>withControls(()=>{
 const a=vec(-.07,.82,.018),axis=vec(.08,.99,-.1).normalize();
 const item={anchor:a,pivot:new T.Group(),turn:vec(),shift:vec(-.014,.023,-.043),jointAxis:axis};
 const apply=buildKinematics([item],[],[],null,0,true,{travel:26,jointTwist:18},()=>{},{id:'hip-dislocation',variant:0});
 apply(1,false);
 assert.ok(Math.abs(item.pivot.position.distanceTo(a)-.026)<1e-12);
 assert.ok(Math.abs(item.pivot.quaternion.angleTo(new T.Quaternion())*180/Math.PI-18)<1e-8);
 assert.ok(axis.clone().applyQuaternion(item.pivot.quaternion).distanceTo(axis)<1e-12);
}));
