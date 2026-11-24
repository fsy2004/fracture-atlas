import * as T from './vendor/three.module.js';
import { createDamageSolver } from './tissue-damage.js?v=limb-soft4';

const maxDrivers = 4;
const influence = { muscles: 0.92, vessels: 0.68, nerves: 0.62 };
const one = new T.Vector3(1, 1, 1), identity = new T.Quaternion();
const smooth = (r, a, b) => T.MathUtils.smoothstep(r, a, b);

function fields(actors, wedges, group) {
 const result = [];
 for (const actor of actors) {
  const mesh = actor.shell || actor.pivot.children.find(child => child.isMesh && child.geometry);
  if (!mesh) continue;
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const box = geometry.boundingBox, size = box.getSize(new T.Vector3());
  const centre = box.getCenter(new T.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  const end = centre.clone().sub(actor.anchor);
  if (actor.jointAxis && end.length() < extent * 0.32) end.copy(actor.jointAxis).multiplyScalar(-extent * 0.30);
  if (end.length() > 0.115) end.setLength(0.115);
  const transverse = [size.x, size.y, size.z].sort((a, b) => a - b)[1];
  const radius = T.MathUtils.clamp(transverse * 0.80, 0.015, 0.072);
  result.push({
   kind: 'rigid',
   actor,
   segment: actor.segment || (actor.jointLabel ? 'joint' : ''),
   centre: centre.clone(),
   start: actor.anchor.clone(),
   end: actor.anchor.clone().add(end),
   radius
  });
 }
 for (const mesh of wedges) {
  const morph = mesh.geometry.morphAttributes.position;
  if (!morph?.length) continue;
  const ids = morph.map(delta => {
   let peak = 0, index = 0;
   for (let i = 0; i < delta.count; i++) {
    const length = Math.hypot(delta.getX(i), delta.getY(i), delta.getZ(i));
    if (length > peak) { peak = length; index = i; }
   }
   return index;
  });
  const centre = new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, ids[0]);
  const values = morph.map((delta, i) => new T.Vector3().fromBufferAttribute(delta, ids[i]));
  result.push({ kind: 'compression', mesh, values, centre: centre.clone(), start: centre, end: centre.clone(), radius: 0.028 });
 }
 const frame = group.matrixWorld;
 return result.slice(0, maxDrivers).map(field => ({
  ...field,
  centre: field.centre.applyMatrix4(frame),
  start: field.start.applyMatrix4(frame),
  end: field.end.applyMatrix4(frame)
 }));
}

// Shared GLSL real-time damage deformation & localized hematoma/tear/spasm shading:
// - Indents & pushes tissue vertices away along bone impact direction at P_hit
// - Constricts arterial lumen inward during arterial spasm (tissueKind == 1)
// - Opens subtle localized tear fissure when cortical spike penetrates (damageSeverity > 0.72)
// - Shades realistic muscle striations / nerve fascicles + localized bruising/hemorrhagic tear halo
const DAMAGE_VERT_DECL = `
uniform float caliberOffset;
uniform vec3 damagePoint;
uniform vec3 damageDir;
uniform float damageSeverity;
uniform float damageRadius;
uniform float tissueKind;
varying float vDamageZone;
varying float vTearCore;
varying vec3 vBioPos;
vec3 applyRealTimeDamage(vec3 worldPos, vec3 worldNorm) {
 vBioPos = worldPos;
 vDamageZone = 0.0;
 vTearCore = 0.0;
 if (damageSeverity <= 0.02) return worldPos;
 vec3 rel = worldPos - damagePoint;
 float dist = length(rel);
 float zone = 1.0 - smoothstep(damageRadius * 0.15, damageRadius, dist);
 vDamageZone = zone * damageSeverity;
 if (zone <= 0.001) return worldPos;
 vec3 dDir = normalize(damageDir + vec3(0.0001));
 // 1. Physical bone-tip indentation / deflection
 float pushAmt = zone * damageSeverity * (tissueKind < 0.5 ? 0.0095 : 0.0075);
 vec3 outPos = worldPos + dDir * pushAmt;
 // 2. Arterial vasospasm constriction (narrowing lumen around compression site)
 if (tissueKind > 0.5 && tissueKind < 1.5 && damageSeverity > 0.25) {
  float spasm = zone * smoothstep(0.25, 0.9, damageSeverity) * 0.00135;
  outPos -= worldNorm * spasm;
 }
 // 3. Localized laceration / fiber tear aperture when grade 3 penetration occurs
 float tearMask = smoothstep(0.68, 1.0, damageSeverity) * (1.0 - smoothstep(0.0, damageRadius * 0.52, dist));
 vTearCore = tearMask;
 if (tearMask > 0.01) {
  vec3 side = rel - dDir * dot(rel, dDir);
  float sLen = length(side);
  vec3 spreadDir = sLen > 0.0001 ? side / sLen : normalize(cross(dDir, vec3(0.0, 1.0, 0.01)));
  outPos += spreadDir * (tearMask * 0.0042) - worldNorm * (tearMask * 0.0022);
 }
 return outPos;
}
`;

