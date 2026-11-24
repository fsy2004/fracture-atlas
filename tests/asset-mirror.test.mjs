import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
 raceModelFetch,
 fetchVerifiedModel,
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
