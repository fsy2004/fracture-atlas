import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {detailRegionFor} from '../assembly-detail.js';
const root=new URL('../models/',import.meta.url);
const directory=JSON.parse(readFileSync(new URL('detail.json',root),'utf8'));
const index=JSON.parse(readFileSync(new URL('index.json',root),'utf8'));
const raw=gunzipSync(readFileSync(new URL('detail.bin.gz',root)));
const boneByMesh=new Map(index.map(bone=>[bone.mesh,bone.name]));
const names={'头颈':'head','脊柱':'spine','胸廓':'chest','骨盆':'pelvis','上肢':'arms','下肢':'legs'};
const output=new URL('detail-regions/',root);mkdirSync(output,{recursive:true});
const regions={};
for(const [label,id] of Object.entries(names)){
 const blocks=[],offsets={};let size=0;
 for(const entry of directory.entries){
  const bone=boneByMesh.get(entry.mesh);
  if(detailRegionFor(bone)!==label)continue;
  const padding=(4-size%4)%4;
  if(padding){blocks.push(Buffer.alloc(padding));size+=padding;}
  offsets[entry.mesh]=size;
  const length=entry.vertices*12+entry.indices*2;
  blocks.push(raw.subarray(entry.offset,entry.offset+length));size+=length;
 }
 const file='detail-regions/'+id+'.bin.gz',bytes=gzipSync(Buffer.concat(blocks,size),{level:9});
 writeFileSync(new URL(file,root),bytes);
 regions[label]={file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),offsets};
}
if(Object.values(regions).reduce((count,part)=>count+Object.keys(part.offsets).length,0)!==index.length)
 throw Error('Incomplete regional assembly coverage');
writeFileSync(new URL('detail-regions.json',root),JSON.stringify(regions,null,1)+'\n');
console.log(Object.entries(regions).map(([label,region])=>label+' '+region.bytes).join(', '));
