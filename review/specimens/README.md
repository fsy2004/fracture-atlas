# 男性标本与分区等级

全身导航使用完整的 BodyParts3D 男性坐标系。201 个索引项均可进入精细局部观察。每个场景依据同一供体、同一坐标组选择骨体和关节参照；完整单骨和区域估计在界面中有不同标示。原始影像只用于建模，网页仅加载三维表面与运动参数。

| 主要观察入口 | 数量 | 标本与重要边界 |
|---|---:|---|
| 原有 VHM 分骨 | 113 | 保留原供体表面和组内骨间位置。[固定源版本](https://huggingface.co/datasets/BoneHub/visible-human-3d-models/tree/9cdfccfc74a42ea657c2adf055513e6371239f49) |
| 双侧肱骨和尺骨的单骨观察 | 4 | 雅典 ABH074，26 岁男性，实物摄影测量。离体骨的相对摆位不用于关节活动。左肱骨排除了一个 24 面的小扫描孤岛。[来源](https://doi.org/10.5281/zenodo.6614647) |
| 双侧桡骨及全部指趾骨的单骨观察 | 58 | N187928，58 岁男性。完整肘、肩、腕和数字关节采用同供体相邻骨；肱、尺单骨在这些关节课内也取自 N187928。指趾轴由近远端关节标志确定，保留屈曲姿势。[来源](https://doi.org/10.5281/zenodo.22833546) |
| 第一跖骨头下内侧和外侧籽骨 | 4 | 从 VHM 原始断层的足底面逐枚提取，核对第一跖骨头及两侧的位置。[提取记录](digits.md) |
| 胸骨各部与骶骨 | 4 | 使用 VHM 的外部标签和同一标本原始断层。骶骨沿骶尾关节区与尾骨分开；胸骨三个解剖区在可见界面与外部标志上定位，融合处边界为推定。可查看原连续骨面。[来源与校验](thorax-sacrum.json) |
| 颅面及舌骨 | 16 | Visible Korean，67 岁男性。其中 10 项取原作者骨面或其天然独立连通域；6 项在顶、鼻及上颌三个双侧联合骨面上，以切片和表面标志分侧。深部和融合处为推定分界。下颌与颞骨在颞下颌关节课内来自同一供体。[来源](https://doi.org/10.5281/zenodo.22759852) · [分侧记录](cranial-partitions.json) |
| 左右腭骨 | 2 | Halle，70 岁男性，0.125 mm 原始微 CT。用原有骨形先验限定分区，再对照标本骨质、硬腭中缝、横腭缝邻区及腭大孔。保留三层证据标识、未分区的区域参照以及 BodyParts3D 的完整独立骨。微 CT 表面位置得到支持并不等于深层归属已确认。[来源](https://doi.org/10.5281/zenodo.6108435) · [局部核查](palatine.md) |

标签分界、骨表分辨率、三角面密度及碰撞检查各自回答不同问题。胸骨融合区、颅面分侧的深部界面和腭骨估计区均不用于测定骨缝宽度。腭骨局部裂线只绘在已核对的水平板口腔面，用于理解走向。单骨扫描不能恢复一名患者受伤瞬间的肌力与速度。

## 临床分型对照

保持同一时刻与视角切换分型，可以把观察重点放在移动骨块和参照骨的关系。同一课程若各型可用供体不同，锁定对照时统一回到完整原图谱。读数仅描述当前三维模型。

- **桡骨远端**　从同一男性的桡腕相对骨面辨认完整关节面的远段移位与部分关节缘剪切。四型依次为伸直、屈曲、背侧缘、掌侧缘。八块腕骨与相应的远段或缘骨块同步运动。在该供体背侧缘例，移动片约含所标示骨面的 23%–25%；掌侧缘例约为 42%–44%。这些量描述示例的切线位置。[AO 背侧缘骨折](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/distal-forearm/partial-articular-simple-fracture-of-the-radius-involving-the-dorsal-rim/definition) · [专项检查](upper-limb.json)
- **腕骨脱位**　月骨掌侧脱位时月骨凹面翻转，头状骨可接近桡骨；月骨周围背侧脱位的示例保留桡月对位，头状骨和远排腕骨移至月骨背侧。后者列作临床补充鉴别。三个定位点沿用同一视角。[AO 月骨脱位](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/carpal-bones/lunate-dislocation/definition) · [AO 月头关节脱位](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/carpal-bones/lunocapitate-and-midcarpal-dislocation/definition)
- **胫骨平台**　保留教材按受累髁的入口，单列外侧的局部压陷和劈裂伴压陷示例。通过沿真实平台表面采样的伤前虚线和变形后实线比较凹陷。劈裂的边缘骨块另行平移，中央关节面压低量以毫米调节。[AO 近端胫骨形态](https://surgeryreference.aofoundation.org/orthopedic-trauma/adult-trauma/proximal-tibia)
- **肩、肘及指趾关节**　用同体关节中心、臂局部轴和数字长轴描述活动端。侧别、角度、活动骨间距均在选定男性标本上复核。角度和让位轨迹属于教学重建。[指趾专项检查](digits.json)

股骨与胫骨干的适用横、斜断面从同一个 VHM 男性断层推导髓腔内缘。沿轴向每 3 mm 在原始分骨掩模内求密度过渡，保留有骨皮质带的 96 条放射方向，随后在实际斜断面上求交。超出有效范围或跨越超过 9 mm 的缺测段时保留估算，并在断面观察说明相应依据。中央凹面和骨折本身仍为教学重建。

## 数据再使用

VK 头部数据及其衍生骨面使用 CC BY-NC 4.0，适用于本项目的非商业教学用途。Halle 腭骨估计区使用 CC BY 4.0 的微 CT 与 CC BY-SA 2.1 Japan 的 BodyParts3D 形状先验，衍生区按 CC BY-SA 2.1 Japan 并列署名。其他数据按各自许可保留归属和修改记录。网页按需加载，离线单 HTML 内附许可归属。可用 `node tools/verify-specimen-library.mjs` 对实际分发文件及 201 个索引做校验。[补充模型清单](../../models/extended/manifest.json) · [VK 重建工具](../../tools/visible_korean/README.md)

## 软组织来源核对

可从髋部起步，用伤前几何显示臀中肌、髂腰肌等近端牵拉结构，以及股动脉、股静脉和坐骨神经的前后关系。已核对的[Visible Human Male 下肢数据](https://digitalcommons.du.edu/visiblehuman/2/)有 CC BY 4.0 的双侧肌肉，可核对骨、肌配准。BodyParts3D 的 4.0 索引也有左右侧臀中肌、髂肌、腰大肌和股动静脉候选。现有索引里的这些结构需要与每个场景实际使用的骨面版本配准；坐骨神经仍缺已核验的同体几何。软组织应先作为可独立开关的伤前参照，牵拉、压迫等动态关系需另外建模和验证。
