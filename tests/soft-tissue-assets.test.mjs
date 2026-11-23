import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {referenceName} from '../soft-tissue-view.js';

const base=new URL('../models/soft-tissue/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',base),'utf8'));
test('all anatomical zones have intact high resolution meshes for each layer',()=>{
 for(const layer of ['bones','muscles','vessels','nerves']){
  let vertices=0,triangles=0,count=0;
  for(const region of ['head','trunk','upper','lower']){
   const part=manifest.layers[layer][region];
   assert.ok(part.nodes>0&&part.triangles>0,layer+'/'+region);
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
  assert.ok(vertices>100000&&triangles>500000,layer);
 }
 for(const side of ['.l','.r'])for(const name of ['Sciatic nerve','Femoral nerve','Median nerve','Ulnar nerve','Radial nerve'])
  assert.ok(manifest.structures.nerves[name+side],name+side);
});

test('every selectable bone resolves to a same-side soft-tissue reference',()=>{
 const bones=JSON.parse(readFileSync(new URL('../models/index.json',import.meta.url),'utf8'));
 for(const {name} of bones){
  const reference=referenceName(name,manifest.structures.bones);
  assert.ok(reference,name);
  if(/\bleft\b/i.test(name))assert.match(reference,/\.l$/);
  if(/\bright\b/i.test(name))assert.match(reference,/\.r$/);
 }
});
