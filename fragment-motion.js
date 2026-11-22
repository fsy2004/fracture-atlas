import * as T from './vendor/three.module.js';
import {boneName} from './bone-index.js';

const components=[
 ['dx','右 ← 左右位移 → 左','mm'],['dy','下 ← 上下位移 → 上','mm'],['dz','后 ← 前后位移 → 前','mm'],
 ['rx','绕患者左右轴','°'],['ry','绕患者上下轴','°'],['rz','绕患者前后轴','°']
];
const v=()=>new T.Vector3(),rad=Math.PI/180;
const smooth=(p,a,b)=>T.MathUtils.smoothstep(p,a,b);
export const isFragmentKey=k=>/^f\d{1,2}_(dx|dy|dz|rx|ry|rz)$/.test(k);
export function hasEdits(values){return Object.keys(values).some(k=>isFragmentKey(k)&&values[k]!==0);}
export function clearEdits(values){for(const key of Object.keys(values))if(isFragmentKey(key))delete values[key];}

function transformed(item,point){
 return point.clone().sub(item.anchor).applyQuaternion(item.pivot.quaternion).add(item.pivot.position);
}
function rimData(item){
 const a=item.edge.geometry.attributes.position,points=[],centre=v(),box=new T.Box3();let length=0;
 for(let i=0;i+1<a.count;i+=2){
  const p=v().fromBufferAttribute(a,i),q=v().fromBufferAttribute(a,i+1),len=p.distanceTo(q);
  centre.addScaledVector(p,len*.5).addScaledVector(q,len*.5);length+=len;
  box.expandByPoint(p);box.expandByPoint(q);points.push(p);
 }
 if(!length)return {centre:item.anchor.clone(),limit:3,points:[item.anchor.clone()]};
 const width=Math.max(...box.getSize(v()).toArray());
 return {centre:centre.divideScalar(length),limit:Math.max(3,Math.min(30,Math.round(width*400))),points};
}

// A common rigid correction about the current cut-rim centre preserves wrist and paired-shaft followers.
export function correctGroup(members,centre,values,p,mirror=false){
 const shiftT=smooth(p,.18,.83),turnT=smooth(p,.3,1),sign=mirror?-1:1;
 const shift=new T.Vector3(sign*values.dx,values.dy,values.dz).multiplyScalar(.001*shiftT);
 const turn=new T.Quaternion().setFromEuler(new T.Euler(values.rx*rad*turnT,sign*values.ry*rad*turnT,sign*values.rz*rad*turnT,'ZYX'));
 const origin=transformed(members[0],centre);
 for(const item of members){
  item.pivot.position.sub(origin).applyQuaternion(turn).add(origin).add(shift);
  item.pivot.quaternion.premultiply(turn);
 }
}

