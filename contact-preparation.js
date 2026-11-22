import {cutTemplate,sourceVersion} from './section-cache.js';

const owners=new WeakMap(),budget=24*1024*1024,lru=new Set();
let bytes=0;
function evict(entry){
 if(!entry?.packed)return;
 lru.delete(entry);bytes-=entry.bytes;entry.packed=null;
}
export function preparedTree(shell,cap){
 const original=cutTemplate(shell),other=cap?cutTemplate(cap):null;
 const stamp=sourceVersion(original)+'|'+(other?sourceVersion(other):'');
 let entry=owners.get(original);
 if(!entry||entry.stamp!==stamp){
  evict(entry);entry={stamp,packed:null,bytes:0};owners.set(original,entry);
 }
 if(entry.packed){lru.delete(entry);lru.add(entry);}
 return entry;
}
export function keepTree(entry,packed){
 if(entry.packed)return;
 const size=packed.index.byteLength+packed.roots.reduce((n,buffer)=>n+buffer.byteLength,0);
 if(size>budget)return;
 while(bytes+size>budget)evict(lru.values().next().value);
 entry.bytes=size;entry.packed=packed;bytes+=size;lru.add(entry);
}

// Start only after the current UI task returns. Send one mesh at a time to bound
// transient copies. Switching a lesson cancels its worker and all pending work.
export function warmContactTrees(bodies){
 if(typeof Worker==='undefined')return ()=>{};
 const queue=bodies.map(b=>b.prepare).filter(Boolean);
 if(!queue.length)return ()=>{};
 let worker=null,blobURL=null,timer=null,active=null,closed=false;
 function close(){
  closed=true;clearTimeout(timer);queue.length=0;active=null;
  if(worker){worker.terminate();worker=null;}
  if(blobURL){URL.revokeObjectURL(blobURL);blobURL=null;}
 }
 function next(){
  if(closed)return;
  try{
   while(queue.length){
    const job=queue.shift()();
    if(!job||job.entry.packed)continue;
    if(!worker){
     const embedded=document.getElementById('contactWorkerSource');
     if(embedded)blobURL=URL.createObjectURL(new Blob([embedded.textContent],{type:'text/javascript'}));
     worker=new Worker(blobURL||new URL('./contact-worker.js',import.meta.url),{type:embedded?'classic':'module'});
     worker.onerror=event=>{event.preventDefault();close();};worker.onmessageerror=close;
     worker.onmessage=({data})=>{if(!closed){keepTree(active,data);active=null;next();}};
    }
    active=job.entry;
    const p=job.shell.attributes.position.array,c=job.cap?.attributes.position.array;
    const positions=new Float32Array(p.length+(c?.length||0));positions.set(p);if(c)positions.set(c,p.length);
    const index=job.cap?null:job.shell.index?.array.slice();
    worker.postMessage({positions,index},index?[positions.buffer,index.buffer]:[positions.buffer]);return;
   }
  }catch{ /* Local browser policy or a stale worker URL. The live exact builder remains available. */ }
  close();
 }
 timer=setTimeout(next,0);return close;
}
