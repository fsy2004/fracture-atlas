// Course keys and stable variant IDs follow variant-registry.js.
const sources = {
 skull: 'https://ifaa.net/committees/anatomical-terminology-fipat/fipat-ifaa-terminologies/',
 orbit: 'https://surgeryreference.aofoundation.org/cmf/trauma/midface/further-reading/emergency-treatment',
 jaw: 'https://surgeryreference.aofoundation.org/cmf/trauma/mandible/further-reading/biomechanics-of-the-mandible',
 tmj: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8584777/',
 hyoid: 'https://pubmed.ncbi.nlm.nih.gov/33409785/',
 neck: 'https://www.aast.org/static/f157c61e-569c-4aa7-a4479a62ace7888d/Blunt-Cerebrovascular-Injuries-0116.pdf',
 rib: 'https://pubmed.ncbi.nlm.nih.gov/7466610/',
 sternum: 'https://www.east.org/education-resources/practice-management-guidelines/details/blunt-cardiac-injury%2C-screening-for',
 spine: 'https://surgeryreference.aofoundation.org/spine/trauma/thoracolumbar/further-reading/rationale-for-fracture-classification-a0-a1-a2-a3-a4-b1-b2-b3-c',
 pelvis: 'https://www.east.org/education-resources/practice-management-guidelines/details/pelvic-fracture-hemorrhageupdate-and-systematic-review-update-in-process',
 sacrum: 'https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/pelvic-ring/further-reading/lumbo-sacral-nerve-root-injury'
};

const muscle = (pattern, label, action, detail, group = 'adjacent') => ({
 layer: 'muscles', pattern, label, action, detail, group, role: group === 'adjacent' || group === 'passive' ? group : 'deforming'
});
const risk = (layer, pattern, label, mechanism, sign, {severity = 'high', granularity = 'mesh'} = {}) =>
 ({layer, pattern, label, mechanism, sign, severity, granularity, role: 'risk'});
const vessel = (...args) => risk('vessels', ...args);
const nerve = (...args) => risk('nerves', ...args);
const group = {granularity: 'group'};
const parent = {granularity: 'parent'};
const refer = {granularity: 'reference'};
const cautious = {severity: 'medium'};
function profile(source, summary, muscles, risks, textOnly = []) {
 return {axial: true, source: sources[source], summary, deforming: muscles.filter(item => item.role === 'deforming'),
  adjacent: muscles.filter(item => item.role !== 'deforming'), risks, textOnly};
}

const eyeMovement = '观察复视、眼球活动受限和视力变化。';
const skullSigns = '结合神经状态及影像检查裂线和硬膜外血肿。';
const scalp = (pattern, label, site) => muscle(pattern, label, '局部附着参照', site);
const sagittal = vessel(/^Superior sagittal sinus$/i, '上矢状窦', '裂线或凹陷跨过颅盖中线时，评估窦壁与回流通道。', '关注跨中线的硬膜外血肿和静脉回流异常。');
const meningeal = vessel(/^Middle meningeal artery\.[lr]$/i, '脑膜中动脉', '颞鳞、翼点或外侧骨折靠近脑膜动脉沟时可损及分支。', skullSigns);
const temporal = scalp(/^Temporalis muscle\.[lr]$/i, '颞肌', '在颞窝附着并止于下颌冠突。');
const suboccipital = muscle(/Rectus posterior (?:major|minor) capitis|Obliquus superior capitis/i, '枕下肌群', '枕骨下部及寰椎后方附着参照', '颅颈交界裂线可牵涉枕下区。');
const ethmoidal = vessel(/^(?:Anterior|Posterior) ethmoidal artery\.[lr]$/i, '筛前、筛后动脉', '裂线延伸至眶内侧壁或筛顶时邻筛血管。', '观察鼻出血及眶内血肿迹象。');
const optic = nerve(/^Optic nerve \(II\)/i, '视神经', '眶尖或视神经管受累时关注视路。', '观察视力和传入性瞳孔反应。');
const v2 = nerve(/^Maxillary nerve\.[lr]$/i, '上颌神经（眶下神经的父干）', '骨折经过眶底或眶下管时，可累及眶下神经。', '观察下睑、鼻翼至上唇的感觉。', parent);
const alveolar = nerve(/^Inferior alveolar nerve\.[lr]$/i, '下牙槽神经', '下颌管受骨折线、骨段错位或局部血肿影响时可出现感觉异常。', '比较双侧下唇和颏部感觉。');
const jawClose = muscle(/^(?:Deep|Superficial) part of masseter|^Temporalis muscle|^Medial pterygoid muscle/i, '闭口肌群', '上提后方骨段或维持闭口张力', '咬肌、颞肌和翼内肌的作用取决于骨折线和附着位置。', 'proximal');
const latPterygoid = muscle(/^(?:Superior|Inferior) head of lateral pterygoid muscle/i, '翼外肌', '前内向牵引髁突骨段', '下头牵动髁突颈，上头参与关节盘与髁突协调。', 'proximal');
const suprahyoid = /(?:Belly of digastric|Stylohyoid|Mylohyoid|Geniohyoid|Hyoglossus) muscle/i;
const infrahyoid = /^(?:Omohyoid|Sternohyoid|Sternothyroid|Thyrohyoid) muscle/i;
const vertebral = vessel(/^Vertebral artery\.[lr]$/i, '椎动脉', '横突孔或寰椎后弓椎动脉沟受累时评估血管。', '结合颈部影像及后循环神经表现。');
const cord = nerve(/^(?:White matter|Anterior horn|Posterior horn) of spinal cord/i, '脊髓（白质及灰质参照）',
 '仅在椎管变窄、移位或合并不稳时提示脊髓受压风险。', '观察损伤平面以下的运动、感觉和反射。', refer);
