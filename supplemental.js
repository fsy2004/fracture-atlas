// Region-authored examples for structures outside the first set of long-bone lessons.
// "nativePoint" is a fraction of this named native mesh's bounds.
const list=[];
const still=()=>({shift:[0,0,0],turn:[0,0,0]});
const pose=(shift,turn=[0,0,0])=>({shift,turn});
const cut=(bone,axis,level,normal,minus,plus,extra={})=>({bone,axis,level,normal,minus,plus,...extra});
const example=(name,cause,observe,cuts,extra={})=>({name,cause,observe,cuts,...extra});
function add(id,name,region,system,reference,context,variants){
 list.push({id:'region-'+id,name,region,system,source:reference,reference,context,variants});
}
const ord='first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth'.split(' ');
const cap=s=>s[0].toUpperCase()+s.slice(1);
for(const i of [0,1,2,9,10,11]){
 const name='Right '+ord[i]+' rib',neighbors=[i-1,i+1].filter(j=>j>=0&&j<12).map(j=>'Right '+ord[j]+' rib');
 add('rib-'+(i+1),'第'+(i+1)+'肋骨','躯干','按受力方式','教材第六章第四节 · 肋骨',neighbors,[
  example('局部内移示例','局部受力可使肋骨断端向胸廓内侧移动。','由胸壁外侧观察，再转向头端比较两段的内移程度。',[cut(name,2,.53,[.12,0,1],pose([4,0,0],[0,-4,0]),pose([1,0,0]))]),
  example('外弯示例','胸廓形变可使弯曲的肋骨向外凸出。','比较肋弓轮廓，注意浮肋前端游离；方向为选取的形态示例。',[cut(name,2,.57,[.23,.1,1],pose([-4,0,0],[0,4,0]),pose([-1,0,0]))])
 ]);
}
const chain=[...['third','fourth','fifth','sixth','seventh'].map(n=>cap(n)+' cervical vertebra'),...ord.map(n=>cap(n)+' thoracic vertebra'),...ord.slice(0,5).map(n=>cap(n)+' lumbar vertebra')];
for(const [i,bone] of chain.entries()){
 if(['Eleventh thoracic vertebra','Twelfth thoracic vertebra','First lumbar vertebra','Second lumbar vertebra'].includes(bone))continue;
 const cervical=i<5,number=cervical?i+3:i<17?i-4:i-16,region=cervical?'颈':i<17?'胸':'腰';
 const context=[i===0?'Axis':chain[i-1],chain[i+1]||'Sacrum'];
 add('body-'+(cervical?'c':i<17?'t':'l')+number,region+number+'椎体','躯干','按压缩方向',cervical?'AO-SUBAXIAL':'AO-THORACOLUMBAR',context,[
  example('前缘楔形压缩','椎体前柱在屈曲与压缩作用下可变矮。','比较上下终板和前、后缘高度。该示例仅呈现椎体形态。',[{bone,wedge:'anterior'}]),
  example('侧方楔形压缩','偏侧压缩可形成两侧高度差。','从正面观察受累侧高度降低，再转至侧面。',[{bone,wedge:'lateral'}])
 ]);
}
function trace(bone,axis,p,n,r=.26){return {bone,axis,level:p[axis],nativePoint:p,surface:'trace',normal:n,extent:r};}
function dent(bone,p,n,r=.23){return {bone,axis:1,level:p[1],nativePoint:p,surface:'dent',normal:n,extent:r};}
add('atlas','寰椎','躯干','按受累椎弓','AO-C1',['Axis','Occipital bone'],[
 example('前弓裂线','寰椎前弓可发生孤立性骨性损伤。','观察齿突前方的骨弓，本例保持侧块对位。',[trace('Atlas',0,[.57,.52,.95],[1,.12,0],.14)]),
 example('后弓裂线','后弓损伤可局限于一侧，也可双侧发生。','从后方追踪后弓的单侧裂线。',[trace('Atlas',0,[.69,.47,.15],[1,.1,0],.18)])
]);
add('axis','枢椎齿突','躯干','按骨折位置','AO-C2',['Atlas','Third cervical vertebra'],[
 example('齿突尖端骨折','断面位于齿突顶端。','从前方确认小骨片与齿突主体的连续性。',[cut('Axis',1,.91,[.25,1,.1],still(),pose([.4,.7,0]))]),
 example('齿突基底部骨折','断面通过齿突与椎体交界部。','对照齿突基底断面和寰椎环的位置。',[cut('Axis',1,.72,[0,1,.15],still(),pose([0,1,-2],[5,0,0]))])
]);
function plank(id,label,bone,ref,axis,level,n,delta,neighbors,observe,turn=[0,0,0]){
 add(id,label,'躯干','按受累位置',ref,neighbors,[example(label+'骨折','本例按局部骨性标志示意断裂与移位。',observe,[cut(bone,axis,level,n,pose(delta,turn),still())])]);
}
plank('sternal-body','胸骨体','Body of sternum','STERNUM',1,.5,[0,1,.18],[0,-.6,-3],['Manubrium','Xiphoid process'],'侧面可见前后皮质错阶。');
plank('xiphoid','剑突','Xiphoid process','STERNUM',1,.70,[.2,1,0],[0,-1,-1.5],['Body of sternum'],'定位胸骨体下方较薄的剑突，观察近侧断面。');
add('manubrium','胸骨柄','躯干','按断线方向','STERNUM',['Body of sternum','Right clavicle','Left clavicle'],[
 example('横形','胸骨柄可在上胸壁受力后横向断裂。','侧面比较上下骨片前后关系。',[cut('Manubrium',1,.45,[0,1,0],pose([0,1,-3]),still())]),
 example('斜形','斜向断裂可伴旋转。','追踪断线走向及柄部与胸锁关节的空间关系。',[cut('Manubrium',1,.55,[.85,1,0],pose([-1,-1,-2],[0,4,0]),still())])
]);
plank('sacrum','骶骨翼','Sacrum','AO-SACRUM',0,.17,[1,.05,.08],[-3,4,0],['Right hip bone','Left hip bone'],'以骶孔为参照，观察孔外骶翼的纵向断面。');
plank('scapula','肩胛骨体','Right scapula','AO-SCAPULA',1,.46,[.25,1,.2],[-2,-3,2],['Right clavicle','Right humerus'],'旋转查看肩胛骨体的薄板状断面，关节盂位于上外侧。',[3,0,-3]);

