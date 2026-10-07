/**
 * ===================================================================
 * 模块 4: 通用几何体拼装与表面积优化实验室 (Universal Packing & Surface Optimizer)
 * 通用算法：任意长宽高输入、支持 2盒/3盒/4盒 拼装组合、
 * 任意贴合方向 3D 动态拆解与吸附拼装、通用表面积与特殊纸箱规则计算、极值原理对比
 * ===================================================================
 */

class PackingLab {
  constructor() {
    this.container = document.getElementById('canvas-packing-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // 单盒尺寸
    this.dimL = 5.0;
    this.dimW = 3.0;
    this.dimH = 4.0;

    // 拼装数量: 2, 3, 4
    this.boxCount = 2;
    // 当前方向: 'along-L' (前后拼), 'along-W' (左右拼), 'along-H' (上下叠)
    this.alignDir = 'along-H';
    // 规则: 'standard' (普通表面积) 或 'double-top' (顶面双层上盖)
    this.boxRule = 'standard';

    this.separationRatio = 0.0;
    this.packingRoot = null;

    this.initThree();
    this.initUI();
    this.updatePacking();
  }

  initThree() {
    if (!this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(14, 15, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.target.set(0, 3, 0);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(12, 22, 16);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const grid = new THREE.GridHelper(26, 26, 0x334155, 0x1e293b);
    grid.position.y = 0;
    this.scene.add(grid);

    this.packingRoot = new THREE.Group();
    this.scene.add(this.packingRoot);

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

  createBoxMesh(L, W, H, colorHex) {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(L, H, W);
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.6,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = H / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const edges = new THREE.EdgesGeometry(geo);
    const wireframe = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 2 })
    );
    wireframe.position.y = H / 2;
    group.add(wireframe);

    return group;
  }

  updatePacking() {
    while (this.packingRoot.children.length > 0) {
      this.packingRoot.remove(this.packingRoot.children[0]);
    }

    const L = this.dimL;
    const W = this.dimW;
    const H = this.dimH;
    const N = this.boxCount;
    const sep = this.separationRatio * 3.5;

    const colors = [0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6];

    let newL = L, newW = W, newH = H;

    for (let i = 0; i < N; i++) {
      const box = this.createBoxMesh(L, W, H, colors[i % colors.length]);
      const centerIndex = i - (N - 1) / 2;

      if (this.alignDir === 'along-L') {
        // 沿长方向并排：新长为 N*L
        box.position.set(centerIndex * (L + sep), 0, 0);
        newL = N * L; newW = W; newH = H;
      } else if (this.alignDir === 'along-W') {
        // 沿宽方向并排：新宽为 N*W
        box.position.set(0, 0, centerIndex * (W + sep));
        newL = L; newW = N * W; newH = H;
      } else if (this.alignDir === 'along-H') {
        // 沿高方向堆叠：新高为 N*H
        box.position.set(0, i * (H + sep), 0);
        newL = L; newW = W; newH = N * H;
      }

      this.packingRoot.add(box);
    }

    if (this.controls) {
      this.controls.target.set(0, newH / 2, 0);
    }

    this.calculateComparativeMetrics(L, W, H, N);
  }

  calculateComparativeMetrics(L, W, H, N) {
    // 方案 1: 沿长拼 (N*L x W x H)
    const m1_L = N * L, m1_W = W, m1_H = H;
    const m1_std = 2 * (m1_L * m1_W + m1_L * m1_H + m1_W * m1_H);
    const m1_top = (this.boxRule === 'double-top') ? (m1_std + m1_L * m1_W) : m1_std;
    const m1_overlapArea = (N - 1) * (W * H);

    // 方案 2: 沿宽拼 (L x N*W x H)
    const m2_L = L, m2_W = N * W, m2_H = H;
    const m2_std = 2 * (m2_L * m2_W + m2_L * m2_H + m2_W * m2_H);
    const m2_top = (this.boxRule === 'double-top') ? (m2_std + m2_L * m2_W) : m2_std;
    const m2_overlapArea = (N - 1) * (L * H);

    // 方案 3: 沿高拼 (L x W x N*H)
    const m3_L = L, m3_W = W, m3_H = N * H;
    const m3_std = 2 * (m3_L * m3_W + m3_L * m3_H + m3_W * m3_H);
    const m3_top = (this.boxRule === 'double-top') ? (m3_std + m3_L * m3_W) : m3_std;
    const m3_overlapArea = (N - 1) * (L * W);

    const minArea = Math.min(m1_top, m2_top, m3_top);

    const tableBody = document.getElementById('packing-table-body');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr class="${m1_top === minArea ? 'highlight-best' : ''}">
          <td><strong>沿长并排</strong></td>
          <td>${m1_L.toFixed(1)} × ${m1_W.toFixed(1)} × ${m1_H.toFixed(1)}</td>
          <td>${m1_overlapArea.toFixed(1)}</td>
          <td>${m1_std.toFixed(1)}</td>
          <td>${this.boxRule === 'double-top' ? (m1_L * m1_W).toFixed(1) : 0}</td>
          <td><strong>${m1_top.toFixed(1)}</strong></td>
        </tr>
        <tr class="${m2_top === minArea ? 'highlight-best' : ''}">
          <td><strong>沿宽并排</strong></td>
          <td>${m2_L.toFixed(1)} × ${m2_W.toFixed(1)} × ${m2_H.toFixed(1)}</td>
          <td>${m2_overlapArea.toFixed(1)}</td>
          <td>${m2_std.toFixed(1)}</td>
          <td>${this.boxRule === 'double-top' ? (m2_L * m2_W).toFixed(1) : 0}</td>
          <td><strong>${m2_top.toFixed(1)}</strong></td>
        </tr>
        <tr class="${m3_top === minArea ? 'highlight-best' : ''}">
          <td><strong>沿高堆叠</strong></td>
          <td>${m3_L.toFixed(1)} × ${m3_W.toFixed(1)} × ${m3_H.toFixed(1)}</td>
          <td>${m3_overlapArea.toFixed(1)}</td>
          <td>${m3_std.toFixed(1)}</td>
          <td>${this.boxRule === 'double-top' ? (m3_L * m3_W).toFixed(1) : 0}</td>
          <td><strong>${m3_top.toFixed(1)}</strong></td>
        </tr>
      `;
    }

    const banner = document.getElementById('packing-conclusion-banner');
    if (banner) {
      banner.className = 'status-banner success';
      banner.innerHTML = `
        💡 <strong>空间几何极值定理分析</strong>：<br>
        • 单盒标准表面积：<strong>${(2*(L*W + L*H + W*H)).toFixed(1)}</strong><br>
        • 三个拼接面面积大小：${(W*H).toFixed(1)} (宽×高), ${(L*H).toFixed(1)} (长×高), ${(L*W).toFixed(1)} (长×宽)<br>
        • 在普通表面积规则下：<strong>重叠面积最大的面相贴合时，外表面积必定最小！</strong>
      `;
    }
  }

  initUI() {
    const inpL = document.getElementById('pack-dim-l');
    const inpW = document.getElementById('pack-dim-w');
    const inpH = document.getElementById('pack-dim-h');

    const handleDimChange = () => {
      this.dimL = Math.max(0.5, parseFloat(inpL?.value || 5));
      this.dimW = Math.max(0.5, parseFloat(inpW?.value || 3));
      this.dimH = Math.max(0.5, parseFloat(inpH?.value || 4));
      this.updatePacking();
    };

    [inpL, inpW, inpH].forEach(inp => {
      if (inp) inp.addEventListener('input', handleDimChange);
    });

    const countBtns = document.querySelectorAll('.pack-count-btn');
    countBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        countBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.boxCount = parseInt(btn.dataset.count);
        this.updatePacking();
      });
    });

    const dirBtns = document.querySelectorAll('.pack-dir-btn');
    dirBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dirBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.alignDir = btn.dataset.dir;
        this.updatePacking();
      });
    });

    const ruleBtns = document.querySelectorAll('.box-rule-btn');
    ruleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        ruleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.boxRule = btn.dataset.rule;
        this.updatePacking();
      });
    });

    const sepSlider = document.getElementById('pack-sep-slider');
    const sepVal = document.getElementById('pack-sep-val');
    if (sepSlider) {
      sepSlider.addEventListener('input', (e) => {
        this.separationRatio = parseFloat(e.target.value) / 100;
        if (sepVal) sepVal.textContent = `${e.target.value}%`;
        this.updatePacking();
      });
    }
  }
}

window.PackingLab = PackingLab;
