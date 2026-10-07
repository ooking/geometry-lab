/** 展开图教学：稳定的面编号、可选底面、分步折叠与预测核对。 */
class UnfoldLab {
  constructor() {
    this.container = document.getElementById('canvas-unfold-container');
    this.canvas2dBox = document.getElementById('unfold-canvas-2d-box');
    this.canvas2dStage = document.getElementById('unfold-canvas-stage');
    this.shapeType = 'cube';
    this.dimL = 4; this.dimW = 3; this.dimH = 2;
    this.panX = 0; this.panY = 0; this.zoom = 1;
    this.foldProgress = 0; this.animating = false; this.animationTarget = 1;
    this.foldMode = 'steps'; this.stepSeconds = 2;
    this.showAnswers = false; this.prediction = '';
    this.faceSpecs = {
      bottom: { color: '#10b981' }, top: { color: '#3b82f6' },
      front: { color: '#f97316' }, back: { color: '#8b5cf6' },
      left: { color: '#f43f5e' }, right: { color: '#f59e0b' }
    };
    this.patterns11 = LabUtils.cubeNets();
    this.planCache = new Map();
    this.initThree();
    this.renderPatternLibrary();
    this.initUI();
    this.loadPatternById('141-1');
  }

  initThree() {
    const w = this.container.clientWidth || 600, h = this.container.clientHeight || 480;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
    }
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(8, 14, 10);
    this.scene.add(light);
    this.grid = new THREE.GridHelper(20, 40, 0x334155, 0x1e293b);
    this.grid.position.y = -0.03;
    this.scene.add(this.grid);
    this.rootFoldGroup = new THREE.Group();
    this.rootFoldGroup.rotation.x = -Math.PI / 2;
    this.scene.add(this.rootFoldGroup);
    LabUtils.startViewport(this, delta => { if (this.animating) this.stepAnimation(delta); });
  }

  get pattern() { return this.patterns11[this.currentPatternId]; }
  getLabel(face) { return this.pattern.layout.find(item => item.face === face).label; }

  getEffectiveDims() {
    if (this.shapeType === 'cube') return { l: 2, w: 2, h: 2, displayL: 1, displayW: 1, displayH: 1 };
    const scale = 3.6 / Math.max(this.dimL, this.dimW, this.dimH);
    return { l: this.dimL * scale, w: this.dimW * scale, h: this.dimH * scale,
      displayL: this.dimL, displayW: this.dimW, displayH: this.dimH };
  }

  getFaceSize(face, display = false) {
    // Use the original face axes, so selecting another bottom never changes its dimensions.
    const item = this.pattern.layout.find(cell => cell.face === face), dims = this.getEffectiveDims();
    const lengths = display ? [dims.displayL, dims.displayW, dims.displayH] : [dims.l, dims.w, dims.h];
    const length = axis => axis.reduce((sum, value, index) => sum + Math.abs(value) * lengths[index], 0);
    return { w: length(item.u), h: length(item.v) };
  }

  getDimensionText(face) {
    const size = this.getFaceSize(face, true);
    return `${size.w} × ${size.h}`;
  }

  getRole(face) {
    const normal = this.rootedLayout.find(item => item.face === face).n.join(',');
    return { '0,0,1': '底面', '0,0,-1': '顶面', '0,-1,0': '后面', '0,1,0': '前面', '-1,0,0': '右面', '1,0,0': '左面' }[normal];
  }

  renderPatternLibrary() {
    const categories = [
      ['141', '中间连续四格', '一四一型：上下各接一格，中间四格用浅蓝色标出。'],
      ['231', '中间连续三格', '二三一型：中间三格，上下分别接两格和一格。'],
      ['222', '三排各两格', '二二二型：三排方格依次错开。'],
      ['33', '两排各三格', '三三型：两排错开两格，通过一条边连接。']
    ];
    const library = document.getElementById('unfold-pattern-library');
    library.innerHTML = '';
    categories.forEach(([category, title, description]) => {
      const patterns = Object.entries(this.patterns11).filter(([, pattern]) => pattern.category === category);
      const section = document.createElement('div'); section.className = 'category-group-card';
      const heading = document.createElement('div'); heading.className = 'category-title-row';
      heading.textContent = `${title} · ${patterns.length} 种`;
      const note = document.createElement('p'); note.className = 'learning-note'; note.textContent = description;
      const list = document.createElement('div'); list.className = 'category-btn-grid net-preview-grid';
      patterns.forEach(([id, pattern], index) => {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'net-pattern-btn'; button.dataset.id = id;
        button.setAttribute('aria-label', `${title}，第 ${index + 1} 种展开图`);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const cols = Math.max(...pattern.layout.map(item => item.x)) + 1;
        const rows = Math.max(...pattern.layout.map(item => item.y)) + 1;
        svg.setAttribute('viewBox', `-2 -2 ${cols * 20 + 4} ${rows * 20 + 4}`);
        svg.setAttribute('aria-hidden', 'true');
        pattern.layout.forEach(item => {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          const middle = ['141', '231'].includes(category) && item.y === 1;
          Object.entries({ x: item.x * 20, y: (rows - 1 - item.y) * 20, width: 20, height: 20,
            fill: middle ? '#7dd3fc' : '#cbd5e1', stroke: '#0f172a', 'stroke-width': 1 })
            .forEach(([key, value]) => rect.setAttribute(key, value));
          svg.appendChild(rect);
        });
        const caption = document.createElement('span'); caption.textContent = `图 ${id.replace('-', ' · ')}`;
        button.append(svg, caption);
        button.addEventListener('click', () => {
          this.loadPatternById(id);
          document.getElementById('unfold-library').open = false;
        });
        list.appendChild(button);
      });
      section.append(heading, note, list); library.appendChild(section);
    });
  }

  loadPatternById(id) {
    if (!this.patterns11[id]) return;
    this.currentPatternId = id;
    const degree = cell => this.pattern.layout.filter(other => Math.abs(cell.x - other.x) + Math.abs(cell.y - other.y) === 1).length;
    const centerX = this.pattern.layout.reduce((sum, item) => sum + item.x, 0) / 6;
    const centerY = this.pattern.layout.reduce((sum, item) => sum + item.y, 0) / 6;
    const candidates = [...this.pattern.layout].sort((a, b) => degree(b) - degree(a) ||
      Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
    this.recommendedBase = candidates[0].face;
    this.baseFace = this.recommendedBase;
    this.prediction = ''; this.showAnswers = false;
    this.resetModel(true);
    document.querySelectorAll('.net-pattern-btn').forEach(button => {
      const active = button.dataset.id === id;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
    });
  }

  setBase(face) {
    if (face === this.baseFace) return;
    this.baseFace = face; this.prediction = ''; this.showAnswers = false;
    this.resetModel(false);
  }

  resetModel(resetPan = false) {
    this.animating = false; this.foldProgress = 0; this.animationTarget = 1;
    this.rootedLayout = LabUtils.rootNet(this.pattern, this.baseFace);
    if (resetPan) { this.panX = 0; this.panY = 0; }
    this.render2DCanvas();
    this.rebuild3DFoldingModel();
    this.updateLesson();
    this.applyFoldProgress(0);
  }

  render2DCanvas() {
    const oldFocus = document.activeElement?.dataset.face;
    this.canvas2dStage.innerHTML = '';
    const positions = {}, scale = this.shapeType === 'cube' ? 38 : 32;
    this.rootedLayout.forEach(item => {
      const size = this.getFaceSize(item.face);
      const w = size.w * scale, h = size.h * scale;
      let x = -w / 2, y = -h / 2;
      if (item.parent) {
        const parent = positions[item.parent];
        x = parent.x + (parent.w - w) / 2; y = parent.y + (parent.h - h) / 2;
        if (item.edge === 'top') y = parent.y - h;
        if (item.edge === 'bottom') y = parent.y + parent.h;
        if (item.edge === 'left') x = parent.x - w;
        if (item.edge === 'right') x = parent.x + parent.w;
      }
      positions[item.face] = { x, y, w, h };
    });
    const values = Object.values(positions);
    const minX = Math.min(...values.map(p => p.x)), maxX = Math.max(...values.map(p => p.x + p.w));
    const minY = Math.min(...values.map(p => p.y)), maxY = Math.max(...values.map(p => p.y + p.h));
    this.netBounds = { width: maxX - minX, height: maxY - minY };
    Object.entries(positions).forEach(([face, p]) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'net-rect-face'; button.dataset.face = face;
      button.style.left = `${p.x - (minX + maxX) / 2}px`; button.style.top = `${p.y - (minY + maxY) / 2}px`;
      button.style.width = `${p.w}px`; button.style.height = `${p.h}px`;
      button.style.background = this.faceSpecs[face].color;
      button.textContent = this.getLabel(face);
      button.title = `${this.getLabel(face)} 面，${this.getDimensionText(face)}；点击设为底面`;
      button.addEventListener('click', event => {
        if (this.suppressFaceClick && event.detail > 0) { this.suppressFaceClick = false; return; }
        this.setBase(face);
      });
      this.canvas2dStage.appendChild(button);
    });
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.classList.add('net-fold-lines');
    overlay.setAttribute('viewBox', `0 0 ${maxX - minX} ${maxY - minY}`);
    overlay.style.left = `${-(maxX - minX) / 2}px`; overlay.style.top = `${-(maxY - minY) / 2}px`;
    overlay.style.width = `${maxX - minX}px`; overlay.style.height = `${maxY - minY}px`;
    this.rootedLayout.filter(item => item.parent).forEach(item => {
      const parent = positions[item.parent];
      let x1, y1, x2, y2;
      if (item.edge === 'top' || item.edge === 'bottom') {
        x1 = parent.x; x2 = parent.x + parent.w;
        y1 = y2 = parent.y + (item.edge === 'bottom' ? parent.h : 0);
      } else {
        y1 = parent.y; y2 = parent.y + parent.h;
        x1 = x2 = parent.x + (item.edge === 'right' ? parent.w : 0);
      }
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.dataset.hinge = item.face;
      Object.entries({ x1: x1 - minX, x2: x2 - minX, y1: y1 - minY, y2: y2 - minY })
        .forEach(([key, value]) => line.setAttribute(key, value));
      overlay.appendChild(line);
    });
    this.canvas2dStage.appendChild(overlay);
    this.reset2DView();
    if (oldFocus) this.canvas2dStage.querySelector(`[data-face="${oldFocus}"]`)?.focus({ preventScroll: true });
  }

  reset2DView() {
    this.panX = 0; this.panY = 0;
    if (this.netBounds) this.zoom = Math.max(0.1, Math.min(1,
      (this.canvas2dBox.clientWidth - 28) / this.netBounds.width,
      (this.canvas2dBox.clientHeight - 72) / this.netBounds.height));
    this.updateTransform2D();
  }
  updateTransform2D() {
    this.canvas2dStage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  rebuild3DFoldingModel() {
    LabUtils.disposeGroup(this.rootFoldGroup);
    this.faceMeshes = {}; this.foldHinges = [];
    const groups = {};
    this.rootedLayout.forEach(item => {
      const size = this.getFaceSize(item.face), group = new THREE.Group();
      groups[item.face] = group;
      if (!item.parent) this.rootFoldGroup.add(group);
      else {
        const parentSize = this.getFaceSize(item.parent), hinge = new THREE.Group();
        let axis, sign, length;
        if (item.edge === 'top' || item.edge === 'bottom') {
          sign = item.edge === 'top' ? 1 : -1; axis = 'x'; length = parentSize.w;
          hinge.position.y = sign * parentSize.h / 2; group.position.y = sign * size.h / 2;
        } else {
          sign = item.edge === 'right' ? 1 : -1; axis = 'y'; length = parentSize.h;
          hinge.position.x = sign * parentSize.w / 2; group.position.x = sign * size.w / 2;
          sign = -sign;
        }
        groups[item.parent].add(hinge); hinge.add(group);
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length, 6), new THREE.MeshBasicMaterial({ color: 0xe2e8f0 }));
        if (axis === 'x') line.rotation.z = Math.PI / 2;
        hinge.add(line);
        this.foldHinges.push({ hinge, axis, sign, line, item });
      }
      const mesh = this.createFaceMesh(item.face, size.w, size.h);
      group.add(mesh); this.faceMeshes[item.face] = mesh;
    });
    const dims = this.getEffectiveDims();
    const cacheKey = `${this.currentPatternId}:${this.baseFace}:${dims.l}:${dims.w}:${dims.h}`;
    let order = this.planCache.get(cacheKey);
    if (!order) {
      order = this.findFoldOrder();
      // Store an empty array for cases with no sampled clear sequence.
      if (this.planCache.size > 100) this.planCache.clear();
      this.planCache.set(cacheKey, order);
    }
    this.sequenceAvailable = order.length === 5;
    this.foldOrder = this.sequenceAvailable ? order : this.foldHinges.map((_, index) => index);
    this.applyRawAngles(Array(5).fill(0));
    // Frame both the unfolded sheet and the closed solid without moving the bottom face.
    const bounds = new THREE.Box3().setFromObject(this.rootFoldGroup);
    this.applyRawAngles(Array(5).fill(1));
    bounds.union(new THREE.Box3().setFromObject(this.rootFoldGroup));
    this.applyRawAngles(Array(5).fill(0));
    const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    const extent = Math.max(size.x / Math.max(this.camera.aspect, 0.1), size.y, size.z, 3);
    const distance = extent / (2 * Math.tan(this.camera.fov * Math.PI / 360)) * 1.5;
    this.defaultViewTarget = center;
    this.defaultViewPosition = center.clone().add(new THREE.Vector3(0.4, 0.8, 1).normalize().multiplyScalar(distance));
    this.resetCamera();
  }

  createFaceMesh(face, width, height) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: this.faceSpecs[face].color, side: THREE.DoubleSide }));
    mesh.userData = { face, width, height };
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xffffff }));
    mesh.add(border); mesh.userData.border = border;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
    const front = new THREE.Mesh(geometry, material); front.position.z = 0.003;
    const back = new THREE.Mesh(geometry, material); back.position.z = -0.003; back.rotation.y = Math.PI;
    mesh.add(front, back); mesh.userData.labelCanvas = canvas; mesh.userData.labelTexture = texture;
    this.drawFaceLabel(mesh);
    return mesh;
  }

  drawFaceLabel(mesh) {
    const face = mesh.userData.face, canvas = mesh.userData.labelCanvas, ctx = canvas.getContext('2d');
    ctx.fillStyle = this.faceSpecs[face].color; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 110px sans-serif'; ctx.fillText(this.getLabel(face), 256, 88);
    ctx.font = '36px sans-serif'; ctx.fillText(this.getDimensionText(face), 256, 171);
    ctx.font = 'bold 32px sans-serif';
    if (face === this.baseFace || this.showAnswers) ctx.fillText(this.getRole(face), 256, 220);
    mesh.userData.labelTexture.needsUpdate = true;
  }

  resetCamera(top = false) {
    if (!this.defaultViewTarget) return;
    const target = top ? new THREE.Vector3(0, 0, 0) : this.defaultViewTarget;
    this.camera.up.set(0, 1, 0);
    if (top) {
      this.camera.up.set(0, 0, -1);
      const distance = this.defaultViewPosition.distanceTo(this.defaultViewTarget);
      this.camera.position.set(0, distance, 0.001);
    } else this.camera.position.copy(this.defaultViewPosition);
    // Recreate controls when the up direction changes, avoiding stale orbit axes and inertia.
    this.controls?.dispose();
    if (THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.copy(target); this.controls.enableDamping = true; this.controls.update();
    } else this.camera.lookAt(target);
  }

  applyRawAngles(angles) {
    this.foldHinges.forEach(({ hinge, axis, sign }, index) => { hinge.rotation[axis] = sign * angles[index] * Math.PI / 2; });
    this.rootFoldGroup.updateMatrixWorld(true);
  }

  // A small state search selects one-edge-at-a-time motions whose sampled poses have no
  // interior face intersections. Shared edges and boundary contact are allowed.
  findFoldOrder() {
    const failed = new Set(), angles = Array(5).fill(0);
    const search = (mask, order) => {
      if (mask === 31) return order;
      if (failed.has(mask)) return null;
      const candidates = this.foldHinges.map((_, index) => index).filter(index => !(mask & (1 << index)))
        .sort((a, b) => this.foldHinges[b].item.depth - this.foldHinges[a].item.depth);
      for (const index of candidates) {
        let clear = true;
        for (let sample = 1; sample <= 12; sample++) {
          angles[index] = sample / 12; this.applyRawAngles(angles);
          if (this.hasFaceIntersections()) { clear = false; break; }
        }
        if (clear) {
          const result = search(mask | (1 << index), [...order, index]);
          if (result) return result;
        }
        angles[index] = 0;
      }
      failed.add(mask); return null;
    };
    this.applyRawAngles(angles);
    const result = this.hasFaceIntersections() ? null : search(0, []);
    this.applyRawAngles(Array(5).fill(0));
    return result || [];
  }

  hasFaceIntersections() {
    const eps = 1e-5;
    const polygons = Object.values(this.faceMeshes).map(mesh => {
      const { width: w, height: h } = mesh.userData;
      const points = [[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]]
        .map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld));
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[1])).normalize();
      return { points, normal };
    });
    for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) {
      const a = polygons[i], b = polygons[j];
      const da = a.points.map(point => b.normal.dot(point.clone().sub(b.points[0])));
      const db = b.points.map(point => a.normal.dot(point.clone().sub(a.points[0])));
      const direction = a.normal.clone().cross(b.normal);
      if (direction.lengthSq() < eps * eps) {
        if (Math.abs(da[0]) > eps) continue;
        const axes = [a.points[1].clone().sub(a.points[0]).normalize(), a.points[3].clone().sub(a.points[0]).normalize(),
          b.points[1].clone().sub(b.points[0]).normalize(), b.points[3].clone().sub(b.points[0]).normalize()];
        const overlap = axes.every(axis => {
          const pa = a.points.map(p => p.dot(axis)), pb = b.points.map(p => p.dot(axis));
          return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > eps;
        });
        if (overlap) return true;
        continue;
      }
      if (!(Math.min(...da) < -eps && Math.max(...da) > eps && Math.min(...db) < -eps && Math.max(...db) > eps)) continue;
      direction.normalize();
      const interval = (polygon, distances) => {
        const values = [];
        polygon.points.forEach((point, k) => {
          const next = (k + 1) % 4;
          if (Math.abs(distances[k]) <= eps) values.push(point.dot(direction));
          if (distances[k] * distances[next] < 0) {
            values.push(point.clone().lerp(polygon.points[next], distances[k] / (distances[k] - distances[next])).dot(direction));
          }
        });
        return [Math.min(...values), Math.max(...values)];
      };
      const ia = interval(a, da), ib = interval(b, db);
      if (Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]) > eps) return true;
    }
    return false;
  }

  getAngles(progress) {
    const angles = Array(5).fill(0);
    if (this.foldMode === 'together') return angles.fill(progress);
    this.foldOrder.forEach((hingeIndex, step) => { angles[hingeIndex] = Math.min(1, Math.max(0, progress * 5 - step)); });
    return angles;
  }

  getMovingFaces(index) {
    const face = this.foldHinges[index]?.item.face;
    if (!face) return new Set();
    const result = new Set([face]);
    this.rootedLayout.forEach(item => { if (result.has(item.parent)) result.add(item.face); });
    return result;
  }

  applyFoldProgress(progress) {
    this.foldProgress = Math.min(1, Math.max(0, progress));
    const angles = this.getAngles(this.foldProgress); this.applyRawAngles(angles);
    const reversing = this.animating && this.animationTarget < this.foldProgress;
    const step = Math.max(0, Math.min(4, reversing ? Math.ceil(this.foldProgress * 5 - 1e-7) - 1 : Math.floor(this.foldProgress * 5 + 1e-7)));
    const activeIndex = this.foldMode === 'steps' && this.sequenceAvailable ? this.foldOrder[step] : null;
    const moving = activeIndex === null ? new Set() : this.getMovingFaces(activeIndex);
    this.foldHinges.forEach(({ line }, index) => {
      line.material.color.setHex(index === activeIndex ? 0xfbbf24 : 0xcbd5e1);
    });
    Object.entries(this.faceMeshes).forEach(([face, mesh]) => {
      mesh.userData.border.material.color.setHex(face === this.baseFace ? 0xfbbf24 : moving.has(face) ? 0xfef08a : 0xffffff);
    });
    this.canvas2dStage.querySelectorAll('[data-face]').forEach(button => {
      const face = button.dataset.face, isBase = face === this.baseFace;
      button.classList.toggle('is-bottom', isBase);
      button.classList.toggle('is-moving', moving.has(face));
      button.setAttribute('aria-pressed', isBase);
      button.setAttribute('aria-label', `${this.getLabel(face)} 面${isBase ? '，当前底面' : '，点击设为底面'}`);
      button.textContent = `${this.getLabel(face)}${isBase ? ' · 底' : this.showAnswers && this.getRole(face) === '顶面' ? ' · 顶' : ''}`;
    });
    this.canvas2dStage.querySelectorAll('[data-hinge]').forEach(line => {
      line.classList.toggle('is-active', activeIndex !== null && line.dataset.hinge === this.foldHinges[activeIndex].item.face);
    });
    const slider = document.getElementById('unfold-progress-slider'); slider.value = Math.round(this.foldProgress * 1000);
    const completed = Math.min(5, Math.floor(this.foldProgress * 5 + 1e-7));
    document.getElementById('unfold-progress-val').textContent = this.foldMode === 'steps'
      ? `${completed} / 5 步 · ${(activeIndex === null ? 0 : angles[activeIndex] * 90).toFixed(0)}°`
      : `${Math.round(this.foldProgress * 100)}% · ${(this.foldProgress * 90).toFixed(0)}°`;
    const play = document.getElementById('btn-unfold-toggle');
    play.textContent = this.animating ? '⏸ 暂停' : this.foldProgress >= 1 || (this.foldProgress > 0 && this.animationTarget < this.foldProgress) ? '▶ 播放展开' : '▶ 播放折叠';
    play.disabled = this.foldMode === 'steps' && !this.sequenceAvailable;
    document.getElementById('btn-unfold-prev').disabled = this.foldMode !== 'steps' || !this.sequenceAvailable || this.foldProgress <= 0;
    document.getElementById('btn-unfold-next').disabled = this.foldMode !== 'steps' || !this.sequenceAvailable || this.foldProgress >= 1;
    slider.disabled = this.foldMode === 'steps' && !this.sequenceAvailable;
    const banner = document.getElementById('unfold-status-banner');
    banner.className = 'status-banner info';
    if (this.foldMode === 'steps' && !this.sequenceAvailable) {
      banner.className = 'status-banner warning';
      banner.textContent = '这组尺寸与底面的分步路径暂不可用。请换底面或尺寸；整体折叠仅供观察连接关系，中途可能相交。';
    } else if (this.foldProgress >= 1) {
      banner.className = 'status-banner success';
      banner.textContent = `折叠完成，${this.getLabel(this.baseFace)} 面始终固定。可以旋转观察，再核对你的预测。`;
    } else if (activeIndex !== null) {
      const item = this.foldHinges[activeIndex].item;
      const attached = [...moving].filter(face => face !== item.face).map(face => this.getLabel(face));
      banner.textContent = `第 ${step + 1} 步：沿 ${this.getLabel(item.parent)}、${this.getLabel(item.face)} 之间的黄色折痕转动 ${this.getLabel(item.face)} 面${attached.length ? `，带动 ${attached.join('、')} 面一起移动` : ''}。底面 ${this.getLabel(this.baseFace)} 保持不动。`;
    } else banner.textContent = '整体折叠：所有折痕同时转动，用于观察展开和闭合的整体关系。';
  }

  animateTo(target) {
    this.animationTarget = target; this.animating = Math.abs(target - this.foldProgress) > 1e-7;
    this.applyFoldProgress(this.foldProgress);
  }
  stepAnimation(delta) {
    const speed = delta / (this.foldMode === 'steps' ? this.stepSeconds * 5 : this.stepSeconds * 2);
    const direction = Math.sign(this.animationTarget - this.foldProgress);
    const next = this.foldProgress + direction * speed;
    if (direction * (this.animationTarget - next) <= 0) {
      this.animating = false; this.applyFoldProgress(this.animationTarget);
    } else this.applyFoldProgress(next);
  }
  toggleAnimation() {
    if (this.animating) { this.animating = false; this.applyFoldProgress(this.foldProgress); return; }
    this.animateTo(this.foldProgress >= 1 || (this.foldProgress > 0 && this.animationTarget < this.foldProgress) ? 0 : 1);
  }

  updateLesson() {
    const dims = this.getEffectiveDims();
    let perimeter = 8 * (dims.displayL + dims.displayW + dims.displayH);
    const scale = dims.displayL / dims.l;
    this.pattern.layout.filter(item => item.parent).forEach(item => {
      const size = this.getFaceSize(item.face);
      perimeter -= 2 * (['top', 'bottom'].includes(item.edge) ? size.w : size.h) * scale;
    });
    document.getElementById('perimeter-calc-result').textContent = `当前展开图周长：${Number(perimeter.toFixed(4))}。六个面的周长总和，减去 5 条折痕长度的两倍；换底面不改变周长。`;
    document.getElementById('unfold-current-pattern').textContent = `当前图 ${this.currentPatternId.replace('-', ' · ')}`;
    document.getElementById('unfold-library-title').textContent = this.shapeType === 'cube' ? '选一种展开图 · 共 11 种' : '选一种连接样式';
    document.getElementById('unfold-library-note').textContent = this.shapeType === 'cube'
      ? '旋转或翻转后能重合的展开图算同一种。先看缩略图，再选择一种进行折叠。'
      : '这里沿用正方体的 11 种连接样式，并按长方体尺寸调整各个面；不表示长方体只有 11 种展开图。';
    document.getElementById('unfold-base-label').textContent = `${this.getLabel(this.baseFace)} 面${this.baseFace === this.recommendedBase ? '（推荐）' : ''}`;
    const selector = document.getElementById('unfold-prediction'); selector.innerHTML = '';
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = '先选一个面'; selector.appendChild(placeholder);
    this.pattern.layout.filter(item => item.face !== this.baseFace).sort((a, b) => a.label.localeCompare(b.label)).forEach(item => {
      const option = document.createElement('option'); option.value = item.face; option.textContent = `${item.label} 面`; selector.appendChild(option);
    });
    selector.value = this.prediction;
    document.getElementById('unfold-show-answers').checked = this.showAnswers;
    const legend = document.getElementById('faces-legend-container'); legend.innerHTML = '';
    this.pattern.layout.slice().sort((a, b) => a.label.localeCompare(b.label)).forEach(item => {
      const entry = document.createElement('div'); entry.className = 'face-legend-item';
      const dot = document.createElement('span'); dot.className = 'face-color-dot'; dot.style.background = this.faceSpecs[item.face].color;
      const label = document.createElement('span');
      label.textContent = `${item.label} · ${this.getDimensionText(item.face)}${item.face === this.baseFace || this.showAnswers ? ` · ${this.getRole(item.face)}` : ''}`;
      entry.append(dot, label); legend.appendChild(entry);
    });
    const answer = document.getElementById('unfold-answer');
    if (!this.showAnswers) answer.textContent = `以 ${this.getLabel(this.baseFace)} 为底面，哪一面会成为顶面？预测后，分步折叠观察。`;
    else {
      const top = this.rootedLayout.find(item => this.getRole(item.face) === '顶面').face;
      const pairs = [], used = new Set();
      this.rootedLayout.forEach(item => {
        if (used.has(item.face)) return;
        const opposite = this.rootedLayout.find(other => other.n.every((value, index) => value === -item.n[index]));
        pairs.push(`${item.label} ↔ ${opposite.label}`); used.add(item.face); used.add(opposite.face);
      });
      const feedback = this.prediction ? this.prediction === top ? '预测正确。' : `你选了 ${this.getLabel(this.prediction)}，可以再展开观察它的位置。` : '';
      answer.textContent = `${feedback}顶面是 ${this.getLabel(top)}。三组相对面：${pairs.join('；')}。换底面后，这三组相对关系保持不变。`;
    }
    Object.values(this.faceMeshes || {}).forEach(mesh => this.drawFaceLabel(mesh));
    this.applyFoldProgress(this.foldProgress);
  }

  initUI() {
    let drag = null;
    this.canvas2dBox.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('.canvas-2d-toolbar') || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: this.panX, panY: this.panY, moved: false };
      this.suppressFaceClick = false;
    });
    window.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true; this.suppressFaceClick = true;
        this.canvas2dBox.setPointerCapture(event.pointerId);
      }
      if (drag.moved) { this.panX = drag.panX + dx; this.panY = drag.panY + dy; this.updateTransform2D(); }
    });
    const endDrag = event => { if (drag?.id === event.pointerId) drag = null; };
    window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
    this.canvas2dBox.addEventListener('lostpointercapture', endDrag);
    this.canvas2dBox.addEventListener('wheel', event => {
      event.preventDefault(); this.zoom = Math.max(0.1, Math.min(3, this.zoom + (event.deltaY > 0 ? -0.1 : 0.1))); this.updateTransform2D();
    }, { passive: false });
    document.getElementById('btn-2d-zoomin').addEventListener('click', () => { this.zoom = Math.min(3, this.zoom + 0.15); this.updateTransform2D(); });
    document.getElementById('btn-2d-zoomout').addEventListener('click', () => { this.zoom = Math.max(0.1, this.zoom - 0.15); this.updateTransform2D(); });
    document.getElementById('btn-2d-reset').addEventListener('click', () => this.reset2DView());
    document.getElementById('btn-unfold-reset-cam').addEventListener('click', () => this.resetCamera());
    document.getElementById('btn-unfold-top-cam').addEventListener('click', () => this.resetCamera(true));
    document.getElementById('btn-unfold-toggle').addEventListener('click', () => this.toggleAnimation());
    document.getElementById('btn-unfold-prev').addEventListener('click', () => this.animateTo(Math.max(0, Math.floor(this.foldProgress * 5 - 1e-6) / 5)));
    document.getElementById('btn-unfold-next').addEventListener('click', () => this.animateTo(Math.min(1, Math.floor(this.foldProgress * 5 + 1e-6) / 5 + 0.2)));
    document.getElementById('btn-unfold-open').addEventListener('click', () => { this.animating = false; this.animationTarget = 1; this.applyFoldProgress(0); });
    document.getElementById('btn-unfold-recommended').addEventListener('click', () => this.setBase(this.recommendedBase));
    document.getElementById('unfold-progress-slider').addEventListener('input', event => { this.animating = false; this.animationTarget = 1; this.applyFoldProgress(Number(event.target.value) / 1000); });
    document.querySelectorAll('.unfold-mode-btn').forEach(button => button.addEventListener('click', () => {
      this.foldMode = button.dataset.mode; this.animating = false; this.animationTarget = 1;
      document.querySelectorAll('.unfold-mode-btn').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', active); });
      this.applyFoldProgress(0);
    }));
    document.getElementById('unfold-speed').addEventListener('change', event => { this.stepSeconds = Number(event.target.value); });
    document.getElementById('unfold-prediction').addEventListener('change', event => { this.prediction = event.target.value; this.showAnswers = false; this.updateLesson(); });
    document.getElementById('unfold-show-answers').addEventListener('change', event => { this.showAnswers = event.target.checked; this.updateLesson(); });
    document.getElementById('btn-unfold-check').addEventListener('click', () => { this.showAnswers = true; this.updateLesson(); });
    document.querySelectorAll('.unfold-shape-type-btn').forEach(button => button.addEventListener('click', () => {
      this.shapeType = button.dataset.shape;
      document.querySelectorAll('.unfold-shape-type-btn').forEach(item => item.classList.toggle('active', item === button));
      document.getElementById('cuboid-dim-inputs-row').style.display = this.shapeType === 'cuboid' ? 'grid' : 'none';
      this.resetModel(false);
    }));
    const inputs = ['l', 'w', 'h'].map(axis => document.getElementById(`unfold-dim-${axis}`));
    inputs.forEach(input => input.addEventListener('input', () => {
      if (!inputs.every(item => item.validity.valid && Number.isFinite(item.valueAsNumber))) return;
      [this.dimL, this.dimW, this.dimH] = inputs.map(item => item.valueAsNumber);
      this.resetModel(false);
    }));
  }
}
window.UnfoldLab = UnfoldLab;
