import {canonicalCourse} from './variant-registry.js';
import {levels} from './courses.js';
import {fractureNote} from './fracture-notes.js';
import {regionalNote} from './regional-notes.js';

// Explicitly named diseases in the relevant musculoskeletal syllabus. A named
// disease does not imply that every illustrated subtype is separately listed.
const namedSites=new Set(['radius','clavicle','rib','shoulder','humerus','elbow','forearm','neck','trochanter','femur','plateau','patella','tibia','ankle','spine','pelvis','shoulder-dislocation','hip-dislocation']);

const wrist={
 v01:['跌倒时腕背伸。典型 Colles 骨折的远段向背侧、桡侧移位，可伴短缩。','侧面呈餐叉样畸形，正面可呈枪刺样畸形。侧位片看背倾，正位片看桡移。','与背侧 Barton 型鉴别时，看腕骨是否跟着一块关节缘骨片一起移动。'],
 v02:['屈腕位受伤可形成 Smith 骨折。远段向掌侧移位、掌倾。','侧位确定远段位于掌侧，可与远段背移的 Colles 骨折区分。','掌侧 Barton 型的断线进入关节缘，腕骨随缘骨片移位；本例为远段整体掌移。'],
 v03:['背侧 Barton 型是关节内骨折，断线分出桡骨远端的背侧缘。','侧位看近排腕骨与背侧缘骨片一起向背侧移，桡腕关节出现半脱位。','与 Colles 型鉴别要看哪部分关节面随行，仅凭背移方向不能区分。'],
 v04:['掌侧 Barton 型的断线进入桡腕关节面，分出掌侧缘骨片。','侧位看腕骨随掌侧缘骨片向掌侧移，剩余关节面仍与桡骨干相连。','与 Smith 型同为掌移。腕骨与掌侧缘骨片一同移位提示 Barton 型。']
};
// Variant-level recall cues. Pair the defining displacement or fracture line
// with a visual discriminator, rather than adding a generic disease fact to every type.
const differentiate={
 'shoulder-dislocation':{
  v01:['肱骨头移到肩胛盂前方，常伴下移，可停于喙突下。','方肩来自肱骨头脱出后肩峰突出。用盂前缘定位前脱位。'],
  v02:['正位上肱骨头与肩胛盂仍可重叠，侧位可见肱骨头位于盂后方。','上臂常内旋，外旋受限。两侧观察时以同一侧肩胛盂为参照。']
 },
 'hip-dislocation':{
  v01:['股骨头脱至髋臼后方，伤肢典型呈屈曲、内收、内旋和短缩。','髋臼后缘可伴骨折，邻近的坐骨神经可能受累。'],
  v02:['本例股骨头脱至髋臼前下方，伤肢典型呈外展、外旋位。','从正面找闭孔或耻骨支，再用侧面确认股骨头确在髋臼前方。']
 },
 'elbow-dislocation':{
  v01:['尺骨鹰嘴与桡骨头一同移到肱骨远端后方。','屈肘看鹰嘴、内外上髁，原肘后三角被打乱，有助与髁上骨折鉴别。'],
  v02:['正面看尺骨滑车切迹与肱骨滑车横向错开，本例尺桡骨近端向外移。','方向以尺桡骨相对肱骨命名。外侧移位可伴内侧稳定结构受累。'],
  v03:['侧面看尺桡骨近端移到肱骨远端前方，可伴鹰嘴骨折。','从侧面确定是前臂整体移出，再追踪肱骨远端皮质以区别肱骨髁上骨折。']
 },
 'lunate-dislocation':{
  v01:['月骨向掌侧翻转，远侧凹面转向掌侧，桡月关节失去对合。','侧位追踪桡骨、月骨、头状骨三者对线，找出脱出的是月骨本身。'],
  v02:['桡月关节仍对合，头状骨随远排腕骨向背侧脱出。','侧位先从桡骨找到仍在原位的月骨，再沿其远侧凹面找背移的头状骨。']
 },
 neck:{
  v01:['断线紧贴股骨头下缘。移位可损及股骨头血供。','判读时先沿股骨头下缘定位囊内断面，再找有无内翻或嵌插。'],
  v02:['断线穿过股骨颈中段，头侧骨块仍连有一段股骨颈。','正面沿股骨颈双侧皮质追线。断线越接近垂直，剪切分量越大。'],
  v03:['断线接近股骨颈与转子区交界，股骨头侧保留较长的颈部。','从断线与大小转子的关系，区分股骨颈基底部与转子间骨折。']
 },
 trochanter:{
  v01:['顺转子间断线由外上向内下走行，常指向小转子区域。','内侧皮质、尤其靠小转子支撑区破碎时，需留意髋内翻与短缩。'],
  v02:['反转子间断线由外下向内上走行，斜向与顺型相反。','远段向内上牵移，近段可外展、外旋。分别从前视和上视辨认。'],
  v03:['断线主体位于小转子下方。','转子下段受较大弯曲应力。看近段轴线偏转及两断端重叠。']
 },
 elbow:{
  v01:['伸直型的肱骨远侧髁块向后移，断线常从前下向后上。','应关注肱动脉与正中神经。肘后三点关系通常仍保留。'],
  v02:['屈肘着地可造成屈曲型，肱骨远侧髁块向前移。','侧面观察断线从后下向前上，用远段方向区分伸直型。'],
  v03:['成人粉碎型可由髁上区延入髁间关节面。','从上方横断线追到两髁之间的裂支，辨认 T 形或 Y 形关节内延伸。']
 },
 ankle:{
  v01:['足内翻时内踝受挤压可斜断，外踝受牵拉可横断。','沿距骨内侧转到正面，检查内踝断线及足向内翻的姿态。'],
  v02:['足外翻时内踝受牵拉可横断，外踝可呈斜行或螺旋断线。','在踝穴正面核对距骨、内外踝的对位，再沿腓骨向近端追踪。']
 },
 plateau:{
  v01:['从内侧负重面沿断线追至胫骨内侧骨皮质。','以胫骨棘做中线参照。判断损伤是否越过棘区进入外侧平台。'],
  v02:['以腓骨头定位外侧，沿外侧髁断线追向平台关节面。','外侧劈裂型看外壁骨块是否分离，压陷型则看中央负重面高度。'],
  v03:['内、外侧髁均有裂线，两侧负重面同时受累。','正面比较两侧平台高度，再从上方追踪髁间的断线。'],
  v04:['外侧负重面局部下沉，外侧骨壁皮质仍连续。','从侧面比中央与周边的高度，区分单纯压陷和外壁劈裂。'],
  v05:['外侧骨壁有劈裂，外侧负重面同时局部下沉。','分别对照外缘横向张开与负重面的垂直台阶。']
 },
 pelvis:{
  v01:['侧方压缩时伤侧半骨盆内旋，前环耻骨支断端可重叠。','后环可能出现骶骨压缩。查看骶翼高度和骶髂间隙。'],
  v02:['前后压缩时半骨盆外旋使前环张开，耻骨联合间隙可增宽。','前环张开时应同步检查后方骶髂关节。'],
  v03:['垂直剪切时伤侧半骨盆上移，髂嵴可高于对侧。','后环可伴骶髂分离或骶骨纵裂，比较两侧骶髂对位确认。']
 },
 tibia:{
  v01:['直接暴力时胫腓骨断线常在相近高度，可呈横断、短斜或粉碎。','从正面分别追踪两骨皮质，比较侧方错位与两段长轴。'],
  v02:['间接扭转常形成斜行或螺旋断线，腓骨断线可高于胫骨。','沿皮质绕看断线两端，分别判断远段旋转与轴向短缩。']
 }
};
const tibialLevels={
 v01:[
  '直接损伤在上 1/3 时，重点核对小腿和足部血运，警惕腘动脉损伤。',
  '中段直接撞击后，进行性疼痛和被动牵伸痛提示应考虑骨筋膜室综合征。',
  '胫骨下段前内侧软组织覆盖薄，注意有无局部创口及明显皮质错位。'
 ],
 v02:[
  '上段骨折要顺腓骨向上看至腓骨头，并留意邻近的腓总神经。',
  '中段扭转伤可在两骨不同高度断开。通过胫骨结节和踝部方向辨认远段旋转。',
  '下段螺旋断线应向踝端追踪，核对远段旋转及踝穴对位。'
 ]
};
export function lessonNote(course,index){
 const variant=course?.variants?.[index];if(!variant)return null;
 const note=fractureNote(course,index)||regionalNote(course,index);
 if(!note)return null;
 return {...note,supplement:Boolean(note.supplement||course.id==='plateau'&&variant.depression)};
}
export function examPoints(course,index,level=1){
 const note=lessonNote(course,index);if(!note)return null;
 const family=course.family||course.id;
 const identity=course.variants[index].id||canonicalCourse(course).variants.find(v=>v.name===course.variants[index].name).id;
 const specific=family==='radius'?wrist[identity]:differentiate[family]?.[identity];
 const points=[...(specific||note.points)];
 if(!specific&&note.supplement&&points[1].startsWith('本例'))points.reverse();
 if(course.id==='tibia')points.push(tibialLevels[identity][level]);
 if(points.length<3&&course.id==='humerus'&&index===1)
  points.push('软组织参照中可从后外侧找桡神经沟；肱骨干中下段交界骨折需关注桡神经。');
 if(points.length<3&&course.id==='elbow'&&index===0)
  points.push('在肘前对照肱动脉和正中神经，结合远侧髁块后移、近侧断端前缘的关系来定位风险。');
 if(points.length<3&&course.id==='hip-dislocation'&&index===0)
  points.push('在伤前对照中区分髋前方的股动静脉和髋后方的坐骨神经，观察股骨头后移时接近哪一侧。');
 const wedge=course.variants[index].cuts[0].wedge;
 if(wedge&&points.length<3){
  points.push(wedge==='anterior'?'典型前缘楔形压缩应核对后壁连续性；后壁受累是与爆裂骨折鉴别的重要线索。':
   '偏侧压缩时先比较同一椎体两侧终板间距，再检查后壁和椎体后方结构。');
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
