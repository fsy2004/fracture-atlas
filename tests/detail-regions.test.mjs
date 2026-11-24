import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const models=new URL('../models/',import.meta.url);
const read=path=>readFileSync(new URL(path,models));
test('regional files preserve every verified vertex and face, with complete 201-bone coverage',()=>{
 const metadata=JSON.parse(read('detail.json'));
 const original=new Map(metadata.entries.map(entry=>[entry.mesh,entry]));
 const checked=new Set();
 for(const region of Object.values(JSON.parse(read('detail-regions.json')))){
  const bytes=read(region.file),data=gunzipSync(bytes);
  assert.equal(bytes.length,region.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),region.sha256);
  for(const [id,offset] of Object.entries(region.offsets)){
   assert.ok(!checked.has(id),'duplicate surface '+id);
   const entry=original.get(id);
   assert.ok(entry,'unknown surface '+id);
   const vBytes=entry.vertices*12,iBytes=entry.indices*2;
   assert.ok(offset+vBytes+iBytes<=data.length,id);
   const xyz=data.subarray(offset,offset+vBytes);
   assert.equal(createHash('sha256').update(xyz).digest('hex'),entry.native_xyz_sha256,id);
   checked.add(id);
  }
 }
 assert.equal(checked.size,original.size);
});
