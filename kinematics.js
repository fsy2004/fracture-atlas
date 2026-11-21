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

export function buildKinematics(items,wedges,flags,frame,width,joint,values,onEdit,clinical={}){
 const controls=[],host=document.getElementById('quantRows');
 host.replaceChildren();
 const tagged=items.filter(i=>i.tuned);
 const primary=items[0],jointOrientation=new T.Quaternion(),endDir=new T.Vector3();
 let maxTravel=0,maxSpin=0;
 for(const i of items){
  i.baseRotation=rotation(i.turn);if(i.spinAxis)i.baseRotation.axis.copy(i.spinAxis);
  if(i.waypoints){
   const stops=[new T.Vector3(),...i.waypoints.map(a=>new T.Vector3(...a).multiplyScalar(mm)),i.shift];
   i.stops=stops;i.path=new T.CurvePath();
   for(let k=1;k<stops.length;k++)i.path.add(new T.LineCurve3(stops[k-1],stops[k]));
   i.path.getCurveLengths();
  }
  if(!i.tuned){maxTravel=Math.max(maxTravel,i.shift.length()/mm);maxSpin=Math.max(maxSpin,i.baseRotation.angle);}
 }
 function field(key,label,unit,base,max,step=1,min=0){
  const row=document.createElement('label');row.className='measure-row';
  const title=document.createElement('span'),read=document.createElement('output'),input=document.createElement('input');
  title.textContent=label;input.type='range';input.dataset.param=key;input.setAttribute('aria-label',label);
  input.min=min;input.max=Math.max(step,Math.ceil(max));input.step=step;
  const initial=limit(Number.isFinite(values[key])?values[key]:base,min,+input.max);
  input.value=initial;
  const c={key,unit,value:values[key]===undefined?base:initial,read,base};
  const paint=()=>{read.textContent=format(c.value)+' '+unit;};
  paint();
  input.oninput=()=>{c.value=+input.value;values[key]=c.value;paint();onEdit();};
  row.append(title,read,input);host.append(row);controls.push(c);
 }
 const ball=joint&&items.some(i=>i.jointAxis);
 const internal=clinical.id==='hip-dislocation'?clinical.variant===0:clinical.variant===1;
 if(ball)field('jointTwist',internal?'伴随内旋':'伴随外旋','°',0,30,1);
 if(joint){
  field('bearing','移出方向 · 水平偏角','°',0,20,1,-20);
  field('elevation','移出方向 · 仰俯偏角','°',0,15,1,-15);
 }
 const wrist=Number.isFinite(clinical.palmar);
 if(wrist){
  const baseline=clinical.palmar;
  field('tilt','终点背倾（模型侧面）','°',limit(values.spin===undefined?15-baseline:values.spin-baseline,0,35),35,1);
 }
 if(tagged.length){
  const defaults={shorten:width*.57,separate:width*.48,side:width*.42,angle:16,rotate:24};
  if(tagged[0].tuned==='wrist')defaults.shorten=4;
  for(const key of flags){
   const angular=key==='angle'||key==='rotate';
   const angleLimit=key==='angle'&&clinical.id==='humerus'?60:35;
   field(key,tagged[0].tuned==='wrist'?'附加缩短':names[key],angular?'°':'mm',Math.round(defaults[key]*10)/10,angular?angleLimit:Math.min(60,Math.max(8,width*1.6)),angular?1:.5);
  }
 }else{
  if(maxTravel>.02)field('travel',joint?'关节平移距离':'最大骨块平移距离','mm',maxTravel,maxTravel*1.75,.5);
  if(!wrist&&maxSpin>.02)field('spin','最大骨块转角','°',maxSpin,Math.min(180,maxSpin*1.75),1);
 }
 let maxDepth=0;
 function blendedDepth(blend){
  let maximum=0;
  for(const mesh of wedges){
   const [narrow,wide]=mesh.geometry.morphAttributes.position;
   for(let j=0;j<narrow.count;j++)maximum=Math.max(maximum,1000*Math.hypot(
    narrow.getX(j)*(1-blend)+wide.getX(j)*blend,narrow.getY(j)*(1-blend)+wide.getY(j)*blend,narrow.getZ(j)*(1-blend)+wide.getZ(j)*blend));
  }
  return maximum;
 }
 if(wedges.length){
  maxDepth=blendedDepth(0);
  field('crush','最大局部压低','mm',maxDepth*(limit(values.wedge??100,0,130)/100),maxDepth*1.3,.5);
  field('breadth','压缩分布拓宽','%',0,100,1);
 }
 if(clinical.ankleSign)field('footRoll',clinical.ankleSign>0?'足内翻姿态':'足外翻姿态','°',12,25,1);
 document.getElementById('quantBox').hidden=!controls.length;
 if(wrist||clinical.id==='humerus'&&flags.includes('angle')){
  const note=document.createElement('p');note.className='clinical-note';
  note.textContent=wrist?'伸直型背倾探索 0°～35°。在侧面按掌背缘参考点与桡骨干轴计算；伤前角度取自当前模型。':'肱骨干成角 0°～60°。试比较 10°、25° 和 40° 时两段骨轴的夹角。';
  host.append(note);
 }
 const hingeArm=new T.Vector3();
 const rim=tagged.find(i=>i.tuned==='shaft'&&i.edge);
 if(rim&&frame&&flags.includes('angle')){
  // Pivot at the lateral cortical margin for this example, not inside the two bone ends.
  const p=rim.edge.geometry.attributes.position,point=new T.Vector3();let best=-Infinity;
  for(let j=0;j<p.count;j++){
   point.fromBufferAttribute(p,j).sub(rim.anchor);const d=point.dot(frame.side);
   if(d>best){best=d;hingeArm.copy(point);}
  }
 }
 const rotatedArm=new T.Vector3();
 const map=Object.fromEntries(controls.map(c=>[c.key,c]));
 const val=(k,f=0)=>map[k]?.value??f;
 const translation=new T.Vector3(),qa=new T.Quaternion(),qb=new T.Quaternion();
 function format(n){return Number(n.toFixed(1)).toString();}
 let lastBlend=-1;
 function apply(p,report=true){
  const linearMotion=tagged.length?flags.some(k=>['side','shorten','separate'].includes(k)&&val(k)>0):val('travel',maxTravel)>.02;
  const shiftT=eased(p,.18,.78),lengthT=eased(p,.56,.91),angleT=eased(p,linearMotion ? .54 : .18,1),compressT=eased(p,.18,.91),clearT=eased(p,.23,.56),jointT=eased(p,.10,.77);
  for(const i of items){
   const {pivot,anchor,shift,baseRotation:r}=i;
   if(i.tuned==='shaft'&&frame){
    // First clear the cortex laterally, then bring the distal end proximally.
    const clearance=val('shorten')>0?width*1.03:0;
    translation.copy(frame.side).multiplyScalar(mm*(val('side')*shiftT+clearance*clearT))
     .addScaledVector(frame.axis,mm*(val('shorten')-val('separate'))*lengthT);
    qa.setFromAxisAngle(frame.bend,val('angle')*angleT*rad);
    qb.setFromAxisAngle(frame.axis,val('rotate')*angleT*rad);
    if(!val('shorten')&&!val('separate')&&!val('side')){
     translation.add(hingeArm).sub(rotatedArm.copy(hingeArm).applyQuaternion(qa));
    }
    pivot.quaternion.copy(qa).multiply(qb);
   }else{
    const scale=maxTravel>0?val('travel',maxTravel)/maxTravel:1;
    translation.copy(shift).multiplyScalar(scale*(i.timing?eased(p,...i.timing):shiftT));
    if(i.sharedClock&&i.stops){
     const u=p*(i.stops.length-1),k=Math.min(Math.floor(u),i.stops.length-2);
     translation.lerpVectors(i.stops[k],i.stops[k+1],u-k).multiplyScalar(scale);
    }else if(i.path)translation.copy(i.path.getPoint(shiftT)).multiplyScalar(scale);
    if(joint&&!i.adjunct&&shift.lengthSq()>0&&(val('bearing')||val('elevation'))){
     const yaw=Math.atan2(shift.x,shift.z)+(clinical.mirror?-1:1)*val('bearing')*rad;
     const pitch=Math.asin(limit(shift.y/shift.length(),-1,1))+val('elevation')*rad;
     endDir.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
     jointOrientation.setFromUnitVectors(shift.clone().normalize(),endDir);translation.applyQuaternion(jointOrientation);
    }
    if(i.tuned==='wrist')translation.addScaledVector(frame.axis,val('shorten',4)*mm*lengthT);
    const degrees=wrist&&r.angle>0?(val('tilt')+clinical.palmar)*r.angle/15:
     r.angle*(maxSpin>0?val('spin',maxSpin)/maxSpin:1);
    pivot.quaternion.setFromAxisAngle(r.axis,degrees*rad*angleT);
   }
   if(i.jointAxis)pivot.quaternion.setFromAxisAngle(i.jointAxis,(internal?1:-1)*val('jointTwist')*rad*jointT);
   pivot.position.copy(anchor).add(translation);
   if(i.ghost)i.ghost.visible=document.getElementById('ghost').checked&&p>.29&&
    (translation.lengthSq()>1e-9||pivot.quaternion.angleTo(identity)>.01);
  }
  if(wedges.length){
   const blend=val('breadth')/100;
   if(lastBlend!==blend){maxDepth=blendedDepth(blend);lastBlend=blend;}
   const amplitude=maxDepth?val('crush')/maxDepth*compressT:0;
   for(const mesh of wedges){mesh.morphTargetInfluences[0]=amplitude*(1-blend);mesh.morphTargetInfluences[1]=amplitude*blend;}
  }
  if(!report)return;
  const readouts=controls.filter(c=>!['bearing','elevation'].includes(c.key)||c.value!==0).map(c=>{
   if(c.key==='travel'&&joint)return {label:'平移',num:format(primary.pivot.position.distanceTo(primary.anchor)/mm),unit:'mm'};
  if(c.key==='tilt'){
    const dorsal=(c.value+clinical.palmar)*angleT-clinical.palmar;
    return {label:dorsal>=0?'背倾':'掌倾',num:format(Math.abs(dorsal)),unit:'°'};
   }
   const t=['bearing','elevation'].includes(c.key)?1:c.key==='footRoll'?eased(p,.19,.76):c.key==='breadth'?1:c.key==='crush'?compressT:c.key==='jointTwist'?jointT:['spin','angle','rotate'].includes(c.key)?angleT:['shorten','separate'].includes(c.key)?lengthT:shiftT;
   return {label:tagged[0]?.tuned==='wrist'&&c.key==='shorten'?'附加缩短':({travel:'平移',bearing:'水平偏角',elevation:'仰俯偏角',spin:'转角',jointTwist:internal?'内旋':'外旋',crush:'局部压低',breadth:'分布拓宽',footRoll:clinical.ankleSign>0?'内翻':'外翻'}[c.key]||names[c.key]),num:format(c.value*t),unit:c.unit};
  });
  const tray=document.getElementById('liveValues');
  if(tagged[0]?.tuned==='shaft'&&val('shorten')>0){
   const total=width*1.03*clearT+val('side')*shiftT;
   const sideReading=readouts.find(x=>x.label===names.side);
   if(sideReading){sideReading.label='合计侧移';sideReading.num=format(total);}
   else readouts.push({label:'伴随侧移',num:format(total),unit:'mm'});
  }
  const text=readouts.map(a=>a.label+' '+a.num+' '+a.unit).join('　');
  if(tray.textContent!==text)tray.textContent=text;
 }
 const identity=new T.Quaternion();
 apply.footRoll=()=>val('footRoll',12);
 return apply;
}
