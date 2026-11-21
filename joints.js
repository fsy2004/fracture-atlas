// Positions are in the male atlas (metres). Directions are anatomical XYZ.
// A joint translates its complete moving group; both forearm bones stay together.
function joint(id,name,region,bones,fixed,anchor,span,variants){
 return {id,name,region,kind:'joint',system:'脱位方向',variants:variants.map(([label,shift,cause,observe])=>({
  name:label,cause,observe,cuts:bones.map(bone=>({bone})),fixed,anchor,span,shift
 }))};
}
export const joints=[
 joint('shoulder-dislocation','肩关节脱位','上肢',['Right humerus'],['Right scapula','Right clavicle'],[-.161,1.39,-.024],.19,[
  ['前脱位',[9,-13,35],'肱骨头从肩胛盂向前方移出，本例带有向下分量。','固定肩胛骨，侧转观察肱骨头与盂面的前后关系。'],
  ['后脱位',[0,1,-34],'以肩胛盂为参照，肱骨头向后方失去对位。','在侧位比较伤前轮廓与肱骨头终点。']]),
 joint('elbow-dislocation','肘关节脱位','上肢',['Right ulna','Right radius'],['Right humerus'],[-.207,1.12,-.036],.17,[
  ['后脱位',[0,8,-30],'尺桡骨近端一起移向肱骨远端的后方。','以肱骨远端为参照，从侧位看鹰嘴和桡骨头的方向。'],
  ['侧方脱位（外侧例）',[-30,0,0],'本例模拟前臂骨整体移向肘外侧。','从正面观察尺桡骨与肱骨两髁的横向错位。']]),
 joint('hip-dislocation','髋关节脱位','下肢',['Right femur'],['Right hip bone','Sacrum'],[-.055,.89,-.02],.24,[
  ['后脱位',[-14,23,-43],'股骨头向髋臼后方移出，本例显示后上方移位。','切换右侧视角，观察股骨头与髋臼后缘的关系。'],
  ['前脱位',[-8,-25,42],'股骨头向髋臼前方移出，本例取前下方向。','保留骨盆作为参照，在侧面比较股骨头伤前和伤后的位置。']])
];
