# 教学应用面板扩展

应用面板附加在现有工作区内，不读取或修改通用实验室实例。当前“包装盒应用”位于展开与折叠工作区下方，默认收起。

## 文件职责

- `js/application-panels.js`：注册、懒初始化、可见性与工作区生命周期。
- `js/teaching-cuboid.js`：纯长方体计算、展开图布局、SVG 绘制，以及独立的 Three.js 视图。
- `js/application-packaging.js`：题目配置、包装用料计算流程、面板 UI 与自己的状态。
- `css/application-panels.css`：应用面板样式，使用 `data-teaching-application` 限定作用域。

包装盒不依赖 `UnfoldLab`，只复用 `LabUtils.rootNet`、`disposeGroup` 和 `startViewport`。两个工作区不共享尺寸、底面、展开图选择、动画进度或渲染器。

## 新增应用

1. 在目标 `.tab-panel` 内新增 `<details class="panel-card teaching-application" data-teaching-application="your-name">`，含一个说明用途的 `<summary>`。
2. 新建应用脚本，通过 `TeachingApplications.register('your-name', host => new YourApplication(host))` 注册工厂。
3. 应用实例实现 `setActive(active)`。面板首次打开时构造，打开状态、工作区导航和页面可见性共同决定是否活跃。暂停时停止绘图和动画；保留本实例设置。
4. 所有查询从传入的 `host` 开始，避免全局选择器、重复 ID 和直接绑定其他面板的控件。
5. 纯计算与题目配置分开。长方体题可复用 `TeachingCuboid.measures`、`boxNet`、`stripNet`、`drawNet`，需要立体观察时使用 `CuboidTeachingView`。
6. 在 `index.html` 中于注册器、公共绘图脚本之后，`app.js` 之前加载应用脚本。注册器自动发现挂载点，无需修改通用实验室或导航初始化逻辑。

## 当前包装盒约定

- 默认长5、宽3、高4；三小问默认使用 cm、dm、m。单位切换不换算数值。
- 长×宽始终为包装底面；上盖层数仅影响用料，不因视角旋转变化。
- 双层上盖纸板面积为 `2(lw+lh+wh)+lw`。立体显示六面外壳，额外盖板由标注和计算说明，不模拟真实盖板机械结构。
- 两盒拼接只将一个方向加倍，蓝线显示中间分界；并列最省方案全部高亮。
- 第三问不计额外上盖。题图预设沿四面条带排列，坐标轴尺寸为 `[长, 高, 宽]`；最大周长预设为 `[最短棱, 中间棱, 最长棱]`。
- 最大周长依据内部折痕总长下界 `3a+2b`（a≤b≤c），不是从通用实验室的11种固定尺寸方向中抽取最大值。
- 整体折叠只观察连接，途中可能相交；不宣称具有无碰撞分步折叠路径。
- 不另计粘贴边、裁剪损耗；设置仅在当前页面实例中保存。
