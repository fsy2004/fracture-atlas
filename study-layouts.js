import * as T from './vendor/three.module.js';

export const desks = {
 plate:{name:'解剖图版',action:'转动看形态'},
 pair:{name:'正交观察室',action:'双向看位移'},
 story:{name:'运动分镜',action:'分帧看过程'}
};
export const deskFromURL = () => {
 const id=new URLSearchParams(location.search).get('desk');
 return Object.hasOwn(desks,id)?id:'plate';
};
const orthos=[new T.OrthographicCamera(),new T.OrthographicCamera()];
const perspective=new T.PerspectiveCamera();
const rect=(x,y,w,h)=>({x,y,w,h});
export function panesFor(desk,w,h){
 const gap=12;
 if(desk==='pair'){
  if(w<440){const a=(h-gap)/2;return [rect(0,0,w,a),rect(0,a+gap,w,h-a-gap)];}
  const a=(w-gap)/2;return [rect(0,0,a,h),rect(a+gap,0,w-a-gap,h)];
 }
 const strip=Math.min(h*.32,204),top=h-strip-gap,half=(w-gap)/2;
 return [rect(0,0,w,top),rect(0,top+gap,half,strip),rect(half+gap,top+gap,w-half-gap,strip)];
}
export function drawDesk({desk,renderer,world,camera,target,host,panels,time,pose,pair,side,endBelow,label,sectionGuide}){
 const w=host.clientWidth,h=host.clientHeight;
 if(!w||!h)return;
 const rects=panesFor(desk,w,h), distance=camera.position.distanceTo(target);
 const height=2*distance*Math.tan(T.MathUtils.degToRad(camera.fov*.5));
 // Auto-clear is clipped to the active pane. Clear the gutter as well on every layout change.
 renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();renderer.setScissorTest(true);
 if(desk==='story')host.style.setProperty('--main-h',rects[0].h+'px');
 const drawOrder=desk==='pair'?[0,1]:[1,2,0];
 for(const i of drawOrder){
  const {x,y,w:pw,h:ph}=rects[i],el=panels[i];
  el.style.left=x+'px';el.style.top=y+'px';el.style.width=pw+'px';el.style.height=ph+'px';
  renderer.setViewport(x,h-y-ph,pw,ph);renderer.setScissor(x,h-y-ph,pw,ph);
  let view;renderer.clippingPlanes=[];
  if(desk==='pair'){
   view=orthos[i];
   const clipped=i===1&&pair==='end'&&sectionGuide;
   const halfHeight=height/2*Math.max(1,.68/(pw/ph))/(clipped?2.5:1),halfWidth=halfHeight*pw/ph;
   Object.assign(view,{left:-halfWidth,right:halfWidth,top:halfHeight,bottom:-halfHeight,near:.001,far:30});
   const dir=i===0?[0,0,1]:pair==='end'?[0,endBelow?-1:1,.0001]:[side,0,0];
   const centre=clipped?sectionGuide.centre:target;
   const direction=clipped?sectionGuide.axis.clone().multiplyScalar(endBelow?-1:1):new T.Vector3(...dir).normalize();
   view.position.copy(centre).addScaledVector(direction,2);
   view.up.set(0,1,0);if(Math.abs(direction.y)>.9)view.up.set(0,0,direction.y>0?-1:1);
   if(clipped){
    const {axis,half}=sectionGuide,offset=axis.dot(centre);
    renderer.clippingPlanes=[new T.Plane(axis.clone(),half-offset),new T.Plane(axis.clone().negate(),half+offset)];
   }
   view.lookAt(centre);view.updateProjectionMatrix();
  }else{
   // Both reference poses use the same direction and framing as the live model.
   const t=i===0?time:i===1?0:1;
   pose(t,i===0);perspective.copy(camera);
   perspective.aspect=pw/ph;perspective.updateProjectionMatrix();view=perspective;
  }
  renderer.render(world,view);
  if(desk==='pair'||i===0)label(el,view,pw,ph);else {
   el.querySelector('span').textContent='';el.querySelector('.components').textContent='';
   for(const overlay of el.querySelectorAll('svg'))overlay.style.display='none';
  }
 }
 renderer.clippingPlanes=[];renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);
}
