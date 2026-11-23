import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {anatomyFor} from '../anatomy-data.js';
import {canonicalCourse,variantIndex} from '../variant-registry.js';
import {examPoints} from '../exam-points.js';
import {courses} from '../courses.js';
import {joints} from '../joints.js';
import {regionalCourses} from '../regional-courses.js';
import {supplementalCourses} from '../supplemental.js';

test('every indexed bone has distinct anatomy terms and descriptions',()=>{
 const catalogue=JSON.parse(readFileSync(new URL('../models/index.json',import.meta.url),'utf8'));
 for(const bone of catalogue){
  const anatomy=anatomyFor(bone.name);
  assert.ok(anatomy?.summary&&anatomy.marks.length>=2,bone.name);
  assert.equal(new Set(anatomy.marks.map(mark=>mark.name)).size,anatomy.marks.length,bone.name);
  assert.ok(anatomy.marks.every(mark=>mark.name.trim()&&mark.detail.trim()),bone.name);
 }
});

test('saved IDs, old numeric links and exam notes survive a reorder of authored variants',()=>{
 for(const input of [...courses,...joints,...regionalCourses,...supplementalCourses]){
  const normal=canonicalCourse(input);
  const reordered=canonicalCourse({...input,variants:[...input.variants].reverse()});
  assert.deepEqual(reordered.variants,normal.variants);
  const points=new Set();
  for(const [legacy,variant] of normal.variants.entries()){
   const keyed=variantIndex(reordered,variant.id);
   assert.equal(keyed,variantIndex(normal,String(legacy)));
   const card=examPoints(reordered,keyed);
   assert.deepEqual(card,examPoints(normal,legacy));
   for(const point of card.points){
    assert.ok(!points.has(point),normal.id+'/'+variant.id+' duplicated an exam point');
    points.add(point);
   }
  }
 }
});
