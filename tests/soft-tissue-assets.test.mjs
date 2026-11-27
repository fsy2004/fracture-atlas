import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {referenceName,referenceBones,partsFor,tissueLoadPlan,sesamoidComponent,prepareSoftTissues} from '../soft-tissue-view.js';
import {readGLB,dracoBlock,dracoReader,nodeMatrix} from '../tools/soft-tissue-draco.mjs';
import {BoxGeometry,BufferAttribute,BufferGeometry,Matrix4,Vector3} from '../vendor/three.module.js';
import {regionalTissueSeed,fitAxialTissues} from '../tissue-registration.js';
import {canonicalCourse} from '../variant-registry.js';
import {boneName} from '../bone-index.js';
import {ALL_ZONES,LIMB_ZONES,isSoftTissueSupported,resolveAnatomy,loadAxialTerms,softTissueInfo,muscleDepth} from '../soft-tissue-catalog.js?v=whole-body1';
import {clinicalSoftTissueFor,loadAxialClinical} from '../soft-tissue-clinical.js?v=whole-body1';
import {scoreTissueInjury} from '../tissue-damage.js';
import {courses} from '../courses.js';
import {joints} from '../joints.js';
import {regionalCourses} from '../regional-courses.js';
import {supplementalCourses} from '../supplemental.js';

