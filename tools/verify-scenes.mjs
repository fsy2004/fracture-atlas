// Optional release check. Requires Playwright and a Chromium installation.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.ATLAS_PLAYWRIGHT||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const probe=`
function vertebralFolds(mesh){
 const geo=mesh.geometry,box=geo.boundingBox,tree=surfaceTree(geo);
 const morph=geo.morphAttributes.position,weights=mesh.morphTargetInfluences;
 const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,1,0));
 const position=geo.attributes.position,aa=new T.Vector3(),bb=new T.Vector3(),cc=new T.Vector3(),bary=new T.Vector3();
 const displacement=(hit)=>{
  const {a,b,c}=hit.face;aa.fromBufferAttribute(position,a);bb.fromBufferAttribute(position,b);cc.fromBufferAttribute(position,c);
  T.Triangle.getBarycoord(hit.point,aa,bb,cc,bary);
  return weights.reduce((sum,w,j)=>sum+w*(bary.x*morph[j].getY(a)+bary.y*morph[j].getY(b)+bary.z*morph[j].getY(c)),0);
 };
 let count=0,largest=0,samples=0;
 for(let i=0;i<31;i++)for(let j=0;j<31;j++){
  ray.origin.set(T.MathUtils.lerp(box.min.x,box.max.x,(i+.43)/31),box.min.y-.025,T.MathUtils.lerp(box.min.z,box.max.z,(j+.72)/31));
  const hits=tree.raycast(ray,T.DoubleSide).sort((a,b)=>a.distance-b.distance);
  for(let k=1;k<hits.length;k++){
   const a=hits[k-1],b=hits[k];if(b.distance-a.distance<.00015)continue;
   const thickness=b.point.y+displacement(b)-(a.point.y+displacement(a));
   samples++;
   if(thickness<-.00012){count++;largest=Math.max(largest,-thickness);}
  }
 }
 return {name:mesh.userData.bone,folds:count,maximumFoldMM:largest*1000,verticalIntervals:samples};
}
window.inspectAtlasPose=async(steps)=>{
 while(loadingSpecimen||!mechanics){
  if(document.getElementById('status').textContent.includes('失败'))throw Error(document.getElementById('status').textContent);
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 const states={contact:[],invalid:false,cutFaces:0,nontrivial:false},options={checkBones:true,slack:.10,draw:false};
 for(const item of animated.filter(i=>i.shell)){
  const face=item.face?.geometry.attributes.position;
  if(!item.shell.geometry.attributes.position.count||!face?.count||face.count<3){states.invalid=true;continue;}
  if(!face.array.every(Number.isFinite))states.invalid=true;
  states.cutFaces++;
 }
 for(let i=0;i<=steps;i++){
  const t=i/steps;rawPose(t);
  const collision=mechanics.report(t,options,true)?.bone;
  if(collision?.kind==='bone')states.contact.push([i,collision.name]);
  if(animated.some(x=>![...x.pivot.position.toArray(),...x.pivot.quaternion.toArray()].every(Number.isFinite)))states.invalid=true;
 }
 const expected=wedges.length>0||animated.some(i=>i.moving||i.jointLabel);
 const moves=animated.some(i=>i.pivot.position.distanceToSquared(i.anchor)>1e-9||Math.abs(i.pivot.quaternion.w)<.999998)
  ||wedges.some(mesh=>mesh.morphTargetInfluences.some(w=>w>.001));
 states.nontrivial=moves;
 const vertebra=wedges.find(mesh=>/vertebra/i.test(mesh.userData.bone||''));
 if(vertebra&&steps>=128){states.vertebral=vertebralFolds(vertebra);if(states.vertebral.folds)states.invalid=true;}
 if(expected&&steps>=128&&!moves)states.invalid=true;
 return {...states,specimen:useSpecimen};
};
window.inspectStop=()=>{
 playing=false;setProgress(1);
 const bone=mechanics.report(progress,{checkBones:true,slack:.1,draw:false},true).bone;
 return {reached:progress,stopped:poseLimit?.reason?.kind==='bone',intersecting:bone?.kind==='bone'};
};`;
const server=http.createServer(async(req,res)=>{
 try{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(404);res.end();return;}
  let data=await readFile(file);if(relative==='app.js')data=Buffer.concat([data,Buffer.from(probe)]);
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.ATLAS_CHROMIUM||undefined,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#viewport[data-ready=true]').waitFor({timeout:90000});
 const report=await page.evaluate(async scope=>{
  const [{courses},{regionalCourses},{supplementalCourses},{joints}]=await Promise.all(['courses','regional-courses','supplemental','joints'].map(n=>import('./'+n+'.js')));
  const registry=await (await fetch('./models/index.json')).json(),ids=new Map();
  for(const e of registry)ids.set(ids.has(e.name)?e.name+' '+e.mesh:e.name,e.mesh);
  const result={index:ids.size,fractureRoutes:0,fracturePoses:0,jointRoutes:0,jointPoses:0,specimenFractureRoutes:0,specimenJointRoutes:0,cutFaces:0,motionRoutes:0,vertebralRoutes:0,vertebralIntervals:0,stationaryVariants:[],issues:[]};
  for(const c of [...courses,...regionalCourses,...supplementalCourses,...joints]){
   if(scope&&scope!==c.id)continue;
   const kind=c.kind==='joint'?'joint':'fracture',steps=kind==='joint'?256:128;
   for(const [i,v] of c.variants.entries()){
    const key=v.cuts[0].bone,left=key.replace(/right/i,s=>s==='Right'?'Left':'left').replace('FJ3376','FJ3270');
    for(const bone of new Set([key,left]))for(const level of c.levels?[0,1,2]:[1]){
     const route='#'+c.id+'/'+i+'/'+level+'?at=0&bone='+ids.get(bone);
     history.replaceState(null,'',route);dispatchEvent(new Event('hashchange'));
     const {invalid,contact,specimen,cutFaces,nontrivial,vertebral}=await window.inspectAtlasPose(steps);
     result.cutFaces+=cutFaces;
     if(nontrivial)result.motionRoutes++;
     else if(!result.stationaryVariants.some(entry=>entry.course===c.id&&entry.variant===i))
      result.stationaryVariants.push({course:c.id,variant:i,title:v.name,deliberate:Boolean(v.fissure||v.cuts.every(cut=>[cut.minus,cut.plus,...(cut.branches||[])].every(pose=>!pose||(!pose.shift.some(Boolean)&&!pose.turn.some(Boolean)))))});
     if(vertebral){result.vertebralRoutes++;result.vertebralIntervals+=vertebral.verticalIntervals;}
     if(specimen)result[kind==='joint'?'specimenJointRoutes':'specimenFractureRoutes']++;
     result[kind+'Routes']++;result[kind+'Poses']+=steps+1;
     if(invalid||contact.length)result.issues.push({route,bone,invalid,first:contact[0],count:contact.length,...(vertebral?{vertebral}: {})});
    }
   }
  }
  if(scope)return {...result,scope};
  result.wedgePoses=0;
  for(const name of ['Right femur','Left femur'])for(const i of [0,1,2]){
   const route='#femur/'+i+'/1?shape=wedgeFragment&at=0&bone='+ids.get(name);
   history.replaceState(null,'',route);dispatchEvent(new Event('hashchange'));
   const x=await window.inspectAtlasPose(160);result.wedgePoses+=161;
   if(x.invalid||x.contact.length)result.issues.push({route,bone:name,invalid:x.invalid,first:x.contact[0],count:x.contact.length});
  }
  result.customStops=[];
  for(const route of ['#hip-dislocation/0/1?at=0&q_travel=18','#radius/0/1?at=0&q_f0_dy=12']){
   history.replaceState(null,'',route);dispatchEvent(new Event('hashchange'));await window.inspectAtlasPose(1);
   const check=window.inspectStop();result.customStops.push({route,...check});
   if(!check.stopped||check.intersecting||check.reached>=1)result.issues.push({route,guard:check});
  }
  result.customMotions=[];
  for(const route of [
   '#tibia/v01/1?at=0&mv=2&shape=shortOblique&move=shorten',
   '#tibia/v02/1?at=0&mv=2&shape=oblique&move=rotate',
   '#femur/v01/1?at=0&mv=2&shape=oblique&move=rotate',
   '#single-forearm/v01/1?at=0&mv=2&shape=oblique&move=rotate',
   '#metacarpal/v04/1?at=0&mv=2&shape=spiral&move=angle',
   '#finger/v02/1?at=0&mv=2&move=rotate'
  ]){
   history.replaceState(null,'',route);dispatchEvent(new Event('hashchange'));await window.inspectAtlasPose(1);
   const check=window.inspectStop();result.customMotions.push({route,...check});
   if(check.stopped||check.intersecting||check.reached<1)result.issues.push({route,custom:check});
  }
  return result;
 },process.argv[2]||null);
 console.log(JSON.stringify({...report,errors},null,2));if(report.issues.length||errors.length)process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
