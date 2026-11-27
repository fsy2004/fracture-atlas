import {addCases,cut,foot,motion,rest,right,teachingCase} from './textbook-case.js';

const {humerus,radius,ulna,femur,tibia,fibula,hip,patella,talus,calcaneus}=right;
const up=[0,1,0], zero=rest.shift;
const shoulder='Right scapula';
const finger='Proximal phalanx of right index finger';
const fingertip='Distal phalanx of right index finger';
const palms=['second','third','fourth'].map(n=>'Right '+n+' metacarpal bone');
const wrist=['scaphoid','lunate','triquetral','pisiform','trapezium','trapezoid','capitate','hamate'].map(n=>'Right '+n);
const lumbar='First lumbar vertebra', above='Twelfth thoracic vertebra', below='Second lumbar vertebra';
const pelvis=['Left hip bone','Sacrum'];
const ribNumbers=['fifth','sixth','seventh'].map(n=>'Right '+n+' rib');
const ankleFoot=foot.filter(n=>![tibia,fibula].includes(n));
const f=(name,cuts,clinical,points,options)=>teachingCase(name,cuts,points,clinical,options);
const bend=(bone,level,axis,direction,angle,options={})=>
 cut(bone,level,up,rest,rest,{axis,bend:{direction,angle,...options}});
const trace=(bone,axis,point,normal,extent=.20)=>
 ({bone,axis,level:point[axis],nativePoint:point,normal,extent,surface:'trace'});
const dent=(bone,point,extent,depth,spread)=>({
 bone,axis:1,level:point[1],nativePoint:point,normal:up,extent,surface:'dent',depth,spread
});
const seeded=(bone,point,normal,minus,plus,extra={})=>
 cut(bone,point[extra.axis??1],normal,minus,plus,{nativePoint:point,...extra});
const moving=(names,shift,turn=zero,options={})=>({names,shift,turn,...options});

