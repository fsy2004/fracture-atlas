import * as T from './vendor/three.module.js';

import {createWedgePose} from './wedge.js';
import {teachingTargets} from './motion-presets.js';
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
 const wedgePose=clinical.wedge?createWedgePose(items):null;
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
 const targets=teachingTargets(clinical,maxTravel,maxSpin);
 // Rough opposing cortices must disengage before a purely lateral or spinning target can move.
 // These paths were checked on both specimens at the authored shaft cuts.
 const guided=tagged[0]?.tuned==='shaft'&&!clinical.legacyMotion&&!clinical.selectedShape&&['femur','humerus','tibia'].includes(clinical.id);
 const staged=tagged[0]?.tuned==='shaft'&&Boolean(tagged[0].cutNormal)&&!clinical.legacyMotion&&!guided;
 const cutAxis=new T.Vector3();
 const pairedTibia=staged&&clinical.id==='tibia';
 const helical=guided&&clinical.id==='tibia'&&clinical.variant===1;
 const guidedWrist=clinical.id==='radius'&&tagged[0]?.tuned==='wrist'&&!clinical.legacyMotion;
 const wristRelease=clinical.variant===0?2:5;
 const lateralSign=(guided||pairedTibia)&&(clinical.id==='tibia'||clinical.variant===2)?-1:1;
 const clearWidths=guided||staged?(lateralSign<0?1.45:1.24):1.03;
 function field(key,label,unit,base,max,step=1,min=0){
  const row=document.createElement('label');row.className='measure-row';
  const title=document.createElement('span'),read=document.createElement('output'),input=document.createElement('input');
  title.textContent=label;input.type='range';input.dataset.param=key;input.setAttribute('aria-label',label);
  input.min=min;input.max=Math.max(step,Math.ceil(max));input.step=step;
  const initial=limit(Number.isFinite(values[key])?values[key]:base,min,+input.max);
  input.value=initial;
  const c={key,unit,value:values[key]===undefined?base:initial,read,base,input,min,max:+input.max,step};
  const paint=()=>{read.textContent=format(c.value)+' '+unit;};
  paint();
  c.paint=paint;
  input.oninput=()=>{c.value=+input.value;values[key]=c.value;paint();onEdit();};
  row.append(title,read,input);host.append(row);controls.push(c);
 }
 const ball=joint&&items.some(i=>i.jointAxis);
 const internal=clinical.id==='hip-dislocation'?clinical.variant===0:clinical.variant===1;
 if(ball)field('jointTwist',internal?'伴随内旋':'伴随外旋','°',primary.axial||0,35,1);
 if(joint){
  field('bearing','移出方向 · 水平偏角','°',0,20,1,-20);
  field('elevation','移出方向 · 仰俯偏角','°',0,15,1,-15);
 }
 const wrist=Number.isFinite(clinical.palmar);
 if(wrist){
  const baseline=clinical.palmar;
  let targetTilt=guidedWrist?18:15;
  if(clinical.legacyMotion)targetTilt=15-baseline;
  if(values.spin!==undefined)targetTilt=values.spin-baseline;
  field('tilt','终点背倾（模型侧面）','°',limit(targetTilt,0,35),35,1);
 }
 if(tagged.length){
  const defaults={shorten:width*.57,separate:width*.48,side:width*.42,angle:16,rotate:24};
  if(tagged[0].tuned==='wrist')defaults.shorten=guidedWrist?5:4;
  if(helical){defaults.rotate=16;defaults.shorten=12;}
  for(const key of flags){
   const angular=key==='angle'||key==='rotate';
   const angleLimit=key==='angle'&&clinical.id==='humerus'?60:35;
   field(key,tagged[0].tuned==='wrist'&&!guidedWrist?'附加缩短':names[key],angular?'°':'mm',Math.round(defaults[key]*10)/10,angular?angleLimit:Math.min(60,Math.max(8,width*1.6)),angular?1:.5);
  }
 }else{
  if(maxTravel>.02)field('travel',joint?'关节平移距离':'最大骨块平移距离','mm',targets.travel,Math.max(maxTravel*1.9,targets.travel*1.65),.5);
  if(!wrist&&maxSpin>.02)field('spin','最大骨块转角','°',targets.spin,Math.min(180,Math.max(maxSpin*1.85,targets.spin*1.5)),1);
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
  let gap=0;
  if(guided){
   const fraction=Math.min(1,Math.max(val('shorten')/12,val('side')/8,val('angle')/16,val('rotate')/(helical?16:24)));
   const clearance=helical?(val('shorten')?13:10):5;
   gap=fraction*clearance;
  }
  const opening=gap*(eased(p,.08,.20)-(val('shorten')?eased(p,.53,.8):val('separate')?lengthT:0));
  const contactStage=staged&&[val('shorten'),val('side'),val('angle'),val('rotate')].some(x=>x>0);
  const stagedSlide=contactStage?eased(p,.36,.77):shiftT;
  const stagedTurn=contactStage?eased(p,.48,1):angleT;
  const telescope=contactStage&&val('shorten')>0?eased(p,.73,1):lengthT;
  for(const i of items){
   const {pivot,anchor,shift,baseRotation:r}=i;
   if(i.tuned==='shaft'&&frame){
    // First clear the cortex laterally, then bring the distal end proximally.
    const clearance=val('shorten')>0?width*clearWidths:0;
    // On a changed cut, open the two surfaces before introducing tangential
    // displacement. Only retract that opening after the ends have cleared.
    const across=contactStage?eased(p,.34,.70):clearT;
    translation.copy(frame.side).multiplyScalar(lateralSign*mm*(val('side')*stagedSlide+clearance*across))
     .addScaledVector(frame.axis,mm*(val('shorten')*telescope-val('separate')*lengthT-opening));
    if(contactStage){
     cutAxis.copy(pairedTibia?frame.axis:i.cutNormal||frame.axis);
     if(cutAxis.dot(frame.axis)<0)cutAxis.negate();
     const spiral=i.cutRise||0;
     const relativeGap=pairedTibia&&val('rotate')>0?.53:val('angle')>0?.40:.27;
     const amount=Math.max(width*relativeGap,spiral*(val('angle')>0?.80:.56)+width*.10);
     const open=eased(p,.075,.34)*(val('shorten')>0?1-eased(p,.71,.97):1);
     const planned=translation.dot(cutAxis);
     const avoid=val('shorten')>0?open*(amount+Math.max(0,planned/mm)):
      Math.max(0,amount*open+planned/mm);
     translation.addScaledVector(cutAxis,-avoid*mm);
     if(i.neighborClearance)translation.addScaledVector(i.neighborClearance,eased(p,.075,.40));
    }
    qa.setFromAxisAngle(frame.bend,val('angle')*stagedTurn*rad);
    qb.setFromAxisAngle(frame.axis,val('rotate')*stagedTurn*rad);
    if(!contactStage&&!val('shorten')&&!val('separate')&&!val('side')){
     translation.add(hingeArm).sub(rotatedArm.copy(hingeArm).applyQuaternion(qa));
    }
    pivot.quaternion.copy(qa).multiply(qb);
   }else{
    const scale=maxTravel>0?val('travel',maxTravel)/maxTravel:1;
    translation.copy(shift).multiplyScalar(scale*(i.timing?eased(p,...i.timing):shiftT));
    if(i.tractionTiming==='distal'){
     translation.x=shift.x*scale*eased(p,.16,.56);
     translation.z=shift.z*scale*eased(p,.16,.56);
     translation.y=shift.y*scale*eased(p,.65,1)-.0035*scale*(eased(p,.10,.28)-eased(p,.65,1));
    }
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
    if(i.tuned==='wrist'){
     if(guidedWrist){
      // A displaced distal radius clears the opposite cortex toward the dorsal or
      // volar side before the carpus and distal fragment telescope together.
      const tangent=clinical.variant===0?2.2:3;
      translation.copy(shift).addScaledVector(frame.axis,-shift.dot(frame.axis)).multiplyScalar(tangent*shiftT);
      translation.addScaledVector(frame.axis,mm*(val('shorten')*lengthT-wristRelease*(eased(p,.10,.27)-lengthT)));
     }else translation.addScaledVector(frame.axis,val('shorten',4)*mm*lengthT);
    }
    const degrees=wrist&&r.angle>0?(val('tilt')+clinical.palmar)*r.angle/15:
     r.angle*(maxSpin>0?val('spin',maxSpin)/maxSpin:1);
    pivot.quaternion.setFromAxisAngle(r.axis,degrees*rad*(i.tractionTiming==='proximal'?eased(p,.22,.66):angleT));
   }
   if(i.jointAxis){
    const phase=eased(p,.10,.78);
    pivot.quaternion.setFromAxisAngle(i.jointAxis,(internal?1:-1)*val('jointTwist')*rad*jointT);
    if(i.posture){
     const [flex,,abd]=i.posture;
     qa.setFromEuler(new T.Euler(flex*rad*phase,0,abd*rad*phase,'ZXY'));
     // Transfer swing to the registered shaft without an incidental axial
     // rotation. The separately authored internal/external rotation follows it.
     endDir.copy(i.jointAxis).applyQuaternion(qa);
     qa.setFromUnitVectors(i.jointAxis,endDir);
     pivot.quaternion.premultiply(qa);
    }
   }
   if(i.clearancePulse){
    const scale=maxTravel?val('travel',maxTravel)/maxTravel:0;
    translation.addScaledVector(i.clearancePulse,scale*(eased(p,.1,.3)-eased(p,.62,.96)));
   }
   pivot.position.copy(anchor).add(translation);
   if(i.ghost)i.ghost.visible=document.getElementById('ghost').checked&&p>.29&&
    (translation.lengthSq()>1e-9||pivot.quaternion.angleTo(identity)>.01);
  }
  if(wedgePose)wedgePose(p,maxTravel?val('travel',maxTravel)/maxTravel:1,maxSpin?val('spin',maxSpin)/maxSpin:1);
  if(wedges.length){
   const blend=val('breadth')/100;
   if(lastBlend!==blend){maxDepth=blendedDepth(blend);lastBlend=blend;}
   const amplitude=maxDepth?val('crush')/maxDepth*compressT:0;
   for(const mesh of wedges){mesh.morphTargetInfluences[0]=amplitude*(1-blend);mesh.morphTargetInfluences[1]=amplitude*blend;}
  }
  if(!report)return;
  const readouts=controls.filter(c=>!['bearing','elevation'].includes(c.key)||c.value!==0).map(c=>{
   if((wedgePose||items.some(i=>i.tractionTiming))&&c.key==='travel')return {label:'骨段参照点平移',num:format(Math.max(...items.map(i=>i.pivot.position.distanceTo(i.anchor)))/mm),unit:'mm'};
   if((wedgePose||items.some(i=>i.tractionTiming))&&c.key==='spin')return {label:'骨段转角',num:format(Math.max(...items.map(i=>i.pivot.quaternion.angleTo(identity)))/rad),unit:'°'};
   if(guidedWrist&&c.key==='shorten'){
    const axial=tagged[0].pivot.position.clone().sub(tagged[0].anchor).dot(frame.axis)/mm;
    return {label:axial>=0?'轴向缩短':'轴向分离',num:format(Math.abs(axial)),unit:'mm'};
   }
  if(c.key==='travel'&&joint)return {label:'平移',num:format(primary.pivot.position.distanceTo(primary.anchor)/mm),unit:'mm'};
  if(c.key==='tilt'){
    const dorsal=(c.value+clinical.palmar)*angleT-clinical.palmar;
    return {label:dorsal>=0?'背倾':'掌倾',num:format(Math.abs(dorsal)),unit:'°'};
   }
   if(staged&&c.key==='shorten')return {label:'轴向缩短',num:format(Math.max(0,primary.pivot.position.clone().sub(primary.anchor).dot(frame.axis)/mm)),unit:'mm'};
   const t=['bearing','elevation'].includes(c.key)?1:c.key==='footRoll'?eased(p,.19,.76):c.key==='breadth'?1:c.key==='crush'?compressT:c.key==='jointTwist'?jointT:['spin','angle','rotate'].includes(c.key)?stagedTurn:['shorten','separate'].includes(c.key)?lengthT:c.key==='side'?stagedSlide:shiftT;
   return {label:tagged[0]?.tuned==='wrist'&&c.key==='shorten'?'附加缩短':({travel:'平移',bearing:'水平偏角',elevation:'仰俯偏角',spin:'转角',jointTwist:internal?'内旋':'外旋',crush:'局部压低',breadth:'分布拓宽',footRoll:clinical.ankleSign>0?'内翻':'外翻'}[c.key]||names[c.key]),num:format(c.value*t),unit:c.unit};
  });
  if(primary?.posture){
   const u=eased(p,.10,.78),[flex,,side]=primary.posture;
   if(flex)readouts.push({label:flex<0?'屈曲':'后伸',num:format(Math.abs(flex)*u),unit:'°'});
   if(side)readouts.push({label:side<0?'外展':'内收',num:format(Math.abs(side)*u),unit:'°'});
  }
  if(guidedWrist){
   const wrist=tagged[0],sagittal=(wrist.pivot.position.z-wrist.anchor.z)/mm;
   if(Math.abs(sagittal)>.05)readouts.push({label:sagittal>0?'伴随掌移':'伴随背移',num:format(Math.abs(sagittal)),unit:'mm'});
  }
  if(opening>.05){
   const length=readouts.find(a=>['轴向缩短','轴向分离'].includes(a.label));
   const axial=(val('shorten')-val('separate'))*lengthT-opening;
   if(length){length.label=axial>0?'轴向缩短':'轴向分离';length.num=format(Math.abs(axial));}
   else readouts.push({label:'伴随轴向让位',num:format(opening),unit:'mm'});
  }
  const tray=document.getElementById('liveValues');
  if(tagged[0]?.tuned==='shaft'&&val('shorten')>0){
   const total=width*clearWidths*clearT+val('side')*shiftT;
   const sideReading=readouts.find(x=>x.label===names.side);
   if(sideReading){sideReading.label='合计侧移';sideReading.num=format(total);}
   else readouts.push({label:'伴随侧移',num:format(total),unit:'mm'});
  }
  const text=readouts.map(a=>a.label+' '+a.num+' '+a.unit).join('　');
  if(tray.textContent!==text)tray.textContent=text;
 }
 const identity=new T.Quaternion();
 apply.footRoll=()=>val('footRoll',12);
 apply.setSeverityScale=factor=>{
  const scalable=new Set(['travel','spin','shorten','separate','side','angle','rotate','tilt','jointTwist','crush']);
  let touched=false;
  for(const c of controls){
   if(!scalable.has(c.key))continue;
   const next=factor===1?c.base:limit(Math.round((c.base*factor)/c.step)*c.step,c.min,c.max);
   c.value=next;
   c.input.value=next;
   if(factor===1)delete values[c.key];
   else values[c.key]=next;
   c.paint();
   touched=true;
  }
  if(touched)onEdit();
  return touched;
 };
 return apply;
}
