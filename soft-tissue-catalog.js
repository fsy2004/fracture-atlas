// Complete Chinese & English anatomical dictionary for all limb soft-tissue structures
// (muscles, arteries, veins, nerves) across the 6 limb zones.

export const LIMB_ZONES = [
 'shoulder-arm',
 'elbow-forearm',
 'wrist-hand',
 'hip-thigh',
 'knee-leg',
 'ankle-foot'
];
export const AXIAL_ZONES = ['face', 'neck', 'chest', 'back', 'pelvis'];
export const ALL_ZONES = [...LIMB_ZONES, ...AXIAL_ZONES];

const axialTerms = {muscles: {}, vessels: {}, nerves: {}};
const termImports = {
 face: () => import('./soft-tissue-terms/face.js?v=whole-body1'),
 neck: () => import('./soft-tissue-terms/neck.js?v=whole-body1'),
 chest: () => import('./soft-tissue-terms/chest.js?v=whole-body1'),
 back: () => import('./soft-tissue-terms/back.js?v=whole-body1'),
 pelvis: () => import('./soft-tissue-terms/pelvis.js?v=whole-body1')
};
const pendingTerms = new Map();
export function loadAxialTerms(zones = AXIAL_ZONES) {
 return Promise.all([...new Set(zones)].filter(zone => Object.hasOwn(termImports, zone)).map(zone => {
  if (!pendingTerms.has(zone)) {
   pendingTerms.set(zone, termImports[zone]().then(({default: terms}) => {
    for (const [layer, entries] of Object.entries(terms)) Object.assign(axialTerms[layer], entries);
   }).catch(error => { pendingTerms.delete(zone); throw error; }));
  }
  return pendingTerms.get(zone);
 }));
}

export const ZONE_LABELS = {
 face: '颅颌面',
 neck: '颈部',
 chest: '胸廓',
 back: '胸腰背',
 pelvis: '腹盆骶尾',
 'shoulder-arm': '肩带与上臂',
 'elbow-forearm': '肘与前臂',
 'wrist-hand': '腕与手',
 'hip-thigh': '髋与大腿',
 'knee-leg': '膝与小腿',
 'ankle-foot': '踝与足'
};

