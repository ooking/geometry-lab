/**
 * ===================================================================
 * 模块 1: 通用展开与折叠工坊 (Net & Folding Studio)
 * 特色能力：
 * 1. 支持正方体与长方体自由切换，长宽高自由修改并联动缩放；
 * 2. 6 个面全部赋予独立互不相同的鲜明颜色与尺寸标签；
 * 3. 完整分类收录初中数学全部 11 种展开图（一四一型 6 种、二三一型 3 种、二二二型 1 种、三三型 1 种）支持一键载入；
 * 4. 2D 网格与 3D 骨骼动力折叠联动，具备面重叠报警与闭合检测。
 * ===================================================================
 */

class UnfoldLab {
  constructor() {
    this.container = document.getElementById('canvas-unfold-container');
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

    // 通用 6x6 网格
    this.rows = 6;
    this.cols = 6;
    this.grid = []; // 存储 null 或 { id, faceKey, label, colorHex, isBase }
    this.foldProgress = 0.0;
    this.animating = false;
    this.animationDirection = 1;

    // 6 个面的统一定义与鲜艳对比色
    this.faceDefinitions = {
      bottom: { key: 'bottom', name: '底面', color: '#10b981', getDim: (l, w, h) => ({ x: l, z: w }) },
      top:    { key: 'top',    name: '顶面', color: '#3b82f6', getDim: (l, w, h) => ({ x: l, z: w }) },
      front:  { key: 'front',  name: '前面', color: '#f97316', getDim: (l, w, h) => ({ x: l, z: h }) },
      back:   { key: 'back',   name: '后面', color: '#8b5cf6', getDim: (l, w, h) => ({ x: l, z: h }) },
      left:   { key: 'left',   name: '左面', color: '#f43f5e', getDim: (l, w, h) => ({ x: w, z: h }) },
      right:  { key: 'right',  name: '右面', color: '#f59e0b', getDim: (l, w, h) => ({ x: w, z: h }) }
    };

    // 11 种正方体标准展开图库（按四大类型严格归类）
    this.patterns11 = {
      // 1. 一四一型 (共 6 种): 中间4个连成一线，两侧各1个
      '141-1': {
        name: '一四一型 ① (1-1 对称)',
        type: '1-4-1',
        cells: [
          { r: 1, c: 1, face: 'top' },
          { r: 2, c: 1, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'back' },
          { r: 3, c: 1, face: 'front' }
        ]
      },
      '141-2': {
        name: '一四一型 ② (1-2 错位)',
        type: '1-4-1',
        cells: [
          { r: 1, c: 1, face: 'top' },
          { r: 2, c: 1, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'back' },
          { r: 3, c: 2, face: 'front' }
        ]
      },
      '141-3': {
        name: '一四一型 ③ (1-3 错位)',
        type: '1-4-1',
        cells: [
          { r: 1, c: 1, face: 'top' },
          { r: 2, c: 1, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'back' },
          { r: 3, c: 3, face: 'front' }
        ]
      },
      '141-4': {
        name: '一四一型 ④ (1-4 极值端)',
        type: '1-4-1',
        cells: [
          { r: 1, c: 1, face: 'top' },
          { r: 2, c: 1, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'back' },
          { r: 3, c: 4, face: 'front' }
        ]
      },
      '141-5': {
        name: '一四一型 ⑤ (2-2 对齐)',
        type: '1-4-1',
        cells: [
          { r: 1, c: 2, face: 'back' },
          { r: 2, c: 1, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'top' },
          { r: 3, c: 2, face: 'front' }
        ]
      },
      '141-6': {
        name: '一四一型 ⑥ (2-3 错位)',
        type: '1-4-1',
        cells: [
          { r: 1, c: 2, face: 'back' },
          { r: 2, c: 1, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'top' },
          { r: 3, c: 3, face: 'front' }
        ]
      },

      // 2. 二三一型 / 一三二型 (共 3 种): 中间3个连成一线，一侧2个，另一侧1个
      '231-1': {
        name: '二三一型 ① (偏左对齐)',
        type: '2-3-1',
        cells: [
          { r: 1, c: 1, face: 'back' },
          { r: 1, c: 2, face: 'top' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'left' },
          { r: 3, c: 2, face: 'front' }
        ]
      },
      '231-2': {
        name: '二三一型 ② (下中错位)',
        type: '2-3-1',
        cells: [
          { r: 1, c: 1, face: 'back' },
          { r: 1, c: 2, face: 'top' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'left' },
          { r: 3, c: 3, face: 'front' }
        ]
      },
      '231-3': {
        name: '二三一型 ③ (下端偏右)',
        type: '2-3-1',
        cells: [
          { r: 1, c: 1, face: 'back' },
          { r: 1, c: 2, face: 'top' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'left' },
          { r: 3, c: 4, face: 'front' }
        ]
      },

      // 3. 二二二型 (阶梯型 / 步步高，共 1 种)
      '222-1': {
        name: '二二二型 (阶梯步步高)',
        type: '2-2-2',
        cells: [
          { r: 1, c: 1, face: 'back' },
          { r: 1, c: 2, face: 'top' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 3, c: 3, face: 'front' },
          { r: 3, c: 4, face: 'left' }
        ]
      },

      // 4. 三三型 (两排各3个错开1格，共 1 种)
      '33-1': {
        name: '三三型 (两排错位)',
        type: '3-3',
        cells: [
          { r: 1, c: 1, face: 'back' },
          { r: 1, c: 2, face: 'top' },
          { r: 1, c: 3, face: 'left' },
          { r: 2, c: 2, face: 'bottom', isBase: true },
          { r: 2, c: 3, face: 'right' },
          { r: 2, c: 4, face: 'front' }
        ]
      }
    };

    this.initGrid();
    this.initThree();
    this.initUI();
    this.loadPatternById('141-2');
  }

