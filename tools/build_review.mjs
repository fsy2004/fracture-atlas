// Refresh the source map from the same case definitions used by the viewer.
import {writeFileSync} from 'node:fs';
import {canonicalCourse} from '../variant-registry.js';
import {injuryDescription} from '../injury-description.js';
import {lessonNote,examPoints} from '../exam-points.js';
import {courses} from '../courses.js';
import {regionalCourses} from '../regional-courses.js';
import {supplementalCourses} from '../supplemental.js';
import {joints} from '../joints.js';
const rows=[];
for(const [kind,list] of [['教材分型示例',courses],['同类部位实例',regionalCourses],['部位补充形态',supplementalCourses],['成人关节脱位',joints]]){
 for(const c of list.map(canonicalCourse))for(const [i,v] of c.variants.entries()){
  const note=lessonNote(c,i);
  if(!note?.locator?.trim()||note.points.length!==2||note.points.some(line=>!line?.trim())){
   throw Error('Incomplete textbook card for '+c.id+'/'+i);
  }
  const exam=examPoints(c,i);
  if(exam.points.length<2||exam.points.length>3||exam.points.some(p=>/教材|图[0-9]-|undefined/.test(p)))throw Error('Invalid exam points: '+c.id+'/'+i);
  const description=injuryDescription(c,i);
  if(!description.site||!description.motion||c.kind!=='joint'&&!description.form)throw Error('Incomplete injury description '+c.id+'/'+v.id);
  const reference=v.source||c.reference||c.source||(kind==='成人关节脱位'?'教材第七章 · '+c.name:'');
  rows.push({variantId:v.id,description,cardReference:note.locator,cardScope:note.supplement?'教材通则与补充形态对照':'教材部位要点',route:'#'+c.id+'/'+v.id+'/1',legacyRoute:'#'+c.id+'/'+i+'/1',scope:reference.startsWith('AO')?'AO 补充鉴别':v.child||v.pulledElbow?'教材儿童解剖示意':kind,site:c.name,pattern:v.name,
   reference,...(v.related?{related:v.related.map(id=>'#'+id+'/v01/1')}:{}),
   affected:v.cuts.map(s=>s.bone),fixed:v.fixed||[],observation:v.observe});
 }
}
writeFileSync(new URL('../review/catalog.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
console.log(rows.length+' case entries');