export const MUSCLE_TERMS = {
 'Abdominal part of pectoralis major muscle': ['胸大肌（腹部）', '内收、内旋肩关节'],
 'Clavicular head of pectoralis major muscle': ['胸大肌（锁骨部）', '前屈、内收、内旋肩关节'],
 'Sternocostal head of pectoralis major muscle': ['胸大肌（胸肋部）', '强力内收、内旋肱骨近段'],
 'Pectoralis minor muscle': ['胸小肌', '拉肩胛骨向前下方'],
 'Subclavius muscle': ['锁骨下肌', '拉锁骨向内下，保护锁骨下血管'],
 'Sternocleidomastoid muscle': ['胸锁乳突肌', '锁骨中段骨折时向上后牵拉内侧段'],
 'Ascending part of trapezius muscle': ['斜方肌（下部）', '下拉并上回旋肩胛骨'],
 'Descending part of trapezius muscle': ['斜方肌（上部）', '上提锁骨外端与肩胛骨'],
 'Transverse part of trapezius muscle': ['斜方肌（中部）', '向脊柱拉近肩胛骨'],
 'Levator scapulae': ['肩胛提肌', '上提肩胛骨内上角'],
 'Rhomboid major muscle': ['大菱形肌', '拉肩胛骨向内上方'],
 'Rhomboid minor muscle': ['小菱形肌', '拉肩胛骨向内上方'],
 'Serratus anterior muscle': ['前锯肌', '拉肩胛骨紧贴胸壁并前伸'],
 'Latissimus dorsi muscle': ['背阔肌', '内收、内旋、后伸肱骨近段'],
 'Teres major muscle': ['大圆肌', '内收、内旋肱骨近段'],
 'Teres minor muscle': ['小圆肌', '肩袖肌群，外旋肩关节'],
 'Supraspinatus muscle': ['冈上肌', '肩袖肌群，启动肩关节外展'],
 'Infraspinatus muscle': ['冈下肌', '肩袖肌群，外旋肩关节'],
 'Subscapularis muscle': ['肩胛下肌', '肩袖肌群，内旋肩关节并稳定前囊'],
 'Acromial part of deltoid muscle': ['三角肌（肩峰部）', '外展上臂；肱骨干中段骨折牵拉近段外展'],
 'Clavicular part of deltoid muscle': ['三角肌（锁骨部）', '前屈、内旋上臂；参与锁骨外段向下牵拉'],
 'Scapular spinal part of deltoid muscle': ['三角肌（肩胛冈部）', '后伸、外旋上臂'],
 'Coracobrachialis muscle': ['喙肱肌', '前屈、内收上臂，协助牵拉肱骨段'],
 'Long head of biceps brachii': ['肱二头肌（长头）', '屈肘、前臂旋后；肩脱位时肌腱可滑脱'],
 'Short head of biceps brachii': ['肱二头肌（短头）', '屈肘、前臂旋后；参与肱骨远段向上短缩'],
 'Brachialis muscle': ['肱肌（肱前肌）', '强力屈肘；肱骨髁上伸直型骨折近端常刺破此肌'],
 'Long head of triceps brachii': ['肱三头肌（长头）', '伸肘伸肩；尺骨鹰嘴骨折时向上撕脱牵拉'],
 'Lateral head of triceps brachii': ['肱三头肌（外侧头）', '伸肘；参与肱骨干骨折远段上移重叠'],
 'Medial head of triceps brachii': ['肱三头肌（内侧头）', '伸肘；紧贴肱骨后方与桡神经沟'],
 'Anconeus muscle': ['肘肌', '协助伸肘并稳定肘外侧关节囊'],
 'Brachioradialis muscle': ['肱桡肌', '屈肘；盖氏骨折时牵拉桡骨远端向近侧短缩'],
 'Supinator': ['旋后肌', '使前臂旋后；桡骨上1/3骨折致近段旋后，深支穿行其间'],
 'Superficial head of pronator teres': ['旋前圆肌（浅头）', '使前臂旋前、屈肘；决定桡骨干骨折近远段旋转分界'],
 'Deep head of pronator teres': ['旋前圆肌（深头）', '正中神经经两头之间穿行'],
 'Pronator quadratus': ['旋前方肌', '使前臂旋前；牵拉桡骨下段远端旋前并向尺侧靠拢'],
 'Flexor carpi radialis': ['桡侧腕屈肌', '屈腕、桡偏；起自肱骨内上髁'],
 'Palmaris longus muscle': ['掌长肌', '屈腕、紧张掌腱膜；紧邻正中神经'],
 'Humeral head of flexor carpi ulnaris': ['尺侧腕屈肌（肱骨头）', '屈腕、尺偏；尺神经穿行两头间肘管'],
 'Ulnar head of flexor carpi ulnaris': ['尺侧腕屈肌（尺骨头）', '屈腕、尺偏；覆盖保护尺神经近段'],
 'Humero-ulnar head of flexor digitorum superficialis': ['指浅屈肌（肱尺头）', '屈近侧指间关节与腕关节'],
 'Radial head of flexor digitorum superficialis': ['指浅屈肌（桡骨头）', '正中神经与尺动脉在其深面下行'],
 'Flexor digitorum profundus': ['指深屈肌', '屈远侧指间关节；前臂缺血性肌挛缩易受累'],
 'Flexor pollicis longus': ['拇长屈肌', '屈拇指末节；参与第一掌骨基底骨折远段牵拉'],
 'Extensor carpi radialis longus': ['桡侧腕长伸肌', '伸腕、桡偏；起自肱骨外上髁上方'],
 'Extensor carpi radialis brevis': ['桡侧腕短伸肌', '伸腕、桡偏；肱骨外髁骨折伸肌群牵拉成分'],
 'Extensor digitorum': ['指伸肌', '伸第2～5指与伸腕；起自肱骨外上髁'],
 'Extensor digiti minimi': ['小指伸肌', '伸小指与伸腕'],
 'Humeral head of extensor carpi ulnaris': ['尺侧腕伸肌（肱骨头）', '伸腕、尺偏'],
 'Ulnar head of extensor carpi ulnaris': ['尺侧腕伸肌（尺骨头）', '伸腕、尺偏'],
 'Abductor pollicis longus': ['拇长展肌', '外展拇指；第一掌骨基底骨折牵拉近端向外背侧'],
 'Extensor pollicis brevis': ['拇短伸肌', '伸拇指近节；与拇长展肌共同挤压盖氏骨折远端'],
 'Extensor pollicis longus': ['拇长伸肌', '伸拇指末节；经桡骨背侧结节易在远端骨折后卡压或断裂'],
 'Extensor indicis': ['示指伸肌', '单独伸示指'],
 'Abductor pollicis brevis': ['拇短展肌', '大鱼际肌，受正中神经返支支配'],
 'Opponens pollicis muscle': ['拇对掌肌', '大鱼际肌，正中神经受损时对掌功能丧失'],
 'Superficial head of flexor pollicis brevis': ['拇短屈肌（浅头）', '屈拇指近节，正中神经支配'],
 'Deep head of flexor pollicis brevis': ['拇短屈肌（深头）', '屈拇指近节，尺神经深支支配'],
 'Oblique head of adductor pollicis': ['拇收肌（斜头）', '内收拇指，牵拉第一掌骨骨折远段向内'],
 'Transverse head of adductor pollicis': ['拇收肌（横头）', '内收拇指，尺神经深支支配'],
 'Abductor digiti minimi of hand': ['小指展肌', '小鱼际肌，外展小指'],
 'Flexor digiti minimi of hand': ['小指短屈肌', '小鱼际肌，屈小指近节'],
 'Opponens digiti minimi muscle of hand': ['小指对掌肌', '小鱼际肌，使小指对掌'],
 'Dorsal interossei muscles of hand': ['手背侧骨间肌', '外展手指、屈掌指关节；掌指骨骨折致成角移位'],
 'Palmar interossei muscles': ['手掌侧骨间肌', '内收手指、屈掌指关节；牵拉掌骨头向掌侧屈转'],
 'Lumbrical muscles of hand': ['手蚓状肌', '屈掌指关节、伸指间关节；参与近节指骨向掌侧成角'],
 // Lower limb
 'Iliacus muscle': ['髂肌（髂腰肌部）', '强力屈髋；股骨干上1/3骨折牵拉近段屈曲外旋'],
 'Psoas major': ['腰大肌（髂腰肌部）', '止于小转子，股骨上段骨折牵拉近段屈曲外旋'],
 'Gluteus maximus muscle': ['臀大肌', '后伸、外旋髋关节，覆盖坐骨神经出口'],
 'Gluteus medius muscle': ['臀中肌', '止于大转子，股骨上段与反转子间骨折牵拉近段外展'],
 'Gluteus minimus muscle': ['臀小肌', '协同臀中肌使股骨近段外展'],
 'Tensor fasciae latae': ['阔筋膜张肌', '屈髋、外展大腿，紧张髂胫束'],
 'Iliotibial tract': ['髂胫束', '外侧稳定膝关节与大腿外侧筋膜张力带'],
 'Piriformis muscle': ['梨状肌', '外旋髋关节；坐骨神经多经其下缘穿出'],
 'Obturator internus': ['闭孔内肌', '深层外旋肌群，牵拉股骨近段外旋'],
 'Obturator externus': ['闭孔外肌', '外旋髋关节；闭孔脱位时紧邻股骨头与闭孔神经'],
 'Superior gemellus muscle': ['上孖肌', '深层外旋肌群，牵拉股骨近段外旋'],
 'Inferior gemellus muscle': ['下孖肌', '深层外旋肌群，牵拉股骨近段外旋'],
 'Quadratus femoris muscle': ['股方肌', '强力外旋股骨近段；紧邻旋股内侧动脉深支'],
 'Pectineus muscle': ['耻骨肌', '屈髋、内收大腿'],
 'Adductor longus': ['长收肌', '内收大腿；股骨干中上段骨折牵拉远段向内上方移位'],
 'Adductor brevis': ['短收肌', '内收大腿，参与股骨远段内收移位'],
 'Adductor magnus': ['大收肌', '强力内收大腿；收肌管裂孔为股血管移行腘血管处'],
 'Adductor minimus': ['小收肌', '大收肌上部，协助内收外旋大腿'],
 'Gracilis muscle': ['股薄肌', '内收大腿、屈膝内旋小腿'],
 'Sartorius muscle': ['缝匠肌', '屈髋屈膝外旋大腿，构成股三角外侧界'],
 'Rectus femoris muscle': ['股直肌（股四头肌）', '伸膝屈髋；强力收缩导致髌骨横形撕脱骨折上移'],
 'Vastus lateralis muscle': ['股外侧肌（股四头肌）', '伸膝；向外上牵拉髌骨，参与股骨远段重叠短缩'],
 'Vastus medialis muscle': ['股内侧肌（股四头肌）', '伸膝；下部斜行纤维防止髌骨向外脱位'],
 'Vastus intermedius muscle': ['股中间肌（股四头肌）', '紧贴股骨干前面，伸膝'],
 'Long head of biceps femoris': ['股二头肌（长头）', '伸髋屈膝；其肌腱内侧缘紧贴腓总神经'],
 'Short head of biceps femoris': ['股二头肌（短头）', '屈膝外旋小腿，参与大腿后群纵向短缩牵拉'],
 'Semitendinosus muscle': ['半腱肌', '伸髋屈膝内旋，大腿后侧屈肌群'],
 'Semimembranosus muscle': ['半膜肌', '伸髋屈膝内旋，构成腘窝上内界'],
 'Medial head of gastrocnemius': ['腓肠肌（内侧头）', '起自股骨内上髁；股骨下1/3及髁上骨折牵拉远端向后倾倒'],
 'Lateral head of gastrocnemius': ['腓肠肌（外侧头）', '起自股骨外上髁；牵拉股骨远端向后移位危及腘血管'],
 'Soleus muscle': ['比目鱼肌', '强力跖屈踝关节；腘动脉于其腱弓处分出胫前、胫后动脉'],
 'Calcaneal tendon': ['跟腱', '止于跟骨结节；强力收缩致跟骨结节撕脱骨折上移'],
 'Plantaris muscle': ['跖肌', '辅助跖屈与屈膝'],
 'Popliteus muscle': ['腘肌', '解锁屈膝；位于腘动脉深面紧贴胫骨近端后壁'],
 'Tibialis anterior muscle': ['胫骨前肌', '背伸、内翻足；腓总神经损伤时瘫痪出现足下垂'],
 'Tibialis posterior muscle': ['胫骨后肌', '跖屈、内翻足，维持足弓；紧贴胫骨后方深筋膜间室'],
 'Fibularis longus muscle': ['腓骨长肌', '外翻、跖屈足；腓总神经绕腓骨颈穿入此肌深面'],
 'Fibularis brevis muscle': ['腓骨短肌', '外翻足，止于第5跖骨粗隆（易致基底部撕脱）'],
 'Fibularis tertius muscle': ['第三腓骨肌', '背伸、外翻足'],
 'Extensor digitorum longus': ['趾长伸肌', '伸第2～5趾、背伸足'],
 'Tendon of extensor digitorum longus': ['趾长伸肌腱', '走行于足背，受腓深神经支配'],
 'Extensor hallucis longus': ['拇长伸肌', '伸拇趾、背伸足；紧邻足背动脉'],
 'Flexor digitorum longus': ['趾长屈肌', '跖屈足趾，经内踝后方跗管'],
 'Flexor hallucis longus': ['拇长屈肌', '屈拇趾，经距骨后结节沟，距骨后唇骨折邻近结构'],
 'Extensor digitorum brevis': ['趾短伸肌', '足背伸趾肌'],
 'Extensor hallucis brevis': ['拇短伸肌', '伸拇趾近节'],
 'Abductor hallucis': ['拇展肌', '外展拇趾，构成足内侧纵弓'],
 'Flexor digitorum brevis': ['趾短屈肌', '屈第2～5趾'],
 'Abductor digiti minimi of foot': ['小趾展肌', '外展小趾'],
 'Quadratus plantae muscle': ['足底方肌', '矫正趾长屈肌牵引方向'],
 'Lumbrical muscles of foot': ['足蚓状肌', '屈跖趾关节、伸趾间关节'],
 'Lateral head of flexor hallucis brevis': ['拇短屈肌（外侧头）', '经外侧籽骨止于拇趾近节'],
 'Medial head of flexor hallucis brevis': ['拇短屈肌（内侧头）', '经内侧籽骨止于拇趾近节'],
 'Oblique head of adductor hallucis': ['拇收肌（斜头）', '内收拇趾、维持足横弓'],
 'Transverse head of adductor hallucis': ['拇收肌（横头）', '维持足前横弓'],
 'Flexor digiti minimi of foot': ['小趾短屈肌', '屈小趾跖趾关节'],
 'Opponens digiti minimi muscle of foot': ['小趾对跖肌', '内收跖屈第5跖骨'],
 'Dorsal interossei muscles of foot': ['足背侧骨间肌', '外展足趾、稳定跖骨间'],
 'Plantar interossei muscles': ['足底骨间肌', '内收第3～5趾']
};

