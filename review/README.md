# 骨折与脱位的资料核对

课程采用黄桂成、王拥军主编《中医骨伤科学》（全国中医药行业高等教育“十四五”规划教材），第六章骨折、第七章脱位。以原书核对分类名称、活动骨、参照骨以及移位方向。作者设定的演示毫米数、自由角度、轨迹中间点与时间插值均不作为诊断界值。完整教材及插图未随项目分发。

[逐条目录](catalog.json)列出部位、分型、受累骨、教学观察点与资料位置。可执行 `node tools/build_review.mjs` 从教案数据重新生成。部位补充形态用于观察本骨损伤，部分骨仅设一个代表性形态。以下材料用于资料自审与修订。

## 教材读图与实现修正

| 观察对象 | 图中应辨认的关系 | 本版处理 |
|---|---|---|
| 胫腓骨干及股骨干 | 先定近远段，再分别观察侧移、轴向重叠、成角和旋转。正投影可能隐藏平移 | 胫骨可选上、中、下 1/3；侧面、正面及骨干局部端面可同帧观察。缩短示意先错开皮质，再产生长度重叠 |
| 手足短管骨 | 横断与斜形须相对该节骨的自身长轴命名 | 由原生截面中心求轴；横断与该轴垂直，斜形可以与横断对照。指趾姿势差异较大，逐侧验证 |
| 股骨髁间 | T 形、Y 形均能把内外髁分开，髁间断面应从关节端可见 | 重新切分时保留首个断面材料，修复 Y 形在原生右侧网格上重复切分时丢失的面 |
| 桡骨远端与跟骨 | 单纯干骺部或结节部断裂，与延伸到关节面的骨折有不同观察重点 | 核查双侧桡腕及距跟标示区。跟骨结节撕脱示例定位于后上结节，断线避开距跟相对骨面；关节面受累例则与标示区相交 |
| 枢椎齿突 | 尖端骨折与齿突基底部骨折的活动骨块大小不同 | 根据该标本调整基底部断面，保留单个齿突骨块，避开相邻侧块 |
| 颞下颌、肩、肘、髋、膝、髌骨 | 始终以对应关节窝或近端骨作参照，移动成对骨时须保持它们的关系 | 肘部尺桡骨及膝部胫腓骨共同移位；髌骨外移和胫骨平台的侧移可分别观看 |
| 月骨 | 掌侧移位伴掌向翻转，侧面可见月骨凹面转向掌侧；头状骨可朝远端桡骨靠近 | 用约 90° 翻转作为教材代表例，翻转量和平移量可调，头状骨继发近移。[AO 月骨脱位](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/carpal-bones/lunate-dislocation/definition) |
| 跗跖、掌指及趾指间关节 | 足部背侧朝足背，手部背侧朝手背。注意观察远侧骨基底而非孤立看一条裂线 | 跗跖示例显示第二跖骨与中间楔骨的错位，同向活动的五条跖骨与趾骨一起移动。[AO 中足对线](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/midfoot/further-reading/patient-assessment) |

第七章“小儿桡骨头半脱位”涉及发育阶段与环状韧带。当前模型为成年男性。其他涉及儿童的骨折条目仅示成人骨性标志的关系。

## 补充骨位的来源编号

