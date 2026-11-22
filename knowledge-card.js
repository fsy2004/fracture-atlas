import {fractureNote} from './fracture-notes.js';
import {regionalNote} from './regional-notes.js';

export function lessonNote(course,index){
 const variant=course?.variants?.[index];if(!variant)return null;
 const note=fractureNote(course,index)||regionalNote(course,index);
 if(!note)return null;
 return {...note,supplement:Boolean(note.supplement||course.id==='plateau'&&variant.depression)};
}
let displayed='';
export function showKnowledgeCard(course,index,custom=false){
 const box=document.getElementById('knowledgeCard'),key=course&&index>=0?course.id+'/'+index+'/'+custom:'';
 if(key===displayed)return;displayed=key;
 const note=lessonNote(course,index);box.hidden=!note;
 if(!note)return;
 document.getElementById('knowledgeTitle').textContent=note.supplement?'教材对照':'教材要点';
 document.getElementById('knowledgeCase').textContent=course.name+' · '+course.variants[index].name+(custom?' · 原分型要点':'');
 const list=document.getElementById('knowledgePoints');
 list.replaceChildren(...note.points.map(point=>{const line=document.createElement('li');line.textContent=point;return line;}));
}
