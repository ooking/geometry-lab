/**
 * ===================================================================
 * 模块 1: 通用展开与折叠工坊 (Net & Folding Studio)
 * 核心升级：
 * 1. 数学自洽的长方体与正方体统一展开折叠引擎；
 * 2. 面的纯色设计，面上仅标注真实长宽尺寸（如 "5 × 3"），不显示中文面名；
 * 3. 完整分类收录 11 种展开图，支持一键载入；
 * 4. 2D 展开图画布支持平移拖拽 (Pan) 与滚轮缩放 (Zoom) 及居中复位。
 * ===================================================================
 */

class UnfoldLab {
  constructor() {
    this.container = document.getElementById('canvas-unfold-container');
    this.canvas2dBox = document.getElementById('unfold-canvas-2d-box');
    this.canvas2dStage = document.getElementById('unfold-canvas-stage');

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.rootFoldGroup = null;

    // 几何体类型: 'cube' (正方体) 或 'cuboid' (长方体)
    this.shapeType = 'cube';

    // 尺寸设定 (长 L, 宽 W, 高 H)
    this.dimL = 4.0;
    this.dimW = 3.0;
    this.dimH = 2.0;

    // 2D 画布平移缩放状态
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.isDragging2D = false;
    this.dragStartX = 0;
    this.dragStartY = 0;

    this.foldProgress = 0.0;
    this.animating = false;
    this.animationDirection = 1;

    // 6 个面的独立纯色定义与尺寸计算器
    this.faceSpecs = {
      bottom: { key: 'bottom', color: '#10b981', getDim: (l, w, h) => ({ w: l, h: w }) }, // 翡翠绿
      top:    { key: 'top',    color: '#3b82f6', getDim: (l, w, h) => ({ w: l, h: w }) }, // 天青蓝
      front:  { key: 'front',  color: '#f97316', getDim: (l, w, h) => ({ w: l, h: h }) }, // 活力橙
      back:   { key: 'back',   color: '#8b5cf6', getDim: (l, w, h) => ({ w: l, h: h }) }, // 紫罗兰
      left:   { key: 'left',   color: '#f43f5e', getDim: (l, w, h) => ({ w: w, h: h }) }, // 蔷薇红
      right:  { key: 'right',  color: '#f59e0b', getDim: (l, w, h) => ({ w: w, h: h }) }  // 琥珀黄
    };

    // 当前选中的展开图树状拓扑
    this.currentNetTree = null;
    this.currentPatternId = '141-1';

    // 11 种严格等长匹配的长方体/正方体展开拓扑树
    this.patterns11 = this.init11Patterns();

    this.initThree();
    this.initUI();
    this.loadPatternById('141-1');
  }