function upperLimb(courses){
 const add=(id,ref,rows)=>addCases(courses,id,'第六章 · 第二节｜'+ref,rows);
 add('clavicle','一｜PDF 311–313 页',[
  f('儿童青枝骨折',[bend('Right clavicle',.5,0,[0,1,0],8)],'clavicle',[
   '儿童锁骨中段具有较大的弹性，受压侧皮质和骨膜仍有连续性。',
   '观察向上成角及凸侧局部裂线，沿凹侧可追踪相连的骨面。'
  ],{span:.15,child:true})
 ]);
 add('elbow','四｜图 6-26 · PDF 325–328 页',[
  ...[[1,'尺偏','内','外'],[-1,'桡偏','外','内']].map(([sign,dir,side,other])=>
   f('伸直'+dir+'型',[cut(humerus,.085,[0,1,.65],motion([5*sign,-1,-8],[0,0,-7*sign]))],'supracondylar',[
    '伸直机制使远段后移，本例同时偏向'+(sign>0?'尺':'桡')+'侧。',
    '正位辨认'+side+'侧骨皮质挤压、'+other+'侧张开，侧位核对共同的后移特征。'
   ],{span:.16})),
  f('粉碎型（Y形）',[cut(humerus,.085,[0,-1,0],rest,motion([0,-4,0]),{
   second:[1,0,0],fold:.74,branches:[motion([-3,-1,0]),motion([3,-1,0])]
  })],'supracondylar',[
   '双斜支向髁间汇合，使肱骨远端出现内、外髁骨块。',
   '从正面和远端看三支断线，与同部位横线加纵裂的T形例鉴别。'
  ],{span:.16})
 ]);
 add('lateral-elbow','五｜图 6-30 · PDF 332–333 页',[
  ...[[1,'前'],[-1,'后']].map(([s,d])=>f(d+'移翻转',[
   cut(humerus,.06,[-1,-.54,0],rest,motion([-38,8,13*s],[30*s,0,92]),{anchor:[-.220,1.129,-.031],plusPath:[[-32,7,0]],sidePaths:s>0?
    {Right:[[-34,16,0],[-44,32,30]],Left:[[-34,43,-8],[-34,43,5]]}:
    {Right:[[-28,16,-13],[-38,32,-43]],Left:[[-28,16,-6],[-38,32,-36]]}})
  ],'lateral-elbow',[
   '外髁骨块脱离外侧柱并向'+d+'移翻转，关节面转离原有肱桡方向。',
   '用侧位确认骨块位于肱骨下端的'+d+'方，再转至外侧辨认骨片关节面。'
  ],{context:[radius,ulna],span:.15,child:true}))
 ]);
 add('olecranon','七｜图 6-33 · PDF 339 页',[
  f('关节外小撕脱',[cut(ulna,.984,[0,1,-.55],rest,motion([0,4,-1]))],'olecranon',[
   '肱三头肌于鹰嘴尖附着处牵下小骨片，断线位于关节外。',
   '从后外方追踪半月切迹，关节面保持连续可与大块鹰嘴骨折区别。'
  ],{context:[humerus],span:.11})
 ]);
 add('radial-head','八｜图 6-34 · PDF 341 页',[
  f('青枝骨折',[bend(radius,.923,1,[-1,0,0],7,{end:'positive'})],'radial-head',[
   '儿童桡骨近端受弯，凸侧皮质局部裂开，受压侧保持连续。',
   '围绕桡骨颈看成角和仅在一侧的短裂线，桡骨头保持整体。'
  ],{child:true}),
  f('轻度移位',[cut(radius,.957,up,rest,motion([-1.5,0,.6]))],'radial-head',[
   '桡骨头颈有轻微横向阶差，从肱骨小头方向看大部分关节面仍相对。',
   '与无移位例相比需辨别皮质错台，旋转视角可与单纯嵌插区分。'
  ]),
  f('嵌插合并移位',[cut(radius,.942,up,rest,motion([-5,-1.8,1]),{impaction:true})],'radial-head',[
   '桡骨头沿桡骨颈轴线嵌入，同时发生侧移与倾斜。',
   '比较肱骨小头下方的桡骨头高度和侧方阶差，两个方向的改变可同时存在。'
  ],{context:[humerus]}),
  f('儿童骨骺分离',[cut(radius,.955,up,rest,motion([-3,0,0]),{physis:{type:1,side:1}})],'radial-head',[
   '断裂主要沿近端骺板通过，骨骺相对干骺端滑移。',
   '半透明带标示儿童骺板位置，联合肱骨小头参照区分颈部断裂与经骺板分离。'
  ],{child:true,related:['physis-injury']})
 ].map(v=>({span:.105,context:[humerus,ulna],...v})));
 add('single-forearm','十一｜图 6-42 · PDF 353–354 页',[
  f('幼儿青枝骨折',[bend(radius,.43,1,[-1,0,0],8)],'forearm',[
   '幼儿桡骨干凸侧局部断裂，受压侧皮质和骨膜连续，尺骨保持完整。',
   '以尺骨作参照，从正面看桡骨弯曲是否改变骨间隙。'
  ],{child:true,context:[ulna],span:.18})
 ]);
 add('galeazzi','十二｜图 6-44 · PDF 356–358 页',[
  f('稳定型（青枝）',[bend(radius,.22,1,[-1,0,0],4.5)],'galeazzi',[
   '桡骨下段为连续皮质铰接的青枝形态，下尺桡关节轻度失去对位。',
   '顺桡骨远段看成角，再看尺骨头相对桡骨远端的位置，分别评价两处改变。'
  ],{child:true,context:[ulna,...wrist],moving:[moving([ulna],[2,0,1],zero,{timing:[.08,.65]})]}),
  f('稳定型（尺骨远端骨骺滑脱）',[
   cut(radius,.22,up,motion([0,1,3],[0,0,2])),
   cut(ulna,.07,up,motion([2.5,-1,3]),rest,{physis:{type:1,side:-1}})
  ],'galeazzi',[
   '儿童桡骨下段骨折有时伴尺骨远端经骺板分离，骺片可维持与桡骨的相对关系。',
   '分别辨认尺骨干骺端与虚拟骺板的阶差，以及桡骨自身的骨折线。'
  ],{child:true,related:['physis-injury']}),
  f('不稳定型（螺旋）',[cut(radius,.22,[.75,1,.25],motion([-2,-16,7],[0,0,5]),rest,{helix:true,minusPath:[[-3,-9,0]]})],'galeazzi',[
   '扭转载荷可使断线沿桡骨下段绕行并伴远段旋转。',
   '转动观察骨折线绕过桡骨干，并以尺骨头定位下尺桡失对位。'
  ],{context:[ulna]}),
  f('不稳定型（粉碎）',[cut(radius,.22,[.7,1,.3],rest,motion([0,2,-2]),{
   second:[.9,.35,-.3],splitSide:0,branches:[motion([-5,-7,7]),motion([2,-7,4])]
  })],'galeazzi',[
   '下段桡骨粉碎使皮质支撑减少，观察主体远段与独立中间片。',
   '从远端核对桡骨长度和尺骨头相对位置，区分粉碎例与连续螺旋断线。'
  ],{context:[ulna]})
 ].map(v=>({span:.17,...v})));
 add('radius','十三｜图 6-47 · PDF 361 页',[
  f('伸直型（轻度嵌插无明显移位）',[cut(radius,.085,[0,1,.18],motion([0,1.5,0]),rest,{impaction:true})],'distal-radius',[
   '较轻的背伸传达暴力可仅在干骺端形成轻度嵌插，桡骨远端基本保持轴线。',
   '在侧面比较伤前和终帧，辨认短距离轴向嵌插与典型伸直型的背移背倾。'
  ],{span:.155,follow:wrist})
 ]);
 add('metacarpal','十五｜图 6-52、6-53 · PDF 370–372 页',[
  f('多根掌骨干骨折',palms.map((bone,i)=>cut(bone,.50,[.45,1,.18],motion([[2,0,-2][i],-1.6,-1-i*.5],[-7,0,0]))),'metacarpal',[
   '压砸可同时折断数根掌骨骨干，掌骨间支撑减少。',
   '逐根核对第2至第4掌骨长度、成角和旋转，用掌弓及指轴关系辨认整体畸形。'
  ],{span:.13})
 ]);
 add('finger','十六｜图 6-58、6-59、6-62 · PDF 375–380 页',[
  f('指骨颈骨折',[cut(finger,.20,up,motion([0,-2,-3],[75,0,0]))],'finger',[
   '近节指骨颈断裂后，远端小骨片可随中节向背侧翻转。',
   '侧位辨认骨颈处的掌侧成角和骨头翻转，并核对骨折线与关节面的距离。'
  ],{span:.063}),
  f('末节指骨基底背侧撕脱（锤状指）',[
   cut(fingertip,.82,[0,.75,-1],motion([0,-2.2,-.1],[-25,0,0]),motion([0,-.4,-1.2]))
  ],'mallet',[
   '伸肌终腱在末节指骨背侧基底牵下小骨片，远端指间关节主动伸直受限。',
   '观察末节主体掌屈和背侧骨片留在近端，同时核对基底关节面的受累。'
  ],{context:['Middle phalanx of right index finger'],span:.049}),
  f('螺旋形骨折',[cut(finger,.51,[.5,1,.7],motion([0,-6,-.5],[0,8,0]),rest,{helix:true,minusPath:[[0,-7,0]]})],'finger',[
   '扭转时断线沿示指近节骨干绕行，掌面与背面所见走向不同。',
   '将中远节轴线与邻指比较，留意屈曲时旋转畸形造成的指尖交叉。'
  ],{span:.065}),
  f('关节内骨折',[cut(finger,.90,[.9,.55,.3],rest,motion([1.6,-.7,-.4]))],'finger',[
   '示指近节基底的小骨块带有关节面，断线从关节内延入骨骺端。',
   '沿掌骨头的关节弧辨别约毫米级的局部错台和保留的其余接触面。'
  ],{span:.065,context:[palms[0]]})
 ]);
}

