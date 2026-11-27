// Clinical summary and structure browser for the case workbench.
import { DEPTH_LABELS, ZONE_LABELS, isAxialTissueCase, isSoftTissueSupported, loadAxialTerms, softTissueInfo } from './soft-tissue-catalog.js?v=whole-body1';
import { clinicalSoftTissueFor, displacementImpactNotes, loadAxialClinical } from './soft-tissue-clinical.js?v=whole-body1';
import { readCatalogue } from './soft-tissue-view.js?v=ui-a1';
import { damageGradeMeta } from './tissue-damage.js?v=whole-body1';

const LAYER_DOT = { muscles: 'dot-muscle', arteries: 'dot-artery', veins: 'dot-vein', nerves: 'dot-nerve' };
const GROUP_LABEL = {
 proximal: '牵拉近段',
 distal: '牵拉远段',
 joint: '脱位肌群',
 contraction: '主动收缩',
 adjacent: '邻近参照',
 passive: '被动受牵'
};
const GRANULARITY = { group: '集合网格', parent: '父结构参照', reference: '解剖参照' };
const PAGE_SIZE = 50;

function element(tag, text = '', className = '') {
 const node = document.createElement(tag);
 if (text) node.textContent = text;
 if (className) node.className = className;
 return node;
}

function action(text, run, className) {
 const button = element('button', text, className);
 button.type = 'button';
 button.onclick = run;
 return button;
}

