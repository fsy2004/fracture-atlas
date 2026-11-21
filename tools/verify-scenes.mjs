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
window.inspectAtlasPose=(steps)=>{
 const states={contact:[],invalid:false},options={checkBones:true,slack:.10,draw:false};
 for(let i=0;i<=steps;i++){
  const t=i/steps;rawPose(t);
  const collision=mechanics.report(t,options,true)?.bone;
  if(collision?.kind==='bone')states.contact.push([i,collision.name]);
  if(animated.some(x=>![...x.pivot.position.toArray(),...x.pivot.quaternion.toArray()].every(Number.isFinite)))states.invalid=true;
 }
 return states;
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
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#meshState[data-ready=true]').waitFor({timeout:90000});
 const report=await page.evaluate(async()=>{
  const [{courses},{regionalCourses},{supplementalCourses},{joints}]=await Promise.all(['courses','regional-courses','supplemental','joints'].map(n=>import('./'+n+'.js')));
  const registry=await (await fetch('./models/index.json')).json(),ids=new Map();
  for(const e of registry)ids.set(ids.has(e.name)?e.name+' '+e.mesh:e.name,e.mesh);
  const result={index:ids.size,fractureRoutes:0,fracturePoses:0,jointRoutes:0,jointPoses:0,issues:[]};
  for(const c of [...courses,...regionalCourses,...supplementalCourses,...joints]){
   const kind=c.kind==='joint'?'joint':'fracture',steps=kind==='joint'?256:128;
   for(const [i,v] of c.variants.entries()){
    const key=v.cuts[0].bone,left=key.replace(/right/i,s=>s==='Right'?'Left':'left').replace('FJ3376','FJ3270');
    for(const bone of new Set([key,left]))for(const level of c.levels?[0,1,2]:[1]){
     const route='#'+c.id+'/'+i+'/'+level+'?at=0&bone='+ids.get(bone);
     history.replaceState(null,'',route);dispatchEvent(new Event('hashchange'));
     const {invalid,contact}=window.inspectAtlasPose(steps);
     result[kind+'Routes']++;result[kind+'Poses']+=steps+1;
     if(invalid||contact.length)result.issues.push({route,bone,invalid,first:contact[0],count:contact.length});
    }
   }
  }
  return result;
 });
 console.log(JSON.stringify({...report,errors},null,2));if(report.issues.length||errors.length)process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));}