const DAMAGE_FRAG_DECL = `
uniform float damageSeverity;
uniform float tissueKind;
varying float vDamageZone;
varying float vTearCore;
varying vec3 vBioPos;
`;

const DAMAGE_FRAG_INJECT = `
 // Subtle procedural anatomical micro-texture (longitudinal muscle fibers / myelinated nerve sheen)
 if (tissueKind < 0.5) {
  float stria = sin(vBioPos.x * 520.0 + vBioPos.z * 480.0 + sin(vBioPos.y * 85.0) * 1.4) * 0.045;
  diffuseColor.rgb *= (1.0 + stria);
 } else if (tissueKind > 2.5) {
  float fascicle = sin((vBioPos.x + vBioPos.z) * 900.0) * 0.035;
  diffuseColor.rgb *= (1.0 + fascicle);
 }
 // Real-time localized compression / contusion hematoma / laceration wound shading
 if (vDamageZone > 0.02) {
  vec3 warnAmber = vec3(0.92, 0.55, 0.10);
  vec3 bruiseRed = vec3(0.56, 0.07, 0.08);
  vec3 tearCore  = vec3(0.24, 0.02, 0.03);
  float sev = clamp(damageSeverity, 0.0, 1.0);
  vec3 injuryTint = mix(warnAmber, bruiseRed, smoothstep(0.28, 0.72, sev));
  float blend = clamp(vDamageZone * 0.92, 0.0, 0.92);
  diffuseColor.rgb = mix(diffuseColor.rgb, injuryTint, blend);
  if (vTearCore > 0.05) {
   diffuseColor.rgb = mix(diffuseColor.rgb, tearCore, clamp(vTearCore * 0.85, 0.0, 0.85));
  }
 }
`;

const DAMAGE_EMISSIVE_INJECT = `
 if (vDamageZone > 0.04) {
  vec3 glowCol = mix(vec3(0.75, 0.35, 0.04), vec3(0.85, 0.10, 0.08), smoothstep(0.35, 0.85, damageSeverity));
  totalEmissiveRadiance += glowCol * (vDamageZone * 0.52);
 }
`;

function createDamageUniforms(item) {
 const kind = item.layer === 'muscles' ? 0 : item.sublayer === 'arteries' ? 1 : item.sublayer === 'veins' ? 2 : 3;
 return {
  caliberOffset: { value: item.info?.caliber?.offsetM || 0 },
  damagePoint: { value: new T.Vector3() },
  damageDir: { value: new T.Vector3(0, 0, 1) },
  damageSeverity: { value: 0 },
  damageRadius: { value: item.layer === 'muscles' ? 0.026 : 0.020 },
  tissueKind: { value: kind }
 };
}

