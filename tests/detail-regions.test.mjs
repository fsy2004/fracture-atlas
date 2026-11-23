import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const models=new URL('../models/',import.meta.url);
const read=path=>readFileSync(new URL(path,models));
test('regional files preserve every original vertex and face, with complete coverage',()=>{
 const source=gunzipSync(read('detail.bin.gz'));
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
   const length=entry.vertices*12+entry.indices*2;
   assert.ok(data.subarray(offset,offset+length).equals(source.subarray(entry.offset,entry.offset+length)),id);
   checked.add(id);
  }
 }
 assert.equal(checked.size,original.size);
});
