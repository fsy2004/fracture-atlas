import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {correctGroup} from '../fragment-motion.js';
import {courses} from '../courses.js';
import {regionalCourses} from '../regional-courses.js';
import {supplementalCourses} from '../supplemental.js';
import {joints} from '../joints.js';
import {teachingBone} from '../bone-index.js';
import fs from 'node:fs';
const V=(...c)=>new T.Vector3(...c);
test('signed fragment edits preserve follower distance, use the posed rim as pivot, and mirror patient directions',()=>{
 for(const mirror of [true,false]){
  const a={anchor:V(.12,.86,.01),pivot:new T.Group()},b={anchor:V(.13,.84,.015),pivot:new T.Group()};
  const centre=V(.12,.853,.011);
  for(const i of [a,b])i.pivot.position.copy(i.anchor);
  const original=a.pivot.position.distanceTo(b.pivot.position);
  const edit={dx:4,dy:-2,dz:6,rx:0,ry:12,rz:0};
  correctGroup([a,b],centre,edit,0,mirror);
  assert.ok(a.pivot.position.distanceTo(a.anchor)<1e-12);
  correctGroup([a,b],centre,edit,1,mirror);
  const final=centre.clone().sub(a.anchor).applyQuaternion(a.pivot.quaternion).add(a.pivot.position);
  assert.ok(final.distanceTo(centre.clone().add(V(mirror?-.004:.004,-.002,.006)))<1e-12);
  assert.ok(Math.abs(a.pivot.position.distanceTo(b.pivot.position)-original)<1e-12);
  assert.ok(Math.abs(b.pivot.quaternion.y-Math.sin((mirror?-1:1)*Math.PI/30))<1e-12);
 }
});
test('regional lessons reference distinct native bones with matching adjacent anatomy',()=>{
 const index=JSON.parse(fs.readFileSync(new URL('../models/index.json',import.meta.url),'utf8'));
 const names=new Set();
 for(const m of index)names.add(names.has(m.name)?m.name+' '+m.mesh:m.name);
 const all=[...courses,...regionalCourses,...supplementalCourses,...joints];
 assert.equal(new Set(all.map(c=>c.id)).size,all.length);
 for(const c of regionalCourses)for(const v of c.variants){
  assert.ok(names.has(c.sourceBone));
  assert.ok(v.cuts.every(s=>s.bone!==c.sourceBone&&names.has(s.bone)));
  assert.ok(v.context.every(n=>names.has(n)&&!v.cuts.some(s=>s.bone===n)));
 }
 const linked=new Set(all.filter(c=>c.kind!=='joint').flatMap(c=>c.variants.flatMap(v=>v.cuts.map(s=>s.bone))));
 assert.equal(names.size,201);
 for(const name of names)assert.ok(linked.has(teachingBone(name)),name);
 for(const c of all)for(const v of c.variants)for(const name of [...(v.context||c.context||[]),...(v.fixed||[]),...(v.jointFollowers||[]),...v.cuts.map(s=>s.bone)])assert.ok(names.has(name),c.id+' / '+name);
});
