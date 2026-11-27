import * as T from './vendor/three.module.js';
import {
 isSoftTissueSupported,
 resolveAnatomy,
 loadAxialTerms,
 softTissueInfo,
 zonesForBone,
 ZONE_LABELS,
 DEPTH_LABELS
} from './soft-tissue-catalog.js?v=whole-body1';
import { classifyNodeRoles } from './soft-tissue-clinical.js?v=whole-body1';
import { fetchVerifiedModel, prefetchModel } from './asset-mirror.js?v=whole-body1';

const base = './models/soft-tissue/';
const bounds = v => new T.Box3(new T.Vector3(...v[0]), new T.Vector3(...v[1]));
const partURL = part => base + part.file + '?v=' + part.sha256;

function makeMaterial({
 color, opacity = 1, roughness = 0.48, metalness = 0.04,
 clearcoat = 0.25, clearcoatRoughness = 0.42,
 emissive = 0x000000, emissiveIntensity = 0, depthWrite = null
}) {
 const dw = depthWrite !== null ? depthWrite : opacity >= 0.82;
 return new T.MeshPhysicalMaterial({
  color,
  roughness,
  metalness,
  clearcoat,
  clearcoatRoughness,
  emissive,
  emissiveIntensity,
  side: opacity < 0.85 ? T.FrontSide : T.DoubleSide,
  transparent: opacity < 0.99,
  opacity,
  depthWrite: dw
 });
}

// Lightweight radial caliber calibration + subtle organic micro-sheen for static (non-animated) views
function applyStaticCaliber(material, offsetM) {
 if (!offsetM) return;
 material.onBeforeCompile = shader => {
  shader.uniforms.caliberOffset = { value: offsetM };
  shader.vertexShader = `uniform float caliberOffset;\n` + shader.vertexShader.replace(
   '#include <begin_vertex>',
   `#include <begin_vertex>\ntransformed += normalize(normal) * caliberOffset;`
  );
 };
 material.customProgramCacheKey = () => 'atlas-caliber-static-' + offsetM.toFixed(5);
 material.needsUpdate = true;
}

const identifier = name => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];

export function referenceName(bone, table) {
 const side = /\bleft\b/i.test(bone) ? 'l' : /\bright\b/i.test(bone) ? 'r' : '';
 let text = bone.replace(/ FJ\d+$/, '').replace(/\b(?:left|right) /gi, '').toLowerCase();
 text = text.replace('navicular bone of foot', 'navicular bone');
 if (text === 'atlas') text = 'atlas (c1)';
 if (text === 'axis') text = 'axis (c2)';
 if (text === 'ethmoid') text = 'ethmoid bone';
 if (text === 'sesamoid bone of foot') text = 'sesamoid bones of foot';
 if (text === 'manubrium') text = 'manubrium of sternum';
 if (text === 'triquetral') text = 'triquetrum bone';
 if (/^(scaphoid|lunate|pisiform|trapezium|trapezoid|capitate|hamate)$/.test(text)) text += ' bone';
 const column = text.match(/^(\w+) (cervical|thoracic|lumbar) vertebra$/);
 if (column) {
  const number = ordinals.indexOf(column[1]) + 1;
  if (number) text = 'vertebra ' + column[2][0] + number;
 }
 const match = text.match(/^(proximal|middle|distal) phalanx of (.*)$/);
 if (match) {
  const digit = match[2], foot = digit.includes('toe');
  const ord = {
   'index finger': 'second', 'middle finger': 'third', 'ring finger': 'fourth',
   'little finger': 'fifth', 'big toe': 'first', 'little toe': 'fifth', thumb: 'first'
  };
  text = match[1] + ' phalanx of ' + (ord[digit] || digit.split(' ')[0]) + ' finger of ' + (foot ? 'foot' : 'hand');
 }
 const tagged = identifier(text + side);
 return Object.keys(table).find(name => identifier(name) === tagged);
}

