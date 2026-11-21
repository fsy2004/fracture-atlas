import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {panesFor,recallItem,drawDesk} from '../study-layouts.js';

test('wide and narrow orthographic panes have equal scale, fit the host and do not overlap',()=>{
 for(const [w,h] of [[900,600],[360,460]]){
  const [a,b]=panesFor('pair',w,h);
  assert.equal(a.w,b.w);assert.equal(a.h,b.h);
  assert.ok(a.x+a.w<=b.x||a.y+a.h<=b.y);
  assert.equal(b.x+b.w,w);assert.equal(b.y+b.h,h);
 }
});

function makePanel(){
 const fields=new Map();
 return {style:{},querySelector(k){
  if(!fields.has(k))fields.set(k,{style:{},textContent:'old'});
  return fields.get(k);
 },querySelectorAll(){return [this.querySelector('svg'),this.querySelector('svg.rotation')];}};
}

test('reference frames reset previous overlays and restore the live model last',()=>{
 const recorded=[],panels=[makePanel(),makePanel(),makePanel()];
 const camera=new T.PerspectiveCamera(38,1,.001,30);camera.position.set(.2,0,1);
 const renderer={setScissorTest(){},setViewport(){},clear(){},setScissor(){},render(){}};
 drawDesk({desk:'story',renderer,world:new T.Scene(),camera,target:new T.Vector3(),
  host:{clientWidth:800,clientHeight:640,style:{setProperty(){}}},panels,time:.7,
  pose:(t,report)=>recorded.push([t,report]),label(){}});
 assert.deepEqual(recorded,[[0,false],[1,false],[.7,true]]);
 for(const p of panels.slice(1)){
  assert.equal(p.querySelector('.components').textContent,'');
  assert.ok(p.querySelectorAll().every(e=>e.style.display==='none'));
 }
 assert.deepEqual(renderer.clippingPlanes,[]);
});

test('direction feedback follows the configured displacement, including zero',()=>{
 for(const id of ['radius','hip-dislocation','elbow-dislocation']){
  const c={id},v={observe:'示例'};
  assert.equal(recallItem(c,0,v,null,new T.Vector3()).correct,2);
  assert.equal(recallItem(c,0,v,null,new T.Vector3(0,0,-.02)).correct,0);
 }
 assert.equal(recallItem({id:'radius'},1,{},null,new T.Vector3(0,0,.01)).correct,1);
});