// Capsule proximity shader for vessels, nerves, and muscles without two-end separation
function patchCapsuleMaterial(material, capsuleUniforms, dmgUniforms, response) {
 material.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, capsuleUniforms, dmgUniforms, { tissueResponse: { value: response } });
  shader.vertexShader = `
uniform mat4 followMatrix[4];
uniform vec4 followStart[4];
uniform vec4 followEnd[4];
uniform float tissueResponse;
${DAMAGE_VERT_DECL}
vec3 followTissue(vec3 p) {
 vec3 movement = vec3(0.0);
 float total = 0.0;
 for (int i=0; i<4; i++) {
  vec3 start = followStart[i].xyz, v = followEnd[i].xyz - start;
  float along = clamp(dot(p - start, v) / max(dot(v, v), 0.0000001), 0.0, 1.0);
  float r = followStart[i].w;
  float distanceToBone = distance(p, start + v * along);
  float w = (1.0 - smoothstep(r * 0.30, r, distanceToBone)) * followEnd[i].w;
  vec3 displaced = (followMatrix[i] * vec4(p, 1.0)).xyz;
  movement += (displaced - p) * w;
  total += w;
 }
 return p + movement * tissueResponse / max(1.0, total);
}
` + shader.vertexShader
   .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * caliberOffset;`)
   .replace('#include <project_vertex>', `
 vec3 restTissue = (modelMatrix * vec4(transformed, 1.0)).xyz;
 vec3 worldNorm = normalize(mat3(modelMatrix) * objectNormal);
 vec3 movedTissue = followTissue(restTissue);
 vec4 atlasTissuePosition = vec4(applyRealTimeDamage(movedTissue, worldNorm), 1.0);
 vec4 mvPosition = viewMatrix * atlasTissuePosition;
 gl_Position = projectionMatrix * mvPosition;
`)
   .replace('#include <worldpos_vertex>', `
 #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION )
  vec4 worldPosition = atlasTissuePosition;
 #endif
`);
  shader.fragmentShader = DAMAGE_FRAG_DECL + shader.fragmentShader
   .replace('#include <color_fragment>', `#include <color_fragment>\n${DAMAGE_FRAG_INJECT}`)
   .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${DAMAGE_EMISSIVE_INJECT}`);
 };
 material.customProgramCacheKey = () => 'atlas-linked-capsule-dmg-v4';
 material.needsUpdate = true;
}

// Anatomical origin-to-insertion axial shader for muscles + real-time bone-tip damage
function patchMuscleAttachmentMaterial(material, muscleUniforms, dmgUniforms) {
 material.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, muscleUniforms, dmgUniforms);
  shader.vertexShader = `
uniform mat4 originMatrix;
uniform mat4 insertionMatrix;
uniform vec3 muscleOrigin;
uniform vec3 muscleInsertion;
${DAMAGE_VERT_DECL}
vec3 followMuscleAxial(vec3 p) {
 vec3 span = muscleInsertion - muscleOrigin;
 float lenSq = max(dot(span, span), 0.000001);
 float u = clamp(dot(p - muscleOrigin, span) / lenSq, 0.0, 1.0);
 float blend = smoothstep(0.06, 0.94, u);
 vec3 pO = (originMatrix * vec4(p, 1.0)).xyz;
 vec3 pI = (insertionMatrix * vec4(p, 1.0)).xyz;
 return mix(pO, pI, blend);
}
` + shader.vertexShader
   .replace('#include <project_vertex>', `
 vec3 restMuscle = (modelMatrix * vec4(transformed, 1.0)).xyz;
 vec3 worldNorm = normalize(mat3(modelMatrix) * objectNormal);
 vec3 movedMuscle = followMuscleAxial(restMuscle);
 vec4 atlasMusclePosition = vec4(applyRealTimeDamage(movedMuscle, worldNorm), 1.0);
 vec4 mvPosition = viewMatrix * atlasMusclePosition;
 gl_Position = projectionMatrix * mvPosition;
`)
   .replace('#include <worldpos_vertex>', `
 #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION )
  vec4 worldPosition = atlasMusclePosition;
 #endif
