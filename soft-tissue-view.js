import * as T from './vendor/three.module.js';
import {regionFor} from './bone-index.js?v=eedd848';

const base='./models/soft-tissue/';
const regionLabels={'头颈':'head','躯干':'trunk','上肢':'upper','下肢':'lower'};
const bounds=v=>new T.Box3(new T.Vector3(...v[0]),new T.Vector3(...v[1]));
const colour=(hex,opacity)=>new T.MeshStandardMaterial({
 color:hex,roughness:.89,side:T.DoubleSide,transparent:opacity<1,
 opacity,depthWrite:opacity===1
});
const labels=[
 [/^Gluteus medius muscle(?:\.|$)/i,'臀中肌'],[/^Sciatic nerve(?:\.|$)/i,'坐骨神经'],
 [/^Femoral artery(?:\.|$)/i,'股动脉'],[/^Femoral vein(?:\.|$)/i,'股静脉'],[/^Femoral nerve(?:\.|$)/i,'股神经'],
 [/^Median nerve(?:\.|$)/i,'正中神经'],[/^Ulnar nerve(?:\.|$)/i,'尺神经'],[/^Radial nerve(?:\.|$)/i,'桡神经'],
 [/^Brachial artery(?:\.|$)/i,'肱动脉'],[/^Axillary nerve(?:\.|$)/i,'腋神经'],
 [/^Popliteal artery(?:\.|$)/i,'腘动脉'],[/^Common fibular nerve(?:\.|$)/i,'腓总神经'],
 [/^Spinal cord$/i,'脊髓'],[/^Internal carotid artery(?:\.|$)/i,'颈内动脉']
];
const identifier=name=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
function referenceName(bone,table){
 const side=/\bleft\b/i.test(bone)?'l':/\bright\b/i.test(bone)?'r':'';
 let text=bone.replace(/ FJ\d+$/,'').replace(/\b(?:left|right) /gi,'').toLowerCase();
 text=text.replace('navicular bone of foot','navicular bone');
 const match=text.match(/^(proximal|middle|distal) phalanx of (.*)$/);
 if(match){
  const digit=match[2],foot=digit.includes('toe');
  const ord={'index finger':'second','middle finger':'third','ring finger':'fourth','little finger':'fifth','big toe':'first','little toe':'fifth',thumb:'first'};
  text=match[1]+' phalanx of '+(ord[digit]||digit.split(' ')[0])+' finger of '+(foot?'foot':'hand');
 }
 const tagged=identifier(text+side);
 return Object.keys(table).find(name=>identifier(name)===tagged);
}

let catalogue,manager;
function readCatalogue(){
 return catalogue??=fetch(base+'manifest.json').then(r=>{
  if(!r.ok)throw Error('软组织目录不可用');
  return r.json();
 }).catch(error=>{catalogue=null;throw error;});
}
function loadDecoder(){
 return manager??=Promise.all([import('./vendor/GLTFLoader.js'),import('./vendor/DRACOLoader.js')])
  .then(([{GLTFLoader},{DRACOLoader}])=>{
   const decoder=new DRACOLoader().setDecoderPath('./vendor/draco/').setWorkerLimit(2);
   return new GLTFLoader().setDRACOLoader(decoder);
  }).catch(error=>{manager=null;throw error;});
}
function disposeScene(root){
 root.traverse(node=>{if(node.isMesh)node.geometry.dispose();});
 root.removeFromParent();
}

