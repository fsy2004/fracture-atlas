// Interactive sidebar panel for limb soft tissues:
// - Real-time bone-to-tissue injury computation readout (Grade 0-3 live collision/strain)
// - Clinical impact analysis (deforming traction muscles, at-risk vessels/nerves, dynamic displacement alerts)
// - Selected structure inspector with anatomical caliber, depth layer, isolate / hide controls
// - Bone-grade searchable, filterable per-structure index with hover & click 3D sync

import { isSoftTissueSupported, isAxialTissueCase, DEPTH_LABELS } from './soft-tissue-catalog.js?v=whole-body1';
import { clinicalSoftTissueFor, displacementImpactNotes, loadAxialClinical } from './soft-tissue-clinical.js?v=whole-body1';
import { damageGradeMeta } from './tissue-damage.js?v=whole-body1';

const LAYER_META = {
 muscles: { label: '肌肉', cls: 'dot-muscle' },
 arteries: { label: '动脉', cls: 'dot-artery' },
 veins: { label: '静脉', cls: 'dot-vein' },
 nerves: { label: '神经', cls: 'dot-nerve' }
};

const GROUP_TAG = {
 proximal: '牵拉近段',
 distal: '牵拉远段',
 joint: '脱位肌群',
 contraction: '主动收缩',
 adjacent: '邻近参照',
 passive: '被动受牵'
};
const GRANULARITY = {group: '集合网格', parent: '父结构参照', reference: '解剖参照'};