  /**
   * 构建 11 种展开图严格相接拓扑树
   */
  init11Patterns() {
    return {
      // 1. 一四一型 (共 6 种): 中间 4 个侧面环绕或一列，两侧各 1 个底面/顶面
      '141-1': {
        name: '一四一型 ① (上下同侧于前面)',
        type: '1-4-1',
        tree: {
          face: 'front', // 根面: 前面 (L x H)
          children: [
            { edge: 'top', face: 'top', children: [] }, // 上接顶面 (L x W)
            { edge: 'bottom', face: 'bottom', children: [] }, // 下接底面 (L x W)
            { edge: 'left', face: 'left', children: [ // 左接左面 (W x H)
              { edge: 'left', face: 'back', children: [] } // 左面再接后面 (L x H)
            ]},
            { edge: 'right', face: 'right', children: [] } // 右接右面 (W x H)
          ]
        }
      },
      '141-2': {
        name: '一四一型 ② (顶面接前面，底面接后面)',
        type: '1-4-1',
        tree: {
          face: 'front',
          children: [
            { edge: 'top', face: 'top', children: [] },
            { edge: 'right', face: 'right', children: [
              { edge: 'right', face: 'back', children: [
                { edge: 'bottom', face: 'bottom', children: [] }
              ]}
            ]},
            { edge: 'left', face: 'left', children: [] }
          ]
        }
      },
      '141-3': {
        name: '一四一型 ③ (顶面接前面，底面接左面侧边)',
        type: '1-4-1',
        tree: {
          face: 'bottom', // 根面: 底面 (L x W)
          children: [
            { edge: 'top', face: 'back', children: [] }, // 上接后面 (L x H)
            { edge: 'bottom', face: 'front', children: [ // 下接前面 (L x H)
              { edge: 'bottom', face: 'top', children: [] } // 前面再接顶面 (L x W)
            ]},
            { edge: 'left', face: 'left', children: [] }, // 左接左面 (W x H)
            { edge: 'right', face: 'right', children: [] } // 右接右面 (W x H)
          ]
        }
      },
      '141-4': {
        name: '一四一型 ④ (底在中间，顶在后面上方)',
        type: '1-4-1',
        tree: {
          face: 'bottom',
          children: [
            { edge: 'top', face: 'back', children: [
              { edge: 'top', face: 'top', children: [] }
            ]},
            { edge: 'bottom', face: 'front', children: [] },
            { edge: 'left', face: 'left', children: [] },
            { edge: 'right', face: 'right', children: [] }
          ]
        }
      },
      '141-5': {
        name: '一四一型 ⑤ (顶接左面，底接右面)',
        type: '1-4-1',
        tree: {
          face: 'front',
          children: [
            { edge: 'left', face: 'left', children: [
              { edge: 'top', face: 'top', children: [] },
              { edge: 'left', face: 'back', children: [] }
            ]},
            { edge: 'right', face: 'right', children: [
              { edge: 'bottom', face: 'bottom', children: [] }
            ]}
          ]
        }
      },
      '141-6': {
        name: '一四一型 ⑥ (两端极值错位)',
        type: '1-4-1',
        tree: {
          face: 'back',
          children: [
            { edge: 'bottom', face: 'bottom', children: [] },
            { edge: 'left', face: 'left', children: [] },
            { edge: 'right', face: 'right', children: [
              { edge: 'right', face: 'front', children: [
                { edge: 'top', face: 'top', children: [] }
              ]}
            ]}
          ]
        }
      },

      // 2. 二三一型 (共 3 种): 中间 3 个连排，一侧 2 个，另一侧 1 个
      '231-1': {
        name: '二三一型 ① (偏左对齐)',
        type: '2-3-1',
        tree: {
          face: 'bottom',
          children: [
            { edge: 'bottom', face: 'front', children: [
              { edge: 'left', face: 'left', children: [
                { edge: 'left', face: 'back', children: [] }
              ]}
            ]},
            { edge: 'top', face: 'top', children: [] },
            { edge: 'right', face: 'right', children: [] }
          ]
        }
      },
      '231-2': {
        name: '二三一型 ② (中间错位)',
        type: '2-3-1',
        tree: {
          face: 'front',
          children: [
            { edge: 'left', face: 'left', children: [
              { edge: 'top', face: 'top', children: [] }
            ]},
            { edge: 'right', face: 'right', children: [
              { edge: 'right', face: 'back', children: [
                { edge: 'bottom', face: 'bottom', children: [] }
              ]}
            ]}
          ]
        }
      },
      '231-3': {
        name: '二三一型 ③ (偏右对齐)',
        type: '2-3-1',
        tree: {
          face: 'bottom',
          children: [
            { edge: 'top', face: 'back', children: [
              { edge: 'right', face: 'right', children: [
                { edge: 'right', face: 'front', children: [] }
              ]}
            ]},
            { edge: 'left', face: 'left', children: [] },
            { edge: 'bottom', face: 'top', children: [] }
          ]
        }
      },

      // 3. 二二二型 (共 1 种): 阶梯错排
      '222-1': {
        name: '二二二型 (阶梯步步高)',
        type: '2-2-2',
        tree: {
          face: 'back',
          children: [
            { edge: 'bottom', face: 'bottom', children: [
              { edge: 'right', face: 'right', children: [
                { edge: 'bottom', face: 'front', children: [
                  { edge: 'right', face: 'top', children: [
                    { edge: 'bottom', face: 'left', children: [] }
                  ]}
                ]}
              ]}
            ]}
          ]
        }
      },

      // 4. 三三型 (共 1 种): 两排各 3 个错开
      '33-1': {
        name: '三三型 (两排错位对称)',
        type: '3-3',
        tree: {
          face: 'back',
          children: [
            { edge: 'right', face: 'left', children: [
              { edge: 'right', face: 'top', children: [] }
            ]},
            { edge: 'bottom', face: 'bottom', children: [
              { edge: 'right', face: 'right', children: [
                { edge: 'right', face: 'front', children: [] }
              ]}
            ]}
          ]
        }
      }
    };
  }

