import * as T from './vendor/three.module.js';
import {elbowDisplayGeometry} from './elbow-specimen.js';
import {inReflectedFrame} from './detail.js';

const opposite=name=>name.replace(/left|right/i,s=>({Left:'Right',Right:'Left',left:'right',right:'left'}[s])).replace(/FJ(3270|3376)$/,(_,id)=>id==='3270'?'FJ3376':'FJ3270');
const fractionCourses=new Set(['radius','tibia','femur','humerus','patella','clavicle','intercondylar','distalfemur','spine','metatarsal','rib','calcaneus','talus','metacarpal','scaphoid','finger','toes','forearm','galeazzi','single-forearm','olecranon','radial-head']);
const regions={
 'maxilla':['vk-head|Bilateral maxilla','双侧上颌骨'],
 'nasal bone':['vk-head|Bilateral nasal bone','双侧鼻骨'],
 'parietal bone':['vk-head|Bilateral parietal bone','双侧顶骨'],
 'palatine bone':['halle-male-palate|Posterior hard palate region','后部硬腭与鼻腔外侧壁'],
 'manubrium':['axial|Whole sternum','胸骨整体'],'body of sternum':['axial|Whole sternum','胸骨整体'],'xiphoid process':['axial|Whole sternum','胸骨整体'],
 'sacrum':['axial|Sacrum and coccyx','骶尾部整体']
};
function localContext(c,v){
 const context=v.context||c.context||[];
 if(c.id==='scaphoid')return ['Right lunate','Right capitate','Right trapezium','Right trapezoid'];
 if(c.id==='region-palatine')return ['Posterior hard palate region'];
 if(c.id==='region-manubrium')return ['Body of sternum'];
 if(c.id==='region-sacrum')return ['Fifth lumbar vertebra'];
 if(c.id==='region-scapula')return ['Right clavicle'];
 if(c.id==='region-atlas')return ['Axis'];
 if(c.id==='region-mandible'&&v===c.variants[0])return [];
 if(c.id==='region-body-l5')return context.filter(n=>n!=='Sacrum');

 return context;
}
export function specimenLibrary(read){
 const entries=new Map(),named=new Map(),native=new Map(),mirrors=new WeakMap(),pending=new Map(),active=new Map();
 function register(e){
  entries.set(e.key,e);
  if(!named.has(e.name))named.set(e.name,[]);
  named.get(e.name).push(e);
 }
 function resolve(name){return named.get(name)?.find(e=>e.role!=='context');}
 let canals={},transforms={};
 let elbowView=false,shoulderView=false;const elbowMeshes=new WeakMap(),shoulderMeshes=new WeakMap();
 async function load(key){
  if(native.has(key))return;
  if(!pending.has(key))pending.set(key,(async()=>{
   const e=entries.get(key),res=await read(e.base+e.file);
   if(!res.ok){
    const error=Error('无法读取标本 '+e.name);
    error.offlineMissing=res.headers.get('X-Atlas-Offline-Miss')==='1';
    throw error;
   }
   const input=await res.arrayBuffer(),bytes=new Uint8Array(input);
   const raw=bytes[0]===31&&bytes[1]===139?await new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():input;
   if(raw.byteLength!==e.vertices*12+e.indices*4)throw Error('标本文件长度错误');
   const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(raw,0,e.vertices*3),3));
   g.setIndex(new T.BufferAttribute(new Uint32Array(raw,e.vertices*12,e.indices),1));
   if(e.face_confidence){
    const response=await read(e.base+e.face_confidence);if(!response.ok)throw Error('腭骨分区记录载入失败');
    const packed=await response.arrayBuffer();
    const flags=new Uint8Array(new Uint8Array(packed)[0]===31?await new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():packed);
    if(flags.length!==e.triangles||e.oralTrace.mesh_sha256!==e.sha256||e.oralTrace.source_triangle_ids.some(i=>flags[i]!==0))throw Error('腭骨分区与局部观察点不匹配');
    const ordered=new Uint32Array(e.indices),src=g.index.array;let at=0;
    for(const cls of [0,1,2]){const start=at;for(let i=0;i<flags.length;i++)if(flags[i]===cls){ordered.set(src.subarray(i*3,i*3+3),at);at+=3;}g.addGroup(start,at-start,cls);}
    if(at!==e.indices)throw Error('未知腭骨表面类别');
    g.setIndex(new T.BufferAttribute(ordered,1));g.userData.oralTrace=e.oralTrace;
   }
   g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.specimen=true;
   if(e.head_center_m)g.userData.headCentre=new T.Vector3(...e.head_center_m);
   if(e.digit)g.userData.digit=e.digit;
   if(e.base==='models/vhm/'&&canals[e.name])g.userData.endosteum={rows:canals[e.name],transform:transforms[e.group]};
   g.userData.group=e.group;native.set(key,g);
  })().finally(()=>pending.delete(key)));
  await pending.get(key);
 }
 function together(names){
  const choices=named.get(names[0])||[];
  for(const first of choices){
   const set=names.map(n=>named.get(n)?.find(e=>e.group===first.group));
   if(set.every(Boolean))return set.map(e=>e.key);
  }
  return [];
 }
 return {
  async init(){
   const manifests=await Promise.all(['models/vhm/manifest.json','models/extended/manifest.json','models/extended/canal.json'].map(async path=>{
    const r=await read(path);if(!r.ok)throw Error('标本目录载入失败');return r.json();
   }));
   canals=manifests[2].bones;transforms=manifests[0].groups;
   for(const e of manifests[0].entries)register({...e,key:e.name,base:'models/vhm/',label:'VHM 男性标本'});
   for(const e of manifests[1].entries)register({...e,base:'models/extended/',label:manifests[1].sources[e.collection].title});
  },
  has:name=>!!resolve(name),isAddition:name=>resolve(name)?.base==='models/extended/',context:localContext,
  region:name=>{const r=regions[(name||'').toLowerCase().replace(/^(left|right) /,'')];return r&&entries.has(r[0])?r:null;},
  fromKey:key=>native.get(key),
  required(selected,c,v){
   if(!selected)return [];
   if(!v){const e=resolve(selected);return e?.role==='estimate'?[e.key,'halle-male-palate|Posterior hard palate region']:e?[e.key]:[];}
   const side=n=>/left/i.test(selected)?opposite(n):n;
   if((c.id==='hip-dislocation'||c.id==='trochanter')&&v===c.variants[1])return together(['Right femur','Right hip bone'].map(side));
   if(c.id==='trochanter')return together(['Right femur'].map(side));
   if(c.id==='elbow')return together(['Right humerus'].map(side));
   if(c.id==='plateau'&&(v===c.variants[0]||v.depression))return together(['Right tibia','Right fibula'].map(side));
   if(c.id==='shoulder'&&(v===c.variants[0]||v===c.variants[1]))return together(['Right humerus','Right scapula'].map(side));
   if(['pip-dislocation','mcp-dislocation','mtp-dislocation','toe-ip-dislocation'].includes(c.id))
    return together([...new Set([...v.cuts.map(s=>s.bone),...v.fixed,...(v.jointFollowers||[])])].map(side));
   if(c.id==='shoulder-dislocation')return together(['Right humerus','Right scapula','Right clavicle'].map(side));
   if(c.id==='elbow-dislocation')return together(['Right ulna','Right radius','Right humerus'].map(side));
   if(c.id==='region-mandible'&&v===c.variants[1])return together(['Mandible','Right temporal bone','Left temporal bone'].map(side));
   if(c.id==='lunate-dislocation')return together([...new Set([...v.cuts.map(s=>s.bone),...v.fixed,...(v.context||[]),...(v.jointFollowers||[])])].map(side));
   if(c.id==='tmj-dislocation')return together(['Mandible','Right temporal bone','Left temporal bone'].map(side));
   if(!fractionCourses.has(c.family||c.id)&&!c.id.startsWith('region-'))return [];
   if(v.cuts.some(s=>s.pivot||(s.anchor&&c.id!=='radius'&&!(c.id==='radial-head'&&v===c.variants[2])))||v.focus||v.moving)return [];
   const names=new Set([...v.cuts.map(s=>s.bone),...localContext(c,v)]);
   if(c.id==='patella')names.add('Right femur');
   if(c.sourceBone)names.add(c.sourceBone);
   return together([...names].map(side));
  },
  label:keys=>{
   const e=entries.get(keys[0]);if(!e)return '';
   return e.label+(e.paired_source?' · 切片分侧，深部缝界推定':e.relation==='CT-referenced anatomical region'?' · 融合区分界推定':e.relation==='CT-referenced exclusion of coccyx'?' · 骶尾界按断层定位':'');
  },group:keys=>entries.get(keys[0])?.group,
  files:keys=>keys.flatMap(key=>{
   const e=entries.get(key);
   return e?[e.base+e.file,...(e.face_confidence?[e.base+e.face_confidence]:[])]:[];
  }),
  load:keys=>Promise.all(keys.map(load)),ready:keys=>keys.every(k=>native.has(k)),
  trim(keys,course){
   elbowView=course?.id==='elbow-dislocation';shoulderView=course?.id==='shoulder-dislocation';
   active.clear();
   for(const k of keys)if(native.has(k)){
    active.set(entries.get(k).name,k);const g=native.get(k);native.delete(k);native.set(k,g);
   }
   while(native.size>Math.max(16,keys.length)){
    const [k,g]=native.entries().next().value;
    for(const cache of [elbowMeshes,shoulderMeshes]){
     const local=cache.get(g);if(local){mirrors.get(local)?.dispose();mirrors.delete(local);local.dispose();cache.delete(g);}
    }
    mirrors.get(g)?.dispose();mirrors.delete(g);native.delete(k);g.dispose();
   }
  },
  get(name,mirror){
   const n=mirror?opposite(name):name,k=active.size?active.get(n):resolve(n)?.key;let g=native.get(k);
   if(g&&(elbowView||shoulderView)){
    const cache=shoulderView?shoulderMeshes:elbowMeshes;
    if(!cache.has(g))cache.set(g,elbowDisplayGeometry(g,/left/i.test(n)?'Left':'Right',shoulderView));
    g=cache.get(g);
   }
   if(!g||!mirror)return g;
   if(!mirrors.has(g))mirrors.set(g,inReflectedFrame(g));return mirrors.get(g);
  },
  faces:keys=>keys.reduce((s,k)=>s+entries.get(k).triangles,0)
 };
}