export function fragmentEditor({items,values,primary,mirror,world,basePose,onEdit,onSelect,preferred}){
 const groups=[],byItem=new Map(),shells=items.filter(i=>i.shell);
 for(const [id,item] of shells.entries()){
  if(!item.moving)continue;
  let g=item.tuned==='shaft'?groups.find(g=>g.members[0].tuned==='shaft'):null;
  if(!g){
   g={id,members:[],ref:shells.find(other=>other.name===item.name&&other!==item&&!other.moving)||
       shells.find(other=>other.name===item.name&&other!==item),...rimData(item)};
   groups.push(g);
  }
  g.members.push(item);byItem.set(item,g);
 }
 for(const item of items)if(item.follows&&byItem.has(item.follows))byItem.get(item.follows).members.push(item);
 const host=document.getElementById('fragmentRows'),select=document.getElementById('fragmentPick');
 host.replaceChildren();select.replaceChildren();
 for(const k of Object.keys(values)){
  if(!isFragmentKey(k))continue;
  const [id,key]=k.slice(1).split('_'),g=groups.find(x=>x.id===Number(id));
  if(!g||!Number.isFinite(values[k])){delete values[k];continue;}
  const max=key.startsWith('r')?30:g.limit;
  values[k]=T.MathUtils.clamp(values[k],-max,max);
  if(!values[k])delete values[k];
 }
 if(!groups.length)return null;
 let active=groups.find(g=>g.id===preferred)||groups.find(g=>g.members.some(i=>i.name===primary))||groups[0];
 function key(g,k){return 'f'+g.id+'_'+k;}
 function read(g,k){
  const max=k.startsWith('r')?30:g.limit;
  return T.MathUtils.clamp(values[key(g,k)]||0,-max,max);
 }
 function describe(g){
  const item=g.members[0],siblings=shells.filter(i=>i.name===item.name);
  const names=[...new Set(g.members.filter(i=>i.shell).map(i=>boneName(i.name).replace(/^右/,mirror?'左':'右')))];
  item.shell.geometry.computeBoundingBox();
  const dir=item.shell.geometry.boundingBox.getCenter(v()).sub(g.centre),abs=dir.toArray().map(Math.abs);
  const axis=abs.indexOf(Math.max(...abs)),label=dir.getComponent(axis)>0?['内侧','上方','前方'][axis]:['外侧','下方','后方'][axis];
  return names.join('＋')+' · '+label+'块 '+(siblings.indexOf(item)+1);
 }
 for(const g of groups)select.add(new Option(describe(g),g.id,false,g===active));
 function apply(p){
  if(!hasEdits(values))return;
  for(const g of groups){
   const settings=Object.fromEntries(components.map(([k])=>[k,read(g,k)]));
   if(Object.values(settings).some(Boolean))correctGroup(g.members,g.centre,settings,p,mirror);
  }
 }
 const lineGeo=new T.BufferGeometry(),steps=24;
 const coords=new T.BufferAttribute(new Float32Array((steps+1)*3),3);lineGeo.setAttribute('position',coords);
 const path=new T.Line(lineGeo,new T.LineDashedMaterial({color:0x87412d,dashSize:.0014,gapSize:.0008,depthTest:false}));
 path.frustumCulled=false;path.renderOrder=8;
 const radius=T.MathUtils.clamp(active.limit*.00012,.00065,.0017);
 const markers=[0x26786b,0xa95029].map(color=>new T.Mesh(new T.SphereGeometry(radius,12,8),new T.MeshBasicMaterial({color,depthTest:false})));
 markers.forEach(m=>m.renderOrder=9);const trace=new T.Group();trace.add(path,...markers);world.add(trace);
 let point=active.centre.clone(),isMoving=false;
 const focus={centre:v(),delta:v(),size:.06};
 function sample(){
  basePose(1,false);apply(1);
  const item=active.members[0],ref=active.ref;
  let distance=-1;
  for(const candidate of active.points){
   const target=transformed(item,candidate),other=ref?transformed(ref,candidate):candidate;
   const d=target.distanceToSquared(other);
   if(d>distance){distance=d;point=candidate;}
  }
  isMoving=distance>1e-10;
  const end=transformed(item,point),other=ref?transformed(ref,point):point;
  focus.centre.copy(end).lerp(other,.5);focus.delta.copy(end).sub(other);
  const box=active.members[0].shell.geometry.boundingBox;
  focus.size=Math.max(.026,Math.min(.11,box.getSize(v()).length()*1.15),active.limit*.0055,focus.delta.length()*5);

  for(let j=0;j<=steps;j++){
   basePose(j/steps,false);apply(j/steps);
   const pt=transformed(item,point);coords.setXYZ(j,pt.x,pt.y,pt.z);
  }
  coords.needsUpdate=true;path.computeLineDistances();
 }
 function display(p,show){
  const target=transformed(active.members[0],point),other=active.ref?transformed(active.ref,point):point;
  lineGeo.setDrawRange(0,Math.floor(p*steps)+1);trace.visible=show&&isMoving&&p>.08;
  markers[0].position.copy(point);markers[1].position.copy(target);
  return {target,distance:target.distanceTo(other)*1000,travel:target.distanceTo(point)*1000};
 }
 function fields(){
  host.replaceChildren();
  for(const [k,label,unit] of components){
   const row=document.createElement('div'),caption=document.createElement('span'),box=document.createElement('span'),number=document.createElement('input'),input=document.createElement('input');
   const max=unit==='°'?30:active.limit;row.className='measure-row';caption.textContent=label;
   for(const [control,type] of [[input,'range'],[number,'number']]){
    Object.assign(control,{type,min:-max,max,step:.1,value:read(active,k)});
    control.setAttribute('aria-label',label+(type==='number'?' 数值':''));
   }
   input.dataset.fine=k;number.dataset.fineNumber=k;
   function change(n){
    if(!Number.isFinite(n))n=read(active,k);
    n=Math.round(T.MathUtils.clamp(n,-max,max)*10)/10;
    const id=key(active,k);if(n)values[id]=n;else delete values[id];
    input.value=n;number.value=n;sample();onEdit();
   }
   input.oninput=()=>change(input.valueAsNumber);number.onchange=()=>change(number.valueAsNumber);
   box.className='amount';box.append(number,' '+unit);row.append(caption,box,input);host.append(row);
  }
 }
 select.onchange=()=>{active=groups.find(g=>g.id===Number(select.value));fields();sample();onSelect(active);};
 document.getElementById('restoreFragment').onclick=()=>{clearEdits(values);fields();sample();onEdit();};
 fields();sample();
 return {apply,display,sample,focus,get active(){return active;},count:groups.length,dispose(){
  select.onchange=null;document.getElementById('restoreFragment').onclick=null;world.remove(trace);trace.traverse(m=>{m.geometry?.dispose();m.material?.dispose();});
 }};
}
