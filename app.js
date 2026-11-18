import * as T from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { courses,levels } from './courses.js';
import { section,atLevel } from './geometry.js';

const $=id=>document.getElementById(id), host=$('viewport');
const boneData=new Map(), animated=[], annotations=[], nearBones=[], pieces=[],wedges=[];
const world=new T.Scene(), group=new T.Group();world.add(group);
const bone=new T.MeshStandardMaterial({color:0xe9e2c9,roughness:.84,side:T.DoubleSide});
const accent=new T.MeshStandardMaterial({color:0x7bbdaa,roughness:.83,side:T.DoubleSide});
const adjacent=new T.MeshStandardMaterial({color:0x658783,roughness:1,side:T.DoubleSide});
const cap=new T.MeshStandardMaterial({color:0xcd8557,roughness:1,side:T.DoubleSide});
const line=new T.LineBasicMaterial({color:0xffae61});
const vec=a=>new T.Vector3(...a), zero=new T.Vector3();
let renderer,camera,controls,course=courses[0],variant=0,level=1,progress=0,playing=false,speed=1;
let fractureFocus=new T.Vector3();
let focus=new T.Vector3(),span=.45,distance=.7,previous=0,ready=false;
const courseBones=c=>new Set(c.variants.flatMap(v=>v.cuts.map(k=>k.bone)));
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
 group.traverse(o=>{if(o.userData.dispose)o.geometry?.dispose();if(o.isArrowHelper||o.type==='ArrowHelper')o.dispose?.();});
 group.clear();animated.length=annotations.length=nearBones.length=pieces.length=wedges.length=0;
}
function addBone(name,material,parent=group){
 const g=boneData.get(name);if(!g)return;
 const m=new T.Mesh(g,material);m.userData.bone=name;parent.add(m);return m;
}
function addPart(part,anchor,motion,material){
 const pivot=new T.Group(),shell=new T.Mesh(part.geo,material),face=new T.Mesh(part.face,cap);
 const edge=new T.LineSegments(part.outline,line);
 for(const o of [shell,face,edge]){o.position.copy(anchor).negate();o.userData.dispose=true;pivot.add(o);}
 annotations.push(edge);pieces.push(shell);
 pivot.position.copy(anchor);group.add(pivot);
 animated.push({pivot,anchor,shift:vec(motion.shift).multiplyScalar(.001),turn:vec(motion.turn).multiplyScalar(Math.PI/180)});
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
 const g=boneData.get(spec.bone), pair=section(g,spec.normal,anchor.toArray(),spec.fold);
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
 halves.forEach((half,i)=>addPart(half,anchor,{shift:spec.plus.shift.map((v,k)=>v+(k===0?(i?1:-1):0)),turn:spec.plus.turn},bone));
 for(const g of [assembled,first.geo,first.face,first.outline])g.dispose();
}
function choose(c,i=0,l=1){
 course=c;variant=i;level=l;playing=false;progress=0;
 const hash=c?[c.id,i,l].join('/'):'skeleton';history.replaceState(null,'','#'+hash);
 renderLesson();
}
function route(){
 const [id,v,l]=location.hash.slice(1).split('/');
 const c=courses.find(c=>c.id===id)||courses[0];
 course=!id||id==='skeleton'?null:c;variant=Math.max(0,Math.min(c.variants.length-1,parseInt(v)||0));
 level=Math.max(0,Math.min(2,l===undefined?1:(parseInt(l)||0)));
 if(ready)renderLesson();
}
function makeCatalog(){
 const nav=$('catalog');for(const region of ['下肢','上肢','躯干']){
  const h=document.createElement('h3');h.textContent=region;nav.append(h);
  for(const c of courses.filter(c=>c.region===region)){
   const b=document.createElement('button');b.textContent=c.name;b.dataset.site=c.id;b.onclick=()=>choose(c);nav.append(b);
  }
 }
 $('whole').onclick=()=>choose(null);
}
function aim(view='home'){
 if(!camera)return;
 if(view==='detail'&&!course)return;
 const target=view==='detail'?fractureFocus:focus;
 const dir={detail:[-.6,.17,1],front:[0,0,1],side:[-1,0,0],top:[0,1,.001],home:course?[-.36,.12,1]:[0,0,1]}[view];
 const box=host.getBoundingClientRect(),aspect=box.width/Math.max(1,box.height);
 distance=span*(view==='detail'?.57:1.16)/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.min(1,aspect));
 controls.target.copy(target);camera.position.copy(target).addScaledVector(vec(dir).normalize(),distance);
 controls.minDistance=span*.12;controls.maxDistance=span*5;controls.update();
}
function renderLesson(){
 if(!ready)return;clearScene();
 $('whole').classList.toggle('active',!course);
 document.querySelectorAll('[data-site]').forEach(b=>b.classList.toggle('active',b.dataset.site===course?.id));
 document.querySelector('[data-view=detail]').hidden=!course;
 document.querySelector('.playbar').hidden=!course;
 $('localControls').hidden=!course;$('atlasInfo').hidden=!!course;
 for(const id of ['play','speed','time'])$(id).disabled=!course;
 if(!course){
  const linked=new Set(courses.flatMap(c=>[...courseBones(c)]));
  for(const name of boneData.keys())addBone(name,linked.has(name)?accent:bone);
  focus.set(0,.82,0);span=1.80;
  $('heading').textContent='全身骨骼';$('crumb').textContent='解剖总览';$('caption').textContent='成年男性';
  $('bonePick').textContent='';$('phase').textContent='点击青绿色骨骼进入局部';$('time').value=0;
  aim();return;
 }
 const v=course.variants[variant], bounds=new T.Box3(), anchors=[];
 $('crumb').textContent=course.region+(course.id==='spine'?' / 第一腰椎':' / 右侧教学模型');
 $('heading').textContent=course.name.includes('脱位')?course.name:course.name+'骨折';$('caption').textContent=v.name;
 $('system').textContent=course.system;
 buttons($('variants'),course.variants.map(v=>v.name),variant,i=>choose(course,i,level));
 const currentBones=courseBones(course);
 const related=courses.filter(c=>c!==course&&[...courseBones(c)].some(b=>currentBones.has(b)));
 $('related').hidden=!related.length;$('related').open=false;
 buttons($('relatedList'),related.map(c=>c.name),-1,i=>choose(related[i]));
 $('levelbox').hidden=!course.levels;
 buttons($('levels'),levels.map(x=>x[0]),level,i=>choose(course,variant,i));
 $('cause').textContent=v.cause;$('observe').textContent=v.observe;
 $('citation').textContent='教材第六章 · '+course.source;
 const ctx=v.context||course.context||[], shared=course.levels?atLevel(boneData.get('Right tibia'),1,levels[level][1])[1]:null;
 for(const s of v.cuts){
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
   animated.push({pivot,anchor:a,shift:vec(v.cuts[0].minus.shift).multiplyScalar(.001),turn:vec(v.cuts[0].minus.turn).multiplyScalar(Math.PI/180)});
  }
 }
 span=v.span||course.span||Math.max(...bounds.getSize(new T.Vector3()).toArray())*1.12;
 if(v.focus)focus.copy(vec(v.focus));else if(v.span||course.span)focus.copy(lesion);else bounds.getCenter(focus);
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
 aim();setProgress(progress);
}
function setProgress(value){
 progress=Math.max(0,Math.min(1,value));
 const raw=Math.max(0,(progress-.36)/.64),t=raw*raw*(3-2*raw);
 for(const mesh of wedges)mesh.morphTargetInfluences[0]=t;
 for(const {pivot,anchor,shift,turn} of animated){
  pivot.position.copy(anchor).addScaledVector(shift,t);
  pivot.rotation.set(turn.x*t,turn.y*t,turn.z*t);
 }
 for(const obj of annotations){
  obj.visible=$('guides').checked&&(obj.userData.force?progress>.05&&progress<.63:obj.userData.displacement?progress>.44:progress>=.30);
  if(obj.userData.displacement)obj.position.copy(obj.userData.item.pivot.position).add(obj.userData.offset);
 }
 for(const obj of nearBones)obj.visible=$('neighbors').checked;
 $('time').value=Math.round(progress*1000);
 $('phase').textContent=progress<.05?'正常形态':progress<.30?'受力阶段':progress<.45?(wedges.length?'椎体开始压缩':'骨折线显现'):progress<1?(wedges.length?'楔形压缩':'骨块移位'):'最终形态';
 $('play').textContent=playing?'Ⅱ 暂停':progress>=1?'↻ 重播':'▶ 播放';
}
function orientation(){
 const d=camera.position.clone().sub(controls.target).normalize();
 const names=[['患者左侧','患者右侧'],['上方','下方'],['前方','后方']];
 const xyz=d.toArray(),major=xyz.map((v,i)=>[Math.abs(v),names[i][v>=0?0:1]]).sort((a,b)=>b[0]-a[0]);
 $('orientation').textContent='视向 · '+major.filter(x=>x[0]>.36).map(x=>x[1]).join(' / ')+'　｜　拖动旋转 · 滚轮缩放';
}
function frame(now){
 if(playing&&course){setProgress(progress+Math.min(.1,(now-previous)/1000)*speed/5);if(progress===1){playing=false;setProgress(1);}}
 previous=now;controls.update();renderer.render(world,camera);requestAnimationFrame(frame);
}
async function start(){
 renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 host.append(renderer.domElement);
 camera=new T.PerspectiveCamera(38,1,.001,30);controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=false;controls.addEventListener('change',orientation);
 world.add(new T.HemisphereLight(0xfff5de,0x72938a,1.8));
 for(const [pos,intensity] of [[[2,3,4],2.1],[[-3,1,-3],1.4]]){const l=new T.DirectionalLight(0xfff3dc,intensity);l.position.set(...pos);world.add(l);}
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
 new ResizeObserver(resize).observe(host);resize();
 const [index,bin]=await Promise.all(['models/index.json','models/bones.bin'].map(async u=>{
  const r=await fetch(u);if(!r.ok)throw Error('无法加载 '+u);return u.endsWith('json')?r.json():r.arrayBuffer();
 }));
 for(const m of index)boneData.set(boneData.has(m.name)?m.name+' '+m.mesh:m.name,materialize(m,bin));
 ready=true;makeCatalog();route();$('status').hidden=true;
 let press;renderer.domElement.onpointerdown=e=>press=[e.clientX,e.clientY];
 renderer.domElement.onpointerup=e=>{
  if(course||!press||Math.hypot(e.clientX-press[0],e.clientY-press[1])>5)return;
  const rect=host.getBoundingClientRect(),ray=new T.Raycaster();
  ray.setFromCamera(new T.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);
  const hit=ray.intersectObjects(group.children)[0];if(!hit)return;
  const name=hit.object.userData.bone;
  const matches=courses.filter(c=>courseBones(c).has(name));
  if(matches.length){
   const ids=matches.map(c=>c.id);let pick=matches[0];
   if(ids.includes('plateau')&&hit.point.y>.411)pick=courses.find(c=>c.id==='plateau');
   if(ids.includes('distalfemur')&&hit.point.y<.54)pick=courses.find(c=>c.id==='distalfemur');
   if(ids.includes('elbow')&&hit.point.y<1.16)pick=courses.find(c=>c.id==='elbow');
   if(ids.includes('neck')&&hit.point.y>.845)pick=courses.find(c=>c.id==='neck');
   if(ids.includes('ankle')&&hit.point.y<.105)pick=courses.find(c=>c.id==='ankle');
   if(ids.includes('forearm')&&hit.point.y>.93)pick=courses.find(c=>c.id==='forearm');
   if(ids.includes('olecranon')&&hit.point.y>1.10)pick=courses.find(c=>c.id==='olecranon');
   choose(pick);
  }else $('bonePick').textContent=name+' · 解剖定位';
 };
 requestAnimationFrame(frame);
}
$('play').onclick=()=>{playing=!playing;setProgress(progress>=1?0:progress);};
$('time').oninput=e=>{playing=false;setProgress(+e.target.value/1000);};
$('speed').onclick=e=>{speed=speed===1?.5:speed===.5?1.5:1;e.target.textContent=speed+'×';};
for(const id of ['guides','neighbors'])$(id).onchange=()=>setProgress(progress);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>aim(b.dataset.view);
$('sourceBtn').onclick=()=>$('sources').showModal();$('close').onclick=()=>$('sources').close();
$('expand').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.querySelector('.stage').requestFullscreen();
window.addEventListener('hashchange',route);
start().catch(err=>{$('status').hidden=false;$('status').textContent='三维视图加载失败，请使用支持 WebGL 的浏览器刷新。'+err.message;console.error(err);});
