// Multi-CDN mirror racing, entry-time fastest-source probing, SHA-256
// integrity verification, and persistent CacheStorage disk caching for
// large 3D bone & soft-tissue model binaries.
//
// - Local dev (localhost/127.0.0.1/file:) always reads directly from origin.
// - On GitHub Pages & Cloudflare Pages, probes all candidate mirrors on page
//   entry (~150-400 ms) so every model load immediately routes to the user's
//   fastest live mirror, with parallel top-2 racing on cold cache and
//   cryptographic SHA-256 / byte-length verification.

const CACHE_NAME = 'fracture-atlas-models-v3';
const STATS_KEY = 'atlas_mirror_stats_v2';
const GITHUB_PAGES_ORIGIN = 'https://fsy2004.github.io';
const CF_PAGES_ORIGIN = 'https://fracture-atlas-13k.pages.dev';
const REPO_SLUG = 'fsy2004/fracture-atlas';
const PROBE_ASSET = 'models/provenance.json';

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
let probePromise = null;
let probed = false;

function loadSavedStats() {
 try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STATS_KEY) : null;
  if (!raw) return;
  const parsed = JSON.parse(raw);
  if (!parsed || Date.now() - (parsed.savedAt || 0) > 3 * 86400_000) return;
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

function cacheRequestKey(path, { originURL = path, sha256, bytes } = {}) {
 const tag = new URLSearchParams({origin: String(originURL), sha256: sha256 || '', bytes: String(bytes || 0)});
 return `https://atlas-model-cache.local/${cleanAssetPath(path)}?${tag}`;
}

let loggedMissingCrypto = false;
async function sha256Hex(buffer) {
 if (!globalThis.crypto?.subtle) return null;
 const digest = await crypto.subtle.digest('SHA-256', buffer);
 return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyBytes(buffer, { bytes, sha256 } = {}) {
 if (bytes && buffer.byteLength !== bytes) {
  throw Error(`模型长度不匹配 (${buffer.byteLength} != ${bytes})`);
 }
 if (sha256) {
  const actual = await sha256Hex(buffer);
  if (!actual && !loggedMissingCrypto) {
   loggedMissingCrypto = true;
   console.warn('此环境无法进行模型 SHA-256 校验，仍会核对文件长度。');
  }
  if (actual && actual !== sha256) {
   throw Error('模型校验和不一致');
  }
 }
 return buffer;
}

function availableSources() {
 const currentOrigin = typeof location !== 'undefined' ? location.origin : '';
 return MIRROR_SOURCES.filter(s => !s.base || !currentOrigin || !s.base.startsWith(currentOrigin + '/'));
}

function rankedSources() {
 // Default preference before live probe completes
 const defaultOrder = { cfpages: 820, jsdmirror: 900, origin: 960, fastly: 1120, onmicrosoft: 1180, jsdelivr: 1300, gcore: 1450 };
 return availableSources().sort((a, b) => {
  const sa = sourceStats.get(a.id);
  const sb = sourceStats.get(b.id);
  const scoreA = (sa ? sa.ewma : defaultOrder[a.id] ?? 2000) + (sa?.fails || 0) * 8000;
  const scoreB = (sb ? sb.ewma : defaultOrder[b.id] ?? 2000) + (sb?.fails || 0) * 8000;
  return scoreA - scoreB;
 });
}

function recordSuccess(source, elapsedMs, byteLength) {
 const mb = Math.max(0.25, byteLength / 1048576);
 const normalized = elapsedMs / mb;
 const prev = sourceStats.get(source.id);
 const ewma = prev ? prev.ewma * 0.50 + normalized * 0.50 : normalized;
 sourceStats.set(source.id, { ewma, fails: 0 });
 lastWinner = source;
 saveStats();
}

function recordFailure(source) {
 const prev = sourceStats.get(source.id);
 sourceStats.set(source.id, {
  ewma: prev?.ewma ?? 3500,
  fails: Math.min(5, (prev?.fails || 0) + 1)
 });
}

function buildSourceURL(source, path, originURL) {
 if (!source.base) return originURL || path;
 return source.base + cleanAssetPath(path);
}

/**
 * Entry-time multi-source speed probe:
 * Races a tiny (~0.5 KB) JSON file across all candidate mirrors in parallel so
 * we know the live fastest mirror on the user's current network within ~200 ms.
 * Resolves as soon as the fastest healthy source responds (others continue
 * updating scores quietly in the background).
 */
export function probeFastestSource({
 fetchImpl = fetch,
 sources = null,
 timeoutMs = 3500,
 useMirrors = mirrorsEnabled()
} = {}) {
 if (!useMirrors) return Promise.resolve(null);
 if (probePromise) return probePromise;

 const list = sources ? [...sources] : availableSources();
 if (list.length <= 1) return Promise.resolve(list[0] || null);

 probePromise = new Promise(resolve => {
  let resolved = false;
  let remaining = list.length;
  const finish = winner => {
   if (resolved) return;
   resolved = true;
   probed = true;
   if (winner) lastWinner = winner;
   saveStats();
   resolve(winner);
  };

  for (const source of list) {
   const ctrl = new AbortController();
   const timer = setTimeout(() => ctrl.abort(), timeoutMs);
   const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
   const url = buildSourceURL(source, PROBE_ASSET, PROBE_ASSET) + '?p=' + (Date.now() & 65535);
   const opts = source.base
    ? { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: ctrl.signal }
    : { cache: 'no-store', signal: ctrl.signal };

   fetchImpl(url, opts)
    .then(async res => {
     if (!res.ok) throw Error(`HTTP ${res.status}`);
     await res.text();
     const rtt = Math.max(15, (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started);
     // Weight live RTT strongly so current network wins immediately over stale saved scores
     const prev = sourceStats.get(source.id);
     const score = prev ? prev.ewma * 0.25 + rtt * 2.2 : rtt * 2.2;
     sourceStats.set(source.id, { ewma: score, fails: 0 });
     finish(source);
    })
    .catch(() => {
     recordFailure(source);
    })
    .finally(() => {
     clearTimeout(timer);
     remaining--;
     if (remaining === 0) finish(rankedSources()[0] || null);
    });
  }
 });

 return probePromise;
}

async function fetchFromSource(source, path, { originURL, bytes, sha256, signal, fetchImpl = fetch, timeoutMs = 20000 }) {
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
  ctrl.signal.throwIfAborted();
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
 * Race multiple sources with fast parallel start + staggered hedging:
 * - Launches `initialParallel` top-ranked sources immediately (default 2 on
 *   unprobed cold start, 1 once a fast winner is established with quick hedge).
 * - Hedges additional mirrors quickly (`hedgeMs`, default 500 ms).
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
  hedgeMs = 500,
  initialParallel = probed ? 1 : 2,
  maxParallel = 3,
  useMirrors = mirrorsEnabled()
 } = options;

 const candidates = sources
  ? [...sources]
  : useMirrors
   ? rankedSources()
   : [MIRROR_SOURCES[0]];

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

  const burst = Math.min(Math.max(1, initialParallel), maxParallel, candidates.length);
  for (let i = 0; i < burst; i++) launchNext();
 });
}

