import * as T from './vendor/three.module.js';
import {
 isLimbBone,
 softTissueInfo,
 zonesForBone,
 ZONE_LABELS,
 DEPTH_LABELS
} from './soft-tissue-catalog.js?v=limb-soft4';
import { classifyNodeRole } from './soft-tissue-clinical.js?v=limb-soft4';

const base = './models/soft-tissue/';
const bounds = v => new T.Box3(new T.Vector3(...v[0]), new T.Vector3(...v[1]));

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
  const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
  const number = ord.indexOf(column[1]) + 1;
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

let catalogue, manager;
function readCatalogue() {
 return catalogue ??= fetch(base + 'manifest.json').then(r => {
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

 let cache = new Map();

 async function getPart(part, loader, signal, storage) {
  if (storage.has(part.file)) return storage.get(part.file);
  const response = await fetch(base + part.file, { signal });
  if (!response.ok) throw Error('软组织分区不可用 ' + part.file);
  const data = await response.arrayBuffer();
  if (data.byteLength !== part.bytes) throw Error('软组织分区长度不匹配');
  const { scene } = await loader.parseAsync(data, base);
  if (signal.aborted || storage !== cache) {
   disposeScene(scene);
   throw new DOMException('过期的软组织加载', 'AbortError');
  }
  scene.updateMatrixWorld(true);
  storage.set(part.file, scene);
  return scene;
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
  const {
   section = '', courseId = '', clinical = null,
   focusOnly = true, muscleOpacity = 0.28, depthLevel = 1, clipPlane = null
  } = options;
  if (!bone || !isLimbBone(bone)) {
   throw Error('当前软组织图谱专注四肢骨折与脱位相关结构');
  }
  const [manifest, loader] = await Promise.all([readCatalogue(), loadDecoder()]);
  const skeleton = manifest.structures.bones;
  const name = referenceName(bone, skeleton);
  const reference = name ? skeleton[name] : null;
  if (!reference) throw Error('未找到该四肢骨骼的软组织配准参照');

  const side = /\bleft\b/i.test(bone) ? 'l' : 'r';
  const target = bounds(reference.bounds);
  const fullTarget = target.clone();
  if (section) {
   const y = target.max.y - target.min.y;
   if (section === 'proximal') target.min.y = target.max.y - y * 0.38;
   if (section === 'distal') target.max.y = target.min.y + y * 0.38;
  }
  const local = target.clone().expandByScalar(0.058);
  const clinicalBox = fullTarget.clone().expandByScalar(0.16);
  const centre = target.getCenter(new T.Vector3());
  const tissuePoint = new T.Vector3();
  const allowedZones = new Set(zonesForBone(bone, courseId));

  const fetchTasks = [];
  const layerList = ['bones', ...layers];
  for (const layer of layerList) {
   const dictionary = manifest.structures[layer];
   const neededZones = new Set();
   if (layer === 'bones') {
    neededZones.add(reference.region);
   } else {
    for (const z of allowedZones) neededZones.add(z);
    for (const [key, rec] of Object.entries(dictionary)) {
     if (rec.side && rec.side !== side) continue;
     const role = classifyNodeRole(layer, key, clinical);
     if (role && clinicalBox.intersectsBox(bounds(rec.bounds))) neededZones.add(rec.region);
    }
   }
   for (const zone of neededZones) {
    const part = manifest.layers[layer][zone];
    if (part) fetchTasks.push({ layer, zone, part });
   }
  }

  const storage = cache;
  const loadedParts = await Promise.all(
   fetchTasks.map(async task => ({
    ...task,
    scene: await getPart(task.part, loader, signal, storage)
   }))
  );
  signal.throwIfAborted?.();

  const root = new T.Group();
  const items = [];
  const tags = [];
  const ownMaterials = [];
  let pairedBone = null;

  for (const { layer, zone, scene } of loadedParts) {
   const dictionary = manifest.structures[layer];
   const clonedGroup = new T.Group();
   clonedGroup.userData.layer = layer;
   clonedGroup.userData.zone = zone;
   scene.updateMatrixWorld(true);

   scene.traverse(srcNode => {
    if (!srcNode.isMesh) return;
    const key = (srcNode.userData.name || srcNode.name).trim();
    const record = dictionary[key];
    if (!record) return;

    if (layer === 'bones') {
     if (key !== name) return;
     const mat = createRoleMaterial('bones', 'bones', null, 1);
     ownMaterials.push(mat);
     const mesh = new T.Mesh(srcNode.geometry, mat);
     mesh.applyMatrix4(srcNode.matrixWorld);
     mesh.updateMatrixWorld(true);
     mesh.userData.atlasLayer = 'bones';
     mesh.userData.structureKey = key;
     mesh.userData.ownMaterial = true;
     clonedGroup.add(mesh);
     if (!/^Sesamoid bones of foot/i.test(key)) pairedBone = mesh;
     return;
    }

    if (record.side && record.side !== side) return;
    if (record.limb && reference.limb && record.limb !== reference.limb) return;

    const role = classifyNodeRole(layer, key, clinical);
    const box = bounds(record.bounds);
    const nearLocal = local.intersectsBox(box);
    const nearClinical = Boolean(role) && clinicalBox.intersectsBox(box);
    if (!nearLocal && !nearClinical) return;

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
     nearLocal,
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
   const display = item.info.zhBase;
   if (seenTag.has(display) || seenTag.has(tagText)) continue;
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
   items,
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
    const list = plane ? [plane] : [];
    for (const it of this.items) {
     it.mesh.material.clippingPlanes = list;
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
    this.root.removeFromParent();
    this.root.clear();
   }
  };
  entry.applyVisibility();
  return entry;
 }

 return {
  load,
  detach: entry => {
   if (entry) entry.dispose?.();
  },
  clear() {
   const old = cache;
   cache = new Map();
   for (const scene of old.values()) disposeScene(scene);
  }
 };
}
