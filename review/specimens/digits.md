# 手足指趾骨及籽骨的来源核查

| 发布用结构 | 来源和范围 | 导出文件 |
|---|---|---|
| 56 节手指骨与趾骨 | Ghent OpenSkeleton v1，男性 N187928，58 岁。使用每个独立结构的 Registered 顶点和相应 Faces 索引，保留同侧原始相对姿势 | packed/hand.json 与 packed/foot.json，每份包含 28 个主结构、10 个同体掌骨或跖骨参照 |
| 双脚第一跖骨头下的 4 枚籽骨 | NLM Visible Human Male，经 University of Denver 对齐，由 Alavi 与 Asseln 发布。直接依据供体 CT 划分 | packed/sesamoids.json |
| 单骨近远端 | 从同一供体相邻关节的面对面点群估算。小骨末节用自身末端粗隆 | packed/digit-axes.json |

OpenSkeleton 根据个体 CT 重建后，进行跨个体表面对应。Metadata.N187928.sex_code = Male，age_years = 58。每个掌/跖骨、近节、中节和末节均通过独立的源字段定位。手与同源尺桡骨采用同一刚体变换，足内 19 块骨采用同侧共同刚体。在 56 个指趾骨中，48 件源面数高于既有 BodyParts3D 对应骨。小骨轮廓仍受源数据采样和表面对齐影响。

[OpenSkeleton v1，Duquesne 等，CC BY 4.0](https://doi.org/10.5281/zenodo.22833546) · [Visible-Human-3d-Models，Alavi 与 Asseln，CC BY 4.0](https://doi.org/10.57967/hf/10464) · [原始对齐数据，Andreassen 等](https://doi.org/10.1038/s41597-022-01905-2)

## VHM 的可辨认范围

VHM 男性 STL 按整指和整趾提供标签。对原始 20 个 STL 的共享顶点做连通图检查，每个只有一个网格连通体。对原始全身 CT 和四个手足 NRRD 掩膜进行双正交斜面重建，截面分辨率为 0.9375 × 0.9375 × 1.0 mm。能定位大部分关节的大致位置，但指间和小趾末端常有明显部分容积效应。对 36 个关节在候选区内追踪低密度间隙及其两侧较高密度皮质，结果保存在 ct-joint-review.json。双侧第四、第五趾及多个手指末端尤其难稳定分出两侧的完整关节面。发布用指趾骨据此采用另一个已独立逐骨标注的男性供体。

第一跖骨头足底侧的内、外两枚籽骨各自有独立高密度皮质轮廓。按第一跖骨头的三轴参考位置裁出小体积，排除原有第一跖骨与拇趾标签后，在原始无符号 CT 值 1230 处求六连通域并填内部孔洞。检查多个相邻密度阈值与斜冠状重建。右足内、外侧的 LPS 质心为 (121.80, 189.42, 39.01) 和 (109.57, 193.82, 36.07) mm，左足为 (380.95, 174.55, 48.15) 和 (391.53, 179.94, 43.10) mm。两侧使用各自既有 VHM 腿组变换。四个网格体积 0.457–0.541 cm³。

## 再生成

- 上游 NM_UEXT.mat 和 NM_LEXT.mat、Faces.mat、Metadata.mat 均来自 OpenSkeleton 锁定记录。pack_openskeleton.py 接受这些输入、旧图谱及上肢组的变换清单，输出 little-endian float32 世界米顶点和 uint32 三角索引。每个文件 gzip 单独压缩，机器清单保存发布文件及原始字段哈希。
- inspect_vhm.py、fetch_ct.py 与 fetch_masks.py 只使用发布版本 9cdfccfc74a42ea657c2adf055513e6371239f49 的男性数据。read_masks.py 解码原标签，crop_ct.py FOOT 和 crop_ct.py HAND 裁切等分辨率小体积。ct_joint_review.py 和 mpr.py 生成关节核查资料。pack_native.py 生成籽骨，digit_axes.py 生成单骨局部轴。
- 导出前检查三角面索引边界、有限值、正体积、连通数、未闭合/非流形边和零面积三角面。压缩副本经解码长度、SHA-256 及边界盒核验。几何检查对应本次供体表面，运动轨迹另在网页集成后验证。