const inflight = new Map();

export async function fetchVerifiedModel(path, options = {}) {
 const clean = cleanAssetPath(path);
 const cacheable = Boolean(options.sha256 || options.bytes) && options.useCache !== false;
 const requestKey = cacheRequestKey(clean, {...options, originURL: options.originURL || path});
 const cacheKey = cacheable ? requestKey : null;
 options.signal?.throwIfAborted();

 if (cacheKey && !options.skipCache) {
  const cache = await openModelCache();
  if (cache) {
   try {
    const hit = await cache.match(cacheKey);
    if (hit) {
     const buf = await verifyBytes(await hit.arrayBuffer(), options);
     options.signal?.throwIfAborted();
     lastWinner = { id: 'cache', label: '本地缓存' };
     return buf;
    }
   } catch {
    options.signal?.throwIfAborted();
    await cache.delete?.(cacheKey).catch(() => {});
   }
  }
 }

 options.signal?.throwIfAborted();
 if (!options.signal && inflight.has(requestKey)) {
  return inflight.get(requestKey);
 }

 const task = (async () => {
  const buffer = await raceModelFetch(clean, {...options, originURL: options.originURL || path});
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
  inflight.set(requestKey, task);
  const remove = () => inflight.delete(requestKey);
  task.then(remove, remove);
 }
 return task;
}

export function prefetchModel(path, options = {}) {
 if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return;
 return fetchVerifiedModel(path, { ...options, initialParallel: 1, hedgeMs: 1200 }).catch(() => {});
}

export function resetMirrorStatsForTests() {
 sourceStats.clear();
 lastWinner = null;
 probePromise = null;
 probed = false;
}
