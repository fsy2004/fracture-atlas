import {regionFor} from './bone-index.js?v=eedd848';
import {decodeSurfaces} from './detail.js';

// Load high-traffic limb & pelvis regions before the heavier 7.25 MB thoracic cage.
export const detailRegions=['上肢','下肢','骨盆','脊柱','头颈','胸廓'];

export function detailRegionFor(name){
 const region=regionFor(name);
 if(region!=='躯干')return region;
 if(/hip bone|sacrum/i.test(name))return '骨盆';
 if(/vertebra|^atlas$|^axis$/i.test(name))return '脊柱';
 return '胸廓';
}

export function regionsForScene(selected,course,variant){
 const members=[
  selected,course?.sourceBone,...(variant?.cuts||[]).map(cut=>cut.bone),
  ...(variant?.fixed||[]),...(variant?.context||course?.context||[]),
  ...(variant?.jointFollowers||[]),...(variant?.moving||[]).flatMap(item=>item.names||[])
 ];
 if(course?.id==='ankle')members.push('Right talus');
 if(course?.id==='single-forearm')members.push('Right ulna','Right radius');
 if(course?.id==='pelvis')members.push('Sacrum');
 // The historical joint scene can include any bones of the same limb.
 const automatic=course?.kind==='joint'&&!variant?.jointFollowers?[course.region]:[];
 return [...new Set([...members.filter(Boolean).map(detailRegionFor),...automatic.flatMap(region=>region==='躯干'?['胸廓','脊柱','骨盆']:[region])])];
}

export function assembledSurfaces(getAsset,metadata,install){
 const pending=new Map(),ready=new Set();
 let manifest;
 const regions=()=>manifest??=getAsset('models/detail-regions.json').catch(error=>{manifest=null;throw error;});
 async function load(region){
  if(ready.has(region))return;
  if(!pending.has(region))pending.set(region,(async()=>{
   const meta=await metadata(),directory=await regions(),part=directory[region];
   if(!part)throw Error('缺少精细骨面分区 '+region);
   const data=await getAsset('models/'+part.file,{bytes:part.bytes,sha256:part.sha256});
   if(data.byteLength!==part.bytes)throw Error('精细骨面分区长度不匹配');
   const entries=meta.entries.filter(entry=>Object.hasOwn(part.offsets,entry.mesh))
    .map(entry=>({...entry,offset:part.offsets[entry.mesh]}));
   const surfaces=await decodeSurfaces({...meta,entries},data);
   if(surfaces.size!==entries.length)throw Error('精细骨面分区不完整');
   install(surfaces);ready.add(region);
  })().finally(()=>pending.delete(region)));
  return pending.get(region);
 }
 return {load:regions=>Promise.all(regions.map(load)),ready:regions=>regions.every(region=>ready.has(region))};
}
