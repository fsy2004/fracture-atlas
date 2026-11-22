// Chapter titles refer to the supplied 14th Five-Year Plan edition of 中医骨伤科学.
// A supplement pairs a textbook comparison with a separately authored regional example.
const chapter = {
  general: '第六章第一节 · 骨折概论',
  upperNeck: '第三章第五节 · 影像学检查',
  ribs: '第六章第四节 · 肋骨骨折',
  spine: '第六章第四节 · 脊柱骨折',
  pelvis: '第六章第四节 · 骨盆骨折',
  fingers: '第六章第二节 · 指骨骨折',
  palm: '第六章第二节 · 掌骨骨折',
  toes: '第六章第三节 · 趾骨骨折',
  foot: '第六章第三节 · 跖骨骨折',
  tmj: '第七章第二节 · 颞下颌关节脱位',
  tmt: '第七章第四节 · 跗跖关节脱位',
};
const upperJoint = title => '第七章第三节 · ' + title;
const lowerJoint = title => '第七章第四节 · ' + title;
const note = (locator, supplement, ...points) => ({locator, supplement, points});
const text = (locator, ...points) => note(locator, false, ...points);
const extra = (locator, principle, focus) => note(locator, true, principle, '本例' + focus);

const elbow = upperJoint('肘关节脱位');
const shoulder = upperJoint('肩关节脱位');
const wrist = upperJoint('月骨脱位');
const hip = lowerJoint('髋关节脱位');
const knee = lowerJoint('膝关节脱位');
const fingerJoint = upperJoint('掌指关节及指间关节脱位');
const toeJoint = lowerJoint('跖趾关节及趾间关节脱位');

const joints = {
  'shoulder-dislocation': [
    text(shoulder, '肱骨头向前离开肩胛盂。按肱骨头最后停留的位置可分喙突下、盂下等类型。', '从侧面认清肩胛盂前缘，再看肱骨头前移时伴随的下移。'),
    text(shoulder, '后脱位时，肱骨头位于肩胛盂后方。正面看两者仍可能重叠。', '把盂面转到接近侧位，比较肱骨头中心与盂后缘的位置。'),
  ],
  'elbow-dislocation': [
    text(elbow, '后脱位按尺桡骨近端命名，尺骨鹰嘴与桡骨头一起移到肱骨远端后方。', '从背侧看，鹰嘴尖与肱骨内、外上髁原有的三点关系改变。'),
    text(elbow, '侧方脱位时，尺桡骨近端向肱骨远端的一侧移出。', '从正面同时跟踪滑车和尺骨滑车切迹，本例向外侧错开。'),
    text(elbow, '肘尖受力时可伴鹰嘴骨折，尺骨近端与桡骨头移到肱骨远端前方。', '侧面最易辨认前移。本例显示前臂骨的整体运动，鹰嘴骨折片未单独模拟。'),
  ],
  'hip-dislocation': [
    text(hip, '股骨头向臼后脱出。典型伤肢呈屈曲、内收、内旋，可见短缩。', '从侧面定位臼后缘，再转向正面看股骨干的内收和旋转。'),
    text(hip, '髋外展、外旋时，股骨头可移出髋臼前下方。本例显示这一路径。', '以前方骨盆标志定位，股骨头停在耻骨支水平或闭孔附近，可进一步区分。'),
  ],
  'tmj-dislocation': [
    text(chapter.tmj, '两侧髁突向前越过颞骨关节结节，下颌整体前突、下垂。', '侧面看髁突离开下颌窝，正面看下颌中线。单侧前脱位时颏部常偏向健侧。'),
  ],
  'lunate-dislocation': [
    text(wrist, '月骨可向掌侧翻转并移位，远侧凹面随之转向掌侧。', '从桡侧看月骨的凹面转向掌侧，头状骨与月骨原有的嵌合关系消失。'),
    extra(wrist, '月骨掌侧脱位可用凹面转向和桡月失去对合来识别。', '为月骨周围背侧脱位。月骨仍对着桡骨，头状骨随远排腕骨向背侧移出。'),
  ],
  'mcp-dislocation': [
    text(fingerJoint, '掌指关节过伸时容易发生背侧脱位，拇指较常见。', '侧看拇指近节基底越过第一掌骨头，掌骨头相对突出于掌侧。'),
  ],
  'pip-dislocation': [
    text(fingerJoint, '近指间关节过伸可发生背侧脱位。方向以关节远侧的指骨为准。', '从侧面沿示指近节滑车找中节基底，末节随中节向手背侧移。'),
    text(fingerJoint, '指间关节侧方脱位时可伴侧副韧带损伤。', '本例示指中节基底偏向拇指一侧。转到掌面比较滑车两侧露出的宽度。'),
  ],
  'knee-dislocation': [
    text(knee, '膝关节前脱位按胫骨平台相对股骨髁的位置命名。', '侧面以股骨髁为参照，沿胫骨前缘向上看，平台移向股骨髁前方。'),
    text(knee, '胫骨平台向股骨髁后方脱出，侧位最容易辨认位移方向。', '沿股骨后缘向下看平台后缘，再与伤前两者的重叠范围比较。'),
    text(knee, '侧方脱位按胫骨平台偏向股骨髁的哪一侧命名。', '从正面找腓骨头以确定外侧，胫骨平台和腓骨向同侧移出。'),
    text(knee, '膝内侧脱位时，胫骨平台向身体中线偏移。', '从正面认出腓骨所在的外侧，再看股骨外髁下方失去多少平台覆盖。'),
  ],
  'patella-dislocation': [
    text(lowerJoint('髌骨脱位'), '外侧脱位时髌骨从滑车沟越过股骨外髁，胫股关节可以保持对位。', '沿股骨长轴看髌骨与滑车，再转向正面看髌骨中心的侧移。'),
  ],
  'lisfranc-dislocation': [
    text(chapter.tmt, '五个跖骨可同向脱位，也可第一跖骨内移、其余四根外移。', '本例五个基底同向背外移。足背面看第二跖骨与中间楔骨的内缘，再侧看背侧台阶。'),
  ],
  'mtp-dislocation': [
    text(toeJoint, '跖趾关节过伸可使近节趾骨基底移到跖骨头背侧，以第一跖趾关节较常见。', '从内侧看第一跖骨头与近节基底，区分跖趾关节与更远侧的趾间关节。'),
  ],
  'toe-ip-dislocation': [
    text(toeJoint, '趾间关节由近侧趾骨的滑车与远侧趾骨基底构成，脱位可向背侧或侧方。', '本例拇趾末节基底越过近节滑车移向足背，第一跖骨头不参与此关节。'),
  ],
};