const root = nerve(/^(?:Anterior|Posterior) root of spinal nerve|^Spinal ganglion/i, '脊神经根及神经节组',
 '椎间孔在伤侧或双侧变窄时，可能影响相应神经根。', '对照皮节感觉、肌节力量及反射。', group);
const cauda = nerve(/^Cauda equina$/i, '马尾', '椎管或骶管受侵时，评估腰骶根受压。', '观察会阴感觉、括约肌及膀胱直肠功能。', group);
const intercostalNerve = nerve(/^Intercostal nerves\.[lr]$/i, '肋间神经组', '肋沟及相邻肋间隙受局部骨折或血肿影响时可刺激神经。', '观察沿肋间分布的痛觉变化。', group);
const intercostals = muscle(/^(?:External|Internal|Innermost) intercostal muscles/i, '三层肋间肌', '呼吸时肋间肌参与胸廓活动',
 '肋间神经血管束位于肋间内肌与最内肌之间。');
const internalThoracic = vessel(/^Internal thoracic (?:artery|veins)/i, '胸廓内动静脉',
 '胸骨旁裂线、骨段后移或旁胸骨血肿时评估血管。', '观察胸骨后或前纵隔血肿。');
const sacralVeins = vessel(/^Lateral sacral veins\.[lr]$/i, '骶外侧静脉', '后环移位可影响骶前静脉回流并伴出血。', '结合血流动力学、盆腔血肿及影像评估。');

const cranial = {
 frontal: [scalp(/^Frontalis muscle/i, '枕额肌额腹', '额部头皮与帽状腱膜关系参照。'), sagittal],
 parietal: [temporal, sagittal, meningeal],
 occipital: [scalp(/^Occipitalis muscle/i, '枕额肌枕腹', '枕部头皮与帽状腱膜关系参照。'), suboccipital,
  vessel(/^(?:Transverse|Sigmoid) sinus/i, '横窦及乙状窦', '枕部裂线延伸至窦沟时，评估窦壁、通畅性及邻近血肿。', skullSigns)],
 temporal: [temporal, meningeal,
  nerve(/^(?:Facial nerve \(VII\)|Vestibulocochlear nerve \(VIII\))/i, '面神经及前庭蜗神经', '裂线延伸至颞骨岩部及相应骨管时才涉及该路径。', '观察面肌对称性、听力和前庭症状。')]
};

