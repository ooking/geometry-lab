/** Shared lifecycle and geometry utilities. */
window.LabUtils = {
  disposeGroup(group) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.filter(Boolean).forEach(material => {
        materials.add(material);
        if (material.map) textures.add(material.map);
      });
    });
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
    while (group.children.length) group.remove(group.children[0]);
  },
  startViewport(lab, onFrame) {
    lab.resize = () => {
      const w = lab.container.clientWidth, h = lab.container.clientHeight;
      if (!w || !h) return;
      if (lab.updateCameraAspect) lab.updateCameraAspect(w / h);
      else {
        lab.camera.aspect = w / h;
        lab.camera.updateProjectionMatrix();
      }
      lab.renderer.setSize(w, h);
    };
    let frame = null, previous = null;
    const tick = time => {
      const delta = previous === null ? 0 : Math.min((time - previous) / 1000, 0.05);
      previous = time;
      if (lab.controls) lab.controls.update();
      if (onFrame) onFrame(delta);
      lab.renderer.render(lab.scene, lab.camera);
      frame = requestAnimationFrame(tick);
    };
    lab.setActive = active => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      previous = null;
      if (active && !document.hidden) {
        lab.resize();
        frame = requestAnimationFrame(tick);
      }
    };
    lab.resizeObserver = new ResizeObserver(lab.resize);
    lab.resizeObserver.observe(lab.container);
  },
  // Enumerate free hexominoes, identify cube nets by six distinct folded normals.
  cubeNets() {
    const directions = [[0, 1, 'top'], [0, -1, 'bottom'], [1, 0, 'right'], [-1, 0, 'left']];
    const neg = vector => vector.map(value => -value);
    const variants = cells => {
      const result = [];
      for (let flip = 0; flip < 2; flip++) for (let turn = 0; turn < 4; turn++) {
        let transformed = cells.map(([x, y]) => [flip ? -x : x, y]);
        for (let i = 0; i < turn; i++) transformed = transformed.map(([x, y]) => [-y, x]);
        const minX = Math.min(...transformed.map(p => p[0]));
        const minY = Math.min(...transformed.map(p => p[1]));
        result.push(transformed.map(([x, y]) => [x - minX, y - minY])
          .sort((a, b) => a[1] - b[1] || a[0] - b[0]));
      }
      return result;
    };
    const canonical = cells => variants(cells).map(c => JSON.stringify(c)).sort()[0];
    let shapes = new Map([['[[0,0]]', [[0, 0]]]]);
    for (let size = 2; size <= 6; size++) {
      const next = new Map();
      shapes.forEach(cells => cells.forEach(([x, y]) => directions.forEach(([dx, dy]) => {
        if (cells.some(([cx, cy]) => cx === x + dx && cy === y + dy)) return;
        const key = canonical([...cells, [x + dx, y + dy]]);
        next.set(key, JSON.parse(key));
      })));
      shapes = next;
    }
    const groups = { '141': [], '231': [], '222': [], '33': [] };
    shapes.forEach(cells => {
      // Choose a horizontal strip presentation matching the school classification.
      let chosen = null, category = null;
      for (const candidate of variants(cells)) {
        const counts = [];
        candidate.forEach(([, y]) => { counts[y] = (counts[y] || 0) + 1; });
        const signature = [...counts].sort((a, b) => a - b).join(',');
        const type = { '1,1,4': '141', '1,2,3': '231', '2,2,2': '222', '3,3': '33' }[signature];
        if (type) { chosen = candidate; category = type; break; }
      }
      if (!chosen) return;
      const root = chosen[0];
      const visited = new Map();
      const queue = [{ x: root[0], y: root[1], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], parent: null }];
      const layout = [];
      const faceNames = { '0,0,1': 'bottom', '0,0,-1': 'top', '0,-1,0': 'back', '0,1,0': 'front', '-1,0,0': 'right', '1,0,0': 'left' };
      while (queue.length) {
        const item = queue.shift(), key = `${item.x},${item.y}`;
        if (visited.has(key)) continue;
        visited.set(key, item);
        item.face = faceNames[item.n.join(',')];
        layout.push({ ...item, parent: item.parent });
        directions.forEach(([dx, dy, edge]) => {
          const x = item.x + dx, y = item.y + dy;
          if (!chosen.some(([cx, cy]) => cx === x && cy === y) || visited.has(`${x},${y}`)) return;
          let u = item.u, v = item.v, n;
          if (edge === 'top') { v = item.n; n = neg(item.v); }
          if (edge === 'bottom') { v = neg(item.n); n = item.v; }
          if (edge === 'right') { u = item.n; n = neg(item.u); }
          if (edge === 'left') { u = neg(item.n); n = item.u; }
          queue.push({ x, y, u, v, n, parent: item.face, edge });
        });
      }
      // A net's face adjacency is a tree; cycles and repeated normals cannot fold to a cube.
      const adjacencyCount = chosen.reduce((total, [x, y]) => total + directions.filter(([dx, dy]) =>
        chosen.some(([cx, cy]) => cx === x + dx && cy === y + dy)).length, 0) / 2;
      if (adjacencyCount !== 5 || new Set(layout.map(item => item.face)).size !== 6) return;
      groups[category].push(layout);
    });
    const patterns = {};
    Object.entries(groups).forEach(([category, layouts]) => layouts.forEach((layout, index) => {
      patterns[`${category}-${index + 1}`] = { name: `${category} 型 ${index + 1}`, layout };
    }));
    return patterns;
  }
};