const displacement = '描述骨折时分别观察断线走向、断端错位和两段轴线的夹角。';
const fissure = '颅骨发生裂缝骨折时，骨面可仅见细线样间隙。';
const smallBones = {
  triquetrum: '取腕尺背侧的三角骨，观察骨体背缘的小骨片。',
  lunate: '沿月骨体的断面看两块骨片，再比较面向桡骨和头状骨的两个关节面。',
  pisiform: '从掌尺侧找位于三角骨前方的豌豆骨，在该骨自身的轮廓内追踪断线。',
  hamate: '从腕背侧看钩骨体的断面，转向掌侧辨认钩突与断面的空间关系。',
  capitate: '沿近端圆形骨头向远端骨体追踪，在两者之间辨认头状骨颈断面。',
  trapezium: '由第一掌骨基底回看大多角骨，沿劈裂面追到拇指掌腕关节端。',
  trapezoid: '由第二掌骨基底向近侧找小多角骨，转动观察其骨体的断面。',
  navicular: '以距骨头为近侧标志，沿足舟骨断面比较近侧距舟面与远侧舟楔面。',
  cuboid: '沿足外缘找到跟骨前方的骰骨，比较骨折前后它的近、远侧关节面。',
};

const skullLandmarks = {
  frontal: '从前上方追踪额骨鳞部裂线，向后找到分隔额骨和顶骨的冠状缝。',
  parietal: '从头顶沿顶骨表面追踪裂线，同时辨认内侧的矢状缝。',
  occipital: '从后方找到枕鳞，再沿裂线追向周围完整骨面，辨认上方人字缝。',
  temporal: '由耳区向上找颞骨鳞部薄板，观察板内裂线与邻近骨缝的位置。',
  ethmoid: '从眼眶内侧定位筛骨眶板，转到侧面看薄壁上裂线的位置。',
  sphenoid: '先找蝶骨体，再向外追到大翼，确定局部裂线位于哪一侧骨壁。',
  maxilla: '从面部前方找上颌骨前壁，追踪裂线与眶下缘的相对位置。',
  palatine: '从硬腭下方定位腭骨水平板。裂线在板面内，部分骨缝分界为估计。',
  vomer: '从侧方看构成骨性鼻中隔后下部的犁骨，沿薄板追踪裂线。',
};
const depression = {
  frontal: '从额部侧上方掠过额骨外表面，比较凹陷中心和周围完整骨面的高低。',
  parietal: '沿颅顶切线方向观察顶骨，比较局部内陷与两侧连续弧面。',
  occipital: '将枕骨转到斜侧面，比较枕鳞凹陷中心与周缘的高低。',
};

