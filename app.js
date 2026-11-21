import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { courses as fractures,levels } from './courses.js';
import { section,atLevel,sliceMetrics,branchSection,shortShaftCut } from './geometry.js';

import {boneName,teachingBone,regionFor,buildIndex} from './bone-index.js';
import {featuresFor,initialShape,shapeNames,motionNames,withShape,customPose} from './features.js';

import {makeObservation,wristLandmarks} from './observation.js';
import {decodeSurfaces,alignPreview,landmarkMap,landmark,planeNormal,inReflectedFrame} from './detail.js';
import {desks,deskFromURL,drawDesk} from './study-layouts.js';
import {supplementalCourses} from './supplemental.js';
import {regionalCourses} from './regional-courses.js';
import {joints} from './joints.js';
import {prepareImpaction,prepareRamusCompression} from './impaction.js';
import {buildMechanics} from './mechanics.js';
import {fittedShifts} from './fitted-shifts.js';
import {nativeAnchor,addSurfaceLesson,surfaceTree} from './surface-lessons.js';
import {fragmentEditor,isFragmentKey,hasEdits,clearEdits} from './fragment-motion.js';
import {buildKinematics,shaftFrame} from './kinematics.js';
const courses=[...fractures,...regionalCourses,...supplementalCourses,...joints];
const ghostMaterial=new T.MeshBasicMaterial({color:0x569a96,transparent:true,opacity:.22,depthWrite:false});
const editedMaterial=new T.MeshStandardMaterial({color:0xb75f36,roughness:.75,side:T.DoubleSide});
const displacedMaterial=new T.MeshStandardMaterial({color:0xc9845f,roughness:.75,side:T.DoubleSide});
let mechanics=null,poseLimit=null,impaction=null;
let fragmentRig=null,chosenFragment=null,repeating=false,holdUntil=0;
let quantities={},applyMotion=null,inspection=null,studyMode='overview',markName='',dirty=true;
const markLayer=document.getElementById('markLayer');
const markLabels=[];
function paintLabels(){
 if(!inspection){markLayer.hidden=true;return;}
 markLayer.hidden=false;
 const tags=inspection.tags, used=[];
 while(markLabels.length<tags.length){
  const el=document.createElement('span');el.className='pin';markLayer.append(el);markLabels.push(el);
 }
 markLabels.forEach((el,i)=>{
  if(!tags[i]){el.hidden=true;return;}
  const pt=tags[i].point.clone();pt.x*=group.scale.x;pt.project(camera);
  const x=(pt.x+1)*host.clientWidth/2,y=(1-pt.y)*host.clientHeight/2;
  el.hidden=pt.z<0||pt.z>1||x<5||x>host.clientWidth-6||y<20||y>host.clientHeight-30;
  if(el.hidden)return;
  const left=x>host.clientWidth*.66;
  const dy=used.some(t=>Math.abs(t-y)<28)?28:0;el.style.setProperty('--slope',(dy?(left?36:-36):0)+'deg');used.push(y+dy);
  el.style.setProperty('--tag-y',dy+'px');el.classList.toggle('left',left);
  el.style.left=x+'px';el.style.top=y+'px';el.textContent=tags[i].text;
 });
}
function setStudy(mode){
 studyMode=mode;if(mode==='facet')pair='end';syncStudy();syncDesk();playing=false;
 if(mode==='facet')aim(course?.id==='radius'||course?.id==='intercondylar'||course?.id==='distalfemur'?'inferior':'top',true);
 if(mode==='motion'&&course?.id==='radius')aim('side',true);
 setProgress(progress<.32&&mode!=='overview'?1:progress);
}
function syncStudy(){
 const active=Boolean(inspection);
 $('studyTools').hidden=!active;
 for(const b of document.querySelectorAll('[data-study]')){
  const m=b.dataset.study;b.disabled=!active||(m==='cut'&&!inspection?.cut)||(m==='facet'&&!inspection?.patch);
  b.setAttribute('aria-pressed',String(active&&m===studyMode));
 }
 $('nextPart').hidden=studyMode!=='cut'||!inspection?.cut;
 if(!$('nextPart').hidden)$('nextPart').textContent='切换骨块　'+inspection.fragment();
 $('inspectHelp').textContent=({cut:'单独旋转这块骨，沿赭色断面边缘追踪骨折线。',motion:'青线为参照，赭线随骨块运动；纵线看成角，横线看旋转，两点连线看平移。',facet:'青绿色标出关节面近似区域。转到关节端，观察断线是否穿入着色区。',overview:'旋转对照骨折处，拖动时间轴查看同一骨块的伤前与伤后位置。'})[studyMode];
 if(studyMode==='facet'&&inspection?.patch)$('inspectHelp').textContent=inspection.crosses?(inspection.measurements()?'断线进入着色区。对照同源点的法向高差与面内错位。':'断线进入着色区，旋转模型可沿着色面追踪断缘。'):'在本模型的青绿色标示区未检出断线交点。转动比较断面与关节面的距离。';
 if(studyMode==='motion'&&course?.id==='radius')$('inspectHelp').textContent='比较伤前、伤后的掌背缘连线。侧面看背移与倾斜，正面看桡移。';
 if(desk==='pair'&&pair==='end'&&studyMode==='motion'&&inspection?.guide)$('inspectHelp').textContent='在局部端面对照虚线（伤前）与实线（当前）的夹角。骨段绕长轴旋转时，轴上的参考点可以保持原位。';
 if(course?.kind==='joint'&&studyMode==='overview')$('inspectHelp').textContent='先固定观察关节窝，再比较活动骨端在伤前、移出过程和终点的位置。';
 if(course?.kind==='joint'&&studyMode==='motion')$('inspectHelp').textContent='固定关节窝，沿两点连线比较骨端如何离开原位。';
}

