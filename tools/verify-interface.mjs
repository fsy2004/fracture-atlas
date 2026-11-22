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
  return page;
 }
 async function ready(page){
  await page.waitForFunction(()=>document.querySelector('#meshState').dataset.ready==='true'&&document.querySelector('#status').hidden);
 }
 async function checkCard(page,expected){
  const card=page.locator('#knowledgeCard');
  assert.ok(await card.isVisible());
  assert.match(await page.locator('#knowledgeCase').textContent(),expected);
  assert.equal(await card.locator('li').count(),2);
  const below=await card.evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('#viewport').getBoundingClientRect().bottom-1);
  assert.ok(below,'card and model occupy separate areas');
  await card.locator('summary').click();assert.equal(await card.locator('li').first().isVisible(),false);
  await card.locator('summary').click();
 }
 async function cameraState(page){
  await page.locator('#copyLink').click();
  const params=new URLSearchParams(new URL(page.url()).hash.split('?')[1]);
  return ['cam','up'].map(key=>params.get(key).split(',').map(Number));
 }
 const page=await viewport({viewport:{width:1360,height:850}});
 await page.goto(base+'#tibia/1/2?mv=2&move=shorten,rotate&at=1000');
 await page.waitForFunction(()=>document.querySelector('#meshState').dataset.ready==='true'&&document.querySelector('#status').hidden);
 await checkCard(page,/胫/);
 await page.locator('#end').click();
 assert.equal(await page.locator('#time').inputValue(),'1000');
 assert.equal(await page.locator('input[type=range]:visible').count(),1);
 assert.match(await page.locator('#motionReadout').innerText(),/旋转/);
 assert.match(await page.locator('#liveValues').textContent(),/缩短/);
 await page.locator('#advanced > summary').click();
 assert.ok(await page.locator('#quantRows input:visible').count()>0);
 await page.locator('#fragmentBox > summary').click();await page.locator('[data-fine]').first().waitFor();assert.equal(await page.locator('[data-fine]:visible').count(),6);
 await page.locator('#advanced > summary').click();await page.locator('#normal').click();
 assert.equal(await page.locator('#time').inputValue(),'0');
 await page.locator('#viewOptions > summary').click();await page.locator('#nextFrame').click();
 assert.ok(Number(await page.locator('#time').inputValue())>0);
 await page.locator('#captureFrame').click();await page.locator('#frameStrip img').first().waitFor();
 await page.goto(base+'#skeleton');await ready(page);
 assert.equal(await page.locator('#knowledgeCard').isVisible(),false);
 await page.locator('[data-bone="Right femur"]').click();await ready(page);
 assert.equal(await page.locator('#knowledgeCard').isVisible(),false);
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
 await page.goto(base+'#elbow-dislocation/0/1?at=1000');await ready(page);await checkCard(page,/肘/);
 const mobile=await viewport({isMobile:true,hasTouch:true,deviceScaleFactor:2,viewport:{width:390,height:760}});
 await mobile.goto(base);await mobile.locator('#meshState[data-ready=true]').waitFor();
 await mobile.locator('#mobilePanel').tap();await mobile.locator('[data-bone="Right radius"]').tap();
 await mobile.waitForFunction(()=>document.querySelector('#meshState').dataset.specimen==='true'&&document.querySelector('#status').hidden);
 assert.equal(await mobile.locator('aside').isVisible(),false);
 await mobile.locator('#centreBone').tap();await mobile.locator('#mobilePanel').tap();await mobile.locator('#variants button').first().tap();
 await mobile.waitForFunction(()=>document.querySelector('#status').hidden&&!document.querySelector('.player').inert);
 await checkCard(mobile,/桡骨/);
 await mobile.locator('#quickEdit').tap();assert.ok(await mobile.locator('#advanced').evaluate(el=>el.open));
 assert.deepEqual(errors,[]);console.log('Desktop and touch selection, rotation and shared orientation, playback, cards, reference readouts and frame capture passed.');
}finally{await browser.close();}
