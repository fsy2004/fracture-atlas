import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {correctGroup} from '../fragment-motion.js';
import {surfacePoint} from '../surface-ruler.js';
import {courses} from '../courses.js';
import {regionalCourses} from '../regional-courses.js';
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
test('a ruler point remains attached through rigid movement and vertebral morphing',()=>{
 const geo=new T.BufferGeometry(),vertices=[0,0,0,1,0,0,0,1,0];
 geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 geo.morphAttributes.position=[new T.Float32BufferAttribute([0,0,0,0,0,0,0,-.2,0],3)];
 geo.morphTargetsRelative=true;
 const mesh=new T.Mesh(geo);
 const point=surfacePoint({object:mesh,point:V(.25,.5,0),face:{a:0,b:1,c:2}});
 mesh.position.set(.1,0,0);mesh.morphTargetInfluences[0]=1;
 assert.ok(point().distanceTo(V(.35,.4,0))<1e-7);
});
test('regional lessons reference distinct native bones with matching adjacent anatomy',()=>{
 const index=JSON.parse(fs.readFileSync(new URL('../models/index.json',import.meta.url),'utf8'));
 const names=new Set(index.map(m=>m.name));
 const all=[...courses,...regionalCourses,...joints];
 assert.equal(new Set(all.map(c=>c.id)).size,all.length);
 for(const c of regionalCourses)for(const v of c.variants){
  assert.ok(names.has(c.sourceBone));
  assert.ok(v.cuts.every(s=>s.bone!==c.sourceBone&&names.has(s.bone)));
  assert.ok(v.context.every(n=>names.has(n)&&!v.cuts.some(s=>s.bone===n)));
 }
 const linked=new Set(all.flatMap(c=>c.variants.flatMap(v=>[...v.cuts.map(s=>s.bone),...(v.fixed||[])])));
 assert.equal(index.filter(m=>linked.has(teachingBone(m.name))).length,73);
});
