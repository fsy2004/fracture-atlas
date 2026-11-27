import {addCases,cut,foot,metatarsals,midfoot,motion,rest,right,teachingCase,toeColumns} from './textbook-case.js';

const {humerus,radius,ulna,femur,tibia,fibula,hip,patella}=right;
const lunate='Right lunate', capitate='Right capitate';
const elbow=[ulna,radius], ankleFoot=foot;
const elbowRelease=[-12,-26,-7],elbowClock=[0,.38,.72,1];
const forefinger=['Proximal','Middle','Distal'].map(n=>n+' phalanx of right index finger');
const clavicle='Right clavicle', scapula='Right scapula';
const shoulder=[scapula,clavicle];
const ribs=['Right second rib','Right third rib','Right fourth rib'];

function joint(name,active,fixed,shift,points,clinical,options={}){
 return teachingCase(name,active.map(bone=>({bone})),points,clinical,{fixed,shift,...options});
}

export function addTextbookJoints(joints){
 addCases(joints,'hip-dislocation','第七章 · 第四节 · 一｜PDF 533–535、542 页',[
  joint('中心性脱位',[femur,hip],[],[34,0,0],[
   '大转子受力传到股骨头，造成髋臼底骨折。臼底可为单块或粉碎，关节软骨损伤较重。',
   '股骨头与臼底骨片同向进入盆腔。冠状方向同时辨认髋臼缺口、移位块和股骨头，重度时可见短缩。'
  ],'hip-central',{span:.22,anchor:[-.077,.875,-.02],centralHip:true,jointFollowers:[]}),
  joint('前脱位（耻骨部）',[femur],[hip],[22,12,63],[
   '极度外展、外旋使股骨头从关节囊前下部脱出，耻骨部例的股骨头最终在耻骨上支前方。',
   '正面辨认高位的股骨头，侧面看它处于骨盆前方，并核对与股血管的邻近关系。'
  ],'hip-pubic',{span:.24,anchor:[-.077,.875,-.02],posture:[-8,0,-22],axial:17,axialSign:-1,waypoints:[[-43,-25,42],[-24,-20,75],[12,-11,76]],jointFollowers:[]}),
  joint('前脱位（闭孔）',[femur],[hip],[22,-33,57],[
   '股骨头脱出后位于闭孔前方，落点低于耻骨部脱位。',
   '以前内下方头影和髋屈曲、外展、外旋区分闭孔部例，注意闭孔神经与内收肌的关系。'
  ],'hip-obturator',{span:.24,anchor:[-.077,.875,-.02],posture:[-16,0,-30],axial:17,axialSign:-1,waypoints:[[-43,-25,42],[-24,-20,75],[12,-11,76]],jointFollowers:[]})
 ]);

 addCases(joints,'knee-dislocation','第七章 · 第四节 · 二｜图 7-25 · PDF 543–545 页',[
  ...[[1,1,'前内'],[-1,1,'前外'],[1,-1,'后内'],[-1,-1,'后外']].map(([side,front,label])=>{
   const direction=front>0?'前':'后', lateral=side>0?'内':'外', pivot=side>0?'外':'内';
   return joint(label+'旋转脱位',[tibia,fibula],[femur],[10*side,-5,13*front],[
    '小腿固定、膝微屈时，股骨旋转使胫骨平台失去对位。本例平台中心位于股骨髁的'+direction+lateral+'方。',
    '沿胫骨轴俯视时，以'+pivot+'髁附近为枢，观察'+lateral+'侧间隙向'+direction+'方打开及胫腓骨带足组转动。'
   ],'knee',{span:.24,jointFollowers:ankleFoot,
    pivot:{bone:femur,point:[side>0?.23:.77,.045,.52]},turn:[-8,18*side*front,0],waypoints:[[0,-8,0]]});
  })
 ]);

 addCases(joints,'tmj-dislocation','第七章 · 第二节｜PDF 504–505 页',[
  joint('单侧前脱位',['Mandible'],['Right temporal bone','Left temporal bone'],[0,0,0],[
   '患侧髁突向前越过关节结节，健侧髁突仍位于下颌窝。',
   '正面辨认颏部偏向健侧，分别从两侧核对髁突落点和双侧不对称。'
  ],'tmj-unilateral',{span:.19,pivot:{bone:'Mandible',point:[.90,.947,.085]},turn:[0,13,5],jointFollowers:[]})
 ]);

 addCases(joints,'shoulder-dislocation','第七章 · 第三节 · 一｜图 7-3 · PDF 507–509 页',[
  joint('前脱位（喙突下）',[humerus],shoulder,[5,-13,34],[
   '喙突下型常见，肱骨头位于喙突下方，方肩与搭肩试验阳性提示盂肱对位丢失。',
   '从前斜方观察喙突下的头影，并与位置更低的盂下型比较。'
  ],'shoulder-anterior',{posture:[0,0,-34],axial:18}),
  joint('前脱位（盂下）',[humerus],shoulder,[-3,-36,12],[
   '上臂过度举起时可发生杠杆作用，肱骨头下移至肩胛盂下方。',
   '沿肩胛盂平面观察关节头低落到腋侧，上臂保持外展。'
  ],'shoulder-inferior',{posture:[0,0,-61],axial:10,waypoints:[[-14,-10,13],[-17,-28,8]]}),
  joint('前脱位（锁骨下）',[humerus],shoulder,[27,0,43],[
   '锁骨下型的肱骨头比喙突下型更向内上，位于锁骨下方。',
   '前斜视角比较肱骨头与锁骨下缘，并检查臂丛和腋血管邻近区。'
  ],'shoulder-clavicular',{posture:[-5,0,-22],axial:15,waypoints:[[-11,-12,28],[3,-9,53],[24,-2,51]]}),
  joint('前脱位（胸腔内）',[humerus,...ribs],shoulder,[91,-20,12],[
   '胸腔内型可见于严重暴力损伤，本例以同侧肋骨骨折的胸壁缺口示意肱骨头进入胸腔。',
   '从上方和胸壁侧面检查肱骨头是否位于肋面内侧，联系胸壁与胸腔相关损伤。'
  ],'shoulder-thoracic',{posture:[-4,0,-54],axial:16,waypoints:[[0,-17,41],[42,-32,25]],thoracicShoulder:true})
 ].map(v=>({span:.25,anchor:[-.164,1.33,-.02],jointFollowers:[],axialSign:-1,...v})));

 addCases(joints,'elbow-dislocation','第七章 · 第三节 · 二｜图 7-7 至 7-9 · PDF 515–520 页',[
  joint('侧方脱位（内侧例）',elbow,[humerus],[30,-35,-5],[
   '前臂近端整体向尺侧移，肘部横径增宽，肱骨远端向相对的外侧突出。',
   '正面看近端尺桡是否保持在同一组，检查肘后三点和内外侧副结构。'
  ],'elbow-medial',{span:.16,elbowFrame:true,waypoints:[[0,-6,0],[-31,0,0]],leftWaypoints:[[0,-6,0],[-16,-25,-10]]}),
  joint('分离脱位',elbow,[humerus],[-7,-10,24],[
   '桡骨头前移、尺骨鹰嘴后移，使肱骨远端嵌在两骨之间。',
   '侧面同时追踪尺桡两骨的相反轨迹，结合环状韧带和近侧骨间膜受损理解分离。'
  ],'elbow-divergent',{span:.17,elbowFrame:true,jointGroups:[
   {bones:[radius],shift:[-17,-43,32],waypoints:[elbowRelease,[-20,-44,6]],knots:elbowClock,label:'桡骨头'},
   {bones:[ulna],shift:[19,-42,-31],waypoints:[elbowRelease,[9,-43,-18]],knots:elbowClock,label:'尺骨近端'}
  ]}),
  joint('肘关节骨折脱位（伴尺骨鹰嘴骨折）',elbow,[humerus],[0,-8,29],[
   '鹰嘴骨折使关节失去尺骨后方约束，鹰嘴骨折片留在肱骨远端后上方。',
   '尺桡远段共同前移。侧面同时辨认尺骨断面和肱尺、肱桡关节错位。'
  ],'elbow-fracture',{span:.17,elbowFrame:true,jointGroups:[
   {bones:[radius],shift:[-7,-31,34],waypoints:[elbowRelease,[-10,-35,13]],knots:elbowClock}
  ],jointFractures:[cut(ulna,.915,[0,1,-.23],motion([-7,-31,34]),rest,{minusPath:[elbowRelease,[-10,-35,13]],minusKnots:elbowClock})]})
 ]);

 const wristContext=['Right scaphoid','Right triquetral'];
 const releaseWrist=[{names:[wristContext[0]],shift:[-9,-14,-1],via:[-2,-12,0],timing:[.08,.49]},{names:[wristContext[1]],shift:[9,-13,-4],via:[2,-11,-1],timing:[.08,.49]}];
 addCases(joints,'lunate-dislocation','第七章 · 第三节 · 四｜图 7-13 · PDF 525–527 页',[
  joint('Ⅰ型（掌旋约90°）',[lunate],[radius],[0,-8,7],[
   '月骨向掌侧旋转约90°，掌侧韧带仍保留。',
   '从桡侧观察远侧凹面的方向，辨认旋转与明显掌侧移位的差别。'
  ],'lunate-ligament',{directed:{axis:[-1,0,0],degrees:90},waypoints:[[0,-5,8]],rotationTiming:[.60,1],moving:[{names:[capitate],shift:[3,-19,-6],timing:[.10,.55]},...releaseWrist]}),
  joint('Ⅱ型（掌旋大于90°）',[lunate],[radius],[0,-11,11],[
   '月骨沿掌侧同向旋转超过90°，图示范围可达270°，残留掌侧韧带可随骨扭曲。',
   '连续观察旋向和累计角度，终帧骨面方向本身无法区分大角度转位与反向短弧。'
  ],'lunate-torsion',{directed:{axis:[-1,0,0],degrees:220},waypoints:[[0,-9,12]],rotationTiming:[.60,1],moving:[{names:[capitate],shift:[3,-19,-6],timing:[.10,.55]},...releaseWrist]})
 ].map(v=>({span:.075,nativePoint:[.5,.48,.62],jointFollowers:[],
  context:[capitate,...wristContext],compareBones:[lunate,radius,capitate],...v})));

 addCases(joints,'pip-dislocation','第七章 · 第三节 · 五｜PDF 531–532 页',[
  joint('示指近指间尺侧脱位',[forefinger[1]],[forefinger[0]],[8,-2,0],[
   '示指中节基底向尺侧越过近节滑车，可伴对侧侧副韧带牵裂。',
   '掌面辨别尺侧台阶，再与历史桡侧例比较，末节随中节一起移位。'
  ],'pip-ulnar',{span:.067,nativePoint:[.5,.88,.5],turn:[0,0,-12],
   jointFollowers:[forefinger[2]],digitLateral:{distance:8,way:3}})
 ]);

 addCases(joints,'patella-dislocation','第七章 · 第四节 · 三｜PDF 547–548 页',[
  joint('上方脱位',[patella],[femur,tibia],[0,27,6],[
   '髌韧带失去连续性时，股四头肌牵拉可使髌骨向上移位。',
   '侧面检查髌骨下极与胫骨结节间距，抬高的髌骨与牵拉方向一致。'
  ],'patella-high'),
  joint('下方脱位',[patella],[femur,tibia],[0,-24,6],[
   '股四头肌腱断裂使上方牵拉消失，髌骨向下方移位。',
   '在侧位沿伸膝装置检查髌骨上极，比较下移与髌韧带损伤时的上移。'
  ],'patella-low',{waypoints:[[0,0,8]]}),
  joint('内侧脱位',[patella],[femur,tibia],[27,0,8],[
   '少见的内侧型表现为髌骨越过滑车内缘，脱离正中轨迹。',
   '从轴向查髌骨位于内髁前方，并核对外侧支持结构。'
  ],'patella-medial',{waypoints:[[6,0,10]]}),
  joint('习惯性脱位',[patella],[femur],[-28,0,7],[
   '习惯性脱位随屈膝反复出现，伸膝时可回复。滑车或外髁约束不足可使外移更易发生。',
   '播放完整屈伸周期，比较屈曲中期的外移和终末回纳。'
  ],'patella-habitual',{jointGroups:[
   {bones:[patella],shift:[-28,0,7],waypoints:[[-9,0,9]],cycle:true},
   {bones:[tibia],followers:[fibula,...ankleFoot],pivot:{bone:femur,point:[.5,.07,.49]},shift:[0,-4,0],turn:[25,0,0],cycle:true}
  ]})
 ].map(v=>({span:.18,nativePoint:[.5,.5,.5],jointFollowers:[],...v})));

 const first=metatarsals[0], outer=metatarsals.slice(1);
 const outerGroup={bones:outer,followers:toeColumns.slice(1).flat(),shift:[-12,3,5],waypoints:[[0,0,4]]};
 const firstGroup={bones:[],followers:toeColumns[0],pivot:{bone:first,point:[.5,.5,.15]},shift:[11,3,5],waypoints:[[0,0,4]]};
 const firstBreak=cut(first,.16,[.8,.1,1],rest,motion([11,3,5]),{axis:2,plusPath:[[0,0,4]]});
 addCases(joints,'lisfranc-dislocation','第七章 · 第四节 · 四｜图 7-26 · PDF 549–550 页',[
  joint('同向背侧脱位',metatarsals,midfoot,[0,13,21],[
   '五个跖骨基底一同向足背越过跗骨远侧面。',
   '侧位可辨连续的背侧阶差，正面足列之间保留原有相对排列。'
  ],'lisfranc',{jointFollowers:toeColumns.flat(),waypoints:[[0,-2,17],[0,-2,24]]}),
  joint('同向跖侧脱位',metatarsals,midfoot,[0,-12,4],[
   '所有跖列向足底移出，变位方向与同向背侧型相反。',
   '沿中间楔骨与第二跖骨作侧位比较，辨别跖侧阶差和足弓变化。'
  ],'lisfranc',{jointFollowers:toeColumns.flat(),waypoints:[[0,0,5]]}),
  joint('第2～5跖骨外脱位',outer,[...midfoot,first,...toeColumns[0]],[-12,2,3],[
   '第2至第5跖骨向外脱位，第一跖列仍与内侧楔骨对合。',
   '足背观察第一、第二跖骨基底间隙和第二跖骨内缘相对中间楔骨的阶差。'
  ],'lisfranc',{jointFollowers:toeColumns.slice(1).flat(),waypoints:[[0,0,4]]}),
  joint('第1跖骨内脱位伴基底骨折',[first],[...midfoot,...outer,...toeColumns.slice(1).flat()],[11,3,5],[
   '第一跖骨向内移，近侧基底缘小骨片留在内侧楔骨附近。',
   '先看第一跖跗关节面断线，再确认其余四列保持对位。'
  ],'lisfranc',{jointGroups:[firstGroup],jointFractures:[firstBreak]}),
  joint('分离型脱位',metatarsals,midfoot,[11,3,5],[
   '第1跖列向内、第2至第5跖列向外，前足横径增宽。',
   '分离型例同时显示第1跖骨基底断线，检查两方向位移和留在近侧的骨片。'
  ],'lisfranc',{jointGroups:[firstGroup,outerGroup],jointFractures:[firstBreak]})
 ].map(v=>({span:.16,nativePoint:[.5,.65,.1],jointFollowers:[],...v})));

 addCases(joints,'toe-ip-dislocation','第七章 · 第四节 · 五｜PDF 551–553 页',[
  joint('拇趾趾间侧方脱位',[toeColumns[0][1]],[toeColumns[0][0]],[6,1,2],[
   '拇趾末节基底因侧副韧带受损而移向一侧，本例取内侧。',
   '足背位比较末节与近节的横向阶差，和侧位最清楚的背侧型互相鉴别。'
  ],'toe-side',{span:.058,nativePoint:[.5,.5,.12],jointFollowers:[],
   turn:[0,-8,0],digitLateral:{distance:6,way:2}})
 ]);

 const pulledName='小儿桡骨头半脱位';
 const source='第七章 · 第三节 · 三｜PDF 524 页 · 成人骨性底图儿童解剖示意';
 joints.push({id:'pulled-elbow',name:pulledName,region:'上肢',kind:'joint',system:'牵拉机制',source,
  variants:[joint(pulledName,[radius,ulna],[humerus],[0,-2.5,0],[
   '幼儿伸肘位前臂受纵向牵拉，肱桡关节稍分离，环状韧带与关节囊可嵌入间隙。',
   '患儿拒用患肢，前臂旋前、肘半屈。此处以成人骨性底图及虚拟环状韧带示意儿童损伤。',
   '轻微半脱位在常规X线片上可无异常，需结合牵拉史、姿势及局限性压痛。'
  ],'pulled',{span:.15,elbowFrame:true,pulledElbow:true,source})]});
}
