# 中医骨伤科学 · 骨折图谱

[打开课堂图谱](https://fsy2004.github.io/fracture-atlas/) · [全身骨骼](https://fsy2004.github.io/fracture-atlas/#skeleton) · [胫腓骨干](https://fsy2004.github.io/fracture-atlas/#tibia/0/1)

供骨伤科课堂投影与讲解使用。教师可旋转成年男性全身骨骼，选取受累骨或从目录打开课程。第六章上肢、下肢、躯干的 32 个各论条目均有入口。每个入口使用一种主要分类思路，选择经典类型演示；部分仅收录教材中的代表性形态。骨折位置与具体方向以患者解剖坐标表示。右侧肢体为演示侧。

## 操作

首页可点击模型或使用右侧全身骨骼索引。索引覆盖 201 个结构，支持中文、英文、侧别和区域检索。点击骨名或左右侧可放大该骨，索引显示对应的骨折专题数。选择部位后点击分型，动画自动播放并停在最终形态；“骨折后状态”可直接跳到终点。左右部位均可定位，左侧骨折动画采用右侧教案的镜像。未编制分型的骨骼提供解剖观察。

每个骨折分型可以保留其原有几何和移位。在有相应教材依据的课程中，可另选骨折线形态及移位表现。以胫腓骨干为例，直接暴力可选横断、短斜形、粉碎，间接暴力可选斜形、螺旋形；两组均可切换上、中、下 1/3。骨干移位可组合成角、侧方、缩短、分离和旋转，缩短与分离互斥。组合模式在原分型位置上演示断面和相对骨段运动。缩短示例含侧方错开和纵向重叠。桡骨远端伸直型和屈曲型可附加短缩，同时保留各自规定的远端朝向。成人参考模型未加入骨骺分离等儿童骨骺形态。

链接包含骨骼、分型、分段以及可选组合；旧课程链接继续有效。鼠标和触屏可旋转、缩放，右侧可控制视角、显示层、播放进度和速度。

橙线标出断面轮廓，橙色箭头表示示意受力，青色箭头表示骨段平移方向。角度与幅度用于讲清空间关系；原始男性网格为健康解剖。分型场景为在该网格上制作的教学示例，部分采用规则切面、压缩变形和代表性移位。没有进行患者运动反演、力学计算或骨科教师逐型审校。涉及未闭合骨骺的章节用成人骨性标志示意空间方向。

## 教材与模型

- 教材依据为黄桂成、王拥军主编的《中医骨伤科学》，全国中医药行业高等教育“十四五”规划教材，第六章。每课列出章节、图号或 PDF 页序。仓库只含自行编写的简短讲解及动画参数。
- **BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.** [原始下载](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) · [许可说明](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [模型论文](https://doi.org/10.1093/nar/gkn613)
- 上游网页用衍生网格来自 [JICio/tcm-3d 固定版本](https://github.com/JICio/tcm-3d/tree/e8b9ad1c17e67a25e94406100e3fb5c296c24f7a/public/models)。上游将 BodyParts3D 4.0 模型变换为米制 Y 向上坐标并减面。本项目从其男性模型中选取 201 个骨性网格，保留结构与概念标识，重新打包坐标和索引，计算顶点法线，制作交互切面、骨块和位移动画。网格数包括复合骨的组件、籽骨等，与人体标准骨数的计数口径不同。[上游署名](https://github.com/JICio/tcm-3d/blob/e8b9ad1c17e67a25e94406100e3fb5c296c24f7a/public/ATTRIBUTION.md)
- 网页渲染使用 Three.js r160 和 OrbitControls，随仓库提供，采用 [MIT 许可](vendor/LICENSE-three.txt)。使用时无需外部 CDN。

## 项目入口

| 文件 | 用途 |
|---|---|
| index.html、style.css、app.js | 教学界面、解剖导航、播放与分步控制 |
| bone-index.js、features.js | 全身骨名索引、形态与移位的适用范围和运动参数 |
| courses.js | 教材部位、分型、简短讲解、来源定位、切面和运动参数 |
| geometry.js | 根据教学切面切分网格，生成骨折轮廓和断面 |
| models/index.json、models/bones.bin | 结构 ID、英文名称、二进制偏移、顶点和三角面索引 |
| models/provenance.json | 来源、版本、许可、修改与校验值 |
| tools/build_models.py | 用 Python 标准库从固定上游重建骨骼资产 |

本地可在项目目录运行 `python -m http.server 8000`，然后打开 [本机课堂图谱](http://localhost:8000/)。GitHub Pages 从 main 分支根目录发布。
