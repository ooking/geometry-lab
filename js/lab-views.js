/** 方块搭建：连续立柱、六方向正投影、相同主视图和左视图下的数量比较。 */
class ViewsLab {
  constructor() {
    this.container = document.getElementById('canvas-views-container');
    this.rows = 3;
    this.cols = 3;
    this.maxHeight = 10;
    this.maxSize = 10;
    this.heights = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    this.selected = { r: 0, c: 0 };
    this.history = [];
    this.viewMode = 'three';
    this.direction = null;
    this.showDirections = false;
    this.showHeights = false;
    this.directions = {
      front: { label: '前', vector: [0, 0, 1], up: [0, 1, 0] },
      back: { label: '后', vector: [0, 0, -1], up: [0, 1, 0] },
      left: { label: '左', vector: [-1, 0, 0], up: [0, 1, 0] },
      right: { label: '右', vector: [1, 0, 0], up: [0, 1, 0] },
      top: { label: '上', vector: [0, 1, 0], up: [0, 0, -1] },
      bottom: { label: '下', vector: [0, -1, 0], up: [0, 0, 1] }
    };
    this.initThree();
    this.initUI();
    this.loadDemoPattern('stepped', false);
  }

  initThree() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121a);
    this.perspective = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    this.orthographic = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 300);
    this.camera = this.perspective;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.85);
    light.position.set(6, 12, 8);
    this.scene.add(light);
    this.cubeGroup = new THREE.Group();
    this.directionGroup = new THREE.Group();
    this.scene.add(this.cubeGroup, this.directionGroup);
    LabUtils.startViewport(this);
  }

  createControls(target) {
    this.controls?.dispose();
    this.camera.lookAt(target);
    if (!THREE.OrbitControls) return;
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.update();
    this.controls.addEventListener('change', () => {
      if (!this.direction) return;
      const actual = this.camera.position.clone().sub(this.controls.target).normalize();
      const expected = new THREE.Vector3(...this.directions[this.direction].vector);
      if (actual.dot(expected) < 0.9999) {
        this.direction = null;
        this.updateDirectionUI();
      }
    });
  }

  getMaxHeight() { return Math.max(0, ...this.heights.flat()); }

  updateCameraAspect(aspect) {
    this.perspective.aspect = aspect;
    this.perspective.updateProjectionMatrix();
    const height = this.getMaxHeight();
    let viewWidth = this.cols, viewHeight = Math.max(height, 1);
    if (this.direction === 'left' || this.direction === 'right') viewWidth = this.rows;
    if (this.direction === 'top' || this.direction === 'bottom') viewHeight = this.rows;
    if (!this.direction) viewWidth = viewHeight = Math.max(this.rows, this.cols, height, 3);
    const halfHeight = Math.max(viewHeight, viewWidth / aspect) * 0.65 + 0.5;
    this.orthographic.left = -halfHeight * aspect;
    this.orthographic.right = halfHeight * aspect;
    this.orthographic.top = halfHeight;
    this.orthographic.bottom = -halfHeight;
    this.orthographic.updateProjectionMatrix();
  }

  setView(direction = null) {
    this.direction = direction;
    const height = this.getMaxHeight();
    const target = new THREE.Vector3(0, Math.max(height, 1) / 2, 0);
    const extent = Math.max(this.rows, this.cols, height, 3);
    const distance = extent * 2 + 4;
    if (direction) {
      this.camera = this.orthographic;
      this.camera.zoom = 1;
      this.camera.up.set(...this.directions[direction].up);
      this.camera.position.copy(target).add(new THREE.Vector3(...this.directions[direction].vector).multiplyScalar(distance));
    } else {
      this.camera = this.perspective;
      this.camera.up.set(0, 1, 0);
      const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
      const fitDistance = distance / Math.min(1, aspect);
      this.camera.position.copy(target).add(new THREE.Vector3(0.65, 0.75, 0.8).multiplyScalar(fitDistance));
    }
    this.fittedHeight = height;
    this.fittedExtent = extent;
    this.createControls(target);
    this.resize();
    this.updateDirectionUI();
  }

  updateDirectionUI() {
    document.querySelectorAll('.views-direction-btn').forEach(button => {
      const active = (button.dataset.direction || null) === this.direction;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active);
    });
    document.querySelectorAll('[data-projection]').forEach(card => {
      card.classList.toggle('is-observed', card.dataset.projection === this.direction);
    });
    const status = document.getElementById('views-camera-label');
    if (status) status.textContent = this.direction ? `从${this.directions[this.direction].label}面观察` : '自由观察';
  }

  rebuild3DCubes() {
    LabUtils.disposeGroup(this.cubeGroup);
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      this.gridHelper.material.dispose();
    }
    const lines = [];
    for (let c = 0; c <= this.cols; c++) {
      const x = c - this.cols / 2;
      lines.push(x, -0.01, -this.rows / 2, x, -0.01, this.rows / 2);
    }
    for (let r = 0; r <= this.rows; r++) {
      const z = r - this.rows / 2;
      lines.push(-this.cols / 2, -0.01, z, this.cols / 2, -0.01, z);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    this.gridHelper = new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0x334155 }));
    this.scene.add(this.gridHelper);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.45 });
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x1e3a8a });
    this.heights.forEach((row, r) => row.forEach((count, c) => {
      for (let h = 0; h < count; h++) {
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(c - (this.cols - 1) / 2, h + 0.5, r - (this.rows - 1) / 2);
        cube.add(new THREE.LineSegments(edges, lineMaterial));
        this.cubeGroup.add(cube);
      }
    }));
    const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({
      color: 0xfbbf24, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
    }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(this.selected.c - (this.cols - 1) / 2,
      this.heights[this.selected.r][this.selected.c] + 0.01, this.selected.r - (this.rows - 1) / 2);
    this.cubeGroup.add(marker);
    this.rebuildDirectionMarkers();
  }

  rebuildDirectionMarkers() {
    LabUtils.disposeGroup(this.directionGroup);
    const height = this.getMaxHeight();
    Object.values(this.directions).forEach(({ label, vector }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, 64, 32);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }));
      const reach = vector[0] ? this.cols / 2 + 0.8 : vector[2] ? this.rows / 2 + 0.8 : Math.max(height, 1) / 2 + 0.8;
      sprite.position.set(0, Math.max(height, 1) / 2, 0).add(new THREE.Vector3(...vector).multiplyScalar(reach));
      sprite.scale.set(1, 0.5, 1);
      this.directionGroup.add(sprite);
    });
    this.directionGroup.visible = this.showDirections;
  }

  saveHistory() {
    this.history.push({ heights: this.heights.map(row => [...row]), selected: { ...this.selected } });
    if (this.history.length > 30) this.history.shift();
  }

  clearPreset() {
    document.querySelectorAll('.views-demo-btn').forEach(button => button.classList.remove('active'));
  }

  setSelectedHeight(height) {
    if (!Number.isInteger(height) || height < 0 || height > this.maxHeight) return;
    const { r, c } = this.selected;
    if (this.heights[r][c] === height) return;
    this.saveHistory();
    this.heights[r][c] = height;
    this.clearPreset();
    this.syncUpdate();
  }

  resizeBoard(rows, cols) {
    if (![rows, cols].every(value => Number.isInteger(value) && value >= 1 && value <= this.maxSize)) return;
    if (rows === this.rows && cols === this.cols) return;
    this.saveHistory();
    const removed = this.heights.reduce((sum, row, r) => sum + row.reduce((total, count, c) =>
      total + (r >= rows || c >= cols ? count : 0), 0), 0);
    this.heights = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => this.heights[r]?.[c] || 0));
    this.rows = rows; this.cols = cols;
    this.selected.r = Math.min(this.selected.r, rows - 1);
    this.selected.c = Math.min(this.selected.c, cols - 1);
    this.clearPreset();
    this.syncUpdate(true);
    const message = document.getElementById('views-edit-status');
    if (message) message.textContent = removed ? `缩小区域移除了 ${removed} 个方块，可点击“撤销上一步”恢复。` : '搭建区域已调整，原有方块已保留。';
  }

  renderTopViewMatrix() {
    const table = document.getElementById('topview-matrix-table');
    table.innerHTML = '';
    this.heights.forEach((row, r) => {
      const tr = document.createElement('tr');
      row.forEach((count, c) => {
        const td = document.createElement('td');
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.cell = `${r},${c}`;
        button.className = 'topview-matrix-cell';
        const selected = r === this.selected.r && c === this.selected.c;
        button.classList.toggle('has-blocks', count > 0);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', selected);
        button.setAttribute('aria-label', `第 ${r + 1} 排第 ${c + 1} 列，${count} 块，点击选择`);
        button.innerHTML = `<span class="cell-letter">${r + 1},${c + 1}</span><span class="cell-num">${count || '·'}</span>`;
        button.addEventListener('click', () => {
          this.selected = { r, c };
          this.syncUpdate();
        });
        button.addEventListener('contextmenu', event => {
          event.preventDefault(); this.selected = { r, c };
          if (count) this.setSelectedHeight(count - 1);
          else this.syncUpdate();
        });
        td.appendChild(button); tr.appendChild(td);
      });
      table.appendChild(tr);
    });
  }

  getProjections() {
    return {
      F: Array.from({ length: this.cols }, (_, c) => Math.max(...this.heights.map(row => row[c]))),
      L: this.heights.map(row => Math.max(...row))
    };
  }

  updateProjections() {
    const { F, L } = this.getProjections();
    const levels = Math.max(3, this.getMaxHeight());
    const silhouette = heights => Array.from({ length: levels }, (_, r) => heights.map(h => h > levels - r - 1 ? 1 : 0));
    this.renderProjectionSVG('front', silhouette(F), '#38bdf8');
    this.renderProjectionSVG('back', silhouette([...F].reverse()), '#38bdf8');
    this.renderProjectionSVG('left', silhouette(L), '#34d399');
    this.renderProjectionSVG('right', silhouette([...L].reverse()), '#34d399');
    this.renderProjectionSVG('top', this.heights, '#818cf8', this.showHeights);
    this.renderProjectionSVG('bottom', [...this.heights].reverse(), '#818cf8', this.showHeights);
    document.querySelectorAll('[data-projection]').forEach(card => {
      card.hidden = this.viewMode === 'three' && ['back', 'right', 'bottom'].includes(card.dataset.projection);
    });
    document.getElementById('views-projection-note').textContent = this.viewMode === 'three'
      ? '三视图：主视图、左视图、俯视图。选择方向按钮可对应观察；切换到六方向，可以比较相反方向的轮廓。'
      : '六方向以搭建台为固定参照。前后、左右、上下的轮廓分别互为镜像；这里只画轮廓，不表示被遮挡的方块数量。';
    this.updateDirectionUI();
  }

  renderProjectionSVG(direction, matrix, color, showNumbers = false) {
    const svg = document.getElementById(`svg-${direction}-view`);
    svg.innerHTML = '';
    const cellSize = 30, gap = 2;
    svg.setAttribute('viewBox', `0 0 ${matrix[0].length * (cellSize + gap) + gap} ${matrix.length * (cellSize + gap) + gap}`);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `从${this.directions[direction].label}面看的投影`;
    svg.appendChild(title);
    matrix.forEach((row, r) => row.forEach((value, c) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const x = gap + c * (cellSize + gap), y = gap + r * (cellSize + gap);
      Object.entries({ x, y, width: cellSize, height: cellSize, rx: 2,
        fill: value ? color : 'rgba(255,255,255,0.03)', stroke: value ? '#ffffff' : 'rgba(255,255,255,0.15)' })
        .forEach(([name, val]) => rect.setAttribute(name, val));
      if (!value) rect.setAttribute('stroke-dasharray', '3,3');
      svg.appendChild(rect);
      if (value && showNumbers) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        Object.entries({ x: x + 15, y: y + 20, fill: '#fff', 'font-size': 13, 'text-anchor': 'middle' })
          .forEach(([name, val]) => text.setAttribute(name, val));
        text.textContent = value; svg.appendChild(text);
      }
    }));
  }

  analyzeExtremes() {
    const { F, L } = this.getProjections();
    const total = this.heights.flat().reduce((sum, value) => sum + value, 0);
    const maximum = L.reduce((sum, height) => sum + F.reduce((n, front) => n + Math.min(height, front), 0), 0);
    let minimum = 0;
    for (let h = 1; h <= this.maxHeight; h++) minimum += h * Math.max(F.filter(v => v === h).length, L.filter(v => v === h).length);
    const banner = document.getElementById('views-q16-banner');
    banner.className = 'status-banner info';
    banner.innerHTML = `<div>现在共有 <strong>${total}</strong> 个方块。<br>
      保持主视图和左视图，最少可以用 <strong>${minimum}</strong> 个，最多可以用 <strong>${maximum}</strong> 个。<br>
      <span class="learning-note">方块从底部连续堆叠，没有悬空；只固定这两个视图，俯视图可以变化。</span></div>`;
  }

  showExtreme(mode) {
    const { F, L } = this.getProjections();
    this.saveHistory();
    this.heights = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
    if (mode === 'max') this.heights = L.map(height => F.map(front => Math.min(height, front)));
    else {
      const maxColumn = F.indexOf(Math.max(...F)), maxRow = L.indexOf(Math.max(...L));
      for (let h = 1; h <= this.maxHeight; h++) {
        const rows = L.map((v, i) => v === h ? i : -1).filter(i => i >= 0);
        const cols = F.map((v, i) => v === h ? i : -1).filter(i => i >= 0);
        const paired = Math.min(rows.length, cols.length);
        for (let i = 0; i < paired; i++) this.heights[rows[i]][cols[i]] = h;
        rows.slice(paired).forEach(r => { this.heights[r][maxColumn] = h; });
        cols.slice(paired).forEach(c => { this.heights[maxRow][c] = h; });
      }
    }
    this.clearPreset(); this.syncUpdate();
  }

  loadDemoPattern(type, remember = true) {
    const patterns = {
      stepped: [[2, 1, 0], [0, 1, 3], [0, 0, 1]],
      corner: [[3, 2, 1], [2, 1, 0], [1, 0, 0]],
      'u-shape': [[2, 0, 2], [1, 0, 1], [2, 1, 2]]
    };
    if (!patterns[type]) return;
    if (remember) this.saveHistory();
    this.rows = Math.max(3, this.rows); this.cols = Math.max(3, this.cols);
    this.heights = Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.cols }, (_, c) => patterns[type][r]?.[c] || 0));
    this.clearPreset();
    document.querySelector(`.views-demo-btn[data-pattern="${type}"]`)?.classList.add('active');
    this.syncUpdate(true);
  }

  syncUpdate(refit = false) {
    const focusedCell = document.activeElement?.dataset.cell;
    this.rebuild3DCubes();
    this.renderTopViewMatrix();
    this.updateProjections();
    this.analyzeExtremes();
    document.getElementById('views-rows').value = this.rows;
    document.getElementById('views-cols').value = this.cols;
    const { r, c } = this.selected, value = this.heights[r][c];
    document.getElementById('views-selected-cell').textContent = `第 ${r + 1} 排，第 ${c + 1} 列`;
    document.getElementById('views-cell-height').value = value;
    document.getElementById('btn-views-add').disabled = value >= this.maxHeight;
    document.getElementById('btn-views-remove').disabled = value <= 0;
    document.getElementById('btn-views-undo').disabled = this.history.length === 0;
    document.getElementById('views-edit-status').textContent = '';
    if (focusedCell) document.querySelector(`[data-cell="${focusedCell}"]`)?.focus({ preventScroll: true });
    document.querySelectorAll('[data-resize-axis]').forEach(button => {
      const count = button.dataset.resizeAxis === 'rows' ? this.rows : this.cols;
      const delta = Number(button.dataset.delta);
      button.disabled = count + delta < 1 || count + delta > this.maxSize;
    });
    const extent = Math.max(this.rows, this.cols, this.getMaxHeight(), 3);
    if (refit || (this.direction && this.fittedHeight !== this.getMaxHeight()) || extent > (this.fittedExtent || 0)) this.setView(this.direction);
  }

  initUI() {
    document.getElementById('btn-views-add').addEventListener('click', () => this.setSelectedHeight(this.heights[this.selected.r][this.selected.c] + 1));
    document.getElementById('btn-views-remove').addEventListener('click', () => this.setSelectedHeight(this.heights[this.selected.r][this.selected.c] - 1));
    document.getElementById('views-cell-height').addEventListener('change', event => {
      const input = event.target;
      if (input.validity.valid && Number.isInteger(input.valueAsNumber)) this.setSelectedHeight(input.valueAsNumber);
      else input.value = this.heights[this.selected.r][this.selected.c];
    });
    document.getElementById('btn-views-size').addEventListener('click', () => {
      const rows = document.getElementById('views-rows'), cols = document.getElementById('views-cols');
      if (!rows.reportValidity() || !cols.reportValidity()) return;
      this.resizeBoard(rows.valueAsNumber, cols.valueAsNumber);
    });
    ['views-rows', 'views-cols'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); document.getElementById('btn-views-size').click(); }
      });
    });
    document.querySelectorAll('[data-resize-axis]').forEach(button => button.addEventListener('click', () => {
      const delta = Number(button.dataset.delta);
      this.resizeBoard(this.rows + (button.dataset.resizeAxis === 'rows' ? delta : 0),
        this.cols + (button.dataset.resizeAxis === 'cols' ? delta : 0));
    }));
    document.getElementById('btn-views-undo').addEventListener('click', () => {
      const previous = this.history.pop();
      if (!previous) return;
      this.heights = previous.heights; this.selected = previous.selected;
      this.rows = this.heights.length; this.cols = this.heights[0].length;
      this.clearPreset(); this.syncUpdate(true);
    });
    document.getElementById('btn-clear-views').addEventListener('click', () => {
      if (!this.heights.flat().some(Boolean)) return;
      this.saveHistory(); this.heights = this.heights.map(row => row.map(() => 0));
      this.clearPreset(); this.syncUpdate();
    });
    document.querySelectorAll('.views-demo-btn').forEach(button => button.addEventListener('click', () => this.loadDemoPattern(button.dataset.pattern)));
    document.querySelectorAll('.views-direction-btn').forEach(button => button.addEventListener('click', () => {
      const direction = button.dataset.direction || null;
      if (direction && ['back', 'right', 'bottom'].includes(direction)) this.setProjectionMode('six');
      this.setView(direction);
    }));
    document.querySelectorAll('.views-mode-btn').forEach(button => button.addEventListener('click', () => this.setProjectionMode(button.dataset.mode)));
    document.getElementById('views-show-directions').addEventListener('change', event => {
      this.showDirections = event.target.checked; this.directionGroup.visible = this.showDirections;
    });
    document.getElementById('views-show-heights').addEventListener('change', event => {
      this.showHeights = event.target.checked; this.updateProjections();
    });
    document.getElementById('btn-views-min').addEventListener('click', () => this.showExtreme('min'));
    document.getElementById('btn-views-max').addEventListener('click', () => this.showExtreme('max'));
  }

  setProjectionMode(mode) {
    this.viewMode = mode;
    document.querySelectorAll('.views-mode-btn').forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
    });
    if (mode === 'three' && ['back', 'right', 'bottom'].includes(this.direction)) this.setView('front');
    this.updateProjections();
  }
}
window.ViewsLab = ViewsLab;