| 编号 | 支持的范围与原始资料 |
|---|---|
| AO-C1、AO-C2 | C1 骨弓和 C2 齿突的损伤位置。[AO 寰椎骨性损伤](https://surgeryreference.aofoundation.org/spine/trauma/occipitocervical/2a-isolated-bony-injury/definition) · [AO 上颈椎分类](https://media.aofoundation.org/spine/-/media/project/aocd/aospine/documents/aos_injury_classification_pocket_card_uppercervical.pdf?rev=71e7086a45084ed1aa3a65693c36842e) |
| AO-SUBAXIAL、AO-THORACOLUMBAR | 下颈椎及胸腰椎骨性压缩；本图谱仅表现椎体局部形变。[AO 下颈椎](https://surgeryreference.aofoundation.org/spine/trauma/subaxial-cervical/further-reading/classification) · [AO 胸腰椎楔形压缩](https://surgeryreference.aofoundation.org/spine/trauma/thoracolumbar/a1/definition) |
| STERNUM | 胸骨柄横斜形和胸骨体、剑突的解剖分区。[胸骨柄病例系列](https://pubmed.ncbi.nlm.nih.gov/29707289/) · [胸骨骨折分区研究](https://pubmed.ncbi.nlm.nih.gov/40576692/) |
| AO-SCAPULA、AO-SACRUM | 肩胛体与关节段的区别；骶翼相对骶孔的位置。[肩胛体](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/scapula/body-and-processes-body/definition) · [骶骨](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/pelvic-ring/sacrum/definition) |
| AO-CARPAL、AO-MIDFOOT、SESAMOID | 腕骨、中足和籽骨的区域性损伤。课程中的单一局部断面为按原生骨面制作的示例。[AO 腕骨](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/carpal-bones) · [AO 中足](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/midfoot) · [AAOS 籽骨](https://orthoinfo.aaos.org/en/diseases--conditions/sesamoiditis/) |
| AO-SKULL、AO-CMF、AO-MANDIBLE | 用于颅颌面分区、局部裂线、凹陷及下颌髁突定位。动画显示所选骨的局部形态。[AO 颅底与颅盖](https://surgeryreference.aofoundation.org/cmf/trauma/skull-base-cranial-vault) · [AO 面中部分区](https://surgeryreference.aofoundation.org/cmf/trauma/midface/further-reading/ao-cmf-classification-midface-level-1-and-2) · [AO 下颌髁突](https://surgeryreference.aofoundation.org/cmf/trauma/mandible/condylar-process-and-head-simple-and-complex/definition) |
| HYOID | 孤立舌骨损伤的病例资料，示例仅显示单侧大角骨片。[Döring 等](https://pubmed.ncbi.nlm.nih.gov/11142890/) |

## 约束与读数的界限

肩、肘、髋、踝的近似纤维束采用骨面附着方向及两点长度。原始解剖研究提供附着区域，实际起止点在此男性标本的骨面上近似选取。界面中长度变化与可调余量用于比较自由运动和受限运动，不能据此推定韧带撕裂、血供或应力。[肩关节研究](https://pubmed.ncbi.nlm.nih.gov/32441993/) · [肘关节研究](https://pubmed.ncbi.nlm.nih.gov/29266961/) · [髋关节研究](https://pubmed.ncbi.nlm.nih.gov/24293171/) · [踝关节研究](https://pubmed.ncbi.nlm.nih.gov/25325559/)

接触检测使用原生网格及骨折断面，区分伤前已有的重叠、表面相接与取样检出的新增穿插。按实际请求的进度增量检查目标姿态，跳帧时细分至不超过全程的 1/128，再对首次发现的交叠作二分定位。薄片、瞬时相交、未纳入场景的骨及开放曲面都可能影响检出率。红点标示一处交叠见证位置。形变与角度均为给定骨面的教学轨迹，未由患者纵向影像或组织力学实验标定。


## 默认轨迹复核

在 Chromium 中装入实际发布使用的原生骨面，逐课程、逐侧别、逐胫骨分段取样。骨折 515 条路径各取 129 个姿态；脱位 41 条路径各取 257 个姿态。上述默认姿态均未检出新增骨面穿插，原始表面已有的局部重叠被另行识别。更改自定义参数会重算限位，渲染前将时间轴和骨块对齐到实际可达帧。源模型静态重叠、未建模软组织和相邻采样时刻之间的状态仍受几何方法限制。[检查结果](geometry-check.json)

AO-ILIAC 用于局部髂翼上部断面，示例保留髋臼与下部髋骨作参照。[AO 髂骨翼骨折](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/pelvic-ring/intact-posterior-arch-innominate-bone-iliac-wing-fracture/orif-iliac-crest)

本版核验 515 条默认骨折路径和 41 条默认脱位路径，分别检查 66,435 与 10,537 个姿态，另查 966 个蝶形骨块姿态。451 条骨折路径及 27 条脱位路径实际调用精细标本。其余路径保留已有完整男性图谱及已核查的切面。三组自定义位姿在发生新交叠前触发限位。检查覆盖 201 个索引项，其中两侧腭骨属于带逐面证据标记的区域估计。[标本分级与临床对照记录](specimens/README.md) · [全量验证结果](geometry-check.json)
