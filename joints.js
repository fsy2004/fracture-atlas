// Positions are in the male atlas (metres). Directions are anatomical XYZ.
// A joint translates its complete moving group; both forearm bones stay together.
function joint(id,name,region,bones,fixed,anchor,span,variants){
 return {id,name,region,kind:'joint',system:'脱位方向',variants:variants.map(([label,shift,cause,observe])=>({
  name:label,cause,observe,cuts:bones.map(bone=>({bone})),fixed,anchor,span,shift
 }))};
}
function localJoint(id,name,region,bones,fixed,nativePoint,span,examples,jointFollowers=[],adjunct){
 return {id,name,region,kind:'joint',system:'按活动骨端的移位方向',source:'教材第七章 · '+name,
  variants:examples.map(([label,shift,observe,turn])=>({
   name:label,cause:observe,observe,cuts:bones.map(bone=>({bone})),fixed,nativePoint,span,shift,turn,jointFollowers,...(adjunct?{moving:adjunct,context:adjunct.flatMap(a=>a.names)}:{})
  }))};
}
const footBones=['Right talus','Right calcaneus','Navicular bone of right foot','Right cuboid bone',
 ...['medial','intermediate','lateral'].map(n=>'Right '+n+' cuneiform bone')];
const rays=['first','second','third','fourth','fifth'].map(n=>'Right '+n+' metatarsal bone');
const toeBones=['big','second','third','fourth','little'].flatMap((n,i)=>(i?['Proximal','Middle','Distal']:['Proximal','Distal']).map(p=>p+' phalanx of right '+n+' toe'));
const sesamoids=['Sesamoid bone of right foot','Sesamoid bone of right foot FJ3376'];
export const joints=[
 joint('shoulder-dislocation','肩关节脱位','上肢',['Right humerus'],['Right scapula','Right clavicle'],[-.161,1.39,-.024],.19,[
  ['前脱位',[9,-13,35],'肱骨头从肩胛盂向前方移出，本例带有向下分量。','固定肩胛骨，侧转观察肱骨头与盂面的前后关系。'],
  ['后脱位',[-30,-3.5,-34],'以肩胛盂为参照，肱骨头向后方失去对位。','在侧位比较伤前轮廓与肱骨头终点。']]),
 joint('elbow-dislocation','肘关节脱位','上肢',['Right ulna','Right radius'],['Right humerus'],[-.207,1.12,-.036],.17,[
  ['后脱位',[0,3.5,-30],'尺桡骨近端一起移向肱骨远端的后方。','以肱骨远端为参照，从侧位看鹰嘴和桡骨头的方向。'],
  ['侧方脱位（外侧例）',[-30,-22.5,0],'本例模拟前臂骨整体移向肘外侧。','从正面观察尺桡骨与肱骨两髁的横向错位。'],
  ['前脱位',[0,-24,29],'尺桡骨近端相对肱骨远端移向前方。','侧位对照鹰嘴与肱骨远端，注意运动的是前臂骨。']]),
 joint('hip-dislocation','髋关节脱位','下肢',['Right femur'],['Right hip bone','Sacrum'],[-.055,.89,-.02],.24,[
  ['后脱位',[-49,23,-43],'股骨头向髋臼后方移出，本例显示后上方移位。','切换右侧视角，观察股骨头与髋臼后缘的关系。'],
  ['前脱位',[-43,-25,42],'股骨头向髋臼前方移出，本例取前下方向。','保留骨盆作为参照，在侧面比较股骨头伤前和伤后的位置。']]),
 localJoint('tmj-dislocation','颞下颌关节脱位','头颈',['Mandible'],['Right temporal bone','Left temporal bone'],[.5,.90,.12],.19,[
  ['双侧前脱位',[0,-6,18],'两侧下颌髁突向前越过关节结节。侧面看髁突与下颌窝，正面观察下颌是否保持对称。',[14,0,0]]]),
 localJoint('lunate-dislocation','月骨脱位','上肢',['Right lunate'],['Right radius'],[.5,.5,.5],.068,[
  ['掌侧转位伴掌移',[0,-2,18],'从桡侧看月骨远侧凹面向掌侧转约 90°，头状骨随后向近端靠近桡骨远端。',[-90,0,0]]],[],[
   {names:['Right capitate'],via:[-4,-4,0],shift:[5,2,3]},
   {names:['Right scaphoid'],via:[-2,-1,0],shift:[0,0,0]},
   {names:['Right triquetral'],via:[2,-1,0],shift:[0,0,0]}
  ]),
 localJoint('mcp-dislocation','掌指关节脱位','上肢',['Proximal phalanx of right thumb'],['Right first metacarpal bone'],[.5,.85,.5],.086,[
  ['拇指背侧脱位',[-6.5,1.3,-8.9],'固定第一掌骨，观察拇指近节基底向手背侧越过掌骨头。']],['Distal phalanx of right thumb']),
 localJoint('pip-dislocation','指间关节脱位','上肢',['Middle phalanx of right index finger'],['Proximal phalanx of right index finger'],[.5,.88,.5],.067,[
  ['示指近指间背侧脱位',[1.9,-2.9,-7.7],'以近节指骨滑车为参照，观察中节基底向手背侧移出。'],
  ['示指近指间侧方脱位',[-6,1,0],'从掌面观察中节基底向桡侧错开，转至侧面与背移对照。']],['Distal phalanx of right index finger']),
 localJoint('knee-dislocation','胫股关节脱位','下肢',['Right tibia','Right fibula'],['Right femur'],[.49,.94,.54],.23,[
  ['前脱位',[0,-3,40],'固定股骨髁，在侧面观察胫骨平台向前移出。'],
  ['后脱位',[0,-3,-40],'固定股骨髁，在侧面观察胫骨平台向后移出。'],
  ['外侧脱位',[-39,-3,0],'从正面看胫骨平台与股骨髁的内外侧边缘。'],
  ['内侧脱位',[39,-13,0],'从正面看胫骨平台内移；腓骨和足与胫骨一起运动。']], [...footBones,...rays,...toeBones,...sesamoids]),
 localJoint('patella-dislocation','髌骨脱位','下肢',['Right patella'],['Right femur','Right tibia'],[.5,.5,.5],.16,[
  ['外侧脱位',[-31,0,7],'以股骨滑车沟为参照，从前方及轴向观察髌骨越过外髁。']]),
 localJoint('lisfranc-dislocation','跗跖关节脱位','下肢',rays,[...footBones.slice(2)],[.5,.65,.10],.14,[
  ['同向背外侧脱位',[-7,6.6,7.8],'五个跖骨基底向背外侧移动。对照第二跖骨与中间楔骨的内侧缘，再转侧面看背侧阶差。']], [...toeBones,...sesamoids]),
 localJoint('mtp-dislocation','跖趾关节脱位','下肢',['Proximal phalanx of right big toe'],[rays[0]],[.5,.5,.12],.08,[
  ['第一跖趾背侧脱位',[1.6,9.6,4.3],'侧面观察拇趾近节基底移向第一跖骨头的足背侧。']],['Distal phalanx of right big toe']),
 localJoint('toe-ip-dislocation','趾间关节脱位','下肢',['Distal phalanx of right big toe'],['Proximal phalanx of right big toe'],[.5,.5,.12],.058,[
  ['拇趾趾间背侧脱位',[-1.2,7.5,3.6],'固定近节趾骨，从侧面看末节基底与滑车失去对合。']])
];

// Intermediate translations are teaching poses relative to the healthy bone, in millimetres.
const routes={
 'hip-dislocation':{0:[[-28,0,0]]},
 'lunate-dislocation':{0:[[0,0,9]]},
 'elbow-dislocation':{1:[[0,-9,-4.5]],2:[[0,-22.5,-11.2]]},
 'mcp-dislocation':{0:[[-1.4,-5.8,2.1]]},
 'pip-dislocation':{0:[[-.2,-5.2,.1]]},
 'toe-ip-dislocation':{0:[[-.5,-.4,1.9]]}
};
for(const c of joints)for(const [i,v] of c.variants.entries())v.waypoints=routes[c.id]?.[i];