export const VESSEL_TERMS = {
 'subclavian artery': ['锁骨下动脉', '紧贴锁骨后下方走行，锁骨严重移位骨折易压迫或刺伤'],
 'subclavian vein': ['锁骨下静脉', '位于锁骨后内方，锁骨骨折移位可致损伤出血'],
 'Axillary artery': ['腋动脉', '经肩关节前内方与肱骨外科颈内侧，肩脱位与外科颈骨折高危血管'],
 'Axillary vein': ['腋静脉', '伴行腋动脉，肩前脱位与外科颈骨折易受压'],
 'Thoraco-acromial artery': ['胸肩峰动脉', '腋动脉分支，供应三角肌与胸大肌'],
 'Pectoral branches of thoraco-acromial artery': ['胸肩峰动脉胸肌支', '供应胸大、小肌'],
 'Suprascapular artery': ['肩胛上动脉', '经肩胛上切迹供应冈上、下肌'],
 'Suprascapular vein': ['肩胛上静脉', '伴行肩胛上动脉'],
 'Subscapular artery': ['肩胛下动脉', '腋动脉最大分支，参与肩胛动脉网'],
 'Subscapular vein': ['肩胛下静脉', '伴行肩胛下动脉'],
 'Circumflex scapular artery': ['旋肩胛动脉', '绕肩胛骨外侧缘参与侧支循环'],
 'Circumflex scapular vein': ['旋肩胛静脉', '伴行旋肩胛动脉'],
 'Anterior circumflex humeral artery': ['旋肱前动脉', '绕肱骨外科颈前方，发升支营养肱骨头'],
 'Anterior circumflex humeral vein': ['旋肱前静脉', '伴行旋肱前动脉'],
 'Posterior circumflex humeral artery': ['旋肱后动脉', '与腋神经伴行绕肱骨外科颈后方，外科颈骨折与肩脱位易伤'],
 'Posterior circumflex humeral vein': ['旋肱后静脉', '伴行旋肱后动脉'],
 'Brachial artery': ['肱动脉', '经上臂内侧至肘窝前，肱骨髁上伸直型骨折及肘脱位最易损伤致前臂缺血挛缩'],
 'Brachial veins': ['肱静脉', '伴行肱动脉深静脉'],
 'Deep brachial artery': ['肱深动脉', '与桡神经伴行经桡神经沟，肱骨干中下1/3骨折易伤'],
 'Superior ulnar collateral artery': ['尺侧上副动脉', '伴尺神经下行参与肘关节动脉网'],
 'Inferior ulnar collateral artery': ['尺侧下副动脉', '参与肘关节内侧侧支循环'],
 'Radial collateral artery': ['桡侧副动脉', '肱深动脉终支，参与肘外侧血运'],
 'Middle collateral artery': ['中副动脉', '肱深动脉终支，经肘后参与吻合网'],
 'Cephalic vein': ['头静脉', '上肢外侧浅静脉，行经三角肌胸大肌间沟'],
 'Basilic vein': ['贵要静脉', '上肢内侧浅静脉'],
 'Median cubital vein': ['肘正中静脉', '肘窝浅静脉吻合支'],
 'Median antebrachial vein': ['前臂正中静脉', '前臂掌侧浅静脉'],
 'Radial artery': ['桡动脉', '沿前臂桡侧下行至腕部，监测上肢骨折血运的关键搏动点'],
 'Radial veins': ['桡静脉', '伴行桡动脉'],
 'Ulnar artery': ['尺动脉', '沿前臂尺侧下行，供应手掌浅弓'],
 'Ulnar veins': ['尺静脉', '伴行尺动脉'],
 'Ulnar recurrent artery': ['尺侧返动脉', '参与肘关节内侧动脉网'],
 'Common interosseous artery': ['骨间总动脉', '尺动脉分支，紧贴尺桡骨间膜'],
 'Posterior interosseous artery': ['骨间后动脉', '行于前臂背侧肌群间'],
 'Recurrent interosseous artery': ['骨间返动脉', '参与肘后动脉吻合'],
 'Palmar carpal branch of radial artery': ['桡动脉腕掌支', '参与腕掌动脉网与舟骨血供'],
 'Dorsal carpal branch of ulnar artery': ['尺动脉腕背支', '参与腕背动脉网'],
 'Dorsal carpal anastomosis': ['腕背动脉网', '发出手舟骨与月骨背侧滋养支'],
 'Superficial palmar arch': ['掌浅弓', '手掌主要动脉吻合弓'],
 'Deep palmar arch': ['掌深弓', '紧贴掌骨基底掌侧'],
 'Superficial venous palmar arch': ['掌浅静脉弓', '手掌浅静脉回流'],
 'Deep venous palmar arch': ['掌深静脉弓', '伴行掌深弓'],
 'Palmar metacarpal arteries': ['掌心动脉', '行于掌骨间'],
 'Dorsal metacarpal arteries': ['掌背动脉', '行于手背掌骨间'],
 'Common palmar digital arteries': ['指掌侧总动脉', '发自掌浅弓'],
 'Proper palmar digital arteries': ['指掌侧固有动脉', '手指主要血供，指骨骨折与挤压伤需核查末梢血运'],
 'Dorsal digital arteries of hand': ['指背动脉', '手背指段动脉'],
 'Dorsal venous network of hand': ['手背静脉网', '手背主要浅静脉'],
 'Dorsal digital veins of hand': ['指背静脉', '手指背侧静脉'],
 'Palmar digital veins': ['指掌侧静脉', '手指掌侧静脉'],
 // Lower limb
 'External iliac artery': ['髂外动脉', '移行为股动脉，骨盆前环与髋前脱位近端大血管'],
 'External iliac vein': ['髂外静脉', '伴行髂外动脉'],
 'Superior gluteal artery': ['臀上动脉', '经梨状肌上孔穿出，骨盆后环骨折与重度髋脱位易伤'],
 'Superior gluteal veins': ['臀上静脉', '伴行臀上动脉'],
 'Inferior gluteal artery': ['臀下动脉', '参与髋关节囊吻合网与股骨头颈侧支血供'],
 'Inferior gluteal veins': ['臀下静脉', '伴行臀下动脉'],
 'Obturator artery': ['闭孔动脉', '发出圆韧带小动脉供应股骨头内下方；闭孔脱位邻近血管'],
 'Femoral artery': ['股动脉', '下肢主干动脉（第1类必须修复动脉）；髋前脱位与股骨干骨折重点评估'],
 'Femoral vein': ['股静脉', '伴行股动脉，股骨及髋部创伤易并发深静脉血栓或压迫'],
 'Deep femoral artery': ['股深动脉', '发出旋股内、外侧动脉与穿动脉，营养股骨与大腿肌群'],
 'Deep femoral vein': ['股深静脉', '伴行股深动脉'],
 'Medial circumflex femoral artery': ['旋股内侧动脉', '股骨头颈最主要血供来源！股骨颈囊内骨折移位极易破坏致股骨头缺血坏死'],
 'Medial circumflex femoral veins': ['旋股内侧静脉', '伴行旋股内侧动脉'],
 'Lateral circumflex femoral artery': ['旋股外侧动脉', '参与股骨颈基底部关节囊动脉环'],
 'Lateral circumflex femoral veins': ['旋股外侧静脉', '伴行旋股外侧动脉'],
 'Descending branch of lateral circumflex femoral artery': ['旋股外侧动脉降支', '下行供应股四头肌并参与膝关节网'],
 'Perforating femoral arteries': ['股深动脉穿动脉', '紧贴股骨干后方穿入，股骨干骨折出血的主要来源之一'],
 'Perforating veins': ['穿静脉', '伴行穿动脉'],
 'Great saphenous vein': ['大隐静脉', '下肢内侧主干浅静脉，经内踝前方上行'],
 'Small saphenous vein': ['小隐静脉', '小腿后侧浅静脉，经外踝后方上行注入腘静脉'],
 'Popliteal artery': ['腘动脉', '紧贴股骨下端与胫骨上端后方（第1类动脉）；股骨下1/3、髁上、膝脱位及胫骨上1/3骨折极高危！'],
 'Popliteal vein': ['腘静脉', '紧贴腘动脉后外侧，膝部骨折脱位常与腘动脉同时受压损伤'],
 'Superior medial genicular artery': ['膝上内侧动脉', '参与膝关节动脉网'],
 'Superior lateral genicular artery': ['膝上外侧动脉', '参与膝关节动脉网'],
 'Middle genicular artery': ['膝中动脉', '营养交叉韧带与滑膜'],
 'Inferior medial genicular artery': ['膝下内侧动脉', '紧贴胫骨内侧髁边缘'],
 'Inferior lateral genicular artery': ['膝下外侧动脉', '经外侧副韧带深面'],
 'Genicular veins': ['膝静脉', '膝关节周围静脉回流'],
 'Patellar anastomosis': ['髌网（膝关节动脉网）', '髌骨周围吻合动脉网'],
 'Anterior tibial artery': ['胫前动脉', '穿骨间膜上端至小腿前间室，胫骨上段骨折与前骨筋膜室综合征易受累'],
 'Anterior tibial veins': ['胫前静脉', '伴行胫前动脉'],
 'Posterior tibial artery': ['胫后动脉', '下行经内踝后方，检查下肢血运的重要搏动点'],
 'Posterior tibial veins': ['胫后静脉', '伴行胫后动脉'],
 'Fibular artery': ['腓动脉', '沿腓骨内后方下行，供应外侧及后方间室'],
 'Fibular veins': ['腓静脉', '伴行腓动脉'],
 'Dorsalis pedis artery': ['足背动脉', '胫前动脉延续，发关节支营养距骨颈且穿1-2跖骨间；距骨颈骨折与Lisfranc脱位重点检查搏动'],
 'Lateral tarsal artery': ['跗外侧动脉', '足背动脉分支，参与足背血运'],
 'Arcuate artery': ['弓状动脉', '位于跖骨基底背侧，跗跖关节脱位易受损'],
 'Deep plantar artery': ['足底深动脉', '自第1、2跖骨间穿至足底，Lisfranc脱位极易撕裂'],
 'Medial plantar artery': ['足底内侧动脉', '胫后动脉终支之一'],
 'Medial plantar veins': ['足底内侧静脉', '伴行足底内侧动脉'],
 'Superficial branch of medial plantar artery': ['足底内侧动脉浅支', '供应足内侧缘'],
 'Lateral plantar artery': ['足底外侧动脉', '参与构成足底弓'],
 'Lateral plantar veins': ['足底外侧静脉', '伴行足底外侧动脉'],
 'Plantar arch': ['足底动脉弓', '前足底主要血供吻合'],
 'Plantar venous arch': ['足底静脉弓', '足底深静脉回流'],
 'Calcaneal branches of posterior tibial artery': ['胫后动脉跟骨支', '营养跟骨内侧与足跟软组织'],
 'Calcaneal branches of fibular artery': ['腓动脉跟骨支', '营养跟骨外侧'],
 'Dorsal metatarsal arteries': ['跖背动脉', '行于跖骨间背侧'],
 'Dorsal metatarsal veins': ['跖背静脉', '伴行跖背动脉'],
 'Plantar metatarsal arteries': ['跖底动脉', '行于跖骨间跖侧'],
 'Plantar metatarsal veins': ['跖底静脉', '伴行跖底动脉'],
 'Perforating branches of plantar metatarsal arteries': ['跖底动脉穿支', '交通足背与足底血运'],
 'Common plantar digital arteries': ['趾底总动脉', '供应足趾血运'],
 'Proper plantar digital arteries': ['趾底固有动脉', '趾骨骨折需观察趾端血运'],
 'Dorsal digital arteries of foot': ['趾背动脉', '足趾背侧动脉'],
 'Dorsal digital veins of foot': ['趾背静脉', '足趾背侧静脉'],
 'Plantar digital veins': ['趾底静脉', '足趾跖侧静脉'],
 'Dorsal venous arch of foot': ['足背静脉弓', '足背浅静脉，汇入大小隐静脉'],
 'Intercapitular veins of foot': ['跖骨头间静脉', '交通足背与足底静脉']
};

