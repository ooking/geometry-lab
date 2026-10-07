/**
 * ===================================================================
 * 模块 3: 通用多面体截面与切片实验室 (Universal 3D Cross-Section Lab)
 * 通用算法：支持正方体、长方体、三棱柱、正四面体等多面体切换、
 * 动态注水切面与任意空间平面剖切、凸多边形求交拓扑算法、截面边数定理分析
 * ===================================================================
 */

class SectionLab {
  constructor() {
    this.container = document.getElementById('canvas-section-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.solidType = 'cube'; // 'cube', 'cuboid', 'prism3', 'tetra'
    this.cubePivot = null;
    this.solidMesh = null;
    this.sectionMesh = null;
    this.sectionLine = null;

    this.waterLevelRatio = 0.5;

    // 通用多面体顶点与边表
    this.vertices = [];
    this.edges = [];
    this.faceCount = 6;

    this.initThree();
    this.initUI();
    this.setSolidType('cube');
  }

  initThree() {
    if (!this.container) return;
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(4.8, 4.2, 5.2);

    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    if (window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(6, 12, 8);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.45);
    dirLight2.position.set(-6, -6, -6);
    this.scene.add(dirLight2);

    const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    grid.position.y = -2.2;
    this.scene.add(grid);

    this.cubePivot = new THREE.Group();
    this.scene.add(this.cubePivot);

    const secMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    this.sectionMesh = new THREE.Mesh(new THREE.BufferGeometry(), secMat);
    this.scene.add(this.sectionMesh);

    const secLineMat = new THREE.LineBasicMaterial({ color: 0xfef08a, linewidth: 3 });
    this.sectionLine = new THREE.Line(new THREE.BufferGeometry(), secLineMat);
    this.scene.add(this.sectionLine);

    LabUtils.startViewport(this);
  }

  setSolidType(type) {
    this.solidType = type;
    LabUtils.disposeGroup(this.cubePivot);

    let geom = null;

    if (type === 'cube') {
      this.faceCount = 6;
      geom = new THREE.BoxGeometry(2, 2, 2);
      this.vertices = [
        new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, -1, -1),
        new THREE.Vector3(1, 1, -1),   new THREE.Vector3(-1, 1, -1),
        new THREE.Vector3(-1, -1, 1),  new THREE.Vector3(1, -1, 1),
        new THREE.Vector3(1, 1, 1),    new THREE.Vector3(-1, 1, 1)
      ];
      this.edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
    } else if (type === 'cuboid') {
      this.faceCount = 6;
      geom = new THREE.BoxGeometry(2.6, 1.4, 1.8);
      this.vertices = [
        new THREE.Vector3(-1.3, -0.7, -0.9), new THREE.Vector3(1.3, -0.7, -0.9),
        new THREE.Vector3(1.3, 0.7, -0.9),   new THREE.Vector3(-1.3, 0.7, -0.9),
        new THREE.Vector3(-1.3, -0.7, 0.9),  new THREE.Vector3(1.3, -0.7, 0.9),
        new THREE.Vector3(1.3, 0.7, 0.9),    new THREE.Vector3(-1.3, 0.7, 0.9)
      ];
      this.edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
    } else if (type === 'tetra') {
      this.faceCount = 4;
      geom = new THREE.TetrahedronGeometry(1.6);
      this.vertices = [
        new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(1.6),
        new THREE.Vector3(-1, -1, 1).normalize().multiplyScalar(1.6),
        new THREE.Vector3(-1, 1, -1).normalize().multiplyScalar(1.6),
        new THREE.Vector3(1, -1, -1).normalize().multiplyScalar(1.6)
      ];
      this.edges = [
        [0, 1], [0, 2], [0, 3],
        [1, 2], [2, 3], [3, 1]
      ];
    }

    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.75,
      opacity: 0.35,
      transparent: true,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false
    });
    this.solidMesh = new THREE.Mesh(geom, mat);
    this.cubePivot.add(this.solidMesh);

    const edgesGeo = new THREE.EdgesGeometry(geom);
    const edgeLines = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x93c5fd, linewidth: 2 })
    );
    this.cubePivot.add(edgeLines);

    this.setPresetOrientation('corner');
  }

  updateSection() {
    if (!this.cubePivot || this.vertices.length === 0) return;

    this.cubePivot.updateMatrixWorld(true);
    const worldVerts = this.vertices.map(v => {
      const wv = v.clone();
      wv.applyMatrix4(this.cubePivot.matrixWorld);
      return wv;
    });

    let minY = Infinity, maxY = -Infinity;
    worldVerts.forEach(v => {
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    });

    const waterY = minY + this.waterLevelRatio * (maxY - minY);

    const intersections = [];
    const eps = 1e-5;

    const addPoint = point => {
      if (!intersections.some(existing => existing.distanceTo(point) < 1e-4)) intersections.push(point.clone());
    };
    this.edges.forEach(([i1, i2]) => {
      const p1 = worldVerts[i1];
      const p2 = worldVerts[i2];
      const dy1 = p1.y - waterY;
      const dy2 = p2.y - waterY;

      if (Math.abs(dy1) <= eps) addPoint(p1);
      if (Math.abs(dy2) <= eps) addPoint(p2);
      if ((dy1 > eps && dy2 < -eps) || (dy1 < -eps && dy2 > eps)) {
        const t = (waterY - p1.y) / (p2.y - p1.y);
        if (t >= 0 && t <= 1) {
          const pt = new THREE.Vector3().lerpVectors(p1, p2, t);
          addPoint(pt);
        }
      }
    });

    this.renderSectionPolygon(intersections, waterY);
    this.updateAnalysisPanel(intersections.length, intersections);
  }

  renderSectionPolygon(points, waterY) {
    if (points.length < 3) {
      this.sectionMesh.geometry.dispose();
      this.sectionMesh.geometry = new THREE.BufferGeometry();
      this.sectionLine.geometry.dispose();
      this.sectionLine.geometry = new THREE.BufferGeometry();
      return;
    }

    const center = new THREE.Vector3();
    points.forEach(p => center.add(p));
    center.divideScalar(points.length);

    points.sort((a, b) => {
      const angleA = Math.atan2(a.z - center.z, a.x - center.x);
      const angleB = Math.atan2(b.z - center.z, b.x - center.x);
      return angleA - angleB;
    });

    const vertices = [];
    for (let i = 1; i < points.length - 1; i++) {
      vertices.push(points[0].x, points[0].y, points[0].z);
      vertices.push(points[i].x, points[i].y, points[i].z);
      vertices.push(points[i + 1].x, points[i + 1].y, points[i + 1].z);
    }

    const secGeo = new THREE.BufferGeometry();
    secGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    secGeo.computeVertexNormals();

    this.sectionMesh.geometry.dispose();
    this.sectionMesh.geometry = secGeo;

    const linePoints = [...points, points[0]];
    const linePos = [];
    linePoints.forEach(p => linePos.push(p.x, p.y + 0.005, p.z));

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));

    this.sectionLine.geometry.dispose();
    this.sectionLine.geometry = lineGeo;
  }

  updateAnalysisPanel(k, points) {
    const badge = document.getElementById('section-shape-badge');
    const metricEdges = document.getElementById('sec-metric-edges');
    const metricMax = document.getElementById('sec-metric-max');
    const explanation = document.getElementById('section-shape-desc');

    if (metricEdges) metricEdges.textContent = k;
    if (metricMax) metricMax.textContent = `${this.faceCount} (最多)`;

    let shapeName = '无相交';
    let badgeClass = 'tri';
    let detailText = '切面未形成有面积的多边形。';

    if (k === 3) {
      shapeName = '三角形';
      badgeClass = 'tri';
      detailText = '切面与立体几何体的 3 个面相交，截面为三角形。';
    } else if (k === 4) {
      shapeName = '四边形';
      badgeClass = 'quad';
      detailText = '切面与 4 个面相交（如正方形、矩形、梯形等）。';
    } else if (k === 5) {
      shapeName = '五边形';
      badgeClass = 'penta';
      detailText = '切面穿过 5 个面，截面边数为 5。';
    } else if (k === 6) {
      shapeName = '六边形';
      badgeClass = 'hexa';
      detailText = '切面穿过全部 6 个面，截面边数达到几何体极限 6。';
    }

    if (badge) {
      badge.className = `section-shape-badge ${badgeClass}`;
      badge.textContent = k >= 3 ? `当前截面：${shapeName} (${k} 边)` : '当前截面：未形成多边形';
    }

    if (explanation) explanation.textContent = detailText;
  }

  setPresetOrientation(type) {
    if (!this.cubePivot) return;
    this.cubePivot.rotation.set(0, 0, 0);
    if (type === 'corner' || type === 'hexagon') {
      // Euler XYZ: these angles make the horizontal-plane normal parallel to a body diagonal.
      this.cubePivot.rotation.x = Math.atan(1 / Math.SQRT2);
      this.cubePivot.rotation.z = Math.PI / 4;
    } else if (type === 'edge') {
      this.cubePivot.rotation.set(Math.PI / 6, 0, Math.PI / 9);
    }
    this.waterLevelRatio = type === 'corner' ? 0.15 : type === 'edge' ? 0.35 : 0.5;
    this.syncOrientationUI(type);
    this.updateSection();
  }

  syncOrientationUI(preset = null) {
    ['x', 'y', 'z'].forEach(axis => {
      const slider = document.getElementById(`cube-rot-${axis}`);
      const angle = this.cubePivot.rotation[axis] * 180 / Math.PI;
      if (slider) slider.value = angle;
      const output = document.getElementById(`cube-rot-${axis}-val`);
      if (output) output.textContent = `${angle.toFixed(1)}°`;
    });
    const slider = document.getElementById('water-level-slider');
    if (slider) slider.value = this.waterLevelRatio * 100;
    const label = document.getElementById('water-level-val');
    if (label) label.textContent = `${Math.round(this.waterLevelRatio * 100)}%`;
    ['corner', 'face', 'edge', 'hexagon'].forEach(type => {
      document.getElementById(`btn-preset-${type}`)?.classList.toggle('active', type === preset);
    });
    const hex = document.getElementById('btn-preset-hexagon');
    if (hex) hex.textContent = this.solidType === 'cube' ? '🛑 中部对称（正六边形）' : '🛑 中部斜切（观察边数）';
  }

  initUI() {
    document.getElementById('btn-section-reset-cam')?.addEventListener('click', () => {
      this.camera.position.set(4.8, 4.2, 5.2);
      this.controls?.target.set(0, 0, 0);
    });
    const slider = document.getElementById('water-level-slider');
    const label = document.getElementById('water-level-val');
    if (slider) {
      slider.addEventListener('input', (e) => {
        this.waterLevelRatio = parseFloat(e.target.value) / 100;
        if (label) label.textContent = `${e.target.value}%`;
        this.syncOrientationUI();
        this.updateSection();
      });
    }

    const btnCorner = document.getElementById('btn-preset-corner');
    if (btnCorner) btnCorner.addEventListener('click', () => this.setPresetOrientation('corner'));

    const btnEdge = document.getElementById('btn-preset-edge');
    if (btnEdge) btnEdge.addEventListener('click', () => this.setPresetOrientation('edge'));

    const btnFace = document.getElementById('btn-preset-face');
    if (btnFace) btnFace.addEventListener('click', () => this.setPresetOrientation('face'));

    const btnHex = document.getElementById('btn-preset-hexagon');
    if (btnHex) btnHex.addEventListener('click', () => this.setPresetOrientation('hexagon'));

    const rotX = document.getElementById('cube-rot-x');
    const rotY = document.getElementById('cube-rot-y');
    const rotZ = document.getElementById('cube-rot-z');

    const handleRot = () => {
      const rx = (parseFloat(rotX?.value || 0) * Math.PI) / 180;
      const ry = (parseFloat(rotY?.value || 0) * Math.PI) / 180;
      const rz = (parseFloat(rotZ?.value || 0) * Math.PI) / 180;
      this.cubePivot.rotation.set(rx, ry, rz);
      this.syncOrientationUI();
      this.updateSection();
    };

    [rotX, rotY, rotZ].forEach(r => {
      if (r) r.addEventListener('input', handleRot);
    });

    const solidBtns = document.querySelectorAll('.solid-type-btn');
    solidBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        solidBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setSolidType(btn.dataset.solid);
      });
    });
  }
}

window.SectionLab = SectionLab;
