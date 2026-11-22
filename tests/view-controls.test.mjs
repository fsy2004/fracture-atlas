import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {turnView} from '../view-controls.js';

test('vertical drags cross both poles, with horizontal rotation still available',()=>{
 const target=new T.Vector3(-.04,.8,.01),camera=new T.PerspectiveCamera();
 camera.position.copy(target).add(new T.Vector3(0,0,.4));camera.lookAt(target);
 const direction=()=>camera.position.clone().sub(target).normalize();
 for(let quarter=0;quarter<4;quarter++){
  const before=direction();
  turnView(camera,target,0,100,400,true);
  assert.ok(Math.abs(direction().angleTo(before)-Math.PI/2)<1e-8);
  const after=direction();
  turnView(camera,target,25,0,400,true);
  assert.ok(direction().angleTo(after)>.35);
  turnView(camera,target,-25,0,400,true);
  assert.ok(direction().distanceTo(after)<1e-8);
  assert.ok(Math.abs(camera.position.distanceTo(target)-.4)<1e-8);
 }
 assert.ok(direction().distanceTo(new T.Vector3(0,0,1))<1e-8);
 assert.ok(camera.up.distanceTo(new T.Vector3(0,1,0))<1e-8);
});