function lowerLimb(courses){
 const add=(id,ref,rows)=>addCases(courses,id,'第六章 · 第三节｜'+ref,rows);
 const neck=(level,n,move,extra)=>cut(femur,level,n,move,rest,{neckLevel:level,...extra});
 const neckOptions={span:.22,context:[hip]};
 add('neck','一｜图 6-66 至 6-68 · PDF 383–387 页',[
  f('外展型',[neck(.94,[.47,1,.1],motion([0,1.8,0]),{impaction:true})],'neck',[
   '外展型Linton角往往小于30°，较水平的断线使局部剪力较小。',
   '冠状方向观察头下较平缓的断线及嵌插，股骨头仍以髋臼为参照。'
  ],{...neckOptions,linton:25}),
  f('内收型',[neck(.92,[1,1,.08],motion([2,7,-2],[0,-12,7]),{minusPath:[[-4,-3,0]]})],'neck',[
   '内收型Linton角在45°左右，骨折端剪力较大，稳定性较低。',
   'Linton角大于70°时剪力更显著。按冠状面水平参考线量角，并辨认易移位的近垂直断线。'
  ],{...neckOptions,linton:45}),
  f('Garden Ⅰ型',[neck(.94,[.55,1,.1],rest,{bend:{direction:[1,0,0],angle:5,end:'negative'}})],'neck',[
   'Ⅰ型为不完全骨折，常呈外翻嵌插，仍有部分骨结构相连。',
   '观察皮质连续侧、相对轻微成角和短裂线。'
  ],neckOptions),
  f('Garden Ⅱ型',[neck(.92,[.9,1,.08],rest,{completeTrace:true})],'neck',[
   'Ⅱ型断线完整，股骨头和股骨颈保持对位。',
   '用断缘显示辨认贯穿断线，与Ⅰ型仍保留连续骨桥相鉴别。'
  ],neckOptions),
  f('Garden Ⅲ型',[neck(.92,[.9,1,.08],motion([1,4,-2],[0,-8,4]),{minusPath:[[-2,-1,0]]})],'neck',[
   'Ⅲ型为完全骨折并部分移位，断端仍有部分接触或对应关系。',
   '比较股骨头与股骨颈的相对方向和断面对合，髋臼中的股骨头可有倾斜。'
  ],neckOptions),
  f('Garden Ⅳ型',[neck(.92,[.9,1,.08],motion([-14,17,-7],[0,-16,9]),{minusPath:[[-11,-5,0]]})],'neck',[
   'Ⅳ型为完全移位，骨折面失去残余对合。',
   '从正斜位看骨干侧完全脱离股骨头颈断面，而股骨头仍可在髋臼内。'
  ],neckOptions)
 ]);
 const inter=(extra={},shift=[0,-2,0],turn=zero)=>cut(femur,.87,[.82,1,0],motion(shift,turn),rest,{trochanterSite:true,...extra});
 const fragmented={second:[1,.25,.2],splitSide:0,branches:[motion([-4,-1,0],[0,-5,5]),motion([3,-2,0])]};
 add('trochanter','二｜图 6-72 · PDF 391–392 页',[
  f('顺转子间粉碎型',[inter(fragmented,[-5,-6,0])],'trochanter',[
   '主断线从大转子沿内下方向延展，同时形成转子间游离骨片。',
   '寻找小转子和内侧支柱的独立断面，区别单条顺转子间断线与粉碎形态。'
  ]),
  f('Evans 稳定型',[inter()],'trochanter',[
   '按Evans评估稳定性时，内侧皮质接触和支撑可帮助维持对位。',
   '沿小转子下方追踪内侧支柱，与移位后支撑不足的例子比较。'
  ]),
  f('Evans 欠稳定型',[inter({},[-1,-4,1],[0,-6,0])],'trochanter',[
   '此例以内侧局部张开示意支撑不足，稳定性取决于接触能否恢复。',
   '从内后方辨认一侧断缘接触减少，比较复位前两骨段的对线和压缩侧。'
  ]),
  f('Evans 不稳定型',[inter(fragmented,[-6,-9,1],[0,-9,6])],'trochanter',[
   '内侧支柱粉碎、游离小转子区骨片使骨折失去支撑，易短缩和外旋。',
   '在内后侧找到骨片脱离及支柱缺口，再比较单纯局部张开的欠稳定选例。'
  ])
 ].map(v=>({span:.24,context:[hip],...v})));
 add('femur','三｜图 6-73 · PDF 394–395 页',[
  f('儿童青枝骨折',[bend(femur,.50,1,[-1,0,0],6)],'femur',[
   '儿童股骨干可出现单侧皮质破裂、对侧连续的不完全骨折。',
   '比较伤前与终帧骨轴，观察中段均匀成角及凸侧不贯穿的裂线。'
  ],{child:true,span:.24})
 ]);
 add('tibia','八｜图 6-85 · PDF 412–414 页',[
  f('儿童青枝骨折',[bend(tibia,.50,1,[1,0,0],6)],'tibia',[
   '儿童胫骨受弯时可仅一侧破裂，另一侧骨皮质保持连续。',
   '观察局部成角与凸侧裂线，并以保持完整的腓骨比较小腿力线。'
  ],{child:true,context:[fibula],span:.23}),
  f('裂纹骨折',[trace(tibia,1,[.52,.50,.90],[0,1,.1],.067)],'tibia',[
   '胫骨前内缘可见不贯穿的裂纹，骨段对位保留。',
   '观察是否仅局限在一面皮质，同时与有弯曲和铰链的青枝骨折对照。'
  ],{context:[fibula],span:.18})
 ]);
 add('patella','六｜PDF 406–407 页',[
  f('裂纹骨折',[trace(patella,1,[.47,.53,.96],[0,1,.15],.38)],'patella',[
   '髌骨裂纹例保留整体对位，局部线状损伤可出现在前面。',
   '辨认未分离的上下极与伸膝装置，区别明显间隙的横形骨折。'
  ],{span:.115,context:[femur]}),
  f('星状骨折',[cut(patella,.50,[.14,1,.06],rest,rest,{star:true})],'patella',[
   '直接撞击可使数条裂纹自髌骨前面中心向周边放射，骨片位移很小。',
   '正面看共同起点及放射线，侧位核对伸膝装置和关节面是否仍基本对位。'
  ],{span:.115,context:[femur]})
 ]);
 const malleolus=cut(tibia,.045,[-.8,1.4,0],motion([2,-2,0]),rest,{anchor:[-.053,.082,-.025]});
 const lateral=cut(fibula,.10,[.48,1,.4],motion([-3,-2,0]),rest);
 const footMove=(shift,turn,waypoints)=>moving(ankleFoot,shift,turn,{pivotPoint:{bone:talus,point:[.5,.75,.45]},via:waypoints});
 const ankle=(name,spec,shift,turn,points,waypoint)=>f(name,spec,'ankle',points,{
  span:.18,context:ankleFoot,moving:[footMove(shift,turn,waypoint)]
 });
 add('ankle','九｜图 6-89 至 6-91 · PDF 419–422 页',[
  ankle('外旋损伤',[lateral],[-4,-4,0],[0,-18,0],[
   '足相对小腿外旋，可累及下胫腓联合及腓骨远端。',
   '俯视比较足长轴与踝穴方向，观察外踝短斜断线及下胫腓关节间距。'
  ],[0,-5,0]),
  ankle('纵向挤压损伤',[{...dent(tibia,[.54,.015,.56],.083,.006,[.032,.042]),normal:[0,-1,0]}],[0,1.2,0],zero,[
   '跟足向上承重时，距骨上顶，轴向载荷可压陷胫骨远端负重面。',
   '正位核对距骨向上的平移，再沿踝穴看负重面的局部高度变化。'
  ]),
  ankle('侧方挤压损伤',[lateral],[8,-5,0],[0,0,-5],[
   '侧方挤压方向决定足组横移和一侧踝部破坏，本例示意外向内受力。',
   '正面辨认距骨内移与外踝骨片，侧位比较前后方向保持程度。'
  ],[0,-6,0]),
  ankle('跖屈损伤',[seeded(tibia,[.52,.045,.22],[0,1,-.8],motion([0,-3,-1]),rest)],[0,-5,-1],[18,0,0],[
   '过度跖屈可使踝后缘受载，本例选用后缘局部骨折。',
   '侧面沿足长轴辨别跖屈，并在胫骨后缘定位相应骨折线。'
  ]),
  ankle('背伸损伤',[seeded(tibia,[.51,.048,.78],[0,1,.8],motion([0,-3,1]),rest)],[0,-5,1],[-18,0,0],[
   '踝过度背伸时前方接触区承压，本例选用胫骨前缘骨折。',
   '在侧面比较前缘断线及足背靠近胫骨的角度，与跖屈后缘例对照。'
  ]),
  ankle('Ⅰ度（单踝）',[malleolus],zero,zero,[
   'Ⅰ度仅有一个踝骨折，本例取内踝，外踝和后踝完整。',
   '核对距骨仍位于踝穴，判读时分别评价骨折数量与关节对位。'
  ]),
  ankle('Ⅱ度（双踝伴轻度脱位）',[malleolus,lateral],[6,-13,0],[0,0,9],[
   'Ⅱ度内、外踝均可骨折，并伴距骨轻度脱位。',
   '在正位辨认距骨滑车的侧移与踝穴不对称，后缘无独立骨折片。'
  ],[0,-14,0]),
  ankle('Ⅲ度（三踝伴脱位）',[{...malleolus,second:[0,.56,1],secondPoint:[.55,.073,.36],splitSide:1,
   branches:[motion([4,1,-6]),rest]},{...lateral,minus:motion([-5,-4,-2])}],[15,-20,-5],[0,0,15],[
   'Ⅲ度在内、外踝骨折之外还分出胫骨后踝骨片，伴明显距骨脱位。',
   '侧位辨认后踝骨片和距骨位置，正位核对两踝断线及距骨侧方错移。'
  ],[0,-19,0])
 ]);

 const hindfoot=foot.filter(n=>n!==talus);
 const ankleContext=[tibia,fibula,...hindfoot];
 add('talus','十｜图 6-93 · PDF 424–425 页',[
  f('距骨颈骨折伴距骨体后脱位',[
   cut(talus,.70,[0,.2,1],motion([5,-9,-29],[0,-5,-3]),motion([0,-19,17]),{axis:2,minusPath:[[0,-7,-7],[3,-9,-18]],plusPath:[[0,-16,6]],minusTiming:[.48,.98],plusTiming:[.14,.58]})
  ],'talus',[
   '距骨颈断裂后颈头块与体块分离，距骨体可向踝穴后方脱出。',
   '侧位同时核对胫距与距跟对位，辨认向后翻转的体块和距骨体血供风险。'
  ],{context:ankleContext,bind:Object.fromEntries(hindfoot.map(n=>[n,1])),span:.16}),
  f('距骨后唇骨折伴前脱位',[
   cut(talus,.105,[0,.32,1],motion([0,0,-3]),motion([0,-11,27],[10,0,3]),{axis:2,plusPath:[[0,-14,7]]})
  ],'talus',[
   '过度跖屈时距骨后唇受挤压，独立后唇片留在体块后方。',
   '观察距骨滑车前移到踝穴之前，辨别与距骨颈骨折伴后脱位的反向关系。'
  ],{context:ankleContext,bind:Object.fromEntries(hindfoot.map(n=>[n,1])),span:.16})
 ]);
 add('calcaneus','十一｜图 6-95 · PDF 426–429 页',[
  f('结节纵形骨折',[seeded(calcaneus,[.49,.38,.23],[-1,0,0],rest,motion([-1.8,0,-.6]),{axis:2,regionPlanes:[[[-1,0,0],[.45,.45,.21]],[[0,0,-1],[.45,.45,.35]]]})],'calcaneus',[
   '后结节呈近纵向断裂，属于未累及距跟负重关节面的代表例。',
   '由后面追踪裂线在结节内的走向，与跟腱牵拉造成的横形撕脱比较。'
  ]),
  f('载距突骨折',[seeded(calcaneus,[.72,.71,.59],[1,.35,-.22],rest,motion([3,-3,0]))],'sustentaculum',[
   '内侧载距突从根部折开，应沿内侧骨性突起区辨认骨片。',
   '追踪载距突下方拇长屈肌腱的通道，同时核对距跟相对面。'
  ]),
  f('外侧距跟关节面塌陷',[dent(calcaneus,[.27,.96,.57],.23,.004,[.015,.020])],'calcaneus',[
   '距跟负重面的外侧区域下陷，内侧仍有相对保留的关节面。',
   '俯视比较内外高度，侧位观察塌陷中心与周缘的阶差。'
  ]),
  f('全部距跟关节面塌陷',[dent(calcaneus,[.49,.97,.59],.47,.006,[.034,.047])],'calcaneus',[
   '示例中距跟主要负重关节面广泛下降，结节关节角减小。',
   '比较全幅高度损失与局限于外侧的一块压陷，并查看整个后关节面。'
  ])
 ].map(v=>({context:[talus],span:.13,...v})));
 add('metatarsal','十二｜图 6-100 · PDF 434–436 页',[
  f('第2跖骨颈疲劳骨折',[trace('Right second metatarsal bone',2,[.51,.87,.78],[0,0,1],.15)],'metatarsal',[
   '反复负荷可在第2跖骨颈形成疲劳裂线，初期通常保留骨段对位。',
   '在骨头近侧找细裂线，与急性骨干完全断裂的部位及断端移位鉴别。'
  ],{context:['Right first metatarsal bone','Right third metatarsal bone'],span:.095})
 ]);
}