export function referenceBones(bone, courseId = '') {
 const title = word => word[0].toUpperCase() + word.slice(1);
 const name = bone.toLowerCase();
 if (/^atlas$|^axis$|cervical vertebra|thoracic vertebra|lumbar vertebra/.test(name)) {
  const names = ['Atlas', 'Axis', ...ordinals.slice(2, 7).map(word => title(word) + ' cervical vertebra'),
   ...ordinals.map(word => title(word) + ' thoracic vertebra'),
   ...ordinals.slice(0, 5).map(word => title(word) + ' lumbar vertebra')];
  const i = names.indexOf(bone);
  return [names[i - 1] || 'Occipital bone', names[i + 1] || 'Sacrum', names[i + 2] || names[i - 2]].filter(Boolean);
 }
 const rib = bone.match(/^(Left|Right) (.+) rib$/);
 if (rib) {
  const i = ordinals.indexOf(rib[2]), sameSide = rib[1];
  return [`${sameSide === 'Left' ? 'Right' : 'Left'} ${rib[2]} rib`, 'Manubrium', title(rib[2]) + ' thoracic vertebra',
   `${sameSide} ${ordinals[i === 0 ? 1 : i - 1]} rib`];
 }
 if (/sternum|^manubrium$|xiphoid/.test(name)) {
  const n = name.includes('xiphoid') ? 'sixth' : 'first';
  return ['Manubrium', 'Body of sternum', `Left ${n} rib`, `Right ${n} rib`].filter(x => x !== bone);
 }
 if (/sacrum|coccyx|hip bone/.test(name)) return ['Left hip bone', 'Right hip bone', 'Sacrum'].filter(x => x !== bone);
 if (name === 'hyoid bone') return ['Mandible', 'Axis', 'Fourth cervical vertebra'];
 if (courseId === 'tmj-dislocation' || name === 'mandible') return ['Left temporal bone', 'Right temporal bone', 'Sphenoid bone'];
 return ['Left temporal bone', 'Right temporal bone', 'Sphenoid bone', 'Mandible', 'Frontal bone'].filter(x => x !== bone);
}

export function partsFor(manifest, layer, zone) {
 const value = manifest.layers[layer]?.[zone];
 return value ? Array.isArray(value) ? value : [value] : [];
}

const regionIndex = new WeakMap();
function nearbyRecords(manifest, layer, zones) {
 if (!regionIndex.has(manifest)) {
  const layers = {};
  for (const [key, structures] of Object.entries(manifest.structures)) {
   layers[key] = new Map();
   for (const row of Object.entries(structures)) {
    const [name, record] = row;
    if (!layers[key].has(record.region)) layers[key].set(record.region, []);
    layers[key].get(record.region).push([name, record]);
   }
  }
  regionIndex.set(manifest, layers);
 }
 return zones.flatMap(zone => regionIndex.get(manifest)[layer]?.get(zone) || []);
}

