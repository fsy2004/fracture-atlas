import * as T from './vendor/three.module.js';

// Real-time 3D biomechanical damage engine:
// Continuously evaluates actual geometric clearance, bone-tip approach/penetration,
// and longitudinal muscle/neurovascular stretch between live posed bone fragments
// (including sharp cortical fracture rims & dislocated joint heads) and each soft tissue.
//
// As the student adjusts fracture amplitude, angulation, or 6-axis fragment offsets,
// damage transitions smoothly in real time:
//   Grade 0 (未累及) -> Grade 1 (牵拉/邻近受压) -> Grade 2 (挫伤/明显压迫/痉挛) -> Grade 3 (断端刺破/撕裂高危)

const GRADE_META = [
 { grade: 0, key: 'safe', label: '未累及', color: '#2b6a56' },
 { grade: 1, key: 'stretch', label: 'Ⅰ级 · 牵拉/邻近压迫', color: '#c47b16' },
 { grade: 2, key: 'contusion', label: 'Ⅱ级 · 挫伤/重度卡压', color: '#c94524' },
 { grade: 3, key: 'laceration', label: 'Ⅲ级 · 断端刺破/撕裂高危', color: '#a81414' }
];

export function damageGradeMeta(grade) {
 return GRADE_META[Math.max(0, Math.min(3, grade))] || GRADE_META[0];
}

// Extract sharp cortical fracture-rim probes (or dislocated joint-head surface probes)
// in each actor's local pivot space so every frame needs only fast matrix transforms.
export function extractBoneProbes(actors, boneGroup) {
 const probes = [];
 const worldMat = boneGroup.matrixWorld;
 const tmp = new T.Vector3();

 for (const actor of actors) {
  if (!actor.pivot) continue;
  const isJoint = Boolean(actor.jointLabel);
  const localPts = [];

  // Prefer sharp cortical fracture rim vertices for fractures
  const rimAttr = actor.edge?.geometry?.attributes?.position;
  if (rimAttr && rimAttr.count > 0) {
   const step = Math.max(1, Math.floor(rimAttr.count / 36));
   for (let i = 0; i < rimAttr.count; i += step) {
    // edge sits inside pivot with offset = -anchor
    tmp.fromBufferAttribute(rimAttr, i).sub(actor.anchor);
    localPts.push(tmp.clone());
   }
  } else {
   // Dislocation or uncut moving bone: sample outer surface near the joint head / anchor
   const mesh = actor.shell || actor.pivot.children.find(c => c.isMesh && c.geometry);
   const posAttr = mesh?.geometry?.attributes?.position;
   if (posAttr && posAttr.count > 0) {
    const step = Math.max(1, Math.floor(posAttr.count / 180));
    const near = [];
    for (let i = 0; i < posAttr.count; i += step) {
     tmp.fromBufferAttribute(posAttr, i);
     const d = tmp.distanceTo(actor.anchor);
     if (d < 0.085) near.push({ p: tmp.clone().sub(actor.anchor), d });
    }
    near.sort((a, b) => a.d - b.d);
    const take = Math.min(36, near.length);
    const stride = Math.max(1, Math.floor(near.length / Math.max(1, take)));
    for (let i = 0; i < near.length && localPts.length < 36; i += stride) {
     localPts.push(near[i].p);
    }
   }
  }

  if (!localPts.length) continue;
  // Precompute rest world coordinates (when pivot.position === anchor and quaternion === identity)
  const restWorld = localPts.map(lp => lp.clone().add(actor.anchor).applyMatrix4(worldMat));
  probes.push({
   actor,
   isJoint,
   segment: actor.segment || (isJoint ? '脱位骨端' : '骨块'),
   localPts,
   restWorld,
   liveWorld: restWorld.map(p => p.clone())
  });
 }
 return probes;
}

// Sample rest-pose 3D points on a soft-tissue mesh (in world coordinates after registration)
export function sampleTissuePoints(mesh, maxCount = 54) {
 const attr = mesh.geometry?.attributes?.position;
 if (!attr || !attr.count) return [];
 const step = Math.max(1, Math.floor(attr.count / maxCount));
 const pts = [];
 for (let i = 0; i < attr.count; i += step) {
  pts.push(new T.Vector3().fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld));
 }
 return pts;
}

