# 中医骨伤科学 · 骨折图谱

[打开课堂图谱](https://fsy2004.github.io/fracture-atlas/) · [全身骨骼](https://fsy2004.github.io/fracture-atlas/#skeleton) · [胫腓骨干](https://fsy2004.github.io/fracture-atlas/#tibia/0/1)

供骨伤科课堂投影与讲解使用。教师可旋转成年男性全身骨骼，选取受累骨或从目录打开课程。第六章上肢、下肢、躯干的 32 个各论条目均有入口。每个入口使用一种主要分类思路，选择经典类型演示；部分仅收录教材中的代表性形态。骨折位置与具体方向以患者解剖坐标表示。右侧肢体为演示侧。

## 操作

选择分型后点击播放，或拖动时间轴。模型可用鼠标左键拖动旋转、滚轮缩放，触屏支持单指旋转和双指缩放。局部放大将相机对准骨折处。在胫腓骨干课内，位置和致伤机制可以独立切换。教学链接保留所选部位、分型和分段。

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
| courses.js | 教材部位、分型、简短讲解、来源定位、切面和运动参数 |
| geometry.js | 根据教学切面切分网格，生成骨折轮廓和断面 |
| models/index.json、models/bones.bin | 结构 ID、英文名称、二进制偏移、顶点和三角面索引 |
| models/provenance.json | 来源、版本、许可、修改与校验值 |
| tools/build_models.py | 用 Python 标准库从固定上游重建骨骼资产 |

本地可在项目目录运行 `python -m http.server 8000`，然后打开 [本机课堂图谱](http://localhost:8000/)。GitHub Pages 从 main 分支根目录发布。
