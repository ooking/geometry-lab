/**
 * ===================================================================
 * 模块 1: 通用多面体展开与折叠实验室 (Universal Net & Folding Studio)
 * 纯通用算法：支持 6x6 网格自由绘制、任意连通图 3D 骨骼分层折叠、
 * 智能重叠碰撞检测、闭合正方体判定、相对面对立面自动着色、
 * 长方体自定义尺寸展开与周长极值通用探究
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

    // 通用大网格 (6 行 x 6 列)
    this.rows = 6;
    this.cols = 6;
    this.grid = []; // 6x6 矩阵，存储 null 或 { id, label, isBase, colorIndex }
    this.foldProgress = 0.0;
    this.animating = false;
    this.animationDirection = 1;

    // 绘制模式: 'toggle' (点击切换), 'brush' (连续画笔), 'erase' (橡皮擦)
    this.drawTool = 'toggle';

    // 相对面配对颜色库 (3 对相对面采用高辨识度互补色)
    this.pairColors = [
      { fill: '#3b82f6', border: '#93c5fd', name: '相对面组 A (蓝)' },
      { fill: '#10b981', border: '#6ee7b7', name: '相对面组 B (绿)' },
      { fill: '#f59e0b', border: '#fcd34d', name: '相对面组 C (琥珀)' }
    ];

    this.initGrid();
    this.initThree();
    this.initUI();
    // 默认加载一个通用一四一型展开图
    this.loadPresetPattern('1-4-1');
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
    this.camera.position.set(0, 9, 8.5);

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

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(12, 24, 0x334155, 0x1e293b);
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

  render2DGrid() {
    const table = document.getElementById('unfold-net-table');
    if (!table) return;
    table.innerHTML = '';

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
          div.textContent = cell.label || '';
          div.title = `方块 [${r + 1}, ${c + 1}] (点击清除/修改)`;
          if (cell.colorHex) {
            div.style.background = cell.colorHex;
            div.style.borderColor = '#ffffff';
          }
        } else {
          div.textContent = '';
          div.title = `空白格 [${r + 1}, ${c + 1}] (点击放置)`;
          div.style.opacity = '0.25';
        }

        div.addEventListener('click', () => {
          this.handleCellAction(r, c);
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

  handleCellAction(r, c) {
    if (this.drawTool === 'erase') {
      this.grid[r][c] = null;
    } else {
      if (this.grid[r][c]) {
        this.grid[r][c] = null;
      } else {
        const activeCount = this.getActiveFaces().length;
        this.grid[r][c] = {
          id: `f-${r}-${c}`,
          label: `${activeCount + 1}`,
          isBase: activeCount === 0,
          colorHex: null
        };
      }
    }
    this.refreshAndAnalyze();
  }

  refreshAndAnalyze() {
    this.render2DGrid();
    this.rebuild3DFoldingModel();
    this.evaluateTopology();
  }

  getActiveFaces() {
    const list = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c]) {
          list.push({ r, c, cell: this.grid[r][c] });
        }
      }
    }
    return list;
  }

  /**
   * 通用生成树 BFS 架构：
   * 将任意 2D 连通网格组装成可折叠骨骼树
   */
  rebuild3DFoldingModel() {
    while (this.rootFoldGroup.children.length > 0) {
      this.rootFoldGroup.remove(this.rootFoldGroup.children[0]);
    }

    const active = this.getActiveFaces();
    if (active.length === 0) return;

    let rootNode = active.find(item => item.cell.isBase) || active[0];

    const visited = new Set();
    const key = (r, c) => `${r},${c}`;
    visited.add(key(rootNode.r, rootNode.c));

    const rootGroup = new THREE.Group();
    rootGroup.position.set(0, 0, 0);

    const rootMesh = this.createFaceMesh(rootNode.cell.label, rootNode.cell.colorHex || '#059669');
    rootGroup.add(rootMesh);
    rootGroup.userData = { r: rootNode.r, c: rootNode.c, cell: rootNode.cell, mesh: rootMesh };

    this.rootFoldGroup.add(rootGroup);

    const queue = [{ group: rootGroup, r: rootNode.r, c: rootNode.c }];
    const dirs = [
      { dr: -1, dc: 0, edge: 'top' },
      { dr: 1, dc: 0, edge: 'bottom' },
      { dr: 0, dc: -1, edge: 'left' },
      { dr: 0, dc: 1, edge: 'right' }
    ];

    const S = 1.0;

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

            if (d.edge === 'top') joint.position.set(0, 0, -S / 2);
            else if (d.edge === 'bottom') joint.position.set(0, 0, S / 2);
            else if (d.edge === 'left') joint.position.set(-S / 2, 0, 0);
            else if (d.edge === 'right') joint.position.set(S / 2, 0, 0);

            const childMesh = this.createFaceMesh(neighbor.label, neighbor.colorHex || '#2563eb');
            const meshHolder = new THREE.Group();

            if (d.edge === 'top') meshHolder.position.set(0, 0, -S / 2);
            else if (d.edge === 'bottom') meshHolder.position.set(0, 0, S / 2);
            else if (d.edge === 'left') meshHolder.position.set(-S / 2, 0, 0);
            else if (d.edge === 'right') meshHolder.position.set(S / 2, 0, 0);

            meshHolder.add(childMesh);
            joint.add(meshHolder);
            current.group.add(joint);

            queue.push({ group: meshHolder, r: nr, c: nc });
          }
        }
      }
    }

    this.applyFoldProgress(this.foldProgress);
  }

  createFaceMesh(label, colorHex) {
    const size = 0.98;
    const geometry = new THREE.BoxGeometry(size, 0.04, size);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = colorHex || '#2563eb';
    ctx.fillRect(0, 0, 128, 128);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 120);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || '', 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { label, colorHex };
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

  /**
   * 通用拓扑评估：
   * 1. 是否连通？
   * 2. 面数是否恰好为 6？
   * 3. 是否存在田字格、凹字形或一线连多？
   */
  evaluateTopology() {
    const active = this.getActiveFaces();
    const banner = document.getElementById('unfold-status-banner');
    if (!banner) return;

    if (active.length === 0) {
      banner.className = 'status-banner info';
      banner.innerHTML = `💡 画布空白：请在上方网格中点击绘制小正方形，自由探究展开图折叠。`;
      return;
    }

    // 连通分量检查
    const connectedCount = this.getConnectedComponentCount(active);
    if (connectedCount > 1) {
      banner.className = 'status-banner danger';
      banner.innerHTML = `❌ <strong>图形不连通</strong>：存在孤立分离的方块，必须保持各面相连成一体！`;
      return;
    }

    // 检测是否有 2x2 “田”字格
    const hasTian = this.checkTianSubgrid();
    if (hasTian) {
      banner.className = 'status-banner warning';
      banner.innerHTML = `⚠️ <strong>发现“田字格”结构</strong>：包含 2×2 田字形，折叠时必定发生面重叠！`;
      return;
    }

    if (active.length < 6) {
      banner.className = 'status-banner warning';
      banner.innerHTML = `📌 当前有 <strong>${active.length}</strong> 个面。折叠正方体需要恰好 <strong>6</strong> 个面（还差 ${6 - active.length} 个）。`;
    } else if (active.length > 6) {
      banner.className = 'status-banner warning';
      banner.innerHTML = `⚠️ 当前有 <strong>${active.length}</strong> 个面，多出了 ${active.length - 6} 个面。请点击多余方块进行剪裁。`;
    } else {
      banner.className = 'status-banner info';
      banner.innerHTML = `✨ 恰好 6 个连通面！点击下方【3D折叠 / 展开】按钮或拖动滑块验证是否能折成正方体。`;
    }
  }

  getConnectedComponentCount(active) {
    if (active.length === 0) return 0;
    const visited = new Set();
    const key = (r, c) => `${r},${c}`;

    const dfs = (r, c) => {
      visited.add(key(r, c));
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !visited.has(key(nr, nc))) {
          if (this.grid[nr][nc]) dfs(nr, nc);
        }
      }
    };

    let components = 0;
    for (const item of active) {
      if (!visited.has(key(item.r, item.c))) {
        components++;
        dfs(item.r, item.c);
      }
    }
    return components;
  }

  checkTianSubgrid() {
    for (let r = 0; r < this.rows - 1; r++) {
      for (let c = 0; c < this.cols - 1; c++) {
        if (this.grid[r][c] && this.grid[r+1][c] && this.grid[r][c+1] && this.grid[r+1][c+1]) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 3D 折叠完成时的空间几何精确判定：
   * 检验 6 个面的法向和中心坐标是否各占据 6 个方向 (±X, ±Y, ±Z)
   */
  evaluateCubeFormation() {
    const active = this.getActiveFaces();
    const banner = document.getElementById('unfold-status-banner');
    if (!banner || active.length !== 6) return;

    const worldPositions = [];
    this.rootFoldGroup.traverse((obj) => {
      if (obj.isMesh && obj.userData && obj.userData.label) {
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        worldPositions.push({ pos: wp, label: obj.userData.label, mesh: obj });
      }
    });

    let overlapPairs = [];
    for (let i = 0; i < worldPositions.length; i++) {
      for (let j = i + 1; j < worldPositions.length; j++) {
        const dist = worldPositions[i].pos.distanceTo(worldPositions[j].pos);
        if (dist < 0.25) {
          overlapPairs.push([worldPositions[i].label, worldPositions[j].label]);
        }
      }
    }

    if (overlapPairs.length > 0) {
      banner.className = 'status-banner danger';
      banner.innerHTML = `❌ <strong>面重合，折叠失败！</strong><br>方块 <strong>${overlapPairs.map(p => p.join(' 与 ')).join('、')}</strong> 重叠在同一位置，立方体存在缺口！`;
    } else {
      // 成功折成正方体！执行相对面自动识别
      this.identifyOppositeFaces(worldPositions);
      banner.className = 'status-banner success';
      banner.innerHTML = `🎉 <strong>完美闭合成立方体！</strong><br>6 个面无重合且完整包围。已自动识别并在展开图上为 <strong>3 组相对面</strong> 配色标注！`;
    }
  }

  /**
   * 通用对立面识别算法：
   * 闭合立方体中，相对面的中心点向量之和必然为 0（相对中心原点反向）
   */
  identifyOppositeFaces(worldList) {
    if (worldList.length !== 6) return;
    const center = new THREE.Vector3();
    worldList.forEach(item => center.add(item.pos));
    center.divideScalar(6);

    const matched = new Set();
    const pairs = [];

    for (let i = 0; i < worldList.length; i++) {
      if (matched.has(i)) continue;
      const v1 = worldList[i].pos.clone().sub(center);

      let bestOpposite = -1;
      let minDot = Infinity;

      for (let j = i + 1; j < worldList.length; j++) {
        if (matched.has(j)) continue;
        const v2 = worldList[j].pos.clone().sub(center);
        // 相对面向量夹角为 180 度，点乘为负数
        const dot = v1.dot(v2);
        if (dot < -0.8 && dot < minDot) {
          minDot = dot;
          bestOpposite = j;
        }
      }

      if (bestOpposite !== -1) {
        matched.add(i);
        matched.add(bestOpposite);
        pairs.push([worldList[i].label, worldList[bestOpposite].label]);
      }
    }

    // 对应着色
    const colorMap = {};
    pairs.forEach((p, idx) => {
      const col = this.pairColors[idx % this.pairColors.length].fill;
      colorMap[p[0]] = col;
      colorMap[p[1]] = col;
    });

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell && colorMap[cell.label]) {
          cell.colorHex = colorMap[cell.label];
        }
      }
    }

    this.render2DGrid();
    this.rebuild3DFoldingModel();
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
   * 通用展开图预设模版库
   */
  loadPresetPattern(type) {
    this.initGrid();
    if (type === '1-4-1') {
      // 经典一四一型
      this.grid[1][2] = { id: 'f0', label: '1', isBase: false, colorHex: null };
      this.grid[2][1] = { id: 'f1', label: '2', isBase: false, colorHex: null };
      this.grid[2][2] = { id: 'f2', label: '3', isBase: true, colorHex: null };
      this.grid[2][3] = { id: 'f3', label: '4', isBase: false, colorHex: null };
      this.grid[2][4] = { id: 'f4', label: '5', isBase: false, colorHex: null };
      this.grid[3][3] = { id: 'f5', label: '6', isBase: false, colorHex: null };
    } else if (type === '2-3-1') {
      // 二三一型
      this.grid[1][1] = { id: 'f0', label: '1', isBase: false, colorHex: null };
      this.grid[1][2] = { id: 'f1', label: '2', isBase: false, colorHex: null };
      this.grid[2][2] = { id: 'f2', label: '3', isBase: true, colorHex: null };
      this.grid[2][3] = { id: 'f3', label: '4', isBase: false, colorHex: null };
      this.grid[2][4] = { id: 'f4', label: '5', isBase: false, colorHex: null };
      this.grid[3][3] = { id: 'f5', label: '6', isBase: false, colorHex: null };
    } else if (type === '2-2-2') {
      // 二二二型 (阶梯状)
      this.grid[1][1] = { id: 'f0', label: '1', isBase: false, colorHex: null };
      this.grid[1][2] = { id: 'f1', label: '2', isBase: false, colorHex: null };
      this.grid[2][2] = { id: 'f2', label: '3', isBase: true, colorHex: null };
      this.grid[2][3] = { id: 'f3', label: '4', isBase: false, colorHex: null };
      this.grid[3][3] = { id: 'f4', label: '5', isBase: false, colorHex: null };
      this.grid[3][4] = { id: 'f5', label: '6', isBase: false, colorHex: null };
    } else if (type === '3-3') {
      // 三三型
      this.grid[1][1] = { id: 'f0', label: '1', isBase: false, colorHex: null };
      this.grid[1][2] = { id: 'f1', label: '2', isBase: false, colorHex: null };
      this.grid[1][3] = { id: 'f2', label: '3', isBase: false, colorHex: null };
      this.grid[2][2] = { id: 'f3', label: '4', isBase: true, colorHex: null };
      this.grid[2][3] = { id: 'f4', label: '5', isBase: false, colorHex: null };
      this.grid[2][4] = { id: 'f5', label: '6', isBase: false, colorHex: null };
    } else if (type === 'q13-demo') {
      // 7 格待剪裁模板 (中考经典原型)
      this.grid[1][2] = { id: 'f0', label: '①', isBase: false, colorHex: null };
      this.grid[2][1] = { id: 'f1', label: '②', isBase: false, colorHex: null };
      this.grid[2][2] = { id: 'f2', label: '③', isBase: true, colorHex: null };
      this.grid[2][3] = { id: 'f3', label: '④', isBase: false, colorHex: null };
      this.grid[2][4] = { id: 'f4', label: '⑤', isBase: false, colorHex: null };
      this.grid[3][1] = { id: 'f5', label: '⑥', isBase: false, colorHex: null };
      this.grid[3][2] = { id: 'f6', label: '⑦', isBase: false, colorHex: null };
    }

    this.refreshAndAnalyze();
  }

  initUI() {
    const slider = document.getElementById('unfold-progress-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.animating = false;
        this.applyFoldProgress(parseFloat(e.target.value) / 100);
      });
    }

    const btnPlay = document.getElementById('btn-unfold-toggle');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        this.toggleAnimation();
      });
    }

    const btnClear = document.getElementById('btn-clear-grid');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.initGrid();
        this.refreshAndAnalyze();
      });
    }

    const tplBtns = document.querySelectorAll('.tpl-btn');
    tplBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tplBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadPresetPattern(btn.dataset.preset);
      });
    });

    const btnResetCam = document.getElementById('btn-unfold-reset-cam');
    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        this.camera.position.set(0, 9, 8.5);
        if (this.controls) this.controls.target.set(0, 0, 0);
      });
    }

    this.initCuboidPerimeterLab();
  }

  /**
   * 通用长方体展开图外围周长极值计算器
   */
  initCuboidPerimeterLab() {
    const lInput = document.getElementById('cuboid-p-l');
    const wInput = document.getElementById('cuboid-p-w');
    const hInput = document.getElementById('cuboid-p-h');

    const updateCalc = () => {
      const l = Math.max(0.1, parseFloat(lInput?.value || 5));
      const w = Math.max(0.1, parseFloat(wInput?.value || 3));
      const h = Math.max(0.1, parseFloat(hInput?.value || 4));

      // 6个矩形面的总周长: 2*(2(l+w) + 2(l+h) + 2(w+h)) = 8*(l+w+h)
      const totalFacePerimeter = 8 * (l + w + h);

      // 展开成平面需要保留 5 条拼接棱
      // 棱长排序: e1 <= e2 <= e3
      const edges = [l, w, h].sort((a, b) => a - b);
      const eMin = edges[0];
      const eMid = edges[1];
      const eMax = edges[2];

      // 每种棱长最多只有 4 条！
      // 1. 周长最大情况: 5条内部拼接棱尽量短 -> 4条选 eMin, 1条选 eMid
      const minSeamSum = 4 * eMin + 1 * eMid;
      const maxPerimeter = totalFacePerimeter - 2 * minSeamSum;

      // 2. 周长最小情况: 5条内部拼接棱尽量长 -> 4条选 eMax, 1条选 eMid
      const maxSeamSum = 4 * eMax + 1 * eMid;
      const minPerimeter = totalFacePerimeter - 2 * maxSeamSum;

      const elemRes = document.getElementById('perimeter-calc-result');
      if (elemRes) {
        elemRes.innerHTML = `
          <div style="font-size:0.85rem;line-height:1.65;">
            <div>• 6个矩形表面周长总和：8 × (${l} + ${w} + ${h}) = <strong>${totalFacePerimeter.toFixed(1)}</strong></div>
            <div>• 三组棱长从小到大排序：<strong>${eMin}</strong> ≤ <strong>${eMid}</strong> ≤ <strong>${eMax}</strong>（每种长度各 4 条）</div>
            <div>• 展开图必须保留 <strong>5 条内部拼接棱</strong> 将 6 个面连为一体。</div>
            <div style="margin-top:0.35rem;padding:0.4rem;background:rgba(16,185,129,0.15);border-radius:6px;border:1px solid rgba(16,185,129,0.3);">
              🏆 <strong>最大外围周长</strong>：拼接棱选 4 条最短(${eMin}) + 1 条次短(${eMid})<br>
              公式：${totalFacePerimeter.toFixed(1)} - 2 × (4×${eMin} + 1×${eMid}) = <span style="color:#6ee7b7;font-weight:bold;font-size:1.05rem;">${maxPerimeter.toFixed(1)}</span>
            </div>
            <div style="margin-top:0.35rem;padding:0.4rem;background:rgba(56,189,248,0.1);border-radius:6px;">
              📉 <strong>最小外围周长</strong>：拼接棱选 4 条最长(${eMax}) + 1 条次短(${eMid})<br>
              公式：${totalFacePerimeter.toFixed(1)} - 2 × (4×${eMax} + 1×${eMid}) = <span style="color:#38bdf8;font-weight:bold;font-size:1.05rem;">${minPerimeter.toFixed(1)}</span>
            </div>
          </div>
        `;
      }
    };

    [lInput, wInput, hInput].forEach(inp => {
      if (inp) inp.addEventListener('input', updateCalc);
    });
    updateCalc();
  }
}

window.UnfoldLab = UnfoldLab;