export const NERVE_TERMS = {
 'Roots of brachial plexus': ['臂丛神经根（C5-T1）', '穿斜角肌间隙进入锁骨后方'],
 'Superior trunk of brachial plexus': ['臂丛上干', '锁骨骨折严重移位或肩部强力牵拉可受损'],
 'Middle trunk of brachial plexus': ['臂丛中干', '行经锁骨中1/3后方'],
 'Inferior trunk of brachial plexus': ['臂丛下干', '紧邻第1肋与锁骨下动脉'],
 'Anterior division of superior trunk of brachial plexus': ['臂丛上干前股', '参与外侧束构成'],
 'Anterior division of middle trunk of brachial plexus': ['臂丛中干前股', '参与外侧束构成'],
 'Anterior division of inferior trunk of brachial plexus': ['臂丛下干前股', '续为内侧束'],
 'Posterior division of superior trunk of brachial plexus': ['臂丛上干后股', '汇入后束'],
 'Posterior division of middle trunk of brachial plexus': ['臂丛中干后股', '汇入后束'],
 'Posterior division of inferior trunk of brachial plexus': ['臂丛下干后股', '汇入后束'],
 'Posterior cord of brachial plexus': ['臂丛后束', '分出腋神经与桡神经，肩脱位与锁骨骨折易受牵拉'],
 'Suprascapular nerve': ['肩胛上神经', '支配冈上、冈下肌，肩胛骨骨折可受损'],
 'Superior subscapular nerve': ['肩胛下上神经', '支配肩胛下肌上部'],
 'Inferior subscapular nerve': ['肩胛下下神经', '支配肩胛下肌下部与大圆肌'],
 'Lateral pectoral nerve': ['胸外侧神经', '支配胸大肌'],
 'Medial pectoral nerve': ['胸内侧神经', '支配胸小肌与胸大肌'],
 'Axillary nerve': ['腋神经', '紧绕肱骨外科颈后方入三角肌！肩前脱位与外科颈骨折最易伤→三角肌麻痹、肩外侧感觉减退'],
 'Muscular branches of axillary nerve': ['腋神经肌支', '支配三角肌与小圆肌'],
 'Superior lateral brachial cutaneous nerve': ['臂外侧上皮神经', '腋神经终支，支配三角肌区皮肤感觉（腋神经定位区）'],
 'Musculocutaneous nerve': ['肌皮神经', '穿喙肱肌支配肱二头肌与肱肌'],
 'Lateral antebrachial cutaneous nerve': ['前臂外侧皮神经', '肌皮神经终支，支配前臂桡侧感觉'],
 'Radial nerve': ['桡神经', '紧贴肱骨中下1/3后外侧桡神经沟！肱骨干骨折最易伤→垂腕、伸指障碍、虎口区麻木'],
 'Muscular branches of radial nerve': ['桡神经肌支', '支配肱三头肌与前臂伸肌群'],
 'Deep branch of radial nerve': ['桡神经深支', '绕桡骨颈穿旋后肌，桡骨头骨折与孟氏骨折最易挫伤'],
 'Posterior interosseous nerve of forearm': ['骨间后神经（桡神经深支延续）', '支配伸指伸拇肌，孟氏骨折脱位易伤致垂指而不垂腕'],
 'Superficial branch of radial nerve': ['桡神经浅支', '沿肱桡肌深面至虎口区，支配手背桡侧感觉'],
 'Inferior lateral brachial cutaneous nerve': ['臂外侧下皮神经', '桡神经皮支'],
 'Posterior antebrachial cutaneous nerve': ['前臂后皮神经', '桡神经皮支'],
 'Dorsal digital branches of radial nerve': ['桡神经指背支', '支配桡侧手背及近节指背感觉'],
 'Median nerve': ['正中神经', '经肘窝伴肱动脉下行入腕管；肱骨髁上伸直型骨折、月骨掌侧脱位易伤→猿手、桡侧三指半麻木'],
 'Muscular branches of median nerve': ['正中神经肌支', '支配前臂多数屈肌与大鱼际肌'],
 'Anterior interosseous nerve of forearm': ['骨间前神经', '正中神经纯运动支，肱骨髁上与前臂骨折可致拇示指末节屈曲障碍'],
 'Palmar branch of median nerve': ['正中神经掌支', '支配手掌桡侧感觉'],
 'Common palmar digital branches of median nerve': ['正中神经指掌侧总神经', '分出指掌侧固有神经'],
 'Proper palmar digital branches of median nerve': ['正中神经指掌侧固有神经', '支配桡侧三指半掌面感觉'],
 'Communicating branch of median nerve with ulnar nerve': ['正中神经与尺神经交通支', '手掌内感觉吻合支'],
 'Ulnar nerve': ['尺神经', '紧贴肱骨内上髁后方尺神经沟！内上髁Ⅲ/Ⅳ度骨折、肘外翻与肘脱位易伤→爪形手、环小指麻木'],
 'Muscular branches of ulnar nerve': ['尺神经肌支', '支配尺侧腕屈肌与指深屈肌尺侧半'],
 'Deep branch of ulnar nerve': ['尺神经深支', '支配骨间肌、第3-4蚓状肌与拇收肌，受损致爪形手与夹纸试验阳性'],
 'Superficial branch of ulnar nerve': ['尺神经浅支', '支配尺侧一指半掌面感觉'],
 'Palmar branch of ulnar nerve': ['尺神经掌支', '支配小鱼际近端皮肤感觉'],
 'Dorsal branch of ulnar nerve': ['尺神经手背支', '支配尺侧手背感觉'],
 'Common palmar digital branches of ulnar nerve': ['尺神经指掌侧总神经', '分出尺侧指固有神经'],
 'Proper palmar digital branches of ulnar nerve': ['尺神经指掌侧固有神经', '支配小指及环指尺侧感觉'],
 'Dorsal digital branches of ulnar nerve': ['尺神经指背支', '支配尺侧指背感觉'],
 'Medial brachial cutaneous nerve': ['臂内侧皮神经', '支配上臂内侧皮肤感觉'],
 'Medial antebrachial cutaneous nerve': ['前臂内侧皮神经', '支配前臂内侧皮肤感觉'],
 'Anterior branch of medial antebrachial cutaneous nerve': ['前臂内侧皮神经前支', '分布前臂前内侧'],
 'Posterior branch of medial antebrachial cutaneous nerve': ['前臂内侧皮神经后支', '分布前臂后内侧'],
 // Lower limb
 'Femoral nerve': ['股神经', '经腹股沟韧带下方至股动脉外侧，支配股四头肌；髋前脱位可受压'],
 'Anterior cutaneous branches of femoral nerve': ['股神经前皮支', '支配大腿前面皮肤感觉'],
 'Saphenous nerve': ['隐神经', '股神经终支，伴大隐静脉下行支配小腿及足内侧感觉'],
 'Infrapatellar branch of saphenous nerve': ['隐神经髌下支', '支配膝前内侧感觉'],
 'Medial crural cutaneous branches of saphenous nerve': ['隐神经小腿内侧皮支', '支配小腿内侧感觉'],
 'Lateral femoral cutaneous nerve': ['股外侧皮神经', '经髂前上棘内侧穿出，支配大腿外侧感觉'],
 'Obturator nerve': ['闭孔神经', '经闭孔支配大腿内收肌群；髋关节前脱位（闭孔型）压迫此神经致内收肌瘫痪'],
 'Anterior branch of obturator nerve': ['闭孔神经前支', '支配长、短收肌与股薄肌及大腿内侧皮肤'],
 'Posterior branch of obturator nerve': ['闭孔神经后支', '支配大收肌与闭孔外肌'],
 'Superior gluteal nerve': ['臀上神经', '支配臀中肌、臀小肌与阔筋膜张肌'],
 'Sciatic nerve': ['坐骨神经', '人体最粗大周围神经！髋后脱位与股骨下1/3/髁上骨折极易压迫或牵拉→足下垂及小腿足部感觉运动障碍'],
 'Posterior femoral cutaneous nerve': ['股后皮神经', '伴坐骨神经出梨状肌下孔'],
 'Anterior root of posterior femoral cutaneous nerve': ['股后皮神经前根', '参与构成股后皮神经'],
 'Posterior root of posterior femoral cutaneous nerve': ['股后皮神经后根', '参与构成股后皮神经'],
 'Nerve to piriformis muscle': ['梨状肌神经', '支配梨状肌'],
 'Nerve to quadratus femoris muscle': ['股方肌神经', '支配股方肌与下孖肌'],
 'Tibial nerve': ['胫神经', '坐骨神经主延续支，行经腘窝与内踝后方跗管；膝脱位与股骨髁上骨折可受损致足跖屈障碍'],
 'Common fibular nerve': ['腓总神经', '紧绕腓骨头颈外侧走行！腓骨上端、胫骨外侧平台骨折及膝内侧脱位极易伤→足下垂、足背感觉障碍'],
 'Deep fibular nerve': ['腓深神经', '行于小腿前间室伴胫前动脉，支配胫骨前肌与第1、2趾蹼感觉'],
 'Muscular branches of deep fibular nerve': ['腓深神经肌支', '支配小腿前群背伸肌'],
 'Dorsal digital branches of deep fibular nerve': ['腓深神经趾背支', '支配第1、2趾相邻背侧皮肤（腓深神经定位区）'],
 'Superficial fibular nerve': ['腓浅神经', '行于小腿外侧间室支配腓骨长短肌与足背大部皮肤'],
 'Dorsal digital branches of superficial fibular nerve': ['腓浅神经趾背支', '支配足背大部趾背感觉'],
 'Medial dorsal cutaneous nerve of foot': ['足背内侧皮神经', '腓浅神经终支'],
 'Intermediate dorsal cutaneous nerve of foot': ['足背中间皮神经', '腓浅神经终支'],
 'Sural nerve': ['腓肠神经', '行于外踝后方，跟骨外侧入路与踝部骨折需注意保护'],
 'Medial sural cutaneous nerve': ['腓肠内侧皮神经', '胫神经分支，参与构成腓肠神经'],
 'Sural communicating branch of common fibular nerve': ['腓肠交通支', '腓总神经分支，汇入腓肠神经'],
 'Medial plantar nerve': ['足底内侧神经', '胫神经终支，经跗管支配足底内侧'],
 'Lateral plantar nerve': ['足底外侧神经', '胫神经终支，支配足底外侧与足内在肌'],
 'Common plantar digital branches of medial plantar nerve': ['足底内侧神经趾底总神经', '分布于内侧足趾'],
 'Proper plantar digital branches of medial plantar nerve': ['足底内侧神经趾底固有神经', '分布于内侧足趾跖面'],
 'Common plantar digital branches of lateral plantar nerve': ['足底外侧神经趾底总神经', '分布于外侧足趾'],
 'Proper plantar digital branches of lateral plantar nerve': ['足底外侧神经趾底固有神经', '分布于外侧足趾跖面']
};