`);
  shader.fragmentShader = DAMAGE_FRAG_DECL + shader.fragmentShader
   .replace('#include <color_fragment>', `#include <color_fragment>\n${DAMAGE_FRAG_INJECT}`)
   .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${DAMAGE_EMISSIVE_INJECT}`);
 };
 material.customProgramCacheKey = () => 'atlas-linked-muscle-dmg-v4';
 material.needsUpdate = true;
}

function estimatePoles(mesh) {
 const attr = mesh.geometry.attributes.position;
 const box = new T.Box3().setFromObject(mesh);
 const size = box.getSize(new T.Vector3());
 const axis = size.y >= size.x && size.y >= size.z ? 1 : (size.x >= size.z ? 0 : 2);
 let minV = Infinity, maxV = -Infinity;
 const low = new T.Vector3(), high = new T.Vector3(), pt = new T.Vector3();
 const step = Math.max(1, Math.floor(attr.count / 400));
 for (let i = 0; i < attr.count; i += step) {
  pt.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld);
  const val = pt.getComponent(axis);
  if (val < minV) { minV = val; low.copy(pt); }
  if (val > maxV) { maxV = val; high.copy(pt); }
 }
 return { origin: high, insertion: low };
}

function nearestDriverIndex(point, bound, maxDist = 0.09) {
 const seg = new T.Vector3(), proj = new T.Vector3();
 let best = -1, bestDist = maxDist;
 for (const [i, field] of bound.entries()) {
  seg.copy(field.end).sub(field.start);
  const t = T.MathUtils.clamp(proj.copy(point).sub(field.start).dot(seg) / Math.max(seg.lengthSq(), 1e-7), 0, 1);
  proj.copy(field.start).addScaledVector(seg, t);
  const d = proj.distanceTo(point);
  if (d < bestDist) { bestDist = d; best = i; }
 }
 return best;
}

function findDriverByGroup(groupHint, bound) {
 if (!groupHint || !bound.length) return -1;
 if (groupHint === 'joint') return bound.findIndex(f => f.actor?.jointLabel);
 if (groupHint === 'proximal') {
  const byName = bound.findIndex(f => /近端/.test(f.segment));
  if (byName >= 0) return byName;
  let best = 0;
  for (let i = 1; i < bound.length; i++) if (bound[i].centre.y > bound[best].centre.y) best = i;
  return best;
 }
 if (groupHint === 'distal') {
  const byName = bound.findIndex(f => /远端/.test(f.segment));
  if (byName >= 0) return byName;
  let best = 0;
  for (let i = 1; i < bound.length; i++) if (bound[i].centre.y < bound[best].centre.y) best = i;
  return best;
 }
 return -1;
}

export function linkSoftTissues(entry, registration, boneGroup, actors, wedges, options = {}) {
 const bound = fields(actors, wedges, boneGroup);
 if (!bound.length) return null;

 entry.root.applyMatrix4(registration.matrix);
 entry.root.updateMatrixWorld(true);
 for (const t of entry.tags) {
  t.point.applyMatrix4(registration.matrix);
  t.rest = t.point.clone();
 }

 const segment = new T.Vector3(), projected = new T.Vector3(), sample = new T.Vector3();
 function weight(point, field) {
  segment.copy(field.end).sub(field.start);
  const t = T.MathUtils.clamp(projected.copy(point).sub(field.start).dot(segment) / Math.max(segment.lengthSq(), 1e-7), 0, 1);
  projected.copy(field.start).addScaledVector(segment, t);
  return 1 - smooth(projected.distanceTo(point), field.radius * 0.30, field.radius);
 }

 const matrices = Array.from({ length: maxDrivers }, () => new T.Matrix4());
 const start = Array.from({ length: maxDrivers }, () => new T.Vector4(0, 0, 0, 1));
 const end = Array.from({ length: maxDrivers }, () => new T.Vector4());
 const capsuleUniforms = { followMatrix: { value: matrices }, followStart: { value: start }, followEnd: { value: end } };
 for (const [i, field] of bound.entries()) {
  start[i].set(...field.start.toArray(), field.radius);
  end[i].set(...field.end.toArray(), 1);
 }

 const identityMatrix = new T.Matrix4();
 const muscleTrackers = [];
 const nvTrackers = [];
 const damageUniformsByKey = new Map();
 const arrowGroup = new T.Group();
 arrowGroup.visible = options.showArrows !== false;
 const arrows = [];

 // Subtle surgical 3D localized injury hotspot rings placed dynamically at real-time contact points P_hit
 const hotspotGroup = new T.Group();
 const hotspotGeo = new T.TorusGeometry(0.0062, 0.0010, 10, 24);
 const hotspotMatWarn = new T.MeshBasicMaterial({ color: 0xe08518, transparent: true, opacity: 0.68, depthTest: false });
 const hotspotMatCrit = new T.MeshBasicMaterial({ color: 0xcc1b1b, transparent: true, opacity: 0.78, depthTest: false });
 const hotspotPool = [];
 for (let i = 0; i < 4; i++) {
  const m = new T.Mesh(hotspotGeo, hotspotMatCrit);
  m.visible = false;
  m.renderOrder = 10;
  hotspotGroup.add(m);
  hotspotPool.push(m);
 }

 const savedStates = [];
 const probes = new Map();

 entry.root.traverse(node => {
  if (!node.isMesh) return;
  if (node.userData.atlasLayer === 'bones') {
   savedStates.push([node, node.visible]);
   node.visible = false;
  }
 });

 for (const item of entry.items || []) {
  const node = item.mesh;
  node.frustumCulled = false;
  const layer = item.layer;
  const response = influence[layer] ?? 0.6;
  const dmgUniforms = createDamageUniforms(item);
  damageUniformsByKey.set(item.key, dmgUniforms);

  const positions = node.geometry.attributes.position;
  const step = Math.max(1, Math.ceil(positions.count / 32));
  for (let j = 0; j < positions.count; j += step) {
   sample.fromBufferAttribute(positions, j).applyMatrix4(node.matrixWorld);
   for (const [i, field] of bound.entries()) {
    const score = weight(sample, field) * (1 + Math.min(0.1, sample.distanceTo(field.start)) * 5);
    const id = layer + '/' + i;
    if (score > 0 && score > (probes.get(id)?.score || 0)) {
     probes.set(id, { score, point: sample.clone(), response });
    }
   }
  }

  if (layer === 'muscles') {
   let originWorld = item.restOrigin ? item.restOrigin.clone().applyMatrix4(registration.matrix) : null;
   let insertionWorld = item.restInsertion ? item.restInsertion.clone().applyMatrix4(registration.matrix) : null;
   if (!originWorld || !insertionWorld) {
    const poles = estimatePoles(node);
    originWorld ||= poles.origin;
    insertionWorld ||= poles.insertion;
   }
   const restLen = originWorld.distanceTo(insertionWorld);
   let oDriver = nearestDriverIndex(originWorld, bound, 0.068);
   let iDriver = nearestDriverIndex(insertionWorld, bound, 0.068);
   if (item.role?.role === 'deforming') {
    const targetDriver = findDriverByGroup(item.role.group, bound);
    if (targetDriver >= 0) {
     const dO = originWorld.distanceTo(bound[targetDriver].centre);
     const dI = insertionWorld.distanceTo(bound[targetDriver].centre);
     if (dI <= dO) {
      iDriver = targetDriver;
      if (oDriver === iDriver) oDriver = -1;
     } else {
      oDriver = targetDriver;
      if (iDriver === oDriver) iDriver = -1;
     }
    }
   }

   if (restLen > 0.015 && (oDriver >= 0 || iDriver >= 0)) {
    const mUniforms = {
     originMatrix: { value: new T.Matrix4() },
     insertionMatrix: { value: new T.Matrix4() },
     muscleOrigin: { value: originWorld.clone() },
     muscleInsertion: { value: insertionWorld.clone() }
    };
    patchMuscleAttachmentMaterial(node.material, mUniforms, dmgUniforms);
    const tracker = {
     item,
     originRest: originWorld.clone(),
     insertionRest: insertionWorld.clone(),
     restLen,
     oDriver,
     iDriver,
     uniforms: mUniforms,
     deltaPct: 0,
     deltaMm: 0
    };
    muscleTrackers.push(tracker);

    if (item.role?.role === 'deforming' && !arrows.some(a => a.label === item.role.label)) {
     const pullFrom = iDriver >= 0 ? insertionWorld : originWorld;
     const pullTo = iDriver >= 0 ? originWorld : insertionWorld;
     const dir = pullTo.clone().sub(pullFrom).normalize();
     const len = T.MathUtils.clamp(restLen * 0.24, 0.028, 0.068);
     const color = item.role.group === 'proximal' ? 0xc83e2b : item.role.group === 'distal' ? 0xc97b1e : 0x9b3b62;
     const headLen = Math.min(0.011, len * 0.24);
     const headWid = headLen * 0.42;
     const arrow = new T.ArrowHelper(dir, pullFrom.clone().lerp(pullTo, 0.26), len, color, headLen, headWid);
     arrow.renderOrder = 5;
     arrowGroup.add(arrow);
     arrows.push({ arrow, tracker, pullFromInsertion: iDriver >= 0, len, label: item.role.label });
    }
   } else {
    patchCapsuleMaterial(node.material, capsuleUniforms, dmgUniforms, response);
   }
  } else {
   patchCapsuleMaterial(node.material, capsuleUniforms, dmgUniforms, response);
   let nearestPt = null, bestD = Infinity;
   for (let j = 0; j < positions.count; j += Math.max(1, Math.floor(positions.count / 100))) {
    sample.fromBufferAttribute(positions, j).applyMatrix4(node.matrixWorld);
    const d = sample.distanceTo(bound[0].start);
    if (d < bestD) { bestD = d; nearestPt = sample.clone(); }
   }
   if (nearestPt) {
    nvTrackers.push({ item, restPoint: nearestPt, response, shiftMm: 0 });
   }
  }
 }

 entry.root.add(arrowGroup);
 entry.root.add(hotspotGroup);

 // Initialize real-time geometric damage solver AFTER registration matrix has been applied to entry.root!
 const damageSolver = createDamageSolver(actors, boneGroup, entry);

 const into = new T.Matrix4().copy(boneGroup.matrixWorld).invert();
 const nodeTransform = new T.Matrix4(), originShift = new T.Matrix4();
 const vector = new T.Vector3(), displaced = new T.Vector3(), movement = new T.Vector3();
 const curO = new T.Vector3(), curI = new T.Vector3(), arrowDir = new T.Vector3();
 const muscleStrainByKey = new Map();
 const nvShiftByKey = new Map();

 function deformCapsule(point, response) {
  let total = 0;
  movement.set(0, 0, 0);
  for (const [i, field] of bound.entries()) {
   const amount = weight(point, field);
   displaced.copy(point).applyMatrix4(matrices[i]).sub(point);
   movement.addScaledVector(displaced, amount);
   total += amount;
  }
  return movement.multiplyScalar(response / Math.max(1, total));
 }

 const telemetry = { muscles: [], neurovascular: [], damageEvents: [], maxGrade: 0 };

 return {
  telemetry,
  setArrowsVisible(flag) {
   arrowGroup.visible = Boolean(flag);
  },
  update() {
   for (const [i, field] of bound.entries()) {
    if (field.kind === 'rigid') {
     const { pivot, anchor } = field.actor;
     originShift.makeTranslation(-anchor.x, -anchor.y, -anchor.z);
     nodeTransform.compose(pivot.position, pivot.quaternion, one).multiply(originShift);
    } else {
     vector.set(0, 0, 0);
     for (const [j, value] of field.values.entries()) {
      vector.addScaledVector(value, field.mesh.morphTargetInfluences[j] || 0);
     }
     nodeTransform.compose(vector, identity, one);
    }
    matrices[i].copy(boneGroup.matrixWorld).multiply(nodeTransform).multiply(into);
   }

   let largest = 0;
   telemetry.muscles.length = 0;
   telemetry.neurovascular.length = 0;
   muscleStrainByKey.clear();
   nvShiftByKey.clear();

   const seenMuscleTelemetry = new Set();
   for (const tr of muscleTrackers) {
    tr.uniforms.originMatrix.value.copy(tr.oDriver >= 0 ? matrices[tr.oDriver] : identityMatrix);
    tr.uniforms.insertionMatrix.value.copy(tr.iDriver >= 0 ? matrices[tr.iDriver] : identityMatrix);
    curO.copy(tr.originRest).applyMatrix4(tr.uniforms.originMatrix.value);
    curI.copy(tr.insertionRest).applyMatrix4(tr.uniforms.insertionMatrix.value);
    const curLen = curO.distanceTo(curI);
    tr.deltaMm = (curLen - tr.restLen) * 1000;
    tr.deltaPct = tr.restLen > 0.001 ? ((curLen - tr.restLen) / tr.restLen) * 100 : 0;
    muscleStrainByKey.set(tr.item.key, tr.deltaPct);
    largest = Math.max(largest, Math.abs(curLen - tr.restLen), curI.distanceTo(tr.insertionRest), curO.distanceTo(tr.originRest));
    if (tr.item.role?.role === 'deforming' && !seenMuscleTelemetry.has(tr.item.info.zhBase)) {
     seenMuscleTelemetry.add(tr.item.info.zhBase);
     telemetry.muscles.push({
      key: tr.item.key,
      name: tr.item.info.zhBase,
      group: tr.item.role.group,
      action: tr.item.role.action,
      deltaPct: tr.deltaPct,
      deltaMm: tr.deltaMm
     });
    }
   }

   for (const a of arrows) {
    const tr = a.tracker;
    a.arrow.visible = arrowGroup.visible && tr.item.mesh.visible;
    if (!a.arrow.visible) continue;
    curO.copy(tr.originRest).applyMatrix4(tr.uniforms.originMatrix.value);
    curI.copy(tr.insertionRest).applyMatrix4(tr.uniforms.insertionMatrix.value);
    const pFrom = a.pullFromInsertion ? curI : curO;
    const pTo = a.pullFromInsertion ? curO : curI;
    arrowDir.copy(pTo).sub(pFrom);
    if (arrowDir.lengthSq() > 1e-6) {
     arrowDir.normalize();
     a.arrow.position.copy(pFrom).lerp(pTo, 0.24);
     a.arrow.setDirection(arrowDir);
    }
   }

   const seenNV = new Set();
   for (const tr of nvTrackers) {
    const shift = deformCapsule(tr.restPoint, tr.response).length();
    tr.shiftMm = shift * 1000;
    nvShiftByKey.set(tr.item.key, tr.shiftMm);
    largest = Math.max(largest, shift);
    if (tr.item.role?.role === 'risk' && !seenNV.has(tr.item.info.zhBase)) {
     seenNV.add(tr.item.info.zhBase);
     telemetry.neurovascular.push({
      key: tr.item.key,
      name: tr.item.info.zhBase,
      layer: tr.item.layer,
      severity: tr.item.role.severity,
      shiftMm: tr.shiftMm
     });
    }
   }

   // Run real-time geometric damage solver & feed exact 3D hit points + severities into GPU shaders!
   const dmg = damageSolver.evaluate(muscleStrainByKey, nvShiftByKey);
   telemetry.damageEvents = dmg.events;
   telemetry.maxGrade = dmg.maxGrade;

   for (const target of dmg.targets) {
    const u = damageUniformsByKey.get(target.item.key);
    if (!u) continue;
    u.damagePoint.value.copy(target.hitPoint);
    u.damageDir.value.copy(target.hitDir);
    u.damageSeverity.value = target.item.mesh.visible ? target.result.severity : 0;
   }

   // Place 3D injury hotspot indicators right on Grade >= 2 real-time impact points
   const notableHits = dmg.events.filter(ev => ev.grade >= 2).slice(0, hotspotPool.length);
   for (let i = 0; i < hotspotPool.length; i++) {
    const marker = hotspotPool[i];
    const ev = notableHits[i];
    if (!ev) {
     marker.visible = false;
     continue;
    }
    marker.visible = true;
    marker.position.copy(ev.hitPoint);
    marker.material = ev.grade >= 3 ? hotspotMatCrit : hotspotMatWarn;
    const s = ev.grade >= 3 ? 1.25 : 0.85;
    marker.scale.setScalar(s);
   }

   for (const tag of entry.tags) {
    tag.point.copy(tag.rest).add(deformCapsule(tag.rest, influence[tag.layer] ?? 0.6));
   }
   for (const probe of probes.values()) {
    largest = Math.max(largest, deformCapsule(probe.point, probe.response).length());
   }
   return largest;
  },
  dispose() {
   for (const [node, vis] of savedStates) node.visible = vis;
   for (const a of arrows) a.arrow.dispose?.();
   hotspotGeo.dispose();
   hotspotMatWarn.dispose();
   hotspotMatCrit.dispose();
   arrowGroup.removeFromParent();
   arrowGroup.clear();
   hotspotGroup.removeFromParent();
   hotspotGroup.clear();
  }
 };
}
