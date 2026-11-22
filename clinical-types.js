// The selected contrast always describes the preset clinical example.
const signs={
 'elbow-dislocation':[
  ['肘后脱位','尺桡骨近端整体越过肱骨远端，位于其后。','从侧面看鹰嘴、尺骨滑车切迹与肱骨的关系。'],
  ['肘侧方脱位 · 外侧例','屈肘前臂向外侧错开，尺骨和桡骨保持相对关系。','正面比较两髁与前臂的内外侧边缘。'],
  ['肘前脱位','尺桡骨近端整体位于肱骨远端前方。','以肱骨为固定参照，与后脱位保持同一侧面对照。']
 ],
 ankle:[
  ['内翻损伤','本例内踝斜行断裂，外踝断面接近横形。','正面先看距骨倾斜，再对照两踝的断线。'],
  ['外翻损伤','本例内踝横断，外踝呈斜形，足的倾斜方向相反。','固定胫骨，从相同方向看踝穴内外侧间隙。']
 ],
 plateau:[
  ['内侧髁','劈裂位于内侧负重平台。','从上方辨认胫骨棘，再追到内侧骨壁。'],
  ['外侧髁 · 劈裂例','外侧骨壁分离，骨块可整体倾斜。','看外侧平台与干骺端的交线。'],
  ['双髁','两侧平台均受累，可以看到两髁相对分开。','从前面比较两侧高度，再查髁间的裂线。'],
  ['外侧平台 · 局部压陷','中央关节面低于周围骨缘。外侧骨壁保持连续。','将压低量调至零，再恢复观察局部塌陷。'],
  ['外侧平台 · 劈裂伴压陷','外侧壁裂开，同时中央部分的关节面下沉。','分别调整骨块平移和局部压低，分辨两种形态。']
 ],
 radius:[
  ['伸直型 · Colles','远段连同完整桡腕关节面向背侧移位、背倾。','从侧面追踪整个远端关节面，再看正面的桡侧偏移。'],
  ['屈曲型 · Smith','远段连同完整桡腕关节面向掌侧移位、掌倾。','与伸直型在同一侧位对照倾斜方向。'],
  ['背侧缘型 · Barton','断线进入背侧关节缘。腕骨随背侧缘骨片向背侧半脱位。','先找留在干骺端的关节面，再找随腕骨移动的小骨片。'],
  ['掌侧缘型 · 反 Barton','断线进入掌侧关节缘。腕骨随掌侧缘骨片向掌侧半脱位。','与屈曲型对照：两者均掌移，本例仅部分关节面随行。']
 ],
 'lunate-dislocation':[
  ['月骨掌侧脱位','月骨离开桡骨月骨窝，远侧凹面转向掌侧。','侧面观察桡骨、月骨和头状骨。头状骨向近端靠近桡骨。'],
  ['月骨周围背侧脱位','月骨仍与桡骨月骨窝对合，头状骨与远排腕骨位于月骨背侧。','沿同一侧面辨认究竟是月骨翻转，还是头状骨越过月骨。']
 ],
 'hip-dislocation':[
  ['后脱位','股骨头位于髋臼后方。股骨干伴屈曲、内收、内旋。','先找髋臼后缘，再沿股骨颈看头的位置。'],
  ['前脱位 · 前下方例','股骨头位于髋臼前下方。股骨干伴外展、外旋。','对照前后关系；此例选取前下方向。']
 ],
 'shoulder-dislocation':[
  ['前脱位','肱骨头移至肩胛盂前方，本例伴下移。','转至侧面，以固定的盂缘辨认前后。'],
  ['后脱位','肱骨头移至肩胛盂后方，伴上臂内旋。','正面投影可能掩盖后移，切换侧面观察。']
 ],
 elbow:[
  ['伸直型','远侧髁块相对肱骨干向后移。','以肱骨干为参照，区别前臂整体后脱位。'],
  ['屈曲型','远侧髁块相对肱骨干向前移。','侧面看同一骨段的移位方向。'],
  ['粉碎型','髁上区有多个骨块。','看骨块数量及各自断面。']
 ],
 intercondylar:[
  ['T 形','髁间纵行裂线与近侧横行断面相接。','从正面观察横线，再从关节端看两髁分开。'],
  ['Y 形','髁间纵行裂线在近侧分成两条斜行支。','沿左右两条斜支追至干骺端。']
 ],
 calcaneus:[
  ['关节外 · 后结节例','骨折限于后结节，距跟相对骨面的连续性保留。','从上方对照断线与距骨下方的着色区。'],
  ['关节面受累','断面穿入距跟相对骨面，局部可产生高差。','转至外侧观察高度变化，再看关节面交线。']
 ],
 scaphoid:[
  ['近端','小骨片位于舟骨近侧，邻近月骨。','从桡侧向尺侧辨认近端。'],
  ['腰部','断线横过舟骨腰部，本例远侧块向掌侧屈转。','近、远侧骨块的相对折角比单看断线更清楚。'],
  ['结节部','小骨片位于掌侧结节。','从掌面追踪小骨片与舟骨主体的连续性。']
 ]
};
export function typeSign(course,index){return signs[course?.id]?.[index];}
export function showTypeSign(course,index,custom){
 const v=course?.variants[index];
 const d=typeSign(course,index)||(v&&course.variants.length>1?[v.name,v.observe,'']:null),box=document.getElementById('typeSign');
 box.hidden=!d||custom;
 if(box.hidden){const look=document.getElementById('signLook');look.textContent='';look.hidden=true;return;}
 document.getElementById('signName').textContent=d[0];
 document.getElementById('signFinding').textContent=d[1];
 document.getElementById('signLook').textContent=d[2];document.getElementById('signLook').hidden=!d[2];
}


export function typeView(c,i){
 if(['plateau','calcaneus','patella-dislocation','lisfranc-dislocation'].includes(c?.id))return 'top';
 if(c?.id==='elbow-dislocation'&&i===1||c?.id==='knee-dislocation'&&i>1)return 'front';
 if(['radius','lunate-dislocation','elbow-dislocation','hip-dislocation','shoulder-dislocation','elbow','knee-dislocation'].includes(c?.id))return 'side';
 if(c?.id==='intercondylar'||c?.id==='ankle')return 'front';
 return null;
}