// Pure biomechanical severity scoring function (exported for unit testing!)
const REFERENCE_KINDS = {
 'central-reference': '中枢神经参照',
 'meningeal-reference': '硬膜参照',
 'ganglion-group': '神经节组',
 'nerve-group': '神经集合网格',
 'cranial-nerve': '脑神经',
 'venous-sinus': '硬膜静脉回流通道'
};

export function scoreTissueInjury({ layer, sublayer, structureKind, registrationErrorMm = 0, restClearanceMm, liveClearanceMm, approachMm, strainPct, isSharpRim }) {
 const reference = REFERENCE_KINDS[structureKind];
 if (reference || registrationErrorMm > 0 && approachMm <= registrationErrorMm) {
  const measurable = Number.isFinite(liveClearanceMm) && approachMm > registrationErrorMm;
  return {grade: 0, severity: 0, kind: 'reference', dominatedByImpinge: false,
   summary: !measurable && registrationErrorMm > 0 ? '距离变化处于配准误差范围' :
    (reference || '软组织') + ' · 对照几何邻近与病例风险说明'};
 }
 const absStrain = Math.max(0, strainPct); // positive = passive elongation/tension; negative = shortening/contraction
 const shortenPct = Math.max(0, -strainPct);

 // Thresholds calibrated by tissue type:
 // - Arteries & nerves are exquisitely sensitive to direct bony compression/impingement & longitudinal stretch (>10-15% nerve strain impairs conduction)
 // - Muscles tolerate more elongation (~15-25%) before partial tear, but sharp cortical spikes directly piercing muscle belly cause contusion/laceration
 let impinge = 0;
 const approachFloor = layer === 'muscles' ? 2.4 : 1.6;
 if (approachMm > approachFloor) {
  const contactZone = layer === 'muscles' ? 6.5 : 8.0;
  const nearFactor = T.MathUtils.clamp((contactZone - liveClearanceMm) / contactZone, 0, 1);
  const deltaFactor = T.MathUtils.clamp((approachMm - approachFloor) / (isSharpRim ? 8.5 : 11.5), 0, 1);
  const pierceThreshold = layer === 'muscles' ? 5.5 : 4.2;
  const pierceBonus = liveClearanceMm < (isSharpRim ? 1.8 : 1.4) && approachMm > pierceThreshold
   ? T.MathUtils.clamp((approachMm - pierceThreshold) / 6.0, 0, 0.52)
   : 0;
  impinge = T.MathUtils.clamp(nearFactor * (0.40 + 0.60 * deltaFactor) + pierceBonus, 0, 1);
 }

 let stretchScore = 0;
 if (layer === 'nerves') {
  stretchScore = T.MathUtils.clamp((absStrain - 7) / 18, 0, 1);
 } else if (layer === 'vessels') {
  stretchScore = T.MathUtils.clamp((absStrain - 8) / 22, 0, 1);
 } else {
  stretchScore = T.MathUtils.clamp((absStrain - 14) / 22, 0, 0.90);
 }

 const severity = T.MathUtils.clamp(Math.max(impinge, stretchScore), 0, 1);
 let grade = 0;
 if (severity >= 0.76) grade = 3;
 else if (severity >= 0.48) grade = 2;
 else if (severity >= 0.22) grade = 1;

 let kind = 'safe';
 let summary = '当前移位幅度下未直接受压或撕裂';
 if (grade > 0) {
  const dominatedByImpinge = impinge >= stretchScore;
  if (layer === 'nerves') {
   if (grade === 3) { kind = dominatedByImpinge ? 'laceration' : 'rupture'; summary = dominatedByImpinge ? '断端直接刺压/卡夹神经干（轴索断裂/断裂高危）' : '过度牵张超过神经耐受阈（重度牵拉伤）'; }
   else if (grade === 2) { kind = 'contusion'; summary = dominatedByImpinge ? '骨端贴压致神经挫伤/传导阻滞风险' : '神经明显受牵拉（神经失用/挫伤风险）'; }
   else { kind = 'stretch'; summary = dominatedByImpinge ? '断端逼近神经干，存在局部轻度压迫' : '神经轻度牵张，需观察远端感觉运动'; }
  } else if (layer === 'vessels') {
   const isArtery = sublayer !== 'veins';
   if (grade === 3) { kind = 'laceration'; summary = isArtery ? '断端顶刺动脉壁（内膜撕裂/破裂出血/远端缺血危象！）' : '断端压迫刺伤静脉壁（大血肿/回流受阻）'; }
   else if (grade === 2) { kind = isArtery ? 'spasm' : 'compression'; summary = isArtery ? '骨端顶压诱发动脉痉挛狭窄与血栓风险' : '静脉受压变窄，回流障碍致肢体肿胀'; }
   else { kind = 'compression'; summary = isArtery ? '断端邻近动脉，存在轻度压迫或痉挛倾向' : '邻近静脉轻度受压'; }
  } else {
   if (grade === 3) { kind = 'laceration'; summary = dominatedByImpinge ? '锐利断端刺入肌腹（肌纤维撕裂与局部血肿形成）' : '肌腹过度被动牵张（肌纤维部分撕裂高危）'; }
   else if (grade === 2) { kind = 'contusion'; summary = dominatedByImpinge ? '骨折端顶压肌腹引起局部挫伤肿胀出血' : '肌肉被动拉长显著，肌张力明显增高'; }
   else { kind = 'stretch'; summary = dominatedByImpinge ? '骨端轻度顶推周围肌腹' : '肌纤维轻度被动牵张'; }
  }
 } else if (layer === 'muscles' && shortenPct >= 3.0) {
  summary = `主动牵拉缩短 ${shortenPct.toFixed(1)}%（驱动骨段移位）`;
 }

 return { grade, severity, kind, summary, dominatedByImpinge: impinge >= stretchScore };
}

