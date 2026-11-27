import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../vendor/three.module.js';
import {anatomyFor} from '../anatomy-data.js';
import {guidesFor} from '../anatomy-panel.js';
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
   assert.match(variant.id,/^v[0-9]{2}$/);
   const keyed=variantIndex(reordered,variant.id);
   assert.equal(keyed,variantIndex(normal,String(legacy)));
   const card=examPoints(reordered,keyed);
   assert.deepEqual(card,examPoints(normal,legacy));
   assert.ok(card.points.length>=2&&card.points.length<=3);
   for(const point of card.points){
    assert.ok(!points.has(point),normal.id+'/'+variant.id+' duplicated an exam point');
    points.add(point);
   }
  }
 }
});

test('midline mandible landmarks place left ramus at +X and right ramus at -X, and triquetral is ulnar/medial',()=>{
 const geo=new T.BoxGeometry(0.12,0.08,0.10);
 geo.computeBoundingBox();
 const guides=guidesFor('Mandible',geo);
 const leftRamus=guides.find(g=>g.text==='左下颌支区');
 const rightRamus=guides.find(g=>g.text==='右下颌支区');
 assert.ok(leftRamus&&rightRamus,'Mandible should include left and right ramus landmarks');
 assert.ok(leftRamus.point.x>0,`左下颌支区 should be at +X (patient left), got ${leftRamus.point.x}`);
 assert.ok(rightRamus.point.x<0,`右下颌支区 should be at -X (patient right), got ${rightRamus.point.x}`);

 for(const side of ['Right','Left']){
  const tri=anatomyFor(`${side} triquetral`);
  assert.ok(!tri.summary.includes('月骨外侧'),'triquetral must not claim lateral to lunate');
  assert.match(tri.summary,/内侧|尺侧/);
 }
});