export function tissueLoadPlan(manifest, layers, anatomy, options = {}) {
 const {section = '', courseId = anatomy.courseId, clinical = null, focusOnly = true, anchorBones = []} = options;
 const skeleton = manifest.structures.bones;
 const name = referenceName(anatomy.bone, skeleton);
 const reference = skeleton[name];
 if (!reference) throw Error('未找到该骨骼的软组织配准参照');
 const referenceNames = new Map([[name, anatomy.bone]]);
 const regionBones = /^(tmj-dislocation|pelvis)$/.test(courseId) ? referenceBones(anatomy.bone, courseId) : [];
 if (anatomy.bone === 'Sacrum') regionBones.push('Coccyx');
 for (const bone of [...anchorBones, ...regionBones]) {
  const key = referenceName(bone, skeleton);
  if (key && !referenceNames.has(key)) referenceNames.set(key, bone);
 }
 const target = bounds(reference.bounds), full = target.clone();
 if (courseId === 'pelvis') {
  for (const key of referenceNames.keys()) full.union(bounds(skeleton[key].bounds));
  target.copy(full);
 }
 const y = target.max.y - target.min.y;
 if (section === 'proximal') target.min.y = target.max.y - y * 0.38;
 if (section === 'distal') target.max.y = target.min.y + y * 0.38;
 const extent = target.getSize(new T.Vector3()).length();
 const margin = anatomy.axial ? T.MathUtils.clamp(extent * 0.36, 0.025, 0.06) : 0.058;
 const local = target.clone().expandByScalar(margin);
 const clinicalBox = full.clone().expandByScalar(anatomy.axial ? margin * 2 : 0.16);
 const side = anatomy.injurySide === 'left' ? 'l' : anatomy.injurySide === 'right' ? 'r' : '';
 const tasks = new Map();
 function addPart(layer, record) {
  for (const part of partsFor(manifest, layer, record.region)) {
   if (record.ownerPart && part.file !== record.ownerPart) continue;
   tasks.set(part.file, {layer, zone: record.region, part});
  }
 }
 for (const key of referenceNames.keys()) addPart('bones', skeleton[key]);
 const candidates = new Map();
 for (const layer of layers) {
  const rows = anatomy.axial ? nearbyRecords(manifest, layer, anatomy.zones) : Object.entries(manifest.structures[layer]);
  const matching = [];
  for (const [key, record] of rows) {
   if (side && record.side && record.side !== side) continue;
   if (!anatomy.axial && record.limb && reference.limb !== record.limb) continue;
   const box = bounds(record.bounds);
   const nearLocal = local.intersectsBox(box);
   const roles = classifyNodeRoles(layer, key, clinical);
   const relevant = roles.length && clinicalBox.intersectsBox(box);
   if (relevant || nearLocal && (anatomy.axial || anatomy.zones.includes(record.region))) {
    matching.push([key, {record, roles: relevant ? roles : [], nearLocal}]);
   }
  }
  const focus = anatomy.axial && focusOnly && matching.some(([, entry]) => entry.roles.length);
  for (const [key, entry] of matching) {
   if (focus && !entry.roles.length) continue;
   candidates.set(layer + ':' + key, entry);
   addPart(layer, entry.record);
  }
 }
 return {name, target, local, referenceNames, candidates, tasks: [...tasks.values()]};
}

// The source stores both hallux sesamoids in one Draco mesh per foot.
export function sesamoidComponent(source, side, component) {
 const {geometry, matrixWorld} = source;
 const positions = geometry.attributes.position, index = geometry.index?.array;
 if (!component || !index) return null;
 const parent = Uint32Array.from({length: positions.count}, (_, i) => i);
 function root(i) {
  while (i !== parent[i]) { parent[i] = parent[parent[i]]; i = parent[i]; }
  return i;
 }
 for (let i = 0; i < index.length; i += 3) {
  const a = root(index[i]);
  parent[root(index[i + 1])] = a;
  parent[root(index[i + 2])] = a;
 }
 const connected = new Map(), point = new T.Vector3();
 for (const i of new Set(index)) {
  const id = root(i);
  if (!connected.has(id)) connected.set(id, new T.Box3());
  point.fromBufferAttribute(positions, i).applyMatrix4(matrixWorld);
  connected.get(id).expandByPoint(point);
 }
 if (connected.size !== 2) return null;
 const sign = side === 'left' ? 1 : -1;
 const ordered = [...connected].sort((a, b) => sign * (a[1].min.x + a[1].max.x - b[1].min.x - b[1].max.x));
 const selected = ordered[component === 'medial' ? 0 : 1][0];
 const remap = new Map(), vertices = [], faces = [];
 for (const i of index) {
  if (root(i) !== selected) continue;
  if (!remap.has(i)) {
   remap.set(i, vertices.length / 3);
   vertices.push(positions.getX(i), positions.getY(i), positions.getZ(i));
  }
  faces.push(remap.get(i));
 }
 const result = new T.BufferGeometry();
 result.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
 result.setIndex(faces);
 result.computeVertexNormals();
 return result;
}

