import {isLimbBone} from './soft-tissue-catalog.js';

const terms = {
  "hip bone":"髋骨","xiphoid process":"剑突","atlas":"寰椎","axis":"枢椎","body of sternum":"胸骨体",
  ethmoid:"筛骨","frontal bone":"额骨","hyoid bone":"舌骨",mandible:"下颌骨",manubrium:"胸骨柄",
  "occipital bone":"枕骨",radius:"桡骨",calcaneus:"跟骨",capitate:"头状骨",clavicle:"锁骨",
  "cuboid bone":"骰骨",femur:"股骨",fibula:"腓骨",hamate:"钩骨",humerus:"肱骨",
  "intermediate cuneiform bone":"中间楔骨","lateral cuneiform bone":"外侧楔骨","medial cuneiform bone":"内侧楔骨",
  lunate:"月骨",maxilla:"上颌骨","nasal bone":"鼻骨","palatine bone":"腭骨","parietal bone":"顶骨",
  patella:"髌骨",pisiform:"豌豆骨",scaphoid:"手舟骨",scapula:"肩胛骨",talus:"距骨",
  "temporal bone":"颞骨",tibia:"胫骨",trapezium:"大多角骨",trapezoid:"小多角骨",
  triquetral:"三角骨",ulna:"尺骨","zygomatic bone":"颧骨",sacrum:"骶骨","sphenoid bone":"蝶骨",vomer:"犁骨",
  "navicular bone of foot":"足舟骨","sesamoid bone of foot":"足籽骨"
};

// Clinical search aliases: students can search eponyms, nerves, vessels, muscles, or classic signs
// to jump straight to the corresponding limb bone!
const clinicalAliases = {
  '桡骨': 'colles smith barton 餐叉 枪刺 盖氏 galeazzi 孟氏 monteggia 旋前圆肌 旋前方肌 旋后肌 肱桡肌 正中神经 桡神经深支 骨间后神经 腕管 拇长伸肌腱',
  '尺骨': '孟氏 monteggia 鹰嘴 肱三头肌 肘脱位 靴状 尺神经 爪形手 旋前方肌 前臂双骨折 骨筋膜室',
  '肱骨': '外科颈 肱骨干 髁上 外髁 内上髁 肩脱位 方肩 dugas 腋神经 腋动脉 桡神经 桡神经沟 垂腕 虎口 肱动脉 正中神经 缺血性肌挛缩 volkmann 尺神经 爪形手 肘后三角 三角肌 胸大肌 肱前肌 肱二头肌 肱三头肌',
  '锁骨': '胸锁乳突肌 三角肌 锁骨下动脉 锁骨下静脉 臂丛神经',
  '肩胛骨': '肩脱位 肩袖 冈上肌 冈下肌 肩胛下肌 腋神经 方肩',
  '手舟骨': '鼻烟壶 缺血性坏死 桡动脉 舟骨腰部',
  '月骨': '月骨脱位 腕管 正中神经 猿手 桡侧三指半 月骨周围',
  '掌骨': 'bennett 拳击手 拇长展肌 骨间肌 蚓状肌',
  '指骨': '骨间肌 蚓状肌 伸肌腱 掌侧成角',
  '股骨': '股骨颈 转子间 反转子间 股骨干 髁上 髁间 髋脱位 旋股内侧动脉 股骨头坏死 linton 髂腰肌 臀中肌 臀小肌 外旋肌 梨状肌 内收肌 腓肠肌 坐骨神经 股动脉 股静脉 闭孔神经 腘动脉 腘静脉',
  '髋骨': '髋脱位 坐骨神经 股动脉 闭孔神经 臀中肌 髂腰肌 骨盆环',
  '髌骨': '股四头肌 浮髌 髌骨脱位 股内侧肌',
  '胫骨': '胫骨平台 胫骨髁 胫腓骨干 踝部 膝脱位 腘动脉 胫前动脉 胫后动脉 腓总神经 足下垂 骨筋膜室 筋膜间隔区 滋养动脉 小腿三头肌',
  '腓骨': '腓总神经 足下垂 腓骨颈 胫腓骨干 踝部 外踝',
  '距骨': '足背动脉 距骨颈 缺血性坏死 跟腱 拇长屈肌',
  '跟骨': '跟腱 腓肠肌 比目鱼肌 bohler 结节关节角 腓肠神经',
  '跖骨': 'lisfranc 跗跖脱位 足背动脉 足底深动脉 腓骨短肌 弓状动脉'
};

