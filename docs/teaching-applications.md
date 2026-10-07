# 独立教学应用扩展

教学应用通过“展开与折叠”的二级菜单进入独立 HTML 页面，不读取或修改通用实验室实例。包装盒应用入口为 `packaging.html`，通用实验室保留在 `index.html`。

## 文件职责

- `packaging.html`：包装盒独立页面，只加载自身应用所需脚本。
- `js/navigation.js` 与 `css/navigation.css`：共享二级菜单行为与样式。
- `js/application-page.js`：独立应用页面初始化、页面可见性、全屏与页头布局。
- `js/application-panels.js`：应用注册、懒初始化与生命周期，兼容独立页面中的普通容器和按需打开的 details 容器。
- `js/teaching-cuboid.js`：纯长方体计算、展开图布局、SVG 绘制，以及独立的 Three.js 视图。
- `js/application-packaging.js`：通用包装配置、用料计算流程、界面与自身状态。
- `css/application-panels.css`：按应用名称限定作用域的样式。

包装盒不依赖 `UnfoldLab`，只复用 `LabUtils.rootNet`、`disposeGroup` 和 `startViewport`。页面之间不共享尺寸、底面、展开图选择、动画进度或渲染器。

## 新增应用页面

1. 新建 HTML 页面，复用站点页头和二级菜单，在 `.tab-panel.active` 中添加 `[data-teaching-application="your-name"]` 容器。工作区 ID 使用 `panel-your-name`。
2. 新建应用脚本，通过 `TeachingApplications.register('your-name', host => new YourApplication(host))` 注册工厂。
3. 应用实例实现 `setActive(active)`。页面初始化或容器首次展开时构造；页面隐藏时暂停绘图和动画。
4. 所有查询从传入的 `host` 开始，避免全局选择器、重复 ID 和直接绑定其他应用的控件。
5. 纯计算与应用配置分开。长方体应用可复用 `TeachingCuboid.measures`、`boxNet`、`stripNet`、`drawNet`，需要立体观察时使用 `CuboidTeachingView`。
6. 按注册器、公共绘图脚本、应用脚本、`application-page.js` 的顺序加载，在二级菜单中添加新页面链接。无需修改通用实验室类。
7. 返回通用工作区的链接使用 `index.html#unfold`、`index.html#views` 或 `index.html#section`，主页面会按地址定位对应模块。

## 包装盒计算约定

- 默认长5、宽3、高4、双层上盖、厘米。切换计算内容保留尺寸和单位，切换单位不换算数值。
- 长×宽始终为包装底面；上盖层数仅影响用料，不因视角旋转变化。
- 双层上盖纸板面积为 `2(lw+lh+wh)+lw`。立体显示六面外壳，额外盖板由标注和计算说明，不模拟真实盖板机械结构。
- 两盒拼接只将一个方向加倍，蓝线显示中间分界；并列最省方案全部高亮。
- 周长计算不计额外上盖。常规预设沿四面条带排列，坐标轴尺寸为 `[长, 高, 宽]`；最大周长预设为 `[最短棱, 中间棱, 最长棱]`。
- 最大周长依据内部折痕总长下界 `3a+2b`（a≤b≤c），不是从通用实验室的11种固定尺寸方向中抽取最大值。
- 整体折叠用于观察连接，途中可能相交；不宣称具有无碰撞分步折叠路径。
- 不另计粘贴边、裁剪损耗；设置仅在当前页面实例中保存，刷新或跨页面后恢复默认值。
