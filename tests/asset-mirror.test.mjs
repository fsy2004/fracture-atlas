import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
 raceModelFetch,
 fetchVerifiedModel,
 probeFastestSource,
 activeMirrorLabel,
 resetMirrorStatsForTests
} from '../asset-mirror.js';

const bytesOf = text => new TextEncoder().encode(text).buffer;
const shaOf = text => createHash('sha256').update(text).digest('hex');

test('raceModelFetch rejects stale/corrupt mirrors by SHA-256 and fails over to a healthy source', async () => {
 resetMirrorStatsForTests();
 const good = 'verified-femur-binary-payload';
 const bad = 'stale-old-cdn-payload-version';
 const expectedSha = shaOf(good);

 const seen = [];
 const mockFetch = async url => {
  seen.push(url);
  if (url.includes('bad.mirror')) {
   return new Response(bad, { status: 200 });
  }
  return new Response(good, { status: 200 });
 };

 const buf = await raceModelFetch('models/vhm/right-femur.bin.gz', {
  originURL: 'https://fsy2004.github.io/fracture-atlas/models/vhm/right-femur.bin.gz',
  sha256: expectedSha,
  bytes: bytesOf(good).byteLength,
  fetchImpl: mockFetch,
  hedgeMs: 25,
  sources: [
   { id: 'bad', label: 'Bad Mirror', base: 'https://bad.mirror/gh/fsy2004/fracture-atlas@main/' },
   { id: 'origin', label: '主站直连', base: null }
  ]
 });

 assert.equal(new TextDecoder().decode(buf), good);
 assert.equal(seen.length, 2);
 assert.equal(activeMirrorLabel(), '主站直连');
});

test('raceModelFetch hedges across mirrors and returns the fastest valid responder', async () => {
 resetMirrorStatsForTests();
 const payload = 'fast-mirror-model-data';
 const expectedSha = shaOf(payload);

 const mockFetch = (url, opts) => new Promise((resolve, reject) => {
  const delay = url.includes('fast.mirror') ? 15 : 400;
  const timer = setTimeout(() => resolve(new Response(payload, { status: 200 })), delay);
  opts?.signal?.addEventListener('abort', () => {
   clearTimeout(timer);
   reject(new DOMException('aborted', 'AbortError'));
  }, { once: true });
 });

 const t0 = performance.now();
 const buf = await raceModelFetch('models/soft-tissue/hip-thigh.glb', {
  originURL: 'https://fsy2004.github.io/fracture-atlas/models/soft-tissue/hip-thigh.glb',
  sha256: expectedSha,
  bytes: bytesOf(payload).byteLength,
  fetchImpl: mockFetch,
  hedgeMs: 20,
  sources: [
   { id: 'slow', label: 'Slow Origin', base: null },
   { id: 'fast', label: 'Fast Mirror', base: 'https://fast.mirror/' }
  ]
 });
 const elapsed = performance.now() - t0;

 assert.equal(new TextDecoder().decode(buf), payload);
 assert.ok(elapsed < 250, `Expected fast mirror to win quickly, got ${elapsed.toFixed(1)}ms`);
 assert.equal(activeMirrorLabel(), 'Fast Mirror');
});

test('fetchVerifiedModel respects local origin when mirrors are disabled', async () => {
 resetMirrorStatsForTests();
 const payload = 'local-dev-payload';
 const called = [];
 const buf = await fetchVerifiedModel('models/bones.bin', {
  originURL: 'models/bones.bin',
  bytes: bytesOf(payload).byteLength,
  useMirrors: false,
  useCache: false,
  fetchImpl: async url => {
   called.push(url);
   return new Response(payload, { status: 200 });
  }
 });
 assert.deepEqual(called, ['models/bones.bin']);
 assert.equal(new TextDecoder().decode(buf), payload);
});

test('a same-length corrupt cache entry is rejected and replaced by verified content',async()=>{
 const good='current-shard',bad='damaged-shard';
 assert.equal(good.length,bad.length);
 const beforeLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 const beforeCaches=Object.getOwnPropertyDescriptor(globalThis,'caches');
 let stored=bad,requests=0,deleted=false,putDone=Promise.resolve();
 Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'https:'}});
 Object.defineProperty(globalThis,'caches',{configurable:true,value:{open:async()=>({
  match:async()=>stored?new Response(stored):null,
  delete:async()=>{stored=null;deleted=true;return true;},
  put:(_key,response)=>(putDone=response.text().then(text=>{stored=text;}))
 })}});
 try{
  const module=await import('../asset-mirror.js?cache-integrity-test');
  const load=()=>module.fetchVerifiedModel('models/soft-tissue/nerves-face-1.glb',{
   sha256:shaOf(good),bytes:good.length,useMirrors:false,fetchImpl:async()=>{
    requests++;return new Response(good);
   }
  });
  assert.equal(new TextDecoder().decode(await load()),good);
  assert.equal(deleted,true);
  await putDone;
  assert.equal(new TextDecoder().decode(await load()),good);
  assert.equal(requests,1);
 }finally{
  if(beforeLocation)Object.defineProperty(globalThis,'location',beforeLocation);else delete globalThis.location;
  if(beforeCaches)Object.defineProperty(globalThis,'caches',beforeCaches);else delete globalThis.caches;
 }
});

test('concurrent requests for different versions of a model use separate in-flight promises',async()=>{
 const path='models/soft-tissue/nerves-back-1.glb', seen=[];
 const data=['version-one','version-two'];
 const buffers=await Promise.all(data.map((value,i)=>fetchVerifiedModel(path,{
  originURL:path+'?v='+i,sha256:shaOf(value),bytes:value.length,useMirrors:false,useCache:false,
  fetchImpl:async url=>{seen.push(url);await new Promise(r=>setTimeout(r,15));return new Response(value);}
 })));
 assert.deepEqual(seen,[path+'?v=0',path+'?v=1']);
 assert.deepEqual(buffers.map(buf=>new TextDecoder().decode(buf)),data);
});

test('probeFastestSource measures live RTT and promotes fastest mirror immediately', async () => {
 resetMirrorStatsForTests();
 const mockFetch = url => new Promise(resolve => {
  const delay = url.includes('fast.cdn') ? 12 : 180;
  setTimeout(() => resolve(new Response('{"ok":true}', { status: 200 })), delay);
 });

 const winner = await probeFastestSource({
  useMirrors: true,
  fetchImpl: mockFetch,
  sources: [
   { id: 'origin', label: '主站直连', base: null },
   { id: 'fast', label: '极速镜像', base: 'https://fast.cdn/' }
  ]
 });

 assert.equal(winner?.id, 'fast');
 assert.equal(activeMirrorLabel(), '极速镜像');
});