const numbers="first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth".split(" ");
const fingers={"big toe":"拇趾","little toe":"小趾","little finger":"小指","index finger":"示指","middle finger":"中指","ring finger":"环指","thumb":"拇指"};
export function boneName(key){
 const raw=key.replace(/ FJ\d+$/,'').toLowerCase();
 const side=/\bright\b/.test(raw)?"右":/\bleft\b/.test(raw)?"左":"";
 const name=raw.replace(/\b(right|left) /,'');
 if(terms[name])return side+terms[name];
 const [ordinal,region]=name.split(' '),num=numbers.indexOf(ordinal)+1;
 if(num){
  if(name.endsWith('vertebra'))return ({thoracic:"胸椎",lumbar:"腰椎",cervical:"颈椎"}[region])+num;
  return side+"第"+num+({rib:"肋骨",metacarpal:"掌骨",metatarsal:"跖骨"}[region]||region);
 }
 const part=name.match(/^(proximal|middle|distal) phalanx of (.+)$/);
 if(part){
  const digit=part[2],label=fingers[digit]||("第"+(numbers.indexOf(digit.split(" ")[0])+1)+"趾");
  return side+label+({proximal:"近节",middle:"中节",distal:"远节"}[part[1]])+(digit.includes("toe")?"趾骨":"指骨");
 }
 return key;
}
export function teachingBone(key){
 return key.replace(/\bleft\b/i,match=>match==='Left'?'Right':'right').replace(/ FJ3270$/, ' FJ3376');
}
export function regionFor(name){
 const text=boneName(name);
 if(/指|掌骨|锁骨|肩胛|肱骨|尺骨|桡骨|手舟骨|月骨|三角骨|豌豆骨|多角骨|钩骨|头状骨/.test(text))return '上肢';
 if(/趾|跖骨|股骨|髌骨|胫骨|腓骨|足|距骨|跟骨|楔骨|骰骨/.test(text))return '下肢';
 if(/椎|肋骨|胸骨|骶骨|髋骨|剑突/.test(text))return '躯干';
 return '头颈';
}
export function buildIndex(names,select,courseCount){
 const host=document.getElementById('catalog'),search=document.getElementById('search');
 const priorityBox=document.getElementById('priorityBones'),priorityList=document.getElementById('priorityList');
 const groups=new Map(),tabs=document.getElementById('regions');
 for(const key of names){
  const label=boneName(key).replace(/^[左右]/,''),region=regionFor(key);
  if(!groups.has(label))groups.set(label,{label,region,keys:[]});
  groups.get(label).keys.push(key);
 }
 const priority=['桡骨','肱骨','锁骨','尺骨','股骨','胫骨','腓骨','髌骨','髋骨','椎骨'];
 const rank=label=>priority.includes(label)?priority.indexOf(label):100;
 const families=new Map();
 const familyOf=label=>/掌骨/.test(label)?'掌骨':/指骨/.test(label)?'指骨':/椎|^寰椎$|^枢椎$/.test(label)?'椎骨':/肋骨/.test(label)?'肋骨':'';
 for(const row of groups.values()){
  const family=familyOf(row.label);
  if(!family)continue;
  if(!families.has(family))families.set(family,{label:family,region:row.region,rows:[]});
  families.get(family).rows.push(row);
 }
 for(const group of families.values()){
  group.rows.sort((a,b)=>{
   const segment=label=>/^寰椎$/.test(label)?1:/^枢椎$/.test(label)?2:/^颈椎/.test(label)?3:/^胸椎/.test(label)?4:/^腰椎/.test(label)?5:6;
   return segment(a.label)-segment(b.label)||a.label.localeCompare(b.label,'zh-CN',{numeric:true});
  });
 }
 const layout=[...[...groups.values()].filter(row=>!familyOf(row.label)),...families.values()];
 layout.sort((a,b)=>rank(a.label)-rank(b.label)||a.label.localeCompare(b.label,'zh-CN',{numeric:true}));
 function highlighted(label){
  const title=document.createElement('strong');title.textContent=label;
  if(priority.includes(label)){
   const star=document.createElement('span');star.className='priority-star';star.textContent='★';star.setAttribute('aria-label','重点骨');title.prepend(star);
  }
  return title;
 }
 function lineFor(row,keys){
  const line=document.createElement('div');line.className='bone-row';
  const primary=document.createElement('button');primary.className='bone-link';
  const defaultKey=keys.find(k=>!(/left/i.test(k)))||keys[0];
  primary.onclick=()=>select(defaultKey);primary.setAttribute('aria-label','放大'+boneName(defaultKey));
  const meta=document.createElement('small'),n=courseCount(defaultKey);
  const softTag=isLimbBone(defaultKey)?' · 含肌脉神经':'';
  meta.textContent=(n?n+' 个骨伤专题':'解剖定位')+softTag;
  primary.append(highlighted(row.label),meta);line.append(primary);
  for(const key of keys.sort((a,b)=>Number(/left/i.test(a))-Number(/left/i.test(b)))){
   const button=document.createElement('button');const side=boneName(key).match(/^[左右]/)?.[0];
   const piece=key.includes(' FJ')?'②':row.label.includes('籽骨')?'①':'';
   button.textContent=(side||'查看')+piece;button.setAttribute('aria-label','查看'+boneName(key)+piece);
   button.dataset.bone=key;button.onclick=()=>select(key);line.append(button);
  }
  return line;
 }
 let region='全部';
 const expanded=new Set();
 function draw(){
  const q=search.value.trim().toLowerCase();host.replaceChildren();priorityList.replaceChildren();
  let count=0;
  for(const group of layout){
   if(region!=='全部'&&region!==group.region)continue;
   const container=rank(group.label)<100?priorityList:host;
   const target=group.rows?document.createElement('details'):container;
   const groupAlias=(clinicalAliases[group.label]||'').toLowerCase();
   for(const row of group.rows||[group]){
    const rowAlias=(clinicalAliases[row.label]||'').toLowerCase();
    const keys=row.keys.filter(key=>{
     const alias=boneName(key).replace(/^胸椎/,'T').replace(/^腰椎/,'L').replace(/^颈椎/,'C');
     return (boneName(key)+' '+key+' '+alias+' '+group.label+' '+rowAlias+' '+groupAlias).toLowerCase().includes(q);
    });
    if(keys.length){target.append(lineFor(row,keys));count+=keys.length;}
   }
   if(group.rows&&target.childElementCount){
    const summary=document.createElement('summary');summary.append(highlighted(group.label));target.prepend(summary);
    target.className='bone-family';target.open=Boolean(q)||expanded.has(group.label);
    target.ontoggle=()=>{if(!q){if(target.open)expanded.add(group.label);else expanded.delete(group.label);}};
    container.append(target);
   }
  }
  priorityBox.hidden=priorityList.childElementCount===0;
  document.getElementById('count').textContent=count+' 个骨骼结构';
  if(!count){const msg=document.createElement('p');msg.className='empty';msg.textContent='该范围内没有匹配的骨名或骨伤关键词';host.append(msg);}
 }
 for(const name of ['全部','上肢','下肢','躯干','头颈']){
  const button=document.createElement('button');button.textContent=name;tabs.append(button);
  const mark=()=>{for(const b of tabs.children){b.classList.toggle('active',b.textContent===region);b.setAttribute('aria-pressed',String(b.textContent===region));}};
  mark();button.onclick=()=>{region=name;mark();draw();};
 }
 search.oninput=draw;draw();
}