let catalogue, manager;
function readCatalogue() {
 return catalogue ??= fetch(base + 'manifest.json?v=whole-body1').then(r => {
  if (!r.ok) throw Error('软组织目录不可用');
  return r.json();
 }).catch(error => { catalogue = null; throw error; });
}

function loadDecoder() {
 return manager ??= Promise.all([import('./vendor/GLTFLoader.js'), import('./vendor/DRACOLoader.js')])
  .then(([{ GLTFLoader }, { DRACOLoader }]) => {
   const decoder = new DRACOLoader().setDecoderPath('./vendor/draco/').setWorkerLimit(2);
   return new GLTFLoader().setDRACOLoader(decoder);
  }).catch(error => { manager = null; throw error; });
}

function disposeScene(root) {
 root.traverse(node => {
  if (node.isMesh) {
   node.geometry?.dispose();
   if (node.userData.ownMaterial) node.material?.dispose();
  }
 });
 root.removeFromParent();
}

export function prepareSoftTissues() {
 // High-realism anatomical PBR shading palette:
 // - Muscles: moist striated terracotta-crimson glaze (clear contours while showing bone/vessels/nerves inside)
 // - Arteries: glossy oxygenated arterial crimson (natural clearcoat, zero plastic neon)
 // - Veins: deep translucent-walled slate-blue
 // - Nerves: pearlescent ivory-ochre myelinated trunk (true surgical anatomy look)
 const palette = {
  bones: () => makeMaterial({ color: 0xe3d7bc, opacity: 1, roughness: 0.84, clearcoat: 0.04 }),
  muscleDeforming: (op = 0.54) => makeMaterial({
   color: 0xa63c32, opacity: op, roughness: 0.44, metalness: 0.03,
   clearcoat: 0.34, clearcoatRoughness: 0.38, emissive: 0x260906, emissiveIntensity: 0.08,
   depthWrite: op >= 0.82
  }),
  muscleRisk: (op = 0.52) => makeMaterial({
   color: 0xb64b2e, opacity: op, roughness: 0.45, metalness: 0.03,
   clearcoat: 0.32, clearcoatRoughness: 0.40, emissive: 0x2c0e06, emissiveIntensity: 0.10,
   depthWrite: op >= 0.82
  }),
  muscleContext: (op = 0.24) => makeMaterial({
   color: 0xb87064, opacity: op, roughness: 0.58, metalness: 0.02,
   clearcoat: 0.18, clearcoatRoughness: 0.55, depthWrite: false
  }),
  arteryRisk: () => makeMaterial({
   color: 0xb82022, opacity: 1, roughness: 0.30, metalness: 0.05,
   clearcoat: 0.65, clearcoatRoughness: 0.22, emissive: 0x3a0506, emissiveIntensity: 0.14,
   depthWrite: true
  }),
  arteryContext: () => makeMaterial({
   color: 0xa1282a, opacity: 0.94, roughness: 0.38, metalness: 0.04,
   clearcoat: 0.48, clearcoatRoughness: 0.30, depthWrite: true
  }),
  veinRisk: () => makeMaterial({
   color: 0x265f8f, opacity: 1, roughness: 0.34, metalness: 0.04,
   clearcoat: 0.55, clearcoatRoughness: 0.28, emissive: 0x071d33, emissiveIntensity: 0.12,
   depthWrite: true
  }),
  veinContext: () => makeMaterial({
   color: 0x35698c, opacity: 0.90, roughness: 0.44, metalness: 0.03,
   clearcoat: 0.38, clearcoatRoughness: 0.36, depthWrite: true
  }),
  nerveRisk: () => makeMaterial({
   color: 0xe3c874, opacity: 1, roughness: 0.34, metalness: 0.03,
   clearcoat: 0.52, clearcoatRoughness: 0.28, emissive: 0x3c2c06, emissiveIntensity: 0.14,
   depthWrite: true
  }),
  nerveContext: () => makeMaterial({
   color: 0xd6bd78, opacity: 0.95, roughness: 0.42, metalness: 0.02,
   clearcoat: 0.38, clearcoatRoughness: 0.36, depthWrite: true
  })
 };

 const cache = new Map();
 const maxDecodedBytes = 32 * 1024 * 1024;
 let cacheGeneration = 0;

 function trimCache() {
  let total = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
  for (const [file, entry] of cache) {
   if (total <= maxDecodedBytes) break;
   if (entry.refs) continue;
   cache.delete(file);
   disposeScene(entry.scene);
   total -= entry.bytes;
  }
 }

 async function getPart(part, loader, signal, generation) {
  const file = part.file;
  if (cache.has(file)) {
   const entry = cache.get(file);
   cache.delete(file);
   cache.set(file, entry);
   entry.refs++;
   return entry;
  }
  const data = await fetchVerifiedModel('models/soft-tissue/' + file, {
   originURL: partURL(part), bytes: part.bytes, sha256: part.sha256, signal
  });
  const {scene} = await loader.parseAsync(data, base);
  if (signal?.aborted || generation !== cacheGeneration) {
   disposeScene(scene);
   throw new DOMException('????????', 'AbortError');
  }
  const hit = cache.get(file);
  if (hit) {
   disposeScene(scene);
   hit.refs++;
   return hit;
  }
  let bytes = 0;
  scene.traverse(node => {
   if (!node.isMesh) return;
   for (const attr of Object.values(node.geometry.attributes)) bytes += attr.array.byteLength;
   bytes += node.geometry.index?.array.byteLength || 0;
  });
  const entry = {scene, bytes, refs: 1, evicted: false};
  cache.set(file, entry);
  return entry;
 }

 function release(entries) {
  for (const entry of entries) {
   if (--entry.refs === 0 && entry.evicted) disposeScene(entry.scene);
  }
  trimCache();
 }

 function createRoleMaterial(layer, sublayer, role, muscleOpacity) {
  let mat;
  if (layer === 'bones') mat = palette.bones();
  else if (layer === 'muscles') {
   if (role?.role === 'deforming') mat = palette.muscleDeforming(Math.max(0.40, Math.min(0.92, muscleOpacity + 0.26)));
   else if (role?.role === 'risk') mat = palette.muscleRisk(Math.max(0.38, Math.min(0.90, muscleOpacity + 0.24)));
   else mat = palette.muscleContext(muscleOpacity);
  } else if (layer === 'vessels') {
   if (sublayer === 'veins') mat = role ? palette.veinRisk() : palette.veinContext();
   else mat = role ? palette.arteryRisk() : palette.arteryContext();
  } else {
   mat = role ? palette.nerveRisk() : palette.nerveContext();
  }
  mat.userData.baseColor = mat.color.getHex();
  mat.userData.baseEmissive = mat.emissive.getHex();
  mat.userData.baseEmissiveIntensity = mat.emissiveIntensity;
  mat.userData.baseOpacity = mat.opacity;
  mat.userData.baseDepthWrite = mat.depthWrite;
  return mat;
 }

 async function load(layers, bone, signal, options = {}) {
  const {section = '', courseId = '', variantKey = '', meshId = '', focusOnly = true,
   muscleOpacity = 0.28, depthLevel = 1, clipPlane = null} = options;
  if (!isSoftTissueSupported(bone)) throw Error('??????????');
  const anatomy = resolveAnatomy(bone, courseId, variantKey, meshId);
  const manifest = await readCatalogue();
  signal?.throwIfAborted();
  const {name, target, local, referenceNames, candidates, tasks} = tissueLoadPlan(manifest, layers, anatomy, options);
  const [loader] = await Promise.all([
   loadDecoder(), loadAxialTerms([...candidates.values()].map(({record}) => record.region))
  ]);
  signal?.throwIfAborted();
  const centre = target.getCenter(new T.Vector3());
  const tissuePoint = new T.Vector3();
  const generation = cacheGeneration;
  const settled = await Promise.allSettled(tasks.map(async task => ({
   ...task, entry: await getPart(task.part, loader, signal, generation)
  })));
  const loadedParts = settled.filter(task => task.status === 'fulfilled').map(task => task.value);
  const acquired = loadedParts.map(task => task.entry);
  const failure = settled.find(task => task.status === 'rejected');
  if (failure || signal?.aborted || generation !== cacheGeneration) {
   release(acquired);
   throw failure?.reason || new DOMException('????????', 'AbortError');
  }
  trimCache();

  const root = new T.Group();
  const items = [];
  const tags = [];
  const ownMaterials = [];
  let pairedBone = null;
  const boneAnchors = new Map();
  const componentGeometries = [];

  for (const { layer, zone, entry: stored } of loadedParts) {
   const {scene} = stored;
   const clonedGroup = new T.Group();
   clonedGroup.userData.layer = layer;
   clonedGroup.userData.zone = zone;
   scene.updateMatrixWorld(true);

   scene.traverse(srcNode => {
    if (!srcNode.isMesh) return;
    const key = (srcNode.userData.name || srcNode.name).trim();

    if (layer === 'bones') {
     const targetBone = referenceNames.get(key);
     if (!targetBone) return;
     const geometry = key === name && anatomy.component ? sesamoidComponent(srcNode, anatomy.side, anatomy.component) : srcNode.geometry;
     if (!geometry) return;
     if (geometry !== srcNode.geometry) componentGeometries.push(geometry);
     const mat = createRoleMaterial('bones', 'bones', null, 1);
     ownMaterials.push(mat);
     const mesh = new T.Mesh(geometry, mat);
     mesh.applyMatrix4(srcNode.matrixWorld);
     mesh.updateMatrixWorld(true);
     mesh.userData.atlasLayer = 'bones';
     mesh.userData.structureKey = key;
     mesh.visible = key === name || key === 'Coccyx' || courseId === 'tmj-dislocation' || courseId === 'pelvis';
     clonedGroup.add(mesh);
     boneAnchors.set(targetBone, mesh);
     if (key === name) pairedBone = mesh;
     return;
    }

    const candidate = candidates.get(layer + ':' + key);
    if (!candidate) return;
    const {record, roles, nearLocal} = candidate;
    const role = roles[0] || null;
    const info = softTissueInfo(layer, key);
    const mat = createRoleMaterial(layer, info.sublayer, role, muscleOpacity);
    if (clipPlane) mat.clippingPlanes = [clipPlane];
    ownMaterials.push(mat);

    const mesh = new T.Mesh(srcNode.geometry, mat);
    mesh.applyMatrix4(srcNode.matrixWorld);
    mesh.updateMatrixWorld(true);
    mesh.renderOrder = layer === 'muscles' ? (role ? 2 : 1) : 4;
    mesh.userData.atlasLayer = layer;
    mesh.userData.sublayer = info.sublayer;
    mesh.userData.structureKey = key;
    mesh.userData.tissueInfo = info;
    mesh.userData.clinicalRole = role;
    mesh.userData.ownMaterial = true;
    mesh.userData.zoneLabel = ZONE_LABELS[record.region] || record.region;
    mesh.userData.depthLabel = DEPTH_LABELS[info.depth] || '';
    if (record.origin) mesh.userData.origin = new T.Vector3(...record.origin);
    if (record.insertion) mesh.userData.insertion = new T.Vector3(...record.insertion);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();

    clonedGroup.add(mesh);
    items.push({
     mesh,
     key,
     layer,
     sublayer: info.sublayer,
     info,
     role,
     roles,
     nearLocal,
     localPlanes: anatomy.axial && (/nerve-group|ganglion-group|central-reference|meningeal-reference/.test(info.kind) || /intercostal arteries|lumbar (arteries|veins)/i.test(key)) ? [
      new T.Plane(new T.Vector3(0, 1, 0), -local.min.y),
      new T.Plane(new T.Vector3(0, -1, 0), local.max.y)
     ] : [],
     enabled: true,
     restOrigin: mesh.userData.origin ? mesh.userData.origin.clone() : null,
     restInsertion: mesh.userData.insertion ? mesh.userData.insertion.clone() : null,
     zone: record.region
    });
   });

   root.add(clonedGroup);
  }

  const layerHasClinical = {};
  for (const layer of layers) {
   layerHasClinical[layer] = items.some(it => it.layer === layer && Boolean(it.role));
  }
  for (const item of items) {
   item.isClinical = Boolean(item.role);
  }

  root.updateMatrixWorld(true);
  const prioritized = [...items]
   .filter(it => it.isClinical)
   .sort((a, b) => {
    const score = it => (it.role.role === 'risk' ? (it.role.severity === 'high' ? 4 : 3) : 2) + (it.layer === 'nerves' ? 0.5 : it.layer === 'vessels' ? 0.4 : 0);
    return score(b) - score(a);
   });

  const seenTag = new Set();
  for (const item of prioritized) {
   if (tags.length >= 6) break;
   const tagText = item.role.label || item.info.zhBase;
   const display = anatomy.axial ? item.info.zh : item.info.zhBase;
   if (seenTag.has(display) || !anatomy.axial && seenTag.has(tagText)) continue;
   const positions = item.mesh.geometry.attributes.position;
   const step = Math.max(1, Math.floor(positions.count / 1800));
   let nearest = Infinity, bestPt = null;
   for (let j = 0; j < positions.count; j += step) {
    tissuePoint.fromBufferAttribute(positions, j).applyMatrix4(item.mesh.matrixWorld);
    const d = tissuePoint.distanceToSquared(centre);
    if (d < nearest) { nearest = d; bestPt = tissuePoint.clone(); }
   }
   if (bestPt) {
    seenTag.add(display);
    seenTag.add(tagText);
    tags.push({
     text: display,
     point: bestPt,
     layer: item.layer,
     sublayer: item.sublayer,
     role: item.role.role,
     severity: item.role.severity || '',
     structureKey: item.key
    });
   }
  }

  const rankItem = it => {
   if (it.role?.role === 'risk' && it.role.severity === 'high') return 0;
   if (it.role?.role === 'risk') return 1;
   if (it.role?.role === 'deforming') return 2;
   if (it.layer === 'nerves') return 3;
   if (it.layer === 'vessels') return 4;
   return 5;
  };
  items.sort((a, b) => rankItem(a) - rankItem(b) || a.info.zh.localeCompare(b.info.zh, 'zh-CN'));

  const frame = target.clone().expandByScalar(section ? 0.055 : 0.036);
  const entry = {
   root,
   frame,
   tags,
   pairedBone,
   boneAnchors,
   anatomy,
   revision: manifest.revision,
   items,
   labelPoint(item) {
    const tag = this.tags.find(tag => tag.structureKey === item.key);
    if (tag) return tag.point;
    const box = new T.Box3().setFromObject(item.mesh);
    if (item.localPlanes.length) box.intersect(local.clone().applyMatrix4(this.root.matrixWorld));
    return box.isEmpty() ? centre.clone().applyMatrix4(this.root.matrixWorld) : box.getCenter(new T.Vector3());
   },
   ownMaterials,
   focusOnly,
   muscleOpacity,
   depthLevel, // 1 = all muscles, 2 = peel superficial, 3 = deep only, 4 = hide muscles (vessels/nerves only)
   clipPlane,
   selectedKey: null,
   hoveredKey: null,
   isolatedKey: null,
   layerHasClinical,
   applyStaticCalibers() {
    for (const it of this.items) {
     if (it.info.caliber?.offsetM) applyStaticCaliber(it.mesh.material, it.info.caliber.offsetM);
    }
   },
   applyVisibility() {
    for (const it of this.items) {
     if (this.isolatedKey) {
      it.mesh.visible = it.key === this.isolatedKey;
      continue;
     }
     if (!it.enabled) {
      it.mesh.visible = false;
      continue;
     }
     if (it.layer === 'muscles' && it.info.depth < this.depthLevel) {
      it.mesh.visible = false;
      continue;
     }
     it.mesh.visible = this.focusOnly ? (it.isClinical || !this.layerHasClinical[it.layer]) : true;
    }
   },
   setDepthLevel(level) {
    this.depthLevel = level;
    this.applyVisibility();
   },
   setClipPlane(plane) {
    this.clipPlane = plane;
    for (const it of this.items) {
     const localPlanes = it.localPlanes.map(p => p.clone().applyMatrix4(this.root.matrixWorld));
     it.mesh.material.clippingPlanes = plane ? [...localPlanes, plane] : localPlanes;
     it.mesh.material.needsUpdate = true;
    }
   },
   setMuscleOpacity(val) {
    this.muscleOpacity = val;
    for (const it of this.items) {
     if (it.layer !== 'muscles') continue;
     const mat = it.mesh.material;
     const nextOp = it.isClinical ? Math.max(0.40, Math.min(0.92, val + 0.26)) : val;
     mat.opacity = nextOp;
     mat.transparent = nextOp < 0.99;
     mat.depthWrite = nextOp >= 0.82;
     mat.side = nextOp < 0.85 ? T.FrontSide : T.DoubleSide;
     mat.userData.baseOpacity = nextOp;
     mat.userData.baseDepthWrite = mat.depthWrite;
     mat.needsUpdate = true;
    }
   },
   highlight(key, mode = 'hover') {
    if (mode === 'hover') this.hoveredKey = key;
    else this.selectedKey = key;
    for (const it of this.items) {
     const mat = it.mesh.material;
     const isSel = it.key === this.selectedKey;
     const isHov = it.key === this.hoveredKey;
     if (isSel) {
      mat.color.setHex(0x238f75);
      mat.emissive.setHex(0x125444);
      mat.emissiveIntensity = 0.42;
      mat.opacity = Math.max(mat.userData.baseOpacity, 0.95);
      mat.transparent = mat.opacity < 0.99;
      mat.depthWrite = true;
     } else if (isHov) {
      mat.color.setHex(0x47b093);
      mat.emissive.setHex(0x1a614e);
      mat.emissiveIntensity = 0.30;
      mat.opacity = Math.max(mat.userData.baseOpacity, 0.90);
      mat.transparent = mat.opacity < 0.99;
      mat.depthWrite = true;
     } else {
      mat.color.setHex(mat.userData.baseColor);
      mat.emissive.setHex(mat.userData.baseEmissive);
      mat.emissiveIntensity = mat.userData.baseEmissiveIntensity;
      mat.opacity = mat.userData.baseOpacity;
      mat.transparent = mat.opacity < 0.99;
      mat.depthWrite = mat.userData.baseDepthWrite;
     }
    }
   },
   dispose() {
    for (const mat of this.ownMaterials) mat.dispose();
    this.ownMaterials.length = 0;
    for (const geometry of componentGeometries) geometry.dispose();
    release(acquired.splice(0));
    this.root.removeFromParent();
    this.root.clear();
   }
  };
  entry.applyVisibility();
  entry.setClipPlane(clipPlane);
  return entry;
 }

 return {
  load,
  async prefetch(bone, layers = ['muscles', 'vessels', 'nerves'], options = {}) {
   if (!isSoftTissueSupported(bone) || !layers?.length || globalThis.navigator?.connection?.saveData) return;
   const anatomy = resolveAnatomy(bone, options.courseId, options.variantKey, options.meshId);
   try {
    const manifest = await readCatalogue();
    const parts = tissueLoadPlan(manifest, layers, anatomy, options).tasks.map(task => task.part);
    await Promise.all(parts.filter(part => !cache.has(part.file)).map(part => prefetchModel('models/soft-tissue/' + part.file, {
     originURL: partURL(part), bytes: part.bytes, sha256: part.sha256
    })));
   } catch {
    // The user's explicit layer request will report any loading errors.
   }
  },
  detach: entry => entry?.dispose(),
  clear() {
   cacheGeneration++;
   for (const entry of cache.values()) {
    entry.evicted = true;
    if (!entry.refs) disposeScene(entry.scene);
   }
   cache.clear();
  }
 };
}
