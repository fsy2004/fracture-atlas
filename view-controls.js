import * as T from './vendor/three.module.js';

const TAU=2*Math.PI;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// Turn both the sightline and the screen-up vector. A local inspection can pass
// through either pole without losing its vertical gesture or snapping the horizon.
export function turnView(camera,target,dx,dy,height,free){
 if(!height||(!dx&&!dy))return;
 const offset=camera.position.clone().sub(target),rate=TAU/height;
 if(free){
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
  const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const yaw=new T.Quaternion().setFromAxisAngle(up,-dx*rate);
  const pitch=new T.Quaternion().setFromAxisAngle(right,-dy*rate);
  yaw.multiply(pitch);
  offset.applyQuaternion(yaw);camera.up.copy(up.applyQuaternion(yaw)).normalize();
 }else{
  const sphere=new T.Spherical().setFromVector3(offset);
  sphere.theta-=dx*rate;sphere.phi=clamp(sphere.phi-dy*rate,.0001,Math.PI-.0001);
  offset.setFromSpherical(sphere);camera.up.set(0,1,0);
 }
 camera.position.copy(target).add(offset);camera.lookAt(target);
}

export class ViewControls extends T.EventDispatcher{
 constructor(camera,element,isLocal){
  super();this.camera=camera;this.element=element;this.isLocal=isLocal;
  this.target=new T.Vector3();this.minDistance=.0005;this.maxDistance=20;
  this.lastPosition=new T.Vector3(Infinity,0,0);this.lastTarget=new T.Vector3();this.lastUp=new T.Vector3();
  this.pointers=new Map();this.changedGesture=false;
  this.listeners=new AbortController();
  const listen=(node,name,fn,options={})=>node.addEventListener(name,fn,{...options,signal:this.listeners.signal});
  listen(element,'contextmenu',e=>e.preventDefault());
  listen(element,'pointerdown',e=>this.down(e));
  listen(element,'pointermove',e=>this.move(e));
  listen(element,'pointerup',e=>this.end(e,true));
  listen(element,'pointercancel',e=>this.end(e,false));
  listen(element,'lostpointercapture',e=>this.end(e,false));
  listen(element,'wheel',e=>{
   e.preventDefault();this.dispatchEvent({type:'start'});
   this.dispatchEvent({type:'input'});
   const unit=e.deltaMode===1?16:e.deltaMode===2?element.clientHeight:1;
   this.zoom(Math.exp(clamp(e.deltaY*unit*.0015,-1.5,1.5)));this.update();
   this.dispatchEvent({type:'end'});
  },{passive:false});
  listen(element,'keydown',e=>{
   const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
   if(!step)return;e.preventDefault();this.dispatchEvent({type:'start'});
   this.dispatchEvent({type:'input'});
   const d=element.clientHeight/24;
   turnView(camera,this.target,d*step[0],d*step[1],element.clientHeight,this.isLocal());
   this.update();this.dispatchEvent({type:'end'});
  });
  listen(window,'blur',()=>this.cancel());
  listen(document,'visibilitychange',()=>{if(document.hidden)this.cancel();});
 }
 get interacting(){return this.pointers.size>0;}
 update(){
  const {camera,target}=this;
  if(this.lastPosition.equals(camera.position)&&this.lastTarget.equals(target)&&this.lastUp.equals(camera.up))return;
  camera.lookAt(target);this.lastPosition.copy(camera.position);this.lastTarget.copy(target);this.lastUp.copy(camera.up);
  this.dispatchEvent({type:'change'});
 }
 zoom(scale){
  const offset=this.camera.position.clone().sub(this.target),distance=offset.length();
  if(distance)this.camera.position.copy(this.target).addScaledVector(offset,clamp(distance*scale,this.minDistance,this.maxDistance)/distance);
 }
 pan(dx,dy){
  const camera=this.camera,metres=2*camera.position.distanceTo(this.target)*Math.tan(camera.fov*Math.PI/360)/Math.max(1,this.element.clientHeight);
  const shift=new T.Vector3(-dx*metres,dy*metres,0).applyQuaternion(camera.quaternion);
  this.target.add(shift);camera.position.add(shift);
 }
 down(e){
  if(e.button<0||e.button>2)return;
  if(e.pointerType!=='touch'&&this.interacting)this.cancel();
  const mode=e.button===1?'zoom':e.button===2||e.shiftKey||e.ctrlKey||e.metaKey?'pan':'turn';
  if(!this.interacting){this.changedGesture=false;this.dispatchEvent({type:'start'});}
  else this.changedGesture=true;
  this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,mode});
  this.element.focus({preventScroll:true});
  this.element.setPointerCapture(e.pointerId);e.preventDefault();
 }
 move(e){
  const p=this.pointers.get(e.pointerId);if(!p)return;
  if(e.pointerType==='mouse'&&!e.buttons){this.end(e,false);return;}
  if(this.pointers.size===1&&!this.changedGesture&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<4)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(!dx&&!dy)return;
  this.changedGesture=true;this.dispatchEvent({type:'input'});this.dispatchEvent({type:'drag'});
  if(this.pointers.size===2){
   const other=[...this.pointers.values()].find(point=>point!==p);
   const before=Math.hypot(p.x-other.x,p.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);
   if(before>1&&after>1)this.zoom(before/after);
   this.pan(dx/2,dy/2);
  }else if(this.pointers.size===1){
   if(p.mode==='turn')turnView(this.camera,this.target,dx,dy,this.element.clientHeight,this.isLocal());
   else if(p.mode==='pan')this.pan(dx,dy);
   else this.zoom(Math.exp(clamp(dy*.012,-1.5,1.5)));
  }
  p.x=e.clientX;p.y=e.clientY;this.update();e.preventDefault();
 }
 end(e,allowTap){
  const p=this.pointers.get(e.pointerId);if(!p)return;
  const tap=allowTap&&this.pointers.size===1&&p.mode==='turn'&&!this.changedGesture&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<4;
  this.pointers.delete(e.pointerId);
  if(this.element.hasPointerCapture(e.pointerId))this.element.releasePointerCapture(e.pointerId);
  if(!this.interacting){this.dispatchEvent({type:'end'});if(tap)this.dispatchEvent({type:'tap',originalEvent:e});}
 }
 cancel(){
  if(!this.interacting)return;const ids=[...this.pointers.keys()];this.pointers.clear();
  for(const id of ids)if(this.element.hasPointerCapture(id))this.element.releasePointerCapture(id);
  this.changedGesture=true;this.dispatchEvent({type:'end'});
 }
 dispose(){this.cancel();this.listeners.abort();}
}
