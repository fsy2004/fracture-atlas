import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {contactBody,penetration,makeContactSet,firstLimit} from '../contact.js';
import {cableRatio} from '../mechanics.js';
function cube(size=1){
 const parent=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(size,size,size));
 parent.add(mesh);parent.updateMatrixWorld(true);
 const body=contactBody(mesh,null,'cube');body.active=true;body.sync();return body;
}
function move(body,x){
 body.mesh.parent.position.x=x;body.mesh.parent.updateMatrixWorld(true);body.sync();
}
test('disjoint, tangential and coincident surfaces differ from newly intersecting solids',()=>{
 const a=cube(),b=cube();
 for(const [x,expected] of [[1.2,false],[1,false],[.96,true],[.2,true],[0,true]]){
  move(b,x);assert.equal(!!penetration(a,b),expected,'offset '+x);
 }
 const inner=cube(.1);assert.ok(penetration(a,inner));
 move(b,1);const set=makeContactSet([a,b]);assert.equal(set.check(),null);
 move(b,1.1);assert.equal(set.check(),null);move(b,.98);assert.equal(set.check().kind,'bone');
});
test('a pre-existing overlap is not reported as a new crossing in the unchanged pose',()=>{
 const a=cube(),b=cube();move(b,.97);const set=makeContactSet([a,b]);
 assert.equal(set.check(),null);
 move(b,.2);assert.ok(set.check());
 move(b,1.01);assert.equal(set.check(),null);
});
test('sample and refine finds the first observed contact on the path and preserves free motion',()=>{
 const a=cube(),b=cube();move(b,1.3);const set=makeContactSet([a,b]);
 const found=firstLimit(t=>{move(b,1.3-.6*t);return set.check();});
 assert.equal(found.reason.kind,'bone');assert.ok(Math.abs(found.time-.5)<.003);
 assert.deepEqual(firstLimit(()=>null),{time:1,reason:null});
 const start=new T.Vector3(),endpoint=new T.Vector3(1,0,0);
 const held=firstLimit(t=>{endpoint.x=1+t*.2;return cableRatio(start,endpoint,1)>1.1?'band':null;});
 assert.equal(held.reason,'band');assert.ok(Math.abs(held.time-.5)<.001);
});
