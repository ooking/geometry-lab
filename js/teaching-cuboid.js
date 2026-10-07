/** Reusable, DOM-independent cuboid calculations and scoped teaching visuals. */
window.TeachingCuboid = {
  measures([l, w, h], lidLayers = 1) {
    const surface = 2 * (l * w + l * h + w * h), extra = (lidLayers - 1) * l * w;
    return { surface, extra, paper: surface + extra, volume: l * w * h };
  },
  // The same edge-connected topology supports both question 3-2 and its maximum example.
  stripNet(axes) {
    const cells = [[0, 0], [1, 0], [0, 1], [0, 2], [-1, 2], [0, 3]];
    const seed = { layout: cells.map(([x, y], i) => ({ x, y, face: `face-${i}`, label: 'ABCDEF'[i] })) };
    const layout = LabUtils.rootNet(seed, 'face-0');
    return this.placeNet(layout, axes);
  },
  boxNet(dims) {
    const cells = [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1], [0, 2]];
    const seed = { layout: cells.map(([x, y], i) => ({ x, y, face: `face-${i}`, label: 'ABCDEF'[i] })) };
    return this.placeNet(LabUtils.rootNet(seed, 'face-0'), dims);
  },
  placeNet(layout, axes) {
    const length = vector => vector.reduce((sum, v, i) => sum + Math.abs(v) * axes[i], 0);
    const faces = [], byFace = new Map(), hinges = [];
    layout.forEach(item => {
      const w = length(item.u), h = length(item.v), parent = byFace.get(item.parent);
      let x = -w / 2, y = -h / 2;
      if (parent) {
        x = parent.x + (parent.w - w) / 2; y = parent.y + (parent.h - h) / 2;
        if (item.edge === 'top') y = parent.y - h;
        if (item.edge === 'bottom') y = parent.y + parent.h;
        if (item.edge === 'left') x = parent.x - w;
        if (item.edge === 'right') x = parent.x + parent.w;
        const horizontal = ['top', 'bottom'].includes(item.edge);
        const x1 = horizontal ? parent.x : parent.x + (item.edge === 'right' ? parent.w : 0);
        const y1 = horizontal ? parent.y + (item.edge === 'bottom' ? parent.h : 0) : parent.y;
        hinges.push({ x1, y1, x2: horizontal ? x1 + parent.w : x1, y2: horizontal ? y1 : y1 + parent.h,
          length: horizontal ? parent.w : parent.h });
      }
      const face = { ...item, x, y, w, h }; faces.push(face); byFace.set(item.face, face);
    });
    const total = faces.reduce((sum, f) => sum + 2 * (f.w + f.h), 0);
    const seam = hinges.reduce((sum, h) => sum + h.length, 0);
    return { faces, hinges, total, seam, perimeter: total - 2 * seam };
  },
  drawNet(host, net, unit, extraLid = false) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const minX = Math.min(...net.faces.map(f => f.x)), minY = Math.min(...net.faces.map(f => f.y));
    const maxX = Math.max(...net.faces.map(f => f.x + f.w)), maxY = Math.max(...net.faces.map(f => f.y + f.h));
    const margin = Math.max(maxX - minX, maxY - minY) * 0.08;
    svg.setAttribute('viewBox', `${minX - margin} ${minY - margin} ${maxX - minX + 2 * margin} ${maxY - minY + 2 * margin}`);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `长方体展开图，外周长 ${net.perimeter} ${unit}，虚线为折痕`);
    const add = (tag, attrs, text) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      if (text) el.textContent = text; svg.appendChild(el); return el;
    };
    const font = Math.min(...net.faces.flatMap(f => [f.w, f.h])) * 0.19;
    net.faces.forEach(f => {
      const lid = extraLid && f.n[2] === -1;
      add('rect', { x: f.x, y: f.y, width: f.w, height: f.h, fill: lid ? '#f6d18a' : '#c6a775', stroke: '#fbbf24', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
      add('text', { x: f.x + f.w / 2, y: f.y + f.h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': font, fill: '#48341d' }, `${f.w} × ${f.h}`);
      if (lid) add('text', { x: f.x + f.w / 2, y: f.y + f.h * 0.76, 'text-anchor': 'middle', 'font-size': font * 0.8, fill: '#48341d' }, '上盖 × 2');
    });
    net.hinges.forEach(h => add('line', { x1: h.x1, y1: h.y1, x2: h.x2, y2: h.y2, stroke: '#48341d', 'stroke-width': 2.5, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }));
    host.replaceChildren(svg);
  }
};

/** A separate renderer per application; shared lifecycle, no access to UnfoldLab state. */
window.CuboidTeachingView = class {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x0c121a);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); container.append(this.renderer.domElement);
    if (THREE.OrbitControls) { this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true; }
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const light = new THREE.DirectionalLight(0xffffff, 0.7); light.position.set(5, 10, 8); this.scene.add(light);
    this.group = new THREE.Group(); this.scene.add(this.group);
    LabUtils.startViewport(this);
  }
  show(net, progress = 1, splitAxis = null, dims = null) {
    LabUtils.disposeGroup(this.group);
    const scale = 5 / Math.max(...net.faces.flatMap(f => [f.w, f.h]));
    const groups = new Map(); this.group.rotation.x = -Math.PI / 2;
    net.faces.forEach(item => {
      const group = new THREE.Group(); groups.set(item.face, group);
      if (!item.parent) this.group.add(group);
      else {
        const parent = net.faces.find(f => f.face === item.parent), hinge = new THREE.Group();
        const horizontal = ['top', 'bottom'].includes(item.edge);
        const sign = ['top', 'right'].includes(item.edge) ? 1 : -1;
        if (horizontal) { hinge.position.y = sign * parent.h * scale / 2; group.position.y = sign * item.h * scale / 2; hinge.rotation.x = sign * progress * Math.PI / 2; }
        else { hinge.position.x = sign * parent.w * scale / 2; group.position.x = sign * item.w * scale / 2; hinge.rotation.y = -sign * progress * Math.PI / 2; }
        groups.get(item.parent).add(hinge); hinge.add(group);
      }
      const geometry = new THREE.PlaneGeometry(item.w * scale, item.h * scale);
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc6a775, side: THREE.DoubleSide, roughness: 1 })));
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0x775c3b })));
      // Intersection of each face with the middle plane shows where two original boxes meet.
      if (splitAxis !== null && dims) {
        if (item.n[splitAxis] === 0) {
          const alongU = item.u[splitAxis] !== 0;
          const half = (alongU ? item.h : item.w) * scale / 2;
          const points = alongU ? [new THREE.Vector3(0, -half, 0.015), new THREE.Vector3(0, half, 0.015)] : [new THREE.Vector3(-half, 0, 0.015), new THREE.Vector3(half, 0, 0.015)];
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0x38bdf8 })));
        }
      }
    });
    this.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.group), center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1);
    const distance = radius / Math.sin(Math.atan(Math.tan(Math.PI / 9) * Math.min(1, aspect))) * 1.15;
    this.camera.position.copy(center).addScaledVector(new THREE.Vector3(0.65, 0.8, 1).normalize(), distance);
    this.camera.lookAt(center); if (this.controls) { this.controls.target.copy(center); this.controls.update(); }
    this.resize();
  }
};
