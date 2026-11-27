import {courses} from './courses.js';
import {joints} from './joints.js';
import {canonicalCourse} from './variant-registry.js';

const muscle=(pattern,label,action)=>({pattern,label,action,detail:action,layer:'muscles',role:'deforming',group:'joint'});
const risk=(layer,pattern,label,mechanism,sign,severity='medium')=>({layer,pattern,label,mechanism,sign,severity,role:'risk'});
const artery=(...args)=>risk('vessels',...args);
const nerve=(...args)=>risk('nerves',...args);
const brachial=artery(/^Brachial artery/i,'肱动脉','肘前方的骨端移位可改变血管间隙。','比较远端脉搏和手部灌注。','high');
const median=nerve(/^Median nerve/i,'正中神经','观察受累间隙与正中神经走行。','检查正中神经感觉及运动分布。');
const radial=nerve(/Deep branch of radial nerve/i,'桡神经深支','桡骨头颈附近的移位可影响旋后肌内神经通道。','检查伸指功能。');
const ulnar=nerve(/^Ulnar nerve/i,'尺神经','肘内侧错位可能牵张后方尺神经。','检查小指感觉和手内在肌功能。');
const kneeV=artery(/^Popliteal artery|^Popliteal vein/i,'腘血管','股骨髁与胫骨平台失对合可牵张腘窝血管。','检查膝下灌注和足部脉搏。','high');
const kneeN=nerve(/Common (?:fibular|peroneal) nerve/i,'腓总神经','旋转和侧移可牵张腓骨颈附近的神经。','检查足背伸、外翻和足背感觉。');
const femoralV=artery(/^Femoral (artery|vein)/i,'股动静脉','耻骨部脱位的股骨头靠近腹股沟下的股血管。','核对足部灌注与股三角区占位。','high');
const pelvicV=artery(/^(Internal iliac|Obturator) (artery|vein)/i,'盆腔髂内及闭孔血管','臼底骨块内移时，要留意盆腔内侧软组织。','结合盆腔损伤评估出血风险。','high');
const obturatorN=nerve(/^Obturator nerve|^Anterior branch of obturator nerve/i,'闭孔神经','闭孔前方的股骨头与闭孔神经通道毗邻。','检查大腿内侧感觉和内收功能。');
const hipHeadV=artery(/^Medial circumflex femoral artery/i,'旋股内侧动脉','转子及囊内骨面附近有股骨头血供分支。','以骨折部位和对位评估供血风险。');
const axillaryV=artery(/^Axillary artery/i,'腋动脉','盂前下方和腋窝的移位会改变与血管的间距。','检查移位前后上肢灌注。','high');
const axillaryN=nerve(/^Axillary nerve/i,'腋神经','肱骨头移位可牵张跨外科颈的腋神经。','检查三角肌功能及肩外侧皮肤感觉。');
const wristN=nerve(/^Median nerve/i,'腕管内正中神经','月骨掌侧转位或桡骨远段移位可影响腕管间隙。','核对桡侧手指感觉和拇对掌。');
const handV=artery(/Proper palmar digital arteries/i,'指固有动脉','指骨折端或关节错位临近指侧神经血管束。','检查指端再充盈。');
const handN=nerve(/Proper palmar digital branches of median nerve/i,'掌侧指固有神经','指侧移位时关注指固有神经张力。','比较指尖两侧感觉。');
const footV=artery(/^Dorsalis pedis artery|^Deep plantar artery/i,'足背动脉及穿支','跗跖及距骨错位可改变足背血管间隙。','核对足背脉搏与趾端灌注。');
const footN=nerve(/^Deep fibular nerve|^Deep peroneal nerve|^Tibial nerve/i,'足部神经','踝足错位的前后方向影响邻近神经通道。','检查足背第一趾蹼和足底感觉。');
const toeV=artery(/Proper plantar digital arteries/i,'趾底固有动脉','趾间侧移可牵张趾侧血管束。','核对趾尖再充盈。');
const ribV=artery(/Posterior intercostal arteries/i,'肋间后动脉','沿肋下缘走行，连续两处断线附近均需观察。','结合胸壁损伤和胸腔出血评价。');
const ribN=nerve(/^Intercostal nerves/i,'肋间神经组','观察骨折断端与肋下缘的邻近关系。','检查沿肋间走向的疼痛分布。');
const spineV=artery(/^Lumbar arteries|^Anterior spinal artery/i,'腰动脉及椎管血管参照','区分椎旁血管区与椎管轮廓。','结合椎体移位与神经检查判读。');
const spineN=nerve(/Cauda equina|Lumbar spinal nerve/i,'椎管神经参照','后壁骨片或椎骨错位改变了椎管空间。','观察双下肢及鞍区感觉和运动情况。','high');
const tmjN=nerve(/^Trigeminal nerve|^Inferior alveolar nerve/i,'三叉神经及下牙槽神经参照','观察下颌神经分布区域与颞下颌关节的关系。','比较两侧关节区症状。');
const tmjV=artery(/Superficial temporal artery|^Maxillary artery/i,'颞浅及上颌动脉','在关节前后及内侧作为血管位置参照。','辨认患侧髁突与邻近骨面。');