export function normalizeStructureKey(rawName) {
 return rawName
  .replace(/\.[lr]$/i, '')
  .replace(/^(?:Left|Right)\s+/i, '')
  .replace(/^\((.+)\)$/, '$1')
  .trim();
}

export function sideLabel(rawName) {
 if (/\.l$|\bleft\b/i.test(rawName)) return '左';
 if (/\.r$|\bright\b/i.test(rawName)) return '右';
 return '';
}

export function vesselSublayer(rawName) {
 return /\b(?:vein|veins|venous|vena|sinus)\b/i.test(rawName) ? 'veins' : 'arteries';
}

export function structureKind(layer, name) {
 if (layer === 'vessels' && /\bsinus\b|basilar venous plexus/i.test(name)) return 'venous-sinus';
 if (layer === 'nerves') {
  if (/spinal dura/i.test(name)) return 'meningeal-reference';
  if (/of spinal cord|medulla oblongata/i.test(name)) return 'central-reference';
  if (/gangli/i.test(name)) return 'ganglion-group';
  if (/cauda equina|root of spinal nerve|intercostal nerves|sympathetic nerves/i.test(name)) return 'nerve-group';
  if (/\([ivx]+\)|cochlear|vestibular|optic|chorda tympani|trigeminal|mandibular nerve|ophthalmic nerve|maxillary nerve|buccal nerve|inferior alveolar nerve|lingual nerve|mental nerve|nerve to mylohyoid/i.test(name)) return 'cranial-nerve';
 }
 return layer === 'vessels' ? vesselSublayer(name) : layer;
}

