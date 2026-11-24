import {prepareSoftTissues} from './soft-tissue-view.js?v=limb-soft4';
import {fitTissueSkeleton} from './tissue-registration.js';
import {linkSoftTissues} from './tissue-motion.js?v=limb-soft4';
import {isLimbBone} from './soft-tissue-catalog.js?v=limb-soft4';
import {clinicalSoftTissueFor} from './soft-tissue-clinical.js?v=limb-soft4';
import {createSoftTissuePanel} from './soft-tissue-panel.js?v=limb-soft4';
import {injuryDescription} from './injury-description.js';
import {vertebralCompression} from './vertebral-compression.js';
import {loadOverviewBytes} from './preview-mirror.js';
import {assembledSurfaces,detailRegions,regionsForScene} from './assembly-detail.js';
import {motionGuide} from './motion-guides.js';
import {cutField} from './cut-field.js?v=tissue-motion1';
import {guidesFor,updateAnatomyPanel} from './anatomy-panel.js';
import {canonicalCourse,variantIndex} from './variant-registry.js';
import {showExamPoints} from './exam-points.js?v=limb-soft2';
import {frameBone} from './bone-framing.js';
import * as T from './vendor/three.module.js';
import {ViewControls} from './view-controls.js';
import { courses as fractures,levels } from './courses.js';
import { section,atLevel,sliceMetrics,branchSection,shortShaftCut } from './geometry.js?v=tissue-motion1';

import {boneName,teachingBone,regionFor,buildIndex} from './bone-index.js?v=limb-soft2';
import {featuresFor,initialShape,shapeNames,motionNames,withShape,customPose} from './features.js';

import {makeObservation,wristLandmarks} from './observation.js';
import {decodeSurfaces,alignPreview,landmarkMap,landmark,planeNormal,inReflectedFrame} from './detail.js';
import {orderRim,injuryTime} from './injury-timing.js';
import {cutMaterial} from './cut-material.js';
import {fractureProfile} from './fracture-surface.js';
import {digitJointPath} from './digit-joints.js';
import {elbowStudy,shoulderStudy} from './elbow-specimen.js';
import {plateauSite,applyPlateauBed,followPlateauRim,plateauProfile} from './plateau.js';
import {bartonSurface} from './measured-wrist.js';
import {canalSampler} from './endosteum.js';
import {digitalCut} from './digit-frame.js';
import {specimenLibrary} from './specimen.js?v=eedd848';
import {lunateAdjuncts} from './lunate-adjuncts.js';
import {carpalAlignment} from './carpal-alignment.js';
import {typeView} from './clinical-types.js';
import {hasTraction} from './traction.js';
import {createFrameTray} from './frame-tray.js';
import {supplementalCourses} from './supplemental.js';
import {regionalCourses} from './regional-courses.js';
import {joints} from './joints.js';
import {prepareImpaction,prepareRamusCompression} from './impaction.js';
import {buildMechanics} from './mechanics.js';
import {specimenFits} from './vhm-fits.js';
import {fittedShifts} from './fitted-shifts.js';
import {nativeAnchor,addSurfaceLesson,surfaceTree} from './surface-lessons.js';
import {fragmentEditor,isFragmentKey,hasEdits,clearEdits} from './fragment-motion.js';
import {buildKinematics,shaftFrame} from './kinematics.js';
const courses=[...fractures,...regionalCourses,...supplementalCourses,...joints].map(canonicalCourse);
const ghostMaterial=new T.MeshBasicMaterial({color:0x569a96,transparent:true,opacity:.22,depthWrite:false});
const editedMaterial=new T.MeshStandardMaterial({color:0xb75f36,roughness:.75,side:T.DoubleSide});
const displacedMaterial=new T.MeshStandardMaterial({color:0xd8bea0,roughness:.75,side:T.DoubleSide});
let profile=null,profileMarks=[],fragmentMarks=[],anatomyGuides=[],bedRims=[],alignment=null,timing=null,mechanics=null,poseLimit=null,impaction=null;
let fragmentRig=null,chosenFragment=null,repeating=false,holdUntil=0;
let legacyMotion=false,quantities={},applyMotion=null,inspection=null,studyMode='overview',markName='',dirty=true;
const markLayer=document.getElementById('markLayer');
const markLabels=[];let viewWidth=1,viewHeight=1;
function paintLabels(){
 const locationMarks=$('anatomyPanel').open&&$('anatomyGuides').checked?anatomyGuides:[];
 const boneTags=tissueEntry&&!tissueEntry.aligned?[]:[...(inspection?.tags||[]),...profileMarks,...fragmentMarks,...locationMarks];
 const tissueTags=[];
 if(tissueEntry){
  for(const tag of tissueEntry.tags){
   const item=tissueEntry.items?.find(it=>it.key===tag.structureKey);
   if(!item||item.mesh.visible)tissueTags.push(tag);
  }
  if(tissueEntry.selectedKey&&!tissueTags.some(t=>t.structureKey===tissueEntry.selectedKey)){
   const sel=tissueEntry.items?.find(it=>it.key===tissueEntry.selectedKey&&it.mesh.visible);
   if(sel){
    const box=new T.Box3().setFromObject(sel.mesh);
    tissueTags.unshift({
     text:sel.info.zh,
     point:box.getCenter(new T.Vector3()),
     layer:sel.layer,
     sublayer:sel.sublayer,
     structureKey:sel.key,
     selected:true
    });
   }
  }
 }
 const tags=[...boneTags,...tissueTags.slice(0,boneTags.length?4:6)],placed=[];
 markLayer.hidden=!tags.length;
 while(markLabels.length<tags.length){
  const el=document.createElement('span');el.className='pin';markLayer.append(el);markLabels.push(el);
 }
 markLabels.forEach((el,i)=>{
  if(!tags[i]){el.hidden=true;return;}
  const tag=tags[i];
  const pt=tag.point.clone();if(i<boneTags.length)pt.x*=group.scale.x;pt.project(camera);
  const x=(pt.x+1)*viewWidth/2,y=(1-pt.y)*viewHeight/2;
  el.hidden=pt.z<0||pt.z>1||x<10||x>viewWidth-10||y<28||y>viewHeight-56;
  if(el.hidden)return;
  const left=x>viewWidth*.48;
  const estW=Math.max(76,Math.min(185,tag.text.length*13+24));
  const boxX=left?x-32-estW:x+32;
  let dy=0;
  const collides=shift=>{
   const ty=y+shift;
   if(ty<28||ty>viewHeight-56)return true;
   return placed.some(b=>Math.abs(b.y-ty)<26&&boxX<b.x+b.w+8&&boxX+estW+8>b.x);
  };
  if(collides(0)){
   for(const step of [28,-28,56,-56,84,-84]){
    if(!collides(step)){dy=step;break;}
   }
  }
  placed.push({x:boxX,y:y+dy,w:estW});
  el.style.setProperty('--slope',(dy?Math.max(-42,Math.min(42,(left?1:-1)*dy*.75)):0)+'deg');
  el.style.setProperty('--tag-y',dy+'px');
  const isTissue=Boolean(tag.structureKey);
  const isSel=isTissue&&tissueEntry?.selectedKey===tag.structureKey;
  el.className='pin'+(left?' left':'')+(isTissue?' pin-tissue pin-'+(tag.sublayer||tag.layer):'')+(isSel?' pin-selected':'');
  el.dataset.structure=tag.structureKey||'';
  el.style.left=x+'px';el.style.top=y+'px';
  if(el.textContent!==tag.text)el.textContent=tag.text;
 });
}
markLayer.addEventListener('click',e=>{
 const pin=e.target.closest?.('.pin-tissue');
 if(pin?.dataset.structure)selectSoftStructure(pin.dataset.structure);
});
function setStudy(mode){
 studyMode=mode;syncStudy();syncPlayer();playing=false;
 if(mode==='facet')aim(course?.id==='radius'||course?.id==='intercondylar'||course?.id==='distalfemur'?'inferior':'top',true);
 if(mode==='motion'&&course?.id==='radius')aim('side',true);
 setProgress(progress<.32&&mode!=='overview'?1:progress);if(mode==='cut')aimAtFace();
}
function palateView(geometry,localWidth){
 const guide=geometry?.userData.oralTrace;if(!guide)return false;
 const target=vec(guide.focus_m),dir=vec(guide.camera_direction).normalize(),aspect=Math.min(1,camera.aspect);
 flight=null;controls.target.copy(target);
 camera.position.copy(target).addScaledVector(dir,localWidth/(2*Math.tan(T.MathUtils.degToRad(camera.fov*.5))*aspect));
 controls.update();dirty=true;return true;
}
function aimAtFace(){
 const v=inspection?.cutView();if(!v)return;
 flight=null;const aspect=Math.min(1,camera.aspect);
 const d=Math.max(.012,v.size)*1.35/(2*Math.tan(T.MathUtils.degToRad(camera.fov*.5))*aspect);
 controls.target.copy(v.centre);camera.position.copy(v.centre).addScaledVector(v.dir,d);controls.update();dirty=true;
}
function syncStudy(){
 const active=Boolean(inspection);
 const share=inspection?.surfaceShare;
 $('surfaceShare').hidden=!Number.isFinite(share);$('showRim').hidden=$('surfaceShare').hidden;
 if(Number.isFinite(share))$('surfaceShare').textContent='着色的桡腕关节面中，约 '+Math.round(share*100)+'% 位于活动骨片。';
 $('studyTools').hidden=!active;
 $('viewSeam').hidden=!active||course?.id!=='tibia'||variant!==1||(shape&&shape!=='spiral');
 for(const b of document.querySelectorAll('[data-study]')){
  const m=b.dataset.study;b.disabled=!active||(m==='cut'&&!inspection?.cut)||(m==='facet'&&!inspection?.patch);
  b.setAttribute('aria-pressed',String(active&&m===studyMode));
 }
 $('nextPart').hidden=studyMode!=='cut'||!inspection?.cut;
 if(!$('nextPart').hidden)$('nextPart').textContent='切换骨块　'+inspection.fragment();
 $('inspectHelp').textContent=({cut:'单独旋转这块骨，沿赭色断面边缘追踪骨折线。',motion:'青线为参照，赭线随骨块运动；纵线看成角，横线看旋转，两点连线看平移。',facet:'青绿色标出关节面近似区域。转到关节端，观察断线是否穿入着色区。',overview:'旋转对照骨折处，拖动时间轴查看同一骨块的伤前与伤后位置。'})[studyMode];
 if(studyMode==='cut'&&animated.some(i=>i.face?.geometry.userData.canal)){
  const measured=animated.some(i=>i.face?.geometry.userData.canalMeasured);
  $('inspectHelp').textContent=measured?'浅色为皮质断缘，内缘勾出髓腔边界。中央凹面及断面起伏为教学示意。':'浅色断缘为皮质，中央为估算的髓腔区。斜向观察断面起伏。';
 }
 if(studyMode==='facet'&&inspection?.patch)$('inspectHelp').textContent=inspection.crosses?(inspection.measurements()?'断线进入着色区。对照同源点的法向高差与面内错位。':'断线进入着色区，旋转模型可沿着色面追踪断缘。'):'在本模型的青绿色标示区未检出断线交点。转动比较断面与关节面的距离。';
 if(studyMode==='motion'&&course?.id==='radius')$('inspectHelp').textContent='比较伤前、伤后的掌背缘连线。侧面看背移与倾斜，正面看桡移。';
 if(course?.kind==='joint'&&studyMode==='overview')$('inspectHelp').textContent='先固定观察关节窝，再比较活动骨端在伤前、移出过程和终点的位置。';
 if(course?.kind==='joint'&&studyMode==='motion')$('inspectHelp').textContent='固定关节窝，沿两点连线比较骨端如何离开原位。';
}

const assetURL=u=>u.startsWith('models/detail')?u+'?native-f32-v1':u;
const $=id=>document.getElementById(id), host=$('viewport');
const boneData=new Map(), animated=[], annotations=[], nearBones=[],jointReferences=[], deformationGhosts=[],pieces=[],wedges=[];
const world=new T.Scene(), group=new T.Group();world.add(group);
const tissues=prepareSoftTissues();
const tissueControls={muscles:'softMuscles',vessels:'softVessels',nerves:'softNerves'};
let tissueEntry=null,tissueRequest=null,tissueReturn=null;
let softFocusOnly=true,softMuscleOpacity=0.28,softShowArrows=true,softDepthLevel=1,softClipAxis='none',softClipFrac=0.5,lastTelemetryAt=0;
const DEPTH_TEXT={1:'全部肌层',2:'已剥离浅层肌',3:'仅留深层肌',4:'隐藏肌层（仅脉神）'};
const softClipPlane=new T.Plane(new T.Vector3(0,0,-1),0);

function updateSoftClipPlane(){
 $('softClipPosRow').hidden=softClipAxis==='none';
 $('softClipVal').textContent=Math.round(softClipFrac*100)+'%';
 if(!tissueEntry){return;}
 if(softClipAxis==='none'){
  tissueEntry.setClipPlane(null);
  dirty=true;
  return;
 }
 const box=new T.Box3().setFromObject(tissueEntry.root);
 if(box.isEmpty()){tissueEntry.setClipPlane(null);return;}
 const min=box.min,max=box.max;
 if(softClipAxis==='ap'){
  // Slice away anterior tissues progressively from front (+Z) toward back (-Z)
  const z=T.MathUtils.lerp(max.z,min.z,softClipFrac);
  softClipPlane.set(new T.Vector3(0,0,-1),z);
 }else if(softClipAxis==='pa'){
  // Slice away posterior tissues from back (-Z) toward front (+Z)
  const z=T.MathUtils.lerp(min.z,max.z,softClipFrac);
  softClipPlane.set(new T.Vector3(0,0,1),-z);
 }else if(softClipAxis==='lat'){
  const isLeft=/\bleft\b/i.test(selected||'');
  const x=isLeft?T.MathUtils.lerp(max.x,min.x,softClipFrac):T.MathUtils.lerp(min.x,max.x,softClipFrac);
  softClipPlane.set(new T.Vector3(isLeft?-1:1,0,0),isLeft?x:-x);
 }else if(softClipAxis==='axial'){
  const y=T.MathUtils.lerp(max.y,min.y,softClipFrac);
  softClipPlane.set(new T.Vector3(0,-1,0),y);
 }
 tissueEntry.setClipPlane(softClipPlane);
 dirty=true;
}

function syncSoftQuickBar(){
 const anyActive=Object.values(tissueControls).some(id=>$(id).checked);
 for(const btn of document.querySelectorAll('[data-soft-toggle]')){
  const layer=btn.dataset.softToggle;
  btn.setAttribute('aria-pressed',String(Boolean($(tissueControls[layer])?.checked)));
 }
 $('softDisplayTools').hidden=!anyActive;
 $('softBarScope').disabled=!anyActive;
 $('softBarScope').textContent=softFocusOnly?'仅相关':'周边全部';
 $('softModeFocus').classList.toggle('active',softFocusOnly);
 $('softModeFocus').setAttribute('aria-pressed',String(softFocusOnly));
 $('softModeAll').classList.toggle('active',!softFocusOnly);
 $('softModeAll').setAttribute('aria-pressed',String(!softFocusOnly));
 $('softBarResetIso').hidden=!tissueEntry?.isolatedKey;
}

function selectSoftStructure(key){
 if(!tissueEntry)return;
 tissueEntry.highlight(key,'select');
 if(key){
  const item=tissueEntry.items.find(it=>it.key===key);
  if(item&&!item.mesh.visible){
   item.enabled=true;
   if(tissueEntry.isolatedKey&&tissueEntry.isolatedKey!==key)tissueEntry.isolatedKey=null;
   item.mesh.visible=true;
  }
  if(!$('softTissuePanel').open)$('softTissuePanel').open=true;
 }
 softPanel.refreshSelection();
 syncSoftQuickBar();
 dirty=true;
}

function hoverSoftStructure(key){
 if(!tissueEntry)return;
 if(tissueEntry.hoveredKey===key)return;
 tissueEntry.highlight(key,'hover');
 dirty=true;
}

function isolateSoftStructure(key){
 if(!tissueEntry)return;
 tissueEntry.isolatedKey=key;
 tissueEntry.applyVisibility();
 if(key)tissueEntry.highlight(key,'select');
 softPanel.refreshSelection();
 syncSoftQuickBar();
 dirty=true;
}

function toggleSoftItem(key,visible){
 if(!tissueEntry)return;
 const item=tissueEntry.items.find(it=>it.key===key);
 if(!item)return;
 item.enabled=visible;
 if(tissueEntry.isolatedKey===key&&!visible)tissueEntry.isolatedKey=null;
 if(visible&&softFocusOnly&&!item.isClinical)item.mesh.visible=true;
 else tissueEntry.applyVisibility();
 softPanel.refreshSelection();
 syncSoftQuickBar();
 dirty=true;
}

async function focusClinicalPattern(layer,pattern){
 if(!selected||!isLimbBone(selected))return;
 const boxId=tissueControls[layer];
 if(boxId&&!$(boxId).checked){
  $(boxId).checked=true;
  await showTissues();
 }
 if(!tissueEntry)return;
 const match=tissueEntry.items.find(it=>it.layer===layer&&pattern.test(it.key));
 if(match)selectSoftStructure(match.key);
}