const elbowM=muscle(/Brachialis|triceps brachii/i,'肘周屈伸肌','观察肱肌和肱三头肌相对前移或后移的骨块。');
const pronation=muscle(/pronator teres|^Supinator/i,'旋前、旋后肌','比较桡骨头周围肌群与尺桡骨不同的姿态。');
const wristM=muscle(/pronator quadratus|flexor digitorum/i,'旋前方肌与指屈肌','观察前臂远段和掌侧肌群与骨端的相对位置。');
const digitalM=muscle(/Extensor indicis|Lumbrical muscles of hand/i,'指伸肌及蚓状肌','对照骨端角度与指伸机制。');
const cuff=muscle(/Subscapularis|Supraspinatus|deltoid/i,'肩袖及三角肌','以肩袖附着与肱骨头的位置为参照。');
const pelvicM=muscle(/Iliacus|Obturator internus/i,'髂肌及闭孔内肌','观察髋臼内侧与盆腔壁肌的空间关系。');
const hipM=muscle(/Gluteus medius|Iliacus/i,'臀中肌及髂肌','以大、小转子附着区辨认髋部力线。');
const quad=muscle(/Rectus femoris|Vastus medialis|Vastus lateralis/i,'股四头肌','观察伸膝力线、髌骨上下极及肌腱的关系。');
const footM=muscle(/Fibularis longus|Tibialis posterior|Flexor hallucis longus/i,'踝足跨关节肌','比较移位前后足弓及肌腱走行。');
const toeM=muscle(/Flexor hallucis longus|Extensor hallucis longus/i,'拇长屈肌与拇长伸肌','以末节相对屈伸肌腱的改变说明局部受力。');

