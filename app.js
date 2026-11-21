import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { courses as fractures,levels } from './courses.js';
import { section,atLevel } from './geometry.js';

import {boneName,teachingBone,regionFor,buildIndex} from './bone-index.js';
import {featuresFor,initialShape,shapeNames,motionNames,withShape,customPose} from './features.js';

import {joints} from './joints.js';
import {buildKinematics,shaftFrame} from './kinematics.js';
const courses=[...fractures,...joints];
const ghostMaterial=new T.MeshBasicMaterial({color:0xb4dffc,transparent:true,opacity:.16,depthWrite:false});
const displacedMaterial=new T.MeshStandardMaterial({color:0xefa36d,roughness:.75,side:T.DoubleSide});
let quantities={},applyMotion=null;
const $=id=>document.getElementById(id), host=$('viewport');
const boneData=new Map(), animated=[], annotations=[], nearBones=[], pieces=[],wedges=[];
const world=new T.Scene(), group=new T.Group();world.add(group);
const bone=new T.MeshStandardMaterial({color:0xe9e2c9,roughness:.84,side:T.DoubleSide});
const accent=new T.MeshStandardMaterial({color:0x7bbdaa,roughness:.83,side:T.DoubleSide});
const adjacent=new T.MeshStandardMaterial({color:0x658783,roughness:1,side:T.DoubleSide});
const cap=new T.MeshStandardMaterial({color:0xcd8557,roughness:1,side:T.DoubleSide});
const line=new T.LineBasicMaterial({color:0xffae61});
const vec=a=>new T.Vector3(...a), zero=new T.Vector3();
let renderer,camera,controls,course=null,variant=-1,level=1,progress=0,playing=false,speed=1;
let fractureFocus=new T.Vector3();
let focus=new T.Vector3(),span=.45,distance=.7,previous=0,ready=false;
const keyByMesh=new Map(),meshByKey=new Map();
let selected=null,shape='',motions=[],flight=null,hovered=null,lastLabelView='';
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
 applyMotion=null;$('liveValues').textContent='';hovered=null;$('tip').hidden=true;group.scale.x=1;
 group.traverse(o=>{if(o.userData.dispose)o.geometry?.dispose();if(o.isArrowHelper||o.type==='ArrowHelper')o.dispose?.();});
 group.clear();animated.length=annotations.length=nearBones.length=pieces.length=wedges.length=0;
}
function addBone(name,material,parent=group){
 const g=boneData.get(name);if(!g)return;
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
 animated.push({pivot,anchor,ghost,shell,moving,tuned:motion.tuned,shift:vec(motion.shift).multiplyScalar(.001),turn:vec(motion.turn).multiplyScalar(Math.PI/180)});
 return pivot;
}
function addWedge(g,kind){
 const geo=g.clone(),position=geo.attributes.position,delta=new Float32Array(position.count*3);
 const box=g.boundingBox,size=box.getSize(new T.Vector3());
 const point=new T.Vector3();
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i);
  const forward=(point.z-box.min.z)/size.z, height=(point.y-box.min.y)/size.y;
  const side=1-(point.x-box.min.x)/size.x;
  const body=T.MathUtils.smoothstep(forward,.48,.77);
  const weight=kind==='anterior'?T.MathUtils.smoothstep(forward,.60,1):side;
  delta[3*i+1]=-size.y*.40*body*weight*height;
 }
 geo.morphAttributes.position=[new T.BufferAttribute(delta,3)];geo.morphTargetsRelative=true;
 const mesh=new T.Mesh(geo,bone);mesh.userData.dispose=true;group.add(mesh);wedges.push(mesh);
}
function addFracture(spec,anchor){
 const g=boneData.get(spec.bone), pair=section(g,spec.normal,anchor.toArray(),spec.fold,spec.spiralHeight);
 const pivot=spec.pivot?vec(spec.pivot):anchor;
 addPart(pair[0],pivot,spec.minus,bone);
 if(!spec.second){addPart(pair[1],pivot,spec.plus,bone);return;}
 // Recursively split one fragment, including its first cut face.
 const first=pair[1],assembled=new T.BufferGeometry(),pos=[],norm=[];
 for(const source of [first.geo,first.face]){
  pos.push(...source.attributes.position.array);norm.push(...source.attributes.normal.array);
 }
 assembled.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 assembled.setAttribute('normal',new T.Float32BufferAttribute(norm,3));
 assembled.setIndex(Array.from({length:pos.length/3},(_,i)=>i));
 const halves=section(assembled,spec.second,anchor.toArray());
 halves.forEach((half,i)=>addPart(half,anchor,{shift:spec.plus.shift.map((v,k)=>v+(k===0?(i?1:-1):0)),turn:spec.plus.turn,tuned:spec.plus.tuned},bone));
 for(const g of [assembled,first.geo,first.face,first.outline])g.dispose();
}
function bonesFor(v){return [...v.cuts.map(c=>c.bone),...(v.fixed||[])];}
function matches(key){
 return key?courses.filter(c=>courseBones(c).has(teachingBone(key))):[];
}
function pickBone(key){
 quantities={};
 selected=key;course=matches(key)[0]||null;variant=-1;level=1;shape='';motions=[];playing=false;progress=0;
 updateURL();renderLesson(true);$('panel').scrollTop=0;
}
function pickVariant(i){
 quantities={};
 variant=i;shape='';motions=[];progress=0;playing=true;
 updateURL();renderLesson(true);
}
function updateURL(){
 let hash=selected?'bone/'+meshByKey.get(selected):'skeleton';
 if(course&&variant>=0){
  const params=new URLSearchParams();
  if(selected)params.set('bone',meshByKey.get(selected));
  if(shape)params.set('shape',shape);
  if(motions.length)params.set('move',motions.join(','));
  for(const [k,n] of Object.entries(quantities))params.set('q_'+k,n);
  hash=[course.id,variant,level].join('/')+(params.size?'?'+params:'');
 }
 history.replaceState(null,'','#'+hash);
}
function route(){
 const [path,query]=location.hash.slice(1).split('?'),[id,v,l]=path.split('/');
 const params=new URLSearchParams(query);quantities={};
 for(const key of ['shorten','separate','side','rotate','angle','spin','travel','wedge','plane']){
  const value=params.get('q_'+key);
  if(value!==null&&value!==''&&Number.isFinite(+value))quantities[key]=+value;
 }
 selected=null;course=null;variant=-1;level=1;progress=0;playing=false;shape='';motions=[];
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
 renderLesson(false);
}
function showControls(){
 const local=Boolean(selected),lesson=Boolean(course&&variant>=0);
 $('indexPanel').hidden=local;$('bonePanel').hidden=!local;$('lessonPanel').hidden=!lesson;

 document.querySelector('[data-view=detail]').textContent=course?.kind==='joint'?'关节特写':'放大断面';
 $('layers').hidden=!lesson;document.querySelector('[data-view=detail]').hidden=!lesson;
 $('labels').hidden=local;$('breadcrumb').textContent=local?'骨骼索引　/　'+regionFor(selected):'全身骨骼　/　索引';
 $('jointShortcuts').hidden=local;
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
 $('end').textContent=course.kind==='joint'?'脱位后状态':'骨折后状态';
 const allowed=course.variants.map((v,i)=>bonesFor(v).includes(teachingBone(selected))?i:-1).filter(i=>i>=0);
 buttons($('variants'),allowed.map(i=>course.variants[i].name),allowed.indexOf(variant),i=>pickVariant(allowed[i]));
 buttons($('levels'),levels.map(x=>x[0]),level,i=>{level=i;progress=0;playing=lesson;updateURL();renderLesson(true);});
 if(!lesson)return;
 const isJoint=course.kind==='joint';
 const stepTimes=isJoint?[0,.49,1]:[.16,.35,.61,.94];
 buttons($('steps'),isJoint?['对位','移出','终点']:['受力','断面 / 形变','平移','终末姿态'],-1,i=>{playing=false;setProgress(stepTimes[i]);});
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
  delete quantities.plane;shape=shapeKeys[i]===base?'':shapeKeys[i];progress=0;playing=true;updateURL();renderLesson(false,true);
 });
 const keys=['',...f.motions];
 buttons($('motions'),keys.map(k=>motionNames[k]||'典型移位'),-1,i=>{
  const key=keys[i];
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
 const target=view==='detail'?fractureFocus:focus;
 const dir={detail:[-.6,.17,1],front:[0,0,1],side:[-1,0,0],top:[0,1,.001],home:selected?[-.36,.12,1]:[0,0,1]}[view];
 const box=host.getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);
 let horizontal=span;
 if(!selected)horizontal=.65;
 else if(view!=='top'&&view!=='side'&&view!=='detail'){
  const size=boneData.get(selected).boundingBox.getSize(new T.Vector3());
  horizontal=Math.min(span,Math.max(span*.42,Math.hypot(size.x,size.z)));
 }
 const viewSize=Math.max(span,horizontal/aspect);
 distance=viewSize*(view==='detail'?.57:1.16)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
 const end=target.clone().addScaledVector(vec(dir).normalize(),distance);
 flight=null;
 controls.minDistance=.0005;controls.maxDistance=20;
 if(smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  flight={from:camera.position.clone(),target:controls.target.clone(),end,focus:target.clone(),start:performance.now()};
 }else{camera.position.copy(end);controls.target.copy(target);controls.update();}

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
  aim('home',smooth);return;
 }
 const v=course.variants[variant],bounds=new T.Box3(),anchors=[];
 const mirror=/\bleft\b/i.test(selected);
 group.scale.x=mirror?-1:1;
 $('crumb').textContent=boneName(selected)+' / '+course.name+(mirror?' · 左侧镜像示教':'');
 $('heading').textContent=v.name;$('description').textContent=[shapeNames[shape],...motions.map(k=>motionNames[k])].filter(Boolean).join(' · ');
 $('cause').textContent=shape?(course.name+' · '+v.name+'，本例采用'+shapeNames[shape]+'骨折线。'):v.cause;
 $('observe').textContent=motions.length?'组合观察：'+motions.map(k=>motionNames[k]).join('、')+'。可用时间轴对照正常位置与骨折后状态。':shape?'旋转模型，观察所选断面与骨干长轴的关系。':v.observe;
 const ctx=v.context||course.context||[], shared=course.levels?atLevel(boneData.get('Right tibia'),1,levels[level][1])[1]:null;
 let referenceWidth=0,sharedPivot=null,frame=null,followMotion=v.cuts[0].minus;
 if(course.kind==='joint'){
  const a=vec(v.anchor),pivot=new T.Group(),ghost=new T.Group();
  group.add(pivot,ghost);pivot.position.copy(a);ghost.visible=false;
  for(const {bone:name} of v.cuts){
   addBone(name,displacedMaterial,pivot).position.copy(a).negate();
   addBone(name,ghostMaterial,ghost);
  }
  for(const name of v.fixed)addBone(name,bone);
  animated.push({pivot,anchor:a,shift:vec(v.shift).multiplyScalar(.001),turn:new T.Vector3(),ghost});
  anchors.push(a);
 }
 for(const original of course.kind==='joint'?[]:v.cuts){
  let s=withShape(original,shape);
  const g=boneData.get(s.bone);
  if(s.wedge){
   const a=g.boundingBox.getCenter(new T.Vector3());a.z=g.boundingBox.max.z-.012;anchors.push(a);
   addWedge(g,s.wedge);bounds.union(g.boundingBox);continue;
  }
  let fraction=s.level;
  if(shared!==null){
   const y=shared+(variant===1&&s.bone==='Right fibula'?.033:0);
   fraction=(y-g.boundingBox.min.y)/(g.boundingBox.max.y-g.boundingBox.min.y);
  }
  const a=vec(s.anchor||atLevel(g,s.axis,fraction));anchors.push(a);
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
  if(shape==='spiral')s.spiralHeight=(g.boundingBox.max.y-g.boundingBox.min.y)*.15;
  if(motions.length){
   if(!referenceWidth){
    const measure=g.attributes.position,extent=new T.Box3();
    const radius=(g.boundingBox.max.getComponent(s.axis)-g.boundingBox.min.getComponent(s.axis))*.055;
    for(let i=0;i<measure.count;i++){
     const point=new T.Vector3().fromBufferAttribute(measure,i);
     if(Math.abs(point.getComponent(s.axis)-a.getComponent(s.axis))<radius)extent.expandByPoint(point);
    }
    referenceWidth=Math.max(2,extent.isEmpty()?9:extent.getSize(new T.Vector3()).getComponent((s.axis+2)%3)*1000);
    sharedPivot=a.toArray();
    const delta=.08,low=vec(atLevel(g,s.axis,Math.max(.02,fraction-delta))),high=vec(atLevel(g,s.axis,Math.min(.98,fraction+delta)));
    frame=shaftFrame(low,high,s.axis===2);
   }
   if(course.id==='radius'){
    s={...s,minus:{...s.minus,tuned:'wrist'}};
    followMotion=s.minus;
   }else{
    s=customPose(s,motions,referenceWidth);s.pivot=sharedPivot;
    s[s.axis===2?'plus':'minus'].tuned='shaft';
   }
  }
  if(v.fissure){
   addBone(s.bone,bone);
   const halves=section(g,s.normal,a.toArray()),outline=halves[0].outline;
   const coords=outline.attributes.position.array,partial=[];
   for(let i=0;i<coords.length;i+=6)if(coords[i]<a.x)partial.push(...coords.slice(i,i+6));
   const trace=new T.BufferGeometry();trace.setAttribute('position',new T.Float32BufferAttribute(partial,3));
   const edge=new T.LineSegments(trace,line);edge.userData.dispose=true;group.add(edge);annotations.push(edge);
   for(const half of halves)for(const geo of [half.geo,half.face,half.outline])geo.dispose();
  }else addFracture(s,a);
  bounds.union(g.boundingBox);
 }
 const lesion=anchors.reduce((s,a)=>s.add(a),new T.Vector3()).divideScalar(anchors.length);
 fractureFocus.copy(lesion);
 for(const name of ctx){
  const m=addBone(name,adjacent);if(!m)continue;
  nearBones.push(m);
  const extra=v.moving?.find(item=>item.names.includes(name));
  if(extra){
   const a=extra.pivot?vec(extra.pivot):anchors[0],pivot=new T.Group();group.add(pivot);pivot.add(m);m.position.copy(a).negate();
   animated.push({pivot,anchor:a,shift:vec(extra.shift||[0,0,0]).multiplyScalar(.001),turn:vec(extra.turn||[0,0,0]).multiplyScalar(Math.PI/180)});
  }else if(v.follow?.includes(name)){
   const a=anchors[0],pivot=new T.Group();group.add(pivot);pivot.add(m);m.position.copy(a).negate();
   animated.push({pivot,anchor:a,tuned:followMotion.tuned,shift:vec(followMotion.shift).multiplyScalar(.001),turn:vec(followMotion.turn).multiplyScalar(Math.PI/180)});
  }
 }
 span=v.span||course.span||Math.max(...bounds.getSize(new T.Vector3()).toArray())*1.12;
 if(course.kind==='joint')focus.copy(lesion);else if(v.focus)focus.copy(vec(v.focus));else if(v.span||course.span)focus.copy(lesion);else bounds.getCenter(focus);
 $('neighbors').disabled=!nearBones.length;
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
 // Direction markers follow the fragment and use anatomical model coordinates.
 for(const item of animated){
  if(item.shift.length()<.001||item.pivot.children.every(o=>nearBones.includes(o)))continue;
  const direction=item.shift.clone().normalize(),offset=new T.Vector3(span*.065,0,span*.035);
  const length=Math.max(span*.075,Math.min(span*.17,item.shift.length()*2.5));
  const arrow=new T.ArrowHelper(direction,item.anchor.clone().add(offset),length,0x72e6c4,length*.30,length*.17);
  arrow.userData.displacement=true;arrow.userData.item=item;arrow.userData.offset=offset;group.add(arrow);annotations.push(arrow);
 }
 if(mirror){focus.x*=-1;fractureFocus.x*=-1;}
 applyMotion=buildKinematics(animated,wedges,motions,frame,referenceWidth,course.kind==='joint',quantities,()=>{
  playing=false;setProgress(1);updateURL();
 });
 if(!keepView)aim('detail',smooth);
 setProgress(progress);
}
function setProgress(value){
 progress=Math.max(0,Math.min(1,value));
 applyMotion?.(progress);
 for(const item of animated)if(item.shell&&item.moving)item.shell.material=progress>.28?displacedMaterial:bone;
 for(const obj of annotations){
  obj.visible=$('guides').checked&&(obj.userData.force?progress>.05&&progress<.63:obj.userData.displacement?progress>.44:progress>=.30);
  if(obj.userData.displacement){
   const {item,offset}=obj.userData,delta=item.pivot.position.clone().sub(item.anchor),length=delta.length();
   obj.visible=obj.visible&&length>.0003;
   if(obj.visible){obj.position.copy(item.anchor).add(offset);obj.setDirection(delta.normalize());obj.setLength(length,length*.26,length*.14);}
  }
 }
 for(const obj of nearBones)obj.visible=$('neighbors').checked;
 $('time').value=Math.floor(progress*1000);
 $('phase').textContent=progress<.05?'正常形态':progress<.30?'受力阶段':progress<.45?(wedges.length?'椎体开始压缩':'骨折线显现'):progress<1?(wedges.length?'楔形压缩':'骨块移位'):'最终形态';
 if(course?.kind==='joint')$('phase').textContent=progress<.25?'关节对位':progress<.78?'关节面移出':'示例终点';
 if(course?.kind!=='joint'&&motions.length&&progress>=.45&&progress<1){
  $('phase').textContent=progress<.54?'平移与长度变化':motions.some(k=>k==='rotate'||k==='angle')?'转角形成':'断端移位';
 }
 $('play').textContent=playing?'Ⅱ 暂停':progress>=1?'↻ 重播':'▶ 播放';
}
function orientation(){
 const d=camera.position.clone().sub(controls.target).normalize();
 const names=[['患者左侧','患者右侧'],['上方','下方'],['前方','后方']];
 const xyz=d.toArray(),major=xyz.map((v,i)=>[Math.abs(v),names[i][v>=0?0:1]]).sort((a,b)=>b[0]-a[0]);
 $('orientation').textContent='视向 · '+major.filter(x=>x[0]>.36).map(x=>x[1]).join(' / ');
}
function frame(now){
 if(playing&&course){setProgress(progress+Math.min(.1,(now-previous)/1000)*speed/5);if(progress===1){playing=false;setProgress(1);}}
 if(flight){
  const fraction=Math.min(1,(now-flight.start)/520),t=fraction*fraction*(3-2*fraction);
  camera.position.lerpVectors(flight.from,flight.end,t);controls.target.lerpVectors(flight.target,flight.focus,t);
  if(fraction>=1)flight=null;
 }
 previous=now;controls.update();overviewLabels();renderer.render(world,camera);requestAnimationFrame(frame);
}
async function start(){
 renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 host.append(renderer.domElement);
 camera=new T.PerspectiveCamera(38,1,.001,30);controls=new OrbitControls(camera,renderer.domElement);
 controls.addEventListener('start',()=>flight=null);controls.enableDamping=false;controls.addEventListener('change',orientation);
 bone.color.set(0xdadacc);accent.color.set(0x68c6ed);world.add(new T.HemisphereLight(0xfff8ef,0x586575,1.45));
 for(const [pos,intensity] of [[[2,3,4],2.1],[[-3,1,-3],1.4]]){const l=new T.DirectionalLight(0xfff3dc,intensity);l.position.set(...pos);world.add(l);}
 const resize=()=>{
  const w=host.clientWidth,h=host.clientHeight,previousAspect=camera.aspect;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(ready&&Math.abs(Math.log(camera.aspect/previousAspect))>.25)aim();
 };
 new ResizeObserver(resize).observe(host);resize();
 const [index,bin]=await Promise.all(['models/index.json','models/bones.bin'].map(async u=>{
  const r=await fetch(u);if(!r.ok)throw Error('无法加载 '+u);return u.endsWith('json')?r.json():r.arrayBuffer();
 }));
 for(const m of index){
  const key=boneData.has(m.name)?m.name+' '+m.mesh:m.name;
  boneData.set(key,materialize(m,bin));meshByKey.set(key,m.mesh);keyByMesh.set(m.mesh,key);
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
 function clearHover(){if(hovered)hovered.material=bone;hovered=null;$('tip').hidden=true;canvas.style.cursor='grab';}
 canvas.addEventListener('pointerleave',clearHover);
 canvas.addEventListener('pointermove',e=>{
  clearHover();if(selected||press||e.pointerType==='touch')return;
  hovered=hit(e);if(!hovered)return;
  hovered.material=accent;canvas.style.cursor='pointer';const tip=$('tip'),box=host.getBoundingClientRect();
  tip.textContent=boneName(hovered.userData.bone);tip.hidden=false;
  tip.style.left=Math.max(0,Math.min(box.width-tip.offsetWidth,e.clientX-box.left+14))+'px';
  tip.style.top=Math.max(0,e.clientY-box.top-28)+'px';
 });
 requestAnimationFrame(frame);
}
$('play').onclick=()=>{playing=!playing;setProgress(progress>=1?0:progress);};
$('time').oninput=e=>{playing=false;setProgress(+e.target.value/1000);};
$('speed').onclick=e=>{speed=speed===1?.5:speed===.5?1.5:1;e.target.textContent=speed+'×';};
for(const id of ['guides','neighbors','ghost'])$(id).onchange=()=>setProgress(progress);
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
buttons($('jointLinks'),joints.map(c=>c.name),-1,i=>{
 const c=joints[i];selected=c.variants[0].cuts[0].bone;course=c;level=1;pickVariant(0);$('panel').scrollTop=0;
});
$('plane').oninput=()=>{$('planeValue').textContent=$('plane').value+'°';};
$('plane').onchange=()=>{quantities.plane=Number($('plane').value);progress=1;playing=false;updateURL();renderLesson(false,true);};
$('normal').onclick=()=>{playing=false;setProgress(0);};
start().catch(err=>{$('status').hidden=false;$('status').textContent='三维视图加载失败，请使用支持 WebGL 的浏览器刷新。'+err.message;console.error(err);});