const face = {
 ethmoid: ['筛板裂线可涉及嗅路及前颅底。眶内侧壁有移位时检查眼外肌夹陷。',
  [muscle(/^Medial rectus muscle/i, '内直肌', '邻眶内侧壁', '骨片与内直肌接近时结合眼球活动判断夹陷。')],
  [ethmoidal, nerve(/^Olfactory nerve \(I\)/i, '嗅神经', '累及筛板可牵涉嗅丝及颅底硬膜。', '观察嗅觉变化或清水样鼻漏。'), optic]],
 sphenoid: ['按裂线是否延伸至大翼、眶尖、视神经管或海绵窦分别判断。',
  [muscle(/^Temporalis muscle|^Superior head of lateral pterygoid/i, '蝶骨邻近肌群', '大翼及翼突附着参照', '裂线位于眶尖时优先核对视路与眼球运动。')],
  [meningeal, optic, vessel(/^Cavernous sinus|^Internal carotid artery/i, '海绵窦与颈内动脉',
   '仅在颅底裂线延伸至海绵窦或颈动脉沟时关注。', '观察进行性突眼、复视及血管影像。'),
   nerve(/^(?:Oculomotor nerve \(III\)|Trochlear nerve \(IV\)|Ophthalmic nerve|Maxillary nerve|Abducens nerve \(VI\))/i,
    '海绵窦区脑神经', '裂线延伸至海绵窦区时核对眼运动神经和三叉神经眼支、上颌支。', eyeMovement)]],
 maxilla: ['上颌前壁以面肌附着邻近为主。若延伸至眶底，另核对眼外肌与眶下管。',
  [muscle(/^Inferior rectus muscle|^Levator (?:anguli oris|labii superioris)/i, '下直肌与上颌前壁面肌', '区分眶底与前壁', '眶底骨片可夹陷下直肌，前壁裂线邻提唇肌群。')],
  [vessel(/^Infra-orbital artery|^Posterior superior alveolar artery/i, '眶下动脉与上牙槽后动脉', '按眶下管或上颌后外侧壁受累部位观察。', '观察眶下血肿、鼻出血。'), v2]],
 palatine: ['腭部裂线靠近腭管或腭大孔时关注腭黏膜、出血与感觉。',
  [muscle(/^Palatopharyngeus muscle/i, '腭咽肌', '腭部后缘邻近参照', '参与吞咽期咽部抬高。')],
  [vessel(/^Greater palatine artery|^Descending palatine artery/i, '腭大动脉与腭降动脉', '腭管和腭大孔附近受累时评估腭侧血肿。', '观察硬腭黏膜出血。'),
   nerve(/^Maxillary nerve\.[lr]$/i, '上颌神经（腭神经上游参照）', '腭大神经独立网格缺失。腭大孔受累时结合症状检查其感觉支。', '观察同侧硬腭感觉。', parent)]],
 vomer: ['鼻中隔骨性移位可影响通气。后部出血重点关注蝶腭动脉鼻中隔支。',
  [scalp(/^Depressor septi nasi/i, '降鼻中隔肌', '软部鼻中隔肌性邻近参照。')],
  [vessel(/(?:branches of sphenopalatine artery|branches of posterior ethmoidal artery)/i, '鼻中隔后部血管支', '后鼻中隔裂线邻蝶腭及筛后血管分支。', '观察后鼻出血和鼻中隔血肿。')]],
 nasal: ['鼻骨以直接外力为主。检查鼻背轮廓、鼻腔通气及鼻中隔血肿。',
  [scalp(/^Nasalis muscle|^Procerus muscle/i, '鼻肌、降眉间肌', '鼻背与鼻根软组织的附着参照。')],
  [vessel(/^Angular artery|^Anterior septal branches of anterior ethmoidal artery/i, '内眦动脉及筛前动脉鼻中隔支', '鼻根与中隔软组织挫伤时可伴局部出血。', '观察内眦肿胀、鼻出血与中隔隆起。')]],
 zygoma: ['颧弓内移时检查与下颌冠突的间隙。若累及眶底，另查眼外肌和眶下管。',
  [muscle(/^Superficial part of masseter|^Temporalis muscle/i, '咬肌浅部与颞肌', '颧弓与下颌冠突邻近', '内陷的颧弓可阻挡冠突活动并限制张口。')],
  [vessel(/^Transverse facial artery|^Infra-orbital artery/i, '面横动脉与眶下动脉', '分别观察颧弓下方及可能延伸的眶下通道。', '关注面外侧血肿。'), v2]]
};

const ribOrdinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
function ribProfile(bone, variant) {
 const number = ribOrdinals.findIndex(word => new RegExp('\\b' + word + ' rib', 'i').test(bone)) + 1;
 const low = number >= 9;
 const contraction = variant === 'v03';
 const mechanisms = {
  v01: '直接暴力或局部内移时，观察断端是否接近胸膜和肋间血管神经束。',
  v02: '间接暴力或局部外弯时，主要观察胸壁端变形和肋沟关系，胸膜风险取决于实际断端方向。',
  v03: '肌肉强烈收缩分型保留骨段对位，主要观察肋间及邻近肌群的附着与呼吸相关牵拉。'
 };
 const activeIntercostals = contraction ? muscle(intercostals.pattern, '三层肋间肌', '收缩时向相邻肋骨传递张力',
  '此演示维持骨段对位，可对照肌肉附着与呼吸活动。', 'contraction') : intercostals;
 const muscles = [activeIntercostals, muscle(/^Levatores (?:breves|longi) costarum/i, '肋提肌', '后方提肋与稳定', '将相邻横突与肋骨后部相连。')];
 const risks = [vessel(number === 1 ? /^First posterior intercostal artery/i : number === 2 ? /^Second posterior intercostal artery/i :
  number === 12 ? /^Subcostal (?:artery|vein)|^(?:Left|Right) subcostal vein/i : /^Posterior intercostal arteries/i,
  number === 12 ? '肋下动静脉' : '肋间后动脉', contraction ? '显示肋沟通道作为伤前邻近关系。' :
   '移位骨端邻近肋沟时，评估出血与胸壁或胸腔积血。', '结合胸痛、呼吸活动与影像。', number >= 3 && number < 12 ? group : cautious),
  contraction ? {...intercostalNerve, severity: 'medium', mechanism: '显示肋沟内伴行神经及肌性牵拉邻近区。'} : intercostalNerve];
 const notes = [contraction ? '胸膜以位置文字示意，当前演示保留对位。' : '胸膜和肺以文字提示，内移时关注气胸或血胸。'];
 if (number === 1) {
  muscles.push(muscle(/^Scalenus (?:anterior|medius) muscle/i, '前、中斜角肌', '附着于第一肋上面', '前、中斜角肌之间是臂丛与锁骨下动脉通道。'));
  risks.push(vessel(/^(?:Left|Right) subclavian (?:artery|vein)$/i, '锁骨下动静脉', '第一肋显著移位时，重点检查血管沟邻近段。', '观察上肢脉搏差异、缺血或进行性血肿。'),
   nerve(/^(?:Roots|(?:Inferior|Middle|Superior) trunk) of brachial plexus/i, '臂丛根组及神经干',
    '第一肋上面邻臂丛，尤其关注下干与斜角肌间隙的关系。', '观察上肢多神经分布的肌力和感觉。', group));
 } else if (number <= 3) {
  muscles.push(muscle(/^Serratus anterior|^Scalenus posterior muscle/i, '前锯肌与后斜角肌', '上位肋肌性邻近', '第二肋邻后斜角肌止点。'));
 }
 if (low) {
  muscles.push(muscle(/^Diaphragm$|^(?:External|Internal) abdominal oblique muscle/i, '膈及腹壁斜肌', '下位肋附着参照', '附着处随呼吸和腹压变化。'));
  notes.push(/left/i.test(bone) ? '左下位肋损伤留意脾与左肾邻近区。' : '右下位肋损伤留意肝与右肾邻近区。');
 }
 return profile('rib', (number ? '第' + number + '肋。' : '') + (mechanisms[variant] || mechanisms.v01), muscles, risks, notes);
}