const special = {
  atlas: [
    extra(chapter.upperNeck, '读上颈椎时可同时比较寰椎两侧侧块及前弓与齿突的关系。', '从齿突前方向两侧追踪前弓，在环的前半部找细裂线。'),
    extra(chapter.upperNeck, '读上颈椎时可同时比较寰椎两侧侧块及前弓与齿突的关系。', '从后方沿一侧侧块追向后弓，在环的后半部找裂线。'),
  ],
  axis: [
    extra(chapter.upperNeck, '上颈椎读片应检查齿突骨折线及两侧寰椎侧块是否对称。', '裂线在齿突尖端，尖端的小骨片与下方完整的齿突主体分开。'),
    extra(chapter.upperNeck, '上颈椎读片应检查齿突骨折线及两侧寰椎侧块是否对称。', '断面在齿突与枢椎椎体交界，整个齿突位于断面上方。'),
  ],
  'sternal-body': [extra(chapter.general, displacement, '侧看胸骨体前、后缘，断端前后错开会形成骨皮质台阶。')],
  xiphoid: [extra(chapter.general, displacement, '从胸骨体向下找到剑突，定位剑突近端断缘并与体剑交界比较。')],
  manubrium: [
    extra(chapter.general, displacement, '断线横跨胸骨柄，侧视可见上下两段前缘的阶差。'),
    extra(chapter.general, displacement, '沿胸骨柄斜断线从一侧追到另一侧，对照两端与锁骨切迹的距离。'),
  ],
  sacrum: [extra(chapter.pelvis, '读骨盆损伤时应核对骶骨断线、骶孔及垂直移位。', '从前面定位骶孔，纵行断面位于孔外的骶翼。')],
  'iliac-wing': [extra(chapter.pelvis, '骨盆入口位可用于观察骨盆环的旋转及前后移位。', '从髂嵴向下追踪髂翼上部斜断线，再看其与下方髋臼的距离。')],
  scapula: [extra(chapter.general, '肩胛骨骨折需辨认受累部位，注意断线有无延至肩胛盂关节面。', '肩胛骨体出现分开的断面。转向背侧，从肩胛冈向下追踪薄板两侧。')],
  nasal: [
    extra(chapter.general, fissure, '以鼻背中线为参照，比较两侧轮廓，再找局部裂线。'),
    extra(chapter.general, displacement, '从正面看鼻背轮廓的不对称，转向侧面看鼻骨骨片的前后位置。'),
  ],
  zygoma: [extra(chapter.general, displacement, '从头顶向下看颧弓的曲线，颧骨一侧的骨片向内移。')],
  mandible: [
    extra(chapter.general, displacement, '沿下颌体下缘追踪断面，在侧面比较高低，从前面比较左右错位。'),
    extra(chapter.tmj, '外伤后下颌活动受限时应鉴别关节脱位与髁突骨折。', '髁头与下颌窝仍对合，断面位于其下方的右髁突颈。'),
  ],
  hyoid: [extra(chapter.general, displacement, '从头端认出舌骨体和两侧大角，比较右侧大角断缘与左侧完整轮廓。')],
};

function digitNote(course, key, index) {
  const foot = key.endsWith('toe');
  const location = foot ? chapter.toes : chapter.fingers;
  const point = course.name;
  if (key.startsWith('tip-')) {
    if (index === 0) {
      return text(location, foot ? '趾骨横断可见于踢碰伤，辨认断线时以趾骨长轴为参照。' : '指骨可呈横断、斜形或粉碎。先定位受累指节，再看断面走向。',
        '本例在' + point + '，沿骨的长轴找到横断面，再看末端骨片与基底是否对齐。');
    }
    return text(location, foot ? '趾骨遭挤压可形成多个骨片，拇趾远端尤其常见粉碎。' : '粉碎形态可见于末节指骨。应区分末端碎裂与基底背侧的撕脱骨片。',
      '在' + point + '的末端分别追踪小骨片，观察近侧基底保留的轮廓。');
  }
  if (index === 0) return text(location, foot ? '趾骨横断时，从两侧追到的断线大致处在骨长轴的同一高度。' : '横断线大致垂直于指骨的长轴，可另有侧移或成角。',
    '本例在' + point + '，分别沿两侧皮质找断端，再比较远侧骨片的位置。');
  return text(location, foot ? '趾骨踢碰伤可呈斜形，观察断线和描述移位可以分开进行。' : '指骨干斜形骨折时，断线与骨长轴斜交，两侧皮质断点的高度不同。',
    '沿' + point + '从斜断面的高端追到低端，转动后再看两段的侧移。');
}