function trunk(courses){
 const add=(id,ref,rows)=>addCases(courses,id,'第六章 · 第四节｜'+ref,rows);
 const ribCut=(bone,dual)=>cut(bone,.39,[0,0,1],motion([0,0,-1.6]),motion([4,0,dual?0:.8]),{
  axis:2,...(dual?{second:[0,0,-1],secondLevel:.67,branches:[motion([-4,0,1.6]),rest]}:{})
 });
 add('rib','一｜图 6-102、6-103 · PDF 438–440 页',[
  f('单根双处骨折',[ribCut(ribNumbers[1],true)],'rib',[
   '一根肋骨在不同部位折断，分出前后两条断线及其中间游离段。',
   '沿右第6肋的胸壁弧线确认两处断面均属于同一根肋骨。'
  ],{context:[ribNumbers[0],ribNumbers[2]]}),
  f('多根肋骨骨折',ribNumbers.map(n=>ribCut(n,false)),'rib',[
   '多根相邻肋骨可在同一区域同时折断，本例每根一处。',
   '逐根计数并观察胸腔方向的断端，同时辨认有无多处断裂构成游离胸壁。'
  ]),
  f('浮动胸壁',ribNumbers.map(n=>({...ribCut(n,true),floating:true})),'rib',[
   '相邻多根肋骨各有两处骨折，中间肋段失去连续的胸壁支撑。',
   '吸气时游离段内陷、呼气时外凸，与整体胸廓扩张和回缩方向相反。'
  ],{breathing:true,context:ribNumbers.map(n=>n.replace('Right','Left')),
   moving:[moving(ribNumbers.map(n=>n.replace('Right','Left')),[2.2,0,0],zero,{breathing:true})]})
 ].map(v=>({span:.25,context:[],...v})));

 const spinal=(name,cuts,points,aboveMotion)=>f(name,cuts,'spine',points,{
  span:.17,context:[above,below],moving:[aboveMotion||moving([above],[0,11,0],zero,{timing:[.06,.44]}),moving([below],[0,-9,0],zero,{timing:name==='过伸型'?[.38,.75]:[.06,.40]})]
 });
 const upper=(shift,turn,via)=>moving([above],shift,turn,{via,pivotPoint:{bone:lumbar,point:[.5,.75,.69]}});
 add('spine','二｜图 6-106 至 6-110 · PDF 443、445–451 页',[
  spinal('屈曲骨折脱位',[{bone:lumbar,wedge:'anterior'}],[
   '前屈使椎体前部楔变，同时上方椎骨向前下方移位。',
   '侧位检查椎体排列及后方小关节、张力带失配，与单纯前缘楔压区别。','上下椎体的相对错移是本型判断失稳的重要线索。'
  ],upper([0,17,19],[-10,0,0],[0,17,0])),
  spinal('过伸型',[seeded(lumbar,[.5,.63,.78],[0,.66,.70],rest,motion([0,4,4]))],[
   '过伸使前方结构受牵张、后部骨性结构受挤压。',
   '观察前缘张开和上位椎骨向后仰，再核对后弓接触区。'
  ],upper([0,14,-10],[12,0,0],[0,15,0])),
  spinal('垂直压缩（爆裂型）',[seeded(lumbar,[.5,.6,.54],[0,.20,1],motion([0,-2,-5]),motion([0,-3,0]),{
   second:[1,0,0],branches:[motion([-3,0,1]),motion([3,0,1])]
  })],[
   '轴向压缩使椎体多块破裂并压低，后壁骨片可向椎管移位。',
   '在轴向查看椎管前壁骨块，区分伴后壁受累的爆裂和单纯楔形压缩。'
  ]),
  spinal('屈曲旋转型',[seeded(lumbar,[.50,.70,.46],[.54,1,.35],rest,motion([2,0,2]))],[
   '屈曲叠加旋转使椎体及后方关节受力不对称，可能出现单侧小关节跳脱。',
   '从斜后方比较两侧关节突的高度、扭转及对合状态。'
  ],upper([5,14,13],[-7,11,0],[0,15,0])),
  spinal('水平剪力型',[seeded(lumbar,[.50,.55,.71],up,rest,motion([0,0,0],[-12,0,0]))],[
   '水平断线可从椎体通过后方椎弓及棘突，形成张力侧张开。',
   '侧位沿断线由后向前追踪，前柱附近小幅转动可在后柱产生更大间隙。'
  ]),
  spinal('棘突撕脱',[seeded(lumbar,[.5,.48,.21],[0,0,-1],rest,motion([0,-1,-5]))],[
   '背部肌肉及棘上、棘间结构牵拉可撕脱棘突。',
   '在后正中区定位独立骨片，核对椎体及小关节整体排列。'
  ]),
  spinal('横突撕脱',[seeded(lumbar,[.22,.48,.45],[-1,.16,0],rest,motion([-6,-2,0]))],[
   '腰部肌肉牵拉可使横突独立撕脱，片段在椎骨外侧。',
   '正位辨认侧方骨片，结合其位置与正中棘突损伤鉴别。'
  ])
 ]);
 const hemipelvis=(name,spec,points)=>f(name,[spec],'pelvis',points,{context:pelvis,span:.36});
 const anterior=cut(hip,.9,[1,0,0],rest,rest,{anchor:[-.021,.867,.025]});
 add('pelvis','三｜图 6-116 · PDF 467–469 页',[
  hemipelvis('半月形骨折',{...anterior,minus:motion([0,-1,2],[0,12,0]),second:[0,.18,-1],
   splitSide:0,secondPoint:[.49,.70,.29],branches:[rest,motion([0,1,-2],[0,-12,0])]},[
   '侧方压缩时髂骨后部可形成半月形骨片，后方小片仍邻近骶髂关节。',
   '沿骨盆入口看伤侧半骨盆内旋与前环断线，再找后方较固定的骨片。'
  ]),
  hemipelvis('混合型',{...anterior,minus:motion([-11,16,-5],[0,9,0]),pivot:[-.053,.958,-.077],minusPath:[[-12,-2,-3]]},[
   '不同方向的外力可使骨盆环同时发生旋转与垂直错移。',
   '结合入口位和出口位，核对耻骨支断线、骶髂关系及两侧髂嵴高度。'
  ]),
  ...[
   ['髂前上棘撕脱',[.43,.73,.93],[0,.2,1],[0,-8,4],'缝匠肌','髂嵴前端','asis'],
   ['髂前下棘撕脱',[.48,.57,.83],[0,-.72,1],[0,-9,5],'股直肌','髋臼前上方','aiis'],
   ['坐骨结节撕脱',[.56,.12,.28],[0,-1,.12],[0,-12,-4],'腘绳肌','骨盆下后方','ischial']
  ].map(([name,point,n,shift,muscle,site,code])=>f(name,[seeded(hip,point,n,rest,motion(shift))],code,[
   muscle+'骤然牵拉可从附着区扯下骨片。',
   '在'+site+'定位骨片，核对骨盆环其余部位是否保持连续。'
  ],{context:pelvis,span:.22}))
 ]);
}