export function prepareSoftTissues(){
 const colours={
  bones:colour(0xe1d5b9,1),muscles:colour(0xb76d60,.42),
  arteries:colour(0xaa312d,.94),veins:colour(0x377899,.92),nerves:colour(0xd5a13d,.96)
 };
 let cache=new Map();
 function materialFor(layer,name){
  return colours[layer==='vessels'?(/vein|venous|vena/i.test(name)?'veins':'arteries'):layer];
 }
 async function mergeOverview(scene,layer){
  const {mergeGeometries}=await import('./vendor/BufferGeometryUtils.js');
  const batches=new Map(),result=new T.Group();
  scene.updateMatrixWorld(true);
  scene.traverse(node=>{
   if(!node.isMesh)return;
   const key=(node.userData.name||node.name).trim();
   const material=materialFor(layer,key);
   const geometry=node.geometry.clone();
   for(const name of Object.keys(geometry.attributes))if(!['position','normal'].includes(name))geometry.deleteAttribute(name);
   if(!geometry.attributes.normal)geometry.computeVertexNormals();
   geometry.applyMatrix4(node.matrixWorld);
   if(node.matrixWorld.determinant()<0&&geometry.index){
    const ids=geometry.index.array;
    for(let i=0;i<ids.length;i+=3)[ids[i+1],ids[i+2]]=[ids[i+2],ids[i+1]];
   }
   if(!batches.has(material))batches.set(material,[]);
   batches.get(material).push(geometry);
  });
  for(const [material,geometries] of batches){
   const merged=mergeGeometries(geometries);
   if(!merged){for(const geometry of geometries)result.add(new T.Mesh(geometry,material));continue;}
   merged.computeBoundingSphere();
   for(const geometry of geometries)geometry.dispose();
   const mesh=new T.Mesh(merged,material);mesh.userData.tissueMaterial=true;
   result.add(mesh);
  }
  disposeScene(scene);
  return result;
 }
 async function getPart(part,layer,loader,signal,storage,whole){
  if(storage.has(part.file))return storage.get(part.file);
  const response=await fetch(base+part.file,{signal});
  if(!response.ok)throw Error('软组织分区不可用 '+part.file);
  const data=await response.arrayBuffer();
  if(data.byteLength!==part.bytes)throw Error('软组织分区长度不匹配');
  const {scene}=await loader.parseAsync(data,base);
  if(signal.aborted||storage!==cache){disposeScene(scene);throw new DOMException('过期的软组织加载','AbortError');}
  const usable=whole?await mergeOverview(scene,layer):scene;
  if(signal.aborted||storage!==cache){disposeScene(usable);throw new DOMException('过期的软组织加载','AbortError');}
  storage.set(part.file,usable);
  return usable;
 }
 async function load(layers,bone,signal,section=''){
  const [manifest,loader]=await Promise.all([readCatalogue(),loadDecoder()]);
  const skeleton=manifest.structures.bones;
  const name=bone?referenceName(bone,skeleton):null,reference=name?skeleton[name]:null;
  const root=new T.Group(),tags=[],entries=[],storage=cache;
  const target=reference?bounds(reference.bounds):null;
  if(target&&section){
   const y=target.max.y-target.min.y;
   if(section==='proximal')target.min.y=target.max.y-y*.30;
   if(section==='distal')target.max.y=target.min.y+y*.30;
  }
  const local=target?.clone().expandByScalar(.070)||null;
  const centre=target?.getCenter(new T.Vector3());
  const tissuePoint=new T.Vector3();
  const selectedRegion=bone?regionLabels[regionFor(bone)]:null;
  try{
   for(const layer of ['bones',...layers]){
    const dictionary=manifest.structures[layer];
    const chosen=new Set();
    if(local){
     for(const object of Object.values(dictionary))if(local.intersectsBox(bounds(object.bounds)))chosen.add(object.region);
    }else for(const region of selectedRegion?[selectedRegion]:manifest.regions)chosen.add(region);
    if(!chosen.size&&selectedRegion)chosen.add(selectedRegion);
    for(const region of chosen){
     signal.throwIfAborted?.();
     const part=manifest.layers[layer][region];
     const scene=await getPart(part,layer,loader,signal,storage,!bone);
     entries.push(scene);scene.updateMatrixWorld(true);
     scene.traverse(node=>{
      if(!node.isMesh)return;
      const key=(node.userData.name||node.name).trim(),record=dictionary[key];
      node.visible=!local||!record||local.intersectsBox(bounds(record.bounds));
      if(!node.userData.tissueMaterial){
       node.material.dispose();
       node.material=materialFor(layer,key);node.userData.tissueMaterial=true;
      }
      if(layer!=='bones'&&local&&node.visible&&record){
       const label=labels.find(([pattern])=>pattern.test(key))?.[1];
       if(label&&!tags.some(term=>term.text===label)){
        const positions=node.geometry.attributes.position;
        const step=Math.max(1,Math.floor(positions.count/4500));
        let nearest=Infinity,point;
        for(let j=0;j<positions.count;j+=step){
         tissuePoint.fromBufferAttribute(positions,j).applyMatrix4(node.matrixWorld);
         if(!local.containsPoint(tissuePoint))continue;
         const distance=tissuePoint.distanceToSquared(centre);
         if(distance<nearest){nearest=distance;point=tissuePoint.clone();}
        }
        if(point)tags.push({text:label,point});
       }
      }
     });
    }
   }
   signal.throwIfAborted?.();
   root.add(...entries);root.updateMatrixWorld(true);
   const frame=target?target.clone().expandByScalar(section?.050:.031):new T.Box3().setFromObject(root);
   const primary=['坐骨神经','股动脉','股静脉','股神经','臀中肌'];
   if((bone||'').toLowerCase().includes('femur')&&section==='proximal')tags.sort((a,b)=>
    (primary.includes(a.text)?primary.indexOf(a.text):primary.length)-(primary.includes(b.text)?primary.indexOf(b.text):primary.length)
   );
   return {root,frame,tags:tags.slice(0,5)};
  }catch(error){root.clear();throw error;}
 }
 return {load,detach:entry=>{if(entry){entry.root.removeFromParent();entry.root.clear();}},clear(){
  const old=cache;cache=new Map();for(const scene of old.values())disposeScene(scene);
 }};
}
