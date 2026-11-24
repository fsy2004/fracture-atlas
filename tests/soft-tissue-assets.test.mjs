import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {referenceName} from '../soft-tissue-view.js';
import {LIMB_ZONES, isLimbBone, softTissueInfo, muscleDepth} from '../soft-tissue-catalog.js';
import {scoreTissueInjury} from '../tissue-damage.js';

const base=new URL('../models/soft-tissue/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));

test('all 6 limb anatomical zones have clean, intact high-resolution meshes for each layer',()=>{
 assert.equal(manifest.scope,'limbs');
 assert.deepEqual(manifest.regions,LIMB_ZONES);
 for(const layer of ['bones','muscles','vessels','nerves']){
  let vertices=0,triangles=0,count=0;
  for(const region of LIMB_ZONES){
   const part=manifest.layers[layer][region];
   assert.ok(part&&part.nodes>0&&part.triangles>0,layer+'/'+region);
   const bytes=readFileSync(new URL(part.file,base));
   assert.equal(bytes.length,part.bytes);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sha256);
   assert.equal(bytes.subarray(0,4).toString(),'glTF');
   const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
   assert.equal(doc.nodes.length,part.nodes);
   count+=doc.nodes.length;
   for(const mesh of doc.meshes)for(const primitive of mesh.primitives){
    vertices+=doc.accessors[primitive.attributes.POSITION].count;
    triangles+=doc.accessors[primitive.indices].count/3;
   }
  }
  assert.equal(count,manifest.coverage[layer].count);
  assert.ok(vertices>20000&&triangles>100000,layer);
 }
 // Verify critical limb neurovascular structures exist on both sides
 for(const side of ['.l','.r']){
  for(const name of ['Sciatic nerve','Femoral nerve','Obturator nerve','Common fibular nerve','Tibial nerve','Median nerve','Ulnar nerve','Radial nerve','Axillary nerve']){
   assert.ok(manifest.structures.nerves[name+side],name+side);
  }
  for(const name of ['Brachial artery','Axillary artery','Femoral artery','Popliteal artery','Medial circumflex femoral artery','Dorsalis pedis artery']){
   assert.ok(manifest.structures.vessels[name+side],name+side);
  }
 }
 // Verify zero attachment-sticker (.o/.e), bursa, or fascia pollution in limb muscles
 for(const name of Object.keys(manifest.structures.muscles)){
  assert.doesNotMatch(name,/\.[oe]\d*[lr]$/,'no origin/insertion sticker mesh: '+name);
  assert.doesNotMatch(name,/\b(bursa|bursae|fascia|retinaculum|sheath)\b/i,'no fascia/bursa blob: '+name);
 }
});

test('100% of limb muscles, vessels, and nerves have Chinese anatomical names in catalog',()=>{
 for(const layer of ['muscles','vessels','nerves']){
  for(const name of Object.keys(manifest.structures[layer])){
   const info=softTissueInfo(layer,name);
   assert.ok(info.translated,'missing Chinese translation for '+layer+': '+name);
   assert.ok(/[\u4e00-\u9fff]/.test(info.zh),'non-Chinese name for '+name+': '+info.zh);
  }
 }
});

test('every selectable limb bone resolves to a same-side soft-tissue companion bone',()=>{
 const bones=JSON.parse(readFileSync(new URL('../models/index.json',import.meta.url),'utf8'));
 let checked=0;
 for(const {name} of bones){
  if(!isLimbBone(name))continue;
  checked++;
  const reference=referenceName(name,manifest.structures.bones);
  assert.ok(reference,'missing soft-tissue reference for limb bone: '+name);
  if(/\bleft\b/i.test(name))assert.match(reference,/\.l$/);
  if(/\bright\b/i.test(name))assert.match(reference,/\.r$/);
 }
 assert.ok(checked>=120,'expected >=120 limb bones, got '+checked);
});

test('muscle depth layers and real-time biomechanical injury severity grading behave realistically',()=>{
 // Superficial muscles peel before deep muscles (e.g. gluteus maximus=1, gluteus medius=2, piriformis/iliacus=3)
 assert.equal(muscleDepth('Gluteus maximus muscle'),1);
 assert.equal(muscleDepth('Gluteus medius muscle'),2);
 assert.equal(muscleDepth('Piriformis muscle'),3);
 assert.equal(muscleDepth('Medial head of gastrocnemius'),1);
 assert.equal(muscleDepth('Tibialis posterior muscle'),3);

 // Mild displacement with ample clearance causes no injury (Grade 0)
 const mild=scoreTissueInjury({layer:'nerves',sublayer:'nerves',restClearanceMm:14,liveClearanceMm:12,approachMm:1.0,strainPct:2.0,isSharpRim:true});
 assert.equal(mild.grade,0);

 // Moderate nerve stretch / approach yields Grade 1-2
 const mod=scoreTissueInjury({layer:'nerves',sublayer:'nerves',restClearanceMm:12,liveClearanceMm:4.0,approachMm:5.5,strainPct:11,isSharpRim:true});
 assert.ok(mod.grade>=1&&mod.grade<=2);

 // Severe cortical impingement on artery yields Grade 3 critical injury
 const sev=scoreTissueInjury({layer:'vessels',sublayer:'arteries',restClearanceMm:10,liveClearanceMm:0.8,approachMm:9.2,strainPct:14,isSharpRim:true});
 assert.equal(sev.grade,3);
 assert.equal(sev.kind,'laceration');
});