function regionalFracture(course, key, index) {
  if (key.startsWith('rib-')) {
    const level = Number(key.slice(4));
    const landmark = level >= 11 ? '第十一、十二肋为浮肋，前端游离，可沿受伤肋骨向后定位断口。' : '顺着相邻肋骨的弧度，找到伤肋偏离胸壁轮廓之处。';
    return index === 0 ? text(chapter.ribs, '局部直接受力时，断端可朝胸腔内移动。', landmark) :
      text(chapter.ribs, '胸廓受到前后挤压时，肋骨可向外弯曲，在弧度最大处断裂。', '从头端沿胸壁观察，比较' + course.name + '断端与相邻肋骨弧线的外凸程度。');
  }
  if (key.startsWith('body-')) {
    return index === 0 ? text(chapter.spine, '屈曲压缩可使椎体前半部高度下降，从侧面看呈楔形。', '对照相邻终板，比较' + course.name + '前缘和后缘保留的高度。') :
      text(chapter.spine, '侧屈型损伤可压低椎体一侧，使两侧高度不等。', '从正面比较' + course.name + '的左右缘，再看上终板向哪边倾斜。');
  }
  if (key.startsWith('tip-') || key.startsWith('shaft-')) return digitNote(course, key, index);
  if (key.startsWith('palm-')) return index === 0 ?
    text(chapter.palm, '直接受力的掌骨干可呈横断。单根掌骨骨折通常移位较轻。', '由掌背面沿' + course.name + '追踪横断线，再从侧面看两段长轴的夹角。') :
    text(chapter.palm, '掌骨干受扭转可形成斜断线，肌肉牵拉可伴侧移、背侧成角。', '沿' + course.name + '斜断面的两端比较皮质，再对照邻骨看长度是否改变。');
  if (key.startsWith('foot-')) {
    if (index === 0) return text(chapter.foot, '相邻跖骨互相支撑，跖骨干骨折的移位可以很轻。', '沿' + course.name + '从近端向趾端找骨干断线，与邻近跖骨的走行比较。');
    if (key === 'foot-fifth') return text(chapter.foot, '足内翻时腓骨短肌等牵拉可撕下第五跖骨基底的小骨片，移位常较轻。', '沿足外缘由跖骨干向近侧追踪，确定骨片位于基底，并辨认邻近骰骨。');
    return extra(chapter.foot, '跖骨骨折可依受累部位分为基底、骨干和颈部骨折。', '沿第一跖骨追到内侧楔骨，比较近端断面与第一跗跖关节面的距离。');
  }
  if (Object.hasOwn(skullLandmarks, key)) return index === 0 ? extra(chapter.general, fissure, skullLandmarks[key]) :
    extra(chapter.general, '裂线是骨面的连续性改变。观察局部凹陷时，还需比较骨面高低。', depression[key]);
  if (Object.hasOwn(smallBones, key)) return extra(chapter.general, displacement, smallBones[key]);
  if (key.startsWith('cuneiform-')) {
    const metatarsal = {'cuneiform-medial':'第一','cuneiform-intermediate':'第二','cuneiform-lateral':'第三'}[key];
    if (metatarsal) return extra(chapter.tmt, '第一至第三跖骨的基底分别与内侧、中间、外侧楔骨构成关节。', '沿' + metatarsal + '跖骨基底向近侧回看，定位相应楔骨本体的断端。');
  }
  if (key === 'sesamoid-0' || key === 'sesamoid-1') return extra(chapter.general, displacement,
    '从足底看第一跖骨头，找到' + (key === 'sesamoid-0' ? '靠内侧' : '靠外侧') + '的籽骨，在其骨体内追踪断面。');
  return special[key]?.[index] ?? null;
}

export function regionalNote(course, index) {
  if (!Number.isInteger(index) || !course?.variants?.[index]) return null;
  if (Object.hasOwn(joints, course.id)) return joints[course.id][index] ?? null;
  if (!course.id?.startsWith('region-')) return null;
  return regionalFracture(course, course.id.slice(7), index);
}