  initThree() {
    if (!this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 8.5, 9.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.15;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(8, 14, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(16, 32, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.55;
    this.scene.add(gridHelper);

    this.rootFoldGroup = new THREE.Group();
    this.scene.add(this.rootFoldGroup);

    const animate = () => {
      requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
      if (this.animating) {
        this.stepAnimation();
      }
      this.renderer.render(this.scene, this.camera);
    };
    animate();

    window.addEventListener('resize', () => {
      if (!this.container || !this.renderer) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  // 获取当前几何体尺寸
  getEffectiveDims() {
    if (this.shapeType === 'cube') {
      return { l: 2.0, w: 2.0, h: 2.0, displayL: 1, displayW: 1, displayH: 1 };
    } else {
      const L = Math.max(0.5, this.dimL);
      const W = Math.max(0.5, this.dimW);
      const H = Math.max(0.5, this.dimH);
      const maxDim = Math.max(L, W, H);
      const scale = 3.6 / maxDim; // 3D 归一化缩放
      return { l: L * scale, w: W * scale, h: H * scale, displayL: L, displayW: W, displayH: H };
    }
  }

  /**
   * 计算指定面的尺寸字符串，如 "5 × 3"
   */
  getFaceDimensionText(faceKey) {
    const dims = this.getEffectiveDims();
    const l = dims.displayL;
    const w = dims.displayW;
    const h = dims.displayH;

    if (faceKey === 'bottom' || faceKey === 'top') {
      return `${l} × ${w}`;
    } else if (faceKey === 'front' || faceKey === 'back') {
      return `${l} × ${h}`;
    } else {
      return `${w} × ${h}`;
    }
  }

  /**
   * 获取指定面在 3D 空间中的几何尺寸 (宽度 x 沿相接边，高度 z)
   */
  getFace3DSize(faceKey, dims) {
    if (faceKey === 'bottom' || faceKey === 'top') {
      return { x: dims.l, z: dims.w };
    } else if (faceKey === 'front' || faceKey === 'back') {
      return { x: dims.l, z: dims.h };
    } else {
      return { x: dims.w, z: dims.h };
    }
  }

  /**
   * 渲染 2D 展开画布 (带真实尺寸和拖拽支持)
   */
  render2DCanvas() {
    if (!this.canvas2dStage || !this.currentNetTree) return;
    this.canvas2dStage.innerHTML = '';

    const dims = this.getEffectiveDims();
    const pxScale = (this.shapeType === 'cube') ? 38 : (120 / Math.max(dims.displayL, dims.displayW, dims.displayH));

    // 递归计算各节点在 2D 平面中的坐标 (x, y, w, h)
    const rects = [];
    const layoutNode = (node, curX, curY) => {
      const spec = this.faceSpecs[node.face];
      const sz3d = this.getFace3DSize(node.face, dims);
      const wPx = (sz3d.x / (this.shapeType === 'cube' ? 2 : (3.6 / Math.max(dims.displayL, dims.displayW, dims.displayH)))) * pxScale;
      const hPx = (sz3d.z / (this.shapeType === 'cube' ? 2 : (3.6 / Math.max(dims.displayL, dims.displayW, dims.displayH)))) * pxScale;

      rects.push({
        face: node.face,
        color: spec.color,
        text: this.getFaceDimensionText(node.face),
        x: curX,
        y: curY,
        w: wPx,
        h: hPx
      });

      if (node.children) {
        node.children.forEach(child => {
          const childSz = this.getFace3DSize(child.face, dims);
          const cWPx = (childSz.x / (this.shapeType === 'cube' ? 2 : (3.6 / Math.max(dims.displayL, dims.displayW, dims.displayH)))) * pxScale;
          const cHPx = (childSz.z / (this.shapeType === 'cube' ? 2 : (3.6 / Math.max(dims.displayL, dims.displayW, dims.displayH)))) * pxScale;

          let nextX = curX;
          let nextY = curY;

          if (child.edge === 'top') {
            nextX = curX;
            nextY = curY - cHPx;
          } else if (child.edge === 'bottom') {
            nextX = curX;
            nextY = curY + hPx;
          } else if (child.edge === 'left') {
            nextX = curX - cWPx;
            nextY = curY;
          } else if (child.edge === 'right') {
            nextX = curX + wPx;
            nextY = curY;
          }

          layoutNode(child, nextX, nextY);
        });
      }
    };

    layoutNode(this.currentNetTree, 0, 0);

    // 计算包围盒进行居中
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    rects.forEach(r => {
      minX = Math.min(minX, r.x);
      maxX = Math.max(maxX, r.x + r.w);
      minY = Math.min(minY, r.y);
      maxY = Math.max(maxY, r.y + r.h);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    rects.forEach(r => {
      const div = document.createElement('div');
      div.className = 'net-rect-face';
      div.style.left = `${r.x - centerX}px`;
      div.style.top = `${r.y - centerY}px`;
      div.style.width = `${r.w}px`;
      div.style.height = `${r.h}px`;
      div.style.background = r.color;
      div.innerHTML = `<span style="font-size:0.85rem;letter-spacing:0.5px;">${r.text}</span>`;
      div.title = `尺寸: ${r.text}`;
      this.canvas2dStage.appendChild(div);
    });

    this.updateTransform2D();
  }

  updateTransform2D() {
    if (!this.canvas2dStage) return;
    this.canvas2dStage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  reset2DView() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.updateTransform2D();
  }

  /**
   * 重建 3D 动力学折叠模型 (严格自洽长方体骨骼树)
   */
  rebuild3DFoldingModel() {
    while (this.rootFoldGroup.children.length > 0) {
      this.rootFoldGroup.remove(this.rootFoldGroup.children[0]);
    }

    if (!this.currentNetTree) return;
    const dims = this.getEffectiveDims();

    // 递归构建 3D Group 树
    const buildNode3D = (node, parentEdge = null) => {
      const group = new THREE.Group();
      const sz = this.getFace3DSize(node.face, dims);
      const spec = this.faceSpecs[node.face];

      // 创建该面自身的 Mesh
      const mesh = this.createFaceMesh(node.face, sz.x, sz.z, spec.color);
      group.add(mesh);
      group.userData = { face: node.face, edge: parentEdge, sz };

      // 子节点
      if (node.children) {
        node.children.forEach(child => {
          const childSz = this.getFace3DSize(child.face, dims);
          const joint = new THREE.Group();
          joint.userData = { edge: child.edge, face: child.face };

          // 关节定位在父面的相接棱上
          if (child.edge === 'top') joint.position.set(0, 0, -sz.z / 2);
          else if (child.edge === 'bottom') joint.position.set(0, 0, sz.z / 2);
          else if (child.edge === 'left') joint.position.set(-sz.x / 2, 0, 0);
          else if (child.edge === 'right') joint.position.set(sz.x / 2, 0, 0);

          const childSubTree = buildNode3D(child, child.edge);

          // 子面中心相对于棱平移其自身尺寸的一半
          if (child.edge === 'top') childSubTree.position.set(0, 0, -childSz.z / 2);
          else if (child.edge === 'bottom') childSubTree.position.set(0, 0, childSz.z / 2);
          else if (child.edge === 'left') childSubTree.position.set(-childSz.x / 2, 0, 0);
          else if (child.edge === 'right') childSubTree.position.set(childSz.x / 2, 0, 0);

          joint.add(childSubTree);
          group.add(joint);
        });
      }

      return group;
    };

    const rootGroup = buildNode3D(this.currentNetTree);
    this.rootFoldGroup.add(rootGroup);

    this.applyFoldProgress(this.foldProgress);
  }

  createFaceMesh(faceKey, width, depth, colorHex) {
    const th = 0.04;
    const geo = new THREE.BoxGeometry(width - 0.02, th, depth - 0.02);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, 244, 244);

    // 仅绘制长宽数值尺寸，不写文字面名
    const text = this.getFaceDimensionText(faceKey);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { faceKey };
    return mesh;
  }

  applyFoldProgress(t) {
    this.foldProgress = t;
    const angle = t * (Math.PI / 2);

    const rotateJoints = (group) => {
      for (let child of group.children) {
        if (child.userData && child.userData.edge) {
          const edge = child.userData.edge;
          if (edge === 'top') child.rotation.x = angle;
          else if (edge === 'bottom') child.rotation.x = -angle;
          else if (edge === 'left') child.rotation.z = -angle;
          else if (edge === 'right') child.rotation.z = angle;
        }
        rotateJoints(child);
      }
    };

    rotateJoints(this.rootFoldGroup);

    const slider = document.getElementById('unfold-progress-slider');
    const label = document.getElementById('unfold-progress-val');
    if (slider) slider.value = Math.round(t * 100);
    if (label) label.textContent = `${Math.round(t * 100)}%`;

    const banner = document.getElementById('unfold-status-banner');
    if (banner) {
      if (t >= 0.98) {
        banner.className = 'status-banner success';
        banner.innerHTML = `🎉 <strong>折叠完成！</strong> 6 个矩形面严丝合缝闭合成完整${this.shapeType === 'cube' ? '正方体' : '长方体'}，各面尺寸与颜色完全对应！`;
      } else if (t <= 0.02) {
        banner.className = 'status-banner info';
        banner.innerHTML = `📐 <strong>完全展开状态</strong>：在右侧 2D 画布中拖动/缩放查看，点击【连续折叠】观察 3D 闭合过程。`;
      } else {
        banner.className = 'status-banner info';
        banner.innerHTML = `🔄 正在动力学折叠中... 旋转进度：${Math.round(t * 100)}%`;
      }
    }
  }

  toggleAnimation() {
    if (this.animating) {
      this.animating = false;
      return;
    }
    if (this.foldProgress >= 0.98) this.animationDirection = -1;
    else if (this.foldProgress <= 0.02) this.animationDirection = 1;
    this.animating = true;
  }

  stepAnimation() {
    const speed = 0.025;
    this.foldProgress += this.animationDirection * speed;
    if (this.foldProgress >= 1) {
      this.foldProgress = 1;
      this.animating = false;
      this.animationDirection = -1;
    } else if (this.foldProgress <= 0) {
      this.foldProgress = 0;
      this.animating = false;
      this.animationDirection = 1;
    }
    this.applyFoldProgress(this.foldProgress);
  }

  loadPatternById(id) {
    const pat = this.patterns11[id];
    if (!pat) return;
    this.currentPatternId = id;
    this.currentNetTree = pat.tree;

    this.render2DCanvas();
    this.rebuild3DFoldingModel();
  }

  initUI() {
    // 2D 画布鼠标拖拽平移 (Pan) 与滚轮缩放 (Zoom)
    if (this.canvas2dBox) {
      this.canvas2dBox.addEventListener('mousedown', (e) => {
        this.isDragging2D = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging2D) return;
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.updateTransform2D();
      });

      window.addEventListener('mouseup', () => {
        this.isDragging2D = false;
      });

      this.canvas2dBox.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.zoom = Math.min(3.0, Math.max(0.4, this.zoom + delta));
        this.updateTransform2D();
      }, { passive: false });
    }

    // 2D 悬浮按钮 (放大、缩小、复位)
    const btnZoomIn = document.getElementById('btn-2d-zoomin');
    const btnZoomOut = document.getElementById('btn-2d-zoomout');
    const btnReset2D = document.getElementById('btn-2d-reset');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => { this.zoom = Math.min(3.0, this.zoom + 0.15); this.updateTransform2D(); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => { this.zoom = Math.max(0.4, this.zoom - 0.15); this.updateTransform2D(); });
    if (btnReset2D) btnReset2D.addEventListener('click', () => this.reset2DView());

    // 正方体 / 长方体 模式切换
    const shapeBtns = document.querySelectorAll('.unfold-shape-type-btn');
    shapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.shapeType = btn.dataset.shape;

        const dimInputs = document.getElementById('cuboid-dim-inputs-row');
        if (dimInputs) {
          dimInputs.style.display = (this.shapeType === 'cuboid') ? 'grid' : 'none';
        }

        this.render2DCanvas();
        this.rebuild3DFoldingModel();
      });
    });

    // 长宽高输入联动
    const inpL = document.getElementById('unfold-dim-l');
    const inpW = document.getElementById('unfold-dim-w');
    const inpH = document.getElementById('unfold-dim-h');

    const handleDimChange = () => {
      this.dimL = Math.max(0.5, parseFloat(inpL?.value || 4));
      this.dimW = Math.max(0.5, parseFloat(inpW?.value || 3));
      this.dimH = Math.max(0.5, parseFloat(inpH?.value || 2));

      this.render2DCanvas();
      this.rebuild3DFoldingModel();
    };

    [inpL, inpW, inpH].forEach(inp => {
      if (inp) inp.addEventListener('input', handleDimChange);
    });

    // 11 种展开图分类按钮
    const patternBtns = document.querySelectorAll('.net-pattern-btn');
    patternBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        patternBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadPatternById(btn.dataset.id);
      });
    });

    // 折叠滑动条与动画
    const slider = document.getElementById('unfold-progress-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.animating = false;
        this.applyFoldProgress(parseFloat(e.target.value) / 100);
      });
    }

    const btnPlay = document.getElementById('btn-unfold-toggle');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => this.toggleAnimation());
    }

    const btnResetCam = document.getElementById('btn-unfold-reset-cam');
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        this.camera.position.set(0, 8.5, 9.5);
        if (this.controls) this.controls.target.set(0, 0, 0);
      });
    }
  }
}

window.UnfoldLab = UnfoldLab;