const fingers=['index finger','middle finger','ring finger','little finger'],digits=['示指','中指','环指','小指'];
for(const [digit,label] of [...fingers.map((d,i)=>[d,digits[i]]),['thumb','拇指'],...['big','second','third','fourth','little'].map((n,i)=>[n+' toe',['拇趾','第二趾','第三趾','第四趾','第五趾'][i]])]){
 const foot=digit.endsWith('toe'),region=foot?'下肢':'上肢',axis=foot?2:1;
 const reference=foot?'教材第六章第三节 · 趾骨':'教材第六章第二节 · 指骨';
 const bone=part=>part+' phalanx of right '+digit,hasMiddle=digit!=='thumb'&&digit!=='big toe';
 const context=[bone(hasMiddle?'Middle':'Proximal')];
 const tip=bone('Distal'),tipNormal=foot?[0,-.35,1]:[0,-1,0];
 add('tip-'+digit.replaceAll(' ','-'),label+'末节',region,'按骨折线形态',reference,context,[
  example('末节横断','末节损伤可呈横断形态。','比较末端骨片与近侧断面的分离和侧移。',[cut(tip,axis,.5,tipNormal,still(),pose([.4,foot?0:-.8,foot?.8:0]),{shaftAngle:0})]),
  example('末端粉碎','末节粗隆受局部挤压时可出现多个骨片。','从末端看多个小骨片，保留近侧基底。',[cut(tip,axis,foot?.73:.28,tipNormal,still(),pose([0,0,.4]),{shaftAngle:0,second:[1,.1,0],branches:[pose([-.5,0,0]),pose([.6,0,0])]})])
 ]);
 if(hasMiddle||digit==='thumb'){
  const part=digit==='thumb'?'Proximal':'Middle',current=bone(part);
  add('shaft-'+digit.replaceAll(' ','-'),label+(part==='Middle'?'中节':'近节'),region,'按断线走行',reference,[bone('Distal')],[
   example('横断','短管状骨骨干可横向断裂。','顺着骨干比较两侧皮质是否连续。',[cut(current,axis,.5,tipNormal,still(),pose([.6,0,foot?.8:1]),{shaftAngle:0})]),
   example('斜形','骨干断线与长轴斜交，断端可侧移。','从两个方向看斜线与骨片的相对位置。',[cut(current,axis,.47,foot?[.75,-.3,1]:[.65,-1,0],still(),pose([1,0,.7],[3,0,0]),{shaftAngle:38})])
  ]);
 }
}
for(const [n,neighbor] of [['third','second'],['fourth','fifth']]){
 const bone='Right '+n+' metacarpal bone';
 add('palm-'+n,bone==='Right third metacarpal bone'?'第三掌骨干':'第四掌骨干','上肢','按断线走行','教材第六章第二节 · 掌骨',['Right '+neighbor+' metacarpal bone'],[
  example('横断型','掌骨干可发生横断，单根骨的移位常受邻骨限制。','从掌背面追踪皮质，从侧面观察成角。',[cut(bone,1,.50,[0,1,-.2],pose([1,0,-1],[-7,0,0]),still(),{shaftAngle:0})]),
  example('斜形','骨干斜行断裂可出现侧移及短缩。','比较相邻掌骨与伤骨的长轴。',[cut(bone,1,.48,[.8,1,.15],pose([0,-1.5,-.4]),still(),{shaftAngle:38})])
 ]);
}
for(const [n,label] of [['first','第一'],['fifth','第五']]){
 const bone='Right '+n+' metatarsal bone',art=n==='fifth';
 add('foot-'+n,label+'跖骨','下肢','按骨折部位','教材第六章第三节 · 跖骨',[art?'Right cuboid bone':'Right medial cuneiform bone'],[
  example('骨干骨折','跖骨干断裂后邻近跖骨可限制移位。','在足背方向看断线和跖骨排列。',[cut(bone,2,.52,[.35,-.4,1],still(),pose([.6,0,1]))]),
  example(art?'基底部撕脱':'基底部骨折',art?'第五跖骨基底部可出现局部撕脱骨片。':'第一跖骨近端骨折可影响第一跖跗关节关系。','沿跖骨追到近端，观察骨片与跗骨的位置。',[cut(bone,2,art?.13:.17,art?[.4,-.5,1]:[.2,-.4,1],pose([-.7,.3,-1.1]),still())])
 ]);
}
for(const [slug,bone,label,axis,level,n,near,ob] of [
 ['triquetrum','Right triquetral','三角骨背侧缘',2,.18,[0,.15,1],'Right lunate','取掌背方向辨认小的背侧边缘骨片。'],
 ['lunate','Right lunate','月骨体',2,.50,[0,.1,1],'Right capitate','比较骨块与桡骨、头状骨之间的关节面。'],
 ['pisiform','Right pisiform','豌豆骨',1,.52,[.1,1,0],'Right triquetral','腕掌尺侧查看豌豆骨与三角骨的关系。'],
 ['hamate','Right hamate','钩骨体',2,.42,[.1,.2,1],'Right capitate','从腕背观察体部断面与远侧掌骨基底的关系。'],
 ['capitate','Right capitate','头状骨颈',1,.69,[0,1,.1],'Right lunate','从近侧头部向远侧体部追踪断裂的位置。'],
 ['trapezium','Right trapezium','大多角骨体',0,.50,[1,.15,0],'Right first metacarpal bone','转至拇指掌腕关节端，观察纵向劈裂。'],
 ['trapezoid','Right trapezoid','小多角骨体',2,.50,[.1,0,1],'Right second metacarpal bone','以第二掌骨基底为参照观察骨体斜断。'],
 ['navicular','Navicular bone of right foot','足舟骨体',0,.50,[1,.1,.25],'Right talus','观察近侧距舟与远侧舟楔关节面的关系。'],
 ['cuboid','Right cuboid bone','骰骨体',2,.52,[.15,.1,1],'Right calcaneus','比较外侧柱长度和跟骰、跖骰两端的方向。'],
 ...['medial','intermediate','lateral'].map((n,i)=>['cuneiform-'+n,'Right '+n+' cuneiform bone',['内侧','中间','外侧'][i]+'楔骨',2,.5,[.3,.1,1],'Navicular bone of right foot','沿内侧柱看骨片与相邻跖骨、足舟骨的相对位置。']),
 ...['Sesamoid bone of right foot','Sesamoid bone of right foot FJ3376'].map((b,i)=>['sesamoid-'+i,b,['第一跖骨头内侧籽骨','第一跖骨头外侧籽骨'][i],2,.5,[0,0,1],'Right first metatarsal bone','从足底面查看该枚籽骨。正常分叶需另结合边缘形态判断。'])
]){
 const foot=['navicular','cuboid'].includes(slug)||slug.startsWith('cuneiform')||slug.startsWith('sesamoid');
 add(slug,label,foot?'下肢':'上肢','按局部断面',slug.startsWith('sesamoid')?'SESAMOID':foot?'AO-MIDFOOT':'AO-CARPAL',[near],[
  example(label+'骨折','按该骨的局部解剖展示一条代表性断面；移位为示意值。',ob,[cut(bone,axis,level,n,pose([-.7,.4,-.8],[0,3,0]),still())])
 ]);
}