function addPhysis(courses){
 const source='第六章 · 第五节｜图 6-121 · PDF 476–480 页 · 成人骨性底图儿童解剖示意';
 const points=[
  ['Ⅰ型经骺板分离，断线沿生长板走行。','核对虚拟骺板两侧的滑移，干骺端和骨骺均无独立骨片。'],
  ['Ⅱ型从骺板转入干骺端，骨骺携带三角形干骺端片。','沿骺板边缘追踪折转，与单纯经板分离的Ⅰ型鉴别。'],
  ['Ⅲ型由关节面进入骨骺，至骺板后转向周缘。','同时核对关节面错台及干骺端是否完整。'],
  ['Ⅳ型连续贯穿骨骺、骺板和干骺端三个层次。','追踪同一条断线跨过生长板，并检查其关节面开口。'],
  ['Ⅴ型由纵向压缩损伤骺板，早期骨性对位可基本保留。','比较虚拟板带厚度随加载而减小，随访重点为骺板早闭和生长受限。'],
  ['Ⅵ型累及骺板边缘的软骨膜环或周缘沟，可形成局部骨桥。','观察虚拟带的单侧周缘缺损，与弥漫性骺板压缩的Ⅴ型鉴别。']
 ];
 const variants=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'].map((label,i)=>{
  const proximal=i<2,type=i+1,b=proximal?humerus:tibia,side=proximal?1:-1;
  const s=cut(b,proximal?.91:.075,up,rest,rest,{physis:{type,side}});
  return f('Salter–Harris '+label+'型',[s],proximal?'physis-shoulder':'physis-ankle',points[i],
   {source,child:true,span:.14,context:proximal?[shoulder]:type===3?[fibula]:[talus,fibula]});
 });
 courses.push({id:'physis-injury',name:'骨骺损伤',region:'骨骺',system:'Salter–Harris 分型',source,variants});
}

export function addTextbookFractures(courses){
 upperLimb(courses);
 lowerLimb(courses);
 trunk(courses);
 addPhysis(courses);
}
