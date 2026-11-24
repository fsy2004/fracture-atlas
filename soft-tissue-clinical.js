// Clinical soft-tissue biomechanics and neurovascular risk definitions for limb fractures & dislocations.
// Grounded in 《中医骨伤科学》（全国中医药行业高等教育“十四五”规划教材）Ch. 5, 6, 7.

const m = (pattern, group, label, action, detail) => ({ pattern, layer: 'muscles', role: 'deforming', group, label, action, detail });
const v = (pattern, severity, label, mechanism, sign) => ({ pattern, layer: 'vessels', role: 'risk', severity, label, mechanism, sign });
const n = (pattern, severity, label, mechanism, sign) => ({ pattern, layer: 'nerves', role: 'risk', severity, label, mechanism, sign });
const mr = (pattern, severity, label, mechanism, sign) => ({ pattern, layer: 'muscles', role: 'risk', severity, label, mechanism, sign });

// Course-level clinical profiles keyed by family / course.id
// Each entry can be a function(variantIndex, levelIndex) or static object
const CLINICAL_PROFILES = {
 clavicle: (vi) => ({
  summary: vi === 1
   ? '锁骨中1/3骨折受胸锁乳突肌向上后牵拉内侧段、上肢重力及三角肌向下前牵拉外侧段；严重移位时危及后下方锁骨下血管与臂丛神经。'
   : '锁骨内/外1/3骨折毗邻胸锁/肩锁关节及喙锁韧带，移位明显时需排查锁骨下血管与臂丛神经受压。',
  deforming: [
   m(/Sternocleidomastoid/i, 'proximal', '胸锁乳突肌', '牵拉内侧段向后上方', '起于胸骨柄与锁骨内侧端，收缩时将内侧折段向上后提起。'),
   m(/deltoid/i, 'distal', '三角肌（锁骨部）', '协同上肢重力牵拉外侧段向前下方', '附着于锁骨外侧段，联合上肢重力使外侧折段下垂前移。'),
   m(/pectoralis major/i, 'distal', '胸大肌（锁骨部）', '牵拉外侧段向内下重叠', '协助将肩胛带和外侧折段向内前方拉近，加重重叠短缩。'),
   m(/trapezius/i, 'distal', '斜方肌（上部）', '对抗肩部下垂', '附着锁骨外1/3，外侧骨折时参与稳定或轻度上提。')
  ],
  risks: [
   v(/subclavian artery/i, 'high', '锁骨下动脉', '锁骨中下段锐利断端向后下方移位可刺伤或压迫', '桡动脉搏动减弱/消失、上肢苍白发凉或锁骨上窝搏动性血肿。'),
   v(/subclavian vein/i, 'medium', '锁骨下静脉', '紧贴锁骨后内方，移位断端可撕裂或压迫', '上肢明显肿胀发绀、局部大血肿。'),
   n(/brachial plexus/i, 'high', '臂丛神经', '锁骨后方断端挤压或肩部过度牵拉', '患侧上肢多神经分布区麻木、肌力减退或瘫痪。')
  ]
 }),

 shoulder: (vi) => ({
  summary: vi === 4
   ? '肱骨外科颈骨折合并肩关节前脱位时，肱骨头移向前下方，紧邻的腋神经、腋动静脉及旋肱后血管极易受牵拉或压迫。'
   : '肱骨外科颈邻近肩袖肌群与胸大肌、三角肌附着处，内收/外展型移位方向迥异；紧靠内侧的腋神经与腋血管为高危结构。',
  deforming: [
   m(/Supraspinatus|Infraspinatus|Teres minor/i, 'proximal', '肩袖肌群（冈上/冈下/小圆肌）', '牵拉肱骨大结节与近段外展外旋', '附着于肱骨大结节，断端游离时拉近段外展外旋。'),
   m(/Subscapularis/i, 'proximal', '肩胛下肌', '牵拉小结节使近段内旋', '附着于肱骨小结节，维持肩前稳定性。'),
   m(/pectoralis major/i, 'distal', '胸大肌', '牵拉肱骨远段向内前方移位', '止于大结节嵴，常将远段向前内侧拉近。'),
   m(/deltoid/i, 'distal', '三角肌', '向上外牵拉远段', '跨肩关节止于三角肌粗隆，参与轴向嵌插或外展成角。')
  ],
  risks: [
   n(/Axillary nerve/i, 'high', '腋神经', '紧绕肱骨外科颈后外侧进入三角肌，断端移位或脱位极易牵拉挫伤', '三角肌瘫痪（肩外展无力、方肩加重）及三角肌表面皮肤感觉减退。'),
   v(/Axillary artery|Axillary vein/i, 'high', '腋动、静脉', '经肩关节前内方腋窝通过，严重移位或合并脱位时受压刺伤', '桡动脉搏动减弱消失、腋窝迅速增大血肿、手部苍白发凉。'),
   v(/circumflex humeral/i, 'medium', '旋肱前、后动脉', '绕外科颈营养肱骨头，骨折移位可影响近端血供', '严重移位或合并脱位增加肱骨头缺血性坏死风险。'),
   n(/brachial plexus/i, 'medium', '臂丛神经（后束等）', '经腋窝内侧下行，脱位肱骨头可压迫', '上肢远端多处感觉运动异常。')
  ]
 }),

 humerus: (vi) => {
  if (vi === 0) {
   return {
    summary: '肱骨干上1/3骨折（三角肌止点以上）：近段受胸大肌、背阔肌、大圆肌牵拉向前内移位；远段受三角肌、喙肱肌、肱二/三头肌牵拉向外上移位。',
    deforming: [
     m(/pectoralis major/i, 'proximal', '胸大肌', '牵拉近段向前内侧移位', '止于大结节嵴，强力拉近段向前内侧成角。'),
     m(/Latissimus dorsi|Teres major/i, 'proximal', '背阔肌与大圆肌', '协同拉近段向内侧及内旋', '止于小结节嵴及结节间沟底，与胸大肌共同内收近段。'),
     m(/deltoid/i, 'distal', '三角肌', '牵拉远段向外上方移位', '止点位于骨折线下方，拉远段向外上错开重叠。'),
     m(/biceps brachii|triceps brachii|Coracobrachialis/i, 'distal', '肱二/三头肌与喙肱肌', '纵向牵拉远段向上短缩', '跨越骨折线产生轴向短缩重叠移位。')
    ],
    risks: [
     n(/Radial nerve/i, 'medium', '桡神经', '经肱骨后方进入桡神经沟，移位显著时受牵拉', '腕背伸及伸指肌力减弱、虎口区麻木。'),
     v(/Brachial artery|Deep brachial artery/i, 'medium', '肱动脉与肱深动脉', '沿肱骨内后侧下行，断端尖锐时需警惕刺伤', '远端桡动脉搏动减弱、上臂进行性肿胀。')
    ]
   };
  }
  if (vi === 1) {
   return {
    summary: '肱骨干中1/3骨折（三角肌止点以下）：近段受三角肌、喙肱肌牵拉向外前移位；远段受肱二/三头肌牵拉向上重叠；中下1/3交界处紧贴桡神经沟，最易伤桡神经！',
    deforming: [
     m(/deltoid/i, 'proximal', '三角肌', '牵拉近段向外、向前移位', '止点在骨折线以上，直接把近段拉向外前方。'),
     m(/Coracobrachialis/i, 'proximal', '喙肱肌', '协同拉近段向前方成角', '附着于肱骨内侧中点，配合三角肌前屈近段。'),
     m(/biceps brachii|triceps brachii/i, 'distal', '肱二头肌与肱三头肌', '牵拉远段向上重叠短缩', '跨越骨折段产生强力纵向短缩。')
    ],
    risks: [
     n(/^Radial nerve|Muscular branches of radial/i, 'high', '桡神经（桡神经沟）', '紧贴肱骨中下1/3后外侧桡神经沟骨面，最易被断端挫伤、卡压或割裂', '典型“垂腕”畸形、掌指关节不能伸直、虎口区皮肤感觉减退或消失。'),
     v(/Deep brachial artery/i, 'medium', '肱深动脉', '与桡神经伴行经桡神经沟，骨折时常伴随出血', '上臂后外侧明显血肿。'),
     v(/Brachial artery/i, 'medium', '肱动脉', '行于肱骨干内侧，严重内侧移位可受压', '核查桡动脉搏动及末梢毛细血管充盈。')
    ]
   };
  }
  return {
   summary: '肱骨干下1/3骨折常由扭转暴力形成斜形/螺旋骨折，毗邻桡神经出桡神经沟穿外侧肌间隔处，极易并发桡神经损伤。',
   deforming: [
    m(/Brachialis|Brachioradialis/i, 'distal', '肱肌与肱桡肌', '受肘部姿势影响牵拉远段成角与旋转', '跨下1/3附着于远段与前臂，影响成角及内旋。'),
    m(/triceps brachii/i, 'distal', '肱三头肌', '后方纵向牵拉产生短缩', '跨越骨折段并紧贴后侧皮质。')
   ],
   risks: [
    n(/^Radial nerve/i, 'high', '桡神经', '于肱骨中下1/3交界穿外侧肌间隔，活动度小最易被螺旋尖端刺伤或卡夹', '垂腕畸形、伸拇伸指障碍、虎口区麻木；夹板固定垫禁压桡神经沟。'),
    v(/Brachial artery/i, 'medium', '肱动脉', '向下移向肘窝前方，远段移位时需核对远端血运', '桡动脉搏动减弱或消失。')
   ]
  };
 },

 elbow: (vi) => ({
  summary: vi === 0
   ? '肱骨髁上伸直型骨折：远段向后移位，近段前下尖端极易刺破肱前肌（肱肌），压迫或刺伤紧贴前方的肱动脉与正中神经，可诱发前臂缺血性肌挛缩！'
   : vi === 1
    ? '肱骨髁上屈曲型骨折：远段向前移位，相对较少直接刺伤前方大血管，但仍需检查尺神经、正中神经及肘窝血运。'
    : '肱骨髁上粉碎/髁间骨折累及关节面，软组织肿胀重，需警惕肱动脉受压及尺、正中、桡神经损伤。',
  deforming: [
   m(/triceps brachii/i, 'distal', '肱三头肌', '牵拉尺骨鹰嘴与远侧髁块向后上方移位', '伸直型骨折时加重远段向后移位及重叠。'),
   m(/Brachialis/i, 'proximal', '肱肌（肱前肌）', '常被骨折近端前缘刺破并发生出血肿胀', '覆盖肱骨下端前面，成为近端与血管神经间的最后屏障。'),
   m(/Brachioradialis|pronator teres|Flexor carpi/i, 'distal', '前臂屈伸肌起点', '随尺偏/桡偏及旋转移位牵拉远侧髁块', '内侧屈肌群与外侧伸肌群失衡可加重肘内/外翻成角。')
  ],
  risks: [
   v(/Brachial artery/i, vi === 0 ? 'high' : 'medium', '肱动脉', '经肱二头肌腱膜下紧贴肘前，伸直型近端尖端极易压迫、痉挛或刺伤', '“5P”征：肘部剧痛肿胀、桡动脉搏动消失、手苍白发凉、被动伸指剧痛→未及时解除致 Volkmann 缺血性肌挛缩！'),
   n(/^Median nerve|Anterior interosseous nerve/i, vi === 0 ? 'high' : 'medium', '正中神经与骨间前神经', '与肱动脉伴行肘窝，近端向尺侧/前方移位时易挫伤或受压', '拇示指末节屈曲无力（OK 征异常）、大鱼际萎缩及桡侧三指半感觉障碍。'),
   n(/^Radial nerve|Deep branch of radial/i, 'medium', '桡神经', '经肘窝前外侧下行，远段向尺后移位时受牵拉', '伸腕伸指无力、虎口区感觉减退。'),
   n(/^Ulnar nerve/i, 'medium', '尺神经', '经内上髁后方尺神经沟，屈曲型或迟发性肘内外翻易受累', '环小指麻木、爪形手。'),
   mr(/Flexor digitorum profundus|Flexor pollicis longus/i, vi === 0 ? 'high' : 'medium', '前臂屈肌群（缺血挛缩高危）', '肱动脉受压或前臂骨筋膜室高压导致肌群缺血坏死纤维化', '被动伸指剧痛为早期关键警报，晚期呈爪形屈曲挛缩。')
  ]
 }),

 'lateral-elbow': () => ({
  summary: '前臂伸肌总腱附着于肱骨外髁，骨折后伸肌群强烈牵拉可使外髁骨块明显旋转翻转；晚期畸形愈合肘外翻易致迟发性尺神经麻痹。',
  deforming: [
   m(/Extensor carpi radialis|Extensor digitorum|Extensor digiti minimi|extensor carpi ulnaris/i, 'distal', '前臂伸肌群（总腱）', '牵拉外髁骨块向外下旋转翻转（可达90°～180°）', '腕背伸可松弛该肌群以利手法复位。'),
   m(/Brachioradialis/i, 'distal', '肱桡肌', '附着外上髁嵴，协助向外牵引外髁', '复位时需屈肘旋后松弛外侧肌张力。')
  ],
  risks: [
   n(/^Ulnar nerve/i, 'high', '尺神经（迟发性牵拉麻痹）', '外髁骨不连或生长不均致进行性肘外翻，长期过度牵拉内侧尺神经', '晚期出现环小指麻木、骨间肌萎缩及爪形手，常需尺神经前置术。'),
   n(/Deep branch of radial|Radial nerve/i, 'medium', '桡神经深支', '邻近肘外侧肱桡关节前外方', '外髁翻转肿胀重时检查伸指功能。')
  ]
 }),

 'medial-elbow': (vi) => ({
  summary: '前臂屈肌总腱与旋前圆肌附着于肱骨内上髁，肘外翻暴力下急骤收缩致撕脱；紧贴其后方尺神经沟的尺神经在Ⅲ、Ⅳ度骨折中极易卡压或损伤！',
  deforming: [
   m(/pronator teres|Flexor carpi radialis|Palmaris longus|flexor carpi ulnaris|flexor digitorum superficialis/i, 'distal', '前臂屈肌群与旋前圆肌', '强烈收缩撕脱内上髁并向下前方旋转拉入关节间隙', 'Ⅲ度复位时常利用背伸腕指紧张屈肌群将嵌入骨块拉出。')
  ],
  risks: [
   n(/^Ulnar nerve/i, vi >= 2 ? 'high' : 'medium', '尺神经（尺神经沟）', '紧贴内上髁后方走行，Ⅲ/Ⅳ度骨块嵌入或晚期骨痂粗糙极易挫伤或卡压', '环指尺侧及小指感觉麻木、手内在肌无力、爪形手畸形。')
  ]
 }),

 olecranon: (vi) => ({
  summary: vi === 0
   ? '尺骨鹰嘴间接暴力撕脱骨折：肘骤然屈曲时肱三头肌强烈收缩，将近侧鹰嘴骨块向上大幅牵移，断口明显分离。'
   : '直接撞击多致粉碎性骨折，若两侧三头肌腱膜完整则分离较小，需保护紧邻肘内侧的尺神经。',
  deforming: [
   m(/triceps brachii/i, 'proximal', '肱三头肌', '强力收缩向上牵拉鹰嘴近侧骨块', '止于尺骨鹰嘴，主动伸肘对抗时可把断端拉大分离。')
  ],
  risks: [
   n(/^Ulnar nerve/i, 'medium', '尺神经', '经鹰嘴内侧与内上髁间的尺神经沟下行', '严重肿胀或碎骨片向内移位时可能受压。')
  ]
 }),

 'radial-head': () => ({
  summary: '桡骨头颈部紧邻绕颈穿入旋后肌的桡神经深支（骨间后神经），骨折移位明显或手术显露时极易受损。',
  deforming: [
   m(/biceps brachii/i, 'distal', '肱二头肌', '止于桡骨粗隆，牵拉桡骨近段向前旋后', '桡骨颈骨折时易致远段向前内成角。'),
   m(/Supinator/i, 'distal', '旋后肌', '包绕桡骨近段，内含桡神经深支', '骨折出血肿胀可压迫穿行其间的神经。')
  ],
  risks: [
   n(/Deep branch of radial|Posterior interosseous nerve/i, 'high', '桡神经深支 / 骨间后神经', '紧绕桡骨颈外侧穿入旋后肌，粉碎移位或内固定操作易挫伤', '伸拇及掌指关节伸指障碍（“垂指”），但腕背伸常部分保留。')
  ]
 }),

 monteggia: () => ({
  summary: '尺骨上1/3骨折合并桡骨头脱位（孟氏骨折）：脱出的桡骨头极易压迫或挫伤紧绕其颈部的桡神经深支（骨间后神经）！',
  deforming: [
   m(/biceps brachii/i, 'distal', '肱二头肌', '向上前方牵拉脱位的桡骨头', '伸直型脱位中促使桡骨头向前外上方移位。'),
   m(/Supinator|Brachioradialis/i, 'distal', '旋后肌与肱桡肌', '附着桡骨近段与远段，影响桡骨头复位稳定', '前臂旋转位直接改变脱位张力。')
  ],
  risks: [
   n(/Deep branch of radial|Posterior interosseous nerve|Radial nerve/i, 'high', '桡神经深支（骨间后神经）', '紧绕桡骨颈，桡骨头向前外侧脱出时最易发生牵拉或压迫挫伤', '伸拇、伸指无力（垂指），常随桡骨头早期复位在3个月内自行恢复。')
  ]
 }),

 forearm: () => ({
  summary: '尺桡骨干双骨折受屈伸肌群、旋前/旋后肌群及骨间膜多向牵拉，移位复杂；前臂骨筋膜室容积小，肿胀易诱发骨筋膜室综合征！',
  deforming: [
   m(/Supinator|biceps brachii/i, 'proximal', '旋后肌与肱二头肌', '牵拉桡骨近段旋后并向前屈曲', '上1/3骨折时近段旋后明显，整复需置于旋后位。'),
   m(/pronator teres|Pronator quadratus/i, 'distal', '旋前圆肌与旋前方肌', '牵拉远段旋前并使尺桡骨靠拢', '导致旋转、成角与骨间隙变窄，易交叉愈合。'),
   m(/Flexor digitorum|Extensor digitorum/i, 'distal', '前臂屈伸肌群', '纵向牵拉致重叠短缩', '严重肿胀时筋膜室内压骤增。')
  ],
  risks: [
   v(/Radial artery|Ulnar artery|Common interosseous artery/i, 'medium', '桡动脉、尺动脉与骨间动脉', '紧贴前臂双骨下行，直接暴力或锐利断端可伤及', '核对桡尺动脉搏动及末梢循环。'),
   n(/^Median nerve|Ulnar nerve|Deep branch of radial|Anterior interosseous/i, 'medium', '正中、尺、桡神经分支', '穿行于前臂肌间隙，直接暴力开放伤或严重错位易损', '检查手指感觉及对掌、分指、伸指肌力。'),
   mr(/Flexor digitorum profundus|Flexor pollicis longus/i, 'high', '前臂屈肌群（骨筋膜室综合征高危）', '厚韧前臂筋膜包裹，血肿水肿致筋膜室内压升高', '进行性剧痛、被动伸指剧痛、前臂张力极高，须防缺血性肌挛缩。')
  ]
 }),

 'single-forearm': (vi) => ({
  summary: vi === 0
   ? '桡骨干上1/3骨折（旋前圆肌止点以上）：近段受肱二头肌、旋后肌牵拉强烈旋后；远段受旋前圆肌、旋前方肌牵拉强烈旋前！'
   : vi === 1
    ? '桡骨干中1/3骨折（旋前圆肌止点以下）：近段旋后肌与旋前圆肌力量抵消呈中立位；远段受旋前方肌牵拉旋前并向尺侧靠拢。'
    : '尺骨干单骨折：完整桡骨维持长度，但骨间膜与旋前方肌使尺骨断端偏向桡侧。',
  deforming: vi === 0 ? [
   m(/biceps brachii|Supinator/i, 'proximal', '肱二头肌与旋后肌', '牵拉桡骨近段向后旋转（旋后位）', '均止于骨折线近侧，整复固定须将远段旋后对齐近段。'),
   m(/pronator teres|Pronator quadratus/i, 'distal', '旋前圆肌与旋前方肌', '牵拉桡骨远段向前旋转（旋前位）并靠拢尺骨', '止于骨折线远侧，造成显著旋转错位。')
  ] : vi === 1 ? [
   m(/biceps brachii|Supinator|pronator teres/i, 'proximal', '肱二头肌/旋后肌 vs 旋前圆肌', '近段旋前与旋后肌力相互抵消，保持中立位', '骨折线在旋前圆肌止点以下，故固定取前臂中立位。'),
   m(/Pronator quadratus/i, 'distal', '旋前方肌', '牵拉桡骨远段旋前并向尺侧靠拢', '易致尺桡骨间膜挛缩影响前臂旋转。')
  ] : [
   m(/Pronator quadratus|flexor carpi ulnaris/i, 'distal', '旋前方肌与尺侧肌群', '牵拉尺骨远段向桡侧偏移', '需采用分骨手法维持尺桡骨间隙。')
  ],
  risks: [
   n(/Deep branch of radial|Superficial branch of radial/i, 'medium', '桡神经深/浅支', '紧贴桡骨近中段外侧下行', '上1/3骨折注意伸指功能与虎口感觉。'),
   v(/Radial artery|Ulnar artery/i, 'medium', '桡动脉与尺动脉', '伴行骨干掌侧', '常规核对远端动脉搏动。')
  ]
 }),

 galeazzi: () => ({
  summary: '桡骨下1/3骨折合并下尺桡关节脱位（盖氏骨折）：旋前方肌牵拉远段向尺侧旋前、肱桡肌拉向近端短缩、拇长展/拇短伸肌挤压向尺掌侧移位，极不稳定！',
  deforming: [
   m(/Pronator quadratus/i, 'distal', '旋前方肌', '牵拉桡骨远段向尺侧移位并旋前', '使桡尺骨远端靠拢，破坏下尺桡关节对合。'),
   m(/Brachioradialis/i, 'distal', '肱桡肌', '止于桡骨茎突，向上牵拉远段致短缩重叠', '加重尺骨头相对突向背/掌侧脱位。'),
   m(/Abductor pollicis longus|Extensor pollicis brevis/i, 'distal', '拇长展肌与拇短伸肌', '斜跨桡骨下段，挤压远段向尺侧成角和掌侧移位', '是盖氏骨折复位后极易再移位的重要肌力因素。')
  ],
  risks: [
   v(/Radial artery|Ulnar artery/i, 'medium', '桡动脉与尺动脉', '走行于腕部屈肌腱旁', '严重移位时检查手部血运。'),
   n(/^Median nerve|Ulnar nerve|Superficial branch of radial/i, 'medium', '正中神经与尺神经', '伴行腕前，下尺桡关节严重脱位可牵拉卡压', '核对各手指感觉与精细运动。')
  ]
 }),

 radius: (vi) => ({
  summary: vi === 0
   ? '桡骨远端伸直型（Colles）骨折：远段向背桡侧移位呈餐叉/枪刺样畸形；严重肿胀或背倾移位易压迫腕管内正中神经，晚期可并发拇长伸肌腱磨损断裂。'
   : '桡骨远端屈曲型（Smith）/关节缘型（Barton）骨折：远段或伴腕骨向掌/背侧移位，掌侧移位骨块直接压迫腕管正中神经。',
  deforming: [
   m(/Brachioradialis/i, 'distal', '肱桡肌', '牵拉桡骨茎突与远段向近侧短缩及桡偏', '附着于桡骨茎突基底部，参与餐叉/枪刺样畸形维持。'),
   m(/Pronator quadratus/i, 'distal', '旋前方肌', '覆盖桡骨远端掌侧，骨折出血肿胀增高腕前张力', '掌侧入路标志，血肿可波及腕管。'),
   m(/Extensor pollicis longus/i, 'distal', '拇长伸肌', '肌腱绕桡骨背侧结节（Lister 结节）走行', '断端骨刺或背移可摩擦致迟发性拇长伸肌腱断裂。')
  ],
  risks: [
   n(/^Median nerve/i, 'high', '正中神经（腕管受压）', '掌侧移位骨片、血肿或石膏过紧压迫腕管内正中神经', '桡侧三指半麻木刺痛、急性腕管综合征表现。'),
   v(/Radial artery/i, 'medium', '桡动脉', '紧邻桡骨茎突掌外侧，移位明显时需核查搏动', '手部血运与桡动脉搏动评估。'),
   mr(/Extensor pollicis longus/i, 'medium', '拇长伸肌腱（磨损断裂风险）', '经桡骨背侧结节沟，骨折背移粗糙骨面反复摩擦', '伤后数周突发拇指末节不能主动背伸。')
  ]
 }),

 scaphoid: () => ({
  summary: '手舟骨大部分被关节软骨覆盖，滋养血管主要自背侧脊及掌侧结节部进入（发自桡动脉腕背/腕掌支），腰部和近端骨折易断血供致缺血性坏死！',
  deforming: [
   m(/Abductor pollicis longus|Extensor pollicis brevis|Extensor pollicis longus/i, 'distal', '解剖鼻烟壶肌腱群', '横跨手舟骨桡背侧，压痛定位标志', '鼻烟壶深压痛为手舟骨骨折关键体征。')
  ],
  risks: [
   v(/Radial artery|Palmar carpal branch of radial|Dorsal carpal/i, 'high', '桡动脉腕背/腕掌滋养支', '舟骨近端血供逆行自远端/腰部进入，腰部及近端骨折阻断近侧块血运', '极易发生迟缓愈合、骨不连与舟骨近端缺血性坏死。')
  ]
 }),

 metacarpal: (vi) => ({
  summary: vi < 2
   ? '第一掌骨基底部骨折（含 Bennett 骨折脱位）：近段受拇长展肌向桡背侧牵拉，远段受拇长/短屈肌及拇收肌向掌尺侧牵拉，形成向桡背侧成角！'
   : '掌骨颈/骨干骨折受骨间肌与蚓状肌牵拉，掌骨头向掌侧屈转，断端向手背侧突起成角。',
  deforming: vi < 2 ? [
   m(/Abductor pollicis longus/i, 'proximal', '拇长展肌', '牵拉第一掌骨基底向桡背侧移位', 'Bennett 骨折中将掌骨干拉离大多角骨关节面。'),
   m(/Flexor pollicis longus|flexor pollicis brevis|adductor pollicis/i, 'distal', '拇长/短屈肌与拇收肌', '牵拉远段向掌侧内收屈曲', '与拇长展肌形成相反力偶，致桡背侧突起成角。')
  ] : [
   m(/interossei muscles of hand|Palmar interossei|Lumbrical muscles of hand/i, 'distal', '骨间肌与蚓状肌', '屈掌指关节，拉掌骨头向掌侧屈转、断端向背侧成角', '第5掌骨颈“拳击手骨折”掌屈畸形的主导肌群。')
  ],
  risks: [
   v(/Deep palmar arch|Superficial palmar arch|metacarpal arteries/i, 'medium', '掌深弓与掌心动脉', '紧贴掌骨基底掌侧走行', '多发掌骨骨折或挤压伤需严防手部骨筋膜室综合征。'),
   n(/Deep branch of ulnar|Median nerve/i, 'medium', '尺神经深支与正中神经掌支', '支配手内在肌与手指感觉', '检查分指、对掌及指端感觉。')
  ]
 }),

 finger: () => ({
  summary: '近节指骨骨折：近段受骨间肌与蚓状肌牵拉向掌侧屈曲，远段受伸肌腱牵拉向背侧翘起，形成典型向掌侧突起成角！',
  deforming: [
   m(/interossei muscles of hand|Palmar interossei|Lumbrical muscles of hand/i, 'proximal', '骨间肌与蚓状肌', '牵拉近节指骨近段向掌侧屈曲', '使断端向掌侧突起成角。'),
   m(/Extensor digitorum|Extensor indicis/i, 'distal', '指伸肌腱', '牵拉指骨远段向背侧过伸', '指骨颈骨折时远端可被拉向背侧翻转达90°。'),
   m(/Flexor digitorum/i, 'distal', '指浅/深屈肌腱', '紧贴指骨掌侧，中节骨折依止点上下移位方向不同', '骨折移位易致屈肌腱粘连。')
  ],
  risks: [
   v(/Proper palmar digital arteries/i, 'medium', '指掌侧固有动脉', '行于指骨两侧掌缘，开放砸伤易受损', '检查指端色泽、温度与毛细血管充盈。'),
   n(/Proper palmar digital branches/i, 'medium', '指掌侧固有神经', '伴行固有动脉', '检查指腹两点辨别觉。')
  ]
 }),

 neck: (vi) => ({
  summary: vi < 2
   ? '股骨颈囊内骨折（头下/经颈型）：旋股内、外侧动脉发出的关节囊支持带动脉（骺外动脉）极易断裂，导致骨折不愈合与股骨头缺血性坏死！远段因下肢重力与外旋肌呈短缩外旋（45°～60°）。'
   : '股骨颈基底部骨折部分位于关节囊外，旋股动脉关节囊血运相对保留，缺血坏死率低于头下型，但外旋畸形更显著。',
  deforming: [
   m(/Iliacus|Psoas major/i, 'distal', '髂腰肌（髂肌+腰大肌）', '牵拉小转子使远段向上短缩并外旋', '止于小转子，失去股骨颈支撑后加重外旋短缩。'),
   m(/Piriformis|Obturator|gemellus|Quadratus femoris/i, 'distal', '髋深层外旋肌群', '协同下肢重力使远段外旋 45°～60°', '内收型骨折剪力大、外旋与短缩更明显。'),
   m(/Gluteus medius|Gluteus minimus|Adductor/i, 'distal', '臀中/小肌与内收肌群', '向上牵拉大转子与骨干产生短缩', '大转子上移，Bryant 三角底边缩短。')
  ],
  risks: [
   v(/Medial circumflex femoral artery/i, 'high', '旋股内侧动脉（主供血动脉）', '发出骺外侧动脉供应股骨头2/3以上血运，囊内骨折移位最易扯断', '导致股骨颈骨折不愈合与晚期股骨头缺血性坏死（核心考点）。'),
   v(/Lateral circumflex femoral artery/i, 'medium', '旋股外侧动脉', '参与股骨颈基底动脉环', '基底部移位骨折可波及前侧囊血管。'),
   v(/Obturator artery|Inferior gluteal artery/i, 'medium', '闭孔动脉与臀下动脉吻合支', '圆韧带小动脉仅营养股骨头内下方，难以单独代偿', '头下型完全移位时侧支难以代偿。'),
   v(/Femoral vein/i, 'medium', '股静脉（卧床血栓风险）', '老年患者长期卧床血流缓慢', '易并发下肢深静脉血栓（DVT）与肺栓塞。')
  ]
 }),

 trochanter: (vi) => ({
  summary: vi === 1
   ? '反转子间骨折：近段受臀中/小肌及外旋肌群牵拉呈外展、外旋；远段受内收肌群与髂腰肌牵拉向内、向上明显错位！'
   : '顺转子间/转子下骨折：属关节囊外血运丰富区（坏死少见），但失去关节囊阻挡后远段外旋常达90°，且易内翻短缩。',
  deforming: [
   m(/Gluteus medius|Gluteus minimus/i, 'proximal', '臀中肌与臀小肌', '止于大转子，牵拉近段外展', '反转子间与转子下骨折近段外展的主导肌。'),
   m(/Piriformis|Obturator|gemellus|Quadratus femoris/i, 'proximal', '外旋肌群（梨状肌/闭孔肌/孖肌/股方肌）', '牵拉近段外旋', '近段绕股骨头外旋，需从上面观确认。'),
   m(/Iliacus|Psoas major/i, 'distal', '髂腰肌', '反转子间骨折拉远段向上前屈曲；小转子撕脱时单独上移', '小转子游离提示内侧骨支柱破坏、髋内翻不稳。'),
   m(/Adductor longus|Adductor brevis|Adductor magnus/i, 'distal', '大腿内收肌群', '强力牵拉远段向内、向上移位', '导致显著髋内翻与肢体短缩，需外展牵引对抗。')
  ],
  risks: [
   v(/Medial circumflex femoral|Lateral circumflex femoral|Deep femoral/i, 'medium', '旋股动静脉与股深血管', '转子区松质骨及血管网丰富，断端渗血量大', '老年患者隐性失血多，须防低血容量休克与深静脉血栓。'),
   n(/Sciatic nerve/i, 'medium', '坐骨神经', '行于转子后方深部', '严重移位或复位牵引操作需留意神经保护。')
  ]
 }),

 femur: (vi) => {
  if (vi === 0) {
   return {
    summary: '股骨干上1/3骨折：近段受髂腰肌屈曲、臀中小肌外展、外旋肌外旋；远段受内收肌群及大腿肌群牵拉向内、向上、向后移位！',
    deforming: [
     m(/Iliacus|Psoas major/i, 'proximal', '髂腰肌（髂肌+腰大肌）', '牵拉近段强烈前屈（屈曲）', '止于小转子，是近段屈曲畸形的首要力量。'),
     m(/Gluteus medius|Gluteus minimus/i, 'proximal', '臀中肌与臀小肌', '牵拉近段向外侧展开（外展）', '止于大转子，整复时需将远段外展以对齐近段。'),
     m(/Piriformis|Obturator|gemellus|Quadratus femoris/i, 'proximal', '外旋肌群', '牵拉近段向外旋转（外旋）', '共同造成近段“屈曲、外展、外旋”三联畸形。'),
     m(/Adductor longus|Adductor brevis|Adductor magnus/i, 'distal', '内收肌群（长/短/大收肌）', '强力牵拉远段向内、向上、向后移位', '导致短缩重叠及向外成角倾向。'),
     m(/Rectus femoris|Vastus|biceps femoris|Semitendinosus|Semimembranosus/i, 'distal', '股四头肌与腘绳肌', '跨越断端加重纵向短缩重叠', '肌肉肥厚出血量大，早期可并发外伤性休克。')
    ],
    risks: [
     v(/Femoral artery|Deep femoral artery|Perforating femoral/i, 'medium', '股动脉、股深动脉与穿动脉', '股骨周围血供丰富，断端刺伤穿动脉致大腿巨大血肿', '失血量可达 500～1500 mL，早期警惕外伤性休克。'),
     n(/Sciatic nerve|Femoral nerve/i, 'medium', '坐骨神经与股神经', '走行于股骨后方及前方肌群间', '严重错位时评估下肢感觉与足背伸跖屈。')
    ]
   };
  }
  if (vi === 1) {
   return {
    summary: '股骨干中1/3骨折：近段仍有轻度屈曲外展倾向，远段受强大内收肌群牵拉向内上方重叠移位，易形成向外成角；失血多警惕休克。',
    deforming: [
     m(/Adductor magnus|Adductor longus/i, 'distal', '大收肌与长收肌', '牵拉远段向内上方移位并致向外成角', '中段骨折向外成角与短缩的主要动力。'),
     m(/Iliacus|Psoas major|Gluteus medius/i, 'proximal', '髂腰肌与臀中肌', '使近段保持一定屈曲外展趋势', '牵引复位时患肢宜置外展中立位。'),
     m(/Vastus|Rectus femoris|biceps femoris/i, 'distal', '股四头肌与腘绳肌', '纵向牵拉造成明显重叠短缩', '常需骨牵引对抗强大肌张力。')
    ],
    risks: [
     v(/Femoral artery|Femoral vein|Perforating femoral/i, 'high', '股动、静脉（收肌管段）与穿动脉', '股血管经大收肌裂孔紧贴股骨中下段后内侧移行', '注意大腿张力血肿、足背及胫后动脉搏动与休克征象。'),
     n(/Sciatic nerve/i, 'medium', '坐骨神经', '沿股骨后方下行', '检查足背伸、跖屈及小腿感觉。')
    ]
   };
  }
  return {
   summary: '股骨干下1/3骨折：远段受腓肠肌内外侧头与膝后关节囊强力牵拉向后移位成角，锐利断端极易刺伤紧贴后方的腘动静脉与坐骨神经！',
   deforming: [
    m(/gastrocnemius/i, 'distal', '腓肠肌（内/外侧头）', '起自股骨内外上髁，强力牵拉远段向后移位倾倒！', '整复须屈膝松弛腓肠肌，严禁过伸膝关节。'),
    m(/Rectus femoris|Vastus/i, 'proximal', '股四头肌', '向上牵拉并加重重叠', '跨越骨折端加大短缩。')
   ],
   risks: [
    v(/Popliteal artery|Femoral artery/i, 'high', '腘动脉（第1类大动脉）', '紧贴股骨下1/3后壁穿出收肌管裂孔，向后倾倒的远段极易压迫或刺破！', '腘窝巨大血肿、足背动脉与胫后动脉搏动减弱或消失、小腿苍白发凉→必须紧急处理！'),
    v(/Popliteal vein|Femoral vein/i, 'high', '腘静脉', '紧伴腘动脉，常同时受压撕裂', '小腿迅速肿胀发绀、回流障碍。'),
    n(/Sciatic nerve|Tibial nerve|Common fibular nerve/i, 'high', '坐骨神经及其分支（胫/腓总神经）', '位于股骨下1/3后方腘窝顶，断端后移易挫伤或牵拉', '足下垂、足底或足背感觉麻木、足部主动活动障碍。')
   ]
  };
 },

 distalfemur: (vi) => ({
  summary: vi === 0
   ? '股骨髁上屈曲型骨折（多见）：腓肠肌强力牵拉远端向后移位，极易压迫或刺伤腘窝内腘动静脉、胫神经及腓总神经！'
   : '股骨髁上伸直型骨折：远端向前移位，需保护膝后腘血管，严防检查或牵引时过伸加重神经血管损伤。',
  deforming: [
   m(/gastrocnemius/i, 'distal', '腓肠肌（内/外侧头）', '牵拉远侧髁块向后倾倒移位', '屈膝位可有效松弛腓肠肌张力。'),
   m(/Rectus femoris|Vastus/i, 'proximal', '股四头肌', '纵向牵拉产生重叠短缩', '屈曲型时近段常刺入股四头肌或关节囊。')
  ],
  risks: [
   v(/Popliteal artery/i, 'high', '腘动脉', '紧贴股骨髁上后壁，向后移位的远端尖端极易刺伤或压闭', '足背及胫后动脉搏动减弱消失、腘窝巨大血肿、小腿缺血苍白。'),
   v(/Popliteal vein/i, 'high', '腘静脉', '紧伴腘动脉，易合并撕裂或受压', '小腿张力性肿胀发绀。'),
   n(/Sciatic nerve|Tibial nerve|Common fibular nerve/i, 'high', '坐骨神经 / 胫神经 / 腓总神经', '行于腘窝深部与外侧缘', '足下垂或跖屈无力、小腿足部感觉障碍。')
  ]
 }),

 intercondylar: () => ({
  summary: '股骨髁间 T/Y 形骨折：股骨干楔入两髁之间，腓肠肌牵拉两髁向后旋转，后方紧贴腘动脉、腘静脉、胫神经与腓总神经。',
  deforming: [
   m(/gastrocnemius/i, 'distal', '腓肠肌（内/外侧头）', '分别牵拉内、外侧髁向后翻转分离', '导致关节面台阶及前后错位。'),
   m(/Rectus femoris|Vastus/i, 'proximal', '股四头肌', '纵向加压使股骨干楔入髁间', '加大两髁横向劈开。')
  ],
  risks: [
   v(/Popliteal artery|Popliteal vein/i, 'high', '腘动、静脉', '位于股骨髁间后方腘窝深部', '足背/胫后动脉搏动减弱消失、腘窝搏动性血肿。'),
   n(/Tibial nerve|Common fibular nerve/i, 'high', '胫神经与腓总神经', '纵行经腘窝及腓骨颈，碎骨块后移易累及', '小腿足部感觉与运动障碍。')
  ]
 }),

 patella: (vi) => ({
  summary: vi === 0
   ? '髌骨横形骨折：膝半屈位跌倒时股四头肌骤然强烈收缩，将髌骨横向拉断并牵拉近侧骨块明显上移，伴伸膝装置撕裂！'
   : '髌骨粉碎性骨折多因直接撞击，若股四头肌扩张部完整则骨块分离较轻；康复早期须防过度屈膝再次拉开断端。',
  deforming: [
   m(/Rectus femoris|Vastus lateralis|Vastus medialis|Vastus intermedius/i, 'proximal', '股四头肌（股直肌/股内、外、中间肌）', '骤然强力收缩向上牵拉髌骨近侧块', '若两侧支持带同时撕裂，断端明显分离且主动伸膝丧失。')
  ],
  risks: [
   v(/Patellar anastomosis/i, 'medium', '髌网（膝关节动脉网）', '关节内积血形成明显膝关节肿胀与浮髌征', '关节腔张力性血肿疼痛。'),
   n(/Infrapatellar branch of saphenous/i, 'medium', '隐神经髌下支', '分布于髌前皮肤，撞击或手术易累及', '髌前及膝前外侧局部皮肤麻木。')
  ]
 }),

 plateau: () => ({
  summary: '胫骨平台（胫骨髁）骨折：外侧髁邻近绕腓骨头颈走行的腓总神经，后方深部紧贴腘动静脉分叉，易伴交叉/侧副韧带损伤与小腿筋膜室高压。',
  deforming: [
   m(/Rectus femoris|Vastus/i, 'proximal', '股四头肌', '经髌韧带止于胫骨粗隆，影响伸膝稳定', '早期固定后鼓励等长收缩防肌萎缩。'),
   m(/biceps femoris|Iliotibial tract/i, 'distal', '股二头肌与髂胫束', '附着于腓骨头与外侧平台边缘', '外侧劈裂伴韧带损伤时产生外翻/内翻失稳。')
  ],
  risks: [
   n(/Common fibular nerve/i, 'high', '腓总神经', '紧绕腓骨头颈外侧走行，外侧平台劈裂移位或撬拨复位操作极易损伤', '胫骨前肌瘫痪致“足下垂”、小腿前外侧及足背感觉减退。'),
   v(/Popliteal artery|Anterior tibial artery|Posterior tibial artery/i, 'high', '腘动脉及胫前/后动脉分叉', '紧贴胫骨近端后壁穿比目鱼肌腱弓，双髁高能量骨折易压迫损伤', '足背及胫后动脉搏动减弱消失、小腿骨筋膜室综合征。')
  ]
 }),

 tibia: (vi, level = 1) => {
  const levelRisk = level === 0
   ? [
      v(/Popliteal artery|Anterior tibial artery|Posterior tibial artery/i, 'high', '腘动脉与胫前/后动脉分叉', '腘动脉于比目鱼肌腱弓处分出胫前后动脉紧贴胫骨上1/3后方，最易受压刺伤！', '小腿与足部苍白发凉、足背/胫后动脉搏动减弱或消失。'),
      n(/Common fibular nerve/i, 'high', '腓总神经', '腓骨上端骨折时绕腓骨颈的腓总神经极易挫伤或被夹板压迫', '足下垂（背伸不能）、小腿前外侧及足背感觉障碍。')
     ]
   : level === 1
    ? [
       mr(/Tibialis anterior|Tibialis posterior|Soleus|Flexor digitorum longus/i, 'high', '小腿筋膜间隔区肌群（骨筋膜室综合征高危）', '小腿四筋膜室厚韧无弹性，中段骨折血肿水肿致室内压急升', '进行性剧痛、被动牵伸足趾剧痛、小腿硬肿，即使足背动脉可及仍可发生肌坏死！'),
       v(/Anterior tibial artery|Posterior tibial artery|Fibular artery/i, 'medium', '胫前、胫后与腓动静脉', '贴骨间膜与胫骨后方下行，中段断端移位易受压痉挛', '密切监测末梢血运、皮温及感觉运动。')
      ]
    : [
       v(/Posterior tibial artery|Anterior tibial artery/i, 'high', '胫骨滋养动脉与下1/3薄弱血供', '胫骨滋养动脉自上1/3后方入髓腔，下1/3缺乏肌肉覆盖血运极差', '下1/3骨折极易发生迟缓愈合、骨不连；前内侧皮肤薄易刺破成开放骨折。'),
       n(/Saphenous nerve|Superficial fibular nerve/i, 'medium', '隐神经与腓浅神经', '行于小腿下段皮下，错位或开放创口可受损', '足背或内踝区皮肤麻木。')
      ];
  return {
   summary: level === 0
    ? '胫腓骨干上1/3骨折：重点警惕紧贴胫骨后方的腘动脉/胫前动脉损伤及绕腓骨颈的腓总神经损伤！'
    : level === 1
     ? '胫腓骨干中1/3骨折：小腿厚韧筋膜室肿胀极易诱发骨筋膜室综合征与缺血性肌挛缩，需严密观察“被动牵伸趾痛”。'
     : '胫腓骨干下1/3骨折：缺乏肌肉附着且髓腔滋养血管中断，最易迟缓愈合或不愈合，且前内侧易穿破皮肤。',
   deforming: [
    m(/gastrocnemius|Soleus/i, 'distal', '小腿三头肌（腓肠肌+比目鱼肌）', '强力纵向牵拉远段短缩重叠并向后成角', '小腿后群肌力远强于前群，易形成重叠短缩。'),
    m(/Tibialis anterior|Extensor digitorum longus|Fibularis longus/i, 'distal', '小腿前/外侧肌群', '协同造成成角与足外旋移位', '斜形/螺旋形骨折时远段常向外、向后错开。')
   ],
   risks: levelRisk
  };
 },

 ankle: () => ({
  summary: '踝部内/外翻骨折常伴内/外侧副韧带及下胫腓联合撕裂，内踝后方紧贴胫后动静脉与胫神经，外踝后方邻近腓肠神经与腓骨肌腱。',
  deforming: [
   m(/Tibialis posterior|Flexor digitorum longus|Flexor hallucis longus/i, 'distal', '内踝后方肌腱群', '走行于内踝后沟，内踝骨折移位可嵌夹或影响对位', '维持足内翻与纵弓张力。'),
   m(/Fibularis longus|Fibularis brevis/i, 'distal', '腓骨长、短肌', '绕外踝后方下行，外翻损伤时协同牵拉', '外踝移位时需留意肌腱脱位卡压。'),
   m(/Calcaneal tendon|gastrocnemius|Soleus/i, 'distal', '跟腱（小腿三头肌）', '后踝骨折伴距骨后脱位时向上后牵拉足部', '复位后踝与距骨后脱位需屈膝松弛跟腱。')
  ],
  risks: [
   v(/Posterior tibial artery|Dorsalis pedis artery/i, 'medium', '胫后动脉与足背动脉', '严重骨折脱位可压迫踝部血管致皮肤张力水疱与足部缺血', '立即手法整复脱位解除皮肤及血管压迫。'),
   n(/Tibial nerve|Sural nerve|Superficial fibular nerve/i, 'medium', '胫神经（跗管）与腓肠神经', '分别行经内踝与外踝后方', '核对足底与足背皮肤感觉。')
  ]
 }),

 talus: (vi) => ({
  summary: vi === 0
   ? '距骨颈骨折：距骨无肌肉附着且绝大部分被软骨覆盖，主要血供来自足背动脉经距骨颈前外侧进入的关节支，移位极易导致距骨体缺血性坏死！'
   : '距骨后唇骨折邻近拇长屈肌腱沟与内踝后方血管神经束。',
  deforming: [
   m(/Calcaneal tendon|gastrocnemius|Soleus/i, 'distal', '跟腱与周围肌腱弹性回缩', '暴力消失后牵拉足与跟骨后缩，促使距骨体后脱出踝穴', '距骨本身无肌肉附着，移位受周围肌腱挤压驱动。'),
   m(/Flexor hallucis longus/i, 'distal', '拇长屈肌', '肌腱穿行距骨后结节沟，后唇骨折时易受刺激卡压', '被动背伸拇趾诱发踝后深压痛。')
  ],
  risks: [
   v(/Dorsalis pedis artery|Posterior tibial artery/i, 'high', '足背动脉距骨颈关节支（主血供）', '距骨颈骨折移位或距骨体脱位直接截断距骨体血运', '极高发距骨体缺血性坏死与创伤性踝关节炎！'),
   n(/Tibial nerve/i, 'medium', '胫神经', '距骨体后脱位时在踝后内侧受压', '检查足底感觉及足趾跖屈。')
  ]
 }),

 calcaneus: (vi) => ({
  summary: vi === 0
   ? '跟骨结节撕脱骨折（不波及关节面）：跟腱（腓肠肌、比目鱼肌）强力收缩将跟骨结节骨块向上撕脱牵移，需屈膝跖屈位松弛复位。'
   : '跟骨波及距下关节面压缩骨折：跟骨变扁增宽、Böhler 角减小，外侧膨出易卡压腓骨肌腱与腓肠神经，且需警惕足底骨筋膜室高压。',
  deforming: [
   m(/Calcaneal tendon|gastrocnemius|Soleus/i, 'proximal', '跟腱（腓肠肌+比目鱼肌）', '强力收缩向上牵拉跟骨结节，增大断端分离并减小结节关节角', '复位与固定须保持屈膝跖屈以松弛跟腱牵力。'),
   m(/Fibularis longus|Fibularis brevis/i, 'distal', '腓骨长、短肌腱', '行于跟骨外侧壁，压缩增宽后易发生撞击卡压', '复位须挤压恢复跟骨宽度。')
  ],
  risks: [
   n(/Sural nerve|Tibial nerve|Lateral plantar nerve/i, 'medium', '腓肠神经与足底神经', '分别行经跟骨外侧与内侧跗管，增宽移位可压迫', '足外侧缘或足底麻木刺痛。'),
   v(/Calcaneal branches|Posterior tibial artery/i, 'medium', '跟骨支与胫后动脉', '足跟软组织血供薄弱，严重肿胀易起张力水疱或皮瓣坏死', '早期抬高患肢消肿。')
  ]
 }),

 metatarsal: () => ({
  summary: '跖骨毗邻足背动脉、弓状动脉及足底动脉弓，多发跖骨骨折或挤压伤肿胀重，易并发足部骨筋膜室综合征与前足血运障碍。',
  deforming: [
   m(/Fibularis brevis/i, 'proximal', '腓骨短肌', '止于第5跖骨基底粗隆，足骤然内翻可致基底部撕脱', '外侧缘局部压痛肿胀。'),
   m(/interossei muscles of foot|Flexor digitorum brevis/i, 'distal', '足骨间肌与足底肌群', '牵拉远端向跖侧成角', '恢复足横弓与纵弓负重曲线。')
  ],
  risks: [
   v(/Dorsalis pedis artery|Arcuate artery|Deep plantar artery|Plantar arch/i, 'medium', '足背动脉、弓状动脉与足底深支', '跨越跖骨基底背跖侧，重物砸伤易致血栓或前足缺血', '核对足背动脉搏动与趾端色温。')
  ]
 }),

 toes: () => ({
  summary: '趾骨骨折常伴趾背/趾底固有血管神经挫伤及甲床损伤，足部皮肤血供较差，开放伤需预防感染与末梢缺血。',
  deforming: [
   m(/Extensor hallucis longus|Flexor hallucis longus|Extensor digitorum longus/i, 'distal', '拇/趾长伸屈肌腱', '牵拉趾骨断端向背侧或跖侧成角', '维持足趾纵轴对线。')
  ],
  risks: [
   v(/Proper plantar digital arteries|Dorsal digital arteries of foot/i, 'medium', '趾底/趾背固有动脉', '重物挤压易致末梢循环障碍', '观察趾端色泽及毛细血管充盈。')
  ]
 }),

 // ================= LIMB DISLOCATIONS (Chapter 7) =================
 'shoulder-dislocation': (vi) => ({
  summary: vi === 0
   ? '肩关节前脱位（最常见，多为喙突下脱位）：肱骨头冲破薄弱前下关节囊，伤臂弹性固定于外展外旋位，极易压迫牵拉腋神经、腋血管并可合并肩袖撕裂与肱二头肌长头腱滑脱！'
   : '肩关节后脱位：肱骨头移至肩胛盂后方，上臂固定于内收内旋位，需注意肩袖后部及腋神经保护。',
  deforming: [
   m(/pectoralis major|Subscapularis/i, 'joint', '胸大肌与肩胛下肌', '将脱出的肱骨头向内前方拉至喙突下并产生弹性固定', '构成方肩与 Dugas 征阳性的肌力背景。'),
   m(/deltoid/i, 'joint', '三角肌', '失去肱骨头外侧支撑而变平呈“方肩”，并牵拉上臂呈外展弹性固定', '若合并腋神经损伤则出现三角肌瘫痪萎缩。'),
   m(/Supraspinatus|Infraspinatus|Teres minor/i, 'joint', '肩袖肌群（冈上/冈下/小圆肌）', '高度牵张，常伴大结节撕脱或肩袖撕裂', '复位后早期禁止强力外旋以防再脱位。'),
   m(/Long head of biceps brachii/i, 'joint', '肱二头肌长头腱', '脱位时易自结节间沟滑脱，可能阻碍手法复位', '多次复位失败须排查长头腱嵌顿。')
  ],
  risks: [
   n(/Axillary nerve/i, 'high', '腋神经', '紧绕外科颈下方，肱骨头前下脱出最常牵拉压迫此神经！', '三角肌麻痹（肩外展无力）及肩外侧三角肌区感觉减退；多随复位解除压迫。'),
   v(/Axillary artery|Axillary vein/i, 'high', '腋动、静脉', '位于喙突下方腋窝内，脱位肱骨头或粗暴复位手法均可压迫撕裂', '桡动脉搏动减弱消失、手苍白发凉或腋部搏动性血肿。'),
   n(/brachial plexus/i, 'medium', '臂丛神经', '紧邻腋血管，前下移位过大时受牵拉压迫', '上肢多支神经感觉运动异常。')
  ]
 }),

 'elbow-dislocation': (vi) => ({
  summary: vi === 0
   ? '肘关节后脱位（最常见）：尺桡骨近端整体后移呈靴状畸形，肘后三角关系失常；肘前肱动静脉受脱位肱骨远端顶压，尺/正中/桡神经易受牵拉！'
   : '肘关节侧方/前脱位：常伴内外侧副韧带断裂、内上髁或鹰嘴骨折，高度警惕尺神经与肱动脉损伤。',
  deforming: [
   m(/triceps brachii/i, 'joint', '肱三头肌', '向上后方牵拉脱出的尺骨鹰嘴，使肘关节弹性固定于半屈45°靴状畸形', '复位须先拔伸牵引克服三头肌张力。'),
   m(/Brachialis|biceps brachii/i, 'joint', '肱肌与肱二头肌', '被前移的肱骨下端高度顶压撕裂出血', '肱肌撕裂血肿后期需防骨化性肌炎。')
  ],
  risks: [
   v(/Brachial artery|Brachial veins/i, 'high', '肱动、静脉', '紧贴肘窝前方，脱位肱骨远端向前顶压易致血管痉挛或闭塞', '桡动脉搏动减弱消失、手部发凉麻木、前臂缺血。'),
   n(/^Ulnar nerve/i, 'high', '尺神经', '绕内上髁后方，后脱位及外侧脱位极易牵拉损伤', '环小指麻木、手内在肌无力。'),
   n(/^Median nerve|^Radial nerve/i, 'medium', '正中神经与桡神经', '经肘窝前行，脱位骨端顶压或过度牵拉可致挫伤', '检查拇示指感觉及伸腕伸指肌力。')
  ]
 }),

 'lunate-dislocation': (vi) => ({
  summary: vi === 0
   ? '月骨掌侧脱位：月骨翻转压入腕管，直接压迫腕管内正中神经与屈指肌腱！若掌背侧桡月韧带均断裂，月骨血运完全中断极易缺血坏死。'
   : '月骨周围背侧脱位：头状骨与远排腕骨背移，同样可牵拉压迫正中神经。',
  deforming: [
   m(/Flexor digitorum superficialis|Flexor digitorum profundus/i, 'joint', '指浅、深屈肌腱（腕管内）', '受脱出月骨顶压张力骤增，致腕屈曲、中指不能完全伸直', '叩击第3掌骨头出现明显传导痛。')
  ],
  risks: [
   n(/^Median nerve/i, 'high', '正中神经（腕管压迫）', '月骨掌侧脱出直接挤占腕管容积压迫正中神经！', '桡侧3个半手指（拇、示、中及环指桡侧）麻木刺痛、大鱼际无力。'),
   v(/Dorsal carpal|Palmar carpal branch/i, 'high', '桡月韧带营养血管', '脱位旋转>90°～270°扭曲或撕断掌背侧韧带血管', '导致月骨缺血性坏死（Kienböck 样改变）及创伤性关节炎。')
  ]
 }),

 'mcp-dislocation': () => ({
  summary: '拇指掌指关节背侧脱位：掌骨头穿破掌侧关节囊，拇长屈肌腱与掌板易卡夹于关节间隙阻碍闭合复位。',
  deforming: [
   m(/Flexor pollicis longus|flexor pollicis brevis|Abductor pollicis brevis/i, 'joint', '拇长屈肌腱与大鱼际肌', '肌腱滑移卡夹在掌骨颈两侧，形成“纽扣孔”样绞锁阻碍复位', '严禁暴力过伸，须顺势牵拉推压近节基底屈曲复位。')
  ],
  risks: [
   n(/Proper palmar digital branches of median/i, 'medium', '拇指固有神经', '经掌骨头两侧下行，严重挤压可致拇指麻木', '核查拇指指腹感觉。')
  ]
 }),

 'pip-dislocation': () => ({
  summary: '指间关节背侧/侧方脱位：常伴掌板或侧副韧带撕裂，伸屈肌腱张力维持脱位畸形。',
  deforming: [
   m(/Flexor digitorum superficialis|Extensor digitorum/i, 'joint', '指屈、伸肌腱', '牵拉中节指骨基底维持背侧或侧方错位', '复位后早期轻度屈曲固定保护掌板。')
  ],
  risks: [
   v(/Proper palmar digital arteries/i, 'medium', '指固有血管神经束', '紧贴指间关节两侧', '复位前后检查指端血运与感觉。')
  ]
 }),

 'hip-dislocation': (vi) => vi === 0 ? ({
  summary: '髋关节后脱位（最常见）：伤肢典型呈屈曲、内收、内旋和短缩畸形！向后上方脱出的股骨头紧邻并极易压迫、牵拉坐骨神经，晚期并发股骨头缺血性坏死！',
  deforming: [
   m(/Gluteus maximus|Gluteus medius|Gluteus minimus/i, 'joint', '臀大、中、小肌', '被后上移位的股骨头顶起紧张，维持弹性固定与短缩', '臀部可触及隆起的股骨头。'),
   m(/Piriformis|Obturator internus|gemellus|Quadratus femoris/i, 'joint', '髋后深层外旋肌群', '后脱位时多被撕裂或高度牵张，加重后方出血肿胀', '紧邻坐骨神经穿出通道。'),
   m(/Iliacus|Psoas major|Adductor/i, 'joint', '髂腰肌与内收肌群', '协同紧张的髂股韧带使伤肢固定于屈曲、内收、内旋位', '若髂股韧带同时断裂则反呈外旋畸形。')
  ],
  risks: [
   n(/Sciatic nerve/i, 'high', '坐骨神经', '紧贴髋臼后壁经梨状肌下孔下行，后脱位股骨头直接顶压或牵拉！', '约10%～20%合并伤：足下垂（腓总支最敏感）、小腿后外侧及足部感觉运动障碍。'),
   v(/Medial circumflex femoral artery|Inferior gluteal artery/i, 'high', '旋股内侧动脉与关节囊血管', '关节囊后壁撕裂、圆韧带断裂并扭曲旋股内侧动脉', '复位延迟（>6小时）显著升高股骨头缺血性坏死发生率！')
  ]
 }) : ({
  summary: '髋关节前脱位（耻骨型/闭孔型）：伤肢典型呈外展、外旋、轻度屈曲且相对变长！股骨头停于耻骨支压迫股动静脉与股神经，停于闭孔则压迫闭孔神经！',
  deforming: [
   m(/Iliacus|Psoas major|Pectineus/i, 'joint', '髂腰肌与耻骨肌', '被前下方脱出的股骨头顶起，维持外展、外旋、轻屈弹性固定', '腹股沟区或闭孔区可触及脱出股骨头。'),
   m(/Obturator externus|Adductor/i, 'joint', '闭孔外肌与内收肌群', '闭孔型脱位时股骨头直接抵压闭孔外肌及内收肌起点', '牵拉并压迫闭孔神经血管束。')
  ],
  risks: [
   v(/Femoral artery|Femoral vein/i, 'high', '股动、静脉（耻骨部脱位）', '股骨头停于耻骨支水平直接顶压腹股沟下股血管', '下肢动脉搏动减弱消失、苍白发凉或严重静脉淤血肿胀。'),
   n(/Obturator nerve/i, 'high', '闭孔神经（闭孔部脱位）', '股骨头落入闭孔压迫穿行的闭孔神经', '大腿内收肌群瘫痪及大腿内侧面皮肤感觉障碍。'),
   n(/Femoral nerve/i, 'medium', '股神经', '伴行股动脉外侧，耻骨部前脱位可受压牵拉', '股四头肌伸膝无力、大腿前面感觉减退。'),
   v(/Medial circumflex femoral artery|Obturator artery/i, 'high', '旋股内侧动脉与闭孔动脉', '关节囊前下撕裂累及股骨头血供', '同样须尽早复位预防股骨头缺血性坏死。')
  ]
 }),

 'knee-dislocation': (vi) => ({
  summary: '胫股（膝）关节脱位属高能量极危急损伤！前/后脱位极易撕裂或闭塞紧贴后方的腘动静脉（不及时修复将致截肢！），内侧脱位极易广泛撕裂腓总神经！',
  deforming: [
   m(/gastrocnemius|Popliteus/i, 'joint', '腓肠肌与腘肌', '跨膝后方受严重撕裂牵拉，与腘血管紧密相邻', '严禁暴力按压骨端，固定须屈膝20°～30°禁用伸直位！'),
   m(/Rectus femoris|Vastus|biceps femoris|Semimembranosus/i, 'joint', '股四头肌与腘绳肌', '维持脱位错开，常合并交叉/侧副韧带及肌腱撕裂', '复位后抽屉试验、侧方应力试验多呈阳性。')
  ],
  risks: [
   v(/Popliteal artery|Popliteal vein/i, 'high', '腘动、静脉（最高危保肢警报！）', '上下两端固定于收肌管裂孔与比目鱼肌腱弓，膝前/后脱位极易发生内膜撕裂、血栓或断裂', '足背及胫后动脉搏动消失、小腿苍白发凉发绀→黄金4～6小时内必须血管探查修复，否则面临截肢！'),
   n(/Common fibular nerve/i, vi === 3 ? 'high' : 'high', '腓总神经', '沿股二头肌腱内侧缘绕腓骨颈，尤其内侧脱位常致广泛撕裂性永久损伤', '胫骨前肌瘫痪致“足下垂”、小腿前外侧与足背感觉消失。'),
   n(/Tibial nerve/i, 'medium', '胫神经', '纵行经腘窝深部，前后脱位可受牵拉', '足底感觉及跖屈无力。')
  ]
 }),

 'patella-dislocation': () => ({
  summary: '髌骨外侧脱位：股内侧肌下部斜行纤维（VMO）及内侧支持带抗外移装置撕裂，股外侧肌向外牵拉使髌骨越过股骨外髁。',
  deforming: [
   m(/Vastus medialis/i, 'joint', '股内侧肌（斜行纤维）', '正常向内牵拉防止髌骨外移；脱位时其内侧扩张部撕裂失衡', '康复重点为强化股四头肌特别是股内侧肌等长收缩。'),
   m(/Vastus lateralis|Rectus femoris/i, 'joint', '股外侧肌与股直肌', 'Q 角及外侧拉力将髌骨拉向外侧越过外髁', '脱位后膝呈半屈曲位不能主动伸直。')
  ],
  risks: [
   mr(/Vastus medialis/i, 'high', '内侧支持带与股四头肌扩张部撕裂', '髌骨急剧外移扯裂内侧稳定结构', '需固定4～6周并加强外侧压垫保护。')
  ]
 }),

 'lisfranc-dislocation': () => ({
  summary: '跗跖关节（Lisfranc）脱位：足背动脉终支（足底深动脉）正自第1、2跖骨间穿至足底，脱位极易撕裂或诱发胫后/跖血管痉挛血栓，危及前足血运致坏死！',
  deforming: [
   m(/Tibialis anterior|Fibularis longus/i, 'joint', '胫骨前肌与腓骨长肌', '分别止于内侧楔骨/第1跖骨基底，维持足弓与脱位张力', '足弓塌陷、足宽增大。')
  ],
  risks: [
   v(/Dorsalis pedis artery|Deep plantar artery|Arcuate artery/i, 'high', '足背动脉与足底深动脉（第1、2跖骨间穿支）', '足背动脉终支穿第1、2跖骨基底间隙至足底，脱位极易直接扯裂或痉挛闭塞！', '前足变冷、苍白或暗紫、足背动脉搏动消失→不及时复位可致前足坏死！'),
   v(/Posterior tibial artery|Plantar arch/i, 'medium', '胫后血管与足底弓', '牵拉可诱发痉挛与主要跖血管血栓形成', '严密监测足趾末梢血循环。')
  ]
 }),

 'mtp-dislocation': () => ({
  summary: '第1跖趾关节背侧脱位：第1跖骨头突向足底，拇短屈肌腱与籽骨及关节囊可卡夹阻碍复位。',
  deforming: [
   m(/flexor hallucis brevis|Abductor hallucis|adductor hallucis/i, 'joint', '拇短屈肌（含籽骨）与拇展/收肌', '包绕第1跖骨头两侧形成“纽扣孔”嵌顿', '近节趾骨基底背移、趾间关节屈曲弹性固定。')
  ],
  risks: [
   v(/Proper plantar digital arteries/i, 'medium', '拇趾固有血管神经', '受突向足底的第1跖骨头顶压', '复位前后核查拇趾血运与感觉。')
  ]
 }),

 'toe-ip-dislocation': () => ({
  summary: '趾间关节背侧脱位：趾长伸/屈肌腱牵拉维持错位，常伴掌板嵌入。',
  deforming: [
   m(/Extensor hallucis longus|Flexor hallucis longus/i, 'joint', '拇长伸肌与拇长屈肌腱', '维持末节基底背侧脱位张力', '适当牵引屈曲即可复位。')
  ],
  risks: [
   v(/Proper plantar digital arteries/i, 'medium', '趾底固有动脉', '过度牵拉可影响趾端循环', '核查末梢充盈。')
  ]
 })
};

