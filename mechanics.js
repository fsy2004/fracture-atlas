import * as T from './vendor/three.module.js';
import {contactBody,makeContactSet} from './contact.js';
import {warmContactTrees} from './contact-preparation.js';
import {sweepTimes} from './injury-timing.js';
import {boneName} from './bone-index.js';

// Approximate footprint seeds on the adult male atlas (mm; X left, Y superior, Z anterior).
// Snap to the nearest available original bone surface. The drawn line represents a fibre bundle.
export const bands=[
 ['喙肱韧带','Right scapula',[-142,1334,-6],'Right humerus',[-180,1335,-15],'shoulder'],
 ['盂肱下韧带前束','Right scapula',[-150,1319,-21],'Right humerus',[-155,1310,-12],'shoulder'],
 ['肘尺侧副韧带前束','Right humerus',[-179,1065,-34],'Right ulna',[-201,1041,-35],'elbow'],
 ['髂股韧带前束','Right hip bone',[-91,851,27],'Right femur',[-101,798,0],'hip'],
 ['坐股韧带后束','Right hip bone',[-73,813,-34],'Right femur',[-107,818,-30],'hip'],
 ['距腓前韧带','Right fibula',[-115,53,-40],'Right talus',[-91,57,-22],'ankle'],
 ['跟腓韧带','Right fibula',[-115,52,-47],'Right calcaneus',[-100,28,-68],'ankle'],
];
function anchor(bodies,name,xyz){
 const seed=new T.Vector3(...xyz).multiplyScalar(.001),pt=new T.Vector3();
 let closest=Infinity,result=null;
 for(const body of bodies.filter(b=>b.key===name)){
  const p=body.mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){pt.fromBufferAttribute(p,i);const d=pt.distanceToSquared(seed);
   if(d<closest){closest=d;result={mesh:body.mesh,point:pt.clone()};}
  }
 }return result;
}
function family(c){
 if(c.id==='ankle')return 'ankle';
 if(['hip-dislocation','neck','trochanter'].includes(c.id))return 'hip';
 if(['shoulder','shoulder-dislocation','scapula'].includes(c.id))return 'shoulder';
 if(['elbow','elbow-dislocation','lateral-elbow','medial-elbow','radial-head','olecranon','monteggia'].includes(c.id))return 'elbow';
 return '';
}
export function cableRatio(a,b,rest){return rest>1e-6?a.distanceTo(b)/rest:1;}
export function buildMechanics({group,world,items,wedges,nearBones,course,variant,ghostMaterial,mirror,pose,timing,bandLandmarks=true}){
 const toLabel=name=>boneName(name).replace(/^右/,mirror?'左':'右');
 const targets=new Set(variant.cuts.map(s=>s.bone)),scope=new Set([...targets,...(variant.fixed||[]),...(variant.context||course.context||[])]);
 if(course.id==='ankle')for(const n of ['Right talus','Right calcaneus'])scope.add(n);
 const bodies=[],shells=new Set();
 pose(0);group.updateWorldMatrix(true,true);
 for(const i of items.filter(i=>i.shell)){
  const b=contactBody(i.shell,i.face,toLabel(i.name)+'块'+(items.filter(j=>j.name===i.name).indexOf(i)+1));b.key=i.name;b.active=true;bodies.push(b);shells.add(i.shell);
 }
 for(const mesh of nearBones)if(mesh.userData.bone)scope.add(mesh.userData.bone);
 group.traverse(o=>{
  if(!o.isMesh||!scope.has(o.userData.bone)||o.material===ghostMaterial||shells.has(o))return;
  const key=o.userData.bone,b=contactBody(o,null,toLabel(key));b.key=key;b.active=targets.has(key)||nearBones.includes(o);
  bodies.push(b);
 });
 const set=makeContactSet(bodies),cancelWarmup=set.count?warmContactTrees(bodies):()=>{},helpers=new T.Group();world.add(helpers);
 const marker=new T.Mesh(new T.SphereGeometry(.0018,12,8),new T.MeshBasicMaterial({color:0xe64332,depthTest:false}));
 marker.renderOrder=16;helpers.add(marker);marker.visible=false;
 const ties=[];
 for(const [name,boneA,seedA,boneB,seedB,region] of bands){
  if(!bandLandmarks||region!==family(course))continue;
  const a=anchor(bodies,boneA,seedA),b=anchor(bodies,boneB,seedB);if(!a||!b)continue;
  const A=a.mesh.localToWorld(a.point.clone()),B=b.mesh.localToWorld(b.point.clone());
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(6),3));
  const line=new T.Line(geometry,new T.LineBasicMaterial({color:0x2e96c1,depthTest:false}));line.frustumCulled=false;line.renderOrder=13;helpers.add(line);
  ties.push({name,a,b,A,B,rest:A.distanceTo(B),line});
 }
 function evaluate(opts,draw){
  group.updateWorldMatrix(true,true);
  let lig=null,most=null;
  for(const tie of ties){
   tie.A.copy(tie.a.point).applyMatrix4(tie.a.mesh.matrixWorld);
   tie.B.copy(tie.b.point).applyMatrix4(tie.b.mesh.matrixWorld);
   const ratio=cableRatio(tie.A,tie.B,tie.rest);
   if(!most||most.ratio<ratio)most={name:tie.name,ratio};
   const taut=tie.A.distanceTo(tie.B)>tie.rest*(1+opts.slack)+.0001;
   if(taut&&!lig)lig={kind:'band',name:tie.name};
   if(draw){
    const att=tie.line.geometry.attributes.position;att.setXYZ(0,...tie.A.toArray());att.setXYZ(1,...tie.B.toArray());att.needsUpdate=true;
    tie.line.visible=opts.draw;tie.line.material.color.setHex(taut?0xe39e39:0x228dae);
   }
  }
  const bone=opts.checkBones?set.check():null;
  if(draw){
   marker.visible=!!bone&&opts.draw;if(bone)marker.position.copy(bone.point);
  }
  return {bone,lig,most};
 }
 let limit=null,pending=null,swept=0,lastTime=-1,lastKey='',lastReport=-1,lastDraw=0,cached=null;
 return {bodies:bodies.length,candidateCount:set.count,ties:ties.map(t=>t.name),
  limit(requested,opts,key,budgetMs=Infinity){
   if(!opts.limitBones&&!(opts.hold&&ties.length)){pending=null;return {time:requested,reason:null};}
   if(lastKey!==key){limit=null;pending=null;swept=0;lastTime=-1;lastKey=key;}
   const probe=t=>{
    pose(t);const e=evaluate({...opts,checkBones:opts.limitBones},false);
    return (opts.limitBones&&e.bone?.kind==='bone'?e.bone:null)||(opts.hold?e.lig:null);
   };
   if(pending&&requested!==pending.target)pending=null;
   if(limit&&requested>=limit.time){
    if(requested>limit.time)limit.target=requested;
    return limit;
   }
   if(pending||(requested!==lastTime&&requested>0)){
    // Resume the same ordered probes (including contact refinement) on a later
    // playback frame. A different request or parameter change discards this work.
    if(!pending){
     const safe=requested>swept?swept:Math.max(0,requested-1/128);
     pending={target:requested,safe,times:sweepTimes(safe,requested,timing),cursor:0,refine:0,hi:0,reason:null};
    }
    const state=pending,deadline=Number.isFinite(budgetMs)?performance.now()+Math.max(0,budgetMs):Infinity;
    while(state.cursor<state.times.length||state.refine){
     if(state.refine){
      const mid=(state.safe+state.hi)/2;
      if(probe(mid))state.hi=mid;else state.safe=mid;
      if(--state.refine===0){limit={time:state.safe,target:state.target,reason:state.reason};lastTime=state.safe;pending=null;return limit;}
     }else{
      const t=state.times[state.cursor++],reason=probe(t);
      if(reason){
       if(probe(state.safe))state.safe=0;
       state.hi=t;state.reason=reason;state.refine=12;
      }else state.safe=t;
     }
     if((state.cursor<state.times.length||state.refine)&&performance.now()>=deadline){
      // Only the most recently verified pose may be displayed during preparation.
      lastTime=state.safe;swept=Math.max(swept,state.safe);
      return {time:state.safe,reason:null,unfinished:true,target:requested};
     }
    }
    pending=null;swept=Math.max(swept,requested);lastTime=requested;
   }
   return {time:requested,reason:null};
  },
  report(p,opts,force){
   helpers.visible=opts.draw;
   // During playback refresh expensive geometry queries at a bounded rate; stopped poses are exact.
   if(force||!cached||Math.abs(p-lastReport)>.14||performance.now()-lastDraw>200){
    cached=evaluate(opts,true);lastReport=p;lastDraw=performance.now();
   }
   return cached;
  },
  showStop(point){if(point){helpers.visible=true;marker.visible=true;marker.position.copy(point);}},
  hide(){helpers.visible=false;},
  dispose(){cancelWarmup();helpers.removeFromParent();helpers.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 };
}
