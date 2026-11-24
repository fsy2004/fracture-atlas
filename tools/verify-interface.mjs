// Browser acceptance for the desktop and touch controls. Run against a local server,
// the published site, or a standalone file URL using the same Playwright setup as verify-scenes.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.ATLAS_PLAYWRIGHT||'playwright');
const base=process.argv[2];
if(!base)throw Error('Supply the atlas URL (including its final slash) or standalone file URL.');
const browser=await chromium.launch({executablePath:process.env.ATLAS_CHROMIUM||undefined,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const errors=[];
 async function viewport(options){
  const context=await browser.newContext({...options,offline:base.startsWith('file:')});
  const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',err=>errors.push(err.message));
  page.on('console',message=>{
   if(message.type()==='error'&&/THREE\.WebGLProgram|VALIDATE_STATUS/.test(message.text()))errors.push(message.text());
  });
  return page;
 }
 async function ready(page){
  await page.waitForFunction(()=>document.querySelector('#viewport').dataset.ready==='true'&&document.querySelector('#status').hidden);
 }
 async function checkExam(page,expected){
  const panel=page.locator('aside #examPoints');
  assert.ok(await panel.isVisible());
  assert.equal(await panel.locator('h3').innerText(),'考点');
  assert.match(await panel.locator('#examCase').textContent(),expected);
  const lines=await panel.locator('li').allTextContents();
  assert.ok(lines.length>=2&&lines.length<=3);
  assert.ok(lines.every(line=>line.trim()&&!/教材|参考资料/.test(line)));
  assert.equal(await page.locator('.stage #examPoints,#clinicalNotes,#knowledgeCard,#preciseOnly,#meshState').count(),0);
  assert.doesNotMatch(await page.locator('main').innerText(),/VHM|补充标本|原始区域标本|[0-9,]+ 面[（\s]|分型鉴别与牵拉|教材对照|教材要点/);
 }
 async function cameraState(page){
  await page.locator('#copyLink').click();
  const params=new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  return ['cam','up'].map(key=>params.get(key).split(',').map(Number));
 }
 const page=await viewport({viewport:{width:1360,height:850}});
 await page.goto(base+'#tibia/1/2?mv=2&move=shorten,rotate&at=1000');
 await page.waitForFunction(()=>document.querySelector('#viewport').dataset.ready==='true'&&document.querySelector('#status').hidden);
 await checkExam(page,/胫/);
 await page.locator('#end').click();
 assert.equal(await page.locator('#time').inputValue(),'1000');
 assert.equal(await page.locator('input[type=range]:visible').count(),1);
 assert.equal(await page.locator('#motionReadout').count(),0);
 assert.match(await page.locator('#liveValues').textContent(),/缩短/);
 await page.locator('#advanced > summary').click();
 assert.ok(await page.locator('#quantRows input:visible').count()>0);
 await page.locator('#fragmentBox > summary').click();await page.locator('[data-fine]').first().waitFor();assert.equal(await page.locator('[data-fine]:visible').count(),6);
 await page.locator('#advanced > summary').click();await page.locator('#normal').click();
 assert.equal(await page.locator('#time').inputValue(),'0');
 await page.locator('#advanced > summary').click();await page.locator('#viewOptions > summary').click();await page.locator('#nextFrame').click();
 assert.ok(Number(await page.locator('#time').inputValue())>0);
 await page.locator('#captureFrame').click();await page.locator('#frameStrip img').first().waitFor();
 await page.goto(base+'#skeleton');await ready(page);
 assert.equal(await page.locator('#examPoints').isVisible(),false);
 assert.equal(await page.locator('#indexPanel [data-bone]').count(),201);
 assert.equal(await page.locator('#indexPanel .bone-family').count(),4);
 assert.equal(await page.locator('#launchpad').count(),0);
 assert.ok(await page.locator('#priorityList .priority-star').count()>0);
 await page.locator('#viewRail [data-view=rear]').click();
 assert.equal(await page.locator('#dirTR').innerText(),'患者右侧');
 await page.locator('#viewRail [data-view=home]').click();
 assert.equal(await page.locator('#dirTR').innerText(),'患者左侧');
 assert.equal(await page.locator('#dirTL').innerText(),'上方');
 assert.equal(await page.locator('#dirBR').innerText(),'下方');
 await page.getByRole('button',{name:'上面观',exact:true}).click();
 assert.equal(await page.locator('[data-view=top]').getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'下面观',exact:true}).click();
 assert.equal(await page.locator('[data-view=inferior]').getAttribute('aria-pressed'),'true');
 await page.locator('#viewRail [data-view=home]').click();
 await page.locator('#search').fill('腭骨');await page.locator('[data-bone="Left palatine bone"]').click();await ready(page);
 assert.ok(await page.locator('#viewport').getAttribute('data-specimen')==='true');
 await page.locator('#advanced > summary').click();await page.locator('#viewOptions > summary').click();await page.locator('#anatomyExtent').selectOption('region');await ready(page);
 assert.match(await page.locator('#heading').innerText(),/硬腭/);
 await page.locator('#anatomyExtent').selectOption('bone');await ready(page);
 assert.match(await page.locator('#heading').innerText(),/左腭骨/);
 await page.locator('#whole').click();await ready(page);await page.locator('#search').fill('');
 await page.locator('[data-bone="Right femur"]').click();await ready(page);
 assert.equal(await page.locator('#examPoints').isVisible(),false);
 await page.locator('#anatomyPanel summary').click();
 assert.match(await page.locator('#anatomyMarks').innerText(),/大转子/);
 await page.waitForFunction(()=>document.querySelector('#markLayer').textContent.includes('股骨头区'));
 await page.locator('#anatomyPanel summary').click();
 // Copying an inverted anatomy view must round-trip through an ordinary shared URL.
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true}));
 const area=await page.locator('#viewport').boundingBox(),x=area.x+area.width*.55,y=area.y+area.height*.2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+area.height*.44,{steps:12});await page.mouse.up();
 const [pose,up]=await cameraState(page),link=page.url();
 assert.ok(up[1]<-.55,'rotation crossed the top of the selected bone');
 await page.locator('#viewport').focus();await page.keyboard.press('ArrowLeft');
 const [turned]=await cameraState(page);assert.notDeepEqual(turned,pose);
 await page.goto(link);await ready(page);
 const [restored,restoredUp]=await cameraState(page);
 for(const [observed,expected] of [[restored,pose],[restoredUp,up]])
  assert.ok(observed.every((v,i)=>Math.abs(v-expected[i])<.000005),'shared camera and up vector are restored');
 await page.goto(base+'#elbow-dislocation/0/1?at=1000');await ready(page);await checkExam(page,/肘/);
 const mobile=await viewport({isMobile:true,hasTouch:true,deviceScaleFactor:2,viewport:{width:390,height:760}});
 await mobile.goto(base);await mobile.locator('#viewport[data-ready=true]').waitFor();
 await mobile.locator('#mobilePanel').tap();
 assert.ok(await mobile.locator('#priorityTitle').isVisible());
 const target=mobile.locator('#priorityList [data-bone="Right radius"]');
 assert.ok(await target.isVisible());
 await target.tap();
 await mobile.waitForFunction(()=>document.querySelector('#viewport').dataset.specimen==='true'&&document.querySelector('#status').hidden);
 assert.equal(await mobile.locator('aside').isVisible(),true);
 const scene=await mobile.locator('#viewport').boundingBox(),side=await mobile.locator('aside').boundingBox();
 assert.ok(scene.width>350&&scene.y+scene.height<=side.y+1);
 await mobile.locator('#variants button').first().tap();
 await mobile.waitForFunction(()=>document.querySelector('#status').hidden&&!document.querySelector('.player').inert);
 await checkExam(mobile,/桡骨/);
 assert.match(await mobile.locator('#examList').innerText(),/餐叉/);
 await mobile.locator('#variants button').nth(1).tap();await ready(mobile);
 await checkExam(mobile,/屈曲型/);
 assert.match(await mobile.locator('#examList').innerText(),/Smith/);
 assert.doesNotMatch(await mobile.locator('#examList').innerText(),/餐叉/);
 await mobile.locator('#back').tap();await ready(mobile);
 assert.ok(await mobile.locator('#boneTitle').textContent()==='右桡骨');
 assert.equal(await mobile.locator('#examPoints').isVisible(),false);
 await mobile.locator('#variants button').nth(1).tap();await ready(mobile);
 await checkExam(mobile,/屈曲型/);
 await mobile.locator('#panelQuickNav [data-panel-tab=motion]').tap();assert.ok(await mobile.locator('#advanced').evaluate(el=>el.open));
 await mobile.locator('#foldPanel').tap();
 await mobile.locator('#stageToolsToggle').tap();
 assert.ok(await mobile.locator('#toggleBoneLabels').isVisible());
 await page.goto(base+'#tibia/0/1?at=0');await ready(page);
 await page.locator('#patternBox #shapes').getByText('短斜形',{exact:true}).click();await ready(page);
 await page.locator('#end').click();assert.equal(await page.locator('#time').inputValue(),'1000');
 assert.doesNotMatch(await page.locator('#contactState').innerText(),/已限位/);
 const tags=await page.locator('#markLayer').textContent();
 assert.match(tags,/近端/);assert.match(tags,/远端/);
 await page.locator('#advanced > summary').click();
 await page.locator('#viewOptions > summary').click();
 await page.locator('#guides').uncheck();
 await page.waitForFunction(()=>![...document.querySelectorAll('#markLayer .pin:not([hidden])')].some(pin=>/近端|远端/.test(pin.textContent)));
 await page.goto(base+'#hip-dislocation/0/1?at=1000&q_travel=18');await ready(page);
 assert.ok(Number(await page.locator('#time').inputValue())<1000);
 assert.match(await page.locator('#contactState').textContent(),/已限位/);
 await page.goto(base+'#radius/v01/1?at=1000');await ready(page);
 await checkExam(page,/伸直型/);
 assert.equal(await page.getByRole('link',{name:'反馈',exact:true}).count(),0);
 if(!base.startsWith('file:')){
  const slow=await viewport({isMobile:true,hasTouch:true,deviceScaleFactor:3,viewport:{width:390,height:760},serviceWorkers:'block'});
  let rejectOptional;
  const gate=new Promise(resolve=>{rejectOptional=resolve;});
  await slow.route(/models\/(?:detail\.(?:json|bin)|(?:vhm|extended)\/manifest\.json)/i,async route=>{
   await gate;await route.abort();
  });
  try{
   await slow.goto(base);await ready(slow);
   assert.ok(await slow.locator('#viewport canvas').isVisible());
  }finally{rejectOptional();}
  await slow.locator('#mobilePanel').tap();
  assert.ok(await slow.locator('#priorityTitle').isVisible());
  await slow.locator('#priorityList [data-bone="Right radius"]').tap();await ready(slow);
  assert.match(await slow.locator('#loadNotice').innerText(),/已显示预览/);
  assert.equal(await slow.locator('#viewport').getAttribute('data-specimen'),'false');
 }
 for(const [route,words] of [
  ['hip-dislocation/v01/1?at=1000',/平|转/],
  ['shoulder-dislocation/v01/1?at=1000&bone=FJ3262',/平|转/],
  ['single-forearm/v01/1?at=1000',/旋|平|移/],
  ['radius/v01/1?at=1000',/平|移|错/]
 ]){
  await page.goto(base+'#'+route);await ready(page);
  assert.equal(await page.locator('#time').inputValue(),'1000');
  assert.match(await page.locator('#liveValues').textContent(),words);
 }
 if(!base.startsWith('file:')){
  await page.goto(base+'#hip-dislocation/v01/1?at=450');await ready(page);
  if(!await page.locator('#softTissuePanel').evaluate(panel=>panel.open))await page.locator('#softTissuePanel summary').click();
  await page.locator('#softNerves').check();
  await page.locator('#viewport[data-soft-layers="nerves"]').waitFor({timeout:85000});
  const sciatic=page.locator('#markLayer .pin:visible').getByText('坐骨神经',{exact:true});
  await sciatic.waitFor();
  await page.locator('#viewport[data-soft-mode="linked"]').waitFor();
  assert.equal(await page.locator('#markLayer .pin:visible').filter({hasText:'尺神经'}).count(),0);
  await page.locator('#end').click();
  await page.waitForFunction(()=>+document.querySelector('#viewport').dataset.softDisplacement>.008);
  await page.locator('#time').fill('450');
  await page.locator('#softVessels').check();
  await page.locator('#viewport[data-soft-layers="vessels,nerves"]').waitFor({timeout:85000});
  await page.locator('#softNerves').uncheck();
  await page.locator('#viewport[data-soft-layers="vessels"]').waitFor({timeout:85000});
  await page.locator('#softReturn').click();
  assert.equal(await page.locator('#time').inputValue(),'450');
  assert.equal(await page.locator('#viewport').getAttribute('data-soft-layers'),null);
  await page.goto(base+'#single-forearm/v01/1?at=0');await ready(page);
  if(!await page.locator('#softTissuePanel').evaluate(panel=>panel.open))await page.locator('#softTissuePanel summary').click();
  await page.locator('#softMuscles').check();
  await page.locator('#viewport[data-soft-mode="linked"]').waitFor({timeout:85000});
  await page.locator('#end').click();
  assert.ok(Number(await page.locator('#viewport').getAttribute('data-soft-displacement'))>.001);
  await page.goto(base+'#femur/v01/1?at=0');await ready(page);
  if(!await page.locator('#softTissuePanel').evaluate(panel=>panel.open))await page.locator('#softTissuePanel summary').click();
  await page.locator('#softMuscles').check();
  await page.locator('#viewport[data-soft-mode="linked"]').waitFor({timeout:85000});
  await page.locator('#end').click();
  assert.ok(Number(await page.locator('#viewport').getAttribute('data-soft-displacement'))>.005);
  await page.goto(base+'#spine/v01/1?at=0');await ready(page);
  assert.equal(await page.locator('#softBar').isVisible(),false);
 }
 assert.deepEqual(errors,[]);console.log('Desktop and touch selection, rotation and shared orientation, playback, unified anatomy index, sidebar exam points, reference readouts and frame capture passed.');
}finally{await browser.close();}
