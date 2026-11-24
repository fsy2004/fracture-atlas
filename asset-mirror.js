// Multi-CDN mirror racing, SHA-256 integrity verification, and persistent
// CacheStorage disk caching for large 3D bone & soft-tissue model binaries.
//
// - Local dev (localhost/127.0.0.1/file:) always reads directly from origin.
// - On GitHub Pages (fsy2004.github.io/fracture-atlas/), large binary assets
//   race across China-friendly & global jsDelivr mirrors + origin with hedged
//   failover, cryptographic SHA-256 / exact-byte verification, and persistent
//   browser disk caching so revisits load in <10 ms.

const CACHE_NAME = 'fracture-atlas-models-v2';
const STATS_KEY = 'atlas_mirror_stats_v2';
const GITHUB_PAGES_ORIGIN = 'https://fsy2004.github.io';
const CF_PAGES_ORIGIN = 'https://fracture-atlas-13k.pages.dev';
const REPO_SLUG = 'fsy2004/fracture-atlas';

// Ordered mirror candidates (all verified CORS: *). Origin is always kept as a
// guaranteed fresh authoritative fallback.
const MIRROR_SOURCES = [
 { id: 'origin', label: '主站直连', base: null },
 { id: 'cfpages', label: 'Cloudflare 镜像', base: `${CF_PAGES_ORIGIN}/` },
 { id: 'jsdmirror', label: 'JSDMirror 加速', base: `https://cdn.jsdmirror.com/gh/${REPO_SLUG}@main/` },
 { id: 'onmicrosoft', label: 'OnMicrosoft 加速', base: `https://jsd.onmicrosoft.cn/gh/${REPO_SLUG}@main/` },
 { id: 'fastly', label: 'Fastly CDN', base: `https://fastly.jsdelivr.net/gh/${REPO_SLUG}@main/` },
 { id: 'jsdelivr', label: 'jsDelivr CDN', base: `https://cdn.jsdelivr.net/gh/${REPO_SLUG}@main/` },
 { id: 'gcore', label: 'Gcore CDN', base: `https://gcore.jsdelivr.net/gh/${REPO_SLUG}@main/` }
];

const sourceStats = new Map();
let lastWinner = null;
let cachePromise = null;

function loadSavedStats() {
 try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STATS_KEY) : null;
  if (!raw) return;
  const parsed = JSON.parse(raw);
  if (!parsed || Date.now() - (parsed.savedAt || 0) > 7 * 86400_000) return;
  for (const [id, entry] of Object.entries(parsed.scores || {})) {
   if (typeof entry?.ewma === 'number' && Number.isFinite(entry.ewma)) {
    sourceStats.set(id, { ewma: entry.ewma, fails: 0 });
   }
  }
 } catch {}
}

function saveStats() {
 try {
  if (typeof localStorage === 'undefined') return;
  const scores = {};
  for (const [id, entry] of sourceStats) {
   if (entry.ewma < 60_000) scores[id] = { ewma: Math.round(entry.ewma) };
  }
  localStorage.setItem(STATS_KEY, JSON.stringify({ savedAt: Date.now(), scores }));
 } catch {}
}

loadSavedStats();

export function mirrorsEnabled() {
 if (typeof location === 'undefined') return false;
 if (location.protocol === 'file:') return false;
 if (new URLSearchParams(location.search).get('mirror') === 'off') return false;
 if (location.origin === GITHUB_PAGES_ORIGIN && location.pathname.startsWith('/fracture-atlas/')) return true;
 if (location.origin === CF_PAGES_ORIGIN || location.hostname.endsWith('.fracture-atlas-13k.pages.dev')) return true;
 return false;
}

export function activeMirrorLabel() {
 return lastWinner?.label || '';
}

function openModelCache() {
 if (typeof caches === 'undefined' || typeof location === 'undefined' || location.protocol === 'file:') {
  return Promise.resolve(null);
 }
 return cachePromise ??= caches.open(CACHE_NAME).catch(() => {
  cachePromise = null;
  return null;
 });
}