export function createSoftTissuePanel(callbacks) {
 const $ = id => document.getElementById(id);
 let filterLayer = 'all';
 let searchQuery = '';
 let currentEntry = null;
 let currentClinical = null;
 let clinicalUpdate = 0;

 const searchInput = $('softSearch');
 const filterHost = $('softFilterTabs');
 const listHost = $('softStructureList');
 const detailBox = $('softSelectedCard');
 const impactBox = $('softImpactBox');
 const telemetryHost = $('softLiveTelemetry');
 const damageBox = $('softDamageBox');

 function buildFilters() {
  if (!filterHost) return;
  const choices = [
   ['all', '全部'],
   ['muscles', '肌肉'],
   ['arteries', '动脉'],
   ['veins', '静脉'],
   ['nerves', '神经']
  ];
  filterHost.replaceChildren();
  for (const [key, label] of choices) {
   const btn = document.createElement('button');
   btn.type = 'button';
   btn.textContent = label;
   btn.classList.toggle('active', key === filterLayer);
   btn.setAttribute('aria-pressed', String(key === filterLayer));
   btn.onclick = () => {
    filterLayer = key;
    buildFilters();
    renderStructureList();
   };
   filterHost.append(btn);
  }
 }

 if (searchInput) {
  searchInput.oninput = () => {
   searchQuery = searchInput.value.trim().toLowerCase();
   renderStructureList();
  };
 }
 buildFilters();

 async function renderClinicalImpact({ selectedBone, course, variant, level, motions }) {
  if (!impactBox) return;
  const update = ++clinicalUpdate;
  currentClinical = null;
  const supported = isSoftTissueSupported(selectedBone);

  const panel = $('softTissuePanel');
  const noteEl = $('softScopeNote');
  const controlsWrap = $('softControlsWrap');
  const stageBar = $('softBar');
  const sevBox = $('softSeverityBox');

  if (!selectedBone) {
   if (panel) panel.hidden = true;
   if (stageBar) stageBar.hidden = true;
   if (sevBox) sevBox.hidden = true;
   impactBox.hidden = true;
   return;
  }

  if (panel) panel.hidden = false;
  if (stageBar) stageBar.hidden = !supported;
  if (sevBox) sevBox.hidden = !(supported && course && variant >= 0);
  if (noteEl) {
   noteEl.hidden = supported;
   noteEl.textContent = supported ? '' : '此入口暂无软组织参照。';
  }
  if (controlsWrap) controlsWrap.hidden = !supported;
  impactBox.hidden = true;
  if (isAxialTissueCase(selectedBone, course?.id)) {
   try { await loadAxialClinical(); }
   catch {
    if (update === clinicalUpdate && noteEl) {
     noteEl.hidden = false;
     noteEl.textContent = '病例软组织说明暂时无法加载。';
    }
    return;
   }
   if (update !== clinicalUpdate) return;
  }
  const clinical = supported ? clinicalSoftTissueFor(course, variant, level, selectedBone) : null;
  currentClinical = clinical;

  if (!clinical) {
   impactBox.hidden = true;
   impactBox.replaceChildren();
   return;
  }

  impactBox.hidden = false;
  impactBox.replaceChildren();

  const summary = document.createElement('p');
  summary.className = 'soft-summary';
  summary.textContent = clinical.summary;
  impactBox.append(summary);

  const muscles = [...(clinical.deforming || []), ...(clinical.adjacent || [])];
  if (muscles.length) {
   const heading = document.createElement('h4');
   heading.className = 'soft-subhead';
   heading.textContent = clinical.axial ? '肌群牵拉与局部邻近' : '牵拉与致畸肌群';
   impactBox.append(heading);

   const ul = document.createElement('div');
   ul.className = 'impact-cards';
   for (const item of muscles) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'impact-card impact-muscle';
    const top = document.createElement('div');
    top.className = 'impact-top';
    const title = document.createElement('strong');
    title.textContent = item.label;
    const badge = document.createElement('span');
    badge.className = 'badge badge-' + item.group;
    badge.textContent = GROUP_TAG[item.group] || '牵拉';
    top.append(title, badge);
    const act = document.createElement('p');
    act.className = 'impact-action';
    act.textContent = item.action;
    const det = document.createElement('small');
    det.textContent = item.detail;
    card.append(top, act, det);
    card.onclick = () => callbacks.focusPattern?.('muscles', item.pattern);
    ul.append(card);
   }
   impactBox.append(ul);
  }

  if (clinical.risks?.length) {
   const heading = document.createElement('h4');
   heading.className = 'soft-subhead';
   heading.textContent = '易损伤血管神经与肌肉风险';
   impactBox.append(heading);

   const ul = document.createElement('div');
   ul.className = 'impact-cards';
   for (const item of clinical.risks) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'impact-card impact-' + item.layer + (item.severity === 'high' ? ' is-high' : '');
    const top = document.createElement('div');
    top.className = 'impact-top';
    const title = document.createElement('strong');
    title.textContent = item.label;
    const badge = document.createElement('span');
    badge.className = 'badge ' + (item.severity === 'high' ? 'badge-high' : 'badge-med');
    badge.textContent = item.severity === 'high' ? '高危' : '留意';
    top.append(title, badge);
    const mech = document.createElement('p');
    mech.className = 'impact-action';
    mech.textContent = item.mechanism;
    const sign = document.createElement('small');
    sign.textContent = '观察：' + item.sign + (GRANULARITY[item.granularity] ? '（' + GRANULARITY[item.granularity] + '）' : '');
    card.append(top, mech, sign);
    card.onclick = () => callbacks.focusPattern?.(item.layer, item.pattern);
    ul.append(card);
   }
   impactBox.append(ul);
  }

  for (const line of clinical.textOnly || []) {
   const note = document.createElement('p');
   note.className = 'soft-summary';
   note.textContent = line;
   impactBox.append(note);
  }
  if (clinical.source) {
   const source = document.createElement('a');
   source.href = clinical.source;
   source.target = '_blank';
   source.rel = 'noopener';
   source.textContent = '临床参考资料';
   impactBox.append(source);
  }

  const dynamicNotes = clinical.axial ? [] : displacementImpactNotes(motions, level, course);
  if (dynamicNotes.length) {
   const box = document.createElement('div');
   box.className = 'dynamic-impact';
   for (const note of dynamicNotes) {
    const row = document.createElement('div');
    row.className = 'dynamic-impact-row';
    const tag = document.createElement('span');
    tag.className = 'badge badge-dyn';
    tag.textContent = note.tag;
    const txt = document.createElement('span');
    txt.textContent = note.text;
    row.append(tag, txt);
    box.append(row);
   }
   impactBox.append(box);
  }
 }

 function renderSelectedDetail() {
  if (!detailBox) return;
  const key = currentEntry?.selectedKey;
  const item = key ? currentEntry.items.find(it => it.key === key) : null;
  if (!item) {
   detailBox.hidden = true;
   detailBox.replaceChildren();
   return;
  }
  detailBox.hidden = false;
  detailBox.replaceChildren();

  const head = document.createElement('div');
  head.className = 'sel-head';
  const dot = document.createElement('span');
  dot.className = 'tissue-dot ' + (LAYER_META[item.sublayer]?.cls || 'dot-muscle');
  const titleWrap = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = item.info.zh;
  const metaParts = [item.info.en];
  if (item.layer === 'muscles' && DEPTH_LABELS[item.info.depth]) metaParts.push(DEPTH_LABELS[item.info.depth]);
  if (item.info.caliber?.refMm) metaParts.push('成人参考管径 ' + item.info.caliber.refMm);
  const en = document.createElement('small');
  en.textContent = metaParts.join(' · ');
  titleWrap.append(title, en);
  head.append(dot, titleWrap);

  const note = document.createElement('p');
  note.className = 'sel-note';
  note.textContent = item.info.note || '解剖软组织结构。';

  detailBox.append(head, note);

  for (const role of item.roles || (item.role ? [item.role] : [])) {
   const roleP = document.createElement('p');
   roleP.className = 'sel-role';
   roleP.textContent = role.role === 'risk'
    ? `风险与观察（${role.severity === 'high' ? '高危' : '留意'}） ${role.mechanism} ${role.sign}`
    : `${GROUP_TAG[role.group] || '牵拉'} · ${role.action} ${role.detail}`;
   detailBox.append(roleP);
  }

  const actions = document.createElement('div');
  actions.className = 'sel-actions';
  const isoBtn = document.createElement('button');
  isoBtn.type = 'button';
  const isIso = currentEntry.isolatedKey === item.key;
  isoBtn.textContent = isIso ? '恢复显示全部' : '独显此结构';
  isoBtn.classList.toggle('primary', isIso);
  isoBtn.onclick = () => callbacks.isolate?.(isIso ? null : item.key);

  const hideBtn = document.createElement('button');
  hideBtn.type = 'button';
  hideBtn.textContent = item.enabled ? '隐藏此结构' : '重新显示';
  hideBtn.onclick = () => callbacks.toggleItem?.(item.key, !item.enabled);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = '取消选中';
  clearBtn.onclick = () => callbacks.select?.(null);

  actions.append(isoBtn, hideBtn, clearBtn);
  detailBox.append(actions);
 }

 function renderStructureList() {
  const wrap = $('softStructureWrap');
  if (!wrap || !listHost) return;
  if (!currentEntry || !currentEntry.items?.length) {
   wrap.hidden = true;
   listHost.replaceChildren();
   return;
  }
  wrap.hidden = false;
  const visibleItems = currentEntry.items.filter(it => {
   if (filterLayer !== 'all' && it.sublayer !== filterLayer && it.layer !== filterLayer) return false;
   if (searchQuery) {
    const hay = `${it.info.zh} ${it.info.en} ${it.info.note} ${DEPTH_LABELS[it.info.depth] || ''} ${it.role?.label || ''}`.toLowerCase();
    if (!hay.includes(searchQuery)) return false;
   }
   return true;
  });

  const countEl = $('softStructureCount');
  if (countEl) {
   const shownNow = currentEntry.items.filter(it => it.mesh.visible).length;
   countEl.textContent = `当前显示 ${shownNow} / 共建模 ${currentEntry.items.length} 项软组织`;
  }

  listHost.replaceChildren();
  if (!visibleItems.length) {
   const empty = document.createElement('p');
   empty.className = 'empty';
   empty.textContent = '当前筛选范围内无匹配结构';
   listHost.append(empty);
   return;
  }

  for (const it of visibleItems) {
   const row = document.createElement('div');
   row.className = 'soft-row' + (currentEntry.selectedKey === it.key ? ' is-selected' : '') + (!it.mesh.visible ? ' is-dim' : '');

   const chk = document.createElement('input');
   chk.type = 'checkbox';
   chk.checked = it.mesh.visible;
   chk.setAttribute('aria-label', '显隐' + it.info.zh);
   chk.onchange = () => callbacks.toggleItem?.(it.key, chk.checked);

   const btn = document.createElement('button');
   btn.type = 'button';
   btn.className = 'soft-row-btn';
   const dot = document.createElement('span');
   dot.className = 'tissue-dot ' + (LAYER_META[it.sublayer]?.cls || 'dot-muscle');
   const nameWrap = document.createElement('span');
   nameWrap.className = 'soft-row-name';
   const zh = document.createElement('strong');
   zh.textContent = it.info.zh;
   const en = document.createElement('small');
   en.textContent = it.layer === 'muscles' ? `${DEPTH_LABELS[it.info.depth]} · ${it.info.en}` : it.info.en;
   nameWrap.append(zh, en);
   btn.append(dot, nameWrap);

   if (it.role) {
    const tag = document.createElement('span');
    tag.className = 'badge ' + (it.role.role === 'risk' ? it.role.severity === 'high' ? 'badge-high' : 'badge-med' : 'badge-pull');
    tag.textContent = it.role.role === 'risk' ? it.role.severity === 'high' ? '高危' : '留意' : GROUP_TAG[it.role.group] || '牵拉';
    btn.append(tag);
   }

   btn.onmouseenter = () => callbacks.hover?.(it.key);
   btn.onmouseleave = () => callbacks.hover?.(null);
   btn.onclick = () => callbacks.select?.(it.key);

   row.append(chk, btn);
   listHost.append(row);
  }
 }

 function renderDamageEvents(telemetry) {
  if (!damageBox) return;
  if (!telemetry || !currentEntry?.motion) {
   damageBox.hidden = true;
   damageBox.replaceChildren();
   return;
  }
  damageBox.hidden = false;
  damageBox.replaceChildren();

  const events = telemetry.damageEvents || [];
  const head = document.createElement('div');
  head.className = 'dmg-head';
  const meta = damageGradeMeta(telemetry.maxGrade || 0);
  const title = document.createElement('strong');
  title.textContent = '实时软组织损伤演算';
  const statusPill = document.createElement('span');
  statusPill.className = 'badge dmg-grade-' + meta.grade;
  statusPill.textContent = events.length ? `最高 ${meta.label}` : '当前未检出明显破坏';
  head.append(title, statusPill);
  damageBox.append(head);

  if (!events.length) {
   const ok = document.createElement('p');
   ok.className = 'dmg-safe';
   ok.textContent = '当前帧移位幅度下，可见肌肉与血管神经均未受到直接骨端顶压或过载牵张；可切换“重度致伤”或在高级设置加大移位观察软组织受损过程。';
   damageBox.append(ok);
   return;
  }

  const list = document.createElement('div');
  list.className = 'dmg-list';
  for (const ev of events.slice(0, 6)) {
   const g = damageGradeMeta(ev.grade);
   const card = document.createElement('button');
   card.type = 'button';
   card.className = 'dmg-card dmg-card-' + ev.grade;
   const top = document.createElement('div');
   top.className = 'dmg-top';
   const left = document.createElement('span');
   left.className = 'dmg-name';
   const dot = document.createElement('i');
   dot.className = 'tissue-dot ' + (LAYER_META[ev.sublayer]?.cls || 'dot-muscle');
   const nm = document.createElement('strong');
   nm.textContent = ev.name;
   left.append(dot, nm);
   const gb = document.createElement('span');
   gb.className = 'badge dmg-grade-' + ev.grade;
   gb.textContent = g.label;
   top.append(left, gb);

   const desc = document.createElement('p');
   desc.className = 'dmg-desc';
   desc.textContent = ev.summary;

   const metrics = document.createElement('small');
   const parts = [];
   if (ev.approachMm >= 1.2) parts.push(`${ev.boneSegment || '断端'}逼近 ${ev.approachMm.toFixed(1)} mm`);
   if (Number.isFinite(ev.clearanceMm) && ev.clearanceMm < 25) parts.push(`当前间距 ${ev.clearanceMm.toFixed(1)} mm`);
   if (Math.abs(ev.strainPct) >= 1) parts.push(`牵张 ${ev.strainPct > 0 ? '+' : ''}${ev.strainPct.toFixed(1)}%`);
   metrics.textContent = parts.join(' · ');

   card.append(top, desc, metrics);
   card.onclick = () => callbacks.select?.(ev.key);
   list.append(card);
  }
  damageBox.append(list);
 }

 function renderTelemetry(telemetry) {
  renderDamageEvents(telemetry);
  if (!telemetryHost) return;
  if (!telemetry || (!telemetry.muscles.length && !telemetry.neurovascular.length)) {
   telemetryHost.hidden = true;
   telemetryHost.replaceChildren();
   return;
  }
  const hasChange = telemetry.muscles.some(m => Math.abs(m.deltaPct) >= 0.4) ||
   telemetry.neurovascular.some(nv => nv.shiftMm >= 0.4);
  if (!hasChange) {
   telemetryHost.hidden = true;
   return;
  }
  telemetryHost.hidden = false;
  telemetryHost.replaceChildren();

  const title = document.createElement('div');
  title.className = 'tele-title';
  title.textContent = '肌长与神经血管偏移读数（当前帧）';
  telemetryHost.append(title);

  const grid = document.createElement('div');
  grid.className = 'tele-grid';
  for (const m of telemetry.muscles.slice(0, 4)) {
   if (Math.abs(m.deltaPct) < 0.3) continue;
   const pill = document.createElement('button');
   pill.type = 'button';
   pill.className = 'tele-pill tele-muscle';
   const state = m.deltaPct < 0 ? '缩短' : '牵张';
   const sign = m.deltaPct > 0 ? '+' : '';
   pill.textContent = `${m.name} ${sign}${m.deltaPct.toFixed(1)}%（${state}）`;
   pill.onclick = () => callbacks.select?.(m.key);
   grid.append(pill);
  }
  for (const nv of telemetry.neurovascular.slice(0, 4)) {
   if (nv.shiftMm < 0.4) continue;
   const pill = document.createElement('button');
   pill.type = 'button';
   pill.className = 'tele-pill tele-' + nv.layer;
   const risk = nv.shiftMm >= 6 ? '明显偏移' : '局部牵移';
   pill.textContent = `${nv.name} ${nv.shiftMm.toFixed(1)}mm（${risk}）`;
   pill.onclick = () => callbacks.select?.(nv.key);
   grid.append(pill);
  }
  telemetryHost.append(grid);
 }

 return {
  setEntry(entry) {
   currentEntry = entry;
   renderSelectedDetail();
   renderStructureList();
   if (!entry) {
    if (telemetryHost) telemetryHost.hidden = true;
    if (damageBox) damageBox.hidden = true;
   }
  },
  updateClinical: renderClinicalImpact,
  refreshSelection() {
   renderSelectedDetail();
   renderStructureList();
  },
  updateTelemetry: renderTelemetry,
  getClinical: () => currentClinical
 };
}
