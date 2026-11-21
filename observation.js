import * as T from './vendor/three.module.js';
import {landmark} from './detail.js';
import {atLevel} from './geometry.js';
import {surfaceTree} from './surface-lessons.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const fixedInk=new T.LineBasicMaterial({color:0x24796c,depthTest:false});
const mobileInk=new T.LineBasicMaterial({color:0xaa452a,depthTest:false});
const measureInk=new T.LineBasicMaterial({color:0x484c3b,depthTest:false});
const facetMaterial=new T.MeshBasicMaterial({color:0x429c91,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
const jointLabels={
 'shoulder-dislocation':'肱骨头','elbow-dislocation':'尺桡骨近端','hip-dislocation':'股骨头','tmj-dislocation':'下颌骨',
 'lunate-dislocation':'月骨','mcp-dislocation':'拇指近节基底','pip-dislocation':'示指中节基底','knee-dislocation':'胫骨平台',
 'patella-dislocation':'髌骨','lisfranc-dislocation':'跖骨基底','mtp-dislocation':'拇趾近节基底','toe-ip-dislocation':'拇趾末节基底'
};
const faceRegions={
 radius:['Right radius',1,-1,.064,[0,-1,0],'桡腕关节面'],
 plateau:['Right tibia',1,1,.057,[0,1,0],'胫骨平台'],
 distalfemur:['Right femur',1,-1,.095,[0,-1,0],'股骨髁关节面'],
 intercondylar:['Right femur',1,-1,.095,[0,-1,0],'股骨髁关节面'],
 ankle:['Right tibia',1,-1,.07,[0,-1,0],'胫骨下关节面'],
 'radial-head':['Right radius',1,1,.06,[0,1,0],'桡骨头上关节面']
};

// In a healthy pose, proximity and-facing tests identify a local opposed bony surface.

const opposingFaces={
 calcaneus:['Right calcaneus','Right talus','距跟相对骨面',.0045],
 patella:['Right patella','Right femur','髌股相对骨面',.005],
 olecranon:['Right ulna','Right humerus','肱尺相对骨面',.004],
 scaphoid:['Right scaphoid','Right radius','桡舟相对骨面',.0035],
 talus:['Right talus','Right calcaneus','距跟相对骨面',.0045],
 'lateral-elbow':['Right humerus','Right radius','肱桡相对骨面',.004],
 'region-trapezium':['Right trapezium','Right first metacarpal bone','第一腕掌相对骨面',.003],
 'region-trapezoid':['Right trapezoid','Right second metacarpal bone','第二腕掌相对骨面',.003],
 'region-capitate':['Right capitate','Right lunate','头月相对骨面',.003],
 'region-lunate':['Right lunate','Right capitate','月头相对骨面',.003],
 'region-pisiform':['Right pisiform','Right triquetral','豆三角相对骨面',.003],
 'region-navicular':['Navicular bone of right foot','Right talus','距舟相对骨面',.004],
 'region-cuboid':['Right cuboid bone','Right calcaneus','跟骰相对骨面',.004]
};
function opposedRule(id,lookup){
 const def=opposingFaces[id];if(!def||!lookup)return null;
 const [target,other,label,distance]=def,g=lookup(other);if(!g)return null;
 const tree=surfaceTree(g);
 const bounds=g.boundingBox.clone().expandByScalar(distance),query={point:V()},delta=V();
 function inside(pt,normal){
  if(!bounds.containsPoint(pt))return false;
  const hit=tree.closestPointToPoint(pt,query,0,distance);
  if(!hit||hit.distance>distance)return false;
  delta.subVectors(hit.point,pt);
  return delta.dot(normal)>=-.0003;
 }
 return [target,0,0,0,[0,1,0],label,inside];
}

// Surface masks are study regions defined on the registered mesh, not cartilage segmentations.
function patchFor(item,rule,extent){
 const [name,axis,end,band,direction]=rule;
 if(item.name!==name||!item.shell)return null;
 const p=item.shell.geometry.attributes.position,n=item.shell.geometry.attributes.normal;
 const from=end>0?extent.max.getComponent(axis):extent.min.getComponent(axis);
 const limit=extent.getSize(V()).getComponent(axis)*band;
 const boundary=new Set(),edge=item.edge?.geometry.attributes.position;
 const key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*1e6)).join(',');
 for(let k=0;edge&&k<edge.count;k++)boundary.add(key(edge.getX(k),edge.getY(k),edge.getZ(k)));
 const matches=new Map(),hits=[],mask=[],centre=V(),normal=V(),dir=V(...direction);
 for(let k=0;k<p.count;k+=3){
  centre.set(0,0,0);normal.set(0,0,0);
  for(let j=0;j<3;j++){centre.add(V().fromBufferAttribute(p,k+j));normal.add(V().fromBufferAttribute(n,k+j));}
  centre.divideScalar(3);
  normal.normalize();
  if(rule[6]?!rule[6](centre,normal):(Math.abs(centre.getComponent(axis)-from)>limit||normal.dot(dir)<.55))continue;
  for(let j=0;j<3;j++){
   const pt=V().fromBufferAttribute(p,k+j);mask.push(pt.x,pt.y,pt.z);
   const id=key(pt.x,pt.y,pt.z);
   if(boundary.has(id)){hits.push(pt);matches.set(id,{point:pt,normal:V().fromBufferAttribute(n,k+j).normalize()});}
  }
 }
 if(!mask.length)return null;
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(mask,3));
 const mesh=new T.Mesh(geo,facetMaterial);mesh.position.copy(item.shell.position);mesh.userData.dispose=true;
 item.pivot.add(mesh);mesh.visible=false;
 const intersects=hits.length>1&&hits.some(pt=>pt.distanceTo(hits[0])>.001);
 return {mesh,item,matches,point:V(...mask.slice(0,3)),hit:intersects?hits[Math.floor(hits.length/2)]:null};
}