export function softTissueInfo(layer, rawName) {
 const base = normalizeStructureKey(rawName);
 const side = sideLabel(rawName);
 const table = layer === 'muscles' ? MUSCLE_TERMS : layer === 'vessels' ? VESSEL_TERMS : NERVE_TERMS;
 const axial = axialTerms?.[layer]?.[base.toLowerCase()];
 const entry = axial || table[base] || table[base.toLowerCase()];
 const zhBase = entry ? entry[0] : base;
 const note = entry ? entry[1] : '';
 const sublayer = layer === 'vessels' ? vesselSublayer(rawName) : layer;
 const depth = layer === 'muscles' ? muscleDepth(base) : 3;
 const caliber = axial ? {offsetM: 0, refMm: ''} : anatomicalCaliber(layer, base);
 return {
  key: rawName,
  base,
  side,
  zh: side ? side + zhBase : zhBase,
  zhBase,
  en: base,
  layer,
  sublayer,
  kind: structureKind(layer, rawName),
  depth,
  caliber,
  note,
  translated: Boolean(entry)
 };
}

// True anatomical muscle depth layers (1 = 浅层肌 Superficial, 2 = 中层肌 Intermediate, 3 = 深层肌 Deep)
// Enables peeling superficial thick limb muscles (e.g. gluteus maximus, rectus femoris, gastrocnemius, deltoid)
// to clearly inspect deep circumflex femoral vessels, obturator nerve, sciatic nerve, and posterior tibial bundle.
export const DEPTH_LABELS = { 1: '浅层肌', 2: '中层肌', 3: '深层肌' };