function cleanAssetPath(path) {
 return String(path || '').replace(/^\.\//, '').split('?')[0];
}

function cacheRequestKey(path, { sha256, bytes } = {}) {
 const tag = sha256 ? sha256.slice(0, 16) : bytes ? 'b' + bytes : 'v1';
 return `https://atlas-model-cache.local/${cleanAssetPath(path)}?v=${tag}`;
}

async function sha256Hex(buffer) {
 if (typeof crypto === 'undefined' || !crypto.subtle) return null;
 const digest = await crypto.subtle.digest('SHA-256', buffer);
 return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyBytes(buffer, { bytes, sha256 } = {}) {
 if (bytes && buffer.byteLength !== bytes) {
  throw Error(`模型长度不匹配 (${buffer.byteLength} != ${bytes})`);
 }
 if (sha256) {
  const actual = await sha256Hex(buffer);
  if (actual && actual !== sha256) {
   throw Error('模型校验和不一致');
  }
 }
 return buffer;
}

function rankedSources() {
 // Default preference prioritizes Cloudflare Pages + China-friendly mirror + origin
 const defaultOrder = { cfpages: 820, jsdmirror: 900, origin: 960, fastly: 1120, onmicrosoft: 1180, jsdelivr: 1300, gcore: 1450 };
 const currentOrigin = typeof location !== 'undefined' ? location.origin : '';
 return MIRROR_SOURCES
  .filter(s => !s.base || !currentOrigin || !s.base.startsWith(currentOrigin + '/'))
  .sort((a, b) => {
   const sa = sourceStats.get(a.id);
   const sb = sourceStats.get(b.id);
   const scoreA = (sa ? sa.ewma : defaultOrder[a.id] ?? 2000) + (sa?.fails || 0) * 8000;
   const scoreB = (sb ? sb.ewma : defaultOrder[b.id] ?? 2000) + (sb?.fails || 0) * 8000;
   return scoreA - scoreB;
  });
}

function recordSuccess(source, elapsedMs, byteLength) {
 // Normalize by size so small and large files share comparable latency+throughput score
 const mb = Math.max(0.25, byteLength / 1048576);
 const normalized = elapsedMs / mb;
 const prev = sourceStats.get(source.id);
 const ewma = prev ? prev.ewma * 0.55 + normalized * 0.45 : normalized;
 sourceStats.set(source.id, { ewma, fails: 0 });
 lastWinner = source;
 saveStats();
}

function recordFailure(source) {
 const prev = sourceStats.get(source.id);
 sourceStats.set(source.id, {
  ewma: prev?.ewma ?? 3000,
  fails: Math.min(5, (prev?.fails || 0) + 1)
 });
}

function buildSourceURL(source, path, originURL) {
 if (!source.base) return originURL || path;
 return source.base + cleanAssetPath(path);
}

async function fetchFromSource(source, path, { originURL, bytes, sha256, signal, fetchImpl = fetch, timeoutMs = 22000 }) {
 const url = buildSourceURL(source, path, originURL);
 const ctrl = new AbortController();
 const onParentAbort = () => ctrl.abort(signal?.reason);
 if (signal) {
  if (signal.aborted) throw new DOMException('已取消加载', 'AbortError');
  signal.addEventListener('abort', onParentAbort, { once: true });
 }
 const timer = setTimeout(() => ctrl.abort(new Error('镜像超时')), timeoutMs);
 const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
 try {
  const opts = source.base
   ? { mode: 'cors', credentials: 'omit', signal: ctrl.signal }
   : { signal: ctrl.signal };
  const response = await fetchImpl(url, opts);
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  await verifyBytes(buffer, { bytes, sha256 });
  const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  recordSuccess(source, elapsed, buffer.byteLength);
  return { buffer, source };
 } catch (err) {
  if (!signal?.aborted) recordFailure(source);
  throw err;
 } finally {
  clearTimeout(timer);
  signal?.removeEventListener('abort', onParentAbort);
 }
}

/**
 * Race multiple sources with staggered hedging:
 * - Launches top-ranked source immediately.
 * - If not done within hedgeMs (default 850 ms), launches the next source in parallel.
 * - Guarantees `origin` is always included in the candidate list.
 * - Cancels slower in-flight downloads the instant a verified winner arrives.
 */
export async function raceModelFetch(path, options = {}) {
 const {
  originURL = path,
  bytes = 0,
  sha256 = '',
  signal = null,
  fetchImpl = fetch,
  sources = null,
  hedgeMs = 850,
  maxParallel = 3,
  useMirrors = mirrorsEnabled()
 } = options;

 const candidates = sources
  ? [...sources]
  : useMirrors
   ? rankedSources()
   : [MIRROR_SOURCES[0]];

 // Ensure origin is always reachable as fallback even if mirrors fail or serve stale cache
 if (!candidates.some(s => s.id === 'origin')) {
  candidates.push(MIRROR_SOURCES[0]);
 }

 if (candidates.length === 1) {
  const { buffer } = await fetchFromSource(candidates[0], path, { originURL, bytes, sha256, signal, fetchImpl });
  return buffer;
 }

 const raceCtrl = new AbortController();
 const onExternalAbort = () => raceCtrl.abort(signal?.reason);
 if (signal) {
  if (signal.aborted) throw new DOMException('已取消加载', 'AbortError');
  signal.addEventListener('abort', onExternalAbort, { once: true });
 }

 return new Promise((resolve, reject) => {
  let nextIdx = 0;
  let active = 0;
  let settled = false;
  let hedgeTimer = null;
  const errors = [];

  const cleanup = () => {
   clearTimeout(hedgeTimer);
   signal?.removeEventListener('abort', onExternalAbort);
  };

  const launchNext = () => {
   if (settled || nextIdx >= candidates.length || active >= maxParallel) return;
   const source = candidates[nextIdx++];
   active++;
   fetchFromSource(source, path, {
    originURL,
    bytes,
    sha256,
    signal: raceCtrl.signal,
    fetchImpl
   }).then(({ buffer }) => {
    if (settled) return;
    settled = true;
    cleanup();
    raceCtrl.abort();
    resolve(buffer);
   }).catch(err => {
    active--;
    if (settled) return;
    if (signal?.aborted) {
     settled = true;
     cleanup();
     reject(err);
     return;
    }
    errors.push(`${source.id}: ${err?.message || err}`);
    if (nextIdx < candidates.length) {
     clearTimeout(hedgeTimer);
     launchNext();
    } else if (active === 0) {
     settled = true;
     cleanup();
     reject(new Error(`所有节点均载入失败 (${cleanAssetPath(path)}): ${errors.join('; ')}`));
    }
   });

   if (!settled && nextIdx < candidates.length && active < maxParallel) {
    clearTimeout(hedgeTimer);
    hedgeTimer = setTimeout(launchNext, hedgeMs * active);
   }
  };

  launchNext();
 });
}

const inflight = new Map();

/**
 * Fetch a binary model asset with:
 * 1. Persistent browser CacheStorage lookup (keyed by SHA-256 / byte size)
 * 2. Request deduplication for concurrent callers
 * 3. Multi-CDN hedged mirror racing + integrity verification
 * 4. Automatic write-back to CacheStorage
 */
export async function fetchVerifiedModel(path, options = {}) {
 const clean = cleanAssetPath(path);
 const cacheable = Boolean(options.sha256 || options.bytes) && options.useCache !== false;
 const cacheKey = cacheable ? cacheRequestKey(clean, options) : null;

 if (cacheKey && !options.skipCache) {
  const cache = await openModelCache();
  if (cache) {
   try {
    const hit = await cache.match(cacheKey);
    if (hit) {
     const buf = await hit.arrayBuffer();
     if (!options.bytes || buf.byteLength === options.bytes) {
      lastWinner = { id: 'cache', label: '本地缓存秒开' };
      return buf;
     }
    }
   } catch {}
  }
 }

 // Deduplicate identical non-abortable or shared fetches
 if (!options.signal && inflight.has(clean)) {
  return inflight.get(clean);
 }

 const task = (async () => {
  const buffer = await raceModelFetch(clean, options);
  if (cacheKey) {
   const cache = await openModelCache();
   if (cache) {
    cache.put(cacheKey, new Response(buffer.slice(0), {
     headers: { 'Content-Type': 'application/octet-stream' }
    })).catch(() => {});
   }
  }
  return buffer;
 })();

 if (!options.signal) {
  inflight.set(clean, task);
  task.finally(() => inflight.delete(clean));
 }
 return task;
}

/**
 * Lightweight background prefetch into CacheStorage (never throws, respects Save-Data).
 */
export function prefetchModel(path, options = {}) {
 if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return;
 fetchVerifiedModel(path, options).catch(() => {});
}

export function resetMirrorStatsForTests() {
 sourceStats.clear();
 lastWinner = null;
}
