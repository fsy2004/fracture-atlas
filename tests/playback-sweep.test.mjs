import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {buildMechanics} from '../mechanics.js';

function crossing(){
 const world=new T.Scene(),group=new T.Group(),move=new T.Group();world.add(group);group.add(move);
 const box=name=>{const m=new T.Mesh(new T.BoxGeometry(.02,.02,.02));m.userData.bone=name;return m;};
 move.add(box('Right tibia'));group.add(box('Right femur'));
 const pose=t=>{move.position.x=.08-.1*t;};
 const mechanics=buildMechanics({group,world,items:[],wedges:[],nearBones:[],course:{id:'test'},
  variant:{cuts:[{bone:'Right tibia'}],fixed:['Right femur']},ghostMaterial:null,mirror:false,pose,timing:'fracture'});
 return {mechanics,pose};
}
const opts={checkBones:true,limitBones:true,hold:false,draw:false,slack:0};

test('incremental playback checks every sweep/refinement step and returns the same contact limit',()=>{
 const a=crossing(),b=crossing();
 const expected=a.mechanics.limit(1,opts,'case');
 let result,calls=0;
 do{
  result=b.mechanics.limit(1,opts,'case',0);calls++;
  b.pose(result.time);assert.notEqual(b.mechanics.report(result.time,opts,true).bone?.kind,'bone');
  assert.ok(calls<512);
 }while(result.unfinished);
 assert.ok(calls>10);assert.equal(result.time,expected.time);assert.equal(result.reason.name,expected.reason.name);
 a.mechanics.dispose();b.mechanics.dispose();
});

test('a seek or a new parameter key cancels partial playback work',()=>{
 const {mechanics}=crossing();
 const first=mechanics.limit(1,opts,'a',0);assert.ok(first.unfinished);
 assert.equal(mechanics.limit(0,opts,'a').time,0);
 const next=mechanics.limit(.36,opts,'b');assert.equal(next.time,.36);assert.equal(next.reason,null);
 const stop=mechanics.limit(1,opts,'b');assert.ok(stop.reason);assert.ok(stop.time<1);
 mechanics.dispose();
});