const softPanel=createSoftTissuePanel({
 select:selectSoftStructure,
 hover:hoverSoftStructure,
 isolate:isolateSoftStructure,
 toggleItem:toggleSoftItem,
 focusPattern:focusClinicalPattern
});

function fitTissues(direction){
 const frame=tissueEntry.frame, centre=frame.getCenter(new T.Vector3()),size=frame.getSize(new T.Vector3());
 const height=Math.max(size.y,size.z*.64,size.x/camera.aspect);
 const radius=height*.63/Math.tan(T.MathUtils.degToRad(camera.fov/2));
 flight=null;controls.target.copy(centre);camera.position.copy(centre).addScaledVector(direction.normalize(),Math.max(.1,radius));
 controls.update();dirty=true;
}
function leaveTissues(restore=true){
 if(!tissueEntry)return;
 tissueEntry.motion?.dispose();
 tissues.detach(tissueEntry);tissueEntry=null;group.visible=true;
 softPanel.setEntry(null);
 document.body.classList.remove('tissues-active','tissues-linked');
 delete host.dataset.softLayers;delete host.dataset.softMode;delete host.dataset.softDisplacement;
 if(tissueReturn)$('description').textContent=tissueReturn.description;
 document.querySelector('.player').inert=loadingSpecimen;
 $('copyLink').disabled=false;$('softReturn').hidden=true;
 if(restore&&tissueReturn?.position){
  camera.position.copy(tissueReturn.position);camera.up.copy(tissueReturn.up);controls.target.copy(tissueReturn.target);
  controls.update();
 }
 tissueReturn=null;
 syncSoftQuickBar();
 syncPlayer();dirty=true;
}
function closeTissues(restore=true,clearCache=false){
 tissueRequest?.abort();tissueRequest=null;
 leaveTissues(restore);
 if(clearCache)tissues.clear();
 for(const id of Object.values(tissueControls))$(id).checked=false;
 $('softStatus').hidden=true;
 syncSoftQuickBar();
}
function tissueSection(key){
 if(!lessonOpen())return '';
 if(/femur/i.test(key)&&['hip-dislocation','neck','trochanter'].includes(course.id))return 'proximal';
 if(/femur/i.test(key)&&['distalfemur','intercondylar','knee-dislocation','patella-dislocation'].includes(course.id))return 'distal';
 if(/humerus/i.test(key)&&['shoulder','shoulder-dislocation'].includes(course.id))return 'proximal';
 if(/humerus/i.test(key)&&['elbow','elbow-dislocation','lateral-elbow','medial-elbow'].includes(course.id))return 'distal';
 if(/ulna|radius/i.test(key)&&['elbow-dislocation','olecranon','radial-head','monteggia'].includes(course.id))return 'proximal';
 if(/radius/i.test(key)&&['radius','galeazzi'].includes(course.id))return 'distal';
 if(/tibia|fibula/i.test(key)&&['plateau','knee-dislocation'].includes(course.id))return 'proximal';
 if(/tibia|fibula/i.test(key)&&course.id==='ankle')return 'distal';
 return '';
}
function updateLinkedTissues(forceTelemetry=false){
 if(!tissueEntry?.motion)return;
 host.dataset.softDisplacement=String(tissueEntry.motion.update());
 host.dataset.softDamageGrade=String(tissueEntry.motion.telemetry.maxGrade||0);
 const now=performance.now();
 if(forceTelemetry||!playing||now-lastTelemetryAt>90){
  lastTelemetryAt=now;
  softPanel.updateTelemetry(tissueEntry.motion.telemetry);
 }
}
async function showTissues(){
 const layers=Object.keys(tissueControls).filter(layer=>$(tissueControls[layer]).checked);
 syncSoftQuickBar();
 if(!layers.length){closeTissues();return;}
 if(!selected||!isLimbBone(selected)){
  closeTissues();
  $('softStatus').textContent='当前软组织图谱专注四肢骨骼；请先点击上肢或下肢骨骼。';
  $('softStatus').hidden=false;
  return;
 }
 if(!ready||loadingSpecimen){
  $('softStatus').textContent='请等当前骨面加载完成…';$('softStatus').hidden=false;return;
 }
 tissueRequest?.abort();leaveTissues(false);
 const request=new AbortController(),current=viewSerial;
 tissueRequest=request;$('softStatus').textContent='正在载入四肢高精度软组织…';$('softStatus').hidden=false;
 const v=lessonOpen()?course.variants[variant]:null;
 const affected=v?(v.cuts.find(cut=>cut.bone===teachingBone(selected))||v.cuts[0]).bone:null;
 const patientBone=affected&&/\bleft\b/i.test(selected)?
  affected.replace(/\bright\b/ig,value=>value==='Right'?'Left':'left'):affected||selected;
 const clinical=clinicalSoftTissueFor(lessonOpen()?course:null,variant,level,patientBone);
 try{
  const reference=await tissues.load(layers,patientBone,request.signal,{
   section:tissueSection(patientBone),
   courseId:lessonOpen()?course.id:'',
   clinical,
   focusOnly:softFocusOnly,
   muscleOpacity:softMuscleOpacity,
   depthLevel:softDepthLevel,
   clipPlane:softClipAxis==='none'?null:softClipPlane
  });
  if(request.signal.aborted||current!==viewSerial){tissues.detach(reference);return;}
  tissueReturn={description:$('description').textContent};
  group.updateMatrixWorld(true);
  let motion=null,aligned=false;
  if(v){
   const drivers=animated.filter(item=>item.jointLabel||item.shell).sort((a,b)=>
    Number(Boolean(b.moving||b.jointLabel))-Number(Boolean(a.moving||a.jointLabel)));
   const target=affected?lessonMesh(affected):null;
   const actor=drivers.find(item=>item.name===affected)||drivers[0];
   const focusPt=(actor?.cutReference||actor?.anchor)?.clone().applyMatrix4(group.matrixWorld);
   const match=fitTissueSkeleton(reference.pairedBone,target,group.matrixWorld,focusPt);
   if(match?.accepted){
    motion=linkSoftTissues(reference,match,group,drivers,wedges,{showArrows:softShowArrows});
    aligned=Boolean(motion);
   }
  }else if(selectedMesh){
   // Single-bone zoomed view: register limb soft tissues directly onto the zoomed high-detail bone!
   const match=fitTissueSkeleton(reference.pairedBone,selectedMesh.geometry,group.matrixWorld,null);
   if(match?.accepted){
    reference.root.applyMatrix4(match.matrix);
    reference.root.updateMatrixWorld(true);
    for(const t of reference.tags)t.point.applyMatrix4(match.matrix);
    reference.root.traverse(node=>{if(node.isMesh&&node.userData.atlasLayer==='bones')node.visible=false;});
    aligned=true;
   }
  }
  if(!motion)reference.applyStaticCalibers();
  const dynamic=Boolean(motion&&(wedges.length||animated.some(item=>item.moving||item.jointLabel)));
  if(!aligned){
   Object.assign(tissueReturn,{position:camera.position.clone(),up:camera.up.clone(),target:controls.target.clone()});
   playing=false;if(lessonOpen())setProgress(progress);
  }
  tissueEntry={...reference,motion,aligned};world.add(reference.root);
  if(softClipAxis!=='none')updateSoftClipPlane();
  group.visible=aligned;if(!aligned){flight=null;automaticFit=false;}
  $('description').textContent=dynamic?'四肢软组织随骨段联动 · 点击结构查名称':aligned?'四肢局部软组织 · 悬停或点击查名称':'配套骨面与伤前软组织';
  document.body.classList.add('tissues-active');
  document.body.classList.toggle('tissues-linked',aligned);
  host.dataset.softLayers=layers.join(',');host.dataset.softMode=motion?'linked':aligned?'aligned':'reference';
  document.querySelector('.player').inert=lessonOpen()&&!aligned;
  $('copyLink').disabled=!aligned;$('softReturn').hidden=false;
  const shownCount=reference.items.filter(it=>it.mesh.visible).length;
  $('softStatus').textContent=(dynamic?'已联动显示 ':aligned?'已配准显示 ':'伤前参照显示 ')+shownCount+' 项四肢软组织（悬停或点击查名称）';
  $('labels').hidden=true;$('tip').hidden=true;
  softPanel.setEntry(tissueEntry);
  syncSoftQuickBar();
  syncPlayer();
  if(motion){updateLinkedTissues(true);dirty=true;}
  else if(aligned){dirty=true;}
  else fitTissues(camera.position.clone().sub(controls.target));
 }catch(error){
  if(request.signal.aborted)return;
  closeTissues();$('softStatus').textContent=error?.message||'当前软组织载入失败，可重新选择。';$('softStatus').hidden=false;
  console.warn(error);
 }
}
for(const id of Object.values(tissueControls))$(id).onchange=showTissues;
$('softReturn').onclick=()=>closeTissues();
$('softAllOn').onclick=()=>{
 for(const id of Object.values(tissueControls))$(id).checked=true;
 showTissues();
};
for(const btn of document.querySelectorAll('[data-soft-toggle]')){
 btn.onclick=()=>{
  const id=tissueControls[btn.dataset.softToggle];
  if(!id)return;
  $(id).checked=!$(id).checked;
  showTissues();
 };
}
function setSoftFocusMode(focusOnly){
 softFocusOnly=focusOnly;
 if(tissueEntry){
  tissueEntry.focusOnly=focusOnly;
  tissueEntry.isolatedKey=null;
  tissueEntry.applyVisibility();
  softPanel.refreshSelection();
  dirty=true;
 }
 syncSoftQuickBar();
}
$('softModeFocus').onclick=()=>setSoftFocusMode(true);
$('softModeAll').onclick=()=>setSoftFocusMode(false);
$('softBarScope').onclick=()=>setSoftFocusMode(!softFocusOnly);
$('softBarResetIso').onclick=()=>isolateSoftStructure(null);
$('softMuscleOpacity').oninput=e=>{
 softMuscleOpacity=Number(e.target.value)/100;
 $('softOpacityVal').textContent=e.target.value+'%';
 if(tissueEntry){tissueEntry.setMuscleOpacity(softMuscleOpacity);dirty=true;}
};
$('softShowArrows').onchange=e=>{
 softShowArrows=e.target.checked;
 tissueEntry?.motion?.setArrowsVisible(softShowArrows);
 dirty=true;
};
$('softDepthSlider').oninput=e=>{
 softDepthLevel=Number(e.target.value);
 $('softDepthVal').textContent=DEPTH_TEXT[softDepthLevel]||'全部肌层';
 if(tissueEntry){
  tissueEntry.setDepthLevel(softDepthLevel);
  softPanel.refreshSelection();
  updateLinkedTissues(true);
  dirty=true;
 }
};
$('softClipAxis').onchange=e=>{
 softClipAxis=e.target.value;
 updateSoftClipPlane();
};
$('softClipPos').oninput=e=>{
 softClipFrac=Number(e.target.value)/100;
 updateSoftClipPlane();
};
for(const btn of document.querySelectorAll('[data-severity]')){
 btn.onclick=()=>{
  const factor=Number(btn.dataset.severity);
  for(const b of document.querySelectorAll('[data-severity]'))b.classList.toggle('active',b===btn);
  if(applyMotion?.setSeverityScale){
   applyMotion.setSeverityScale(factor);
   updateLinkedTissues(true);
  }
 };
}

const bone=new T.MeshStandardMaterial({color:0xe9e2c9,roughness:.84,side:T.DoubleSide});
const accent=new T.MeshStandardMaterial({color:0x7bbdaa,roughness:.83,side:T.DoubleSide});
const adjacent=new T.MeshStandardMaterial({color:0x658783,roughness:1,side:T.DoubleSide,transparent:true,opacity:.55,depthWrite:false});
const palateMaterials=[new T.MeshStandardMaterial({color:0x89b9ac,roughness:.9,side:T.DoubleSide}),new T.MeshStandardMaterial({color:0xdcc798,roughness:.9,side:T.DoubleSide}),new T.MeshStandardMaterial({color:0xc78064,roughness:.9,side:T.DoubleSide})];
const palateSurround=new T.MeshStandardMaterial({color:0xa1aba1,transparent:true,opacity:.125,depthWrite:false,roughness:1,side:T.FrontSide});
const cap=cutMaterial(0xd6bf9e,.32);
const shaftMaterials=[cap,cutMaterial(0xb29a7d,.35),cutMaterial(0xa2775e,.48)];
const line=new T.LineBasicMaterial({color:0x8d3f26});
const vec=a=>new T.Vector3(...a), zero=new T.Vector3();
let contextLost=false;
let renderer,camera,controls,course=null,variant=-1,level=1,progress=0,playing=false,speed=1;
let fractureFocus=new T.Vector3();
let focus=new T.Vector3(),span=.45,distance=.7,previous=0,ready=false;
const keyByMesh=new Map(),meshByKey=new Map();
let selected=null,shape='',motions=[],flight=null,hovered=null,lastLabelView='';
let anklePose=null,poseGuide=null,motionWords=[];