  initGrid() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      for (let c = 0; c < this.cols; c++) {
        row.push(null);
      }
      this.grid.push(row);
    }
  }

  initThree() {
    if (!this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 9.5, 9.0);

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(8, 14, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(14, 28, 0x334155, 0x1e293b);
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

  // 获得当前尺寸（正方体返回 1,1,1；长方体返回当前 L,W,H）
  getCurrentDimensions() {
    if (this.shapeType === 'cube') {
      return { l: 1.0, w: 1.0, h: 1.0, scale: 1.2 };
    } else {
      const maxDim = Math.max(this.dimL, this.dimW, this.dimH);
      const scale = 2.4 / maxDim; // 视口归一化
      return { l: this.dimL * scale, w: this.dimW * scale, h: this.dimH * scale, scale: 1.0 };
    }
  }

  render2DGrid() {
    const table = document.getElementById('unfold-net-table');
    if (!table) return;
    table.innerHTML = '';

    const isCuboid = (this.shapeType === 'cuboid');

    for (let r = 0; r < this.rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this.cols; c++) {
        const td = document.createElement('td');
        const cell = this.grid[r][c];

        const div = document.createElement('div');
        div.className = 'net-cell';
        div.dataset.row = r;
        div.dataset.col = c;

        if (cell) {
          div.classList.add('active-face');
          if (cell.isBase) div.classList.add('base-face');
          div.style.background = cell.colorHex;
          div.style.borderColor = '#ffffff';

          const def = this.faceDefinitions[cell.faceKey];
          let displayText = cell.label;
          if (def) {
            displayText = def.name;
          }

          div.innerHTML = `<span style="font-size:0.75rem;line-height:1.1;">${displayText}</span>`;
          div.title = `${displayText} (${cell.faceKey})`;
        } else {
          div.textContent = '';
          div.title = `空白位置 [${r+1}, ${c+1}]`;
          div.style.opacity = '0.25';
        }

        div.addEventListener('click', () => {
          this.handleCellClick(r, c);
        });

        td.appendChild(div);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }

    const countElem = document.getElementById('unfold-face-count');
    if (countElem) {
      countElem.textContent = `${this.getActiveFaces().length} 个方块`;
    }
  }

  handleCellClick(r, c) {
    if (this.grid[r][c]) {
      this.grid[r][c] = null;
    } else {
      const active = this.getActiveFaces();
      if (active.length >= 6) {
        alert('当前已达到 6 个面，点击已有方块可清除或调整。');
        return;
      }
      // 选取一个未被占用的面角色
      const usedKeys = new Set(active.map(a => a.cell.faceKey));
      const allKeys = Object.keys(this.faceDefinitions);
      const freeKey = allKeys.find(k => !usedKeys.has(k)) || 'bottom';
      const def = this.faceDefinitions[freeKey];

      this.grid[r][c] = {
        id: `f-${r}-${c}`,
        faceKey: freeKey,
        label: def.name,
        colorHex: def.color,
        isBase: active.length === 0
      };
    }
    this.refreshAndAnalyze();
  }

  getActiveFaces() {
    const list = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) list.push({ r, c, cell: this.grid[r][c] });
      }
    }
    return list;
  }

  refreshAndAnalyze() {
    this.render2DGrid();
    this.rebuild3DFoldingModel();
    this.updateStatusBanner();
    this.updateLegendUI();
  }

  updateLegendUI() {
    const legendBox = document.getElementById('faces-legend-container');
    if (!legendBox) return;
    const isCuboid = (this.shapeType === 'cuboid');
    const L = this.dimL, W = this.dimW, H = this.dimH;

    const sizeLabels = {
      bottom: `${L}×${W}`,
      top:    `${L}×${W}`,
      front:  `${L}×${H}`,
      back:   `${L}×${H}`,
      left:   `${W}×${H}`,
      right:  `${W}×${H}`
    };

    legendBox.innerHTML = Object.values(this.faceDefinitions).map(f => `
      <div class="face-legend-item">
        <span class="face-color-dot" style="background:${f.color};"></span>
        <span style="color:#ffffff;font-weight:600;">${f.name}</span>
        ${isCuboid ? `<span style="color:var(--text-dim);font-size:0.68rem;">(${sizeLabels[f.key]})</span>` : ''}
      </div>
    `).join('');
  }

  /**
   * 重建 3D 动力学折叠模型
   */
  rebuild3DFoldingModel() {
    while (this.rootFoldGroup.children.length > 0) {
      this.rootFoldGroup.remove(this.rootFoldGroup.children[0]);
    }

    const active = this.getActiveFaces();
    if (active.length === 0) return;

    const dims = this.getCurrentDimensions();
    const isCuboid = (this.shapeType === 'cuboid');

    let rootNode = active.find(item => item.cell.isBase) || active[0];

    const visited = new Set();
    const key = (r, c) => `${r},${c}`;
    visited.add(key(rootNode.r, rootNode.c));

    const rootGroup = new THREE.Group();
    rootGroup.position.set(0, 0, 0);

    const rootMesh = this.createFaceMesh(rootNode.cell.faceKey, dims);
    rootGroup.add(rootMesh);
    rootGroup.userData = { r: rootNode.r, c: rootNode.c, cell: rootNode.cell, mesh: rootMesh };
    this.rootFoldGroup.add(rootGroup);

    const queue = [{ group: rootGroup, r: rootNode.r, c: rootNode.c, faceKey: rootNode.cell.faceKey }];
    const dirs = [
      { dr: -1, dc: 0, edge: 'top' },
      { dr: 1, dc: 0, edge: 'bottom' },
      { dr: 0, dc: -1, edge: 'left' },
      { dr: 0, dc: 1, edge: 'right' }
    ];

    while (queue.length > 0) {
      const current = queue.shift();

      for (const d of dirs) {
        const nr = current.r + d.dr;
        const nc = current.c + d.dc;
        const k = key(nr, nc);

        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !visited.has(k)) {
          const neighbor = this.grid[nr][nc];
          if (neighbor) {
            visited.add(k);

            const joint = new THREE.Group();
            joint.userData = {
              edge: d.edge,
              dr: d.dr,
              dc: d.dc,
              cell: neighbor,
              r: nr,
              c: nc
            };

            // 获取当前父面与子面的尺寸
            const curSize = this.getFaceSize(current.faceKey, dims);
            const childSize = this.getFaceSize(neighbor.faceKey, dims);

            // 设置关节在父坐标系的位置 (棱所在位置)
            if (d.edge === 'top') joint.position.set(0, 0, -curSize.z / 2);
            else if (d.edge === 'bottom') joint.position.set(0, 0, curSize.z / 2);
            else if (d.edge === 'left') joint.position.set(-curSize.x / 2, 0, 0);
            else if (d.edge === 'right') joint.position.set(curSize.x / 2, 0, 0);

            const childMesh = this.createFaceMesh(neighbor.faceKey, dims);
            const meshHolder = new THREE.Group();

            // 子面中心相对于棱平移
            if (d.edge === 'top') meshHolder.position.set(0, 0, -childSize.z / 2);
            else if (d.edge === 'bottom') meshHolder.position.set(0, 0, childSize.z / 2);
            else if (d.edge === 'left') meshHolder.position.set(-childSize.x / 2, 0, 0);
            else if (d.edge === 'right') meshHolder.position.set(childSize.x / 2, 0, 0);

            meshHolder.add(childMesh);
            joint.add(meshHolder);
            current.group.add(joint);

            queue.push({ group: meshHolder, r: nr, c: nc, faceKey: neighbor.faceKey });
          }
        }
      }
    }

    this.applyFoldProgress(this.foldProgress);
  }

  getFaceSize(faceKey, dims) {
    const def = this.faceDefinitions[faceKey] || this.faceDefinitions.bottom;
    const sz = def.getDim(dims.l, dims.w, dims.h);
    return { x: sz.x, z: sz.z };
  }

  createFaceMesh(faceKey, dims) {
    const def = this.faceDefinitions[faceKey] || this.faceDefinitions.bottom;
    const sz = this.getFaceSize(faceKey, dims);
    const th = 0.04;

    const geo = new THREE.BoxGeometry(sz.x - 0.03, th, sz.z - 0.03);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = def.color;
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.name, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { faceKey, name: def.name, color: def.color };
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

    if (t >= 0.98) {
      this.evaluateCubeFormation();
    }
  }

  evaluateCubeFormation() {
    const active = this.getActiveFaces();
    const banner = document.getElementById('unfold-status-banner');
    if (!banner || active.length !== 6) return;

    const worldList = [];
    this.rootFoldGroup.traverse(obj => {
      if (obj.isMesh && obj.userData && obj.userData.name) {
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        worldList.push({ pos: wp, name: obj.userData.name });
      }
    });

    let overlaps = [];
    for (let i = 0; i < worldList.length; i++) {
      for (let j = i + 1; j < worldList.length; j++) {
        if (worldList[i].pos.distanceTo(worldList[j].pos) < 0.25) {
          overlaps.push([worldList[i].name, worldList[j].name]);
        }
      }
    }

    if (overlaps.length > 0) {
      banner.className = 'status-banner danger';
      banner.innerHTML = `❌ <strong>折叠失败</strong>：发生面重合！【${overlaps.map(p => p.join(' 与 ')).join('、')}】位置重叠，几何体未闭合。`;
    } else {
      banner.className = 'status-banner success';
      banner.innerHTML = `🎉 <strong>折叠成功！</strong> 6 个面完全闭合且无重合，完美构成立体${this.shapeType === 'cube' ? '正方体' : '长方体'}！`;
    }
  }

  updateStatusBanner() {
    const banner = document.getElementById('unfold-status-banner');
    if (!banner) return;
    const active = this.getActiveFaces();

    if (active.length === 6) {
      banner.className = 'status-banner info';
      banner.innerHTML = `💡 已放置 6 个不同面。点击【3D折叠 / 展开】按钮或拖动滑块观察能否闭合！`;
    } else {
      banner.className = 'status-banner warning';
      banner.innerHTML = `⚠️ 当前有 ${active.length} 个面。请调整至恰好 6 个面。`;
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
    const speed = 0.02;
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

  /**
   * 一键载入 11 种展开图之一
   */
  loadPatternById(patternId) {
    const pat = this.patterns11[patternId];
    if (!pat) return;

    this.initGrid();
    pat.cells.forEach(c => {
      const def = this.faceDefinitions[c.face];
      this.grid[c.r][c.c] = {
        id: `f-${c.r}-${c.c}`,
        faceKey: c.face,
        label: def.name,
        colorHex: def.color,
        isBase: !!c.isBase
      };
    });

    this.refreshAndAnalyze();
  }

  initUI() {
    // 正方体 / 长方体 切换单选
    const shapeBtns = document.querySelectorAll('.unfold-shape-type-btn');
    shapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.shapeType = btn.dataset.shape;

        const dimBox = document.getElementById('cuboid-dim-inputs-row');
        if (dimBox) {
          dimBox.style.display = (this.shapeType === 'cuboid') ? 'grid' : 'none';
        }

        this.refreshAndAnalyze();
      });
    });

    // 长宽高实时修改
    const inpL = document.getElementById('unfold-dim-l');
    const inpW = document.getElementById('unfold-dim-w');
    const inpH = document.getElementById('unfold-dim-h');

    const handleDimChange = () => {
      this.dimL = Math.max(0.5, parseFloat(inpL?.value || 4));
      this.dimW = Math.max(0.5, parseFloat(inpW?.value || 3));
      this.dimH = Math.max(0.5, parseFloat(inpH?.value || 2));
      this.refreshAndAnalyze();
    };

    [inpL, inpW, inpH].forEach(inp => {
      if (inp) inp.addEventListener('input', handleDimChange);
    });

    // 11 种展开图分类按钮点击事件绑定
    const patternBtns = document.querySelectorAll('.net-pattern-btn');
    patternBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        patternBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadPatternById(btn.dataset.id);
      });
    });

    // 滑块与播放
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

    const btnClear = document.getElementById('btn-clear-grid');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.initGrid();
        this.refreshAndAnalyze();
      });
    }

    const btnResetCam = document.getElementById('btn-unfold-reset-cam');
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        this.camera.position.set(0, 9.5, 9.0);
        if (this.controls) this.controls.target.set(0, 0, 0);
      });
    }

    this.updateLegendUI();
  }
}

window.UnfoldLab = UnfoldLab;
