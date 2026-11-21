import {courses} from './courses.js';

// Only transfer lessons defined by fractional bone position, with a matching anatomical mechanism.
// Anchored or multi-bone injury patterns need their own landmarks and are not transferred here.
const extra=[];
function bind(id,suffix,bone,title,context){
 const template=courses.find(c=>c.id===id);
 const original=template.variants[0].cuts[0].bone;
 const variants=template.variants.map(v=>{
  const observe=v.observe.replace(/以右侧第二跖骨为例，|以右示指近节骨干为例，|本例选取右拇趾近节。|以右第六肋为例，/g,'')
   .replace('第一腰椎',title);
  return {...v,observe,context,span:undefined,cuts:v.cuts.map(s=>({...s,bone}))};
 });
 extra.push({...template,id:id+'-'+suffix,family:id,sourceBone:original,name:title,context,span:undefined,variants});
}
const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
for(const i of [3,4,6,7,8]){
 const rib=j=>'Right '+ordinals[j]+' rib';
 bind('rib',ordinals[i],rib(i),'第'+(i+1)+'肋骨',[rib(i-1),rib(i+1)]);
}
for(const i of [2,3]){
 const met=j=>'Right '+ordinals[j]+' metatarsal bone';
 bind('metatarsal',ordinals[i],met(i),'第'+(i+1)+'跖骨',[met(i-1),met(i+1)]);
}
for(const [digit,title] of [['middle','中指'],['ring','环指'],['little','小指']]){
 bind('finger',digit,'Proximal phalanx of right '+digit+' finger',title+'近节指骨',['Right '+({middle:'third',ring:'fourth',little:'fifth'}[digit])+' metacarpal bone']);
}
for(const [digit,title] of [['second','第二趾'],['third','第三趾'],['fourth','第四趾'],['little','第五趾']]){
 bind('toes',digit,'Proximal phalanx of right '+digit+' toe',title+'近节趾骨',['Right '+(digit==='little'?'fifth':digit)+' metatarsal bone']);
}
for(const [slug,name,title,above,below] of [
 ['t11','Eleventh thoracic vertebra','第十一胸椎','Tenth thoracic vertebra','Twelfth thoracic vertebra'],
 ['t12','Twelfth thoracic vertebra','第十二胸椎','Eleventh thoracic vertebra','First lumbar vertebra'],
 ['l2','Second lumbar vertebra','第二腰椎','First lumbar vertebra','Third lumbar vertebra']
])bind('spine',slug,name,title,[above,below]);
export const regionalCourses=extra;
