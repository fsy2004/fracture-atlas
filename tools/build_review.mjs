// Refresh the source map from the same case definitions used by the viewer.
import {writeFileSync} from 'node:fs';
import {courses} from '../courses.js';
import {regionalCourses} from '../regional-courses.js';
import {supplementalCourses} from '../supplemental.js';
import {joints} from '../joints.js';
const rows=[];
for(const [kind,list] of [['教材分型示例',courses],['同类部位实例',regionalCourses],['部位补充形态',supplementalCourses],['成人关节脱位',joints]]){
 for(const c of list)for(const [i,v] of c.variants.entries()){
  rows.push({route:'#'+c.id+'/'+i+'/1',scope:kind,site:c.name,pattern:v.name,
   reference:v.source||c.reference||c.source||(kind==='成人关节脱位'?'教材第七章 · '+c.name:''),
   affected:v.cuts.map(s=>s.bone),fixed:v.fixed||[],observation:v.observe});
 }
}
writeFileSync(new URL('../review/catalog.json',import.meta.url),JSON.stringify(rows,null,2)+'\n');
console.log(rows.length+' case entries');
