import {fractureProfile,fractureRelief} from '../fracture-surface.js';
import {injuryTime} from '../injury-timing.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three.module.js';
import {section} from '../geometry.js';
import {createWedgePose} from '../wedge.js';

test('each enhanced bone retains its recorded original triangle count and native scale',()=>{
 const dir=new URL('../models/vhm/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',dir)));
 for(const e of manifest.entries){
  const raw=gunzipSync(readFileSync(new URL(e.file,dir)));
  assert.equal(createHash('sha256').update(raw).digest('hex'),e.packed_raw_sha256,e.name);
  assert.equal(raw.length,e.vertices*12+e.triangles*12);
 }
});
test('external-rotation tibial morphology ascends laterally and closes on the posterior cortex',()=>{
 const g=new T.CylinderGeometry(.016,.016,.20,96,8);
 const cut=section(g,[0,1,0],[0,0,0],0,.05,[0,1,0],Infinity,true);
 const points=cut[0].outline.attributes.position,high=[],low=[],medial=[],lateral=[];
 for(let k=0;k<points.count;k++){
  const x=points.getX(k),y=points.getY(k),z=points.getZ(k);
  if(y>.022)high.push(z);if(y<-.022)low.push(z);
  if(x>.0159)medial.push(y);if(x<-.0159)lateral.push(y);
 }
 for(const group of [high,low,medial,lateral])assert.ok(group.length);
 assert.ok(Math.max(...high,...low)<-.012);
 assert.ok(Math.max(...medial)<Math.min(...lateral));
});
test('the wedge follows proximal rotation around the hip rather than pivoting at the incision',()=>{
 const part=(x,y)=>({shell:true,pivot:new T.Group(),anchor:new T.Vector3(x,y,0),shift:new T.Vector3(),turn:new T.Vector3()});
 const a=part(0,0),chip=part(0,0),p=part(0,.12);p.turn.set(-.11,-.12,-.1);a.shift.set(.02,.01,-.008);
 const apply=createWedgePose([a,chip,p]);apply(1,0,0);
 for(const b of [a,chip,p])assert.ok(b.anchor.distanceTo(b.pivot.position)<1e-12&&Math.abs(b.pivot.quaternion.w-1)<1e-12);
 apply(1);assert.ok(chip.pivot.quaternion.angleTo(p.pivot.quaternion)<1e-8);
 const point=chip.anchor.clone().sub(p.anchor).applyQuaternion(p.pivot.quaternion).add(p.pivot.position);
 assert.ok(Math.abs(point.distanceTo(chip.pivot.position)-.003)<1e-10);
});

test('both interlocking faces use the same nonplanar relief and opposing winding',()=>{
 const g=new T.CylinderGeometry(.015,.015,.14,72,6),profile=fractureProfile(.030,17);
 const halves=section(g,[0,1,0],[0,0,0],0,0,[0,1,0],Infinity,false,profile);
 const a=halves[0].face.attributes.position,b=halves[1].face.attributes.position;
 assert.ok(a.count>60);let lo=Infinity,hi=-Infinity;
 for(let i=0;i<a.count;i++){
  const j=i-i%3+[0,2,1][i%3];
  for(const get of ['getX','getY','getZ'])assert.ok(Math.abs(a[get](i)-b[get](j))<1e-9);
  const h=a.getY(i);lo=Math.min(h,lo);hi=Math.max(h,hi);
  assert.ok(Math.abs(h-fractureRelief(a.getZ(i),a.getX(i),profile))<2e-7);
 }
 assert.ok(hi-lo>.001);
});
test('the replay clock holds initial alignment then resolves initial release and late drift',()=>{
 for(const kind of ['fracture','joint']){
  assert.equal(injuryTime(0,kind),0);assert.equal(injuryTime(1,kind),1);let last=0;
  for(let i=1;i<=500;i++){const t=injuryTime(i/500,kind);assert.ok(t>=last);last=t;}
 }
 assert.equal(injuryTime(.1,'fracture'),0);
 assert.ok(injuryTime(.23,'fracture')-injuryTime(.15,'fracture')>.35);
});