export function createSoftTissuePanel(callbacks) {
 const $ = id => document.getElementById(id);
 const impactBox = $('softImpactBox'), detailBox = $('softSelectedCard'), list = $('softStructureList');
 const count = $('softStructureCount'), more = $('softMoreResults'), search = $('softSearch');
 let catalogue = [], loadingCatalogue, catalogueReady = false, catalogueFailed = false;
 let filter = 'all', query = '', limit = PAGE_SIZE;
 let currentEntry = null, preview = null, clinicalUpdate = 0, clinicalKey = '';
 let telemetry = null, reading = null, detailKey = '';

 const filters = [
  ['all', '全部'], ['muscles', '肌肉'], ['vessels', '血管'], ['nerves', '神经']
 ].map(([key, label]) => action(label, () => {
  filter = key;
  for (const button of filters) button.setAttribute('aria-pressed', String(button.textContent === label));
  limit = PAGE_SIZE;
  renderList();
 }));
 filters.forEach((button, i) => button.setAttribute('aria-pressed', String(i === 0)));
 $('softFilterTabs').append(...filters);
 search.oninput = () => {
  query = search.value.trim().toLowerCase();
  limit = PAGE_SIZE;
  renderList();
 };
 more.onclick = () => {
  const previous = limit;
  limit += PAGE_SIZE;
  renderList();
  list.children[previous]?.querySelector('button')?.focus({preventScroll:true});
 };

 function openCatalogue() {
  if (loadingCatalogue || catalogueReady) return;
  catalogueFailed = false;
  renderList();
  loadingCatalogue = Promise.all([readCatalogue(), loadAxialTerms()]).then(([manifest]) => {
   catalogue = ['muscles', 'vessels', 'nerves']
    .flatMap(layer => Object.entries(manifest.structures[layer]).map(([key, record]) => ({
     key, layer, zone: record.region, info: softTissueInfo(layer, key)
    }))).sort((a, b) => a.info.zh.localeCompare(b.info.zh, 'zh-CN'));
   catalogueReady = true;
  }).catch(() => { catalogueFailed = true; }).finally(() => {
   loadingCatalogue = null;
   renderList();
  });
 }

 function clinicalItem(item, layer) {
  const row = element('div', '', 'clinical-item');
  const name = item.pattern ? action(item.label, () => callbacks.focusPattern(layer, item.pattern, item.label)) : element('strong', item.label);
  row.append(name);
  const copy = item.mechanism ? [item.mechanism, item.sign, GRANULARITY[item.granularity]] : [item.action, item.detail];
  row.append(element('p', copy.filter(Boolean).join(' '), 'hint'));
  return row;
 }

 async function updateClinical({ selectedBone, course, variant, level, motions }) {
  const supported = isSoftTissueSupported(selectedBone);
  const nextKey = [selectedBone, course?.id, variant, level, ...motions].join('/');
  if (nextKey === clinicalKey) return;
  clinicalKey = nextKey;
  const update = ++clinicalUpdate;
  const scope = $('softScopeNote');
  $('softBar').hidden = !supported;
  scope.hidden = supported;
  scope.textContent = supported ? '' : '此骨暂无可叠加的局部软组织。';
  impactBox.hidden = true;
  impactBox.replaceChildren();
  if (!supported || !course || variant < 0) return;

  if (isAxialTissueCase(selectedBone, course.id)) {
   try { await loadAxialClinical(); }
   catch {
    if (update === clinicalUpdate) {
     clinicalKey = '';
     impactBox.hidden = false;
     impactBox.append(element('p', '病例软组织说明暂时无法加载。', 'hint'));
    }
    return;
   }
   if (update !== clinicalUpdate) return;
  }
  const clinical = clinicalSoftTissueFor(course, variant, level, selectedBone);
  if (!clinical) return;
  impactBox.hidden = false;
  impactBox.append(element('h3', '机制与风险'), element('p', clinical.summary, 'soft-summary'));
  const risks = [...new Map((clinical.risks || []).map(risk => [risk.label, risk])).values()];
  const priority = risks.some(risk => risk.severity === 'high') ? risks.filter(risk => risk.severity === 'high') : risks;
  const featured = priority.slice(0, 3);
  if (featured.length) {
   const line = element('div', '', 'clinical-risks');
   line.append(element('span', featured[0].severity === 'high' ? '高危结构' : '留意结构', 'clinical-label'));
   for (const risk of featured) {
    line.append(risk.pattern ? action(risk.label, () => callbacks.focusPattern(risk.layer, risk.pattern, risk.label)) : element('span', risk.label));
   }
   impactBox.append(line);
  }

  const details = element('details', '', 'clinical-details');
  details.append(element('summary', '查看风险说明与来源'));
  for (const risk of risks) details.append(clinicalItem(risk, risk.layer));
  for (const item of [...(clinical.deforming || []), ...(clinical.adjacent || [])]) details.append(clinicalItem(item, 'muscles'));
  for (const note of clinical.textOnly || []) details.append(element('p', note, 'hint'));
  for (const note of clinical.axial ? [] : displacementImpactNotes(motions, level, course)) {
   details.append(element('p', note.tag + ' · ' + note.text, 'hint'));
  }
  if (clinical.source) {
   const source = element('a', '临床参考资料');
   source.href = clinical.source;
   source.target = '_blank';
   source.rel = 'noopener noreferrer';
   details.append(source);
  }
  if (details.childElementCount > 1) impactBox.append(details);
 }

 function selectedItem() {
  return currentEntry?.items.find(item => item.key === currentEntry.selectedKey);
 }

 function renderDetail() {
  const item = selectedItem() || preview;
  const keepOpen = detailKey === item?.key && Boolean(reading?.parentElement.open);
  detailKey = item?.key;
  reading = null;
  detailBox.hidden = !item;
  detailBox.replaceChildren();
  if (!item) return;

  const head = element('div', '', 'sel-head');
  const names = element('div');
  const meta = [ZONE_LABELS[item.zone], item.info.en];
  if (item.layer === 'muscles') meta.push(DEPTH_LABELS[item.info.depth]);
  if (item.info.caliber?.refMm) meta.push('成人参考管径 ' + item.info.caliber.refMm);
  names.append(element('strong', item.info.zh), element('small', meta.filter(Boolean).join(' · ')));
  head.append(element('span', '', 'tissue-dot ' + LAYER_DOT[item.info.sublayer]), names);
  detailBox.append(head);
  if (item.info.note) detailBox.append(element('p', item.info.note, 'sel-note'));

  for (const role of item.roles || (item.role ? [item.role] : [])) {
   const text = role.role === 'risk' ? [role.mechanism, role.sign, GRANULARITY[role.granularity]].filter(Boolean).join(' ')
    : [GROUP_LABEL[role.group], role.action, role.detail].filter(Boolean).join(' · ');
   detailBox.append(element('p', text, 'sel-role'));
  }

  const controls = element('div', '', 'sel-actions');
  if (item.mesh) {
   if (!currentEntry.isolatedKey || currentEntry.isolatedKey !== item.key) controls.append(action('独显此结构', () => {
    callbacks.isolate(item.key);
    detailBox.focus();
   }));
   controls.append(action(item.enabled ? '隐藏此结构' : '重新显示', () => {
    callbacks.toggleItem(item.key, !item.enabled);
    detailBox.focus();
   }));
  }
  controls.append(action('取消选中', () => {
   clearPreview();
   callbacks.select(null);
   search.focus();
  }));
  detailBox.append(controls);
  if (item.mesh && currentEntry.motion) {
   const details = element('details');
   details.open = keepOpen;
   reading = element('p', '', 'hint');
   details.append(element('summary', '当前帧读数'), reading);
   details.ontoggle = renderReadings;
   detailBox.append(details);
   renderReadings();
  }
 }

 function renderReadings() {
  if (!reading?.parentElement.open) return;
  const item = selectedItem();
  if (!item || !telemetry) return;
  const muscle = telemetry.muscles.find(row => row.key === item.key);
  const vesselOrNerve = telemetry.neurovascular.find(row => row.key === item.key);
  const event = telemetry.damageEvents.find(row => row.key === item.key);
  const parts = [];
  if (muscle) parts.push('肌长变化 ' + muscle.deltaPct.toFixed(1) + '%');
  if (vesselOrNerve) parts.push('相对伤前偏移 ' + vesselOrNerve.shiftMm.toFixed(1) + ' mm');
  if (event) {
   parts.push(damageGradeMeta(event.grade).label + ' · ' + event.summary);
   if (Number.isFinite(event.clearanceMm)) parts.push('当前间距 ' + event.clearanceMm.toFixed(1) + ' mm');
   if (event.approachMm >= 1.2) parts.push('断端逼近 ' + event.approachMm.toFixed(1) + ' mm');
   if (Math.abs(event.strainPct) >= 1 && !muscle) parts.push('牵张 ' + event.strainPct.toFixed(1) + '%');
  }
  reading.textContent = parts.join(' · ') || '当前帧暂无可报告的变化。';
 }

 function clearPreview() {
  preview = null;
  renderDetail();
  renderList();
 }

 function renderList() {
  const local = currentEntry?.items || [];
  const includeCatalogue = Boolean(query || filter !== 'all' || !local.length);
  const activeKeys = new Set(local.map(item => item.layer + ':' + item.key));
  const matches = item => (filter === 'all' || filter === item.layer) &&
   (!query || [item.info.zh, item.info.en, item.info.note, item.role?.label, ZONE_LABELS[item.zone], DEPTH_LABELS[item.info.depth]]
    .some(value => value?.toLowerCase().includes(query)));
  const results = local.filter(matches);
  if (includeCatalogue) results.push(...catalogue.filter(item => !activeKeys.has(item.layer + ':' + item.key) && matches(item)));

  list.replaceChildren();
  count.hidden = !query && filter === 'all';
  count.textContent = results.length + ' 项匹配结构';
  more.hidden = results.length <= limit;
  if (!results.length) {
   if (catalogueFailed) list.append(action('名录暂不可用，重试', openCatalogue));
   else list.append(element('p', catalogueReady ? '没有匹配结构' : '正在读取全身结构名录…', 'empty'));
   return;
  }
  for (const item of results.slice(0, limit)) {
   const selected = item.mesh ? item.key === currentEntry.selectedKey : item === preview;
   const button = action('', () => {
    if (item.mesh) {
     preview = null;
     callbacks.select(item.key);
    } else {
     callbacks.select(null);
     preview = item;
     renderDetail();
     renderList();
    }
    detailBox.focus();
   }, 'soft-row-btn');
   button.setAttribute('aria-pressed', String(selected));
   const names = element('span', '', 'soft-row-name');
   names.append(element('strong', item.info.zh), element('small', [ZONE_LABELS[item.zone], item.info.en].filter(Boolean).join(' · ')));
   button.append(element('span', '', 'tissue-dot ' + LAYER_DOT[item.info.sublayer]), names);
   if (item.role?.role === 'risk' && item.role.severity === 'high') button.append(element('span', '高危', 'badge badge-high'));
   else if (item.role?.role === 'deforming') button.append(element('span', GROUP_LABEL[item.role.group] || '牵拉', 'badge badge-pull'));
   if (item.mesh) {
    button.onmouseenter = () => callbacks.hover(item.key);
    button.onmouseleave = () => callbacks.hover(null);
   }
   const row = element('div', '', 'soft-row' + (selected ? ' is-selected' : ''));
   row.append(button);
   list.append(row);
  }
 }

 return {
  openCatalogue,
  updateClinical,
  setEntry(entry) {
   currentEntry = entry;
   telemetry = null;
   renderDetail();
   renderList();
  },
  refreshSelection() {
   if (selectedItem()) preview = null;
   renderDetail();
   renderList();
  },
  updateTelemetry(next) {
   telemetry = next;
   renderReadings();
  }
 };
}
