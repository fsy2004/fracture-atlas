// Cache only immutable, loaded source anatomy. Every caller receives mutable scene-owned
// geometry, so morph targets, crack outlines, draw ranges and GPU disposal stay independent.
const limit=(globalThis.navigator?.deviceMemory<=4?32:64)*1024*1024;
const sources=new WeakMap(),lru=new Set(),ids=new WeakMap();
let nextId=1,used=0;
const templates=new WeakMap();
export function cutTemplate(g){
 const ref=templates.get(g),p=g.attributes.position;
 return ref&&ref.positions===p&&ref.version===p.version?ref.original:g;
}
function associate(parts,original){
 for(let j=0;j<parts.length;j++)for(const key of ['geo','face']){
  const g=parts[j][key],positions=g.attributes.position;
  templates.set(g,{original:original[j][key],positions,version:positions.version});
 }
 return parts;
}
function id(value){
 if(!value)return 0;
 if(!ids.has(value))ids.set(value,nextId++);
 return ids.get(value);
}
export function sourceVersion(g){
 const p=g.attributes.position,n=g.attributes.normal,i=g.index;
 return [id(p),p.version,id(p.array),id(n),n?.version,id(n?.array),id(i),i?.version,id(i?.array)].join('/');
}
export const nativeGeometry=g=>Boolean(g.userData.specimen||g.userData.landmarkMap);
export function cutKey(g,normal,anchor,fold,height,axis,posterior,relief){
 return [sourceVersion(g),normal.join(','),anchor.join(','),fold,height,axis.join(','),posterior,
  relief?.amplitude,relief?.spacing,relief?.seed,relief?.canal,id(relief?.ct)].join('|');
}
function duplicate(parts){
 const copy=g=>{const c=g.clone();c.userData={...g.userData};return c;};
 return parts.map(({geo,face,outline})=>({geo:copy(geo),face:copy(face),outline:copy(outline)}));
}
function forget(entry){
 lru.delete(entry);entry.bucket.delete(entry.key);used-=entry.bytes;
}
export function cachedCut(g,key,build){
 let bucket=sources.get(g);
 if(!bucket){
  bucket=new Map();sources.set(g,bucket);
  function release(){for(const entry of bucket.values())forget(entry);g.removeEventListener('dispose',release);sources.delete(g);}
  g.addEventListener('dispose',release);
 }
 const old=bucket.get(key);
 if(old){lru.delete(old);lru.add(old);return associate(duplicate(old.parts),old.parts);}
 const parts=build();let bytes=0;
 for(const part of parts)for(const geometry of [part.geo,part.face,part.outline]){
  for(const attr of Object.values(geometry.attributes))bytes+=attr.array.byteLength;
 }
 if(bytes>limit||bytes===0)return parts;
 while(used+bytes>limit)forget(lru.values().next().value);
 const entry={key,bucket,bytes,parts:duplicate(parts)};
 bucket.set(key,entry);lru.add(entry);used+=bytes;
 return associate(parts,entry.parts);
}