export function createDamageSolver(actors, boneGroup, entry) {
 const boneProbes = extractBoneProbes(actors, boneGroup);
 const tissueTargets = [];

 for (const item of entry.items || []) {
  const pts = sampleTissuePoints(item.mesh, item.layer === 'muscles' ? 60 : 48);
  if (!pts.length) continue;

  // Compute baseline healthy rest clearance (t = 0) between each probe and this tissue
  let restMin = Infinity;
  for (const bp of boneProbes) {
   for (const rp of bp.restWorld) {
    for (const tp of pts) {
     const d = rp.distanceTo(tp);
     if (d < restMin) restMin = d;
    }
   }
  }

  tissueTargets.push({
   item,
   pts,
   restMinMm: restMin * 1000,
   hitPoint: new T.Vector3(),
   hitDir: new T.Vector3(0, 0, 1),
   result: { grade: 0, severity: 0, kind: 'safe', summary: '' }
  });
 }

 const tmpPivotMat = new T.Matrix4();
 const tmpWorldMat = new T.Matrix4();
 const one = new T.Vector3(1, 1, 1);
 const deltaVec = new T.Vector3();
 const toTissue = new T.Vector3();
 const groupMat = boneGroup.matrixWorld;

 // Update live bone probe world positions and evaluate damage across all visible structures
 function evaluate(muscleStrainByKey, nvShiftByKey) {
  // 1. Transform all sharp bone rim / joint-head probes to live world space
  for (const bp of boneProbes) {
   const { pivot } = bp.actor;
   tmpPivotMat.compose(pivot.position, pivot.quaternion, one);
   tmpWorldMat.copy(groupMat).multiply(tmpPivotMat);
   for (let i = 0; i < bp.localPts.length; i++) {
    bp.liveWorld[i].copy(bp.localPts[i]).applyMatrix4(tmpWorldMat);
   }
  }

  const events = [];
  let maxGrade = 0;
  let maxSeverity = 0;

  // 2. For every visible soft tissue, compute live closest impingement & stretch
  for (const target of tissueTargets) {
   const { item, pts } = target;
   if (!item.mesh.visible) {
    target.result = { grade: 0, severity: 0, kind: 'safe', summary: '', severityVal: 0 };
    continue;
   }

   let bestScore = -1;
   let bestClearanceMm = Infinity;
   let bestApproachMm = 0;
   let bestBoneSegment = '';
   let hitPt = null;
   let hitDir = null;

   for (const bp of boneProbes) {
    for (let bi = 0; bi < bp.liveWorld.length; bi++) {
     const liveB = bp.liveWorld[bi];
     const restB = bp.restWorld[bi];
     deltaVec.copy(liveB).sub(restB);
     const moveLen = deltaVec.length();
     if (moveLen < 0.0006) continue; // stationary bone fragment cannot acutely impinge

     for (let ti = 0; ti < pts.length; ti++) {
      const tp = pts[ti];
      const dNow = liveB.distanceTo(tp);
      if (dNow > 0.028) continue;
      toTissue.copy(tp).sub(restB);
      const distRest = toTissue.length();
      // How much did this bone point move CLOSER to the tissue?
      const closedGapMm = Math.max(0, (distRest - dNow) * 1000);
      const dNowMm = dNow * 1000;
      // Directional approach score favors points directly struck by moving bone
      const dirScore = closedGapMm / Math.max(1.5, dNowMm + 1.5);
      if (dirScore > bestScore) {
       bestScore = dirScore;
       bestClearanceMm = dNowMm;
       bestApproachMm = closedGapMm;
       bestBoneSegment = bp.segment;
       hitPt = tp;
       hitDir = deltaVec.clone().normalize();
      }
     }
    }
   }

   // Compute longitudinal stretch % (exact for muscles from ΔL%, estimated for vessels/nerves from local tenting shift)
   let strainPct = 0;
   if (item.layer === 'muscles') {
    strainPct = muscleStrainByKey.get(item.key) || 0;
   } else {
    const shiftMm = nvShiftByKey.get(item.key) || 0;
    // Tenting a nerve/artery across a ~45mm span creates geometric elongation ~ sqrt(L^2 + s^2) - L
    if (shiftMm > 0.5) {
     const spanMm = 38;
     strainPct = ((Math.hypot(spanMm, shiftMm) - spanMm) / spanMm) * 100 * 1.9;
    }
   }

   const isSharpRim = boneProbes.some(bp => !bp.isJoint);
   const scored = scoreTissueInjury({
    layer: item.layer,
    sublayer: item.sublayer,
    structureKind: item.info?.kind,
    registrationErrorMm: entry.registrationErrorMm,
    restClearanceMm: target.restMinMm,
    liveClearanceMm: bestClearanceMm,
    approachMm: bestApproachMm,
    strainPct,
    isSharpRim
   });

   if (hitPt) target.hitPoint.copy(hitPt);
   else target.hitPoint.copy(pts[Math.floor(pts.length / 2)]);
   if (hitDir) target.hitDir.copy(hitDir);

   target.result = {
    ...scored,
    clearanceMm: bestClearanceMm,
    approachMm: bestApproachMm,
    strainPct,
    boneSegment: bestBoneSegment,
    hitPoint: target.hitPoint.clone(),
    hitDir: target.hitDir.clone()
   };

   if (scored.grade > maxGrade) maxGrade = scored.grade;
   if (scored.severity > maxSeverity) maxSeverity = scored.severity;

   if (scored.grade >= 1) {
    events.push({
     key: item.key,
     name: item.info.zh,
     shortName: item.info.zhBase,
     layer: item.layer,
     sublayer: item.sublayer,
     grade: scored.grade,
     severity: scored.severity,
     kind: scored.kind,
     summary: scored.summary,
     clearanceMm: bestClearanceMm,
     approachMm: bestApproachMm,
     strainPct,
     boneSegment: bestBoneSegment,
     hitPoint: target.hitPoint.clone()
    });
   }
  }

  events.sort((a, b) => b.grade - a.grade || b.severity - a.severity);
  return { targets: tissueTargets, events, maxGrade, maxSeverity };
 }

 return { evaluate, targets: tissueTargets };
}