const base=new URL('../models/soft-tissue/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const tissueLayers=['muscles','vessels','nerves'];
const axialLock=JSON.parse(readFileSync(new URL('../tools/soft-tissue-axial-selection.json',import.meta.url),'utf8'));
const original=new URL('../../work/soft-tissue-source/',import.meta.url);
await Promise.all([loadAxialTerms(),loadAxialClinical()]);

test('11 zones reproduce the pinned Draco selection, hashes, and release budgets',()=>{
 assert.equal(manifest.scope,'whole-body');
 assert.deepEqual(manifest.regions,ALL_ZONES);
 const files=new Set();
 let totalNewBytes=0, totalNewParts=0, totalNewNodes=0, maxNewFaces=0;
 for(const layer of ['bones',...tissueLayers]){
  let vertices=0,triangles=0;
  const seen=new Map();
  const lock=axialLock[layer], sourceMeta=manifest.coverage[layer].source;
  const sourceURL=new URL(sourceMeta.file,original);
  const raw=existsSync(sourceURL)?readFileSync(sourceURL):null;
  const source=raw?readGLB(raw):null;
  assert.equal(sourceMeta.sha256,lock.sha256);
  if(raw)assert.equal(sha(raw),lock.sha256);
  for(const region of ALL_ZONES){
   const axial=!LIMB_ZONES.includes(region);
   const parts=partsFor(manifest,layer,region);
   assert.ok(parts.length);
   if(!axial)assert.equal(parts.length,1);
   for(const part of parts){
    assert.ok(part.nodes>0&&part.triangles>0,layer+'/'+region);
    assert.ok(!files.has(part.file));
    files.add(part.file);
    const bytes=readFileSync(new URL(part.file,base)), glb=readGLB(bytes);
    assert.equal(bytes.length,part.bytes);
    assert.ok(part.bytes<25_000_000);
    assert.equal(sha(bytes),part.sha256);
    assert.equal(glb.doc.nodes.length,part.nodes);
    if(axial){
     assert.ok(part.triangles<=180_000);
     maxNewFaces=Math.max(maxNewFaces,part.triangles);
     totalNewBytes+=part.bytes;totalNewParts++;totalNewNodes+=part.nodes;
    }
    let partFaces=0;
    for(const node of glb.doc.nodes){
     const name=node.name.trim(), row=manifest.structures[layer][name];
     assert.ok(row,name);
     assert.equal(row.ownerPart,part.file);
     assert.equal(row.region,region);
     assert.ok(!seen.has(row.sourceNode),name);
     const compressed=dracoBlock(glb,node).bytes;
     seen.set(row.sourceNode,{name,region,compressed});
     if(source){
      const originalNode=source.doc.nodes[row.sourceNode];
      assert.equal(name,originalNode.name.trim());
      assert.deepEqual(compressed,dracoBlock(source,originalNode).bytes);
     }
     for(const primitive of glb.doc.meshes[node.mesh].primitives){
      vertices+=glb.doc.accessors[primitive.attributes.POSITION].count;
      partFaces+=glb.doc.accessors[primitive.indices].count/3;
     }
    }
    assert.equal(partFaces,part.triangles);
    triangles+=partFaces;
   }
  }
  assert.equal(seen.size,manifest.coverage[layer].count);
  assert.equal(Object.keys(manifest.structures[layer]).length,seen.size);
  assert.ok(vertices>20000&&triangles>100000,layer);
  const digest=createHash('sha256');
  const axialRows=[];
  for(const [index,row] of [...seen].sort(([a],[b])=>a-b)){
   const field=Buffer.alloc(8);field.writeUInt32LE(index,0);field.writeUInt32LE(row.compressed.length,4);
   digest.update(field).update(row.compressed);
   if(!LIMB_ZONES.includes(row.region))axialRows.push([index,row.region,row.name]);
  }
  assert.equal(digest.digest('hex'),manifest.coverage[layer].dracoSha256);
  assert.deepEqual(axialRows,lock.nodes);
 }
 assert.equal(files.size,59);
 assert.deepEqual(readdirSync(base).filter(file=>file.endsWith('.glb')).sort(),[...files].sort());
 assert.deepEqual([totalNewNodes,totalNewParts,totalNewBytes,maxNewFaces],[692,35,9401028,177229]);
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

test('all 1,244 soft-tissue nodes have Chinese names and clinical anatomy notes',()=>{
 let count=0;
 for(const layer of tissueLayers){
  for(const name of Object.keys(manifest.structures[layer])){
   const info=softTissueInfo(layer,name);
   assert.ok(info.translated,'missing Chinese translation for '+layer+': '+name);
   assert.ok(/[\u4e00-\u9fff]/.test(info.zh),'non-Chinese name for '+name+': '+info.zh);
   assert.ok(/[\u4e00-\u9fff]/.test(info.note),'missing anatomy note for '+name);
   if(manifest.structures[layer][name].side && /[.]([lr])$|^(?:Left|Right) /i.test(name))assert.match(info.zh,/^[左右]/);
   count++;
  }
 }
 assert.equal(count,1244);
 assert.equal(softTissueInfo('vessels','Superior sagittal sinus').sublayer,'veins');
 assert.equal(softTissueInfo('nerves','Intercostal nerves.l').zh,'左肋间神经组');
 assert.equal(softTissueInfo('nerves','Posterior root of spinal nerve.r').zh,'右脊神经后根组');
 assert.equal(softTissueInfo('nerves','Spinal dura').zhBase,'脊髓硬膜');
 assert.equal(softTissueInfo('nerves','Nerve to mylohyoid muscle.l').zh,'左下颌舌骨肌神经');
});

test('all 201 bone entrances resolve to the right companion and three available tissue layers',()=>{
 const bones=JSON.parse(readFileSync(new URL('../models/index.json',import.meta.url),'utf8'));
 const references=new Set();
 assert.equal(new Set(bones.map(row=>row.mesh)).size,201);
 for(const {name,mesh} of bones){
  assert.match(boneName(name),/[\u4e00-\u9fff]/,name);
  assert.ok(isSoftTissueSupported(name),name);
  const reference=referenceName(name,manifest.structures.bones);
  assert.ok(reference,name);
  references.add(reference);
  if(/\bleft\b/i.test(name))assert.match(reference,/\.l$/);
  if(/\bright\b/i.test(name))assert.match(reference,/\.r$/);
  const anatomy=resolveAnatomy(name,'','',mesh);
  const plan=tissueLoadPlan(manifest,tissueLayers,anatomy);
  for(const layer of tissueLayers)assert.ok(plan.tasks.some(task=>task.layer===layer),name+'/'+layer);
 }
 assert.equal(references.size,199);
 assert.deepEqual(resolveAnatomy('Right first rib').zones,['chest','neck','shoulder-arm']);
 assert.deepEqual(resolveAnatomy('Right hip bone','pelvis').zones,['pelvis','hip-thigh']);
 assert.deepEqual(resolveAnatomy('Mandible','tmj-dislocation').zones,['face','neck']);
 assert.equal(resolveAnatomy('Mandible','tmj-dislocation').injurySide,'bilateral');
 assert.equal(resolveAnatomy('Mandible','region-mandible','v02').injurySide,'right');
 assert.equal(resolveAnatomy('Atlas').side,'midline');
 assert.deepEqual(referenceBones('Mandible','tmj-dislocation').slice(0,2),['Left temporal bone','Right temporal bone']);
 assert.ok(manifest.sourceGaps.textOnly.includes('Individual S2-S4 roots'));
});

test('four foot sesamoid entries select two real decoded components per side',async()=>{
 const path=manifest.layers.bones['ankle-foot'].file;
 const glb=readGLB(readFileSync(new URL(path,base))), reader=await dracoReader();
 try{
  for(const [side,ids] of [['left',['FJ3266','FJ3270']],['right',['FJ3372','FJ3376']]]){
   const name='Sesamoid bone of '+side+' foot';
   const node=glb.doc.nodes.find(row=>row.name===referenceName(name,manifest.structures.bones));
   const data=reader.decode(dracoBlock(glb,node),true);
   const geometry=new BufferGeometry();
   geometry.setAttribute('position',new BufferAttribute(data.positions,3));
   geometry.setIndex(new BufferAttribute(data.faces,1));
   const source={geometry,matrixWorld:nodeMatrix(node)};
   const components=ids.map(id=>sesamoidComponent(source,side,resolveAnatomy(name,'','',id).component));
   assert.deepEqual(components.map(g=>g.attributes.position.count).sort((a,b)=>a-b),[42,107]);
   assert.equal(components.reduce((sum,g)=>sum+g.index.count,0),geometry.index.count);
   for(const g of components)g.computeBoundingBox();
   const [medial,lateral]=components.map(g=>g.boundingBox.getCenter(new Vector3()).applyMatrix4(source.matrixWorld).x);
   assert.ok(Math.abs(medial)<Math.abs(lateral));
  }
 }finally{reader.dispose();}
});

test('an explicit prefetch follows the sharded catalogue while constructing the viewer issues no requests',async t=>{
 const requests=[];
 t.mock.method(globalThis,'fetch',async url=>{
  requests.push(url);
  const name=url.split('/').at(-1).split('?')[0];
  return new Response(readFileSync(new URL(name,base)));
 });
 const viewer=prepareSoftTissues();
 assert.deepEqual(requests,[]);
 const bone='Mandible',options={courseId:'tmj-dislocation',focusOnly:false};
 await viewer.prefetch(bone,['vessels'],options);
 const plan=tissueLoadPlan(manifest,['vessels'],resolveAnatomy(bone,options.courseId),options);
 assert.ok(plan.tasks.filter(task=>task.zone==='face'&&task.layer==='vessels').length>1);
 assert.deepEqual(requests.slice(1).sort(),plan.tasks.map(({part})=>'./models/soft-tissue/'+part.file+'?v='+part.sha256).sort());
});

test('regional fit preserves handedness and rejects distinct donor geometry for paired joints',()=>{
 const pairs=[[-.04,.01,.015],[.04,.009,.015],[0,.021,-.03]].map(([x,y,z],i)=>{
  const geometry=new BoxGeometry(.025,.015,.020,3,3,3).translate(x,y,z);
  geometry.userData.group='same-donor';
  const world=new Matrix4().makeTranslation(0,.06,0);
  return {name:String(i),source:{geometry,matrixWorld:new Matrix4()},geometry,world};
 });
 const seed=regionalTissueSeed(pairs);
 assert.ok(seed.matrix.determinant()>0);
 assert.ok(seed.landmarkP90<1e-6);
 pairs[2].world.makeTranslation(.12,0,0);
 assert.equal(regionalTissueSeed(pairs),null);
 pairs[2].world.makeTranslation(0,.06,0);
 pairs[2].geometry=pairs[2].geometry.clone();
 const options={requireNeighbours:true};
 assert.equal(fitAxialTissues(pairs,null,options).accepted,true);
 pairs[2].geometry.userData.group='other-donor';
 assert.equal(fitAxialTissues(pairs,null,options).accepted,false);
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
 for(const kind of ['central-reference','meningeal-reference','cranial-nerve','nerve-group','venous-sinus']){
  const result=scoreTissueInjury({layer:'nerves',structureKind:kind,liveClearanceMm:.2,approachMm:15,strainPct:50});
  assert.equal(result.kind,'reference');
  assert.equal(result.grade,0);
  assert.doesNotMatch(result.summary,/断裂|撕裂/);
 }
});

test('all muscle origin/insertion coordinates lie on the correct anatomical side and are L-R symmetric',()=>{
 const muscles=manifest.structures.muscles;
 for(const [name,rec] of Object.entries(muscles)){
  const sign=rec.side==='l'?1:rec.side==='r'?-1:0;
  if(!sign)continue;
  for(const k of ['origin','insertion']){
   for(const patch of rec.attachmentEvidence[k]){
    assert.equal(patch.method,'decoded-world-bounds-centre');
    assert.equal(patch.side,rec.side);
    assert.ok(patch.point[0]*sign>=-0.015,name+' '+k+' '+patch.sourceNode);
   }
   const pt=rec[k];
   if(!pt)continue;
   assert.ok(pt[0]*sign>=-0.02,`wrong-side ${k} on ${name}: ${JSON.stringify(pt)}`);
  }
  if(name.endsWith('.l')){
   const other=muscles[name.slice(0,-2)+'.r'];
   if(!other)continue;
   for(const k of ['origin','insertion']){
    assert.equal(Boolean(rec[k]),Boolean(other[k]),`one-sided ${k} on ${name}`);
    if(rec[k]&&other[k]){
     assert.ok(Math.abs(rec[k][0]+other[k][0])<=0.04,`X asymmetry in ${k} for ${name}`);
     assert.ok(Math.abs(rec[k][1]-other[k][1])<=0.04,`Y asymmetry in ${k} for ${name}`);
     assert.ok(Math.abs(rec[k][2]-other[k][2])<=0.04,`Z asymmetry in ${k} for ${name}`);
    }
   }
  }
 }
});

test('all clinical soft-tissue patterns match real structures and preserve verified anatomical details',()=>{
 const allCourses=[...courses,...joints,...regionalCourses,...supplementalCourses].map(canonicalCourse);
 let total=0,axial=0;
 const axialCourses=new Set();
 assert.equal(allCourses.length,145);
 for(const course of allCourses){
  for(const [vi,variant] of course.variants.entries()){
   total++;
   const p=clinicalSoftTissueFor(course,vi,1,variant.cuts[0].bone);
   if(p?.axial){axial++;axialCourses.add(course.id);}
   for(const bone of new Set(variant.cuts.map(cut=>cut.bone))){
    for(const level of [0,1,2]){
     const profile=clinicalSoftTissueFor(course,vi,level,bone);
     assert.ok(profile?.summary,course.id+'/'+variant.id+'/'+bone);
     const items=[...(profile.deforming||[]),...(profile.adjacent||[]),...(profile.risks||[])];
     assert.ok(items.length,course.id+'/'+variant.id);
     for(const item of items){
      const names=Object.keys(manifest.structures[item.layer]||{});
      assert.ok(names.some(n=>item.pattern.test(n)),course.id+'/'+variant.id+' '+item.pattern+' '+item.label);
     }
     if(level===1&&(profile.axial||variant.textbook)){
      if(profile.axial)assert.match(profile.source,/^https:/);
      if(variant.textbook)assert.equal(profile.variantId,variant.id);
      const anatomy=resolveAnatomy(bone,course.id,variant.id);
      const plan=tissueLoadPlan(manifest,tissueLayers,anatomy,{clinical:profile});
      const roles=new Set([...plan.candidates.values()].flatMap(candidate=>candidate.roles));
      for(const item of items)assert.ok(roles.has(item),course.id+'/'+variant.id+' unavailable '+item.label);
      for(const layer of tissueLayers)assert.ok(plan.tasks.some(task=>task.layer===layer),course.id+'/'+layer);
     }
    }
   }
  }
 }
 assert.deepEqual([total,axialCourses.size,axial],[408,56,106]);
 const toeIp=clinicalSoftTissueFor({id:'toe-ip-dislocation',family:'toe-ip-dislocation'},0);
 assert.ok(toeIp.summary.includes('跖板')&&!toeIp.summary.includes('掌板'));
 const mcBase=clinicalSoftTissueFor({id:'metacarpal',family:'metacarpal'},0);
 const mcBennett=clinicalSoftTissueFor({id:'metacarpal',family:'metacarpal'},1);
 assert.equal(mcBase.deforming.find(d=>/Abductor pollicis longus/i.test(d.pattern.source)).group,'proximal');
 assert.equal(mcBennett.deforming.find(d=>/Abductor pollicis longus/i.test(d.pattern.source)).group,'distal');
 const shDis=clinicalSoftTissueFor({id:'shoulder-dislocation',family:'shoulder-dislocation'},0);
 assert.match(shDis.risks.find(r=>r.label==='腋神经').mechanism,/四边孔|后外侧/);
});
