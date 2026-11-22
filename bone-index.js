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
export function buildIndex(names,select,courseCount,hasSpecimen){
 const host=document.getElementById('catalog'),search=document.getElementById('search');
 const groups=new Map(),tabs=document.getElementById('regions');
 for(const key of names){
  const label=boneName(key).replace(/^[左右]/,''),region=regionFor(key);
  if(!groups.has(label))groups.set(label,{label,region,keys:[]});
  groups.get(label).keys.push(key);
 }
 const priority=['胫骨','股骨','肱骨','桡骨','尺骨','腓骨','锁骨','髌骨','髋骨','手舟骨','跟骨'];
 const rank=x=>priority.includes(x.label)?priority.indexOf(x.label):100;
 const rows=[...groups.values()].sort((a,b)=>rank(a)-rank(b)||a.label.localeCompare(b.label,'zh-CN',{numeric:true}));
 let region='全部';const precise=document.getElementById('preciseOnly');
 function draw(){
  const q=search.value.trim().toLowerCase();host.replaceChildren();
  let count=0;
  for(const row of rows){
   if(region!=='全部'&&region!==row.region)continue;
   const keys=row.keys.filter(k=>(!precise.checked||hasSpecimen(k))&&(boneName(k)+' '+k).toLowerCase().includes(q));
   if(!keys.length)continue;
   const line=document.createElement('div');line.className='bone-row';
   const primary=document.createElement('button');primary.className='bone-link';
   const defaultKey=keys.find(k=>!(/left/i.test(k)))||keys[0];
   primary.onclick=()=>select(defaultKey);primary.setAttribute('aria-label','放大'+boneName(defaultKey));
   const title=document.createElement('strong');title.textContent=row.label;
   const meta=document.createElement('small'),n=courseCount(defaultKey);
   meta.textContent=n?n+' 个骨伤专题':'解剖定位';
   primary.append(title,meta);line.append(primary);
   for(const key of keys.sort((a,b)=>Number(/left/i.test(a))-Number(/left/i.test(b)))){
    const button=document.createElement('button');const side=boneName(key).match(/^[左右]/)?.[0];
    const piece=key.includes(' FJ')?'②':row.label.includes('籽骨')?'①':'';
    button.textContent=(side||'查看')+piece;button.setAttribute('aria-label','查看'+boneName(key)+piece);
    button.dataset.bone=key;button.onclick=()=>select(key);line.append(button);count++;
   }
   host.append(line);
  }
  document.getElementById('count').textContent=count+' 个骨骼结构';
  if(!count){const msg=document.createElement('p');msg.className='empty';msg.textContent='该范围内没有匹配的骨名';host.append(msg);}
 }
 for(const name of ['全部','上肢','下肢','躯干','头颈']){
  const button=document.createElement('button');button.textContent=name;tabs.append(button);
  const mark=()=>{for(const b of tabs.children){b.classList.toggle('active',b.textContent===region);b.setAttribute('aria-pressed',String(b.textContent===region));}};
  mark();button.onclick=()=>{region=name;mark();draw();};
 }
 precise.onchange=draw;search.oninput=draw;draw();
}
