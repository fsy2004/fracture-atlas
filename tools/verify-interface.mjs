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
 async function viewport(options,strictErrors){
  const context=await browser.newContext({...options,offline:base.startsWith('file:')});
  const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',message=>{
   if(message.type()!=='error')return;
   if(strictErrors)strictErrors.push(message.text());
   if(/THREE\.WebGLProgram|VALIDATE_STATUS/.test(message.text()))errors.push(message.text());
  });
  return page;
 }
 async function ready(page){
  await page.waitForFunction(()=>document.querySelector('#viewport').dataset.ready==='true'&&document.querySelector('#status').hidden&&!document.querySelector('#viewport').hasAttribute('data-pending'));
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
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true}));
  await page.locator('#moreToggle').click();
  await page.locator('#copyLink').click();
  await page.keyboard.press('Escape');
  const params=new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  return ['cam','up'].map(key=>params.get(key).split(',').map(Number));
 }
 async function setLayer(page,layer,enabled=true){
  const control=page.locator('[data-soft-toggle="'+layer+'"]');
  if(await control.getAttribute('aria-pressed')!==String(enabled))await control.click();
 }
 async function clearLayers(page){
  const enabled=await page.locator('[data-soft-toggle][aria-pressed=true]').all();
  for(const button of enabled)await button.click();
 }
 async function chooseView(page,view){
  await page.locator('#stageToolsToggle').click();
  await page.locator('#viewRail [data-view='+view+']').click();
 }
 async function checkTask(page,name){
  if(name==='参数'){
   await page.locator('#moreToggle').click();
   await page.locator('#parameterTab').click();
   assert.ok(await page.locator('#parameterTask').isVisible());
   return;
  }
  await page.getByRole('tab',{name,exact:true}).click();
  const active=page.getByRole('tab',{selected:true});
  assert.equal(await active.innerText(),name);
  assert.equal(await page.getByRole('tabpanel').count(),1);
  const scrollers=await page.getByRole('tabpanel').evaluate(panel=>[panel,...panel.querySelectorAll('*')]
   .filter(node=>node.getClientRects().length&&['auto','scroll'].includes(getComputedStyle(node).overflowY))
   .map(node=>node.id));
  assert.deepEqual(scrollers,[await active.getAttribute('aria-controls')]);
 }
 async function noOverflow(page){
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.documentElement.scrollHeight===innerHeight));
 }
 async function touchTargets(page){
  const undersized=await page.locator('header button:visible,.soft-bar button:visible,#stageToolsToggle:visible,.panel-head button:visible,.rail-scroll button:visible,[role=tab]:visible').evaluateAll(
   buttons=>buttons.filter(button=>{const {width,height}=button.getBoundingClientRect();return width<40||height<40;})
    .map(button=>button.id||button.textContent.trim()));
  assert.deepEqual(undersized,[]);
 }
 async function playerPosition(page){
  assert.equal(await page.locator('.player').count(),1);
  assert.equal(await page.locator('#quickPlay').count(),0);
  return Promise.all(['#play','#time'].map(async selector=>{
   const control=page.locator(selector);
   assert.equal(await control.count(),1);
   const bounds=await control.boundingBox();
   assert.ok(bounds&&bounds.width>=40&&bounds.height>=40);
   assert.ok(await control.evaluate(node=>{
    const {x,y,width,height}=node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(x+width/2,y+height/2));
   }));
   return bounds;
  }));
 }

 const strictErrors=[];
 const desktop=await viewport({viewport:{width:1360,height:820},serviceWorkers:'block'},strictErrors);
 const coldSoftGlbs=[];
 desktop.on('request',request=>{if(/\/models\/soft-tissue\/.*\.glb/.test(request.url()))coldSoftGlbs.push(request.url());});
 await desktop.goto(base);await ready(desktop);
 assert.equal(await desktop.getByRole('tablist').count(),0);
 assert.equal(await desktop.locator('#stageToolsToggle').getAttribute('aria-expanded'),'false');
 assert.equal(await desktop.locator('#stageToolsPanel').isVisible(),false);
 assert.deepEqual(coldSoftGlbs,[]);
 await desktop.locator('#search').fill('下颌骨');
 await desktop.getByRole('button',{name:'放大下颌骨',exact:true}).click();await ready(desktop);
 await desktop.getByRole('button',{name:'体部骨折',exact:true}).click();await ready(desktop);
 await desktop.locator('#time').fill('375');
 await chooseView(desktop,'side');
 const mandibleCamera=await cameraState(desktop);
 await desktop.getByRole('button',{name:'右髁突颈骨折',exact:true}).click();await ready(desktop);
 assert.equal(await desktop.locator('#time').inputValue(),'375');
 assert.deepEqual(await cameraState(desktop),mandibleCamera);
 await checkExam(desktop,/髁突颈/);
 assert.equal(await desktop.getByRole('tab').count(),2);
 await checkTask(desktop,'分型');
 await desktop.locator('#patternBox > summary').click();
 await checkTask(desktop,'结构');
 if(!base.startsWith('file:')){
  await desktop.locator('#softSearch').fill('臂丛');
  await desktop.locator('#softStructureList').getByRole('button',{name:/臂丛/}).first().waitFor();
  assert.deepEqual(coldSoftGlbs,[]);
 }
 await checkTask(desktop,'参数');
 await desktop.locator('#closeParameters').click();
 await checkTask(desktop,'分型');
 assert.ok(await desktop.locator('#patternBox').evaluate(node=>node.open));
 await checkTask(desktop,'结构');
 if(!base.startsWith('file:'))assert.equal(await desktop.locator('#softSearch').inputValue(),'臂丛');
 await desktop.locator('#structureTask').evaluate(node=>{node.scrollTop=80;});
 const scroll=await desktop.locator('#structureTask').evaluate(node=>node.scrollTop);
 await checkTask(desktop,'分型');await checkTask(desktop,'结构');
 assert.equal(await desktop.locator('#structureTask').evaluate(node=>node.scrollTop),scroll);
 await desktop.locator('#moreToggle').click();
 const feedback=desktop.getByRole('link',{name:'反馈与纠错',exact:true});
 assert.equal(await feedback.getAttribute('href'),'https://github.com/fsy2004/fracture-atlas/issues/new/choose');
 assert.equal(await feedback.getAttribute('target'),'_blank');
 assert.equal(await feedback.getAttribute('rel'),'noopener noreferrer');
 await desktop.keyboard.press('Escape');
 assert.ok(await desktop.locator('#moreToggle').evaluate(node=>node===document.activeElement));
 await noOverflow(desktop);await playerPosition(desktop);
 assert.deepEqual(strictErrors,[]);
 console.log('Desktop 1360×820: 0 cold soft-tissue GLBs; mandible pose/time preserved; exclusive tasks, view and feedback passed.');
 await desktop.context().close();

 const tablet=await viewport({isMobile:true,hasTouch:true,viewport:{width:820,height:1080},serviceWorkers:'block'},strictErrors);
 await tablet.goto(base+'#region-rib-1/v01/1?at=0');await ready(tablet);
 assert.equal(await tablet.locator('#stageToolsToggle').getAttribute('aria-expanded'),'false');
 assert.equal(await tablet.locator('#panel').isVisible(),false);
 const tabletPlayback=await playerPosition(tablet);
 await tablet.locator('#mobilePanel').tap();
 await tablet.locator('#softImpactBox').getByRole('button',{name:'臂丛根组及神经干',exact:true}).first().waitFor();
 assert.deepEqual(await playerPosition(tablet),tabletPlayback);
 await tablet.locator('#foldPanel').tap();
 assert.equal(await tablet.locator('#panel').isVisible(),false);
 assert.ok(await tablet.locator('#viewport').evaluate(node=>{
  const {x,y,width,height}=node.getBoundingClientRect(),right=x+width-35;
  return width===innerWidth&&[0.25,0.50,0.75].every(fraction=>node.contains(document.elementFromPoint(right,y+height*fraction)));
 }));
 assert.deepEqual(await playerPosition(tablet),tabletPlayback);
 await noOverflow(tablet);
 assert.deepEqual(strictErrors,[]);
 console.log('Tablet 820×1080: first-rib brachial plexus risk, unobstructed canvas and stable player passed.');
 await tablet.context().close();

 const phone=await viewport({isMobile:true,hasTouch:true,deviceScaleFactor:2,viewport:{width:390,height:760},serviceWorkers:'block'},strictErrors);
 await phone.goto(base+'#tmj-dislocation/v01/1?at=0');await ready(phone);
 assert.match(await phone.locator('#heading').innerText(),/双侧前脱位/);
 assert.equal(await phone.locator('#stageToolsToggle').getAttribute('aria-expanded'),'false');
 const phonePlayback=await playerPosition(phone);
 await phone.locator('#play').tap();
 await phone.waitForFunction(()=>+document.getElementById('time').value>0);
 for(let round=0;round<3;round++){
  await phone.locator('#mobilePanel').tap();await checkTask(phone,'结构');await checkTask(phone,'分型');
  assert.deepEqual(await playerPosition(phone),phonePlayback);
  await noOverflow(phone);await touchTargets(phone);
  await phone.locator('#foldPanel').tap();
  assert.deepEqual(await playerPosition(phone),phonePlayback);
  await noOverflow(phone);
 }
 assert.ok(Number(await phone.locator('#time').inputValue())>0);
 if(!base.startsWith('file:')){
  await phone.locator('#time').fill('345');
  await phone.locator('#mobilePanel').tap();await checkTask(phone,'结构');
  await phone.locator('#softSearch').fill('坐骨神经');
  await phone.locator('#softStructureList').getByRole('button',{name:/坐骨神经/}).first().tap();
  const picked=await phone.locator('#softSelectedCard strong').textContent();
  await phone.locator('#foldPanel').tap();
  await phone.locator('#mobilePanel').tap();
  assert.equal(await phone.locator('#softSelectedCard strong').textContent(),picked);
  assert.equal(await phone.locator('#time').inputValue(),'345');
  assert.deepEqual(await playerPosition(phone),phonePlayback);
  await noOverflow(phone);
 }
 assert.deepEqual(strictErrors,[]);
 console.log('Phone 390×760: bilateral TMJ playback, three sheet cycles, stable controls, no overflow or console errors.');
 await phone.context().close();

 const page=await viewport({viewport:{width:1360,height:850}});
 await page.goto(base+'#tibia/1/2?mv=2&move=shorten,rotate&at=1000');
 await page.waitForFunction(()=>document.querySelector('#viewport').dataset.ready==='true'&&document.querySelector('#status').hidden);
 await checkExam(page,/胫/);
 await page.locator('#end').click();
 assert.equal(await page.locator('#time').inputValue(),'1000');
 assert.equal(await page.locator('input[type=range]:visible').count(),1);
 assert.equal(await page.locator('#motionReadout').count(),0);
 assert.match(await page.locator('#liveValues').textContent(),/缩短/);
 await checkTask(page,'参数');
 assert.ok(await page.locator('#quantRows input:visible').count()>0);
 await page.locator('#fragmentBox > summary').click();await page.locator('[data-fine]').first().waitFor();assert.equal(await page.locator('[data-fine]:visible').count(),6);
 await checkTask(page,'分型');await page.locator('#normal').click();
 assert.equal(await page.locator('#time').inputValue(),'0');
 await page.locator('#playerToggle').click();await page.locator('#nextFrame').click();
 assert.ok(Number(await page.locator('#time').inputValue())>0);
 await page.locator('#captureFrame').click();await page.locator('#frameStrip img').first().waitFor();
 await page.goto(base+'#skeleton');await ready(page);
 assert.equal(await page.locator('#examPoints').isVisible(),false);
 assert.equal(await page.locator('#indexPanel [data-bone]').count(),201);
 assert.equal(await page.locator('#indexPanel .bone-family').count(),4);
 assert.equal(await page.locator('#launchpad').count(),0);
 assert.ok(await page.locator('#priorityList .priority-star').count()>0);
 await chooseView(page,'rear');
 assert.equal(await page.locator('#dirTR').innerText(),'患者右侧');
 await chooseView(page,'home');
 assert.equal(await page.locator('#dirTR').innerText(),'患者左侧');
 assert.equal(await page.locator('#dirTL').innerText(),'上方');
 assert.equal(await page.locator('#dirBR').innerText(),'下方');
 await chooseView(page,'top');
 assert.equal(await page.locator('[data-view=top]').getAttribute('aria-pressed'),'true');
 await chooseView(page,'inferior');
 assert.equal(await page.locator('[data-view=inferior]').getAttribute('aria-pressed'),'true');
 await chooseView(page,'home');
 await page.locator('#search').fill('腭骨');await page.locator('[data-bone="Left palatine bone"]').click();await ready(page);
 assert.ok(await page.locator('#viewport').getAttribute('data-specimen')==='true');
 await checkTask(page,'参数');await page.locator('#viewOptions > summary').click();await page.locator('#anatomyExtent').selectOption('region');await ready(page);
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
 await touchTargets(mobile);
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
 assert.equal(await mobile.locator('#heading').textContent(),'右桡骨');
 assert.equal(await mobile.locator('#examPoints').isVisible(),false);
 await mobile.locator('#variants button').nth(1).tap();await ready(mobile);
 await checkExam(mobile,/屈曲型/);
 await checkTask(mobile,'参数');assert.ok(await mobile.locator('#motionSettings').isVisible());
 await mobile.locator('#foldPanel').tap();
 await mobile.locator('#stageToolsToggle').tap();
 assert.ok(await mobile.locator('#toggleBoneLabels').isVisible());
 await mobile.context().close();
 await page.goto(base+'#tibia/0/1?at=0');await ready(page);
 await page.locator('#patternBox > summary').click();
 await page.locator('#patternBox #shapes').getByText('短斜形',{exact:true}).click();await ready(page);
 await page.locator('#end').click();assert.equal(await page.locator('#time').inputValue(),'1000');
 assert.doesNotMatch(await page.locator('#contactState').innerText(),/已限位/);
 const tags=await page.locator('#markLayer').textContent();
 assert.match(tags,/近端/);assert.match(tags,/远端/);
 await checkTask(page,'参数');
 await page.locator('#viewOptions > summary').click();
 await page.locator('#guides').uncheck();
 await page.waitForFunction(()=>![...document.querySelectorAll('#markLayer .pin:not([hidden])')].some(pin=>/近端|远端/.test(pin.textContent)));
 await page.goto(base+'#hip-dislocation/0/1?at=1000&q_travel=18');await ready(page);
 assert.ok(Number(await page.locator('#time').inputValue())<1000);
 assert.match(await page.locator('#contactState').textContent(),/已限位/);
 await page.goto(base+'#radius/v01/1?at=1000');await ready(page);
 await checkExam(page,/伸直型/);
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
  await slow.context().close();
 }
 for(const [route,words] of [
  ['hip-dislocation/v01/1?at=1000',/平|转/],
  ['shoulder-dislocation/v01/1?at=1000&bone=FJ3262',/平|转/],
  ['single-forearm/v01/1?at=1000',/旋|平|移|转角|错开/],
  ['radius/v01/1?at=1000',/平|移|错/]
 ]){
  await page.goto(base+'#'+route);await ready(page);
  assert.equal(await page.locator('#time').inputValue(),'1000');
  assert.match(await page.locator('#liveValues').textContent(),words);
 }
 if(!base.startsWith('file:')){
  await page.goto(base+'#hip-dislocation/v01/1?at=450');await ready(page);
  await setLayer(page,'nerves');
  await page.locator('#viewport[data-soft-layers="nerves"]').waitFor({timeout:85000});
  await checkTask(page,'结构');
  await page.locator('#softDisplayTools > summary').click();
  assert.equal(await page.locator('#softDepthRow').isVisible(),false);
  assert.equal(await page.locator('#softOpacityRow').isVisible(),false);
  assert.equal(await page.locator('#softClipPosRow').isVisible(),false);
  await page.locator('#softClipAxis').selectOption('ap');
  assert.ok(await page.locator('#softClipPosRow').isVisible());
  await page.locator('#softClipAxis').selectOption('none');
  const sciatic=page.locator('#markLayer .pin:visible').getByText('坐骨神经',{exact:true});
  await sciatic.waitFor();
  await page.locator('#viewport[data-soft-mode="linked"]').waitFor();
  assert.equal(await page.locator('#markLayer .pin:visible').filter({hasText:'尺神经'}).count(),0);
  await page.locator('#end').click();
  await page.waitForFunction(()=>+document.querySelector('#viewport').dataset.softDisplacement>.008);
  await page.locator('#time').fill('450');
  await setLayer(page,'vessels');
  await page.locator('#viewport[data-soft-layers="vessels,nerves"]').waitFor({timeout:85000});
  await setLayer(page,'nerves',false);
  await page.locator('#viewport[data-soft-layers="vessels"]').waitFor({timeout:85000});
  await clearLayers(page);
  assert.equal(await page.locator('#time').inputValue(),'450');
  assert.equal(await page.locator('#viewport').getAttribute('data-soft-layers'),null);
  await page.goto(base+'#single-forearm/v01/1?at=0');await ready(page);
  await setLayer(page,'muscles');
  await page.locator('#viewport[data-soft-mode="linked"]').waitFor({timeout:85000});
  await checkTask(page,'结构');
  if(!await page.locator('#softDisplayTools').evaluate(node=>node.open))await page.locator('#softDisplayTools > summary').click();
  assert.ok(await page.locator('#softDepthRow').isVisible());
  assert.ok(await page.locator('#softOpacityRow').isVisible());
  await page.locator('#softStructureList button').first().click();
  await page.getByRole('button',{name:'独显此结构',exact:true}).click();
  assert.ok(await page.locator('#softBarResetIso').isVisible());
  await page.locator('#softBarResetIso').click();
  assert.equal(await page.locator('#softBarResetIso').isVisible(),false);
  await page.locator('#end').click();
  assert.ok(Number(await page.locator('#viewport').getAttribute('data-soft-displacement'))>.001);
  await page.goto(base+'#femur/v01/1?at=0');await ready(page);
  await setLayer(page,'muscles');
  await page.locator('#viewport[data-soft-mode="linked"]').waitFor({timeout:85000});
  await page.locator('#end').click();
  assert.ok(Number(await page.locator('#viewport').getAttribute('data-soft-displacement'))>.005);
  await checkTask(page,'结构');
  if(!await page.locator('#softDisplayTools').evaluate(node=>node.open))await page.locator('#softDisplayTools > summary').click();
  assert.ok(await page.locator('#softArrowsRow').isVisible());
  await page.locator('#softShowArrows').uncheck();
  const axial=await viewport({viewport:{width:1360,height:850}});
  const softRequests=[];
  axial.on('request',request=>{if(/\/models\/soft-tissue\/.*\.glb/.test(request.url()))softRequests.push(request.url());});
  await axial.goto(base+'#skeleton');await ready(axial);
  assert.deepEqual(softRequests,[]);
  for(const [route,layer,name] of [
   ['region-rib-1/v01/1','nerves','右肋间神经组'],
   ['region-body-c5/v02/1','nerves','右脊神经后根组'],
   ['region-parietal/v02/1','vessels','上矢状窦'],
   ['tmj-dislocation/v01/1','muscles','左翼内肌']
  ]){
   const requestCount=softRequests.length;
   await axial.goto(base+'#'+route+'?at=0');await ready(axial);
   await axial.locator('#softBar').waitFor();
   assert.equal(softRequests.length,requestCount);
   await setLayer(axial,layer);
   await axial.locator('#viewport[data-soft-layers][data-soft-mode]').waitFor({timeout:85000});
   await checkTask(axial,'结构');
   assert.match(await axial.locator('#softStructureList').textContent(),new RegExp(name));
   assert.equal(await axial.locator('#softArrowsRow').isVisible(),false);
   assert.notEqual(await axial.locator('#viewport').getAttribute('data-soft-mode'),'linked');
   await clearLayers(axial);
  }
  await axial.context().close();
 }
 for(const route of ['knee-dislocation/0/1','hip-dislocation/v02/1','lunate-dislocation/v02/1']){
  await page.goto(base+'#'+route+'?at=0');await ready(page);
  assert.ok(await page.locator('#play').isVisible());
  assert.equal(await page.locator('#time').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);console.log('Desktop and touch selection, rotation and shared orientation, playback, unified anatomy index, sidebar exam points, reference readouts and frame capture passed.');
}finally{await browser.close();}