// Dynamic displacement overlays when the user toggles custom displacements (成角/侧方/缩短/分离/旋转)
export function displacementImpactNotes(motions = [], level = 1, course = null) {
 const extra = [];
 if (motions.includes('shorten')) {
  extra.push({
   tag: '缩短重叠',
   text: '跨越骨折线的长肌群回缩维持重叠；伴行神经与血管相对迂曲并易在锐利重叠断端间卡压，复位需充分拔伸牵引。'
  });
 }
 if (motions.includes('separate')) {
  extra.push({
   tag: '分离移位',
   text: '过度分离易造成周围肌肉、骨膜嵌夹断端阻碍愈合，且过度纵向牵张可引起伴行神经牵拉性失用（如肱骨过度牵引）。'
  });
 }
 if (motions.includes('angle')) {
  extra.push({
   tag: '成角移位',
   text: '成角凸侧软组织及血管神经承受高度张力，凹侧肌群挛缩；锐利成角顶点（如股骨下1/3向后、肱骨髁上向前）易直接顶压大血管。'
  });
 }
 if (motions.includes('side')) {
  extra.push({
   tag: '侧方移位',
   text: '断端侧方锐缘偏离骨干轴线，最易刺破紧邻肌腹（如肱前肌）或直接刺伤/挤压贴骨走行的神经与动脉。'
  });
 }
 if (motions.includes('rotate')) {
  extra.push({
   tag: '旋转移位',
   text: '旋转错位扭转骨间膜与旋前/旋后肌群（前臂）或外旋/内收肌群（股骨），不仅损害关节力线，还可牵拉绕骨走行的神经干。'
  });
 }
 if (course?.id === 'tibia') {
  extra.push({
   tag: ['上 1/3 警示', '中 1/3 警示', '下 1/3 警示'][level] || '',
   text: [
    '当前位于上 1/3：紧邻腘动脉分叉与绕腓骨颈的腓总神经，优先核查足背动脉搏动与背伸肌力。',
    '当前位于中 1/3：小腿骨筋膜室压力风险最高，警惕进行性剧痛与被动牵伸足趾痛。',
    '当前位于下 1/3：滋养动脉受损且肌肉覆盖稀薄，延迟愈合/不愈合及皮肤穿破风险显著增高。'
   ][level]
  });
 }
 return extra.filter(item => item.text);
}

