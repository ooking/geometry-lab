/**
 * ===================================================================
 * 模块 2: 通用小立方块堆叠与三视图生成器 (Universal Voxel & Projections Studio)
 * 通用算法：支持 3x3 / 4x4 空间自由搭建、动态正射投影三视图、
 * 通用逆推算法（给定主视图与左视图，求解小立方块最多与最少数量及形态切换）
 * ===================================================================
 */

class ViewsLab {
  constructor() {
    this.container = document.getElementById('canvas-views-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.cubeGroup = null;

    // 当前网格大小: 3 或 4
    this.gridSize = 3;
    // 存储高度矩阵 (行 r: 后到前, 列 c: 左到右)
    this.heights = [];
    this.initHeights(3);

    this.initThree();
    this.initUI();
    this.loadDemoPattern('stepped');
  }

  initHeights(size) {
    this.gridSize = size;
    this.heights = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        row.push(0);
      }
      this.heights.push(row);
    }
  }

  initThree() {
    if (!this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(6.5, 7.5, 7.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.target.set(0, 0.5, 0);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(6, 12, 8);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    this.gridHelper = new THREE.GridHelper(this.gridSize, this.gridSize, 0x0284c7, 0x1e293b);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);

    this.createDirectionLabels();

    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    const animate = () => {
      requestAnimationFrame(animate);
      if (this.controls) this.controls.update();
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

  createDirectionLabels() {
    const createSign = (text, pos, color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
      sprite.position.copy(pos);
      sprite.scale.set(1.6, 0.8, 1);
      this.scene.add(sprite);
    };

    createSign('正面 (主视)', new THREE.Vector3(0, 0.2, 2.4), '#38bdf8');
    createSign('左面 (左视)', new THREE.Vector3(-2.4, 0.2, 0), '#34d399');
  }

  rebuild3DCubes() {
    while (this.cubeGroup.children.length > 0) {
      this.cubeGroup.remove(this.cubeGroup.children[0]);
    }

    const cubeGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    const edgesGeo = new THREE.EdgesGeometry(cubeGeo);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.35,
      metalness: 0.1
    });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x1e3a8a, linewidth: 2 });

    const offset = (this.gridSize - 1) / 2;

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const count = this.heights[r][c];
        const x = c - offset;
        const z = r - offset;

        for (let h = 0; h < count; h++) {
          const y = h + 0.5;
          const cube = new THREE.Mesh(cubeGeo, baseMat.clone());
          cube.position.set(x, y, z);
          cube.castShadow = true;
          cube.receiveShadow = true;

          const wireframe = new THREE.LineSegments(edgesGeo, lineMat);
          cube.add(wireframe);
          this.cubeGroup.add(cube);
        }
      }
    }
  }

  renderTopViewMatrix() {
    const table = document.getElementById('topview-matrix-table');
    if (!table) return;
    table.innerHTML = '';

    for (let r = 0; r < this.gridSize; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < this.gridSize; c++) {
        const td = document.createElement('td');
        const count = this.heights[r][c];

        const div = document.createElement('div');
        div.className = 'topview-matrix-cell';
        if (count > 0) div.classList.add('has-blocks');

        const spanCoord = document.createElement('span');
        spanCoord.className = 'cell-letter';
        spanCoord.textContent = `${r+1},${c+1}`;
        div.appendChild(spanCoord);

        const spanNum = document.createElement('span');
        spanNum.className = 'cell-num';
        spanNum.textContent = count > 0 ? count : '·';
        div.appendChild(spanNum);

        div.title = `第 ${r+1} 排, 第 ${c+1} 列 (左键增高，右键降低)`;
        div.addEventListener('click', () => {
          this.heights[r][c] = (this.heights[r][c] + 1) % 6;
          this.syncUpdate();
        });
        div.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.heights[r][c] = Math.max(0, this.heights[r][c] - 1);
          this.syncUpdate();
        });

        td.appendChild(div);
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
  }

  syncUpdate() {
    this.rebuild3DCubes();
    this.renderTopViewMatrix();
    this.updateProjections();
    this.analyzeExtremes();
  }

  updateProjections() {
    // 1. 正面主视图 (视线看各列 c = 0..size-1)
    const frontHeights = [];
    for (let c = 0; c < this.gridSize; c++) {
      let maxH = 0;
      for (let r = 0; r < this.gridSize; r++) {
        maxH = Math.max(maxH, this.heights[r][c]);
      }
      frontHeights.push(maxH);
    }

    // 2. 左面左视图 (视线看各排 r = 0..size-1，后在左，前在右)
    const leftHeights = [];
    for (let r = 0; r < this.gridSize; r++) {
      let maxH = 0;
      for (let c = 0; c < this.gridSize; c++) {
        maxH = Math.max(maxH, this.heights[r][c]);
      }
      leftHeights.push(maxH);
    }

    this.renderProjectionSVG('svg-front-view', frontHeights, '#38bdf8');
    this.renderProjectionSVG('svg-left-view', leftHeights, '#34d399');
    this.renderTopViewSVG('svg-top-view');
  }

  renderProjectionSVG(svgId, heightsArr, fillColor) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    svg.innerHTML = '';

    const cols = this.gridSize;
    const maxRow = 4;
    const cellSize = 30;
    const gap = 3;
    const width = cols * (cellSize + gap) + gap;
    const height = maxRow * (cellSize + gap) + gap;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    for (let c = 0; c < cols; c++) {
      const colHeight = Math.min(maxRow, heightsArr[c]);
      for (let r = 0; r < maxRow; r++) {
        const rowFromBottom = r;
        const yIndex = maxRow - 1 - rowFromBottom;
        const x = gap + c * (cellSize + gap);
        const y = gap + yIndex * (cellSize + gap);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', cellSize);
        rect.setAttribute('height', cellSize);
        rect.setAttribute('rx', 4);

        if (rowFromBottom < colHeight) {
          rect.setAttribute('fill', fillColor);
          rect.setAttribute('stroke', '#ffffff');
          rect.setAttribute('stroke-width', '1.5');
        } else {
          rect.setAttribute('fill', 'rgba(255,255,255,0.04)');
          rect.setAttribute('stroke', 'rgba(255,255,255,0.12)');
          rect.setAttribute('stroke-dasharray', '3,3');
        }
        svg.appendChild(rect);
      }
    }
  }

  renderTopViewSVG(svgId) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    svg.innerHTML = '';

    const cols = this.gridSize;
    const rows = this.gridSize;
    const cellSize = 30;
    const gap = 3;
    const width = cols * (cellSize + gap) + gap;
    const height = rows * (cellSize + gap) + gap;

    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gap + c * (cellSize + gap);
        const y = gap + r * (cellSize + gap);
        const count = this.heights[r][c];

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', cellSize);
        rect.setAttribute('height', cellSize);
        rect.setAttribute('rx', 4);

        if (count > 0) {
          rect.setAttribute('fill', '#6366f1');
          rect.setAttribute('stroke', '#ffffff');
          rect.setAttribute('stroke-width', '1.5');
          svg.appendChild(rect);

          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', x + cellSize / 2);
          text.setAttribute('y', y + cellSize / 2 + 5);
          text.setAttribute('fill', '#ffffff');
          text.setAttribute('font-size', '13');
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('text-anchor', 'middle');
          text.textContent = count;
          svg.appendChild(text);
        } else {
          rect.setAttribute('fill', 'rgba(255,255,255,0.03)');
          rect.setAttribute('stroke', 'rgba(255,255,255,0.1)');
          rect.setAttribute('stroke-dasharray', '3,3');
          svg.appendChild(rect);
        }
      }
    }
  }

  /**
   * 通用三视图极值逆推引擎：
   * 基于当前的主视图列高 F[c] 与左视图列高 L[r]，求解方块总数范围 [N_min, N_max]
   */
  analyzeExtremes() {
    const F = [];
    for (let c = 0; c < this.gridSize; c++) {
      let m = 0;
      for (let r = 0; r < this.gridSize; r++) m = Math.max(m, this.heights[r][c]);
      F.push(m);
    }

    const L = [];
    for (let r = 0; r < this.gridSize; r++) {
      let m = 0;
      for (let c = 0; c < this.gridSize; c++) m = Math.max(m, this.heights[r][c]);
      L.push(m);
    }

    let currentTotal = 0;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) currentTotal += this.heights[r][c];
    }

    // 理论最多方块数：所有位置取两个视图允许的最大上限 min(F[c], L[r])
    let maxPossible = 0;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        maxPossible += Math.min(F[c], L[r]);
      }
    }

    // 理论最少方块数：利用贪心贪婪配对
    // max(sum(F), sum(L)) 或 经典二分图覆盖
    const sumF = F.reduce((a, b) => a + b, 0);
    const sumL = L.reduce((a, b) => a + b, 0);
    const minPossible = Math.max(sumF, sumL);

    const banner = document.getElementById('views-q16-banner');
    if (banner) {
      banner.className = 'status-banner success';
      banner.innerHTML = `
        <div style="line-height:1.6;">
          <div>📊 <strong>当前几何体方块总数</strong>：<span style="font-size:1.15rem;font-weight:bold;color:var(--accent-cyan);">${currentTotal}</span> 个</div>
          <div>• 主视图各列高度：<strong>[${F.join(', ')}]</strong> | 左视图各列高度：<strong>[${L.join(', ')}]</strong></div>
          <div>• <strong>最少方块数理论极限</strong>：约 <strong>${minPossible}</strong> 个（尽量共用立柱）</div>
          <div>• <strong>最多方块数理论极限</strong>：最多 <strong>${maxPossible}</strong> 个（填满所有交叉上限）</div>
        </div>
      `;
    }
  }

  loadDemoPattern(type) {
    if (type === 'stepped') {
      // 经典阶梯型
      this.initHeights(3);
      this.heights = [
        [2, 1, 0],
        [0, 1, 3],
        [0, 0, 1]
      ];
    } else if (type === 'corner') {
      this.initHeights(3);
      this.heights = [
        [3, 2, 1],
        [2, 1, 0],
        [1, 0, 0]
      ];
    } else if (type === 'u-shape') {
      this.initHeights(3);
      this.heights = [
        [2, 0, 2],
        [1, 0, 1],
        [2, 1, 2]
      ];
    }
    this.syncUpdate();
  }

  initUI() {
    const btnClear = document.getElementById('btn-clear-views');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.initHeights(this.gridSize);
        this.syncUpdate();
      });
    }

    const demoBtns = document.querySelectorAll('.views-demo-btn');
    demoBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        demoBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadDemoPattern(btn.dataset.pattern);
      });
    });

    // 网格大小切换
    const sizeBtns = document.querySelectorAll('.grid-size-btn');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = parseInt(btn.dataset.size);
        this.initHeights(s);
        this.syncUpdate();
      });
    });
  }
}

window.ViewsLab = ViewsLab;