function spineProfile(level, variant) {
 const cervical = level.startsWith('C'), lumbar = level.startsWith('L'), number = Number(level.slice(1));
 const junction = /^(?:T11|T12|L1|L2)$/.test(level);
 const upper = /^(?:C1|C2)$/.test(level);
 const lateral = variant === 'v02';
 let summary = lateral ? '侧方楔压或侧屈时，两侧椎旁肌的长度变化不对称，按侧评估椎间孔。'
  : '前缘楔压或屈曲时观察前柱和后方张力带。若出现后壁累及或椎管异常，另行检查神经结构。';
 let muscles = [muscle(cervical ? /^Longus colli muscle|^Multifidus colli muscle/i : lumbar
  ? /^Multifidus lumborum muscle|^Quadratus lumborum muscle|^Psoas major muscle/i : /^Multifidus thoracis muscle|^Longissimus thoracis muscle/i,
 '节段椎旁肌', lateral ? '侧屈时对侧组织被动受牵' : '屈曲时后方组织被动受牵',
 '观察对应节段附着位置与伤侧关系。', 'passive')];
 const risks = [root];
 const notes = [];
 if (!lumbar || junction) risks.push(cord);
 if (lumbar || junction) risks.push(cauda);
 if (cervical) {
  risks.push(vertebral, vessel(/^Vertebral vein\.[lr]$/i, '椎静脉', '横突孔或椎旁软组织血肿时关注静脉邻近。', '结合血肿范围与相邻结构影像。', cautious));
  if (upper) {
   summary = level === 'C1'
    ? lateral ? '寰椎后弓裂线邻椎动脉沟与枕下肌。评估寰枕与寰枢对位。' : '寰椎前弓裂线邻颈长肌上段。关注颅颈稳定性和齿突间隙。'
    : lateral ? '齿突基底裂线需关注寰枢稳定性、齿突移位与椎管余量。' : '齿突尖端裂线邻翼状韧带附着，结合其他影像征象判断颅颈稳定性。';
   muscles = lateral && number === 1 ? [suboccipital] : [muscle(/^Longus colli muscle|^Rectus anterior capitis muscle/i,
    '颈长肌与头前直肌', '寰椎前弓及上颈前方肌性参照', '齿突邻区的主要稳定性需结合韧带与关节对位判断。')];
   risks.push(nerve(/^Medulla oblongata\.[lr]$/i, '延髓参照', '严重高颈移位或不稳时关注颅颈交界。', '观察呼吸功能和高位神经体征。', refer));
  } else {
   muscles.push(muscle(/^Scalenus (?:anterior|medius) muscle/i, '前、中斜角肌', '颈椎横突与第一肋附着参照', '按伤侧观察颈外侧软组织。'));
  }
  notes.push('图谱仅显示在库结构。高颈损伤可影响呼吸，膈神经以文字提示。');
 } else {
  risks.push(vessel(lumbar ? /^Lumbar (?:arteries|veins)/i : /^Posterior intercostal arteries|^Anterior spinal artery/i,
   lumbar ? '腰节段动静脉组' : '胸段节段动脉及脊髓前动脉参照',
   '按骨折部位及周围软组织血肿范围核对节段供血和回流。', '结合影像、神经检查和血肿位置。', group));
  if (junction) notes.push('胸腰交界需区分脊髓圆锥邻域与马尾。模型未单独分割圆锥。');
 }
 return profile(cervical ? 'neck' : 'spine', level + '。' + summary, muscles, risks, notes);
}

