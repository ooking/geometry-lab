# 空间几何实验室 (Geometry Lab)

> 📐 **折一折、搭一搭、切一切，直观理解立体几何与空间想象**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/ooking/geometry-lab?style=flat)](https://github.com/ooking/geometry-lab)

**空间几何实验室**是一个基于 Web 3D 技术的交互式几何教学与探索工具。通过动态三维交互、步进式折叠动画与即时几何测量，帮助学生与教育工作者轻松突破空间想象障碍，掌握展开图、三视图与截面等经典立体几何知识。

---

## ✨ 核心功能模块

### 1. 📐 展开与折叠工坊 (`index.html#unfold`)
- **多类型立体支持**：支持正方体、长方体、三棱柱、四棱锥等常见多面体。
- **正方体 11 种展开图全覆盖**：分类浏览（1-4-1、2-3-1、2-2-2、3-3 结构），一键切换。
- **交互式底面与相对面推导**：支持任意面选定为基准底面，智能高亮对立面与相邻面，辅助空间位置预测。
- **连续与分步折叠动画**：可拖动滑块任意调节折叠角度，亦可一键自动播放展开/还原动画。
- **即时几何量计算**：动态计算表面积、闭合体积与平面展开图周长。

### 2. 🎁 独立教学应用：包装盒工程 (`packaging.html`)
- **实际工程情境**：以生活中的包装纸盒设计为导向，研究长方体展开用料与成本。
- **自定义参数与双层上盖**：支持自由配置长宽高与单位，演示双层加固盖板的展开排布与纸板消耗。
- **拼接组合优化**：支持两盒拼接方案对比（并列拼接、端头拼接），寻找最省料的摆放方向。
- **周长与折痕计算**：内置内部折痕与展开图外周长下界推导，辅助包装切割线规划。

### 3. 🧊 方块搭建与三视图观察 (`index.html#views`)
- **积木交互搭建**：自由在三维网格中增删小正方体，构建自定义立体组合。
- **正投影多视角联动**：主视图（正视图）、俯视图、左视图实时同步生成并标注层数。
- **空间观察力训练**：支持隐藏立体、反向根据三视图推断小立方体摆放与极值数量。

### 4. 🔶 切开立体看截面 (`index.html#section`)
- **任意截平面切割**：交互式调整切割刀面的法线方向与截面位置。
- **截面形状即时分析**：观察正方体被截出的三角形、四边形、五边形乃至六边形，直观感受交线变化。
- **立体内部剖视**：透明度与剖面着色高亮，清晰呈现截面轮廓线。

---

## 🛠 技术架构

- **核心渲染引擎**：原生 [Three.js](https://threejs.org/) + `OrbitControls` 实现平滑的轨道相机与三维交互
- **纯原生技术栈**：Vanilla HTML5 / Modern CSS / ES6 JavaScript，零构建依赖，极速加载
- **模块化解耦设计**：
  - `js/teaching-cuboid.js`：几何模型运算、SVG 展开图生成与纯长方体计算
  - `js/application-panels.js`：教学应用生命周期管理与按需懒加载机制
  - `js/lab-*.js`：通用实验工坊各模块解耦实现

---

## 🚀 快速开始

本项目为纯静态前端项目，无需配置复杂的构建环境或安装 Node 依赖，开箱即用。

### 方式一：本地直接打开
克隆本仓库到本地后，使用任意现代浏览器打开 `index.html` 即可：

```bash
git clone https://github.com/ooking/geometry-lab.git
cd geometry-lab
open index.html # macOS 直接打开，或在浏览器中打开该文件
```

### 方式二：使用本地静态服务器（推荐）
建议通过简易 HTTP 服务器访问，以确保模块与本地资源完全正常加载：

```bash
# 使用 Python 3
python3 -m http.server 8000

# 或使用 npx serve
npx serve .
```
在浏览器中访问 `http://localhost:8000` 即可开始探索。

---

## 📂 项目结构

```text
geometry-lab/
├── index.html                  # 通用空间几何实验室主入口
├── packaging.html              # 包装盒教学应用独立入口
├── LICENSE                     # MIT 开源许可证
├── README.md                   # 项目使用与说明文档
├── css/
│   ├── main.css                # 页面基础与布局样式
│   ├── lab-modules.css         # 通用实验室控件样式
│   ├── navigation.css          # 模块导航与二级菜单
│   └── application-panels.css  # 独立教学应用面板样式
├── js/
│   ├── app.js                  # 主应用初始化与路由
│   ├── lab-unfold.js           # 展开与折叠交互逻辑
│   ├── lab-views.js            # 方块搭建与三视图逻辑
│   ├── lab-section.js          # 截面剖切逻辑
│   ├── teaching-cuboid.js      # 长方体核心几何计算与绘图
│   ├── application-packaging.js# 包装盒应用业务逻辑
│   └── application-panels.js   # 扩展应用注册与容器调度
├── docs/
│   └── teaching-applications.md# 独立教学应用扩展开发规范
└── lib/                        # 本地内置依赖库 (Three.js & Controls)
```

---

## 📄 开源许可

本项目采用 [MIT 许可证](LICENSE) 开源。欢迎自由使用、教学演示、改进与二次分发。