const assetURL=u=>u.startsWith('models/detail')?u+'?native-f32-v1':u;
const $=id=>document.getElementById(id), host=$('viewport');
const boneData=new Map(), animated=[], annotations=[], nearBones=[], pieces=[],wedges=[];
const world=new T.Scene(), group=new T.Group();world.add(group);
const bone=new T.MeshStandardMaterial({color:0xe9e2c9,roughness:.84,side:T.DoubleSide});
const accent=new T.MeshStandardMaterial({color:0x7bbdaa,roughness:.83,side:T.DoubleSide});
const adjacent=new T.MeshStandardMaterial({color:0x658783,roughness:1,side:T.DoubleSide,transparent:true,opacity:.55,depthWrite:false});
const cap=new T.MeshStandardMaterial({color:0xcd8557,roughness:1,side:T.DoubleSide});
const line=new T.LineBasicMaterial({color:0x8d3f26});
const vec=a=>new T.Vector3(...a), zero=new T.Vector3();
let renderer,camera,controls,course=null,variant=-1,level=1,progress=0,playing=false,speed=1;
let fractureFocus=new T.Vector3();
let focus=new T.Vector3(),span=.45,distance=.7,previous=0,ready=false;
const keyByMesh=new Map(),meshByKey=new Map();
let selected=null,shape='',motions=[],flight=null,hovered=null,lastLabelView='';
let anklePose=null;
let desk='plate',pair='side',tab='study';
const panels=[...document.querySelectorAll('.pane')];
function lessonOpen(){return Boolean(course&&variant>=0&&selected);}
function storyView(){
 return ['radius','hip-dislocation','shoulder-dislocation','elbow-dislocation'].includes(course?.id)?'side':'home';
}
function sectionGuide(){
 const guide=inspection?.axisGuide(),pts=inspection?.referencePoints();
 if(!guide||!pts||course?.kind==='joint'||studyMode==='facet')return null;
 const centre=pts[0].clone().lerp(pts[1],.5),axis=guide.axis.clone();
 centre.x*=group.scale.x;axis.x*=group.scale.x;
 return {axis,centre,half:Math.max(.008,Math.min(.075,span*.085)+Math.abs(pts[0].clone().sub(pts[1]).dot(guide.axis))*.55)};
}
function setDesk(id){
 if(!Object.hasOwn(desks,id))return;
 desk=id;playing=false;tab='study';
 setLessonTitle();syncDesk();setProgress(progress);updateURL(true);
 if(desk==='pair')aim('home',false);else if(desk==='story')aim(storyView(),false);
 orientation();
}
function syncDesk(){
 const open=lessonOpen(),mode=open?desk:'plate';
 document.body.dataset.desk=mode;
 $('launchpad').hidden=Boolean(selected);
 $('deskTools').hidden=!open;
 const tabsOpen=mode!=='plate';
 $('workspaceTabs').hidden=!tabsOpen;document.body.dataset.tab=tabsOpen?tab:'all';
 for(const button of $('workspaceTabs').children)button.setAttribute('aria-pressed',String(button.dataset.tab===tab));
 const tools=$('deskTools'),before=tabsOpen?$('bonePanel'):$('lessonPanel');
 if(tools.nextElementSibling!==before)before.before(tools);
 $('paneBoxes').hidden=mode==='plate';$('quickPlay').hidden=!open;$('quickEdit').hidden=!open||(!fragmentRig&&$('quantBox').hidden);
 if(controls){controls.enableRotate=mode!=='pair';controls.enablePan=mode!=='pair';}
 $('gesture').textContent=mode==='pair'?'正交投影 · 滚轮或双指同步缩放':'拖动旋转 · 滚轮或双指缩放';
 for(const btn of document.querySelectorAll('[data-desk]'))btn.setAttribute('aria-pressed',String(btn.dataset.desk===desk));
 for(const btn of document.querySelectorAll('[data-pair]'))btn.setAttribute('aria-pressed',String(btn.dataset.pair===pair));
 $('projectionCard').hidden=mode!=='pair'||(studyMode!=='motion'&&studyMode!=='overview');
 $('measureOtherName').textContent=pair==='end'?'端面投影':'侧面投影';
 $('pairPick').hidden=mode!=='pair';
 for(const btn of document.querySelectorAll('[data-view]'))btn.disabled=mode==='pair'&&!['home','detail'].includes(btn.dataset.view);
 if(!open)return;
 const endBelow=['radius','intercondylar','distalfemur'].includes(course.id);
 const left=/\bleft\b/i.test(selected);
 const captions=mode==='pair'?[['正面','← 患者右　患者左 →'],pair==='side'?[left?'左侧面':'右侧面',left?'← 前　后 →':'← 后　前 →']:[sectionGuide()?'骨干局部端面':endBelow?'自下方':'自上方',sectionGuide()?'局部截取 · 2.5×':'完整端面']]:
  [['当前时刻','可旋转观察'],['伤前','正常对位'],['终点',course.kind==='joint'?(quantities.travel===0?'保持对位':'脱位后'):'骨折后']];
 panels.forEach((el,i)=>{
  el.hidden=i>=captions.length;
  if(!el.hidden){el.querySelector('b').textContent=captions[i][0];el.querySelector('small').textContent=captions[i][1];}
 });
 if(mode==='story'){
  $('crumb').textContent=boneName(selected)+' · '+course.name;
 }else if(mode==='pair'){$('orientation').textContent='正交双视图';}


}
function labelPane(el,view,w,h){
 const label=el.querySelector('span'),summary=el.querySelector('.components'),trace=el.querySelector('svg');
 label.textContent='';summary.textContent='';trace.style.display='none';
 const rose=el.querySelector('.rotation-guide');rose.style.display='none';
 if(inspection&&desk==='pair'&&['motion','overview'].includes(studyMode)&&$('guides').checked){
  const [a,b]=inspection.referencePoints();a.x*=group.scale.x;b.x*=group.scale.x;
  const diff=b.clone().sub(a).multiplyScalar(1000),front=el===panels[0];
  const component=(n,pos,neg)=>Math.abs(n)<.05?'0 mm':(n>0?pos:neg)+' '+Math.abs(n).toFixed(1)+' mm';
  const cameraNormal=view.getWorldDirection(new T.Vector3());
  const projected=diff.clone().addScaledVector(cameraNormal,-diff.dot(cameraNormal)).length();
  (front?$('measureFront'):$('measureOther')).textContent=projected.toFixed(1)+' mm';
  const x=component(diff.x,'向左','向右'),y=component(diff.y,'向上','向下'),z=component(diff.z,'向前','向后');
  summary.textContent='参考点　'+(front?x+' ／ '+y:pair==='end'?'投影 '+projected.toFixed(1)+' mm':z+' ／ '+y);
  const guide=el===panels[1]&&pair==='end'?inspection.axisGuide():null;
  if(guide){
   const mid=guide.origin.clone();mid.x*=group.scale.x;
   const unit=(direction)=>{
    const v=direction.clone();v.x*=group.scale.x;
    const start=mid.clone().project(view),end=mid.clone().addScaledVector(v,.01).project(view);
    return new T.Vector2((end.x-start.x)*w,-(end.y-start.y)*h).normalize();
   };
   const orig=unit(guide.rest),moved=unit(guide.moved);
   const origin=mid.clone().project(view),cx=(origin.x+1)*w/2,cy=(1-origin.y)*h/2,rr=Math.min(56,w*.20,h*.18);
   const pt=(v,r)=>[(cx+v.x*r).toFixed(2),(cy+v.y*r).toFixed(2)].join(' ');
   const angle=Math.atan2(orig.cross(moved),orig.dot(moved));
   rose.children[0].setAttribute('d','M '+cx+' '+cy+' L '+pt(orig,rr));
   rose.children[1].setAttribute('d','M '+cx+' '+cy+' L '+pt(moved,rr));
   rose.children[2].setAttribute('d','M '+pt(orig,rr*.72)+' A '+rr*.72+' '+rr*.72+' 0 0 '+(angle>=0?1:0)+' '+pt(moved,rr*.72));
   rose.style.display='block';summary.textContent+='　端面方向差 '+Math.abs(T.MathUtils.radToDeg(angle)).toFixed(1)+'°';
  }
  a.project(view);b.project(view);
  const coords=[(a.x+1)*w/2,(1-a.y)*h/2,(b.x+1)*w/2,(1-b.y)*h/2];
  if(Math.hypot(coords[2]-coords[0],coords[3]-coords[1])>1){
   trace.style.display='block';
   ['x1','y1','x2','y2'].forEach((k,i)=>trace.firstElementChild.setAttribute(k,coords[i]));
   [...trace.querySelectorAll('circle')].forEach((c,i)=>{c.setAttribute('cx',coords[2*i]);c.setAttribute('cy',coords[2*i+1]);});
  }
 }
 if(!inspection)return;
 // One numbered measurement/landmark per small viewport avoids crossing leader lines.
 const tag=studyMode==='motion'?(inspection.tags.find(t=>t.text.includes('°'))||inspection.tags[0]):inspection.tags[0];
 if(!tag)return;
 const pt=tag.point.clone();pt.x*=group.scale.x;pt.project(view);
 const x=(pt.x+1)*.5*w,y=(1-pt.y)*.5*h;
 if(x<0||x>w||y<0||y>h||Math.abs(pt.z)>1)return;
 label.textContent=tag.text;label.style.left=Math.max(3,Math.min(w-label.offsetWidth-4,x+8))+'px';
 label.style.top=Math.max(24,Math.min(h-24,y-12))+'px';
}
const courseBones=c=>new Set(c.variants.flatMap(v=>[...v.cuts.map(k=>k.bone),...(v.fixed||[])]));
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
 mechanics?.dispose();mechanics=null;impaction=null;poseLimit=null;$('contactState').textContent='';
 fragmentRig?.dispose();fragmentRig=null;anklePose=null;inspection=null;dirty=true;syncStudy();applyMotion=null;$('liveValues').textContent='';hovered=null;$('tip').hidden=true;group.scale.x=1;
 group.traverse(o=>{if(o.userData.dispose)o.geometry?.dispose();if(o.isArrowHelper||o.type==='ArrowHelper')o.dispose?.();});
 group.clear();animated.length=annotations.length=nearBones.length=pieces.length=wedges.length=0;
}
const reflectedMeshes=new Map();
function lessonMesh(name){
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
 const m=new T.Mesh(g,material);m.userData.bone=name;parent.add(m);return m;
}
function addPart(part,anchor,motion,material){
 const moving=motion.shift.some(Boolean)||motion.turn.some(Boolean);
 const pivot=new T.Group(),shell=new T.Mesh(part.geo,material),face=new T.Mesh(part.face,cap);
 const edge=new T.LineSegments(part.outline,line);
 for(const o of [shell,face,edge]){o.position.copy(anchor).negate();o.userData.dispose=true;pivot.add(o);}
 annotations.push(edge);pieces.push(shell);
 pivot.position.copy(anchor);group.add(pivot);
 const ghost=moving?new T.Mesh(part.geo,ghostMaterial):null;
 if(ghost){ghost.visible=false;group.add(ghost);}
 animated.push({pivot,anchor,ghost,shell,face,edge,name:markName,moving,tuned:motion.tuned,shift:vec(motion.shift).multiplyScalar(.001),turn:vec(motion.turn).multiplyScalar(Math.PI/180)});
 return pivot;
}
function addWedge(g,kind){
 const geo=g.clone(),position=geo.attributes.position,delta=new Float32Array(position.count*3),broad=new Float32Array(position.count*3);
 const box=g.boundingBox,size=box.getSize(new T.Vector3());
 const point=new T.Vector3(),normal=geo.attributes.normal;
 // Compress above the inferior endplate. The inferior cortex remains at its native level.
 const tree=surfaceTree(g),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,1,0));
 const baseLevels=new Map();
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i);
  const forward=(point.z-box.min.z)/size.z;
  const column=Math.round((point.x-box.min.x)/size.x*24)+','+Math.round((point.z-box.min.z)/size.z*24);
  if(!baseLevels.has(column)){
   ray.origin.set(point.x,box.min.y-.004,point.z);
   const hit=tree.raycastFirst(ray,T.DoubleSide);
   baseLevels.set(column,hit?.point.y??box.min.y);
  }
  const bottom=baseLevels.get(column),localHeight=Math.max(.004,box.max.y-bottom);
  const height=T.MathUtils.smoothstep((point.y-bottom)/localHeight,.10,.95)*T.MathUtils.smoothstep(normal.getY(i),-.64,-.12);
  const side=1-(point.x-box.min.x)/size.x;
  const body=T.MathUtils.smoothstep(forward,.48,.77);
  const weight=kind==='anterior'?T.MathUtils.smoothstep(forward,.60,1):side;
  delta[3*i+1]=-size.y*.40*body*weight*height;
  const spread=kind==='anterior'?T.MathUtils.smoothstep(forward,.49,.9):Math.sqrt(Math.max(0,side));
  broad[3*i+1]=-size.y*.40*body*spread*height;
 }
 geo.morphAttributes.position=[new T.BufferAttribute(delta,3),new T.BufferAttribute(broad,3)];geo.morphTargetsRelative=true;
 const mesh=new T.Mesh(geo,bone);mesh.userData.bone=markName;mesh.userData.dispose=true;group.add(mesh);wedges.push(mesh);
}
function addFracture(spec,anchor){
 const g=lessonMesh(spec.bone), pair=section(g,spec.normal,anchor.toArray(),spec.fold,spec.spiralHeight,spec.spiralAxis);
 const pivot=spec.pivot?vec(spec.pivot):anchor;
 addPart(pair[0],pivot,spec.minus,bone);
 if(!spec.second){addPart(pair[1],pivot,spec.plus,bone);return;}
 // Recursively split one fragment, including its first cut face.
 const first=pair[1],halves=branchSection(first,spec.second,anchor.toArray());
 halves.forEach((half,i)=>{
  const branch=spec.branches?.[i]||{shift:[i?1:-1,0,0],turn:[0,0,0]};
  addPart(half,anchor,{shift:spec.plus.shift.map((v,k)=>v+branch.shift[k]),turn:spec.plus.turn.map((v,k)=>v+branch.turn[k]),tuned:spec.plus.tuned},bone);
 });
 for(const g of [first.geo,first.face,first.outline])g.dispose();
}
function bonesFor(v){return [...v.cuts.map(c=>c.bone),...(v.fixed||[])];}
function matches(key){
 if(!key)return [];
 const target=teachingBone(key),direct=c=>c.variants.some(v=>v.cuts.some(s=>s.bone===target));
 return courses.filter(c=>courseBones(c).has(target)).sort((a,b)=>Number(direct(b))-Number(direct(a)));
}
function pickBone(key){
 $('fragmentBox').open=false;
 if(key&&matchMedia('(max-width:630px)').matches)document.body.classList.add('panel-open');
 studyMode='overview';tab='study';
 quantities={};chosenFragment=null;holdUntil=0;
 selected=key;course=matches(key)[0]||null;variant=-1;level=1;shape='';motions=[];playing=false;progress=0;
 updateURL();renderLesson(true);document.querySelector('.rail-scroll').scrollTop=0;
}
function pickVariant(i){
 $('fragmentBox').open=false;
 document.body.classList.remove('panel-open');
 studyMode='overview';tab='study';
 quantities={};chosenFragment=null;holdUntil=0;
 variant=i;shape='';motions=[];progress=0;playing=true;
 updateURL();renderLesson(true);
}
function updateURL(includeFrame=false){
 let hash=selected?'bone/'+meshByKey.get(selected):'skeleton';
 if(course&&variant>=0){
  const params=new URLSearchParams();
  if(desk!=='plate')params.set('desk',desk);
  if(desk==='pair'&&pair==='end')params.set('pair',pair);
  if(selected)params.set('bone',meshByKey.get(selected));
  if(studyMode!=='overview')params.set('view',studyMode);
  if(includeFrame){
   params.set('at',Math.round(progress*1000));
   if(camera&&controls)params.set('space','native');
   if(camera&&controls)params.set('cam',[...camera.position.toArray(),...controls.target.toArray()].map(x=>Number(x.toFixed(5))).join(','));
  }
  if(chosenFragment!==null)params.set('frag',chosenFragment);
  if(repeating)params.set('loop','1');
  if($('boneRule').value==='limit')params.set('contact','limit');
  if($('bandRule').value==='held')params.set('band','held');
  if(+$('slack').value!==10)params.set('slack',$('slack').value);
  if(shape)params.set('shape',shape);
  if(motions.length)params.set('move',motions.join(','));
  for(const [k,n] of Object.entries(quantities))params.set('q_'+k,n);
  hash=[course.id,variant,level].join('/')+(params.size?'?'+params:'');
 }
 history.replaceState(null,'','#'+hash);
}
function route(){
 $('fragmentBox').open=false;
 document.body.classList.remove('panel-open');tab='study';
 const [path,query]=location.hash.slice(1).split('?'),[id,v,l]=path.split('/');
 const params=new URLSearchParams(query);quantities={};desk=Object.hasOwn(desks,params.get('desk'))?params.get('desk'):deskFromURL();pair=params.get('pair')==='end'?'end':'side';
 $('boneRule').value=params.get('contact')==='limit'?'limit':'warn';$('bandRule').value=params.get('band')==='held'?'held':'released';
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
   variant=Math.max(0,Math.min(course.variants.length-1,parseInt(v)||0));
   level=Math.max(0,Math.min(2,l===undefined?1:parseInt(l)||0));
   selected=keyByMesh.get(params.get('bone'));
   if(!selected||!bonesFor(course.variants[variant]).includes(teachingBone(selected)))selected=course.variants[variant].cuts[0].bone;
   const f=featuresFor(course,variant);
   if(f.shapes.includes(params.get('shape')))shape=params.get('shape');
   motions=f.motions.filter(k=>(params.get('move')||'').split(',').includes(k));
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
 renderLesson(false);
 if(studyMode==='facet')aim(['radius','intercondylar','distalfemur'].includes(course?.id)?'inferior':'top');
 if(studyMode==='motion'&&course?.id==='radius')aim('side');
 const raw=params.get('cam')?.split(',');
 if(lessonOpen()&&raw?.length===6&&raw.every(n=>n.trim()&&Number.isFinite(+n)&&Math.abs(+n)<=24)){
  const convert=values=>{
   const pt=vec(values.map(Number));
   if(params.get('space')==='native')return pt;
   const mirror=/\bleft\b/i.test(selected)?-1:1;
   pt.x*=mirror;const converted=landmark(lessonMesh(course.variants[variant].cuts[0].bone),pt.toArray());converted.x*=mirror;
   return converted;
  };
  const a=convert(raw.slice(0,3)),b=convert(raw.slice(3)),dist=a.distanceTo(b);
  if(dist>=.0005&&dist<=20.001){flight=null;camera.position.copy(a);controls.target.copy(b);controls.update();dirty=true;}
 }
 orientation();
}
function showControls(){
 const local=Boolean(selected),lesson=Boolean(course&&variant>=0);
 document.body.classList.toggle('in-lesson',lesson);document.body.classList.toggle('in-index',!local);

 $('whole').hidden=!local;$('indexPanel').hidden=local;$('bonePanel').hidden=!local;$('lessonPanel').hidden=!lesson;

 document.querySelector('[data-view=detail]').textContent=course?.kind==='joint'?'关节特写':'放大断面';
 $('layers').hidden=!lesson;document.querySelector('[data-view=detail]').hidden=!lesson;
 $('labels').hidden=local;$('breadcrumb').textContent=local?regionFor(selected):'全身骨骼　/　索引';
 $('jointShortcuts').hidden=local;syncDesk();
 if(!local)return;
 $('boneTitle').textContent=boneName(selected);
 const list=matches(selected),has=list.length>0;
 $('boneNote').textContent=!has?'可旋转查看此骨的正常解剖，当前尚无对应损伤课程。':variant<0?'选择分型后自动播放。':'';
 $('boneNote').hidden=!$('boneNote').textContent;
 for(const id of ['sites','siteLabel','variants','system'])$(id).hidden=!has;
 $('levelbox').hidden=!course?.levels;
 if(!has)return;
 $('sites').replaceChildren(...list.map(c=>new Option(c.name,c.id,false,c===course)));
 $('sites').disabled=list.length===1;
 $('system').textContent=course.system;
 $('zoomMotion').textContent=course.kind==='joint'?'关节特写':'断端特写';
 $('end').textContent=course.kind==='joint'?'脱位后状态':'骨折后状态';
 const allowed=course.variants.map((v,i)=>bonesFor(v).includes(teachingBone(selected))?i:-1).filter(i=>i>=0);
 buttons($('variants'),allowed.map(i=>course.variants[i].name),allowed.indexOf(variant),i=>pickVariant(allowed[i]));
 buttons($('levels'),levels.map(x=>x[0]),level,i=>{level=i;progress=0;playing=lesson;updateURL();renderLesson(true);});
 if(!lesson)return;
 const isJoint=course.kind==='joint';
 const v=course.variants[variant];
 const aligned=!isJoint&&!v.moving&&!v.cuts.some(s=>s.wedge||s.surface==='dent'||s.second||s.minus?.shift.some(Boolean)||s.plus?.shift.some(Boolean)||s.minus?.turn.some(Boolean)||s.plus?.turn.some(Boolean));
 const deform=v.cuts.some(s=>s.wedge||s.surface==='dent');
 const stepTimes=aligned||deform?[0,.5,1]:isJoint?[0,.49,1]:[.16,.35,.61,.94];
 buttons($('steps'),aligned?['伤前','断线出现','保持对位']:deform?['伤前','形变过程','终末形态']:isJoint?['对位','移出','终点']:['受力','断面 / 形变','平移','终末姿态'],-1,i=>{playing=false;setProgress(stepTimes[i]);});
 const f=featuresFor(course,variant);
 $('featureBox').hidden=!f.shapes.length&&!f.motions.length;
 $('moveRow').querySelector('small').textContent=f.motions.length>1?'可组合':'可选';
 $('shapeRow').hidden=!f.shapes.length;$('moveRow').hidden=!f.motions.length;
 const shapeKeys=f.shapes,base=initialShape(course,variant),chosen=shape||base;
 const adjustable=f.shapes.length&&chosen==='oblique';
 $('planeRow').hidden=!adjustable;
 if(adjustable){
  $('plane').min=1;$('plane').max=89;
 }
 const readings={
  humerus:'一组 65 例肱骨干骨折中，支具前的影像成角为 0°～60°，均值 25°。在“成角”下拖动，比较骨轴交角。这是该队列的观察范围。',
  radius:'正常解剖参考：侧位观察掌倾角 10°～15°，正位观察尺倾角 20°～25°。伸直型注意远段背移、背倾和桡移；屈曲型注意远段掌移和桡移。',
  neck:'股骨正位观察骨折线与股骨干轴垂线的夹角（Linton 角）。教材描述外展型常小于 30°、内收型常在 45° 左右。结合嵌插、内翻及骨折位置判断。',
  calcaneus:'正常解剖参考：在跟骨侧位观察结节关节角，本教材取 30°～45°。骨折后可减小、消失或呈负角，同时观察跟骨高度及后关节面。',
  elbow:'解剖参考：前臂完全旋后、肘伸直时，携带角为外翻 10°～15°。这是肱骨与前臂长轴间的角度。另在侧位观察髁上骨折远段向前或向后移。',
  'elbow-dislocation':'在侧位观察尺桡骨近端相对肱骨远端的位置。后方骨性标志包括鹰嘴及内、外上髁；伸肘时三点成线，屈肘 90° 时构成肘后三角。'
 };
 $('readingRef').hidden=!readings[course.id];
 $('readingText').textContent=readings[course.id]||'';
 if(!adjustable&&quantities.plane!==undefined){
  delete quantities.plane;
 }

 buttons($('shapes'),shapeKeys.map(k=>shapeNames[k]),shapeKeys.indexOf(shape||base),i=>{
  clearEdits(quantities);chosenFragment=null;delete quantities.plane;shape=shapeKeys[i]===base?'':shapeKeys[i];progress=0;playing=true;updateURL();renderLesson(false,true);
 });
 const keys=['',...f.motions];
 buttons($('motions'),keys.map(k=>motionNames[k]||'典型移位'),-1,i=>{
  clearEdits(quantities);chosenFragment=null;const key=keys[i];
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
 const labels=$('labels'); if(selected||!camera)return;
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
function aim(view='home',smooth=false){
 if(!camera)return;
 if(view==='detail'&&!course)return;
 const closeStory=desk==='story'&&lessonOpen()&&['radius','ankle','elbow','olecranon'].includes(course.id)&&['front','side'].includes(view);
 const target=view==='detail'||closeStory?fractureFocus:focus;
 const dir={inferior:[0,-1,.001],detail:[-.6,.17,1],front:[0,0,1],side:[-1,0,0],top:[0,1,.001],home:selected?[-.36,.12,1]:[0,0,1]}[view];
 const box=host.getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);
 let horizontal=span;
 if(!selected)horizontal=.65;
 else if(view!=='top'&&view!=='side'&&view!=='detail'){
  const size=boneData.get(selected).boundingBox.getSize(new T.Vector3());
  horizontal=Math.min(span,Math.max(span*.42,Math.hypot(size.x,size.z)));
 }
 const viewSize=Math.max(span,horizontal/aspect);
 distance=viewSize*(view==='detail'?.57:closeStory?.72:1.16)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
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
 $('description').textContent=[shapeNames[shape],...motions.map(k=>motionNames[k])].filter(Boolean).join(' · ');
}
function motionCloseUp(smooth){
 if(!fragmentRig){aim('detail',smooth);return;}
 const f=fragmentRig.focus,sign=group.scale.x,target=f.centre.clone(),d=f.delta.clone();
 target.x*=sign;d.x*=sign;d.normalize();
 const dir=camera.position.clone().sub(controls.target).normalize();
 if(desk!=='pair'&&d.lengthSq()){
  dir.addScaledVector(d,-dir.dot(d));
  if(dir.lengthSq()<.08)dir.crossVectors(d,Math.abs(d.y)<.85?vec([0,1,0]):vec([1,0,0]));
 }
 const aspect=host.clientWidth/Math.max(1,host.clientHeight);
 const end=target.clone().addScaledVector(dir.normalize(),f.size/(2*Math.tan(T.MathUtils.degToRad(camera.fov*.5))*Math.min(1,aspect)));
 if(smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches)flight={from:camera.position.clone(),target:controls.target.clone(),end,focus:target,start:performance.now()};
 else{flight=null;camera.position.copy(end);controls.target.copy(target);controls.update();}
 dirty=true;
}
function renderLesson(smooth=false,keepView=false){
 if(!ready)return;
 clearScene();showControls();
 if(!selected||!course||variant<0){
  if(!selected){
   for(const name of boneData.keys())addBone(name,bone);
   focus.set(0,.82,0);span=1.64;
   $('heading').textContent='全身骨骼';$('crumb').textContent='成年男性 · 解剖总览';$('description').textContent='点击骨骼，进入局部观察';
  }else{
   const mesh=addBone(selected,bone),box=mesh.geometry.boundingBox;
   box.getCenter(focus);span=1.17*Math.max(...box.getSize(new T.Vector3()).toArray());
   $('heading').textContent=boneName(selected);$('crumb').textContent=regionFor(selected)+' · 正常解剖';$('description').textContent='';
  }
  if(!keepView)aim('home',smooth);return;
 }
 const v=course.variants[variant],bounds=new T.Box3(),anchors=[];
 const mirror=/\bleft\b/i.test(selected);
 group.scale.x=mirror?-1:1;
 setLessonTitle();
 if(course.reference)$('crumb').textContent+=' · '+(course.reference.startsWith('教材')?'教材同部位示例':'专业资料补充示例');
 $('cause').textContent=shape?(course.name+' · '+v.name+'，本例采用'+shapeNames[shape]+'骨折线。'):v.cause;
 $('observe').textContent=motions.length?'组合观察：'+motions.map(k=>motionNames[k]).join('、')+'。可用时间轴对照正常位置与骨折后状态。':shape?'旋转模型，观察所选断面与骨干长轴的关系。':v.observe;
 const ctx=v.context||course.context||[], shared=course.levels?atLevel(lessonMesh('Right tibia'),1,levels[level][1])[1]:null;
 let referenceWidth=0,sharedPivot=null,frame=null,followMotion=v.cuts[0].minus;
 if(course.kind==='joint'){
  const main=lessonMesh(v.cuts[0].bone),a=v.nativePoint?nativeAnchor(main,v.nativePoint):main.userData.headCentre?.clone()||landmark(main,v.anchor);
  const pivot=new T.Group(),ghost=new T.Group();group.add(pivot,ghost);pivot.position.copy(a);ghost.visible=false;
  if(['shoulder-dislocation','hip-dislocation'].includes(course.id)){
   frame=shaftFrame(vec(atLevel(main,1,.26)),vec(atLevel(main,1,.71)),false);
  }
  for(const {bone:name} of v.cuts){
   addBone(name,displacedMaterial,pivot).position.copy(a).negate();
   addBone(name,ghostMaterial,ghost);
  }
  for(const name of v.jointFollowers||boneData.keys()){
   if(!/right/i.test(name)||v.fixed.includes(name)||v.cuts.some(c=>c.bone===name))continue;
   const limb=course.id==='hip-dislocation'?'下肢':'上肢';
   if(!v.jointFollowers&&(regionFor(name)!==limb||/scapula|clavicle|humerus|hip bone/i.test(name)))continue;
   const linked=addBone(name,adjacent,pivot);linked.position.copy(a).negate();nearBones.push(linked);
  }
  for(const name of v.fixed)addBone(name,bone);
  animated.push({pivot,anchor:a,shift:vec(v.shift).multiplyScalar(.001),turn:vec(v.turn||[0,0,0]).multiplyScalar(Math.PI/180),waypoints:v.waypoints,sharedClock:course.id==='lunate-dislocation',ghost,jointAxis:frame?.axis});
  anchors.push(a);
 }
 for(const original of course.kind==='joint'?[]:v.cuts){
  markName=original.bone;
  let s=withShape(original,shape);
  if(course.sourceBone&&!s.wedge){
   const length=name=>lessonMesh(name).boundingBox.getSize(vec([0,0,0])).getComponent(s.axis);
   const ratio=length(s.bone)/length(course.sourceBone);
   const adapt=m=>({...m,shift:m.shift.map(value=>value*ratio)});
   s={...s,minus:adapt(s.minus),plus:adapt(s.plus)};
  }
  const g=lessonMesh(s.bone);
  if(s.shaftAngle!==undefined)s=shortShaftCut(g,s,s.shaftAngle);
  else if(['toes','metatarsal','finger'].includes(course.family||course.id)){
   s=shortShaftCut(g,s,v.name.startsWith('纵裂')?90:v.name.startsWith('斜形')?38:0);
  }
  if(s.surface){
   const mark=addSurfaceLesson(g,s,group,{bone,line,cap},annotations,wedges);
   anchors.push(mark);bounds.union(g.boundingBox);continue;
  }
  if(s.wedge){
   const a=g.boundingBox.getCenter(new T.Vector3());a.z=g.boundingBox.max.z-.012;anchors.push(a);
   addWedge(g,s.wedge);bounds.union(g.boundingBox);continue;
  }
  if(s.anchor)s={...s,normal:planeNormal(g,s.normal),anchor:landmark(g,s.anchor).toArray(),second:s.second?planeNormal(g,s.second):undefined};
  if(s.pivot)s={...s,pivot:landmark(g,s.pivot).toArray()};
  let fraction=s.level;
  if(shared!==null){
   const y=shared+(variant===1&&s.bone==='Right fibula'?.033:0);
   fraction=(y-g.boundingBox.min.y)/(g.boundingBox.max.y-g.boundingBox.min.y);
  }
  const a=s.nativePoint?nativeAnchor(g,s.nativePoint):vec(s.anchor||atLevel(g,s.axis,fraction));anchors.push(a);
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
  if(shape==='spiral'){
   const extent=g.boundingBox.getSize(new T.Vector3()).getComponent(s.axis);
   const low=vec(atLevel(g,s.axis,fraction-.07)),high=vec(atLevel(g,s.axis,fraction+.07));
   s.spiralHeight=extent*.15;s.spiralAxis=high.sub(low).normalize().toArray();
  }
  if(motions.length){
   if(!referenceWidth){
    const low=vec(atLevel(g,s.axis,fraction-.08)),high=vec(atLevel(g,s.axis,fraction+.08));
    frame=shaftFrame(low,high,s.axis===2);
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
  if(course.id==='tibia'&&variant===1&&!motions.length){
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
   const start=animated.length;addFracture(s,a);
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
  const extra=v.moving?.find(item=>item.names.includes(name));
  if(v.bind&&Object.hasOwn(v.bind,name)){
   const driver=animated.filter(i=>i.shell)[v.bind[name]];driver.pivot.add(m);m.position.copy(driver.anchor).negate();
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
 $('neighbors').disabled=!nearBones.length;$('opacityRow').hidden=!nearBones.length;
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
 const fit=!shape&&!motions.length&&fittedShifts[[course.id,variant,course.levels?level:1,mirror?'L':'R'].join('/')];
 if(fit){
  const shells=animated.filter(item=>item.shell);
  fit.forEach((delta,k)=>{
   if(!delta||!shells[k])return;
   const driver=shells[k],offset=vec(delta).multiplyScalar(.001);
   driver.shift.add(offset);
   for(const linked of animated)if(linked.follows===driver)linked.shift.add(offset);
  });
 }
 // Direction markers follow the fragment and use anatomical model coordinates.
 for(const item of animated){
  if(item.shift.length()<.001||item.pivot.children.every(o=>nearBones.includes(o)))continue;
  const direction=item.shift.clone().normalize(),offset=new T.Vector3(span*.065,0,span*.035);
  const length=Math.max(span*.075,Math.min(span*.17,item.shift.length()*2.5));
  const arrow=new T.ArrowHelper(direction,item.anchor.clone().add(offset),length,0x146a60,length*.30,length*.17);
  arrow.userData.displacement=true;arrow.userData.item=item;arrow.userData.offset=offset;group.add(arrow);annotations.push(arrow);
 }
 if(mirror){focus.x*=-1;fractureFocus.x*=-1;}
 applyMotion=buildKinematics(animated,wedges,motions,frame,referenceWidth,course.kind==='joint',quantities,()=>{
  fragmentRig?.sample();playing=false;setProgress(1);syncDesk();updateURL();
 },{id:course.id,variant,palmar:course.id==='radius'&&variant===0?wristLandmarks(lessonMesh('Right radius')).palmar:null,ankleSign:anklePose?.sign,mirror});
 const primary=v.cuts.find(s=>s.bone===teachingBone(selected))||v.cuts[0];
 function observe(item){
  inspection?.dispose();
  const i=Math.max(0,v.cuts.findIndex(s=>s.bone===(item?.name||primary.bone))),source=v.cuts[i];
  inspection=makeObservation({course,variant,source,geometry:lessonMesh(source.bone),anchor:anchors[i]||anchors[0],parts:animated,group,context:nearBones,joint:course.kind==='joint',frame,tracked:item,lookupGeometry:lessonMesh});
 }
 fragmentRig=fragmentEditor({items:animated,values:quantities,primary:primary.bone,mirror,world:group,basePose:applyMotion,preferred:chosenFragment,
  onEdit:()=>{playing=false;holdUntil=0;setProgress(1);updateURL();},
  onSelect:g=>{chosenFragment=g.id;observe(g.members.find(i=>i.name===primary.bone)||g.members[0]);syncStudy();setProgress(progress);updateURL();}
 });
 const active=fragmentRig?.active;
 observe(active?.members.find(i=>i.name===primary.bone)||active?.members[0]);
 $('fragmentBox').hidden=!fragmentRig;
 $('editMotion').disabled=!fragmentRig&&$('quantBox').hidden;
 $('quickEdit').hidden=$('editMotion').disabled;
 $('editMotion').textContent=fragmentRig?'逐骨块调参':'运动参数';
 $('motionStatus').textContent=fragmentRig?'青点是伤前位置，赭点随断缘移动。':wedges.length?(v.cuts.some(s=>s.surface==='dent')?'从切线方向比较颅盖凹陷深度。':'比较椎体伤前与当前的局部高度。'):course.kind==='joint'?'以关节窝为参照，观察活动骨端。':'本分型示例保持对位，显示损伤位置。';
 if((studyMode==='cut'&&!inspection?.cut)||(studyMode==='facet'&&!inspection?.patch))studyMode='overview';
 mechanics=buildMechanics({group,world,items:animated,wedges,nearBones,course,variant:v,ghostMaterial,mirror,pose:rawPose});
 $('bandControls').hidden=!mechanics.ties.length;$('bandNames').textContent=mechanics.ties.join(' · ');
 syncStudy();
 syncDesk();
 if(!keepView){
  const d=fragmentRig?.focus.delta,homeDir=vec([-.6,.17,1]).normalize();
  const projected=d?d.clone().addScaledVector(homeDir,-d.dot(homeDir)).length():Infinity;
  const small=projected<span*.035;
  if(small&&desk==='plate'&&studyMode==='overview')motionCloseUp(smooth);
  else aim(desk==='plate'?'detail':desk==='story'?storyView():'home',smooth);
 }
 setProgress(progress);
}
function rawPose(progress,report=false){
 applyMotion?.(progress,report);fragmentRig?.apply(progress);impaction?.();
 if(anklePose){
  const u=T.MathUtils.smoothstep(progress,.19,.76),angle=applyMotion.footRoll();
  anklePose.limb.rotation.z=anklePose.sign*T.MathUtils.degToRad(angle)*u;
  anklePose.limb.position.y=anklePose.origin.y-.0012*(angle/12)*Math.sin(Math.PI*u);
 }
}
function scenePose(requested,report=true){
 const observationMode=report?studyMode:'overview';
 const opts={checkBones:true,limitBones:$('boneRule').value==='limit',hold:$('bandRule').value==='held',slack:Number($('slack').value)/100,draw:$('drawConstraints').checked&&!['cut','facet'].includes(observationMode)};
 const key=opts.limitBones||opts.hold?JSON.stringify([quantities,opts.limitBones,opts.hold,opts.slack]):'';
 const limit=mechanics?.limit(requested,opts,key)||{time:requested,reason:null},progress=limit.time;
 rawPose(progress,report);
 if(report){
  poseLimit=limit;
  const result=mechanics?.report(progress,opts,!playing||progress===1||progress===0);
  const status=limit.reason?'已限位 · '+limit.reason.name+'（实际轨迹 '+Math.round(progress*100)+'%）':
   result?.bone?.kind==='bone'?'骨面穿插 · '+result.bone.name:
   result?.bone?.kind==='native'?'源模型已有接触重叠 · '+result.bone.name:mechanics?.candidateCount?'当前采样未检出新增穿插':'本例没有发生相对运动的骨面对';
  $('contactState').textContent=status+(result?.most&&(opts.hold||$('mechanicsBox').open)?'　'+result.most.name+' 附着点间距变化 '+((result.most.ratio-1)*100).toFixed(1)+'%':'');
  $('contactState').classList.toggle('conflict',!!limit.reason||result?.bone?.kind==='bone');
 }else mechanics?.hide();
 for(const item of animated)if(item.shell){const changing=item.pivot.position.distanceToSquared(item.anchor)>1e-10||Math.abs(item.pivot.quaternion.w)<.9999999;const editing=$('fragmentBox').open&&fragmentRig?.active.members.includes(item);item.shell.material=editing&&report?editedMaterial:changing?displacedMaterial:bone;if(item.ghost)item.ghost.visible=$('ghost').checked&&changing;item.face.visible=progress>.28||observationMode==='cut'||observationMode==='facet';}
 for(const obj of annotations){
  obj.visible=$('guides').checked&&(obj.userData.force?progress>.05&&progress<.63:obj.userData.displacement?progress>.44:progress>=.30);
  if(obj.userData.displacement){
   const {item,offset}=obj.userData,delta=item.pivot.position.clone().sub(item.anchor),length=delta.length();
   obj.visible=obj.visible&&length>.0003;
   if(obj.visible){obj.position.copy(item.anchor).add(offset);obj.setDirection(delta.normalize());obj.setLength(length,length*.26,length*.14);}
  }
 }
 for(const obj of nearBones)obj.visible=$('neighbors').checked;
 inspection?.update(observationMode,progress,$('neighbors').checked);
 if(observationMode==='cut'||observationMode==='facet')for(const i of animated)if(i.ghost)i.ghost.visible=false;
 if(fragmentRig){
  const marked=fragmentRig.display(progress,!opts.limitBones&&!opts.hold&&$('trace').checked&&observationMode!=='cut'&&(report||progress>=1));
  if(report){
   if($('fragmentBox').open&&studyMode==='overview'&&inspection){
    inspection.tags.length=0;inspection.tags.push({text:'调节中的骨块',point:marked.target});
   }
   const edited=hasEdits(quantities);
   const read=edited?'自定义骨块姿态':$('liveValues').textContent;
   $('liveValues').textContent=(read?read+'　':'')+(impaction?'相对伤前断缘位移 ':'断缘对应点错开 ')+marked.distance.toFixed(1)+' mm';
  }
 }
 if(report&&observationMode==='facet'){
  const m=inspection?.measurements();
  if(m)$('liveValues').textContent+='　标示点高差 '+m.height.toFixed(1)+' mm　面内错位 '+m.slip.toFixed(1)+' mm';
 }
}
function setProgress(value){
 dirty=true;progress=Math.max(0,Math.min(1,value));scenePose(progress);
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
 if(poseLimit?.reason)$('phase').textContent=poseLimit.reason.kind==='band'?'韧带伸长限位':'骨面接触限位';
 $('quickPlay').textContent=playing?'Ⅱ　暂停':progress>=1?'↻　重播':'▶　播放';
 $('play').textContent=playing?'Ⅱ 暂停':progress>=1?'↻ 重播':'▶ 播放';
}
function orientation(){
 dirty=true;
 const d=camera.position.clone().sub(controls.target).normalize();
 const names=[['患者左侧','患者右侧'],['上方','下方'],['前方','后方']];
 const xyz=d.toArray(),major=xyz.map((v,i)=>[Math.abs(v),names[i][v>=0?0:1]]).sort((a,b)=>b[0]-a[0]);
 if(lessonOpen()&&desk==='pair'){$('orientation').textContent='正交双视图';return;}
 const screenRight=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion).toArray();
 const axis=screenRight.map((n,i)=>[Math.abs(n),i]).sort((a,b)=>b[0]-a[0])[0][1];
 const sign=screenRight[axis]>0?0:1;
 const compass=Math.abs(screenRight[axis])>.90?'　← '+names[axis][1-sign]+'　'+names[axis][sign]+' →':'';
 $('orientation').textContent='视向 · '+major.filter(x=>x[0]>.36).map(x=>x[1]).join(' / ')+compass;
}
function frame(now){
 if(playing&&course){
  if(holdUntil){if(now>=holdUntil){holdUntil=0;setProgress(0);}}
  else{
   setProgress(progress+(previous?Math.max(0,(now-previous)/1000):0)*speed/5);
   if(progress===1){if(repeating)holdUntil=now+950;else{playing=false;setProgress(1);}}
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
  if(lessonOpen()&&desk!=='plate'){
   $('markLayer').hidden=true;$('labels').hidden=true;
   drawDesk({desk,renderer,world,camera,target:controls.target,host,panels,time:progress,pose:scenePose,pair,
    side:/\bleft\b/i.test(selected)?1:-1,endBelow:['radius','intercondylar','distalfemur'].includes(course.id),
    label:labelPane,sectionGuide:sectionGuide()});
  }else{overviewLabels();paintLabels();renderer.render(world,camera);}
  dirty=false;
 }
 requestAnimationFrame(frame);
}
async function start(){
 renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 host.append(renderer.domElement);
 camera=new T.PerspectiveCamera(38,1,.001,30);controls=new OrbitControls(camera,renderer.domElement);
 controls.addEventListener('start',()=>flight=null);controls.enableDamping=false;controls.addEventListener('change',orientation);
 bone.color.set(0xd9c2a0);accent.color.set(0x81ae9c);world.add(new T.HemisphereLight(0xfffcf4,0x68685c,1.12));
 for(const [pos,intensity] of [[[2,3,4],2.1],[[-3,1,-3],1.4]]){const l=new T.DirectionalLight(0xfff3dc,intensity);l.position.set(...pos);world.add(l);}
 const resize=()=>{
  const w=host.clientWidth,h=host.clientHeight,previousAspect=camera.aspect;
  dirty=true;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(ready&&previousAspect>0&&camera.aspect>0){
   // Keep the student's sightline when opening a drawer, rotating the phone or resizing.
   const fit=Math.min(1,previousAspect)/Math.min(1,camera.aspect);
   if(Math.abs(fit-1)>.001){
    const offset=camera.position.clone().sub(controls.target).multiplyScalar(fit);
    camera.position.copy(controls.target).add(offset);
    if(flight)flight=null;
    controls.update();
   }
  }
 };
 new ResizeObserver(resize).observe(host);resize();
 const [index,bin,meta]=await Promise.all(['models/index.json','models/bones.bin','models/detail.json'].map(async u=>{
  const r=await fetch(assetURL(u));if(!r.ok)throw Error('无法加载 '+u);return u.endsWith('json')?r.json():r.arrayBuffer();
 }));
 const framesById=new Map(meta.entries.map(e=>[e.mesh,landmarkMap(e,meta.display_offset_mm)]));
 for(const m of index){
  const key=boneData.has(m.name)?m.name+' '+m.mesh:m.name;
  const preview=materialize(m,bin);alignPreview(preview,framesById.get(m.mesh));boneData.set(key,preview);meshByKey.set(key,m.mesh);keyByMesh.set(m.mesh,key);
 }
 upgradeDetail().catch(err=>{
  $('meshState').textContent='基础网格 · 精细表面载入失败';console.error(err);
 });
 async function upgradeDetail(){
  const u='models/detail.bin.gz',res=await fetch(assetURL(u));
  if(!res.ok)throw Error('精细骨面下载失败');
  const bytes=await res.arrayBuffer();
  const surfaces=await decodeSurfaces(meta,bytes);
  if(surfaces.size!==boneData.size)throw Error('精细模型清单不完整');
  for(const g of reflectedMeshes.values())g.dispose();reflectedMeshes.clear();
  for(const [mesh,g] of surfaces){const key=keyByMesh.get(mesh);boneData.get(key).dispose();boneData.set(key,g);}
  $('meshState').textContent='精细骨表面';$('meshState').dataset.ready='true';renderLesson(false,true);
 }
 buildIndex(boneData.keys(),pickBone,key=>matches(key).length);ready=true;route();$('status').hidden=true;
 let press=null;
 const ray=new T.Raycaster(),canvas=renderer.domElement;
 function hit(e){
  const box=host.getBoundingClientRect();
  ray.setFromCamera(new T.Vector2(2*(e.clientX-box.left)/box.width-1,1-2*(e.clientY-box.top)/box.height),camera);
  return ray.intersectObjects(group.children,false)[0]?.object;
 }
 canvas.addEventListener('pointerdown',e=>{press=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{
  if(!selected&&press&&Math.hypot(e.clientX-press[0],e.clientY-press[1])<6){
   const key=hit(e)?.userData.bone;if(key)pickBone(key);
  }press=null;
 });
 function clearHover(){if(hovered)dirty=true;if(hovered)hovered.material=bone;hovered=null;$('tip').hidden=true;canvas.style.cursor='grab';}
 canvas.addEventListener('pointerleave',clearHover);
 canvas.addEventListener('pointermove',e=>{
  clearHover();if(selected||press||e.pointerType==='touch')return;
  hovered=hit(e);if(!hovered)return;
  dirty=true;hovered.material=accent;canvas.style.cursor='pointer';const tip=$('tip'),box=host.getBoundingClientRect();
  tip.textContent=boneName(hovered.userData.bone);tip.hidden=false;
  tip.style.left=Math.max(0,Math.min(box.width-tip.offsetWidth,e.clientX-box.left+14))+'px';
  tip.style.top=Math.max(0,e.clientY-box.top-28)+'px';
 });
 requestAnimationFrame(frame);
}
$('play').onclick=()=>{playing=!playing;setProgress(progress>=1?0:progress);};
$('prevFrame').onclick=()=>{playing=false;setProgress((Math.ceil(progress*300-1e-8)-1)/300);};
$('nextFrame').onclick=()=>{playing=false;setProgress((Math.floor(progress*300+1e-8)+1)/300);};
$('time').oninput=e=>{playing=false;setProgress(+e.target.value/1000);};
$('speed').onclick=e=>{speed=speed===1?.5:speed===.5?1.5:1;e.target.textContent=speed+'×';};
for(const id of ['guides','neighbors','ghost','trace'])$(id).onchange=()=>setProgress(progress);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>aim(b.dataset.view);
$('whole').onclick=()=>pickBone(null);
$('sites').onchange=e=>{
 quantities={};course=courses.find(c=>c.id===e.target.value);variant=-1;playing=false;progress=0;shape='';motions=[];
 updateURL();renderLesson();
};
$('end').onclick=()=>{playing=false;setProgress(1);};
$('expand').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener('fullscreenchange',()=>{$('expand').textContent=document.fullscreenElement?'退出全屏':'全屏';});
window.addEventListener('hashchange',route);
$('nextPart').onclick=()=>{inspection?.advance();syncStudy();setProgress(progress);};
$('mobilePanel').onclick=()=>{document.body.classList.toggle('panel-open');};
for(const b of $('workspaceTabs').children)b.onclick=()=>{tab=b.dataset.tab;syncDesk();document.querySelector('.rail-scroll').scrollTop=0;};
$('foldPanel').onclick=()=>document.body.classList.remove('panel-open');
for(const b of document.querySelectorAll('[data-study]'))b.onclick=()=>setStudy(b.dataset.study);
$('copyLink').onclick=async()=>{
 updateURL(true);
 const target=location.protocol==='file:'?'https://fsy2004.github.io/fracture-atlas/'+location.hash:location.href;
 try{await navigator.clipboard.writeText(target);$('copyLink').textContent='已复制';setTimeout(()=>$('copyLink').textContent='复制链接',1400);}
 catch{window.prompt('复制此链接',target);}
};
for(const b of document.querySelectorAll('[data-desk]'))b.onclick=()=>setDesk(b.dataset.desk);
for(const b of document.querySelectorAll('[data-pair]'))b.onclick=()=>{pair=b.dataset.pair;if(pair==='end'&&inspection?.guide&&studyMode!=='facet'){studyMode='motion';syncStudy();setProgress(progress);}updateURL(true);syncDesk();dirty=true;};
$('showConstraints').onclick=()=>{
 tab='measure';syncDesk();if(matchMedia('(max-width:630px)').matches)document.body.classList.add('panel-open');
 $('mechanicsBox').open=true;$('mechanicsBox').scrollIntoView({block:'center'});$('boneRule').focus({preventScroll:true});
};
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
$('fragmentBox').ontoggle=()=>{if(lessonOpen())setProgress(progress);};
$('repeat').onclick=()=>{repeating=!repeating;holdUntil=0;$('repeat').setAttribute('aria-pressed',String(repeating));updateURL(true);};
$('zoomMotion').onclick=()=>{motionCloseUp(true);document.body.classList.remove('panel-open');};
$('editMotion').onclick=()=>{
 tab='measure';syncDesk();if(matchMedia('(max-width:630px)').matches)document.body.classList.add('panel-open');
 const box=fragmentRig?$('fragmentBox'):$('quantBox');if(fragmentRig)box.open=true;
 box.scrollIntoView({block:'start'});(fragmentRig?$('fragmentPick'):box.querySelector('input'))?.focus({preventScroll:true});
};
$('quickEdit').onclick=()=>$('editMotion').click();
for(const id of ['boneRule','bandRule','slack','drawConstraints'])$(id).onchange=()=>{
 $('slackValue').textContent=$('slack').value+'%';playing=false;holdUntil=0;setProgress(progress);updateURL(true);
};
$('normal').onclick=()=>{playing=false;setProgress(0);};
document.addEventListener('visibilitychange',()=>{
 previous=performance.now();if(document.hidden&&playing){playing=false;setProgress(progress);}
});
start().catch(err=>{$('status').hidden=false;$('status').textContent='三维视图加载失败，请使用支持 WebGL 的浏览器刷新。'+err.message;console.error(err);});
