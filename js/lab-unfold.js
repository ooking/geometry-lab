/**
 * ===================================================================
 * 模块 1: 通用展开与折叠工坊 (Net & Folding Studio)
 * 数学自洽、严丝合缝的长方体与正方体连续折叠动力学引擎
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

    // 6 个面的独立纯色定义
    this.faceSpecs = {
      bottom: { key: 'bottom', color: '#10b981' }, // 翡翠绿
      top:    { key: 'top',    color: '#3b82f6' }, // 天青蓝
      front:  { key: 'front',  color: '#f97316' }, // 活力橙
      back:   { key: 'back',   color: '#8b5cf6' }, // 紫罗兰
      left:   { key: 'left',   color: '#f43f5e' }, // 蔷薇红
      right:  { key: 'right',  color: '#f59e0b' }  // 琥珀黄
    };

    // 11 种展开图配置库
    this.patterns11 = this.init11Patterns();
    this.currentPatternId = '141-1';

    this.initThree();
    this.initUI();
    this.loadPatternById('141-1');
  }

  init11Patterns() {
    return LabUtils.cubeNets();
  }

  initThree() {
    if (!this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 9.0, 9.5);

    this.camera.lookAt(0, 0, 0);

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(8, 14, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(16, 32, 0x334155, 0x1e293b);
    gridHelper.position.y = -2;
    this.scene.add(gridHelper);

    this.rootFoldGroup = new THREE.Group();
    this.scene.add(this.rootFoldGroup);

    LabUtils.startViewport(this, delta => { if (this.animating) this.stepAnimation(delta); });
  }

  getEffectiveDims() {
    if (this.shapeType === 'cube') {
      return { l: 2.0, w: 2.0, h: 2.0, displayL: 1, displayW: 1, displayH: 1 };
    } else {
      const L = Math.max(0.5, this.dimL);
      const W = Math.max(0.5, this.dimW);
      const H = Math.max(0.5, this.dimH);
      const maxDim = Math.max(L, W, H);
      const scale = 3.6 / maxDim;
      return { l: L * scale, w: W * scale, h: H * scale, displayL: L, displayW: W, displayH: H };
    }
  }

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

  getFace2DSize(faceKey, dims) {
    const item = this.patterns11[this.currentPatternId].layout.find(face => face.face === faceKey);
    const axisLength = axis => Math.abs(axis[0]) * dims.l + Math.abs(axis[1]) * dims.w + Math.abs(axis[2]) * dims.h;
    return { w: axisLength(item.u), h: axisLength(item.v) };
  }

  updateLegendAndPerimeter() {
    const legend = document.getElementById('faces-legend-container');
    const names = { bottom: '底面', top: '顶面', front: '前面', back: '后面', left: '左面', right: '右面' };
    if (legend) {
      legend.innerHTML = '';
      Object.entries(this.faceSpecs).forEach(([key, spec]) => {
        const entry = document.createElement('div');
        entry.style.borderLeft = `4px solid ${spec.color}`;
        entry.style.paddingLeft = '0.4rem';
        entry.textContent = `${names[key]} ${this.getFaceDimensionText(key)}`;
        legend.appendChild(entry);
      });
    }
    const dims = this.getEffectiveDims();
    let perimeter = 8 * (dims.displayL + dims.displayW + dims.displayH);
    const scale = dims.displayL / dims.l;
    this.patterns11[this.currentPatternId].layout.filter(item => item.parent).forEach(item => {
      const size = this.getFace2DSize(item.face, dims);
      perimeter -= 2 * (['top', 'bottom'].includes(item.edge) ? size.w : size.h) * scale;
    });
    const result = document.getElementById('perimeter-calc-result');
    if (result) result.textContent = `当前展开图外围周长：${Number(perimeter.toFixed(4))} 个长度单位。六个面的周长总和减去 5 条折痕长度的两倍。`;
  }

  /**
   * 渲染 2D 展开图画布 (按真实几何比例绘制，无汉字名称，仅标长宽)
   */
  render2DCanvas() {
    if (!this.canvas2dStage) return;
    this.canvas2dStage.innerHTML = '';

    const pat = this.patterns11[this.currentPatternId];
    if (!pat) return;

    const dims = this.getEffectiveDims();
    const pxScale = this.shapeType === 'cube' ? 38 : 32;

    const positions = {};
    const rootItem = pat.layout.find(item => item.parent === null);
    const rootSize = this.getFace2DSize(rootItem.face, dims);
    const rootWPx = rootSize.w * pxScale;
    const rootHPx = rootSize.h * pxScale;

    positions[rootItem.face] = { x: 0, y: 0, w: rootWPx, h: rootHPx };

    // 广度遍历布局各面位置
    const queue = [rootItem.face];
    while (queue.length > 0) {
      const pFace = queue.shift();
      const pPos = positions[pFace];

      const children = pat.layout.filter(item => item.parent === pFace);
      children.forEach(child => {
        const cSize = this.getFace2DSize(child.face, dims);
        const cWPx = cSize.w * pxScale;
        const cHPx = cSize.h * pxScale;

        let cx = pPos.x, cy = pPos.y + (pPos.h - cHPx) / 2;
        if (child.edge === 'top') {
          cx = pPos.x + (pPos.w - cWPx) / 2;
          cy = pPos.y - cHPx;
        } else if (child.edge === 'bottom') {
          cx = pPos.x + (pPos.w - cWPx) / 2;
          cy = pPos.y + pPos.h;
        } else if (child.edge === 'left') {
          cx = pPos.x - cWPx;
          cy = pPos.y + (pPos.h - cHPx) / 2;
        } else if (child.edge === 'right') {
          cx = pPos.x + pPos.w;
          cy = pPos.y + (pPos.h - cHPx) / 2;
        }

        positions[child.face] = { x: cx, y: cy, w: cWPx, h: cHPx };
        queue.push(child.face);
      });
    }

    // 居中
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    Object.values(positions).forEach(p => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.w);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + p.h);
    });

    this.fitZoom = Math.min(1, (this.canvas2dBox.clientWidth - 28) / (maxX - minX),
      (this.canvas2dBox.clientHeight - 72) / (maxY - minY));
    this.zoom = Math.max(0.1, this.fitZoom);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    Object.entries(positions).forEach(([faceKey, p]) => {
      const div = document.createElement('div');
      div.className = 'net-rect-face';
      div.style.left = `${p.x - midX}px`;
      div.style.top = `${p.y - midY}px`;
      div.style.width = `${p.w}px`;
      div.style.height = `${p.h}px`;
      div.style.background = this.faceSpecs[faceKey].color;

      const dimText = this.getFaceDimensionText(faceKey);
      const label = document.createElement('span');
      label.textContent = dimText;
      label.hidden = p.w < 48 || p.h < 22;
      div.appendChild(label);
      div.title = `尺寸: ${dimText}`;
      this.canvas2dStage.appendChild(div);
    });

    this.updateTransform2D();
    this.updateLegendAndPerimeter();
  }

  updateTransform2D() {
    if (!this.canvas2dStage) return;
    this.canvas2dStage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  reset2DView() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = this.fitZoom || 1;
    this.updateTransform2D();
  }

  /**
   * 重建 3D 动力学连续折叠模型
   * 采用高精度的确定性闭合几何模型与围绕接触折痕的平滑角位移
   */
  rebuild3DFoldingModel() {
    LabUtils.disposeGroup(this.rootFoldGroup);
    const pat = this.patterns11[this.currentPatternId];
    const dims = this.getEffectiveDims();
    this.rootFoldGroup.rotation.set(-Math.PI / 2, 0, 0);
    this.rootFoldGroup.position.set(0, -dims.h / 2, 0);
    this.faceMeshes = {};
    this.foldHinges = [];
    const groups = {};
    // Every child rotates around its shared edge in its parent's local coordinates.
    pat.layout.forEach(item => {
      const size = this.getFace2DSize(item.face, dims);
      const faceGroup = new THREE.Group();
      if (!item.parent) {
        this.rootFoldGroup.add(faceGroup);
      } else {
        const parentSize = this.getFace2DSize(item.parent, dims);
        const hinge = new THREE.Group();
        let axis, sign;
        if (item.edge === 'top' || item.edge === 'bottom') {
          sign = item.edge === 'top' ? 1 : -1;
          hinge.position.y = sign * parentSize.h / 2;
          faceGroup.position.y = sign * size.h / 2;
          axis = 'x';
        } else {
          sign = item.edge === 'right' ? 1 : -1;
          hinge.position.x = sign * parentSize.w / 2;
          faceGroup.position.x = sign * size.w / 2;
          axis = 'y';
          sign = -sign;
        }
        groups[item.parent].add(hinge);
        hinge.add(faceGroup);
        this.foldHinges.push({ hinge, axis, sign });
      }
      groups[item.face] = faceGroup;
      const mesh = this.createFaceMesh(item.face, size.w, size.h, this.faceSpecs[item.face].color);
      faceGroup.add(mesh);
      this.faceMeshes[item.face] = mesh;
    });
    const progress = this.foldProgress;
    this.applyFoldProgress(0);
    this.rootFoldGroup.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.rootFoldGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const distance = Math.max(size.x / Math.max(this.camera.aspect, 0.1), size.z, dims.h * 2) /
      (2 * Math.tan(this.camera.fov * Math.PI / 360)) * 1.35;
    this.defaultViewTarget = center;
    this.defaultViewPosition = center.clone().add(new THREE.Vector3(0, distance * 0.75, distance * 0.8));
    this.resetCamera();
    this.applyFoldProgress(progress);
  }

  resetCamera() {
    if (!this.defaultViewPosition) return;
    this.camera.position.copy(this.defaultViewPosition);
    if (this.controls) this.controls.target.copy(this.defaultViewTarget);
    else this.camera.lookAt(this.defaultViewTarget);
  }

  createFaceMesh(faceKey, width, height, colorHex) {
    const geo = new THREE.PlaneGeometry(width, height);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 244);

    // 仅绘制长宽尺寸数值，无汉字名称
    const text = this.getFaceDimensionText(faceKey);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 10;
    ctx.fillText(text, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.35,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { faceKey };
    return mesh;
  }

  /**
   * 沿共享折痕连续转动
   * t=0 为平面展开，t=1 为各折痕转动 90° 后的闭合状态
   */
  applyFoldProgress(t) {
    this.foldProgress = t;

    this.foldHinges?.forEach(({ hinge, axis, sign }) => {
      hinge.rotation[axis] = sign * t * Math.PI / 2;
    });
    const play = document.getElementById('btn-unfold-toggle');
    if (play) play.textContent = this.animating ? '⏸ 暂停' : (t >= 1 ? '▶ 展开' : '▶ 折叠 / 继续');

    const slider = document.getElementById('unfold-progress-slider');
    const label = document.getElementById('unfold-progress-val');
    if (slider) slider.value = Math.round(t * 100);
    if (label) label.textContent = `${Math.round(t * 100)}% · ${(t * 90).toFixed(1)}°`;

    const banner = document.getElementById('unfold-status-banner');
    if (banner) {
      if (t >= 1) {
        banner.className = 'status-banner success';
        banner.innerHTML = `🎉 <strong>折叠完成！</strong> 6 个面沿折痕闭合成${this.shapeType === 'cube' ? '正方体' : '长方体'}！`;
      } else if (t <= 0) {
        banner.className = 'status-banner info';
        banner.innerHTML = `📐 <strong>完全展开状态</strong>：在右侧 2D 画布中拖动/缩放查看，点击【折叠 / 继续】观察立体闭合。`;
      } else {
        banner.className = 'status-banner info';
        banner.innerHTML = `${this.animating ? "🔄 正在播放" : "⏸ 当前折叠状态"} 折痕转角：${(t * 90).toFixed(1)}°`;
      }
    }
  }

  toggleAnimation() {
    if (this.animating) {
      this.animating = false;
      this.applyFoldProgress(this.foldProgress);
      return;
    }
    if (this.foldProgress >= 1) this.animationDirection = -1;
    else if (this.foldProgress <= 0) this.animationDirection = 1;
    this.animating = true;
    this.applyFoldProgress(this.foldProgress);
  }

  stepAnimation(delta) {
    const speed = delta / 3;
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
    this.animating = false;
    this.foldProgress = 0;
    document.querySelectorAll('.net-pattern-btn').forEach(button => {
      const active = button.dataset.id === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    this.reset2DView();

    this.render2DCanvas();
    this.rebuild3DFoldingModel();
  }

  initUI() {
    // 2D 画布鼠标平移拖动与滚轮缩放
    if (this.canvas2dBox) {
      this.canvas2dBox.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button') || this.isDragging2D) return;
        this.canvas2dBox.setPointerCapture(e.pointerId);
        this.dragPointerId = e.pointerId;
        this.isDragging2D = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      });

      this.canvas2dBox.addEventListener('pointermove', (e) => {
        if (!this.isDragging2D || e.pointerId !== this.dragPointerId) return;
        this.panX = e.clientX - this.dragStartX;
        this.panY = e.clientY - this.dragStartY;
        this.updateTransform2D();
      });

      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
        this.canvas2dBox.addEventListener(type, () => { this.isDragging2D = false; });
      });

      this.canvas2dBox.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.zoom = Math.min(3.0, Math.max(0.1, this.zoom + delta));
        this.updateTransform2D();
      }, { passive: false });
    }

    const btnZoomIn = document.getElementById('btn-2d-zoomin');
    const btnZoomOut = document.getElementById('btn-2d-zoomout');
    const btnReset2D = document.getElementById('btn-2d-reset');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => { this.zoom = Math.min(3.0, this.zoom + 0.15); this.updateTransform2D(); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => { this.zoom = Math.max(0.1, this.zoom - 0.15); this.updateTransform2D(); });
    if (btnReset2D) btnReset2D.addEventListener('click', () => this.reset2DView());

    // 正方体 / 长方体 切换
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

        this.loadPatternById(this.currentPatternId);
      });
    });

    // 长宽高实时输入
    const inpL = document.getElementById('unfold-dim-l');
    const inpW = document.getElementById('unfold-dim-w');
    const inpH = document.getElementById('unfold-dim-h');

    const handleDimChange = () => {
      if (![inpL, inpW, inpH].every(input => input && input.validity.valid && Number.isFinite(input.valueAsNumber))) return;
      this.dimL = inpL.valueAsNumber;
      this.dimW = inpW.valueAsNumber;
      this.dimH = inpH.valueAsNumber;

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

    // 滑动条与动画播放
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
        this.resetCamera();
      });
    }
  }
}

window.UnfoldLab = UnfoldLab;