function sharedFacetPoint(patches,tracked){
 const candidates=patches.filter(p=>p.hit).sort((a,b)=>Number(b.item===tracked)-Number(a.item===tracked));
 for(const target of candidates)for(const ref of candidates){
  if(ref===target)continue;
  const points=[...ref.matches].filter(([key])=>target.matches.has(key)).map(([,p])=>p);
  if(points.length<2||!points.some(p=>p.point.distanceTo(points[0].point)>.001))continue;
  const mid=points.reduce((sum,p)=>sum.add(p.point),V()).divideScalar(points.length);
  points.sort((a,b)=>a.point.distanceToSquared(mid)-b.point.distanceToSquared(mid));
  return {target:target.item,ref:ref.item,...points[0]};
 }
 return null;
}
function nearest(g,xyz){
 const p=g.attributes.position,mark=landmark(g,xyz),out=V();let best=Infinity;
 for(let i=0;i<p.count;i++){const a=V().fromBufferAttribute(p,i),d=a.distanceToSquared(mark);if(d<best){out.copy(a);best=d;}}
 return out;
}
export function wristLandmarks(g){
 const dorsal=nearest(g,[-.2586,.8872,.0103]),volar=nearest(g,[-.2562,.8925,.0264]);
 const axis=V(...atLevel(g,1,.42)).sub(V(...atLevel(g,1,.17))).normalize();
 const rim=volar.clone().sub(dorsal);
 const palmar=T.MathUtils.radToDeg(Math.atan2(rim.y,rim.z)-Math.atan2(-axis.z,axis.y));
 return {dorsal,volar,axis,palmar};
}