function pelvisProfile(id, variant) {
 if (id === 'region-sacrum') return profile('sacrum',
  '骶骨翼骨折先看骶孔、骶管与骶髂关节的关系。骶尾处同时可观察盆底附着。',
  [muscle(/^Piriformis muscle|^Multifidus lumborum muscle|^Gluteus maximus muscle|^Coccygeus muscle/i,
   '梨状肌、多裂肌、臀大肌与尾骨肌', '骶骨背侧、前面及骶尾附着参照', '骨折线延伸时按局部附着分辨所累及肌群。')],
  [sacralVeins, vessel(/^Median sacral artery$|^Iliolumbar artery/i, '骶正中与髂腰动脉', '分别观察骶前与骶翼邻近供血。', '检查骶前血肿及盆腔出血。'),
   root, cauda], ['独立腰骶干和逐条 S2–S4 根缺失。骶翼邻腰骶干，延伸到骶孔或骶管时另核对神经功能。']);
 const wing = id === 'region-iliac-wing';
 const motion = {
  v01: '侧方压缩型向内旋转，观察前环重叠与后环受累。',
  v02: '前后压缩型向外旋张开，观察耻骨联合、骶髂关节及前环血管。',
  v03: '垂直压缩型演示半骨盆上移，关注后环移位及腰骶组织被动牵张。'
 };
 const front = vessel(/^Obturator (?:artery|vein)|^Inferior epigastric (?:artery|vein)/i, '闭孔与腹壁下血管',
  '前环损伤关注耻骨上支附近血管及吻合支变异。', '观察前盆腔血肿及血流动力学变化。');
 const back = vessel(/^Superior gluteal (?:artery|vein)|^Internal iliac (?:artery|vein)/i, '臀上与髂内动静脉',
  '后环或骶髂关节移位时留意相邻血管。', '关注后盆腔、臀部血肿。');
 return profile('pelvis', (wing ? '髂翼上部骨折涉及髂嵴内外侧肌肉及血管床。' : motion[variant] || motion.v01) +
  '骨盆出血也可来自静脉和松质骨面。',
  [muscle(wing ? /^Iliacus muscle|^Gluteus (?:medius|minimus) muscle|^(?:External|Internal) abdominal oblique muscle/i :
   /^Iliacus muscle|^Psoas major muscle|^Gluteus (?:medius|maximus) muscle|^Adductor (?:longus|magnus)|^Pubococcygeus muscle/i,
   wing ? '髂肌、臀中小肌及腹斜肌' : '髂腰肌、臀肌、内收肌与盆底',
   wing ? '区分髂翼内面、外面及髂嵴' : '随前后环相对位移改变张力',
   wing ? '髂肌邻髂窝，臀肌在外面，腹壁肌附于髂嵴。' : '模式由外力及骨盆环结构决定，肌群可出现继发受牵。', wing ? 'adjacent' : 'passive')],
  wing ? [vessel(/^Iliolumbar (?:artery|vein)|^Iliacus branch of iliolumbar artery/i, '髂腰血管及髂支',
   '髂翼内面骨折和血肿可邻髂腰血管分支。', '结合髂窝血肿范围。'),
  nerve(/^Iliohypogastric nerve/i, '髂腹下神经', '髂嵴附近腹壁损伤可能波及该神经走行。', '观察耻骨上和臀外侧皮肤感觉。', cautious)]
  : [...(variant === 'v03' ? [back, sacralVeins, front] : [front, back, sacralVeins]),
   nerve(/^Obturator nerve|^Pudendal nerve/i, '闭孔神经与阴部神经', '分别检查前环闭孔区及后下方盆底神经关系。', '按受累范围检查内收肌、会阴感觉及括约肌功能。'), cauda],
  wing ? [] : ['腰骶丛完整网格缺失，示图使用已入库的属支与根组。']);
}