// Single-bone anatomical soft-tissue brief (shown when zooming into a limb bone before choosing a fracture variant)
export function boneSoftTissueProfile(boneName) {
 if (!boneName) return null;
 const b = boneName.toLowerCase();
 if (/clavicle/.test(b)) return CLINICAL_PROFILES.clavicle(1);
 if (/scapula/.test(b)) return CLINICAL_PROFILES['shoulder-dislocation'](0);
 if (/humerus/.test(b)) return CLINICAL_PROFILES.humerus(1);
 if (/radius/.test(b)) return CLINICAL_PROFILES['single-forearm'](0);
 if (/ulna/.test(b)) return CLINICAL_PROFILES.monteggia(0);
 if (/scaphoid/.test(b)) return CLINICAL_PROFILES.scaphoid(1);
 if (/lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate/.test(b)) return CLINICAL_PROFILES['lunate-dislocation'](0);
 if (/metacarpal/.test(b)) return CLINICAL_PROFILES.metacarpal(0);
 if (/finger|thumb/.test(b)) return CLINICAL_PROFILES.finger(0);
 if (/hip bone/.test(b)) return CLINICAL_PROFILES['hip-dislocation'](0);
 if (/femur/.test(b)) return CLINICAL_PROFILES.femur(0);
 if (/patella/.test(b)) return CLINICAL_PROFILES.patella(0);
 if (/tibia/.test(b)) return CLINICAL_PROFILES.tibia(0, 0);
 if (/fibula/.test(b)) return CLINICAL_PROFILES.tibia(1, 0);
 if (/talus/.test(b)) return CLINICAL_PROFILES.talus(0);
 if (/calcaneus/.test(b)) return CLINICAL_PROFILES.calcaneus(0);
 if (/navicular|cuboid|cuneiform|metatarsal/.test(b)) return CLINICAL_PROFILES['lisfranc-dislocation'](0);
 if (/toe|sesamoid/.test(b)) return CLINICAL_PROFILES.toes(0);
 return null;
}

export function clinicalSoftTissueFor(course, variantIndex = 0, level = 1, selectedBone = '') {
 if (!course || variantIndex < 0) return boneSoftTissueProfile(selectedBone);
 const key = course.family || course.id;
 const fn = CLINICAL_PROFILES[key];
 if (fn) return fn(variantIndex, level);
 return boneSoftTissueProfile(selectedBone);
}

// Match an individual Z-Anatomy mesh node against the active clinical profile
export function classifyNodeRole(layer, rawName, profile) {
 if (!profile) return null;
 if (layer === 'muscles') {
  const def = profile.deforming?.find(item => item.pattern.test(rawName));
  if (def) return { role: 'deforming', ...def };
  const risk = profile.risks?.find(item => item.layer === 'muscles' && item.pattern.test(rawName));
  if (risk) return { role: 'risk', ...risk };
 } else {
  const risk = profile.risks?.find(item => item.layer === layer && item.pattern.test(rawName));
  if (risk) return { role: 'risk', ...risk };
 }
 return null;
}