export function makeObservation({course,variant,source,geometry,anchor,parts,group,context,joint,frame,tracked,lookupGeometry}){
 const items=parts.filter(i=>i.shell&&i.name===source.bone);
 const moving=tracked||(joint?parts[0]:items.find(i=>i.moving)||items[0]);
 if(!moving)return null;
 const reference=items.find(i=>i!==moving&&!i.moving)||items.find(i=>i!==moving);
 const modeGroup=new T.Group(),facetLines=new T.Group();group.add(modeGroup,facetLines);
 function line(material,count,parent=modeGroup){
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
  const object=new T.Line(geo,material);object.renderOrder=6;object.frustumCulled=false;object.userData.dispose=true;parent.add(object);
  return points=>{const attr=geo.attributes.position;points.forEach((v,i)=>attr.setXYZ(i,v.x,v.y,v.z));attr.needsUpdate=true;object.visible=points.length>0;};
 }
 const baseline=line(fixedInk,2),motionAxis=line(mobileInk,2),delta=line(measureInk,2),parallel=line(fixedInk,2),arc=line(mobileInk,17);
 const boneSpan=geometry.boundingBox.getSize(V()).length(),length=Math.max(.006,Math.min(.065,boneSpan*.25));
 const along=frame?.axis.clone()||(source.axis!==undefined?V(...atLevel(geometry,source.axis,.62)).sub(V(...atLevel(geometry,source.axis,.38))).normalize():V(0,1,0));
 const spoke=V(1,0,0);if(Math.abs(along.x)>.85)spoke.set(0,0,1);spoke.addScaledVector(along,-spoke.dot(along)).normalize();
 const rule=faceRegions[course.id]||opposedRule(course.id,lookupGeometry);
 const patches=rule?items.map(i=>patchFor(i,rule,geometry.boundingBox)).filter(Boolean):[];
 const pair=sharedFacetPoint(patches,moving);
 const stepLine=line(mobileInk,2,facetLines),slipLine=line(fixedInk,2,facetLines);
 const measurements=()=>{
  if(!pair)return null;
  const a=posed(pair.ref,pair.point),b=posed(pair.target,pair.point),delta=b.clone().sub(a);
  const n=pair.normal.clone().applyQuaternion(pair.ref.pivot.quaternion);
  const joint=a.clone().addScaledVector(n,n.dot(delta));
  return {a,b,joint,height:a.distanceTo(joint)*1000,slip:b.distanceTo(joint)*1000};
 };
 const guide=Boolean(joint&&frame)||source.axis!==undefined&&['tibia','humerus','femur','forearm','single-forearm','finger','toes','metacarpal','metatarsal','radius','distalfemur','elbow'].includes(course.family||course.id);
 function posed(item,p){return item?p.clone().sub(item.anchor).applyQuaternion(item.pivot.quaternion).add(item.pivot.position):p.clone();}
 function endpoint(item,rest,length){return posed(item,anchor.clone().addScaledVector(rest,length));}
 const tags=[];
 const label=(text,point)=>tags.push({text,point:point.clone()});
 const cutPoints=moving.edge?.geometry.attributes.position;
 const cutPt=cutPoints?.count?V().fromBufferAttribute(cutPoints,Math.floor(cutPoints.count*.45)):anchor;
 const rim=course.id==='radius'&&variant<2?wristLandmarks(geometry):null;
 const fixedRim=line(fixedInk,2),movedRim=line(mobileInk,2);
 let fragmentIndex=Math.max(0,items.indexOf(moving));
 return {measurements,dispose(){
   for(const root of [modeGroup,facetLines]){group.remove(root);root.traverse(o=>{if(o.userData.dispose)o.geometry.dispose();});}
   for(const p of patches){p.mesh.removeFromParent();p.mesh.geometry.dispose();}
  },axisGuide:()=>guide?{
   axis:along.clone(),rest:spoke.clone().applyQuaternion(reference?.pivot.quaternion||new T.Quaternion()),
   moved:spoke.clone().applyQuaternion(moving.pivot.quaternion),origin:posed(moving,anchor)
  }:null,referencePoints:()=>[posed(reference,anchor),posed(moving,anchor)],fragment:()=>String(fragmentIndex+1)+' / '+items.length,advance:()=>{fragmentIndex=(fragmentIndex+1)%items.length;},
  patch:patches.length>0,crosses:patches.some(p=>p.hit),cut:items.length>1,guide, tags,
  update(mode,p,showOthers){
   for(const m of context)m.visible=showOthers&&mode!=='cut'&&mode!=='facet';
   tags.length=0;
   for(const item of parts){
    if(item.shell)item.pivot.visible=mode!=='cut'||item===items[fragmentIndex];
   }
   for(const patch of patches)patch.mesh.visible=mode==='facet';
   modeGroup.visible=mode==='motion';facetLines.visible=mode==='facet'&&Boolean(pair);
   if(mode==='cut'){
    const part=items[fragmentIndex],edges=part.edge.geometry.attributes.position;
    if(edges.count)label('断面边缘',posed(part,V().fromBufferAttribute(edges,Math.floor(edges.count*.45))));
    return;
   }
   if(mode==='facet'){
    if(patches.length){const patch=patches[0];label(rule[5],posed(patch.item,patch.point));}
    const intersection=patches.find(p=>p.hit);
    const m=measurements();
    if(m){
     stepLine([m.a,m.joint]);slipLine([m.joint,m.b]);
     label('局部高差 '+m.height.toFixed(1)+' mm · 面内错位 '+m.slip.toFixed(1)+' mm',m.b);
    }else if(intersection)label('断线进入标示区',posed(intersection.item,intersection.hit));
    else label('骨折线',posed(moving,cutPt));return;
   }
   if(mode==='overview'){
    if(p>.42)label(joint?(jointLabels[course.id]||'活动骨端'):'骨折块',posed(moving,cutPt));
    return;
   }
   const from=posed(reference,anchor),to=posed(moving,anchor);
   delta([from,to]);
   const gap=from.distanceTo(to)*1000;
   if(gap>.25)label((joint?'移出 ':'参考点位移 ')+gap.toFixed(1)+' mm',from.clone().lerp(to,.5));
   else label(joint?'关节原位':'参照点',from);
   const before=reference?.pivot.quaternion||new T.Quaternion(),after=moving.pivot.quaternion;
   const dir0=along.clone().applyQuaternion(before),dir1=along.clone().applyQuaternion(after);
   baseline(guide?[from.clone().addScaledVector(dir0,-length),from.clone().addScaledVector(dir0,length)]:[]);
   motionAxis(guide?[to.clone().addScaledVector(dir1,-length),to.clone().addScaledVector(dir1,length)]:[]);
   const a=dir0.angleTo(dir1);
   const cross=V().crossVectors(dir0,dir1);
   parallel(guide&&a>.01?[to,to.clone().addScaledVector(dir0,length*.62)]:[]);
   if(guide&&a>.025&&!rim)label('轴线成角 '+T.MathUtils.radToDeg(a).toFixed(1)+'°',to.clone().addScaledVector(dir1,length*.61));
   if(guide&&!rim){
    const rel=before.clone().invert().multiply(after);
    const twist=2*Math.atan2(Math.abs(V(rel.x,rel.y,rel.z).dot(along)),Math.abs(rel.w));
    if(twist>.04)label('轴向旋转 '+T.MathUtils.radToDeg(twist).toFixed(1)+'°',endpoint(moving,spoke,length*.68));
   }
   arc(guide&&cross.lengthSq()>1e-10?Array.from({length:17},(_,k)=>to.clone().addScaledVector(dir0.clone().applyAxisAngle(cross.clone().normalize(),a*k/16),length*.60)):[]);
   if(rim){
    const dorsal=posed(moving,rim.dorsal),volar=posed(moving,rim.volar),ray=volar.clone().sub(dorsal);
    fixedRim([rim.dorsal,rim.volar]);movedRim([dorsal,volar]);
    const tilt=T.MathUtils.radToDeg(Math.atan2(ray.y,ray.z)-Math.atan2(-rim.axis.z,rim.axis.y));
    label((tilt>0?'掌倾 ':'背倾 ')+Math.abs(tilt).toFixed(1)+'°',volar);
   }else if(guide){
    fixedRim([from,endpoint(reference,spoke,length*.68)]);movedRim([to,endpoint(moving,spoke,length*.68)]);
   }else{fixedRim([]);movedRim([]);}
  }
 };
}
