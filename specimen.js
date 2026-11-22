import * as T from './vendor/three.module.js';
import {inReflectedFrame} from './detail.js';

const supported=new Set(['tibia','femur','patella','clavicle','intercondylar','distalfemur']);
const opposite=name=>name.replace(/left|right/i,s=>({Left:'Right',Right:'Left',left:'right',right:'left'}[s]));
function localContext(course,v){
 const context=v.context||course.context||[];
 if(course.id==='scaphoid')return ['Right lunate','Right capitate','Right trapezium','Right trapezoid'];
 if(course.id==='region-scapula')return ['Right clavicle'];
 if(course.id==='region-atlas')return ['Axis'];
 if(course.id==='region-mandible')return [];
 if(course.id==='region-body-l5')return context.filter(name=>name!=='Sacrum');
 return context;
}
export function specimenLibrary(read){
 const native=new Map(),mirrors=new WeakMap(),pending=new Map();let entries=new Map();
 async function load(name){
  if(native.has(name))return;
  if(!pending.has(name))pending.set(name,(async()=>{
   const e=entries.get(name),res=await read('models/vhm/'+e.file);
   if(!res.ok)throw Error('无法读取标本 '+name);
   const input=await res.arrayBuffer(),bytes=new Uint8Array(input);
   const raw=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():input;
   if(raw.byteLength!==e.vertices*12+e.indices*4)throw Error('标本文件长度错误');
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(raw,0,e.vertices*3),3));
   g.setIndex(new T.BufferAttribute(new Uint32Array(raw,e.vertices*12,e.indices),1));
   g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.specimen=true;
   if(e.head_center_m)g.userData.headCentre=new T.Vector3(...e.head_center_m);
   native.set(name,g);
  })().finally(()=>pending.delete(name)));
  await pending.get(name);
 }
 return {
  async init(){const r=await read('models/vhm/manifest.json');if(!r.ok)throw Error('标本目录载入失败');entries=new Map((await r.json()).entries.map(e=>[e.name,e]));},
  has:name=>entries.has(name),context:localContext,
  required(selected,course,v){
   if(!selected)return [];
   if(!v)return entries.has(selected)?[selected]:[];
   if(course.id==='hip-dislocation'&&v===course.variants[1]){
    const names=['Right femur','Right hip bone'].map(n=>/left/i.test(selected)?opposite(n):n);
    return names.every(n=>entries.has(n))?names:[];
   }
   // Fractional cuts transfer to the selected bone. Absolute anchors, compound joint
   // courses and unrepresented adjacent bones must keep their original complete specimen.
   const localSupplement=course.id.startsWith('region-')&&!(course.id==='region-mandible'&&v===course.variants[1]);
   const family=course.family||course.id;
   if(!supported.has(course.id)&&!localSupplement&&!['spine','metatarsal','rib','calcaneus','talus','metacarpal','scaphoid'].includes(family))return [];
   if(v.cuts.some(s=>s.anchor||s.pivot)||v.focus||v.moving)return [];
   const keys=new Set([...v.cuts.map(s=>s.bone),...localContext(course,v)]);
   if(course.id==='patella')keys.add('Right femur');
   if(course.sourceBone)keys.add(course.sourceBone);
   const names=[...keys].map(n=>/left/i.test(selected)?opposite(n):n);
   if(!names.every(n=>entries.has(n)))return [];
   return new Set(names.map(n=>entries.get(n).group)).size===1?names:[];
  },
  load:names=>Promise.all(names.map(load)),ready:names=>names.every(n=>native.has(n)),
  trim(active){
   for(const key of active)if(native.has(key)){const g=native.get(key);native.delete(key);native.set(key,g);}
   while(native.size>Math.max(16,active.length)){
    const [key,g]=native.entries().next().value;mirrors.get(g)?.dispose();mirrors.delete(g);native.delete(key);g.dispose();
   }
  },get(name,mirror){const g=native.get(mirror?opposite(name):name);if(!g||!mirror)return g;
   if(!mirrors.has(g))mirrors.set(g,inReflectedFrame(g));return mirrors.get(g);
  },faces:names=>names.reduce((sum,n)=>sum+entries.get(n).triangles,0)
 };
}