export function axialProfile(course, variant, bone) {
 const id = course?.id || '';
 const name = bone || course?.sourceBone || '';
 const family = id.replace(/^region-/, '');
 const key = variant || 'v01';
 if (/\brib\b/i.test(name) || /^(?:region-)?rib(?:-|$)/.test(id)) return ribProfile(name, key);
 if (id === 'pelvis' || id === 'region-iliac-wing' || /sacrum|coccyx/i.test(name) || family === 'sacrum') return pelvisProfile(family === 'sacrum' || /sacrum|coccyx/i.test(name) ? 'region-sacrum' : id, key);
 if (/vertebra|^atlas$|^axis$/i.test(name) || /^(region-(?:atlas|axis|body-)|spine)/.test(id)) {
  const number = ribOrdinals.findIndex(word => name.toLowerCase().startsWith(word + ' ')) + 1;
  const level = family === 'atlas' || name === 'Atlas' ? 'C1' : family === 'axis' || name === 'Axis' ? 'C2'
   : (id.match(/(?:body-|-)([ctl]\d+)$/i)?.[1]?.toUpperCase() ||
      ((name.match(/(cervical|thoracic|lumbar)/i)?.[1]?.[0]?.toUpperCase() || 'L') + (number || 1)));
  return spineProfile(level, key);
 }
 const site = family || (/zygomatic/i.test(name) ? 'zygoma' : name.toLowerCase().match(/frontal|parietal|occipital|temporal|ethmoid|sphenoid|maxilla|palatine|vomer|nasal|mandible|hyoid|manubrium|xiphoid/)?.[0]) ||
  (/sternum/i.test(name) ? 'sternal-body' : '');
 if (cranial[site]) {
  const items = cranial[site];
  const depressed = key === 'v02';
  return profile('skull', depressed ? '局限性凹陷由外力主导。观察内板凹陷与硬膜及邻近血管的关系。' :
   '局部线形骨折由外力主导。血管和神经风险取决于裂线走向及是否延伸到骨沟、静脉窦或颅底。',
   items.filter(item => item.layer === 'muscles'), items.filter(item => item.layer !== 'muscles'));
 }
 if (face[site]) {
  const [summary, muscles, risks] = face[site];
  return profile('orbit', (site === 'nasal' && key === 'v02' ? '移位时加查鼻背阶差及通气受限。' : '') + summary, muscles, risks);
 }
 if (id === 'tmj-dislocation') return profile('tmj',
  '双侧前脱位时，两侧髁头越过关节结节并锁在前方。关注持续张口、咬合异常、耳前疼痛和闭口肌痉挛。',
  [muscle(/^Masseter|part of masseter|^Temporalis muscle|^Medial pterygoid muscle/i, '双侧闭口肌群', '脱位后痉挛可妨碍闭口',
   '分别观察两侧髁头与关节结节。', 'joint'),
   muscle(suprahyoid, '舌骨上肌', '张口运动邻近参照', '舌骨稳定时协助下颌下降。')],
  [], ['耳颞神经以文字提示。单纯前脱位的主要教学征象是开口锁定与耳前不适。']);
 if (site === 'mandible') {
  const condyle = key === 'v02';
  return profile('jaw', condyle ? '右侧髁突颈骨折重在翼外肌的前内牵引及髁突与关节窝对位。' :
   '下颌体部骨折时按裂线两侧的咀嚼肌与舌骨上肌附着，分析近段上提及远段下牵。',
   condyle ? [latPterygoid] : [jawClose, muscle(suprahyoid, '舌骨上肌', '前方骨段下后向牵引',
    '二腹肌前腹、下颌舌骨肌及颏舌骨肌的影响取决于骨折部位。', 'distal')],
   condyle ? [vessel(/^Maxillary artery\.[lr]$/i, '上颌动脉', '髁突颈内侧邻上颌动脉，严重错位时评估邻近血管。', '关注耳前及深部迅速增大的血肿。', cautious)]
    : [alveolar, vessel(/^Inferior alveolar artery|^Mental branch of inferior alveolar artery/i, '下牙槽动脉及颏支',
     '下颌管或颏孔附近裂线可影响血管。', '观察局部出血及黏膜血肿。')],
   condyle ? ['感觉异常需结合耳颞神经分布检查。该神经无独立网格。'] : []);
 }
 if (site === 'hyoid') return profile('hyoid',
  '右侧大角骨折可出现吞咽痛、局部血肿及喉咽邻近风险。对照舌骨上下肌随吞咽相向牵引的关系。',
  [muscle(suprahyoid, '舌骨上肌与舌骨舌肌', '上提、前后牵引舌骨并连接舌与下颌', '右大角邻咽中缩肌与舌骨舌肌附着。'),
   muscle(infrahyoid, '舌骨下肌', '下牵与稳定舌骨', '关注大角损伤周围吞咽运动。')],
  [vessel(/^External carotid artery|^Lingual vein/i, '颈外动脉与舌静脉', '右侧移位或咽旁血肿时评估颈部血管。', '观察颈部肿胀、吞咽痛及声音变化。', cautious),
   nerve(/^Hypoglossal nerve \(XII\)|^Vagus nerve \(X\)/i, '舌下神经与迷走神经参照',
    '按损伤范围关注舌运动和喉咽相关神经功能。', '观察伸舌、发音、吞咽及呼吸。', cautious)],
  ['喉咽软组织水肿与气道占位以文字提示。']);
 if (/^(manubrium|sternal-body|xiphoid)$/.test(site)) {
  const handle = site === 'manubrium', tip = site === 'xiphoid';
  return profile('sternum', handle ? (key === 'v02' ? '斜形骨折同时观察胸锁邻接及骨段前后错位。' :
   '横形骨折重点检查胸骨柄两段前后移位。') : tip ? '剑突骨折重点观察膈、腹壁与胸骨下缘的邻接。' :
   '胸骨体骨折处胸肌和胸横肌分别在前方及后方，向后错位时关注纵隔邻近。',
   [muscle(handle ? /Sternocleidomastoid|Pectoralis major|^Sternohyoid muscle|^Sternothyroid muscle/i : tip
    ? /^Rectus abdominis muscle|^Diaphragm$/i : /Pectoralis major|^Transversus thoracis muscle/i,
    handle ? '胸锁乳突肌、胸大肌与舌骨下肌' : tip ? '腹直肌与膈' : '胸大肌与胸横肌',
    '胸骨肌性附着参照', '局部外力产生裂线，肌群影响胸壁运动。')],
   [internalThoracic], ['明显后移可涉及纵隔。心脏挫伤需要独立的临床评估。']);
 }
 return null;
}