const templates={
 clavicle:[muscle(/Sternocleidomastoid|deltoid/i,'胸锁乳突肌与三角肌','对照锁骨中段两侧附着。'),
  artery(/subclavian artery/i,'锁骨下动脉','血管经过锁骨深面。','核对锁骨下邻近区。'),
  nerve(/Roots of brachial plexus/i,'臂丛','锁骨深面的臂丛与骨端邻近。','检查上肢运动感觉。')],
 supracondylar:[elbowM,brachial,median],
 'lateral-elbow':[muscle(/Extensor carpi radialis|^Extensor digitorum/i,'共同伸肌区','骨块翻转可改变伸肌起始附着的方向。'),brachial,radial],
 olecranon:[muscle(/triceps brachii/i,'肱三头肌','以鹰嘴附着解释向近端撕脱。'),brachial,ulnar],
 'radial-head':[pronation,artery(/Recurrent interosseous artery/i,'骨间返动脉','在桡骨头颈邻近区作血管参照。','比较肘外侧位置。'),radial],
 forearm:[pronation,artery(/^Common interosseous artery/i,'骨间总动脉','在两骨之间观察骨间组织相对走行。','核对前臂和手部灌注。'),median],
 galeazzi:[wristM,artery(/^Ulnar artery/i,'尺动脉','与下尺桡关节掌侧结构毗邻。','核对远端循环。'),wristN],
 'distal-radius':[wristM,artery(/^Radial artery/i,'桡动脉','桡骨远端为局部参照。','比较腕部血管和远端循环。'),wristN],
 metacarpal:[muscle(/interossei muscles of hand|Lumbrical muscles of hand/i,'骨间肌与蚓状肌','对照多根掌骨的屈伸和掌弓。'),handV,handN],
 finger:[digitalM,handV,handN], mallet:[digitalM,handV,handN],
 neck:[hipM,hipHeadV,obturatorN],trochanter:[hipM,hipHeadV,obturatorN],
 femur:[hipM,femoralV,nerve(/^Sciatic nerve/i,'坐骨神经','股骨干后方软组织可随成角受牵张。','核对足踝运动感觉。')],
 tibia:[muscle(/Tibialis anterior|Soleus muscle/i,'胫前肌与比目鱼肌','辨认胫骨前后筋膜室。'),kneeV,kneeN],
 patella:[quad,kneeV,kneeN], ankle:[footM,footV,footN], talus:[footM,footV,footN],
 calcaneus:[footM,footV,footN],
 sustentaculum:[muscle(/^Flexor hallucis longus/i,'拇长屈肌','肌腱通过载距突下方。'),footV,footN],
 metatarsal:[muscle(/interossei muscles of foot/i,'足骨间肌','以相邻跖骨作为足弓及负荷参照。'),footV,footN],
 rib:[muscle(/^(External|Internal) intercostal muscles/i,'肋间肌','比较肋间肌与断线之间的肌间隙。'),ribV,ribN],
 spine:[muscle(/Multifidus lumborum|Quadratus lumborum/i,'腰多裂肌与腰方肌','在后弓和横突周围观察肌附着。'),spineV,spineN],
 pelvis:[pelvicM,pelvicV,obturatorN],
 asis:[muscle(/^Sartorius muscle/i,'缝匠肌','肌起点随髂前上棘撕脱片移位。'),pelvicV,obturatorN],
 aiis:[muscle(/^Rectus femoris muscle/i,'股直肌','直头起点位于髂前下棘。'),pelvicV,obturatorN],
 ischial:[muscle(/Semimembranosus|Long head of biceps femoris/i,'腘绳肌','以坐骨结节附着区辨认牵拉方向。'),pelvicV,obturatorN],
 'physis-shoulder':[cuff,axillaryV,axillaryN],
 'physis-ankle':[footM,footV,footN],
 'hip-central':[pelvicM,pelvicV,obturatorN],
 'hip-pubic':[hipM,femoralV,nerve(/^Femoral nerve/i,'股神经','头部位于耻骨上支前方时观察股三角。','检查膝伸和大腿前侧感觉。')],
 'hip-obturator':[muscle(/Obturator externus|Adductor longus/i,'闭孔外肌及内收长肌','以闭孔缘和大腿内侧为定位参照。'),
  artery(/^Obturator artery/i,'闭孔动脉','与神经伴行通过闭孔管。','观察内下移位和盆前内侧的关系。'),obturatorN],
 knee:[quad,kneeV,kneeN],
 'tmj-unilateral':[muscle(/Lateral pterygoid|masseter/i,'翼外肌及咬肌','以患侧关节运动与健侧保留接触作对照。'),tmjV,tmjN],
 'shoulder-anterior':[cuff,axillaryV,axillaryN],
 'shoulder-inferior':[cuff,axillaryV,axillaryN],
 'shoulder-clavicular':[cuff,artery(/subclavian artery|^Axillary artery/i,'锁骨下及腋动脉','内上移位邻近锁骨下方血管。','比较双侧上肢灌注。','high'),
  nerve(/trunk of brachial plexus/i,'臂丛神经干','向锁骨下的移位可缩小臂丛空间。','检查跨多个神经区的感觉与运动。')],
 'shoulder-thoracic':[muscle(/Pectoralis minor|intercostal muscles/i,'胸小肌及肋间肌','对照胸壁与进入胸腔的骨端。'),ribV,
  nerve(/trunk of brachial plexus/i,'臂丛神经干','肩带大幅内移可牵拉臂丛。','核对上肢神经功能。','high')],
 'elbow-medial':[elbowM,brachial,ulnar],
 'elbow-divergent':[pronation,brachial,radial,median],
 'elbow-fracture':[elbowM,brachial,ulnar,median,radial],
 pulled:[pronation,artery(/Recurrent interosseous artery/i,'骨间返动脉','作为肘外侧成人骨性底图的邻近结构。','对应肱桡关节外侧区。'),radial],
 'lunate-ligament':[wristM,artery(/^Radial artery/i,'桡动脉','桡侧用于定位掌背方向。','比较转位及保留掌侧韧带的关系。'),wristN],
 'lunate-torsion':[wristM,artery(/^Radial artery/i,'桡侧血管参照','可定位腕周血管方向，月骨内微细血供通过风险文字提示。','结合掌侧韧带扭曲评估月骨血运。'),wristN],
 'pip-ulnar':[digitalM,handV,handN],
 'patella-high':[quad,kneeV,kneeN], 'patella-low':[quad,kneeV,kneeN],
 'patella-medial':[quad,kneeV,kneeN],'patella-habitual':[quad,kneeV,kneeN],
 lisfranc:[footM,footV,footN], 'toe-side':[toeM,toeV,footN]
};

const byVariant=new Map([...courses,...joints].map(canonicalCourse).flatMap(course=>
 course.variants.filter(v=>v.textbook).map(v=>[course.id+'/'+v.id,v])));

export function textbookTissueProfile(courseId,variantId){
 const variant=byVariant.get(courseId+'/'+variantId);
 if(!variant)return null;
 const [attachment,...risks]=templates[variant.textbook.clinical];
 return {
  variantId,summary:variant.name+' · '+variant.textbook.points[0],
  deforming:[attachment],risks,reference:variant.source
 };
}
