import * as T from './vendor/three.module.js';

const rad=Math.PI/180, mm=.001;
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
const eased=(t,a,b)=>{const x=limit((t-a)/(b-a),0,1);return x*x*(3-2*x);};
const names={shorten:'轴向缩短',separate:'轴向分离',side:'侧方移位',angle:'成角',rotate:'轴向旋转'};

function rotation(turn){
 const q=new T.Quaternion().setFromEuler(new T.Euler(turn.x,turn.y,turn.z));
 if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);
 const angle=2*Math.acos(limit(q.w,-1,1));
 const axis=new T.Vector3(q.x,q.y,q.z);
 return {angle:angle/rad,axis:axis.lengthSq()>1e-14?axis.normalize():new T.Vector3(0,1,0)};
}

// Derive the local longitudinal axis from two cross-sectional centres supplied by the mesh.
export function shaftFrame(low,high,distalPositive){
 const axis=high.clone().sub(low).normalize();
 if(distalPositive)axis.negate();
 const side=new T.Vector3(Math.abs(axis.x)<.9?1:0,Math.abs(axis.x)<.9?0:1,0);
 side.addScaledVector(axis,-side.dot(axis)).normalize();
 return {axis,side,bend:new T.Vector3().crossVectors(side,axis).normalize()};
}

export function buildKinematics(items,wedges,flags,frame,width,joint,values,onEdit){
 const controls=[],host=document.getElementById('quantRows');
 host.replaceChildren();
 const tagged=items.filter(i=>i.tuned);
 let maxTravel=0,maxSpin=0;
 for(const i of items){
  i.baseRotation=rotation(i.turn);
  if(!i.tuned){maxTravel=Math.max(maxTravel,i.shift.length()/mm);maxSpin=Math.max(maxSpin,i.baseRotation.angle);}
 }
 function field(key,label,unit,base,max,step=1){
  const row=document.createElement('label');row.className='measure-row';
  const title=document.createElement('span'),read=document.createElement('output'),input=document.createElement('input');
  title.textContent=label;input.type='range';input.dataset.param=key;input.setAttribute('aria-label',label);
  input.min=0;input.max=Math.max(step,Math.ceil(max));input.step=step;
  const initial=limit(Number.isFinite(values[key])?values[key]:base,0,+input.max);
  input.value=initial;
  const c={key,unit,value:values[key]===undefined?base:initial,read,base};
  const paint=()=>{read.textContent=format(c.value)+' '+unit;};
  paint();
  input.oninput=()=>{c.value=+input.value;values[key]=c.value;paint();onEdit();};
  row.append(title,read,input);host.append(row);controls.push(c);
 }
 if(tagged.length){
  const defaults={shorten:width*.57,separate:width*.48,side:width*.42,angle:16,rotate:24};
  if(tagged[0].tuned==='wrist')defaults.shorten=4;
  for(const key of flags){
   const angular=key==='angle'||key==='rotate';
   field(key,tagged[0].tuned==='wrist'?'附加缩短':names[key],angular?'°':'mm',Math.round(defaults[key]*10)/10,angular?60:Math.min(60,Math.max(8,width*1.6)),angular?1:.5);
  }
 }else{
  if(maxTravel>.02)field('travel',joint?'关节平移距离':'最大骨块平移距离','mm',maxTravel,maxTravel*1.75,.5);
  if(maxSpin>.02)field('spin','最大骨块转角','°',maxSpin,Math.min(180,maxSpin*1.75),1);
 }
 if(wedges.length)field('wedge','预设压缩形变倍率','%',100,130,1);
 document.getElementById('quantBox').hidden=!controls.length;
 const map=Object.fromEntries(controls.map(c=>[c.key,c]));
 const val=(k,f=0)=>map[k]?.value??f;
 const translation=new T.Vector3(),qa=new T.Quaternion(),qb=new T.Quaternion();
 function format(n){return Number(n.toFixed(1)).toString();}
 function apply(p){
  const shiftT=eased(p,.25,.78),lengthT=eased(p,.44,.87),angleT=eased(p,.54,1);
  for(const i of items){
   const {pivot,anchor,shift,baseRotation:r}=i;
   if(i.tuned==='shaft'&&frame){
    // First clear the cortex laterally, then bring the distal end proximally.
    const clearance=width*1.03*Math.min(1,val('shorten')/Math.max(.1,width*.15));
    translation.copy(frame.side).multiplyScalar(mm*(val('side')+clearance)*shiftT)
     .addScaledVector(frame.axis,mm*(val('shorten')-val('separate'))*lengthT);
    qa.setFromAxisAngle(frame.bend,val('angle')*angleT*rad);
    qb.setFromAxisAngle(frame.axis,val('rotate')*angleT*rad);
    pivot.quaternion.copy(qa).multiply(qb);
   }else{
    const scale=maxTravel>0?val('travel',maxTravel)/maxTravel:1;
    translation.copy(shift).multiplyScalar(scale*shiftT);
    if(i.tuned==='wrist')translation.addScaledVector(frame.axis,val('shorten',4)*mm*lengthT);
    pivot.quaternion.setFromAxisAngle(r.axis,r.angle*rad*angleT*(maxSpin>0?val('spin',maxSpin)/maxSpin:1));
   }
   pivot.position.copy(anchor).add(translation);
   if(i.ghost)i.ghost.visible=document.getElementById('ghost').checked&&p>.29&&
    (translation.lengthSq()>1e-9||pivot.quaternion.angleTo(identity)>.01);
  }
  for(const mesh of wedges)mesh.morphTargetInfluences[0]=val('wedge',100)/100*lengthT;
  const readouts=controls.map(c=>{
   const t=['spin','angle','rotate'].includes(c.key)?angleT:['shorten','separate','wedge'].includes(c.key)?lengthT:shiftT;
   return {label:tagged[0]?.tuned==='wrist'&&c.key==='shorten'?'附加缩短':({travel:'平移',spin:'转角',wedge:'预设形变倍率'}[c.key]||names[c.key]),num:format(c.value*t),unit:c.unit};
  });
  const tray=document.getElementById('liveValues');
  const text=readouts.map(a=>a.label+' '+a.num+' '+a.unit).join('　');
  if(tray.textContent!==text)tray.textContent=text;
 }
 const identity=new T.Quaternion();
 return apply;
}