function lessonOpen(){return Boolean(course&&variant>=0&&selected);}
function jointView(){
 const id=course?.id,v=course?.variants[variant];
 if(course?.kind!=='joint')return id==='radius'?'side':'home';
 if(id==='lisfranc-dislocation')return 'top';
 if(id==='patella-dislocation'||id==='knee-dislocation'&&variant>=2||id==='pip-dislocation'&&variant===1||id==='elbow-dislocation'&&variant===1)return 'front';
 if(v?.nativePoint&&/\bleft\b/i.test(selected))return 'leftSide';
 return 'side';
}
function syncPlayer(){
 const open=lessonOpen()&&(!tissueEntry||Boolean(tissueEntry.aligned));
 $('frameNavigation').hidden=!open;
 $('quickPlay').hidden=!open;
 $('quickEdit').hidden=!open||$('advanced').hidden;
}
const byBone=new Map();
for(const c of courses){
 const direct=new Set(c.variants.flatMap(v=>v.cuts.map(s=>s.bone)));
 for(const name of new Set(c.variants.flatMap(bonesFor))){
  if(!byBone.has(name))byBone.set(name,[]);
  byBone.get(name).push({c,direct:direct.has(name)});
 }
}
for(const [name,rows] of byBone)byBone.set(name,rows.sort((a,b)=>Number(b.direct)-Number(a.direct)).map(r=>r.c));
function buttons(host,choices,selected,action){
 host.replaceChildren();
 choices.forEach((label,i)=>{
  const b=document.createElement('button');b.textContent=label;b.classList.toggle('active',i===selected);
  b.setAttribute('aria-pressed',String(i===selected));b.onclick=()=>action(i);host.append(b);
 });
}
function materialize(meta,bytes){
 const g=new T.BufferGeometry(), positions=new Float32Array(bytes,meta.offset,3*meta.vertices);
 g.setAttribute('position',new T.BufferAttribute(positions,3));
 g.setIndex(new T.BufferAttribute(new Uint16Array(bytes,meta.offset+positions.byteLength,meta.indices),1));
 g.computeVertexNormals();g.computeBoundingBox();return g;
}
function clearScene(){
 profile?.dispose();profile=null;profileMarks=[];bedRims=[];alignment?.dispose();alignment=null;mechanics?.dispose();mechanics=null;timing=null;impaction=null;poseLimit=null;$('contactState').textContent='';
 fragmentRig?.dispose();fragmentRig=null;anklePose=null;poseGuide=null;motionWords=[];inspection=null;dirty=true;syncStudy();applyMotion=null;$('liveValues').textContent='';$('motionReadout').textContent='';$('motionReadout').classList.remove('with-reference');hovered=null;$('tip').hidden=true;group.scale.x=1;
 group.traverse(o=>{if(o.userData.dispose)o.geometry?.dispose();if(o.isArrowHelper||o.type==='ArrowHelper')o.dispose?.();});
 group.traverse(o=>{
  for(const resource of o.userData.cutResources||[])resource.dispose();
 });
 group.clear();animated.length=annotations.length=nearBones.length=jointReferences.length=deformationGhosts.length=pieces.length=wedges.length=0;fragmentMarks=[];anatomyGuides=[];
}
const specimen=specimenLibrary(async u=>await fetch(u));
let atlasPalate=false,regionReference=false,loadingSpecimen=false,useSpecimen=false,viewSerial=0;
let assemblyDetail;
const reflectedMeshes=new Map(),overviewMeshes=new Map();
function lessonMesh(name){
 if(useSpecimen)return specimen.get(name,lessonOpen()&&/left/i.test(selected));
 if(!lessonOpen()||!/\bleft\b/i.test(selected))return boneData.get(name);
 if(reflectedMeshes.has(name))return reflectedMeshes.get(name);
 const partner=name.replace(/\b(left|right)\b/i,side=>({left:'right',right:'left',Left:'Right',Right:'Left'}[side]));
 let target=boneData.get(partner);
 if(!target&&/ FJ\d+$/.test(partner)){
  const prefix=partner.replace(/ FJ\d+$/,' FJ');
  const id=[...boneData.keys()].find(k=>k.startsWith(prefix));target=boneData.get(id);
 }
 if(!target)throw Error('未找到对侧骨面 '+partner);
 const mesh=inReflectedFrame(target);reflectedMeshes.set(name,mesh);return mesh;
}
function addBone(name,material,parent=group){
 const g=lessonMesh(name);if(!g)return;
 const m=new T.Mesh(g,g.userData.oralTrace&&material===bone?palateMaterials:name==='Posterior hard palate region'?palateSurround:material);m.userData.bone=name;parent.add(m);return m;
}
function addPart(part,anchor,motion,material){
 const moving=motion.shift.some(Boolean)||motion.turn.some(Boolean);
 const pivot=new T.Group(),shell=new T.Mesh(part.geo,material),face=new T.Mesh(part.face,part.face.userData.canal?shaftMaterials:cap);
 const edge=new T.LineSegments(part.outline,line);
 for(const o of [shell,face,edge]){o.position.copy(anchor).negate();o.userData.dispose=true;pivot.add(o);}
 annotations.push(edge);pieces.push(shell);
 pivot.position.copy(anchor);group.add(pivot);
 const ghost=new T.Mesh(part.geo,ghostMaterial);ghost.visible=false;group.add(ghost);
 animated.push({pivot,anchor,ghost,shell,face,edge,name:markName,moving,tuned:motion.tuned,shift:vec(motion.shift).multiplyScalar(.001),turn:vec(motion.turn).multiplyScalar(Math.PI/180)});
 return pivot;
}
function addWedge(g,kind){
 const geometry=g.clone();
 geometry.morphAttributes=vertebralCompression(g,kind);
 geometry.morphTargetsRelative=true;
 const mesh=new T.Mesh(geometry,bone);
 mesh.userData.bone=markName;mesh.userData.dispose=true;group.add(mesh);wedges.push(mesh);
}
// Shape-only teaching presets need a disengagement along the new fracture
// surface. Authored clinical tracks and edited parameters still use contact limits.
function shapePreset(spec,g,anchor){
 if(!shape||shape==='wedgeFragment'||motions.length)return spec;
 const normal=vec(spec.spiralHeight?spec.spiralAxis:spec.normal).normalize();
 const paired=course.variants[variant].cuts.length>1;
 // Tibia/fibula and radius/ulna open together along their shared long axis.
 // Independent side motion would drive the two adjacent shafts into each other.
 const axis=paired||course.id==='single-forearm'?new T.Vector3(0,1,0):normal;
 if(axis.dot(normal)<0)axis.negate();
 const lateral=shaftFrame(new T.Vector3(),normal,false).side;
 const width=sliceMetrics(g,anchor,normal,lateral)?.width||.018;
 const gap=paired?.0042:T.MathUtils.clamp(width*.22,.0024,.010);
 const companionName=paired?course.variants[variant].cuts.find(cut=>cut.bone!==spec.bone)?.bone:course.id==='single-forearm'?(spec.bone.includes('radius')?'Right ulna':'Right radius'):null;
 const companion=companionName?lessonMesh(companionName):null;
 const away=new T.Vector3();
 const nativeSpiral=course.id==='single-forearm'&&variant===1&&/\bleft\b/i.test(selected)&&shape==='spiral';
 if(!paired&&companion&&!nativeSpiral){
  const box=companion.boundingBox,frac=T.MathUtils.clamp((anchor.y-box.min.y)/(box.max.y-box.min.y),.06,.94);
  away.copy(anchor).sub(vec(atLevel(companion,1,frac)));away.y=0;away.normalize().multiplyScalar(.0035);
 }
 const opening=sign=>({shift:axis.clone().multiplyScalar(sign*gap).add(away).multiplyScalar(1000).toArray(),turn:[0,0,0]});
 const relief=spec.relief&&!spec.spiralHeight?{...spec.relief,amplitude:0}:spec.relief;
 const prepared={...spec,relief,minus:opening(-1),plus:opening(1)};
 if(spec.second){
  const branchAxis=vec(spec.second).normalize();
  // The split surfaces have a dedicated branch normal. For the proximal
  // humerus, keep the preset opening on that normal to avoid shearing the two fragments.
  if(!(course.id==='humerus'&&variant===0))branchAxis.addScaledVector(axis,-branchAxis.dot(axis)).normalize();
  const spread=Math.max(.8,width*70);
  const toward=companion?companion.boundingBox.getCenter(new T.Vector3()).sub(anchor).dot(branchAxis):0;
  prepared.branches=[-1,1].map(sign=>({shift:branchAxis.clone().multiplyScalar(sign*toward>0?0:sign*spread).toArray(),turn:[0,0,0]}));
 }
 return prepared;
}
function addFracture(spec,anchor){
 const g=lessonMesh(spec.bone), pair=section(g,spec.normal,anchor.toArray(),spec.fold,spec.spiralHeight,spec.spiralAxis,Infinity,spec.posteriorSpiral,spec.relief);
 const pivot=spec.pivot?vec(spec.pivot):anchor;
 const start=animated.length;
 addPart(pair[0],pivot,spec.minus,bone);
 const baseFace=animated[start].face,resources=[];
 const primary=!spec.fold&&!spec.spiralHeight&&!pair[0].face.userData.canal?
  cutField(pair[0].outline,anchor,vec(spec.normal)):null;
 function surfaceMaterial(field){
  if(!field)return cap;
  const material=cutMaterial(0xd6bf9e,.32,field);
  resources.push(material,field.texture);
  return material;
 }
 const primaryMaterial=surfaceMaterial(primary);
 if(primary)baseFace.material=primaryMaterial;
 baseFace.userData.cutResources=resources;
 if(!spec.second){
  addPart(pair[1],pivot,spec.plus,bone);
  if(primary)animated[start+1].face.material=primaryMaterial;
  nameFragmentEnds(animated.slice(start),spec,anchor);
  return;
 }
 // Both planes have their own cortical rim even where the second cut crosses the first.
 const first=pair[1],halves=branchSection(first,spec.second,anchor.toArray());
 const secondRim=halves[0].outline;
 const branchMaterial=surfaceMaterial(cutField(secondRim,anchor,vec(spec.second),secondRim.userData.branchRimVertices));
 halves.forEach((half,i)=>{
  const branch=spec.branches?.[i]||{shift:[i?1:-1,0,0],turn:[0,0,0]};
  addPart(half,anchor,{shift:spec.plus.shift.map((v,k)=>v+branch.shift[k]),turn:spec.plus.turn.map((v,k)=>v+branch.turn[k]),tuned:spec.plus.tuned},bone);
  if(half.face.userData.canal)return;
  const border=half.face.userData.newSurfaceVertices;
  half.face.addGroup(0,border,0);
  half.face.addGroup(border,half.face.attributes.position.count-border,1);
  animated.at(-1).face.material=[branchMaterial,primaryMaterial];
 });
 nameFragmentEnds(animated.slice(start),spec,anchor);
 for(const g of [first.geo,first.face,first.outline])g.dispose();
}
function nameFragmentEnds(items,spec,anchor){
 const limb=/femur|tibia|fibula|humerus|ulna|radius|metacarpal|metatarsal|phalanx/i.test(spec.bone);
 const lower=spec.axis===2?'近端':'远端',upper=spec.axis===2?'远端':'近端';
 for(const item of items)if(!item.shell.geometry.boundingBox)item.shell.geometry.computeBoundingBox();
 const order=[...items].sort((a,b)=>a.shell.geometry.boundingBox.getCenter(new T.Vector3()).getComponent(spec.axis)-b.shell.geometry.boundingBox.getCenter(new T.Vector3()).getComponent(spec.axis));
 for(const [i,item] of order.entries()){
  const centre=item.shell.geometry.boundingBox.getCenter(new T.Vector3());
  item.segment=limb?(i===0?lower:i===order.length-1?upper:'中间骨块'):'骨块 '+(i+1);
  item.guidePoint=anchor.clone().lerp(centre,.24);
  if(limb){item.cutReference=anchor;item.segmentCentre=centre;}
 }
}
function motionLabels(){
 const parts=animated.filter(item=>item.guidePoint||item.jointLabel);
 const distinctBones=new Set(parts.filter(item=>item.name).map(item=>item.name)).size;
 const entries=parts.map(item=>{
  const rest=item.guidePoint||item.anchor;
  const point=rest.clone().sub(item.anchor).applyQuaternion(item.pivot.quaternion).add(item.pivot.position);
  const v=point.clone().sub(rest);v.x*=group.scale.x;
  const dirs=v.toArray().map((n,i)=>[Math.abs(n),anatomyDirections[i][Number(n<0)]]).sort((a,b)=>b[0]-a[0]);
  const significant=dirs.filter(([n])=>n>=Math.max(.0007,dirs[0][0]*.50)).slice(0,2);
  const boneLabel=distinctBones>1&&item.name?boneName(item.name).replace(/^[左右]/,''):'';
  const label=boneLabel+(item.segment||item.jointLabel);
  return {text:label+(significant.length?' · 向'+significant.map(([,name])=>name).join('、'):item.pivot.quaternion.angleTo(new T.Quaternion())>.02?' · 转动':''),point};
 });
 return entries;
}
function bonesFor(v){return [...v.cuts.map(c=>c.bone),...(v.fixed||[]),...(v.compareBones||[])];}
function matches(key){return key?(byBone.get(teachingBone(key))||[]):[];}
const smallScreen=matchMedia('(max-width:630px)');
let lastLesson='';
function setPanel(open){
 document.body.classList.toggle('panel-open',open);$('mobilePanel').setAttribute('aria-expanded',String(open));
}
function pickBone(key,{keepLesson=false,openPanel=smallScreen.matches}={}){
 $('anatomyPanel').open=false;
 if(!keepLesson)lastLesson='';
 legacyMotion=false;
 atlasPalate=false;regionReference=false;
 $('compareTypes').checked=false;
 $('advanced').open=false;$('fragmentBox').open=false;
 setPanel(openPanel);
 studyMode='overview';
 quantities={};chosenFragment=null;holdUntil=0;
 $('viewOptions').open=false;
 selected=key;course=matches(key)[0]||null;variant=-1;level=1;shape='';motions=[];playing=false;progress=0;
 updateURL();renderLesson(true);document.querySelector('.rail-scroll').scrollTop=0;
}
function pickVariant(i){
 legacyMotion=false;
 atlasPalate=false;regionReference=false;
 const locked=$('compareTypes').checked&&variant>=0;
 $('advanced').open=false;$('fragmentBox').open=false;
 if(!locked){studyMode='overview';progress=0;}
 quantities={};chosenFragment=null;holdUntil=0;variant=i;shape='';motions=[];playing=!locked;
 updateURL(locked);renderLesson(!locked,locked);
}
function saveCamera(params){
 if(!camera||!controls)return;
 params.set('space','native');
 params.set('cam',[...camera.position.toArray(),...controls.target.toArray()].map(x=>Number(x.toFixed(6))).join(','));
 params.set('up',camera.up.toArray().map(x=>Number(x.toFixed(6))).join(','));
}
function updateURL(includeFrame=false){
 let hash='skeleton';
 if(selected&&variant<0){
  const params=new URLSearchParams();
  if(regionReference)params.set('original','1');else if(atlasPalate)params.set('atlas','1');
  if(includeFrame)saveCamera(params);
  hash='bone/'+meshByKey.get(selected)+(params.size?'?'+params:'');
 }
 if(course&&variant>=0){
  const params=new URLSearchParams();if(!legacyMotion)params.set('mv','2');
  if($('compareTypes').checked)params.set('compare','1');
  if(selected)params.set('bone',meshByKey.get(selected));
  if(studyMode!=='overview')params.set('view',studyMode);
  if(includeFrame){
   params.set('at',Math.round(progress*1000));
   saveCamera(params);
  }
  if(chosenFragment!==null)params.set('frag',chosenFragment);
  if(repeating)params.set('loop','1');

  if($('bandRule').value==='held')params.set('band','held');
  if(+$('slack').value!==10)params.set('slack',$('slack').value);
  if(shape)params.set('shape',shape);
  if(motions.length)params.set('move',motions.join(','));
  for(const [k,n] of Object.entries(quantities))params.set('q_'+k,n);
  hash=[course.id,course.variants[variant].id,level].join('/')+(params.size?'?'+params:'');
 }
 history.replaceState(null,'','#'+hash);
}
function route(){
 $('advanced').open=false;$('fragmentBox').open=false;
 setPanel(false);
 const [path,query]=location.hash.slice(1).split('?'),[id,v,l]=path.split('/');
 const params=new URLSearchParams(query);quantities={};
 legacyMotion=params.get('mv')!=='2'&&[...params.keys()].some(k=>k.startsWith('q_'));regionReference=id==='bone'&&params.get('original')==='1';atlasPalate=id==='bone'&&params.get('atlas')==='1'&&/palatine/i.test(keyByMesh.get(v)||'');$('compareTypes').checked=params.get('compare')==='1';
 $('bandRule').value=params.get('band')==='held'?'held':'released';
 const rawSlack=params.get('slack');$('slack').value=rawSlack!==null&&Number.isFinite(+rawSlack)?Math.min(35,Math.max(0,+rawSlack)):10;$('slackValue').textContent=$('slack').value+'%';
 chosenFragment=params.has('frag')&&/^\d{1,2}$/.test(params.get('frag'))?+params.get('frag'):null;
 repeating=params.get('loop')==='1';holdUntil=0;$('repeat').setAttribute('aria-pressed',String(repeating));
 for(const [k,value] of params){const key=k.slice(2);if(k.startsWith('q_')&&isFragmentKey(key)&&value!==''&&Number.isFinite(+value))quantities[key]=+value;}
 for(const key of ['shorten','separate','side','rotate','angle','spin','travel','wedge','plane','tilt','jointTwist','footRoll','crush','breadth','bearing','elevation']){
  const value=params.get('q_'+key);
  if(value!==null&&value!==''&&Number.isFinite(+value))quantities[key]=+value;
 }
 studyMode='overview';selected=null;course=null;variant=-1;level=1;progress=0;playing=false;shape='';motions=[];
 if(id==='bone'){
  selected=keyByMesh.get(v)||null;course=matches(selected)[0]||null;
 }else{
  course=courses.find(c=>c.id===id)||null;
  if(course){
   variant=variantIndex(course,v);
   level=Math.max(0,Math.min(2,l===undefined?1:parseInt(l)||0));
   selected=keyByMesh.get(params.get('bone'));
   if(!selected||!bonesFor(course.variants[variant]).includes(teachingBone(selected)))selected=course.variants[variant].cuts[0].bone;
   const f=featuresFor(course,variant);
   if(f.shapes.includes(params.get('shape')))shape=params.get('shape');
   motions=shape==='wedgeFragment'?[]:f.motions.filter(k=>(params.get('move')||'').split(',').includes(k));
   if(motions.includes('shorten'))motions=motions.filter(k=>k!=='separate');
  }
 }
 if(course&&variant>=0){
  const mode=params.get('view');studyMode=['cut','facet','motion'].includes(mode)?mode:'overview';
  if(params.has('at')&&Number.isFinite(Number(params.get('at'))))progress=T.MathUtils.clamp(Number(params.get('at'))/1000,0,1);
  else if(params.get('play')==='1')playing=true;
  else if(studyMode!=='overview')progress=1;
  else playing=true;
 }
 renderLesson(false,false,params);
}
function restoreView(params){
 if(studyMode==='cut')aimAtFace();
 if(studyMode==='facet')aim(['radius','intercondylar','distalfemur'].includes(course?.id)?'inferior':'top');
 if(studyMode==='motion'&&course?.id==='radius')aim('side');
 const raw=params.get('cam')?.split(',');
 if(selected&&(lessonOpen()||params.get('space')==='native')&&raw?.length===6&&raw.every(n=>n.trim()&&Number.isFinite(+n)&&Math.abs(+n)<=24)){
  const convert=values=>{
   const pt=vec(values.map(Number));
   if(params.get('space')==='native')return pt;
   const mirror=/\bleft\b/i.test(selected)?-1:1;
   pt.x*=mirror;const converted=landmark(lessonMesh(course.variants[variant].cuts[0].bone),pt.toArray());converted.x*=mirror;
   return converted;
  };
  const a=convert(raw.slice(0,3)),b=convert(raw.slice(3)),dist=a.distanceTo(b);
  if(dist>=.0005&&dist<=20.001){
   const parts=params.get('up')?.split(',').map(Number);
   const up=parts?.length===3&&parts.every(Number.isFinite)?vec(parts):vec([0,1,0]);
   if(up.lengthSq()>.00001&&Math.abs(up.normalize().dot(a.clone().sub(b).normalize()))<.999999)camera.up.copy(up);
   flight=null;automaticFit=false;camera.position.copy(a);controls.target.copy(b);controls.update();dirty=true;}
 }
 orientation();
}
function syncExam(){
 const customized=Boolean(shape||motions.length||Object.keys(quantities).length);
 if(!Object.keys(quantities).length){
  for(const b of document.querySelectorAll('[data-severity]'))b.classList.toggle('active',b.dataset.severity==='1');
 }
 showExamPoints(lessonOpen()?course:null,variant,level,customized);
}
function showControls(){
 const local=Boolean(selected),lesson=Boolean(course&&variant>=0);
 syncExam();
 softPanel.updateClinical({selectedBone:selected,course:lesson?course:null,variant,level,motions});
 syncSoftQuickBar();
 document.body.classList.toggle('in-lesson',lesson);document.body.classList.toggle('in-index',!local);

 $('centreBone').hidden=!local;$('back').hidden=!local;$('navBone').hidden=!local;$('navLesson').hidden=!local||(!lastLesson&&!lesson);
 $('whole').setAttribute('aria-current',local?'false':'page');$('navBone').setAttribute('aria-current',local&&!lesson?'page':'false');
 $('navLesson').setAttribute('aria-current',lesson?'page':'false');$('indexPanel').hidden=local;$('bonePanel').hidden=!local;$('lessonPanel').hidden=!lesson;

 document.querySelector('[data-view=detail]').textContent=course?.kind==='joint'?'关节特写':'放大断面';
 $('advanced').hidden=!local||(!lesson&&!specimen.region(selected));$('motionSettings').hidden=!lesson;$('layers').hidden=!lesson;document.querySelector('[data-view=detail]').hidden=!lesson;$('viewRail').hidden=false;
 $('labels').hidden=local;$('breadcrumb').textContent=local?regionFor(selected):'全身骨骼　/　索引';
 $('jointShortcuts').hidden=local;syncPlayer();
 $('mobilePanel').textContent=!local?'骨骼索引':lesson?'分型与考点':'选择分型';
 if(!local){$('extentRow').hidden=true;updateAnatomyPanel(null,[]);return;}
 updateAnatomyPanel(selected,anatomyGuides);
 $('signView').hidden=!typeView(course,variant);
 const region=specimen.region(selected),palate=/palatine/i.test(selected);
 $('extentRow').hidden=!region||lesson;
 if(region&&!lesson){
  const options=[new Option('局部骨面','bone'),new Option(region[1],'region')];
  if(palate)options.push(new Option('完整腭骨外形','palate'));
  $('anatomyExtent').replaceChildren(...options);
  $('anatomyExtent').value=regionReference?'region':atlasPalate?'palate':'bone';
 }
 $('regionKey').hidden=!palate||atlasPalate||regionReference;
 $('boneTitle').textContent=boneName(selected);
 const list=matches(selected),has=list.length>0;
 $('boneNote').textContent=!has?'可旋转查看此骨的正常解剖，当前尚无对应损伤课程。':variant<0?'选择分型后自动播放。':'';
 $('boneNote').hidden=!$('boneNote').textContent;
 for(const id of ['sites','siteLabel','variants','system'])$(id).hidden=!has;
 $('levelbox').hidden=!lesson;$('patternBox').hidden=!lesson;
 if(!has)return;
 $('sites').replaceChildren(...list.map(c=>new Option(c.name,c.id,false,c===course)));
 $('sites').disabled=list.length===1;$('sites').hidden=$('siteLabel').hidden=list.length===1;
 $('system').textContent=course.system;
 $('zoomMotion').textContent=course.kind==='joint'?'关节特写':'断端特写';
 $('end').textContent=course.kind==='joint'?'脱位后':'骨折后';
 const allowed=course.variants.map((v,i)=>bonesFor(v).includes(teachingBone(selected))?i:-1).filter(i=>i>=0);
 $('compareTypesRow').hidden=allowed.length<2||variant<0;
 buttons($('variants'),allowed.map(i=>course.variants[i].name),allowed.indexOf(variant),i=>pickVariant(allowed[i]));
 buttons($('levels'),levels.map(x=>x[0]),level,i=>{legacyMotion=false;level=i;progress=0;playing=lesson;updateURL();renderLesson(true);});
 if(!lesson)return;
 const isJoint=course.kind==='joint';
 const v=course.variants[variant];
 const aligned=!isJoint&&!v.depression&&!v.moving&&!v.cuts.some(s=>s.wedge||s.surface==='dent'||s.second||s.minus?.shift.some(Boolean)||s.plus?.shift.some(Boolean)||s.minus?.turn.some(Boolean)||s.plus?.turn.some(Boolean));
 const deform=Boolean(v.depression)||v.cuts.some(s=>s.wedge||s.surface==='dent');
 const stepTimes=aligned||deform?[0,.5,1]:isJoint?[0,.49,1]:[0,.17,.28,1];
 buttons($('steps'),aligned?['伤前','断线出现','保持对位']:deform?['伤前','形变过程','终末形态']:isJoint?['对位','移出','终点']:['伤前','断缘显露','初次错开','终末姿态'],-1,i=>{playing=false;setProgress(stepTimes[i]);});
 const f=featuresFor(course,variant);
 const description=injuryDescription(course,variant,level,{shape,movements:motions});
 $('featureBox').hidden=false;$('patternBox').hidden=false;
 $('patternTitle').textContent=isJoint?'脱位部位与方向':'骨折形态与位置';
 $('levels').hidden=!course.levels;$('fixedSite').hidden=Boolean(course.levels);
 $('fixedSite').textContent=description.site;
 $('presetShape').textContent=description.form;
 $('presetMotion').textContent=description.motion;
 $('motionTitle').textContent=isJoint?'骨端移位':'骨折移位';
 $('moveRow').querySelector('small').hidden=f.motions.length<2||shape==='wedgeFragment';
 $('shapeRow').hidden=isJoint;$('shapes').hidden=!f.shapes.length;
 $('motions').hidden=!f.motions.length||shape==='wedgeFragment';
 const shapeKeys=f.shapes,base=initialShape(course,variant),chosen=shape||base;
 const adjustable=f.shapes.length&&chosen==='oblique';
 $('planeRow').hidden=!adjustable;
 if(adjustable){
  $('plane').min=1;$('plane').max=89;
 }
 if(!adjustable&&quantities.plane!==undefined){
  delete quantities.plane;
 }

 buttons($('shapes'),shapeKeys.map(k=>shapeNames[k]),shapeKeys.indexOf(shape||base),i=>{
  legacyMotion=false;clearEdits(quantities);chosenFragment=null;delete quantities.plane;shape=shapeKeys[i]===base?'':shapeKeys[i];if(shape==='wedgeFragment')motions=[];progress=0;playing=true;updateURL();renderLesson(false,true);
 });
 const keys=['',...f.motions];
 buttons($('motions'),keys.map(k=>motionNames[k]||'典型移位'),-1,i=>{
  legacyMotion=false;clearEdits(quantities);chosenFragment=null;const key=keys[i];
  if(!key)motions=[];
  else if(motions.includes(key))motions=motions.filter(k=>k!==key);
  else{
   if(key==='shorten')motions=motions.filter(k=>k!=='separate');
   if(key==='separate')motions=motions.filter(k=>k!=='shorten');
   motions.push(key);
  }
  progress=0;playing=true;updateURL();renderLesson(false,true);
 });
 [...$('motions').children].forEach((b,i)=>{
  const active=i?motions.includes(keys[i]):!motions.length;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
}
function overviewLabels(){
 const labels=$('labels'); if(tissueEntry){labels.hidden=true;return;}if(selected||!camera)return;
 const direction=camera.position.clone().sub(controls.target).normalize();
 const visible=direction.z>.94&&Math.abs(controls.target.y-.82)<.04&&camera.position.distanceTo(controls.target)>1.85;
 labels.hidden=!visible;if(!visible)return;
 const key=[host.clientWidth,host.clientHeight,...camera.matrixWorld.elements].map(x=>x.toFixed(4)).join('/');
 if(key===lastLabelView)return;lastLabelView=key;labels.replaceChildren();
 for(const [name,english,side] of [['Right humerus','Humerus',-1],['Left clavicle','Clavicle',1],['Left femur','Femur',1],['Right tibia','Tibia',-1]]){
  const g=boneData.get(name);if(!g)continue;
  const pt=g.boundingBox.getCenter(new T.Vector3()).project(camera),len=host.clientWidth*.082;
  const el=document.createElement('span');el.className='callout'+(side<0?' left':'');
  el.style.left=((pt.x+1)*host.clientWidth*.5+side*len)+'px';el.style.top=((1-pt.y)*host.clientHeight*.5)+'px';
  el.style.setProperty('--leader',len+'px');el.textContent=boneName(name);const latin=document.createElement('i');latin.textContent=english;el.append(latin);labels.append(el);
 }
}
let selectedMesh=null,automaticFit=false,displayedBone=null,viewEdits=0;
function centreMesh(dir,meshes=selectedMesh){
 const fit=frameBone(meshes,dir,camera.fov,camera.aspect,.77,camera.up);
 flight=null;controls.target.copy(fit.target);camera.position.copy(fit.position);controls.update();dirty=true;automaticFit=true;
}
function aim(view='home',smooth=false){
 if(!camera)return;
 if(view==='detail'&&!course)return;
 camera.up.set(0,1,0);
 const localJoint=lessonOpen()&&course.kind==='joint'&&course.variants[variant].nativePoint&&['front','top','side','leftSide'].includes(view);
 const target=view==='detail'||view==='rearDetail'||view==='plateauDetail'||localJoint?fractureFocus:focus;
 const dir={inferior:[0,-1,.001],detail:[-.6,.17,1],rear:[0,0,-1],rearDetail:[0,.02,-1],plateauDetail:[-.32,1,.45],front:[0,0,1],side:[-1,0,0],leftSide:[1,0,0],top:[0,1,.001],home:selected?[-.36,.12,1]:[0,0,1]}[view];
 if(tissueEntry&&!tissueEntry.aligned){fitTissues(vec(dir));return;}
 if(selected&&!lessonOpen()&&selectedMesh){
  centreMesh(vec(dir));return;
 }
 const box=host.getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);
 let horizontal=span;
 if(!selected)horizontal=.65;
 else if(view!=='top'&&view!=='side'&&view!=='detail'){
  const size=boneData.get(selected).boundingBox.getSize(new T.Vector3());
  horizontal=Math.min(span,Math.max(span*.42,Math.hypot(size.x,size.z)));
 }
 const viewSize=Math.max(span,horizontal/aspect);
 const framing=view==='plateauDetail' ? .85 : view==='rearDetail' ? .48 : view==='detail' ? .57 : localJoint ? .72 : 1.16;
 distance=viewSize*framing/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
 const end=target.clone().addScaledVector(vec(dir).normalize(),distance);
 flight=null;
 controls.minDistance=.0005;controls.maxDistance=20;
 if(smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  flight={from:camera.position.clone(),target:controls.target.clone(),end,focus:target.clone(),start:performance.now()};
 }else{camera.position.copy(end);controls.target.copy(target);controls.update();}

}
function setLessonTitle(){
 const mirror=/\bleft\b/i.test(selected);
 $('crumb').textContent=boneName(selected)+' / '+course.name+(mirror?' · 左侧骨面':'');
 $('heading').textContent=course.variants[variant].name;
 const shapeOnly=shape&&shape!=='wedgeFragment'&&!motions.length;
 $('description').textContent=[shapeNames[shape],...(shapeOnly?['断端分离演示']:motions.map(k=>motionNames[k]))].filter(Boolean).join(' · ');
}
function motionCloseUp(smooth,defaults=false){
 if(!fragmentRig){aim('detail',smooth);return;}
 const f=fragmentRig.focus,sign=group.scale.x,target=f.centre.clone(),d=f.delta.clone();
 target.x*=sign;d.x*=sign;d.normalize();
 const dir=defaults?vec([-.60*sign,.17,1]).normalize():camera.position.clone().sub(controls.target).normalize();
 if(d.lengthSq()){
  dir.addScaledVector(d,-dir.dot(d));
  if(dir.lengthSq()<.08)dir.crossVectors(d,Math.abs(d.y)<.85?vec([0,1,0]):vec([1,0,0]));
 }
 const aspect=camera.aspect;
 const screenSpan=defaults?Math.max(f.width*2.4,Math.min(f.size,f.delta.length()*Math.min(viewWidth,viewHeight)/24),.018):f.size;
 const end=target.clone().addScaledVector(dir.normalize(),screenSpan/(2*Math.tan(T.MathUtils.degToRad(camera.fov*.5))*Math.min(1,aspect)));
 if(smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches)flight={from:camera.position.clone(),target:controls.target.clone(),end,focus:target,start:performance.now()};
 else{flight=null;camera.position.copy(end);controls.target.copy(target);controls.update();}
 dirty=true;
}
function assetsForLesson(){
 const v=course&&variant>=0?course.variants[variant]:null;
 if(!v&&atlasPalate)return [];
 if(!v&&regionReference&&specimen.region(selected))return [specimen.region(selected)[0]];
 const names=specimen.required(selected,course,v);
 if(!v||!$('compareTypes').checked)return names;
 // Keep the same male reference anatomy across variants when an enhanced donor covers only some.
 const relevant=course.variants.filter(option=>bonesFor(option).includes(teachingBone(selected)));
 const currentGroup=specimen.group(names);
 return currentGroup&&relevant.every(option=>specimen.group(specimen.required(selected,course,option))===currentGroup)?names:[];
}
let detailTimer;
function scheduleFullDetail(serial){
 clearTimeout(detailTimer);
 if(location.protocol==='file:'||navigator.connection?.saveData||(smallScreen.matches&&(navigator.deviceMemory??4)<4))return;
 detailTimer=setTimeout(async()=>{
  for(const region of detailRegions){
   if(viewSerial!==serial||selected||document.hidden)return;
   try{await assemblyDetail.load([region]);}catch{return;}
  }
 },2200);
}
function renderLesson(smooth=false,keepView=false,viewParams=null){
 if(!ready)return;
 const keepTissues=Boolean(selected&&isLimbBone(selected)&&Object.values(tissueControls).some(id=>$(id).checked));
 if(tissueEntry||tissueRequest){
  if(keepTissues){tissueRequest?.abort();tissueRequest=null;leaveTissues(false);}
  else closeTissues(false);
 }
 $('softStatus').hidden=true;
 const serial=++viewSerial,lesson=lessonOpen(),resume=playing,editAtRequest=viewEdits;
 const needed=selected&&!specimen.catalogueReady()?null:assetsForLesson();
 const regionNames=selected?regionsForScene(selected,course,lesson?course.variants[variant]:null):[];
 const awaiting=Boolean(selected&&(needed===null||(needed.length?!specimen.ready(needed):!assemblyDetail.ready(regionNames))));
 $('loadNotice').hidden=true;
 if(awaiting||lesson){
  playing=false;loadingSpecimen=true;flight=null;host.dataset.pending='true';
  if(displayedBone!==selected||!lesson){
   clearScene();const g=boneData.get(selected);
   if(g){
    selectedMesh=new T.Mesh(g,bone);selectedMesh.userData.bone=selected;group.add(selectedMesh);
    camera.up.set(0,1,0);centreMesh(vec([-.36,.12,1]));
   }
  }
  displayedBone=selected;
  showControls();if(lesson)setLessonTitle();else{$('heading').textContent=boneName(selected);$('crumb').textContent=regionFor(selected)+' · 正常解剖';$('description').textContent='';}
  $('centreBone').disabled=$('quickPlay').disabled=$('quickEdit').disabled=true;$('viewOptions').inert=true;
  $('captureFrame').disabled=true;$('lessonPanel').inert=true;document.querySelector('.player').inert=true;
  host.dataset.specimen='false';
  $('status').textContent=awaiting?'正在载入精细骨面…':'正在准备模型…';$('status').hidden=false;
  // The selected preview and index can be painted while the specimen loads.
  const paint=new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  const available=(async()=>{
   if(needed===null)await specimen.init();
   if(serial!==viewSerial)return [];
   const keys=needed??assetsForLesson();
   if(keys.length)await specimen.load(keys);
   else if(selected)await assemblyDetail.load(regionNames);
   return keys;
  })();
  Promise.all([paint,available]).then(([,loaded])=>{
   if(serial!==viewSerial)return;
   const changed=viewEdits!==editAtRequest;
   const direction=camera.position.clone().sub(controls.target).normalize(),up=camera.up.clone();
   let offset=null,scale=1;
   if(changed&&selectedMesh){
    const preview=frameBone(selectedMesh,direction,camera.fov,camera.aspect,.77,up);
    offset=controls.target.clone().sub(preview.target);
    scale=camera.position.distanceTo(controls.target)/preview.position.distanceTo(preview.target);
   }
   playing=resume&&!document.hidden;
   finishLesson(changed?false:smooth,keepView,changed?null:viewParams,loaded);
   if(changed){
    flight=null;automaticFit=false;camera.up.copy(up);
    if(selectedMesh&&!lessonOpen()){
     const fit=frameBone(selectedMesh,direction,camera.fov,camera.aspect,.77,up);
     controls.target.copy(fit.target);if(offset)controls.target.add(offset);
     camera.position.copy(controls.target).addScaledVector(direction,fit.position.distanceTo(fit.target)*scale);
    }else{
     const distance=camera.position.distanceTo(controls.target);
     camera.position.copy(controls.target).addScaledVector(direction,distance);
    }
    controls.update();dirty=true;
   }
  }).catch(err=>{
   if(serial!==viewSerial)return;
   console.warn('精细骨面载入失败',err);
   regionReference=false;atlasPalate=false;playing=false;progress=0;variant=-1;shape='';motions=[];studyMode='overview';
   finishLesson(false,viewEdits!==editAtRequest,null,[]);
   $('loadNotice').textContent='精细骨面暂不可用，已显示预览。';
   $('loadNotice').hidden=false;
  });
  return;
 }
 finishLesson(smooth,keepView,viewParams,needed);
}
function finishLesson(smooth,keepView,viewParams,needed){
 clearScene();showControls();useSpecimen=needed.length>0;loadingSpecimen=false;delete host.dataset.pending;displayedBone=selected;
 $('centreBone').disabled=$('quickPlay').disabled=$('quickEdit').disabled=false;$('viewOptions').inert=false;
 $('captureFrame').disabled=false;$('lessonPanel').inert=false;document.querySelector('.player').inert=false;
 specimen.trim(needed,course&&variant>=0?course:null);$('status').hidden=true;
 host.dataset.specimen=String(useSpecimen);
 selectedMesh=null;
 if(!selected||!course||variant<0){
  if(!selected){
   for(const name of boneData.keys())addBone(name,bone);
   focus.set(0,.82,0);span=1.64;
   $('heading').textContent='全身骨骼';$('crumb').textContent='成年男性 · 解剖总览';$('description').textContent='点击骨骼，进入局部观察';
   scheduleFullDetail(viewSerial);
  }else{
   const region=regionReference?specimen.region(selected):null;
   const mesh=region?new T.Mesh(specimen.fromKey(region[0]),bone):addBone(selected,bone);
   if(region)group.add(mesh);else if(useSpecimen&&mesh.geometry.userData.oralTrace)addBone('Posterior hard palate region',palateSurround);const box=mesh.geometry.boundingBox;
   selectedMesh=mesh;
   if(!region)anatomyGuides=guidesFor(selected,mesh.geometry);
   updateAnatomyPanel(selected,anatomyGuides);
   box.getCenter(focus);span=1.17*Math.max(...box.getSize(new T.Vector3()).toArray());
   $('heading').textContent=region?region[1]:boneName(selected)+(mesh.geometry.userData.oralTrace?' · 估计区':'');$('crumb').textContent=regionFor(selected)+' · 正常解剖';
   $('description').textContent=atlasPalate?'完整骨面':region?'局部与周围骨骼的关系':'';
   if(region&&/palatine/.test(selected))$('description').textContent='可旋转查看硬腭与相邻骨壁的实测区域';
  }
  if(!keepView||automaticFit&&selected)aim('home',false);
  if(selected&&viewParams)restoreView(viewParams);
  if(selected&&isLimbBone(selected)&&Object.values(tissueControls).some(id=>$(id).checked))showTissues();
  return;
 }
 const v=course.variants[variant],bounds=new T.Box3(),anchors=[];
 const mirror=/\bleft\b/i.test(selected);
 group.scale.x=mirror?-1:1;
 setLessonTitle();
 const ctx=useSpecimen?specimen.context(course,v):v.context||course.context||[], shared=course.levels?atLevel(lessonMesh('Right tibia'),1,levels[level][1])[1]:null;
 let spiralDirection=null,referenceWidth=0,sharedPivot=null,frame=null,followMotion=v.cuts[0].minus;
 if(course.kind==='joint'){
  const main=lessonMesh(v.cuts[0].bone),vkJaw=useSpecimen&&course.id==='tmj-dislocation';
  const elbow=useSpecimen&&course.id==='elbow-dislocation'?elbowStudy[mirror?'Left':'Right']:null;
  const shoulder=useSpecimen&&course.id==='shoulder-dislocation'?shoulderStudy[mirror?'Left':'Right']:null;
  const localPath=(elbow||shoulder)?.variants[variant],pivotXYZ=elbow?.anchor_m;
  const digitPath=useSpecimen&&main.userData.digit?digitJointPath(course.id,variant,mirror):null;
  const a=digitPath?vec(main.userData.digit.proximal_m):elbow?vec([pivotXYZ[0]*(mirror?-1:1),pivotXYZ[1],pivotXYZ[2]]):vkJaw?nativeAnchor(main,[.502963,.949258,.081502]):v.nativePoint?nativeAnchor(main,v.nativePoint):main.userData.headCentre?.clone()||landmark(main,v.anchor);
  const pivot=new T.Group(),ghost=new T.Group();group.add(pivot,ghost);pivot.position.copy(a);ghost.visible=false;
  const trajectory=new T.Line(new T.BufferGeometry().setFromPoints([a,a]),new T.LineDashedMaterial({color:0x267c6c,dashSize:.003,gapSize:.002}));
  trajectory.userData.dispose=true;trajectory.userData.ownMaterial=true;group.add(trajectory);trajectory.frustumCulled=false;
  if(['shoulder-dislocation','hip-dislocation'].includes(course.id)){
   frame=shaftFrame(vec(atLevel(main,1,.26)),vec(atLevel(main,1,.71)),false);
  }
  for(const {bone:name} of v.cuts){
   addBone(name,displacedMaterial,pivot).position.copy(a).negate();
   addBone(name,ghostMaterial,ghost);
  }
  for(const name of elbow?[]:(v.jointFollowers||boneData.keys())){
   if(!/right/i.test(name)||v.fixed.includes(name)||v.cuts.some(c=>c.bone===name))continue;
   const limb=course.id==='hip-dislocation'?'下肢':'上肢';
   if(!v.jointFollowers&&(regionFor(name)!==limb||/scapula|clavicle|humerus|hip bone/i.test(name)))continue;
   const linked=addBone(name,adjacent,pivot);linked.position.copy(a).negate();nearBones.push(linked);
  }
  for(const name of v.fixed){if(useSpecimen&&course.id==='hip-dislocation'&&name==='Sacrum')continue;const m=addBone(name,bone);if(m)jointReferences.push(m);}
  animated.push({jointLabel:'活动骨端',trajectory,pivot,anchor:a,shift:vec(digitPath?.end||localPath?.end||v.shift).multiplyScalar(.001),turn:vec(digitPath?.turn||(vkJaw?[18,0,0]:v.turn)||[0,0,0]).multiplyScalar(Math.PI/180),posture:shoulder?localPath.pose:v.posture,axial:shoulder?localPath.axial:v.axial,waypoints:digitPath?digitPath.waypoints:localPath?(localPath.via?[localPath.via]:undefined):vkJaw?[[0,-5,5]]:v.waypoints,sharedClock:course.id==='lunate-dislocation'&&variant===0,ghost,jointAxis:frame?.axis});
  anchors.push(a);
 }
 for(const original of course.kind==='joint'?[]:v.cuts){
  markName=original.bone;
  let s={...withShape(original,shape)};
  if(course.sourceBone&&!s.wedge){
   const length=name=>lessonMesh(name).boundingBox.getSize(vec([0,0,0])).getComponent(s.axis);
   const ratio=length(s.bone)/length(course.sourceBone);
   const adapt=m=>({...m,shift:m.shift.map(value=>value*ratio)});
   s={...s,minus:adapt(s.minus),plus:adapt(s.plus)};
  }
  const g=lessonMesh(s.bone);
  if(useSpecimen&&course.id==='region-zygoma'){
   const p=nativeAnchor(g,mirror?[.11,.356,.19]:[.1075,.370,.1664]);
   s={...s,level:.43,pivot:p.toArray(),minus:{shift:mirror?[0,0,0]:[0,-.4,0],turn:[0,12,0]}};
  }
  if(course.id==='radius')s=bartonSurface(s,g,variant);
  const plateauBed=v.depression?plateauSite(g):null;
  if(s.pit){
   const m=new T.Mesh(g.clone(),bone);m.userData.bone=s.bone;m.userData.dispose=true;group.add(m);
   wedges.push(applyPlateauBed(m,plateauBed));anchors.push(plateauBed.centre);bounds.union(g.boundingBox);continue;
  }
  if(plateauBed)s={...s,digitAnchor:plateauBed.split};
if((g.userData.group||'').startsWith('openskeleton-N187928-')&&course.id==='radial-head'&&variant===2){
 s={...s,anchor:undefined};
}
if((g.userData.group||'').startsWith('openskeleton-N187928-')&&course.id==='olecranon'&&variant===0){
 const upper=mirror?[-.9769,-.0328,.2112]:[-.83614,-.27683,-.47353];
 const front=mirror?[.15,-.76,.63]:[-.14276,-.72372,.68];
 const pull=new T.Vector3(...upper).addScaledVector(new T.Vector3(...front),-.8).normalize();
 s={...s,plus:{...s.plus,shift:pull.multiplyScalar(7).toArray()}};
}
if((g.userData.group||'').startsWith('openskeleton-N187928-')&&course.id==='single-forearm'&&variant===2){
 s={...s,minus:{...s.minus,shift:[.7,-.6,.3]}};
}
if((g.userData.group||'').startsWith('openskeleton-N187928-')&&course.id==='radial-head'&&variant===1){
 s={...s,level:.938,normal:[0,1,0],plus:{...s.plus,shift:mirror?[-.5,-3,0]:[0,-2.5,0]}};
}

  if(g.userData.digit){
   const angle=s.shaftAngle??(v.name.startsWith('纵裂')?90:v.name.startsWith('斜形')?38:0);s=digitalCut(g,s,angle);
  }else if(s.shaftAngle!==undefined)s=shortShaftCut(g,s,s.shaftAngle);
  else if(['toes','metatarsal','finger'].includes(course.family||course.id)){
   s=shortShaftCut(g,s,v.name.startsWith('纵裂')?90:v.name.startsWith('斜形')?38:0);
  }
if(useSpecimen&&course.id==='scaphoid'){
 const pts=mirror?[[.694,.656,.243],[.419,.435,.408],[.287,.370,.852]]:[[.683,.654,.249],[.402,.437,.414],[.312,.362,.838]];
 s={...s,nativePoint:pts[variant],normal:variant===2?[.22,.37,-.90]:[.36,.70,-.61]};
 if(variant===2)s.minus={...s.minus,shift:[0,.1,1.3],turn:[0,0,0]};
 if(variant===1)s.minus={...s.minus,shift:[-1,-.6,1],turn:[-8,0,0]};
}

if(useSpecimen&&course.id.startsWith('region-sesamoid-')){
 const met=lessonMesh('Right first metatarsal bone');
 const from=vec(atLevel(met,2,.18)),head=vec(atLevel(met,2,.85));
 const distal=head.clone().sub(from).normalize();
 const centre=g.boundingBox.getCenter(new T.Vector3()),away=centre.clone().sub(head);
 away.addScaledVector(distal,-away.dot(distal)).normalize();
 const anchor=sliceMetrics(g,centre,distal,away)?.centre||centre;
 s={...s,digitAnchor:anchor,normal:distal.toArray(),minus:{...s.minus,shift:distal.clone().multiplyScalar(-.8).addScaledVector(away,.35).toArray(),turn:[0,0,0]}};
}

  if(g.userData.oralTrace&&s.surface){
   const t=g.userData.oralTrace,flip=a=>new T.Vector3(a[0]*(mirror?-1:1),a[1],a[2]);addBone(s.bone,bone);
   const stroke=new T.Line(new T.BufferGeometry().setFromPoints(t.points_m.map(flip)),line);
   stroke.userData.dispose=true;annotations.push(stroke);group.add(stroke);anchors.push(flip(t.focus_m));bounds.union(g.boundingBox);
   continue;
  }
  if(s.surface){
   const mark=addSurfaceLesson(g,s,group,{bone,line,cap},annotations,wedges);
   anchors.push(mark);bounds.union(g.boundingBox);continue;
  }
  if(s.wedge){
   const a=g.boundingBox.getCenter(new T.Vector3());a.z=g.boundingBox.max.z-.012;anchors.push(a);
   addWedge(g,s.wedge);bounds.union(g.boundingBox);continue;
  }
  if(useSpecimen&&course.id==='plateau'&&!v.depression){
   // Use each native knee rather than projecting the old whole-body mesh's
   // global cut seed into a different specimen.
   const site=plateauSite(g);
   const centre=site.centre.clone().add(new T.Vector3(site.rx*2.9,-.013,0));
   s={...s,anchor:centre.toArray(),plus:{shift:[4,1,0],turn:[0,0,-3]}};
  }
  if(useSpecimen&&course.id==='trochanter'&&variant===0&&g.userData.headCentre){
   const centre=g.userData.headCentre.clone().add(new T.Vector3(-.024,-.035,.002));
   const retreat=vec(s.normal).normalize().multiplyScalar(-5);
   s={...s,anchor:centre.toArray(),minus:{...s.minus,shift:vec(s.minus.shift).add(retreat).toArray()}};
  }
  if(s.anchor)s={...s,normal:planeNormal(g,s.normal),anchor:landmark(g,s.anchor).toArray(),second:s.second?planeNormal(g,s.second):undefined};
  if(useSpecimen&&course.id==='elbow'&&variant===2){
   s={...s,plus:{...s.plus,shift:[0,-6,0]}};
  }
  if(s.pivot)s={...s,pivot:landmark(g,s.pivot).toArray()};
  if(s.proximalHeadPivot&&g.userData.headCentre){
   // Set this specimen's reverse-oblique plane below the head, between the trochanters.
   s={...s,anchor:g.userData.headCentre.clone().add(new T.Vector3(0,-.043,0)).toArray()};
   // The coarser left atlas starts with slight overlap at the hip articular surface.
   if(!useSpecimen&&mirror)s={...s,plus:{...s.plus,shift:[-.2,-.15,.15]}};
  }
  let fraction=s.level;
  if(shared!==null){
   const y=shared+(variant===1&&s.bone==='Right fibula'?.033:0);
   fraction=(y-g.boundingBox.min.y)/(g.boundingBox.max.y-g.boundingBox.min.y);
  }
  const a=s.digitAnchor||(s.nativePoint?nativeAnchor(g,s.nativePoint):vec(s.anchor||atLevel(g,s.axis,fraction)));anchors.push(a);
  const f=featuresFor(course,variant),surface=shape||initialShape(course,variant);
  if(f.shapes.length&&['oblique','shortOblique','transverse'].includes(surface)){
   const low=vec(atLevel(g,s.axis,Math.max(.02,fraction-.08))),high=vec(atLevel(g,s.axis,Math.min(.98,fraction+.08)));
   const along=high.sub(low).normalize(),across=vec(s.normal);
   across.addScaledVector(along,-across.dot(along));
   if(across.lengthSq()<.01)across.copy(shaftFrame(new T.Vector3(),along,false).side);
   across.normalize();
   const authored=vec(s.normal).normalize();
   let theta=surface==='transverse'?0:Math.acos(Math.min(1,Math.abs(authored.dot(along))));
   if(surface==='oblique'){
    if(Number.isFinite(quantities.plane))theta=T.MathUtils.degToRad(Math.max(1,Math.min(89,quantities.plane)));
    if(original===v.cuts[0]){
     const degrees=T.MathUtils.radToDeg(theta);
     $('plane').value=Math.round(degrees);$('planeValue').textContent=degrees.toFixed(1)+'°';
    }
   }
   s.normal=along.multiplyScalar(Math.cos(theta)).addScaledVector(across,Math.sin(theta)).toArray();
  }
  if(surface==='wedgeFragment'){
   // Two limbs diverge toward the lateral cortex and meet a transverse medial crack.
   const slope=.95,scale=Math.hypot(1,slope/2);
   s={...s,normal:[-slope/2,1,0],fold:slope/(2*scale),second:[slope,1,0],
    branches:[{shift:[-4,0,1],turn:[0,0,3]},{shift:[0,0,0],turn:[0,0,0]}]};
  }
  if(surface==='spiral'&&!(course.id==='tibia'&&s.bone==='Right fibula')){
   const extent=g.boundingBox.getSize(new T.Vector3()).getComponent(s.axis);
   const low=vec(atLevel(g,s.axis,fraction-.07)),high=vec(atLevel(g,s.axis,fraction+.07));
   // The left middle radius follows its native oblique shaft in the validated preset.
   const useForearmAxis=course.id==='single-forearm'&&!(mirror&&variant===1);
   s.spiralAxis=shape&&!motions.length&&(v.cuts.length>1||useForearmAxis)?[0,1,0]:high.sub(low).normalize().toArray();
   s.posteriorSpiral=course.id==='tibia'&&s.bone==='Right tibia';
   if(s.posteriorSpiral)spiralDirection=vec(s.spiralAxis);
   // A single forearm shaft is narrow. Keep the changed helix within the local
   // shaft before the raised connecting limb approaches the next epiphysis.
   const pitch=shape&&!motions.length&&useForearmAxis?.085:s.bone==='Right fibula'?.055:.15;
   s.spiralHeight=extent*pitch;
  }
  if(course.id==='tibia'&&surface==='spiral'&&s.bone==='Right fibula'){
   // Model a higher, short-oblique fibular break in its own shaft frame.
   s=shortShaftCut(g,{...s,normal:[0,1,0]},23);
  }
  if(['femur','humerus','tibia','clavicle'].includes(course.id)&&!s.second&&!s.fold&&!s.spiralHeight){
   const axis=s.spiralAxis?vec(s.spiralAxis):vec(s.normal).normalize();
   const lateral=shaftFrame(new T.Vector3(),axis,false).side;
   const width=sliceMetrics(g,a,axis,lateral)?.width||.022;
   s.relief=fractureProfile(width,course.id.length*13+variant*7+level);
   if(['femur','humerus','tibia'].includes(course.id)&&s.bone!=='Right fibula'){
    if(g.userData.endosteum){const {rows,transform}=g.userData.endosteum;s.relief.ct=canalSampler(rows,transform,mirror);}
    s.relief.canal=course.id==='femur'&&variant===1?T.MathUtils.clamp(.011/width,.28,.52):.48;
   }else if(s.bone==='Right fibula'&&g.userData.endosteum&&!(course.id==='tibia'&&variant===1&&level===2&&!mirror)){
    // This native right distal oblique pair requires the external-only contact cap.
    const {rows,transform}=g.userData.endosteum;
    s.relief.ct=canalSampler(rows,transform,mirror);s.relief.canal=.35;s.relief.requireMeasured=true;
   }
   if(surface==='spiral')s.relief.amplitude*=.42;
  }
  const roughMetaphysis=course.id==='distalfemur'||course.id==='scaphoid'||
   (course.id==='patella'&&variant===0)||(course.id==='olecranon'&&variant===0)||
   (course.id==='calcaneus'&&variant===1)||(course.id==='metacarpal'&&(variant===0||variant===3));
  if(useSpecimen&&!shape&&!motions.length&&
     (course.id==='elbow'||(course.id==='trochanter'&&variant!==1)||roughMetaphysis)){
   const normal=vec(s.normal).normalize(),lateral=shaftFrame(new T.Vector3(),normal,false).side;
   const width=sliceMetrics(g,a,normal,lateral)?.width||.025;
   const profile=fractureProfile(width,149+variant*31);
   // Keep the clinical fracture plane; give its two matching surfaces shallow relief.
   profile.amplitude=roughMetaphysis?T.MathUtils.clamp(width*.008,.00009,.00026):Math.min(profile.amplitude,.00032);
   s={...s,relief:profile};
   if(course.id==='calcaneus'){
    const clearance=vec(s.minus.shift).addScaledVector(normal,-.8).toArray();
    s.minus={...s.minus,shift:clearance};
   }
  }
  if(shape&&motions.length&&s.relief&&!s.spiralHeight)s.relief={...s.relief,amplitude:0};
  if(motions.length){
   if(!referenceWidth){
    const low=vec(atLevel(g,s.axis,fraction-.08)),high=vec(atLevel(g,s.axis,fraction+.08));
    frame=s.digitAxis?shaftFrame(new T.Vector3(),s.digitAxis.clone().negate(),false):shaftFrame(low,high,s.axis===2);
    const cross=sliceMetrics(g,a,frame.axis,frame.side);
    referenceWidth=Math.max(2,cross?cross.width*1000:9);
    sharedPivot=(cross?.centre||a).toArray();
   }
   if(course.id==='radius'){
    s={...s,minus:{...s.minus,tuned:'wrist'}};
    followMotion=s.minus;
   }else{
    s=customPose(s,motions,referenceWidth);s.pivot=sharedPivot;
    s[s.axis===2?'plus':'minus'].tuned='shaft';
   }
  }
  if(course.id==='tibia'&&variant===0&&!motions.length&&!shape){
   sharedPivot||=a.toArray();s.pivot=sharedPivot;
   s.minus={...s.minus,shift:[5,-4.5,0]};
  }
  if(course.id==='tibia'&&variant===1&&!motions.length){
   if(surface==='spiral')s.minus={...s.minus,shift:spiralDirection.clone().multiplyScalar(-8).toArray(),turn:[0,4.5,0]};

   sharedPivot||=a.toArray();s.pivot=sharedPivot;
  }
  if(v.fissure){
   addBone(s.bone,bone);
   const halves=section(g,s.normal,a.toArray()),outline=halves[0].outline;
   const coords=outline.attributes.position.array,partial=[];
   for(let i=0;i<coords.length;i+=6)if(coords[i]<a.x)partial.push(...coords.slice(i,i+6));
   const trace=new T.BufferGeometry();trace.setAttribute('position',new T.Float32BufferAttribute(partial,3));
   const edge=new T.LineSegments(trace,line);edge.userData.dispose=true;group.add(edge);annotations.push(edge);
   for(const half of halves)for(const geo of [half.geo,half.face,half.outline])geo.dispose();
  }else{
   if(course.id==='single-forearm'&&variant<2&&!motions.length&&!shape){
    const distal=vec(atLevel(lessonMesh('Right ulna'),1,.035));
    const axis=vec(atLevel(g,1,.971)).sub(distal).normalize();
    s.normal=axis.toArray();s.pivot=distal.addScaledVector(axis,a.clone().sub(distal).dot(axis)).toArray();
   }
   if(course.id==='pelvis'&&variant===0){
    // The posterior ring rotates about the sacroiliac articulation in this specimen.
    const sacrum=lessonMesh('Sacrum'),tree=surfaceTree(sacrum),near=sacrum.boundingBox.clone().expandByScalar(.004);
    const hip=g.attributes.position,p=new T.Vector3(),points=[],query={point:new T.Vector3()};
    for(let i=0;i<hip.count;i++){p.fromBufferAttribute(hip,i);
     if(near.containsPoint(p)&&tree.closestPointToPoint(p,query,0,.004))points.push(p.clone());
    }
    if(points.length){
     points.sort((a,b)=>b.z-a.z);const band=points.slice(0,Math.max(1,Math.round(points.length*.15)));
     s.pivot=band.reduce((sum,p)=>sum.add(p),new T.Vector3()).divideScalar(band.length).toArray();
    }
   }
   const start=animated.length;addFracture(shapePreset(s,g,a),a);
   if(motions.length){
    const cutNormal=vec(s.spiralHeight?s.spiralAxis:s.normal).normalize();
    for(const part of animated.slice(start))if(part.tuned==='shaft'){
     part.cutNormal=cutNormal;part.cutRise=(s.spiralHeight||0)*1000;
     if(course.id==='single-forearm'){
      const other=lessonMesh(s.bone.includes('radius')?'Right ulna':'Right radius'),box=other.boundingBox;
      const fraction=T.MathUtils.clamp((a.y-box.min.y)/(box.max.y-box.min.y),.06,.94);
      part.neighborClearance=a.clone().sub(vec(atLevel(other,1,fraction)));
      part.neighborClearance.y=0;
      part.neighborClearance.normalize().multiplyScalar(.004);
     }
    }
   }
   if(plateauBed)for(const item of animated.slice(start)){
    item.shell.userData.plateauShell=true;wedges.push(applyPlateauBed(item.shell,plateauBed),applyPlateauBed(item.face,plateauBed));
    bedRims.push(followPlateauRim(item,plateauBed));
   }
   if(course.id==='femur'&&variant===2&&!shape&&!motions.length)animated[start].clearancePulse=new T.Vector3(0,-.004,0);
   if(course.id==='tibia'&&variant===0&&!shape&&!motions.length)animated[start].clearancePulse=new T.Vector3(0,-.0026,0);
   if(spiralDirection&&course.id==='tibia'&&!motions.length)animated[start].spinAxis=spiralDirection.clone();
   if(['femur','humerus'].includes(course.id)&&variant<2&&!motions.length&&!shape){
    animated[start].tractionTiming='distal';animated.at(-1).tractionTiming='proximal';
   }
   if((s.proximalHeadPivot||(['femur','humerus'].includes(course.id)&&variant<2))&&!motions.length&&g.userData.headCentre){
    const proximal=animated.at(-1),head=g.userData.headCentre;proximal.headCentre=head;
    proximal.anchor=head.clone();proximal.pivot.position.copy(head);
    for(const obj of proximal.pivot.children)obj.position.copy(head).negate();
   }
   if(course.id==='pelvis'&&variant===0){
    impaction=prepareRamusCompression(animated[start],a,vec(s.normal));
   }
   if(v.name.includes('嵌插')&&animated.length-start===2){
    const pieces=animated.slice(start),driver=pieces.find(i=>i.moving),receiver=pieces.find(i=>!i.moving);
    if(driver&&receiver&&driver.shift.lengthSq()>0)impaction=prepareImpaction(receiver,driver,a);
   }
   if(course.id==='single-forearm'&&variant<2&&!motions.length&&!shape){
    const axis=vec(s.normal).normalize();if(axis.y<0)axis.negate();
    for(const item of animated.slice(start))item.spinAxis=axis.clone().multiplyScalar(Math.sign(item.turn.y)||1);
   }
  }
  bounds.union(g.boundingBox);
 }
 const lesion=anchors.reduce((s,a)=>s.add(a),new T.Vector3()).divideScalar(anchors.length);
 fractureFocus.copy(lesion);
 if(course.id==='ankle'){
  const limb=new T.Group(),talus=lessonMesh('Right talus');
  const axis=nativeAnchor(talus,[v.roll>0?.90:.10,.91,.5]);
  limb.position.copy(axis);group.add(limb);
  for(const name of boneData.keys()){
   if(!/right/i.test(name)||!/(talus|calcaneus|tarsal|cuneiform|cuboid|of right foot|of right .*toe)/i.test(name))continue;
   const m=addBone(name,adjacent,limb);m.position.copy(axis).negate();nearBones.push(m);
  }
  anklePose={limb,origin:axis,sign:v.roll};
 }
 for(const name of course.id==='ankle'?[]:ctx){
  const m=addBone(name,adjacent);if(!m)continue;
  nearBones.push(m);
  let extra=v.moving?.find(item=>item.names.includes(name));
  if(extra&&useSpecimen&&course.id==='lunate-dislocation'&&variant===0){
   const pose=lunateAdjuncts[mirror?'Left':'Right'][name];if(pose)extra={...extra,...pose};
  }
  const bind=useSpecimen&&course.id==='scaphoid'&&variant<2?{'Right trapezium':0,'Right trapezoid':0}:v.bind;
  if(bind&&Object.hasOwn(bind,name)){
   const driver=animated.filter(i=>i.shell)[bind[name]];driver.pivot.add(m);m.position.copy(driver.anchor).negate();
  }else if(extra){
   const a=extra.pivot?landmark(lessonMesh(name),extra.pivot):anchors[0],pivot=new T.Group();group.add(pivot);pivot.add(m);m.position.copy(a).negate();
   animated.push({pivot,anchor:a,shift:vec(extra.shift||[0,0,0]).multiplyScalar(.001),turn:vec(extra.turn||[0,0,0]).multiplyScalar(Math.PI/180),waypoints:extra.via?[extra.via]:undefined,sharedClock:Boolean(extra.via),adjunct:true});
  }else if(v.follow?.includes(name)){
   const a=anchors[0],pivot=new T.Group();group.add(pivot);pivot.add(m);m.position.copy(a).negate();
   animated.push({pivot,anchor:a,follows:animated.find(i=>i.shell&&i.name===v.cuts[0].bone),tuned:followMotion.tuned,shift:vec(followMotion.shift).multiplyScalar(.001),turn:vec(followMotion.turn).multiplyScalar(Math.PI/180)});
  }
 }
 span=v.span||course.span||Math.max(...bounds.getSize(new T.Vector3()).toArray())*1.12;
 if(course.kind==='joint')focus.copy(lesion);else if(v.focus)focus.copy(landmark(lessonMesh(v.cuts[0].bone),v.focus));else if(v.span||course.span)focus.copy(lesion);else bounds.getCenter(focus);

 if(v.force){
  const direction=vec(v.force).normalize(),len=span*.20;
  const arrow=new T.ArrowHelper(direction,lesion.clone().addScaledVector(direction,-len*1.32),len,0xf6ba75,len*.28,len*.14);
  arrow.userData.force=true;annotations.push(arrow);group.add(arrow);
 }
 if(v.twist||v.roll){
  const pts=[],r=span*(v.roll?.16:.12);
  for(let i=0;i<=28;i++){
   const a=(.18+1.35*i/28)*Math.PI*(v.roll||1);
   pts.push(lesion.clone().add(v.roll?new T.Vector3(r*Math.cos(a),r*Math.sin(a),0):new T.Vector3(r*Math.cos(a),0,r*Math.sin(a))));
  }
  const arc=new T.Line(new T.BufferGeometry().setFromPoints(pts),line);
  arc.userData.dispose=true;arc.userData.force=true;group.add(arc);annotations.push(arc);
  const tangent=pts.at(-1).clone().sub(pts.at(-2)).normalize();
  const tip=new T.ArrowHelper(tangent,pts.at(-2),r*.32,0xf6ba75,r*.28,r*.19);tip.userData.force=true;group.add(tip);annotations.push(tip);
 }
 // Apply the pre-checked native-surface correction only to the authored cut and motion.
 if(course.id==='clavicle'&&variant===1&&!shape&&!motions.length){
  for(const [j,item] of animated.filter(i=>i.shell).entries())item.clearancePulse=new T.Vector3((j?1:-1)*.0022,0,0);
 }
 if(useSpecimen&&/rib/i.test(v.cuts[0].bone)&&!v.fissure){
  const parts=animated.filter(i=>i.shell);
  if(parts.length===2){
   const gap=course.id==='region-rib-12'?.0024:.0012;
   parts[0].shift.z-=gap;parts[1].shift.z+=gap;
  }
 }
 if(useSpecimen&&course.id==='intercondylar'&&variant===0&&!shape&&!motions.length){
  for(const i of animated.filter(i=>i.shell&&i.moving))i.shift.y-=.001;
 }
 const fitKey=[course.id,variant,course.levels?level:1,mirror?'L':'R'].join('/');
 const fit=!shape&&!motions.length&&(useSpecimen?specimenFits[fitKey]:!(course.id==='humerus'&&variant<2)&&fittedShifts[fitKey]);
 if(fit){
  const shells=animated.filter(item=>item.shell);
  fit.forEach((delta,k)=>{
   if(!delta||!shells[k])return;
   const driver=shells[k],offset=vec(delta).multiplyScalar(.001);
   driver.shift.add(offset);
   for(const linked of animated)if(linked.follows===driver)linked.shift.add(offset);
  });
 }
 for(const mesh of wedges){
  const ref=new T.Mesh(mesh.geometry,ghostMaterial);
  ref.position.copy(mesh.position);ref.quaternion.copy(mesh.quaternion);ref.visible=false;mesh.parent.add(ref);
  deformationGhosts.push({mesh,ref});
 }
 const available={
  trace:annotations.some(o=>!o.userData.force)||animated.some(i=>i.shell||i.jointLabel)||wedges.length>0,
  ghost:animated.some(i=>i.moving||i.jointLabel)||wedges.length>0,
  guides:animated.some(i=>i.guidePoint||i.jointLabel)||Boolean(v.force||v.twist||v.roll)||Boolean(v.depression),
  neighbors:nearBones.length+jointReferences.length>0
 };
 for(const [id,has] of Object.entries(available))$(id).disabled=!has;
 $('opacityRow').hidden=!nearBones.length;
 const unavailable=Object.entries({trace:'断缘与轨迹',ghost:'伤前轮廓',guides:'方向标记',neighbors:'邻近骨骼'}).filter(([id])=>!available[id]).map(([,name])=>name);
 $('layersAvailability').textContent=unavailable.length?'本例无可显示的'+unavailable.join('、')+'。':'';
 $('layersAvailability').hidden=!unavailable.length;
 // Direction markers follow the fragment and use anatomical model coordinates.
 for(const item of animated){
  if(item.shift.length()<.001||item.pivot.children.every(o=>nearBones.includes(o)))continue;
  const direction=item.shift.clone().normalize(),offset=new T.Vector3();
  const rim=item.edge?.geometry.attributes.position;
  if(rim?.count){
   const point=new T.Vector3();let front=-Infinity;
   for(let k=0;k<rim.count;k++){point.fromBufferAttribute(rim,k);if(point.z>front){front=point.z;offset.copy(point);}}
   offset.sub(item.anchor);
  }
  const length=Math.max(span*.075,Math.min(span*.17,item.shift.length()*2.5));
  const arrow=new T.ArrowHelper(direction,item.anchor.clone().add(offset),length,0x146a60,length*.30,length*.17);
  arrow.userData.displacement=true;arrow.userData.item=item;arrow.userData.offset=offset;group.add(arrow);annotations.push(arrow);
 }
 if(mirror){focus.x*=-1;fractureFocus.x*=-1;}
 applyMotion=buildKinematics(animated,wedges,motions,frame,referenceWidth,course.kind==='joint',quantities,()=>{
  fragmentRig?.sample();playing=false;setProgress(1);syncPlayer();syncExam();updateURL();
 },{id:course.id,variant,legacyMotion,selectedShape:shape,wedge:shape==='wedgeFragment',palmar:course.id==='radius'&&variant===0?wristLandmarks(lessonMesh('Right radius')).palmar:null,ankleSign:anklePose?.sign,mirror});
 const primary=v.cuts.find(s=>s.bone===teachingBone(selected))||v.cuts[0];
 const proximalFemur=(course.id==='trochanter'&&variant===1||course.id==='femur'&&variant===0)&&!shape&&!motions.length;
 const forearm=course.id==='single-forearm'&&variant<2&&!shape&&!motions.length;
 poseGuide=motionGuide(group,animated,primary.bone,proximalFemur?'proximal-femur':forearm?'forearm':'standard',span);
 const cue=poseGuide?'虚线为伤前骨轴，实线为当前骨轴。':'';
 $('motionNote').textContent=cue;
 $('motionNote').hidden=!$('motionNote').textContent;

 function observe(item){
  inspection?.dispose();
  const i=Math.max(0,v.cuts.findIndex(s=>s.bone===(item?.name||primary.bone))),source=v.cuts[i];
  inspection=makeObservation({course,variant,source,geometry:lessonMesh(source.bone),anchor:anchors[i]||anchors[0],parts:animated,group,context:nearBones,joint:course.kind==='joint',frame,tracked:item,lookupGeometry:lessonMesh});
 }
 fragmentRig=fragmentEditor({items:animated,values:quantities,primary:primary.bone,mirror,world:group,basePose:applyMotion,preferred:chosenFragment,
  onEdit:()=>{playing=false;holdUntil=0;setProgress(1);syncExam();updateURL();},
  onSelect:g=>{chosenFragment=g.id;observe(g.members.find(i=>i.name===primary.bone)||g.members[0]);syncStudy();setProgress(progress);updateURL();}
 });
 const active=fragmentRig?.active;
 observe(active?.members.find(i=>i.name===primary.bone)||active?.members[0]);
 $('fragmentBox').hidden=!fragmentRig;
 $('motionStatus').textContent=fragmentRig?'青点是伤前位置，赭点随断缘移动。':wedges.length?(v.depression?'对照外侧平台中央与边缘高度。':v.cuts.some(s=>s.surface==='dent')?'从切线方向比较颅盖凹陷深度。':'比较椎体伤前与当前的局部高度。'):course.kind==='joint'?'以关节窝为参照，观察活动骨端。':'本分型示例保持对位，显示损伤位置。';
 if((studyMode==='cut'&&!inspection?.cut)||(studyMode==='facet'&&!inspection?.patch))studyMode='overview';
 timing=course.kind==='joint'?'joint':fragmentRig?'fracture':null;
 if(timing==='fracture'&&!impaction&&!bedRims.length)for(const item of animated)if(item.edge)orderRim(item.edge);
 if(v.depression){
  const tibia=lessonMesh('Right tibia');profile=plateauProfile(group,tibia,plateauSite(tibia),wedges,surfaceTree);
 }
 alignment=carpalAlignment(group,animated,lessonMesh,course);
 mechanics=buildMechanics({group,world,items:animated,wedges,nearBones,course,variant:v,ghostMaterial,mirror,pose:rawPose,timing,bandLandmarks:!useSpecimen||['left-leg','right-leg'].includes(specimen.group(needed))});
 $('advanced').hidden=!fragmentRig&&$('quantBox').hidden&&!featuresFor(course,variant).shapes.length&&!featuresFor(course,variant).motions.length&&!mechanics.candidateCount&&!mechanics.ties.length;
 $('bandControls').hidden=!mechanics.ties.length;$('bandNames').textContent=mechanics.ties.join(' · ');
 syncStudy();
 syncPlayer();
 if(!keepView){
  const d=fragmentRig?.focus.delta,homeDir=vec([-.6,.17,1]).normalize();
  const visible=d?.clone();if(visible)visible.x*=group.scale.x;
  const projected=visible?visible.addScaledVector(homeDir,-visible.dot(homeDir)).length():Infinity;
  const small=projected*Math.min(viewWidth,viewHeight)/Math.max(.001,span*.57)<22;
  if(course.id==='region-palatine'&&useSpecimen)palateView(lessonMesh(v.cuts[0].bone),.048);
  else if(small&&d.lengthSq()>1e-10&&studyMode==='overview')motionCloseUp(smooth,true);
  else aim(v.depression?'plateauDetail':course.kind==='joint'?jointView():'detail',smooth);
 }
 previous=0;setProgress(progress);if(viewParams)restoreView(viewParams);
 if(selected&&isLimbBone(selected)&&Object.values(tissueControls).some(id=>$(id).checked))showTissues();
}
function rawPose(t,report=false){
 const progress=injuryTime(t,timing);
 applyMotion?.(progress,report);fragmentRig?.apply(progress);impaction?.();for(const update of bedRims)update();
 if(anklePose){
  const u=T.MathUtils.smoothstep(progress,.19,.76),angle=applyMotion.footRoll();
  anklePose.limb.rotation.z=anklePose.sign*T.MathUtils.degToRad(angle)*u;
  anklePose.limb.position.y=anklePose.origin.y-.0012*(angle/12)*Math.sin(Math.PI*u);
 }
}
function scenePose(requested,report=true){
 const observationMode=report?studyMode:'overview';
 const opts={checkBones:true,limitBones:true,hold:$('bandRule').value==='held',slack:Number($('slack').value)/100,draw:$('drawConstraints').checked&&!['cut','facet'].includes(observationMode)};
 const key=opts.limitBones||opts.hold?JSON.stringify([quantities,opts.limitBones,opts.hold,opts.slack]):'';
 const limit=mechanics?.limit(requested,opts,key,playing?8:Infinity)||{time:requested,reason:null},progress=limit.time;
 rawPose(progress,report);
 if(report){
  poseLimit=limit;
  const result=mechanics?.report(progress,opts,!playing||progress===1||progress===0);
  if(limit.reason?.kind==='bone')mechanics?.showStop(limit.reason.point);
  const status=limit.reason?'已限位 · '+limit.reason.name+' · 目标 '+Math.round((limit.target??requested)*100)+'% · 实际 '+Math.round(progress*100)+'%':
   result?.bone?.kind==='bone'?'骨面穿插 · '+result.bone.name:
   result?.bone?.kind==='native'?'源模型已有接触重叠 · '+result.bone.name:mechanics?.candidateCount?'当前采样未检出新增穿插':'本例没有发生相对运动的骨面对';
  $('contactState').textContent=status+(result?.most&&(opts.hold||$('mechanicsBox').open)?'　'+result.most.name+' 附着点间距变化 '+((result.most.ratio-1)*100).toFixed(1)+'%':'');
  $('contactState').classList.toggle('conflict',!!limit.reason||result?.bone?.kind==='bone');
 }else mechanics?.hide();
 const exposed=animated.some(i=>i.shell&&(i.pivot.position.distanceToSquared(i.anchor)>1e-10||Math.abs(i.pivot.quaternion.w)<.9999999));
 for(const item of animated)if(item.shell){const changing=item.pivot.position.distanceToSquared(item.anchor)>1e-10||Math.abs(item.pivot.quaternion.w)<.9999999;const editing=$('fragmentBox').open&&fragmentRig?.active.members.includes(item);item.shell.material=editing&&report?editedMaterial:changing?displacedMaterial:bone;if(item.ghost)item.ghost.visible=$('ghost').checked&&changing;item.face.visible=exposed||observationMode==='cut'||observationMode==='facet';}
 for(const obj of annotations){
  obj.visible=obj.userData.force?$('guides').checked&&progress>.05&&progress<.63:obj.userData.displacement?$('guides').checked&&progress>.24:$('trace').checked&&progress>=.30;
  if(obj.userData.progressive){
   const u=T.MathUtils.clamp((progress-.12)/.10,0,1);
   obj.geometry.setDrawRange(0,2*Math.floor(obj.geometry.attributes.position.count*u/2));
   obj.visible=$('trace').checked&&u>0;
  }
  if(obj.userData.displacement){
   const {item,offset}=obj.userData,delta=offset.clone().applyQuaternion(item.pivot.quaternion).add(item.pivot.position).sub(item.anchor).sub(offset),length=delta.length();
   obj.visible=obj.visible&&length>.0003&&observationMode!=='cut'&&observationMode!=='facet';
   if(obj.visible){obj.position.copy(item.anchor).add(offset);obj.setDirection(delta.normalize());obj.setLength(length,length*.26,length*.14);}
  }
 }
 const layersVisible=observationMode!=='cut'&&observationMode!=='facet';
 for(const mesh of jointReferences)mesh.visible=$('neighbors').checked;
 for(const {mesh,ref} of deformationGhosts)ref.visible=$('ghost').checked&&layersVisible&&mesh.morphTargetInfluences?.some(weight=>weight>.001);
 fragmentMarks=$('guides').checked&&layersVisible&&progress>.15?motionLabels():[];
 for(const item of animated.filter(item=>item.trajectory)){
  const trace=item.trajectory,points=trace.geometry.attributes.position;
  trace.visible=layersVisible&&$('trace').checked&&item.pivot.position.distanceToSquared(item.anchor)>.00000025;
  if(trace.visible){
   points.setXYZ(1,item.pivot.position.x,item.pivot.position.y,item.pivot.position.z);
   points.needsUpdate=true;trace.computeLineDistances();
  }
 }
 for(const obj of nearBones)obj.visible=$('neighbors').checked;
 inspection?.update(observationMode,progress,$('neighbors').checked);
 if(inspection&&observationMode==='overview'&&(!$('guides').checked||fragmentMarks.length))inspection.tags.length=0;
 profileMarks=profile?.update($('guides').checked&&observationMode!=='cut')||[];
 const axisMarks=alignment?.update($('guides').checked&&$('neighbors').checked&&['motion','overview'].includes(observationMode)&&($('compareTypes').checked||observationMode==='motion'||course.id==='lunate-dislocation'));
 if(axisMarks?.length&&inspection){inspection.tags.length=0;inspection.tags.push(...axisMarks);}
 if(observationMode==='cut'||observationMode==='facet')for(const i of animated)if(i.ghost)i.ghost.visible=false;
 if(fragmentRig){
  const marked=fragmentRig.display(injuryTime(progress,timing),$('trace').checked&&observationMode!=='cut'&&(report||progress>=1));
  if(report){
   $('motionReadout').classList.toggle('with-reference',marked.referenceVisible);
   if($('fragmentBox').open&&studyMode==='overview'&&inspection){
    inspection.tags.length=0;inspection.tags.push({text:'调节中的骨块',point:marked.target});
   }
   const edited=hasEdits(quantities);
   const read=edited?'自定义骨块姿态':$('liveValues').textContent;
   $('liveValues').textContent=(read?read+'　':'')+(impaction?'相对伤前断缘位移 ':'断缘对应点错开 ')+marked.distance.toFixed(1)+' mm';
  }
 }
 motionWords=poseGuide?.update($('guides').checked&&layersVisible&&progress>.15)||[];
 if(report&&observationMode==='facet'){
  const m=inspection?.measurements();
  if(m)$('liveValues').textContent+='　标示点高差 '+m.height.toFixed(1)+' mm　面内错位 '+m.slip.toFixed(1)+' mm';
 }
}
function updateMotionReadout(){
 const full=$('liveValues').textContent||'';
 const fields=full.split(/　+/).filter(Boolean);
 const main=fields.filter(s=>/旋|短缩|缩短|平移|侧移|移位|成角|倾|转角|压低|分离|重叠|内翻|外翻|内收|外展|屈曲|后伸/.test(s)&&!s.includes('断缘对应点'));
 const nonzero=main.filter(s=>/[-+]?[0-9.]+/.test(s)&&Number(s.match(/[-+]?[0-9.]+/)[0])!==0);
 const minimum=nonzero.length?nonzero:main.length?main:fields;
 const travel=nonzero.filter(note=>/平移/.test(note));
 const visible=motionWords.length?[...motionWords,...(course?.kind==='joint'?travel:[])]:minimum;
 const summary=visible.slice(0,4).join('　');
 if($('motionReadout').textContent!==summary)$('motionReadout').textContent=summary;
}
function setProgress(value){
 if(loadingSpecimen)return;
 dirty=true;progress=Math.max(0,Math.min(1,value));scenePose(progress);updateMotionReadout();updateLinkedTissues();
 if(poseLimit?.unfinished)progress=poseLimit.time;
 if(poseLimit?.reason){progress=poseLimit.time;playing=false;holdUntil=0;}
 $('time').value=Math.floor(progress*1000);
 $('frameTime').textContent=(progress*5).toFixed(2)+' s';
 $('prevFrame').disabled=progress<=0;$('nextFrame').disabled=progress>=1;
 const indentation=course?.variants[variant]?.cuts.some(s=>s.surface==='dent');
 $('phase').textContent=progress<.05?'正常形态':progress<.30?'受力阶段':progress<.45?(wedges.length?(indentation?'局部开始凹陷':'椎体开始压缩'):'骨折线显现'):progress<1?(wedges.length?(indentation?'颅盖凹陷':'楔形压缩'):'骨块移位'):'最终形态';
 if(course?.kind==='joint')$('phase').textContent=quantities.travel===0?((quantities.jointTwist>0||(quantities.spin??course.variants[variant].turn?.some(Boolean))>0)?'原位转动':'保持对位'):progress<.25?'关节对位':progress<.78?'关节面移出':'示例终点';
 if(course?.kind!=='joint'&&motions.length&&progress>=.45&&progress<1){
  $('phase').textContent=progress<.54?'平移与长度变化':motions.some(k=>k==='rotate'||k==='angle')?'转角形成':'断端移位';
 }
 if(course?.kind!=='joint'&&!fragmentRig&&!wedges.length&&progress>.35)$('phase').textContent='断线观察 · 保持对位';
 if(timing==='fracture'){
  const pull=!shape&&!motions.length&&!hasEdits(quantities)&&hasTraction(course,variant);
  $('phase').textContent=progress<.12?'伤前对位':progress<.19?'断缘显露':progress<.40?'骨块初次错开':progress<.90?(pull?'牵拉移位':'断端继续移位'):'终末姿态';
 }
 if(course?.variants[variant]?.depression)$('phase').textContent=progress<.16?'平台对位':progress<.86?'关节面压低':'终末形态';
 if(poseLimit?.reason)$('phase').textContent=poseLimit.reason.kind==='band'?'韧带伸长限位':'骨面接触限位';
 $('quickPlay').textContent=playing?'Ⅱ　暂停':progress>=1||poseLimit?.reason?'↻　重播':'▶　播放';
 $('play').textContent=playing?'Ⅱ 暂停':progress>=1||poseLimit?.reason?'↻ 重播':'▶ 播放';
}
const anatomyDirections=[['患者左侧','患者右侧'],['上方','下方'],['前方','后方']];
const viewsByAxis=[['leftSide','side'],['top','inferior'],['front','rear']];
function orientation(){
 dirty=true;
 const direction=camera.position.clone().sub(controls.target).normalize().toArray();
 const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion).toArray();
 const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion).toArray();
 let horizontal=0,vertical=1,projection=0;
 for(let h=0;h<3;h++)for(let v=0;v<3;v++){
  const agreement=Math.abs(right[h])+Math.abs(up[v]);
  if(h!==v&&agreement>projection){projection=agreement;horizontal=h;vertical=v;}
 }
 const across=Number(right[horizontal]<0),upright=Number(up[vertical]<0);
 const east=anatomyDirections[horizontal][across],west=anatomyDirections[horizontal][1-across];
 const north=anatomyDirections[vertical][upright],south=anatomyDirections[vertical][1-upright];
 for(const [name,label] of Object.entries({TL:north,TR:east,BL:west,BR:south})){
  const marker=$('dir'+name);if(marker.textContent!==label)marker.textContent=label;
 }
 const normal=direction.map((v,i)=>[Math.abs(v),i,Number(v<0)]).sort((a,b)=>b[0]-a[0]);
 $('viewSummary').textContent='视向 '+normal.filter(([weight])=>weight>.36).map(([,axis,sign])=>anatomyDirections[axis][sign]).join(' / ')+'；画面左侧 '+west+'，上方 '+north;
 const [weight,axis,sign]=normal[0];
 for(const btn of document.querySelectorAll('#viewRail [data-view]:not([data-view=home])'))btn.setAttribute('aria-pressed',String(weight>.995&&btn.dataset.view===viewsByAxis[axis][sign]));
}
function frame(now){
 if(contextLost){previous=now;requestAnimationFrame(frame);return;}
 if(playing&&course){
  if(holdUntil){if(now>=holdUntil){holdUntil=0;setProgress(0);}}
  else{
   setProgress(poseLimit?.unfinished?poseLimit.target:progress+(previous?Math.max(0,(now-previous)/1000):0)*speed/5);
   if(poseLimit?.reason){playing=false;setProgress(progress);}
   else if(progress===1){if(repeating)holdUntil=now+950;else{playing=false;setProgress(1);}}
  }
 }else holdUntil=0;
 if(flight){
  const fraction=Math.min(1,(now-flight.start)/520),t=fraction*fraction*(3-2*fraction);
  camera.position.lerpVectors(flight.from,flight.end,t);controls.target.lerpVectors(flight.target,flight.focus,t);
  if(fraction>=1)flight=null;
 }
 previous=now;controls.update();
 if(dirty||flight||playing){
  camera.updateMatrixWorld();
  overviewLabels();paintLabels();renderer.render(world,camera);
  dirty=false;
 }
 requestAnimationFrame(frame);
}
async function start(){
 const fullDpr=Math.min(devicePixelRatio,smallScreen.matches?1.5:2);
 renderer=new T.WebGLRenderer({antialias:!smallScreen.matches,alpha:true,powerPreference:smallScreen.matches?'low-power':'default'});
 renderer.localClippingEnabled=true;
 renderer.setPixelRatio(fullDpr);
 host.append(renderer.domElement);
 renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();contextLost=true;playing=false;controls?.cancel();
  $('status').hidden=false;$('status').textContent='三维显示已暂时中断，等待浏览器恢复…';
 });
 renderer.domElement.addEventListener('webglcontextrestored',()=>{
  contextLost=false;dirty=true;
  if(!loadingSpecimen&&ready)$('status').hidden=true;
  if(lessonOpen())setProgress(progress);
 });
 camera=new T.PerspectiveCamera(38,1,.001,30);controls=new ViewControls(camera,host,()=>Boolean(selected));
 controls.addEventListener('start',()=>{flight=null;automaticFit=false;});controls.addEventListener('change',orientation);
 controls.addEventListener('input',()=>{viewEdits++;});
 bone.color.set(0xe4d6bb);accent.color.set(0x81ae9c);world.add(new T.HemisphereLight(0xfffcf4,0x625c53,.92));
 for(const [pos,intensity] of [[[2,3,3],2.25],[[-3,1,-3],.95]]){const l=new T.DirectionalLight(0xfff3dc,intensity);l.position.set(...pos);world.add(l);}
 const resize=()=>{
  const w=host.clientWidth,h=host.clientHeight,previousAspect=camera.aspect;viewWidth=w;viewHeight=h;
  dirty=true;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(ready&&automaticFit&&selectedMesh&&!lessonOpen()&&!loadingSpecimen){
   centreMesh(camera.position.clone().sub(controls.target));return;
  }
  if(ready&&previousAspect>0&&camera.aspect>0){
   // Keep the student's sightline when opening a drawer, rotating the phone or resizing.
   const fit=selected?Math.min(1,previousAspect)/Math.min(1,camera.aspect):
    Math.max(span,.65/camera.aspect)/Math.max(span,.65/previousAspect);
   if(Math.abs(fit-1)>.001){
    const offset=camera.position.clone().sub(controls.target).multiplyScalar(fit);
    camera.position.copy(controls.target).add(offset);
    if(flight)flight=null;
    controls.update();
   }
  }
 };
 new ResizeObserver(resize).observe(host);resize();
 async function getAsset(u){
  const r=await fetch(assetURL(u));
  if(!r.ok)throw Error('无法加载 '+u);
  return u.endsWith('json')?r.json():r.arrayBuffer();
 }
 let previewMeta=null;
 const metadata=getAsset('models/detail.json').then(value=>previewMeta=value,()=>null);
 const [index,bin]=await Promise.all([getAsset('models/index.json'),loadOverviewBytes(getAsset)]);
 const framesById=new Map(previewMeta?.entries.map(entry=>[entry.mesh,landmarkMap(entry,previewMeta.display_offset_mm)]));
 for(const m of index){
  const key=boneData.has(m.name)?m.name+' '+m.mesh:m.name;
  const preview=materialize(m,bin),coordinateMap=framesById.get(m.mesh);
  if(coordinateMap)alignPreview(preview,coordinateMap);
  overviewMeshes.set(key,preview);boneData.set(key,preview);meshByKey.set(key,m.mesh);keyByMesh.set(m.mesh,key);
 }
 const readFullMetadata=()=>metadata.then(value=>value??getAsset('models/detail.json'));
 function installAssembly(surfaces){
  for(const [mesh,g] of surfaces)boneData.set(keyByMesh.get(mesh),g);
  host.dataset.detailedBones=String([...boneData].filter(([name,g])=>g!==overviewMeshes.get(name)).length);
  if(!selected&&!controls.interacting){
   for(const child of group.children){
    const detail=boneData.get(child.userData.bone);
    if(detail)child.geometry=detail;
   }
   dirty=true;
  }
 }
 if(location.protocol==='file:'){
  let allSurfaces;
  assemblyDetail={ready:()=>Boolean(allSurfaces),load:()=>allSurfaces??=(async()=>{
   const [manifest,bytes]=await Promise.all([readFullMetadata(),getAsset('models/detail.bin.gz')]);
   installAssembly(await decodeSurfaces(manifest,bytes));
  })().catch(error=>{allSurfaces=null;throw error;})};
 }else assemblyDetail=assembledSurfaces(getAsset,readFullMetadata,installAssembly);
 buildIndex(boneData.keys(),pickBone,key=>matches(key).length);
 ready=true;host.dataset.ready='true';route();$('status').hidden=!loadingSpecimen;
 // A prior release let the user save an offline web snapshot. Retire only
 // this atlas registration and leave explicitly saved material in browser storage.
 if(location.protocol!=='file:')navigator.serviceWorker?.getRegistration().then(registration=>{
  const worker=registration?.active||registration?.waiting||registration?.installing;
  if(worker?.scriptURL===new URL('./sw.js',location.href).href)return registration.unregister();
 }).catch(()=>{});
 const ray=new T.Raycaster(),canvas=renderer.domElement;
 function dragResolution(moving){const next=moving?Math.min(1.25,fullDpr):fullDpr;if(renderer.getPixelRatio()!==next){renderer.setPixelRatio(next);dirty=true;}}
 const impact=new T.Vector3(),pointer=new T.Vector2();let lowDetail=false,hoverRequest=0,lastHoverAt=0;
 function overviewLOD(low){
  if(selected||lowDetail===low)return;lowDetail=low;
  for(const m of group.children){const g=(low?overviewMeshes:boneData).get(m.userData.bone);if(g)m.geometry=g;}
  dirty=true;
 }
 function hit(e){
  const box=host.getBoundingClientRect();pointer.set(2*(e.clientX-box.left)/box.width-1,1-2*(e.clientY-box.top)/box.height);
  ray.setFromCamera(pointer,camera);
  // Overview meshes already share patient coordinates. Only raycast boxes in front
  // of the best known exact surface hit.
  const candidates=[];
  for(const mesh of group.children){
   const bounds=mesh.geometry?.boundingBox;
   if(bounds&&ray.ray.intersectBox(bounds,impact))candidates.push({mesh,entry:bounds.containsPoint(ray.ray.origin)?0:ray.ray.origin.distanceTo(impact)});
  }
  candidates.sort((a,b)=>a.entry-b.entry);let nearest=Infinity,result=null;
  const hits=[];
  for(const {mesh,entry} of candidates){
   if(entry>nearest)break;
   hits.length=0;mesh.raycast(ray,hits);
   for(const h of hits)if(h.distance<nearest){nearest=h.distance;result=mesh;}
  }
  return result;
 }
 function hitSoftTissue(e){
  if(!tissueEntry?.items?.length)return null;
  const box=host.getBoundingClientRect();
  pointer.set(2*(e.clientX-box.left)/box.width-1,1-2*(e.clientY-box.top)/box.height);
  ray.setFromCamera(pointer,camera);
  const candidates=[],worldBox=new T.Box3();
  for(const item of tissueEntry.items){
   if(!item.mesh.visible)continue;
   const localBox=item.mesh.geometry?.boundingBox;
   if(!localBox)continue;
   worldBox.copy(localBox).applyMatrix4(item.mesh.matrixWorld);
   // Pad slightly for shader-displaced meshes near fractures
   worldBox.expandByScalar(.03);
   if(ray.ray.intersectBox(worldBox,impact)){
    candidates.push({item,entry:worldBox.containsPoint(ray.ray.origin)?0:ray.ray.origin.distanceTo(impact)});
   }
  }
  candidates.sort((a,b)=>a.entry-b.entry);
  let nearest=Infinity,best=null;
  const hits=[];
  for(const {item,entry} of candidates){
   if(entry>nearest)break;
   hits.length=0;item.mesh.raycast(ray,hits);
   for(const h of hits)if(h.distance<nearest){nearest=h.distance;best=item;}
  }
  return best;
 }
 function clearHover(){
  if(hoverRequest){cancelAnimationFrame(hoverRequest);hoverRequest=0;}
  if(hovered){hovered.material=bone;hovered=null;dirty=true;}
  if(tissueEntry?.hoveredKey)hoverSoftStructure(null);
  $('tip').hidden=true;canvas.style.cursor='grab';
 }
 controls.addEventListener('start',clearHover);
 controls.addEventListener('drag',()=>{dragResolution(true);if(!selected)overviewLOD(true);});
 controls.addEventListener('end',()=>{dragResolution(false);overviewLOD(false);});
 controls.addEventListener('tap',e=>{
  if(tissueEntry){
   const item=hitSoftTissue(e.originalEvent);
   selectSoftStructure(item?item.key:null);
   return;
  }
  if(!selected){const name=hit(e.originalEvent)?.userData.bone;if(name)pickBone(name);}
 });
 host.addEventListener('pointerleave',clearHover);
 host.addEventListener('pointermove',e=>{
  if(controls.interacting)return;
  if(e.pointerType==='touch'||hoverRequest||performance.now()-lastHoverAt<32)return;
  if(tissueEntry){
   hoverRequest=requestAnimationFrame(()=>{
    hoverRequest=0;if(!tissueEntry||controls.interacting)return;lastHoverAt=performance.now();
    const item=hitSoftTissue(e);
    if(!item){hoverSoftStructure(null);$('tip').hidden=true;canvas.style.cursor='grab';return;}
    hoverSoftStructure(item.key);
    canvas.style.cursor='pointer';
    const tip=$('tip'),box=host.getBoundingClientRect();
    const roleTag=item.role?(item.role.role==='deforming'?' · '+item.role.action:' · '+(item.role.severity==='high'?'高危受累':'留意风险')):'';
    tip.textContent=item.info.zh+' ('+item.info.en+')'+roleTag;
    tip.hidden=false;
    tip.style.left=Math.max(4,Math.min(box.width-tip.offsetWidth-4,e.clientX-box.left+14))+'px';
    tip.style.top=Math.max(4,e.clientY-box.top-30)+'px';
   });
   return;
  }
  if(selected)return;
  hoverRequest=requestAnimationFrame(()=>{
   hoverRequest=0;if(tissueEntry||selected||controls.interacting)return;lastHoverAt=performance.now();
   const next=hit(e);if(!next){clearHover();return;}
   if(hovered!==next){if(hovered)hovered.material=bone;hovered=next;hovered.material=accent;dirty=true;}
   canvas.style.cursor='pointer';const tip=$('tip'),box=host.getBoundingClientRect();
   tip.textContent=boneName(hovered.userData.bone);tip.hidden=false;
   tip.style.left=Math.max(0,Math.min(box.width-tip.offsetWidth,e.clientX-box.left+14))+'px';tip.style.top=Math.max(0,e.clientY-box.top-28)+'px';
  });
 });
 requestAnimationFrame(frame);
}
$('anatomyPanel').ontoggle=()=>{dirty=true;};
$('anatomyGuides').onchange=()=>{dirty=true;};
$('showRim').onclick=()=>{setStudy('facet');setPanel(false);};
$('signView').onclick=()=>{
 const v=typeView(course,variant);if(!v)return;
 playing=false;setProgress(progress);aim(v==='side'&&/left/i.test(selected)?'leftSide':v,true);
 setPanel(false);
};
$('compareTypes').onchange=()=>{
 playing=false;holdUntil=0;
 if(!lessonOpen())return;
 const sameSource=Boolean(assetsForLesson().length)===useSpecimen;
 renderLesson(false,sameSource);updateURL(true);
};
$('play').onclick=()=>{previous=0;playing=!playing;setProgress(progress>=1||poseLimit?.reason?0:progress);};
$('prevFrame').onclick=()=>{playing=false;setProgress((Math.ceil(progress*300-1e-8)-1)/300);};
$('nextFrame').onclick=()=>{playing=false;setProgress((Math.floor(progress*300+1e-8)+1)/300);};
$('time').oninput=e=>{playing=false;setProgress(+e.target.value/1000);};
$('speed').onclick=e=>{speed=speed===1?.5:speed===.5?.25:speed===.25?1.5:1;e.target.textContent=speed+'×';};
for(const id of ['guides','neighbors','ghost','trace'])$(id).onchange=()=>setProgress(progress);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{if(ready&&!loadingSpecimen)aim(b.dataset.view);};
function backToBone(){
 if(!lessonOpen())return;
 updateURL(true);lastLesson=location.hash;pickBone(selected,{keepLesson:true});
}
$('whole').onclick=()=>pickBone(null);
$('back').onclick=()=>lessonOpen()?backToBone():pickBone(null);
$('navBone').onclick=backToBone;
$('navLesson').onclick=()=>{if(!lessonOpen()&&lastLesson)location.hash=lastLesson;};
$('centreBone').onclick=()=>{
 if(tissueEntry&&!tissueEntry.aligned){aim('home');return;}
 if(!selected||loadingSpecimen)return;playing=false;
 const dir=camera.position.clone().sub(controls.target).normalize();
 if(selectedMesh&&!lessonOpen()){centreMesh(dir);return;}
 setStudy('overview');const key=teachingBone(selected);
 let shown=animated.filter(i=>i.name===key&&i.shell).map(i=>i.shell);
 if(!shown.length)group.traverse(o=>{if(o.isMesh&&o.visible&&o.userData.bone===key&&o.material!==ghostMaterial)shown.push(o);});
 if(shown.length)centreMesh(dir,shown);else aim('home',false);
};
$('anatomyExtent').onchange=e=>{
 regionReference=e.target.value==='region';atlasPalate=e.target.value==='palate';updateURL();renderLesson(false);
};
$('sites').onchange=e=>{legacyMotion=false;regionReference=false;
 $('compareTypes').checked=false;
 quantities={};course=courses.find(c=>c.id===e.target.value);variant=-1;playing=false;progress=0;shape='';motions=[];
 updateURL();renderLesson();
};
$('end').onclick=()=>{playing=false;setProgress(1);};
$('expand').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener('fullscreenchange',()=>{$('expand').textContent=document.fullscreenElement?'退出全屏':'全屏';});
window.addEventListener('hashchange',route);
$('nextPart').onclick=()=>{inspection?.advance();syncStudy();setProgress(progress);aimAtFace();};
$('mobilePanel').onclick=()=>setPanel(!document.body.classList.contains('panel-open'));
$('foldPanel').onclick=()=>setPanel(false);
for(const b of document.querySelectorAll('[data-study]'))b.onclick=()=>setStudy(b.dataset.study);
$('copyLink').onclick=async()=>{
 updateURL(true);
 const target=location.protocol==='file:'?'https://fsy2004.github.io/fracture-atlas/'+location.hash:location.href;
 try{await navigator.clipboard.writeText(target);$('copyLink').textContent='已复制';setTimeout(()=>$('copyLink').textContent='复制链接',1400);}
 catch{window.prompt('复制此链接',target);}
};
createFrameTray({
 pause:()=>{playing=false;flight=null;holdUntil=0;setProgress(progress);},
 render:()=>{camera.updateMatrixWorld();renderer.render(world,camera);return renderer.domElement;},
 describe:()=>[boneName(selected),course.variants[variant].name,$('frameTime').textContent,$('viewSummary').textContent,$('liveValues').textContent]
});
$('quickPlay').onclick=()=>$('play').click();
buttons($('jointLinks'),joints.map(c=>c.name),-1,i=>{
 const c=joints[i];selected=c.variants[0].cuts[0].bone;course=c;level=1;pickVariant(0);document.querySelector('.rail-scroll').scrollTop=0;
});
$('plane').oninput=()=>{$('planeValue').textContent=$('plane').value+'°';};
$('plane').onchange=()=>{quantities.plane=Number($('plane').value);progress=1;playing=false;updateURL();renderLesson(false,true);};
$('opacity').oninput=()=>{
 const opacity=Number($('opacity').value)/100;adjacent.opacity=opacity;adjacent.transparent=opacity<1;adjacent.depthWrite=opacity===1;
 adjacent.needsUpdate=true;$('opacityValue').textContent=Math.round(opacity*100)+'%';dirty=true;
};
$('mechanicsBox').ontoggle=()=>{if(lessonOpen())setProgress(progress);};
$('fragmentBox').querySelector('summary').onclick=()=>{if(!$('fragmentBox').open)fragmentRig?.prepareEditor();};
$('fragmentBox').ontoggle=()=>{if($('fragmentBox').open)fragmentRig?.prepareEditor();if(lessonOpen())setProgress(progress);};
$('repeat').onclick=()=>{repeating=!repeating;holdUntil=0;$('repeat').setAttribute('aria-pressed',String(repeating));updateURL(true);};
$('viewSeam').onclick=()=>{playing=false;setProgress(progress);aim('rearDetail',true);setPanel(false);};
$('zoomMotion').onclick=()=>{motionCloseUp(true);setPanel(false);};
$('quickEdit').onclick=()=>{
 setPanel(true);$('advanced').open=true;$('advanced').scrollIntoView({block:'start'});$('advanced').querySelector('summary').focus({preventScroll:true});
};
for(const id of ['bandRule','slack','drawConstraints'])$(id).onchange=()=>{
 $('slackValue').textContent=$('slack').value+'%';playing=false;holdUntil=0;setProgress(progress);updateURL(true);
};
$('normal').onclick=()=>{playing=false;setProgress(0);};
document.addEventListener('visibilitychange',()=>{
 if(ready&&!document.hidden&&!selected)scheduleFullDetail(viewSerial);
 previous=performance.now();if(document.hidden&&playing){playing=false;setProgress(progress);}
});
start().catch(err=>{$('status').hidden=false;$('status').textContent='三维视图加载失败，请使用支持 WebGL 的浏览器刷新。'+err.message;console.error(err);});
