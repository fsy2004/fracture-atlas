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
 const page=await viewport({viewport:{width:1360,height:850}});
 await page.goto(base+'#tibia/1/2?mv=2&move=shorten,rotate&at=1000');
 await page.waitForFunction(()=>document.querySelector('#meshState').dataset.ready==='true'&&document.querySelector('#status').hidden);
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
 const mobile=await viewport({isMobile:true,hasTouch:true,deviceScaleFactor:2,viewport:{width:390,height:760}});
 await mobile.goto(base);await mobile.locator('#meshState[data-ready=true]').waitFor();
 await mobile.locator('#mobilePanel').tap();await mobile.locator('[data-bone="Right radius"]').tap();
 await mobile.waitForFunction(()=>document.querySelector('#meshState').dataset.specimen==='true'&&document.querySelector('#status').hidden);
 assert.equal(await mobile.locator('aside').isVisible(),false);
 await mobile.locator('#centreBone').tap();await mobile.locator('#mobilePanel').tap();await mobile.locator('#variants button').first().tap();
 await mobile.waitForFunction(()=>document.querySelector('#status').hidden&&!document.querySelector('.player').inert);
 await mobile.locator('#quickEdit').tap();assert.ok(await mobile.locator('#advanced').evaluate(el=>el.open));
 assert.deepEqual(errors,[]);console.log('Desktop playback, visible controls, reference readouts, frame capture and touch selection passed.');
}finally{await browser.close();}
