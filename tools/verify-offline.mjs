// Use the same Playwright and Chromium setup as verify-interface.mjs.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.ATLAS_PLAYWRIGHT||'playwright');
const base=process.argv[2];
if(!base||!/^https?:\/\//.test(base))throw Error('Supply an HTTPS or localhost atlas URL with a trailing slash.');
const browser=await chromium.launch({
 executablePath:process.env.ATLAS_CHROMIUM||undefined,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']
});
try{
 const context=await browser.newContext({viewport:{width:1250,height:850},serviceWorkers:'allow'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#viewport').dataset.ready==='true'&&document.querySelector('#status').hidden,{},{timeout:80000});
 await page.goto(base+'#radius/v01/1?at=1000');await ready();
 await page.locator('#saveOffline').click();
 await page.waitForFunction(()=>document.querySelector('#offlineState').textContent.includes('已保存'),{},{timeout:90000});
 await context.setOffline(true);
 await page.reload();await ready();
 assert.equal(await page.locator('#viewport').getAttribute('data-specimen'),'true');
 assert.match(await page.locator('#examCase').textContent(),/伸直型/);
 assert.equal(await page.locator('#time').inputValue(),'1000');
 await page.goto(base+'#bone/FJ3365');await ready();
 assert.equal(await page.locator('#viewport').getAttribute('data-specimen'),'false');
 await page.locator('#anatomyPanel summary').click();
 assert.match(await page.locator('#anatomyMarks').innerText(),/大转子/);
 assert.match(await page.locator('#offlineState').textContent(),/使用全身底模/);
 await page.evaluate(()=>{
  const canvas=document.querySelector('#viewport canvas');
  const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
  window.testLoss=gl.getExtension('WEBGL_lose_context');
  window.testLoss.loseContext();
 });
 await page.waitForFunction(()=>!document.querySelector('#status').hidden&&document.querySelector('#status').textContent.includes('暂时中断'));
 await page.evaluate(()=>window.testLoss.restoreContext());
 await ready();
 assert.deepEqual(errors,[]);
 console.log('Cached injury reopened offline, uncached bone used the base model and anatomy, and the WebGL context recovered.');
}finally{await browser.close();}