const SUPERFICIAL_RE = /deltoid|pectoralis major|trapezius|latissimus dorsi|sternocleidomastoid|biceps brachii|long head of triceps|lateral head of triceps|brachioradialis|pronator teres|flexor carpi|palmaris longus|extensor digitorum(?! brevis)|extensor digiti minimi|extensor carpi ulnaris|abductor pollicis brevis|abductor digiti minimi|gluteus maximus|tensor fasciae latae|iliotibial|sartorius|rectus femoris|gracilis|adductor longus|long head of biceps femoris|semitendinosus|gastrocnemius|calcaneal tendon|plantaris|tibialis anterior|fibularis longus|abductor hallucis|flexor digitorum brevis/i;
const DEEP_RE = /subclavius|supraspinatus|infraspinatus|subscapularis|teres minor|supinator|flexor digitorum profundus|flexor pollicis longus|pronator quadratus|abductor pollicis longus|extensor pollicis|extensor indicis|interossei|lumbrical|opponens|adductor pollicis|deep head of flexor pollicis|gluteus minimus|piriformis|obturator|gemellus|quadratus femoris|iliacus|psoas major|vastus intermedius|adductor magnus|adductor minimus|popliteus|tibialis posterior|flexor digitorum longus|flexor hallucis longus|quadratus plantae|adductor hallucis|flexor hallucis brevis|opponens digiti minimi|extensor digitorum brevis|extensor hallucis brevis/i;

export function muscleDepth(baseName) {
 if (DEEP_RE.test(baseName)) return 3;
 if (SUPERFICIAL_RE.test(baseName)) return 1;
 return 2;
}

// Anatomical caliber calibration (metres radial offset along vertex normals) grounded in direct
// Draco mesh cross-section measurements vs adult male Gray's Anatomy / ultrasound reference diameters.
export function anatomicalCaliber(layer, baseName) {
 if (layer === 'muscles') return { offsetM: 0, refMm: '' };
 if (layer === 'nerves') {
  if (/^Sciatic nerve$/i.test(baseName)) return { offsetM: 0, refMm: '约 10–14 mm（人体最粗大神经）' };
  if (/^Tibial nerve$/i.test(baseName)) return { offsetM: 0.00125, refMm: '约 4.5–5.5 mm' };
  if (/^Common fibular nerve$/i.test(baseName)) return { offsetM: 0.00090, refMm: '约 3.2–4.2 mm' };
  if (/^Femoral nerve$/i.test(baseName)) return { offsetM: 0.00065, refMm: '约 6–8 mm（近端）' };
  if (/^Obturator nerve$/i.test(baseName)) return { offsetM: 0.00035, refMm: '约 2.5–3.5 mm' };
  if (/^Median nerve$/i.test(baseName)) return { offsetM: 0.00045, refMm: '约 3.5–4.5 mm' };
  if (/^Radial nerve$/i.test(baseName)) return { offsetM: 0.00045, refMm: '约 3.5–4.5 mm' };
  if (/^Ulnar nerve$/i.test(baseName)) return { offsetM: 0.00040, refMm: '约 3.0–3.5 mm' };
  if (/^Axillary nerve$/i.test(baseName)) return { offsetM: 0.00035, refMm: '约 3.0–3.5 mm' };
  if (/^Musculocutaneous nerve$/i.test(baseName)) return { offsetM: 0.00030, refMm: '约 3.0 mm' };
  if (/brachial plexus/i.test(baseName)) return { offsetM: 0.00030, refMm: '约 4–6 mm' };
  if (/interosseous|deep branch|superficial branch|deep fibular|superficial fibular|plantar nerve|sural|saphenous/i.test(baseName)) {
   return { offsetM: 0.00018, refMm: '约 1.5–2.5 mm' };
  }
  return { offsetM: 0, refMm: '约 1.0–2.0 mm' };
 }
 // Vessels: Z-Anatomy main arterial trunks are already ~1:1 adult male scale; gently slim slightly oversized posterior tibial
 if (/^Femoral artery$/i.test(baseName)) return { offsetM: -0.00035, refMm: '约 8.5–9.5 mm' };
 if (/^Femoral vein$/i.test(baseName)) return { offsetM: -0.00030, refMm: '约 9.5–11 mm' };
 if (/^Popliteal artery$/i.test(baseName)) return { offsetM: -0.00025, refMm: '约 6.0–7.0 mm' };
 if (/^Posterior tibial artery$/i.test(baseName)) return { offsetM: -0.00045, refMm: '约 3.0–3.5 mm' };
 if (/^Anterior tibial artery$/i.test(baseName)) return { offsetM: -0.00015, refMm: '约 2.5–3.0 mm' };
 if (/^Brachial artery$/i.test(baseName)) return { offsetM: 0, refMm: '约 4.5–5.5 mm' };
 if (/^Axillary artery$/i.test(baseName)) return { offsetM: 0, refMm: '约 6.0–7.0 mm' };
 if (/^Deep femoral artery$/i.test(baseName)) return { offsetM: 0, refMm: '约 4.5–5.0 mm' };
 if (/^Medial circumflex femoral artery$/i.test(baseName)) return { offsetM: 0, refMm: '约 2.0–2.5 mm' };
 if (/^Radial artery$|^Ulnar artery$/i.test(baseName)) return { offsetM: 0, refMm: '约 2.5–3.0 mm' };
 if (/^Dorsalis pedis artery$/i.test(baseName)) return { offsetM: 0, refMm: '约 2.0–2.5 mm' };
 return { offsetM: 0, refMm: '' };
}

