import {levels} from './courses.js';
import {fractureNote} from './fracture-notes.js';
import {regionalNote} from './regional-notes.js';

// Explicitly named diseases in the relevant musculoskeletal syllabus. A named
// disease does not imply that every illustrated subtype is separately listed.
const namedSites=new Set(['radius','clavicle','rib','shoulder','humerus','elbow','forearm','neck','trochanter','femur','plateau','patella','tibia','ankle','spine','pelvis','shoulder-dislocation','hip-dislocation']);

const wrist=[
 ['跌倒时腕背伸。典型 Colles 骨折的远段向背侧、桡侧移位，可伴短缩。','侧面呈餐叉样畸形，正面可呈枪刺样畸形。侧位片看背倾，正位片看桡移。','与背侧 Barton 型鉴别时，看腕骨是否跟着一块关节缘骨片一起移动。'],
 ['屈腕位受伤可形成 Smith 骨折。远段向掌侧移位、掌倾。','侧位确定远段位于掌侧，可与远段背移的 Colles 骨折区分。','掌侧 Barton 型的断线进入关节缘，腕骨随缘骨片移位；本例为远段整体掌移。'],
 ['背侧 Barton 型是关节内骨折，断线分出桡骨远端的背侧缘。','侧位看近排腕骨与背侧缘骨片一起向背侧移，桡腕关节出现半脱位。','与 Colles 型鉴别要看哪部分关节面随行，仅凭背移方向不能区分。'],
 ['掌侧 Barton 型的断线进入桡腕关节面，分出掌侧缘骨片。','侧位看腕骨随掌侧缘骨片向掌侧移，剩余关节面仍与桡骨干相连。','与 Smith 型同为掌移。腕骨与掌侧缘骨片一同移位提示 Barton 型。']
];
const associations={
 clavicle:'比较内、外段与胸锁关节、肩锁关节的对位，确定损伤在骨干还是关节端。',
 shoulder:'外科颈附近有腋神经经过。合并腋神经损伤可出现肩外侧感觉减退和三角肌无力。',
 humerus:'桡神经经肱骨干后方的桡神经沟。中下段骨折出现垂腕时，应联想到桡神经损伤。',
 elbow:'髁上骨折时肘后三角通常保留。肘关节脱位时鹰嘴与肱骨内、外上髁的关系改变。',
 forearm:'两骨共同参与前臂旋转。辨认断线后还应比较桡、尺骨的长度和上下尺桡关节对位。',
 neck:'用断线位置命名头下、颈中和基底部；另外观察断端有无嵌插与移位。',
 trochanter:'在正面比较颈干角，颈干角减小提示髋内翻；沿骨干长轴的重叠提示短缩。',
 patella:'髌骨位于伸膝装置中。断块分离提示要检查主动伸膝功能。',
 ankle:'观察踝穴时以胫骨下关节面和两踝为边界，再看距骨有无倾斜或侧移。',
 plateau:'胫骨平台属于膝关节负重面。俯视定位内外髁，正面比较关节面的台阶与压陷。',
 femur:'描述侧移和短缩时以近段为参照。两段相互重叠会使股骨的有效长度缩短。',
 pelvis:'骨盆环损伤需同时看前环和后环。明显移位还应联想到盆腔出血。',
 spine:'比较椎体前、后缘及相邻终板。若后壁骨片突入椎管，应关注脊髓或神经根受累。',
 rib:'向胸腔内突出的断端可能损伤胸膜或肺，应联想到气胸或血胸。',
 'shoulder-dislocation':'盂肱对位丧失可呈方肩畸形。肩外侧皮肤感觉减退提示腋神经可能受累。',
 'elbow-dislocation':'屈肘约 90° 时，鹰嘴和肱骨内、外上髁构成肘后三角，脱位后关系可改变。',
 'knee-dislocation':'胫股关节脱位可合并腘动脉损伤，判断骨性对位时还需关注足部血运。',
 'lunate-dislocation':'侧位依次辨认桡骨、月骨和头状骨，先判断桡月关节是否仍然对合。',
 'patella-dislocation':'区分髌骨脱位和膝关节脱位，要分别检查髌股关节与胫股关节的对位。',
 'lisfranc-dislocation':'正面核对第二跖骨与中间楔骨的内侧缘，侧面观察跖骨基底有无背侧移位。',
 scaphoid:'舟骨近端血供更易受损。近端或腰部骨折需关注骨不连及近端缺血性坏死。',
 monteggia:'尺骨骨折合并桡骨头脱位是孟氏损伤。沿桡骨长轴观察其与肱骨小头的对线。',
 galeazzi:'桡骨干中下段骨折要连同腕端检查，留意下尺桡关节脱位；儿童可见相应骨骺损伤。',
 intercondylar:'断线通入膝关节，分别看髁间分离与负重关节面的平整度。',
 talus:'距骨颈骨折可损及距骨体血供。判断损伤时还应核对踝关节、距下关节的对位。'
};
const tibialLevels=[
 '上 1/3 接近腘动脉分叉区域。移位时除看骨轴，还应关注小腿和足部血运。',
 '中段骨干损伤应关注骨筋膜室综合征。疼痛进行性加重和被动牵伸痛是重要线索。',
 '中下段骨折易发生延迟愈合。读图还要检查远段旋转及踝关节对位。'
];
export function lessonNote(course,index){
 const variant=course?.variants?.[index];if(!variant)return null;
 const note=fractureNote(course,index)||regionalNote(course,index);
 if(!note)return null;
 return {...note,supplement:Boolean(note.supplement||course.id==='plateau'&&variant.depression)};
}
export function examPoints(course,index,level=1){
 const note=lessonNote(course,index);if(!note)return null;
 const family=course.family||course.id;
 let points=[...note.points];
 if(course.id==='radius')points=wrist[index].slice();
 else{
  // Put the selected anatomical example first for regional examples with a general comparison.
  if(note.supplement&&points[1].startsWith('本例'))points.reverse();
  const association=course.id==='tibia'?tibialLevels[level]:course.id==='hip-dislocation'?
   (index===0?'髋后脱位可伴坐骨神经损伤，需关注足、踝活动和感觉。':'鉴别髋前、后脱位时先辨股骨头相对髋臼的方向，再对照下肢旋转姿势。'):
   associations[family];
  if(association)points.push(association);
 }
 const regionalMatch=/^region-(?:rib-|body-[ctl]\d)/.test(course.id);
 return {points,extension:note.supplement||!(namedSites.has(family)||regionalMatch)};
}
let displayed;
export function showExamPoints(course,index,level,custom){
 const key=course?[course.id,index,course.levels?level:'',custom].join('/'):'';
 if(key===displayed)return;
 displayed=key;
 const section=document.getElementById('examPoints'),note=examPoints(course,index,level);
 section.hidden=!note;
 const list=document.getElementById('examList');
 if(!note){list.replaceChildren();document.getElementById('examCase').textContent='';return;}
 const context=[course.name,course.variants[index].name];
 if(course.levels)context.push(levels[level][0]);
 if(custom)context.push('典型表现');
 if(note.extension)context.push('读图延伸');
 document.getElementById('examCase').textContent=context.join(' · ');
 list.replaceChildren(...note.points.map(point=>{const line=document.createElement('li');line.textContent=point;return line;}));
}
