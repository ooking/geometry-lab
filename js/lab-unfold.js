/** 展开图教学：稳定的面编号、可选底面、分步折叠与预测核对。 */
class UnfoldLab {
  constructor() {
    this.container = document.getElementById('canvas-unfold-container');
    this.canvas2dBox = document.getElementById('unfold-canvas-2d-box');
    this.canvas2dStage = document.getElementById('unfold-canvas-stage');
    this.shapeType = 'cube';
    this.cubeEdge = 1; this.lengthUnit = 'cm';
    this.measureMode = 'area'; this.measureFace = null;
    this.numberFormat = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 12, useGrouping: false });
    this.dimL = 4; this.dimW = 3; this.dimH = 2;
    this.axisOrder = [0, 1, 2]; this.netRotation = 0; this.showFaceLabels = true;
    this.previousAxisOrder = [...this.axisOrder]; this.axisReplayFrame = null;
    this.panX = 0; this.panY = 0; this.zoom = 1;
    this.foldProgress = 0; this.animating = false; this.animationTarget = 1;
    this.foldMode = 'steps'; this.stepSeconds = 2;
    this.showAnswers = false; this.prediction = '';
    this.faceSpecs = {
      bottom: { color: '#185637' }, top: { color: '#174c9c' },
      front: { color: '#933d12' }, back: { color: '#593287' },
      left: { color: '#8f2844' }, right: { color: '#705314' }
    };
    this.paperCanvas = this.createPaperTexture();
    this.canvas2dStage.style.setProperty('--paper-texture', `url(${this.paperCanvas.toDataURL()})`);
    this.patterns11 = LabUtils.cubeNets();
    this.planCache = new Map();
    this.initThree();
    this.renderPatternLibrary();
    this.initUI();
    this.loadPatternById('141-1');
    this.netResizeObserver = new ResizeObserver(() => {
      const width = this.canvas2dBox.clientWidth;
      if (width > 0 && width !== this.netViewportWidth) { this.netViewportWidth = width; this.reset2DView(); }
    });
    this.netResizeObserver.observe(this.canvas2dBox);
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

  updateCameraAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (!this.frameBounds || !this.frameDistance) return;
    const distance = this.getFramingDistance(aspect);
    const factor = distance / this.frameDistance;
    if (Math.abs(factor - 1) > 1e-6) {
      const target = this.controls?.target || this.defaultViewTarget;
      this.camera.position.sub(target).multiplyScalar(factor).add(target);
      this.defaultViewPosition.sub(this.defaultViewTarget).multiplyScalar(factor).add(this.defaultViewTarget);
    }
    this.frameDistance = distance;
    this.camera.far = Math.max(200, distance + this.frameBounds.getSize(new THREE.Vector3()).length() * 2);
    this.camera.updateProjectionMatrix();
  }

  get pattern() { return this.patterns11[this.currentPatternId]; }
  getLabel(face) { return this.pattern.layout.find(item => item.face === face).label; }

  getEffectiveDims() {
    if (this.shapeType === 'cube') return { l: 2, w: 2, h: 2, displayL: this.cubeEdge, displayW: this.cubeEdge, displayH: this.cubeEdge };
    const scale = 3.6 / Math.max(this.dimL, this.dimW, this.dimH);
    return { l: this.dimL * scale, w: this.dimW * scale, h: this.dimH * scale,
      displayL: this.dimL, displayW: this.dimW, displayH: this.dimH };
  }

  getAxisLengths(display = false) {
    const dims = this.getEffectiveDims();
    const lengths = display ? [dims.displayL, dims.displayW, dims.displayH] : [dims.l, dims.w, dims.h];
    return this.axisOrder.map(index => lengths[index]);
  }

  getFaceSize(face, display = false, pattern = this.pattern) {
    // Assign dimensions once to the original axes; changing the base only changes folding roles.
    const item = pattern.layout.find(cell => cell.face === face);
    const lengths = this.getAxisLengths(display);
    const length = axis => axis.reduce((sum, value, index) => sum + Math.abs(value) * lengths[index], 0);
    return { w: length(item.u), h: length(item.v) };
  }

  getDimensionText(face) {
    const size = this.getFaceSize(face, true);
    return `${this.formatNumber(size.w)} × ${this.formatNumber(size.h)} ${this.lengthUnit}`;
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
        const perimeter = document.createElement('span'); perimeter.className = 'net-pattern-perimeter';
        button.append(svg, caption, perimeter);
        button.addEventListener('click', () => {
          this.loadPatternById(id, { fromSelection: true });
          document.getElementById('unfold-library').open = false;
        });
        list.appendChild(button);
      });
      section.append(heading, note, list); library.appendChild(section);
    });
  }

  loadPatternById(id, { fromSelection = false } = {}) {
    if (!this.patterns11[id]) return;
    const unfoldAfterSelection = fromSelection && this.foldProgress >= 1 - 1e-7;
    this.currentPatternId = id;
    this.measureFace = null;
    const degree = cell => this.pattern.layout.filter(other => Math.abs(cell.x - other.x) + Math.abs(cell.y - other.y) === 1).length;
    const centerX = this.pattern.layout.reduce((sum, item) => sum + item.x, 0) / 6;
    const centerY = this.pattern.layout.reduce((sum, item) => sum + item.y, 0) / 6;
    const candidates = [...this.pattern.layout].sort((a, b) => degree(b) - degree(a) ||
      Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
    this.recommendedBase = candidates[0].face;
    this.baseFace = this.recommendedBase;
    this.prediction = ''; this.showAnswers = false;
    this.resetModel(true, !fromSelection || unfoldAfterSelection ? 1 : 0);
    if (unfoldAfterSelection) {
      if (this.foldMode !== 'steps' || this.sequenceAvailable) this.animateTo(0);
      else {
        // Keep unavailable step paths static, consistent with the disabled playback control.
        this.applyFoldProgress(0);
        this.resetCamera(false, false);
      }
    }
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

  resetModel(resetPan = false, progress = 0) {
    this.animating = false; this.foldProgress = progress; this.animationTarget = progress >= 1 ? 0 : 1;
    this.rootedLayout = LabUtils.rootNet(this.pattern, this.baseFace);
    if (resetPan) { this.panX = 0; this.panY = 0; }
    this.render2DCanvas();
    this.rebuild3DFoldingModel();
    this.updateLesson();
    this.applyFoldProgress(progress);
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
    const displayPositions = Object.fromEntries(Object.entries(positions).map(([face, p]) => {
      const center = this.rotateNetPoint(p.x + p.w / 2, p.y + p.h / 2);
      const swap = this.netRotation % 180 !== 0;
      const w = swap ? p.h : p.w, h = swap ? p.w : p.h;
      return [face, { x: center.x - w / 2, y: center.y - h / 2, w, h }];
    }));
    const values = Object.values(displayPositions);
    const minX = Math.min(...values.map(p => p.x)), maxX = Math.max(...values.map(p => p.x + p.w));
    const minY = Math.min(...values.map(p => p.y)), maxY = Math.max(...values.map(p => p.y + p.h));
    this.netBounds = { width: maxX - minX, height: maxY - minY };
    this.canvas2dStage.classList.toggle('hide-face-labels', !this.showFaceLabels);
    Object.entries(displayPositions).forEach(([face, p]) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'net-rect-face'; button.dataset.face = face;
      button.style.left = `${p.x - (minX + maxX) / 2}px`; button.style.top = `${p.y - (minY + maxY) / 2}px`;
      button.style.width = `${p.w}px`; button.style.height = `${p.h}px`;
      const letter = document.createElement('span'); letter.className = 'face-letter';
      letter.style.color = this.faceSpecs[face].color; letter.textContent = this.getLabel(face);
      const role = document.createElement('span'); role.className = 'face-role';
      button.append(letter, role);
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
      const start = this.rotateNetPoint(x1, y1), end = this.rotateNetPoint(x2, y2);
      Object.entries({ x1: start.x - minX, x2: end.x - minX, y1: start.y - minY, y2: end.y - minY })
        .forEach(([key, value]) => line.setAttribute(key, value));
      overlay.appendChild(line);
    });
    this.canvas2dStage.appendChild(overlay);
    this.reset2DView();
    if (oldFocus) this.canvas2dStage.querySelector(`[data-face="${oldFocus}"]`)?.focus({ preventScroll: true });
  }

  rotateNetPoint(x, y) {
    // Quarter turns use exact coordinates and keep face labels upright.
    if (this.netRotation === 90) return { x: -y, y: x };
    if (this.netRotation === 180) return { x: -x, y: -y };
    if (this.netRotation === 270) return { x: y, y: -x };
    return { x, y };
  }

  setNetRotation(rotation) {
    this.netRotation = (rotation + 360) % 360;
    document.getElementById('unfold-net-rotation-label').textContent = this.netRotation === 0
      ? '原始方向' : `逆时针 ${(360 - this.netRotation) % 360}°`;
    this.render2DCanvas();
    this.applyFoldProgress(this.foldProgress);
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
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, length, 6), new THREE.MeshBasicMaterial({ color: 0x775c3b }));
        if (axis === 'x') line.rotation.z = Math.PI / 2;
        hinge.add(line);
        this.foldHinges.push({ hinge, axis, sign, line, item });
      }
      const mesh = this.createFaceMesh(item.face, size.w, size.h);
      group.add(mesh); this.faceMeshes[item.face] = mesh;
    });
    const cacheKey = `${this.currentPatternId}:${this.baseFace}:${this.getAxisLengths().join(':')}`;
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
    this.closedBounds = new THREE.Box3().setFromObject(this.rootFoldGroup);
    bounds.union(this.closedBounds);
    // Include intermediate poses so moving panels have room throughout the demonstration.
    for (let sample = 1; sample < 50; sample++) {
      const progress = sample / 50;
      const stepAngles = Array(5).fill(0);
      this.foldOrder.forEach((index, step) => { stepAngles[index] = Math.min(1, Math.max(0, progress * 5 - step)); });
      this.applyRawAngles(stepAngles);
      bounds.union(new THREE.Box3().setFromObject(this.rootFoldGroup));
      this.applyRawAngles(Array(5).fill(progress));
      bounds.union(new THREE.Box3().setFromObject(this.rootFoldGroup));
    }
    this.expandedBounds = bounds;
    this.applyRawAngles(Array(5).fill(0));
    this.resetCamera();
  }

  getFramingDistance(aspect) {
    const center = this.frameBounds.getCenter(new THREE.Vector3());
    const direction = this.frameDirection;
    const up = this.frameTop ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, direction).normalize();
    const vertical = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanVertical = Math.tan(this.camera.fov * Math.PI / 360);
    const tanHorizontal = tanVertical * Math.max(aspect, 0.01);
    // Leave generous margins around the closed solid; sheets also need space for motion.
    const margin = this.frameFolded ? 1.65 : 1.25;
    let distance = this.camera.near * 4;
    for (const x of [this.frameBounds.min.x, this.frameBounds.max.x]) {
      for (const y of [this.frameBounds.min.y, this.frameBounds.max.y]) {
        for (const z of [this.frameBounds.min.z, this.frameBounds.max.z]) {
          const point = new THREE.Vector3(x, y, z).sub(center);
          const depth = point.dot(direction);
          distance = Math.max(distance,
            depth + margin * Math.abs(point.dot(right)) / tanHorizontal,
            depth + margin * Math.abs(point.dot(vertical)) / tanVertical,
            depth + this.camera.near * 4);
        }
      }
    }
    return distance;
  }

  updateFraming(folded, top = false) {
    const bounds = folded ? this.closedBounds : this.expandedBounds;
    if (!bounds) return;
    this.frameBounds = bounds;
    this.frameFolded = folded;
    this.frameTop = top;
    this.frameDirection = top ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0.6, 0.55, 1).normalize();
    this.frameDistance = this.getFramingDistance(this.camera.aspect);
    this.defaultViewTarget = bounds.getCenter(new THREE.Vector3());
    this.defaultViewPosition = this.defaultViewTarget.clone().addScaledVector(this.frameDirection, this.frameDistance);
    this.camera.far = Math.max(200, this.frameDistance + bounds.getSize(new THREE.Vector3()).length() * 2);
    this.camera.updateProjectionMatrix();
  }

  createPaperTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b89564'; ctx.fillRect(0, 0, 512, 256);
    // Repeatable fine fibers and mottling give a matte kraft-paper surface.
    let seed = 1427;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 9000; i++) {
      const x = random() * 512, y = random() * 256;
      ctx.fillStyle = random() > 0.5 ? 'rgba(70,44,21,0.07)' : 'rgba(255,244,212,0.11)';
      ctx.fillRect(x, y, 1 + random() * 2, 0.5 + random());
    }
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 700; i++) {
      const x = random() * 512, y = random() * 256;
      ctx.strokeStyle = 'rgba(76,51,27,0.045)';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3 + random() * 12, y + random() * 2); ctx.stroke();
    }
    return canvas;
  }

  createFaceMesh(face, width, height) {
    const geometry = new THREE.BoxGeometry(width, height, 0.018);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xb89564, roughness: 1, metalness: 0 }));
    mesh.userData = { face, width, height };
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x775c3b }));
    mesh.add(border); mesh.userData.border = border;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.FrontSide, roughness: 1, metalness: 0 });
    const labelGeometry = new THREE.PlaneGeometry(width, height);
    const front = new THREE.Mesh(labelGeometry, material); front.position.z = 0.01;
    const back = new THREE.Mesh(labelGeometry, material); back.position.z = -0.01; back.rotation.y = Math.PI;
    mesh.add(front, back); mesh.userData.labelCanvas = canvas; mesh.userData.labelTexture = texture;
    this.drawFaceLabel(mesh);
    return mesh;
  }

  drawFaceLabel(mesh) {
    const face = mesh.userData.face, canvas = mesh.userData.labelCanvas, ctx = canvas.getContext('2d');
    ctx.drawImage(this.paperCanvas, 0, 0);
    ctx.fillStyle = this.faceSpecs[face].color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (this.showFaceLabels) { ctx.font = 'bold 110px sans-serif'; ctx.fillText(this.getLabel(face), 256, 88); }
    ctx.fillStyle = '#48341d';
    ctx.font = '36px sans-serif'; ctx.fillText(this.getDimensionText(face), 256, 171, 460);
    ctx.font = 'bold 32px sans-serif';
    if (this.showFaceLabels && (face === this.baseFace || this.showAnswers)) ctx.fillText(this.getRole(face), 256, 220);
    mesh.userData.labelTexture.needsUpdate = true;
  }

  resetCamera(top = false, folded = this.foldProgress >= 1) {
    this.updateFraming(folded, top);
    if (!this.defaultViewTarget) return;
    const target = this.defaultViewTarget;
    this.camera.up.set(0, 1, 0);
    if (top) this.camera.up.set(0, 0, -1);
    this.camera.position.copy(this.defaultViewPosition);
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
    document.getElementById('unfold-stage-perimeter-item').hidden = this.foldProgress >= 1 - 1e-7;
    const angles = this.getAngles(this.foldProgress); this.applyRawAngles(angles);
    const reversing = this.animating && this.animationTarget < this.foldProgress;
    const step = Math.max(0, Math.min(4, reversing ? Math.ceil(this.foldProgress * 5 - 1e-7) - 1 : Math.floor(this.foldProgress * 5 + 1e-7)));
    const activeIndex = this.foldMode === 'steps' && this.sequenceAvailable ? this.foldOrder[step] : null;
    const moving = activeIndex === null ? new Set() : this.getMovingFaces(activeIndex);
    this.foldHinges.forEach(({ line }, index) => {
      line.visible = this.foldProgress < 1;
      line.material.color.setHex(index === activeIndex ? 0xfbbf24 : 0x775c3b);
    });
    Object.entries(this.faceMeshes).forEach(([face, mesh]) => {
      mesh.userData.border.material.color.setHex(face === this.measureFace ? 0x38bdf8 : this.foldProgress < 1 && face === this.baseFace ? 0xfbbf24 : this.foldProgress < 1 && moving.has(face) ? 0xfef08a : 0x775c3b);
    });
    this.canvas2dStage.querySelectorAll('[data-face]').forEach(button => {
      const face = button.dataset.face, isBase = face === this.baseFace;
      button.classList.toggle('is-bottom', isBase);
      button.classList.toggle('is-moving', moving.has(face));
      button.classList.toggle('is-measured', face === this.measureFace);
      button.setAttribute('aria-pressed', isBase);
      button.setAttribute('aria-label', `${this.getLabel(face)} 面${isBase ? '，当前底面' : '，点击设为底面'}`);
      button.querySelector('.face-role').textContent = isBase ? '底' : this.showAnswers && this.getRole(face) === '顶面' ? '顶' : '';
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
    if (this.foldMode === 'steps' && !this.sequenceAvailable && this.foldProgress < 1) {
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
    if (target < 1 && this.foldProgress >= 1) this.resetCamera(false, false);
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
    this.updateAxisIllustration();
    const { perimeter } = this.getMeasurements();
    this.updatePatternPerimeters();
    document.getElementById('perimeter-calc-result').textContent = `当前展开图周长：${this.formatNumber(perimeter)} ${this.lengthUnit}。六个面的周长总和，减去 5 条折痕长度的两倍；换底面不改变周长。`;
    document.getElementById('unfold-current-pattern').textContent = `当前图 ${this.currentPatternId.replace('-', ' · ')}`;
    document.getElementById('unfold-library-title').textContent = this.shapeType === 'cube' ? '选一种展开图 · 共 11 种' : '选一种连接样式';
    document.getElementById('unfold-library-note').textContent = this.shapeType === 'cube'
      ? '旋转或翻转后能重合的展开图算同一种。立体闭合时，点任意缩略图会自动播放展开；展开后可选择底面，再分步折叠。'
      : '这里沿用正方体的 11 种连接样式，并按长方体尺寸调整各个面；不表示长方体只有 11 种展开图。立体闭合时选图，会自动播放展开；分步路径不可用时直接显示展开图。';
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
      const dot = document.createElement('strong'); dot.className = 'face-letter'; dot.style.color = this.faceSpecs[item.face].color; dot.textContent = item.label;
      const label = document.createElement('span');
      label.textContent = `${this.getDimensionText(item.face)}${item.face === this.baseFace || this.showAnswers ? ` · ${this.getRole(item.face)}` : ''}`;
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
    this.updateMeasures();
    Object.values(this.faceMeshes || {}).forEach(mesh => this.drawFaceLabel(mesh));
    this.applyFoldProgress(this.foldProgress);
  }

  updatePatternPerimeters() {
    document.querySelectorAll('#unfold-pattern-library .net-pattern-btn').forEach(button => {
      const pattern = this.patterns11[button.dataset.id];
      const text = `周长 ${this.formatNumber(this.getMeasurements(pattern).perimeter)}${this.lengthUnit}`;
      button.querySelector('.net-pattern-perimeter').textContent = text;
      button.setAttribute('aria-label', `${pattern.name}，${text}`);
    });
  }

  updateAxisIllustration(order = this.axisOrder) {
    const positions = [[180, 226], [52, 145], [288, 30]];
    const names = ['长', '宽', '高'], values = [this.dimL, this.dimW, this.dimH];
    document.querySelectorAll('#unfold-axis-controls [data-axis-token]').forEach(token => {
      const index = Number(token.dataset.axisToken), slot = order.indexOf(index);
      const [x, y] = positions[slot];
      token.style.transform = `translate(${x}px, ${y}px)`;
      const label = `${names[index]} ${this.formatNumber(values[index])}${this.lengthUnit}`;
      token.querySelector('text').textContent = label;
      // Keep decimal and long unit labels inside their own moving badge.
      const width = Math.max(94, label.length * 9 + 18);
      const rect = token.querySelector('rect'); rect.setAttribute('x', -width / 2); rect.setAttribute('width', width);
    });
    const [horizontal, vertical, normal] = this.axisOrder;
    document.getElementById('unfold-axis-explanation').textContent =
      `A 面横边放“${names[horizontal]}”，竖边放“${names[vertical]}”；“${names[normal]}”沿垂直方向。A 面尺寸为 ${this.formatNumber(values[horizontal])} × ${this.formatNumber(values[vertical])}${this.lengthUnit}。`;
  }

  replayAxisIllustration() {
    if (this.axisReplayFrame !== null) cancelAnimationFrame(this.axisReplayFrame);
    const tokens = [...document.querySelectorAll('#unfold-axis-controls [data-axis-token]')];
    tokens.forEach(token => token.classList.add('is-positioning'));
    // Before the first selection, demonstrate a swap and return to the current configuration.
    const from = this.previousAxisOrder.every((value, i) => value === this.axisOrder[i])
      ? [this.axisOrder[1], this.axisOrder[0], this.axisOrder[2]] : this.previousAxisOrder;
    this.updateAxisIllustration(from);
    // Commit the starting pose before enabling transitions, so repeat playback always moves.
    document.getElementById('unfold-axis-controls').getBoundingClientRect();
    this.axisReplayFrame = requestAnimationFrame(() => {
      this.axisReplayFrame = null;
      tokens.forEach(token => token.classList.remove('is-positioning'));
      this.updateAxisIllustration();
    });
  }

  getMeasurements(pattern = this.pattern) {
    const dims = this.getEffectiveDims();
    const l = dims.displayL, w = dims.displayW, h = dims.displayH;
    const area = 2 * (l * w + l * h + w * h), volume = l * w * h;
    let perimeter = 8 * (l + w + h);
    pattern.layout.filter(item => item.parent).forEach(item => {
      const size = this.getFaceSize(item.face, true, pattern);
      perimeter -= 2 * (['top', 'bottom'].includes(item.edge) ? size.w : size.h);
    });
    return { area, volume, perimeter };
  }

  formatNumber(value) { return this.numberFormat.format(value); }

  updateMeasures() {
    const dims = this.getEffectiveDims(), f = value => this.formatNumber(value), unit = this.lengthUnit;
    const l = dims.displayL, w = dims.displayW, h = dims.displayH;
    const { area, volume, perimeter } = this.getMeasurements();
    document.getElementById('unfold-stage-volume').textContent = `${f(volume)} ${unit}³`;
    document.getElementById('unfold-stage-area').textContent = `${f(area)} ${unit}²`;
    document.getElementById('unfold-stage-perimeter').textContent = `${f(perimeter)} ${unit}`;
    document.getElementById('unfold-area-result').textContent = `${f(area)} ${unit}²`;
    document.getElementById('unfold-volume-result').textContent = `${f(volume)} ${unit}³`;
    document.getElementById('unfold-area-formula').textContent = this.shapeType === 'cube'
      ? `① 每个面：a × a = ${f(l)} × ${f(l)} = ${f(l * l)} ${unit}²
② 六个面：S = 6a² = 6 × ${f(l * l)} = ${f(area)} ${unit}²`
      : `① 三种面面积：${f(l)} × ${f(w)} = ${f(l * w)} ${unit}²；${f(l)} × ${f(h)} = ${f(l * h)} ${unit}²；${f(w)} × ${f(h)} = ${f(w * h)} ${unit}²
② 每种各有两个面：S = 2(长×宽 + 长×高 + 宽×高)
= 2 × (${f(l * w)} + ${f(l * h)} + ${f(w * h)}) = ${f(area)} ${unit}²`;
    const baseSize = this.getFaceSize(this.baseFace, true);
    const originalBase = this.pattern.layout.find(item => item.face === this.baseFace);
    const axisLengths = this.getAxisLengths(true);
    const normalHeight = originalBase.n.reduce((sum, value, index) => sum + Math.abs(value) * axisLengths[index], 0);
    const baseArea = baseSize.w * baseSize.h;
    document.getElementById('unfold-volume-formula').textContent =
      `① 以 ${this.getLabel(this.baseFace)} 面为底：${f(baseSize.w)} × ${f(baseSize.h)} = ${f(baseArea)} ${unit}²
` +
      `② 垂直于底面的高度：${f(normalHeight)} ${unit}
` +
      `③ V = 底面积 × 高 = ${f(baseArea)} × ${f(normalHeight)} = ${f(volume)} ${unit}³
` +
      (this.shapeType === 'cube' ? `也就是 V = a³ = ${f(l)} × ${f(l)} × ${f(l)}。` : `也就是 V = 长 × 宽 × 高 = ${f(l)} × ${f(w)} × ${f(h)}。`);
    const grid = document.getElementById('unfold-face-areas'); grid.innerHTML = '';
    this.pattern.layout.slice().sort((a, b) => a.label.localeCompare(b.label)).forEach(item => {
      const size = this.getFaceSize(item.face, true);
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'unfold-area-face'; button.dataset.areaFace = item.face;
      const letter = document.createElement('strong'); letter.className = 'face-letter';
      letter.style.color = this.faceSpecs[item.face].color; letter.textContent = item.label;
      button.append(letter, document.createTextNode(` 面 · ${f(size.w * size.h)} ${unit}²`));
      button.setAttribute('aria-pressed', item.face === this.measureFace);
      button.addEventListener('click', () => {
        this.measureFace = this.measureFace === item.face ? null : item.face;
        grid.querySelectorAll('button').forEach(entry => entry.setAttribute('aria-pressed', entry.dataset.areaFace === this.measureFace));
        this.applyFoldProgress(this.foldProgress);
      });
      grid.appendChild(button);
    });
    document.getElementById('unfold-measure-scaling').textContent =
      `再想一想：所有长度都变成原来的 2 倍，表面积变为 4 倍（${f(area)} → ${f(area * 4)} ${unit}²），体积变为 8 倍（${f(volume)} → ${f(volume * 8)} ${unit}³）。`;
  }

  initUI() {
    document.getElementById('unfold-axis-order').addEventListener('change', event => {
      if (this.axisReplayFrame !== null) { cancelAnimationFrame(this.axisReplayFrame); this.axisReplayFrame = null; }
      document.querySelectorAll('#unfold-axis-controls [data-axis-token]').forEach(token => token.classList.remove('is-positioning'));
      this.previousAxisOrder = [...this.axisOrder];
      this.axisOrder = [...event.target.value].map(Number);
      this.measureFace = null; this.prediction = ''; this.showAnswers = false;
      this.resetModel(false, this.foldProgress);
    });
    document.getElementById('btn-unfold-replay-axis').addEventListener('click', () => this.replayAxisIllustration());
    document.getElementById('btn-unfold-rotate-net').addEventListener('click', () => this.setNetRotation(this.netRotation - 90));
    document.getElementById('btn-unfold-reset-net-rotation').addEventListener('click', () => this.setNetRotation(0));
    document.getElementById('unfold-show-face-labels').addEventListener('change', event => {
      this.showFaceLabels = event.target.checked;
      this.canvas2dStage.classList.toggle('hide-face-labels', !this.showFaceLabels);
      Object.values(this.faceMeshes).forEach(mesh => this.drawFaceLabel(mesh));
    });
    document.getElementById('unfold-cube-edge').addEventListener('input', event => {
      const input = event.target;
      if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) return;
      this.cubeEdge = input.valueAsNumber;
      this.resetModel(false, this.foldProgress);
    });
    document.getElementById('unfold-length-unit').addEventListener('change', event => {
      this.lengthUnit = event.target.value;
      this.updateLesson();
    });
    document.querySelectorAll('.unfold-measure-btn').forEach(button => button.addEventListener('click', () => {
      this.measureMode = button.dataset.measure;
      document.querySelectorAll('.unfold-measure-btn').forEach(item => {
        const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', active);
      });
      document.getElementById('unfold-area-lesson').hidden = this.measureMode !== 'area';
      document.getElementById('unfold-volume-lesson').hidden = this.measureMode !== 'volume';
      if (this.measureMode === 'volume') {
        this.measureFace = null;
        document.querySelectorAll('[data-area-face]').forEach(item => item.setAttribute('aria-pressed', 'false'));
        this.applyFoldProgress(this.foldProgress);
      }
    }));
    document.getElementById('btn-unfold-show-solid').addEventListener('click', () => {
      if (this.foldMode === 'steps' && !this.sequenceAvailable) {
        document.getElementById('unfold-status-banner').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      this.animateTo(1);
    });
    let drag = null;
    this.canvas2dBox.addEventListener('pointerdown', event => {
      if (event.button !== 0 || drag) return;
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
    document.getElementById('btn-unfold-reset-cam').addEventListener('click', () => this.resetCamera());
    document.getElementById('btn-unfold-top-cam').addEventListener('click', () => this.resetCamera(true));
    document.getElementById('btn-unfold-toggle').addEventListener('click', () => this.toggleAnimation());
    document.getElementById('btn-unfold-prev').addEventListener('click', () => this.animateTo(Math.max(0, Math.floor(this.foldProgress * 5 - 1e-6) / 5)));
    document.getElementById('btn-unfold-next').addEventListener('click', () => this.animateTo(Math.min(1, Math.floor(this.foldProgress * 5 + 1e-6) / 5 + 0.2)));
    document.getElementById('btn-unfold-open').addEventListener('click', () => { this.animating = false; this.animationTarget = 1; this.applyFoldProgress(0); this.resetCamera(); });
    document.getElementById('btn-unfold-recommended').addEventListener('click', () => this.setBase(this.recommendedBase));
    document.getElementById('unfold-progress-slider').addEventListener('input', event => {
      const progress = Number(event.target.value) / 1000;
      if (this.foldProgress >= 1 && progress < 1) this.resetCamera(false, false);
      this.animating = false; this.animationTarget = 1; this.applyFoldProgress(progress);
    });
    document.querySelectorAll('.unfold-mode-btn').forEach(button => button.addEventListener('click', () => {
      this.foldMode = button.dataset.mode; this.animating = false; this.animationTarget = 1;
      document.querySelectorAll('.unfold-mode-btn').forEach(item => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', active); });
      this.applyFoldProgress(0);
      this.resetCamera(false, false);
    }));
    document.getElementById('unfold-speed').addEventListener('change', event => { this.stepSeconds = Number(event.target.value); });
    document.getElementById('unfold-prediction').addEventListener('change', event => { this.prediction = event.target.value; this.showAnswers = false; this.updateLesson(); });
    document.getElementById('unfold-show-answers').addEventListener('change', event => { this.showAnswers = event.target.checked; this.updateLesson(); });
    document.getElementById('btn-unfold-check').addEventListener('click', () => { this.showAnswers = true; this.updateLesson(); });
    document.querySelectorAll('.unfold-shape-type-btn').forEach(button => button.addEventListener('click', () => {
      this.shapeType = button.dataset.shape;
      document.querySelectorAll('.unfold-shape-type-btn').forEach(item => item.classList.toggle('active', item === button));
      document.getElementById('cube-dim-inputs-row').style.display = this.shapeType === 'cube' ? 'grid' : 'none';
      document.getElementById('cuboid-dim-inputs-row').style.display = this.shapeType === 'cuboid' ? 'grid' : 'none';
      document.getElementById('unfold-axis-controls').hidden = this.shapeType !== 'cuboid';
      this.resetModel(false, this.foldProgress);
    }));
    const inputs = ['l', 'w', 'h'].map(axis => document.getElementById(`unfold-dim-${axis}`));
    inputs.forEach(input => input.addEventListener('input', () => {
      if (!inputs.every(item => item.validity.valid && Number.isFinite(item.valueAsNumber))) return;
      [this.dimL, this.dimW, this.dimH] = inputs.map(item => item.valueAsNumber);
      this.resetModel(false, this.foldProgress);
    }));
  }
}
window.UnfoldLab = UnfoldLab;