export function isLimbBone(boneName) {
 if (!boneName) return false;
 return /clavicle|scapula|humerus|radius|ulna|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|phalanx.*finger|thumb|hip bone|femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|phalanx.*toe|sesamoid.*foot/i.test(boneName);
}

export function isAxialTissueCase(boneName, courseId = '') {
 return Boolean(boneName && (!isLimbBone(boneName) || /^(pelvis|region-iliac-wing|tmj-dislocation)$/.test(courseId)));
}

export function isSoftTissueSupported(boneName) {
 return zonesForBone(boneName).length > 0;
}

export function zonesForBone(boneName, courseId = '', variantKey = '') {
 if (!boneName) return [];
 const b = boneName.toLowerCase();
 if(courseId==='hip-dislocation'&&variantKey==='v03')return ['pelvis','hip-thigh'];
 if(courseId==='shoulder-dislocation'&&variantKey==='v06')return ['shoulder-arm','chest','neck'];
 if(courseId==='physis-injury'&&/tibia/.test(b))return ['knee-leg','ankle-foot'];
 if (/clavicle|scapula/.test(b)) return ['shoulder-arm'];
 if (/humerus/.test(b)) {
  if (['elbow', 'elbow-dislocation', 'lateral-elbow', 'medial-elbow'].includes(courseId)) return ['elbow-forearm', 'shoulder-arm'];
  if (['shoulder', 'shoulder-dislocation'].includes(courseId)) return ['shoulder-arm'];
  return ['shoulder-arm', 'elbow-forearm'];
 }
 if (/radius|ulna/.test(b)) {
  if (['radius', 'galeazzi'].includes(courseId)) return ['elbow-forearm', 'wrist-hand'];
  return ['elbow-forearm'];
 }
 if (/scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|finger|thumb/.test(b)) {
  return ['wrist-hand', 'elbow-forearm'];
 }
 if (/hip bone/.test(b)) return courseId === 'hip-dislocation' ? ['hip-thigh'] : ['pelvis', 'hip-thigh'];
 if (/femur/.test(b)) {
  if (['neck', 'trochanter', 'hip-dislocation'].includes(courseId)) return ['hip-thigh'];
  if (['distalfemur', 'intercondylar', 'knee-dislocation', 'patella-dislocation'].includes(courseId)) return ['hip-thigh', 'knee-leg'];
  return ['hip-thigh', 'knee-leg'];
 }
 if (/patella/.test(b)) return ['knee-leg', 'hip-thigh'];
 if (/tibia|fibula/.test(b)) {
  if (['ankle'].includes(courseId)) return ['knee-leg', 'ankle-foot'];
  if (['plateau', 'knee-dislocation'].includes(courseId)) return ['knee-leg', 'hip-thigh'];
  return ['knee-leg'];
 }
 if (/talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|toe|sesamoid/.test(b)) {
  return ['ankle-foot', 'knee-leg'];
 }
 if (/mandible|temporal bone|palatine/.test(b)) return ['face', 'neck'];
 if (/occipital/.test(b)) return ['face', 'neck'];
 if (/frontal|parietal|ethmoid|sphenoid|zygoma|maxilla|palatine|nasal|vomer/.test(b)) return ['face'];
 if (/hyoid|^atlas$|^axis$/.test(b)) return ['neck', 'face', 'back'];
 if (/cervical vertebra/.test(b)) return ['neck', 'back', 'shoulder-arm'];
 if (/\bfirst rib\b/.test(b)) return ['chest', 'neck', 'shoulder-arm'];
 if (/\b(?:second|third) rib\b/.test(b)) return ['chest', 'neck', 'shoulder-arm', 'back'];
 if (/\b(?:tenth|eleventh|twelfth) rib\b/.test(b)) return ['chest', 'back', 'pelvis'];
 if (/\brib\b/.test(b)) return ['chest', 'back', 'shoulder-arm'];
 if (/manubrium/.test(b)) return ['chest', 'neck', 'shoulder-arm'];
 if (/sternum/.test(b)) return ['chest', 'shoulder-arm'];
 if (/xiphoid/.test(b)) return ['chest', 'pelvis'];
 if (/thoracic vertebra/.test(b)) return ['back', 'chest', 'neck', 'pelvis'];
 if (/lumbar vertebra/.test(b)) return ['back', 'pelvis', 'hip-thigh'];
 if (/sacrum|coccyx/.test(b)) return ['pelvis', 'hip-thigh', 'back'];
 return [];
}

export function boneSide(bone) {
 return /\bleft\b/i.test(bone) ? 'left' : /\bright\b/i.test(bone) ? 'right' : 'midline';
}

export function resolveAnatomy(bone, courseId = '', variantKey = '', meshId = '') {
 const component = ({FJ3266: 'medial', FJ3270: 'lateral', FJ3372: 'medial', FJ3376: 'lateral'})[meshId || bone?.match(/FJ\d+$/)?.[0]];
 const side = boneSide(bone);
 const injurySide = courseId==='tmj-dislocation'&&variantKey==='v02'?'right':courseId === 'tmj-dislocation' || courseId === 'pelvis' ? 'bilateral'
  : courseId === 'region-mandible' && variantKey === 'v02' || courseId === 'region-hyoid' ? 'right' : side;
 return {bone, meshId, courseId, variantKey, side, injurySide, component, zones: zonesForBone(bone, courseId, variantKey),
  axial: isAxialTissueCase(bone, courseId)};
}