for(const [id,bone,title,point,n,near,dentable] of [
 ['frontal','Frontal bone','额骨鳞部',[.32,.65,.86],[1,.45,.22],'Right parietal bone',true],
 ['parietal','Right parietal bone','顶骨',[.20,.65,.53],[.15,.5,1],'Frontal bone',true],
 ['occipital','Occipital bone','枕骨鳞部',[.38,.68,.05],[1,.2,.2],'Right parietal bone',true],
 ['temporal','Right temporal bone','颞骨鳞部',[.16,.72,.54],[.1,1,.55],'Right parietal bone',false],
 ['ethmoid','Ethmoid','筛骨眶内侧壁',[.03,.48,.55],[.12,1,.4],'Right maxilla',false],
 ['sphenoid','Sphenoid bone','蝶骨大翼区',[.15,.61,.48],[.35,1,.25],'Right temporal bone',false],
 ['maxilla','Right maxilla','上颌骨前壁',[.45,.44,.86],[1,.35,.17],'Right zygomatic bone',false],
 ['palatine','Right palatine bone','腭骨水平板',[.5,.12,.61],[1,0,.24],'Right maxilla',false],
 ['vomer','Vomer','犁骨骨性鼻中隔',[.5,.53,.53],[.12,1,.35],'Ethmoid',false]
]){
  const variants=[example('局部线形骨折','在相应解剖区标出骨面连续性受损的局部走行。','单独转动目标骨，观察高亮裂线相对邻近骨缝和骨壁的位置。',[trace(bone,1,point,n,.22)])];
  if(dentable)variants.push(example('局限性凹陷形态','局部颅盖可出现骨面向颅内凹陷。','斜视外板轮廓，比较局部凹陷和周围正常曲面；骨膜和脑组织未建模。',[dent(bone,point,n)]));
  add(id,title,'头颈','按局部形态 · 颅颌面补充',dentable||id==='temporal'||id==='sphenoid'||id==='ethmoid'?'AO-SKULL':'AO-CMF',[near],variants);
}
add('nasal','鼻骨','头颈','按移位形态','AO-CMF',['Left nasal bone','Right maxilla'],[
 example('无明显移位','在鼻骨表面显示局部裂线。','比较双侧鼻骨轮廓与鼻背中线。',[trace('Right nasal bone',1,[.46,.5,.78],[.2,1,0],.35)]),
 example('移位示例','局部鼻骨骨片可产生压入或偏移。','从前方观察轮廓不对称，再侧转查看骨片的前后位置。',[cut('Right nasal bone',2,.75,[.12,0,1],still(),pose([-.8,-.4,1.3],[0,2,0]))])
]);
add('zygoma','颧骨','头颈','按受累区域','AO-CMF',['Right maxilla','Right temporal bone'],[
 example('颧弓区局部骨折','以颧骨颞突与颞骨颧突形成的弓形结构为参照。','从头端观察颧弓局部内移，本例仅显示颧骨侧骨片。',[cut('Right zygomatic bone',2,.22,[.1,0,1],pose([2.5,0,0],[0,3,0]),still())])
]);
add('mandible','下颌骨','头颈','按骨折部位','AO-MANDIBLE',['Right temporal bone','Left temporal bone'],[
 example('体部骨折','骨折线穿过下颌体。','沿下缘观察连续性，比较断端的高度与侧移。',[cut('Mandible',0,.25,[1,.08,.08],pose([0,1,-1]),pose([1,-2,0]))]),
 example('右髁突颈骨折','断面位于下颌骨右侧髁突颈。','髁头保留在下颌窝内，观察颈部断面与远段的轻度移位。',[cut('Mandible',1,.87,[-.9,.85,-.22],pose([1.4,-1.6,-.5],[0,1,0]),still(),{nativePoint:[.11,.85,.14]})])
]);
add('hyoid','舌骨','头颈','按受累部位','HYOID',[],[example('大角骨折','以舌骨体和大角连接区为参照观察一侧骨片。','从上方辨认 U 形骨体和两侧大角；本例为右侧。',[cut('Hyoid bone',0,.24,[1,.1,.18],pose([-.8,0,.7]),still())])]);
// Adjacent bones retain articulation with the fragment bearing their joint surface.
for(const c of list)for(const [index,v] of c.variants.entries()){
 if(c.id.startsWith('region-shaft-'))v.bind={[c.context[0]]:1};
 if(c.id==='region-sacrum')v.bind={'Right hip bone':0};
 if(c.id==='region-sternal-body')v.bind={'Xiphoid process':0};
 if(c.id==='region-manubrium')v.bind=index===1?{'Body of sternum':0,'Right clavicle':0}:{'Body of sternum':0};
}
export const supplementalCourses=list;
