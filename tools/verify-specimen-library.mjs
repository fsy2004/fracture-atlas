// Audit the actual files distributed by the atlas and distinguish an index from an accessory.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const models=new URL('../models/',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,models));
const sha=b=>createHash('sha256').update(b).digest('hex');
const base=JSON.parse(read('vhm/manifest.json')),extras=JSON.parse(read('extended/manifest.json')),idx=JSON.parse(read('index.json'));
const primary=new Map(),hist={},keys=new Set();
for(const [dir,entries] of [['vhm/',base.entries],['extended/',extras.entries]])for(const e of entries){
 const k=dir+e.file;assert.ok(!keys.has(k),'duplicate asset '+k);keys.add(k);
 const blob=read(k),raw=gunzipSync(blob);assert.equal(sha(blob),e.sha256,k);assert.equal(sha(raw),e.packed_raw_sha256,k);
 assert.equal(e.triangles*3,e.indices,k);assert.equal(raw.byteLength,e.vertices*12+e.indices*4,k);
 for(let i=e.vertices*12;i<raw.length;i+=4)assert.ok(raw.readUInt32LE(i)<e.vertices,k);
 if(e.face_confidence){
  const data=read(dir+e.face_confidence),classes=gunzipSync(data);
  assert.equal(sha(data),e.face_confidence_sha256,k);assert.equal(classes.length,e.triangles);
  assert.ok(e.oralTrace.source_triangle_ids.every(id=>classes[id]===0),k);
 }
 if(!['context','region'].includes(e.role)&&!primary.has(e.mesh)){
  primary.set(e.mesh,e.name);const source=e.collection||'VHM';hist[source]=(hist[source]||0)+1;
 }
}
for(const item of idx)assert.ok(primary.has(item.mesh),'missing '+item.name);
assert.equal(primary.size,idx.length);
console.log(JSON.stringify({index:idx.length,indexWithSpecimenOrRegion:primary.size,primary:hist,geometryFiles:keys.size},null,2));
