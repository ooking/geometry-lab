/** Packaging lesson configuration stays separate from reusable geometry and panel lifecycle. */
window.PackagingConfig = Object.freeze({
  dimensions: [5, 3, 4],
  steps: [
    { id: 'single', title: '上盖与纸板用料' },
    { id: 'compare', title: '两盒拼装对比' },
    { id: 'perimeter', title: '展开图周长' }
  ],
  methods: [
    { axis: 1, title: '沿宽拼接' },
    { axis: 0, title: '沿长拼接' },
    { axis: 2, title: '沿高叠放' }
  ]
});

class PackagingApplication {
  constructor(host) {
    this.host = host; this.dims = [...PackagingConfig.dimensions]; this.step = 'single';
    this.method = 1; this.netChoice = 'standard'; this.unit = 'cm'; this.lidLayers = 2;
    this.progress = 1; this.answers = false; this.active = false;
    this.number = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 10, useGrouping: false });
    this.build(); this.render();
  }
  $(selector) { return this.host.querySelector(selector); }
  build() {
    const content = document.createElement('div'); content.className = 'packaging-content';
    content.innerHTML = `
      <p class="learning-note">设置长方体尺寸，观察上盖层数、拼装方向和展开方式怎样影响纸板用料与外周长。</p>
      <div class="btn-group" data-role="steps" aria-label="选择讲解内容"></div>
      <div class="packaging-grid">
        <div class="packaging-visuals">
          <div class="packaging-viewport" data-role="viewport"><span class="packaging-view-tip">拖动旋转 · 滚轮缩放 · 蓝线表示两盒分界</span></div>
          <label class="packaging-progress">展开 ← <input data-role="progress" type="range" min="0" max="100" value="100" aria-label="包装盒整体折叠进度"> → 闭合</label>
          <p class="learning-note">整体折叠用于观察面与面的连接，中途可能相交。立体展示六面外壳；双层上盖通过右侧面积计算说明。</p>
          <div class="packaging-net" data-role="net"></div>
          <p class="learning-note" data-role="net-caption"></p>
        </div>
        <div class="packaging-controls">
          <div class="dimension-inputs-row">
            <div class="dim-input-box"><label>长<input data-dimension="0" type="number" min="0.5" max="100" step="any" value="5"></label></div>
            <div class="dim-input-box"><label>宽<input data-dimension="1" type="number" min="0.5" max="100" step="any" value="3"></label></div>
            <div class="dim-input-box"><label>高<input data-dimension="2" type="number" min="0.5" max="100" step="any" value="4"></label></div>
          </div>
          <div class="packaging-options">
            <label>单位 <select data-role="unit"><option value="cm">厘米</option><option value="dm">分米</option><option value="m">米</option></select></label>
            <label data-role="lid-option">上盖 <select data-role="lid"><option value="2">双层</option><option value="1">单层</option></select></label>
            <button type="button" class="btn-outline" data-role="reset">恢复默认参数</button>
          </div>
          <p class="learning-note" data-role="input-note"></p>
          <div class="btn-group" data-role="methods" aria-label="选择两盒拼接方向"></div>
          <div class="btn-group" data-role="net-choices" aria-label="选择周长展开图">
            <button type="button" class="btn-outline" data-net="standard">常规展开图</button>
            <button type="button" class="btn-outline" data-net="maximum">最大周长示例</button>
          </div>
          <label class="views-check"><input data-role="answers" type="checkbox">显示计算过程与答案</label>
          <p class="status-banner info" data-role="prompt" aria-live="polite"></p>
          <div data-role="solution" hidden>
            <div class="measure-formula" data-role="formula"></div>
            <div class="measure-result" data-role="result" aria-live="polite"></div>
          </div>
          <div class="comparison-table-wrap" data-role="comparison"></div>
          <p class="measure-scaling" data-role="explanation"></p>
        </div>
      </div>`;
    this.host.append(content);
    PackagingConfig.steps.forEach(step => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-outline'; button.textContent = step.title; button.dataset.step = step.id;
      button.addEventListener('click', () => { this.step = step.id; this.progress = step.id === 'perimeter' ? 0 : 1; this.render(); });
      this.$('[data-role="steps"]').append(button);
    });
    PackagingConfig.methods.forEach(method => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-outline'; button.textContent = method.title; button.dataset.axis = method.axis;
      button.addEventListener('click', () => { this.method = method.axis; this.render(); });
      this.$('[data-role="methods"]').append(button);
    });
    this.host.querySelectorAll('[data-dimension]').forEach(input => input.addEventListener('input', () => {
      const inputs = [...this.host.querySelectorAll('[data-dimension]')];
      if (!inputs.every(i => i.validity.valid && Number.isFinite(i.valueAsNumber))) return;
      this.dims = inputs.map(i => i.valueAsNumber); this.render();
    }));
    this.$('[data-role="unit"]').addEventListener('change', e => { this.unit = e.target.value; this.render(); });
    this.$('[data-role="lid"]').addEventListener('change', e => { this.lidLayers = Number(e.target.value); this.render(); });
    this.$('[data-role="answers"]').addEventListener('change', e => { this.answers = e.target.checked; this.render(); });
    this.$('[data-role="reset"]').addEventListener('click', () => {
      this.dims = [...PackagingConfig.dimensions]; this.lidLayers = 2;
      this.unit = 'cm';
      this.host.querySelectorAll('[data-dimension]').forEach((input, i) => { input.value = this.dims[i]; }); this.render();
    });
    this.host.querySelectorAll('[data-net]').forEach(button => button.addEventListener('click', () => { this.netChoice = button.dataset.net; this.render(); }));
    this.$('[data-role="progress"]').addEventListener('input', e => { this.progress = Number(e.target.value) / 100; this.drawSolid(); });
  }
  setActive(active) {
    this.active = active;
    if (active && !this.view && !this.viewFailed) {
      try { this.view = new CuboidTeachingView(this.$('[data-role="viewport"]')); this.drawSolid(); }
      catch (error) {
        this.viewFailed = true; this.$('[data-role="viewport"]').querySelectorAll('canvas').forEach(canvas => canvas.remove());
        const message = document.createElement('p'); message.className = 'viewport-error'; message.textContent = '立体视图暂不可用，仍可使用展开图和计算讲解。'; this.$('[data-role="viewport"]').append(message);
        console.warn('包装盒立体视图初始化失败', error);
      }
    }
    this.view?.setActive(active);
  }
  drawSolid() { this.view?.show(this.currentNet, this.progress, this.step === 'compare' ? this.method : null, this.currentDims); }
  render() {
    const f = v => this.number.format(v), [l, w, h] = this.dims, unit = this.unit;
    const compare = this.step === 'compare', perimeter = this.step === 'perimeter';
    this.currentDims = this.dims.map((v, i) => compare && i === this.method ? v * 2 : v);
    this.currentNet = perimeter ? TeachingCuboid.stripNet(this.netChoice === 'standard' ? [l, h, w] : [...this.dims].sort((a, b) => a - b)) : TeachingCuboid.boxNet(this.currentDims);
    this.$('[data-role="unit"]').value = unit; this.$('[data-role="lid"]').value = this.lidLayers;
    this.$('[data-role="progress"]').value = this.progress * 100;
    this.$('[data-role="methods"]').hidden = !compare; this.$('[data-role="net-choices"]').hidden = !perimeter;
    this.$('[data-role="lid-option"]').hidden = perimeter; this.$('[data-role="solution"]').hidden = !this.answers;
    this.host.querySelectorAll('[data-step], [data-axis], [data-net]').forEach(button => {
      const active = button.dataset.step ? button.dataset.step === this.step : button.dataset.axis !== undefined ? Number(button.dataset.axis) === this.method : button.dataset.net === this.netChoice;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
    });
    this.$('[data-role="input-note"]').textContent = '切换讲解内容保留尺寸和单位；切换单位不换算数值。长×宽固定为包装底面，旋转视角不改变上盖用料。';
    TeachingCuboid.drawNet(this.$('[data-role="net"]'), this.currentNet, unit, !perimeter && this.lidLayers === 2);
    this.$('[data-role="net-caption"]').textContent = perimeter ? '黄色实线是外边界，深色虚线是内部折痕。各矩形标注边长，单位同上。' : '六面展开图：浅黄色“上盖 × 2”表示上盖用料计两份，额外一层未作为第七个面加入折叠。';
    if (!perimeter && this.lidLayers === 1) this.$('[data-role="net-caption"]').textContent = '六面展开图：上盖按一层计算，各矩形标注边长，单位同上。';
    this.$('[data-role="prompt"]').textContent = perimeter ? '先观察：哪些边留在外侧？哪种展开方式的内部折痕更短？' : compare ? `当前外盒 ${this.currentDims.map(f).join(' × ')} ${unit}。体积只变为原盒的2倍，哪种拼法最省纸板？` : this.lidLayers === 2 ? '先算六个面的面积。双层上盖还需要多算哪一个面的面积？' : '上盖只有一层时，纸板面积与六面表面积有什么关系？';
    const formula = this.$('[data-role="formula"]'), result = this.$('[data-role="result"]');
    if (perimeter) {
      const net = this.currentNet;
      formula.textContent = `① 六个面的周长总和：8 × (${f(l)} + ${f(w)} + ${f(h)}) = ${f(net.total)} ${unit}\n② 五条内部折痕：${net.hinges.map(s => f(s.length)).join(' + ')} = ${f(net.seam)} ${unit}\n③ 外周长 = 六面周长总和 − 2 × 内部折痕总长\n= ${f(net.total)} − 2 × ${f(net.seam)} = ${f(net.perimeter)} ${unit}`;
      result.textContent = `展开图周长：${f(net.perimeter)} ${unit}`;
      this.$('[data-role="explanation"]').textContent = '为什么是最大值？设三种棱长 a ≤ b ≤ c。长度为 a 的折痕只连接四个面；四条全保留会形成环，不能展开为一张平面纸，所以最多保留三条。其余两条至少为 b，折痕总长至少 3a + 2b。本示例恰好达到这个下限。这里研究六面表面的展开图，不计额外上盖。';
    } else {
      const [a, b, c] = this.currentDims, m = TeachingCuboid.measures(this.currentDims, this.lidLayers);
      formula.textContent = `① 六面表面积：2 × (${f(a)} × ${f(b)} + ${f(a)} × ${f(c)} + ${f(b)} × ${f(c)}) = ${f(m.surface)} ${unit}²\n② ${this.lidLayers === 2 ? `额外上盖：${f(a)} × ${f(b)} = ${f(m.extra)}` : '单层上盖：额外面积为 0'} ${unit}²\n③ 纸板面积：${f(m.surface)} + ${f(m.extra)} = ${f(m.paper)} ${unit}²`;
      result.textContent = `所需纸板：${f(m.paper)} ${unit}²`;
      this.$('[data-role="explanation"]').textContent = compare ? '两盒拼装只把一个方向的长度变为2倍，并不是长、宽、高一起翻倍。比较时还要计算额外上盖，不能只比较六面表面积。' : `${this.lidLayers === 2 ? '双层上盖纸板面积 = 六面表面积 + 长×宽。' : '单层上盖纸板面积 = 六面表面积。'}按理想化模型计算，不另计粘贴边和裁剪损耗。`;
    }
    this.renderComparison(compare, f, unit);
    this.drawSolid();
  }
  renderComparison(visible, f, unit) {
    const host = this.$('[data-role="comparison"]'); host.hidden = !visible; host.replaceChildren(); if (!visible) return;
    const rows = PackagingConfig.methods.map(method => {
      const dims = this.dims.map((v, i) => i === method.axis ? v * 2 : v);
      return { ...method, dims, ...TeachingCuboid.measures(dims, this.lidLayers) };
    });
    const best = Math.min(...rows.map(r => r.paper));
    const table = document.createElement('table'); table.className = 'comparison-table';
    const caption = document.createElement('caption'); caption.textContent = `三种包装用料对比（面积单位 ${unit}²）`; table.append(caption);
    const head = document.createElement('thead'), tr = document.createElement('tr');
    ['拼法', '外盒尺寸', '六面', '额外盖', '纸板'].forEach(title => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = title; tr.append(th); }); head.append(tr); table.append(head);
    const body = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr'); if (this.answers && row.paper === best) tr.className = 'highlight-best';
      [row.title + (this.answers && row.paper === best ? '（最省）' : ''), row.dims.map(f).join('×'), ...[row.surface, row.extra, row.paper].map(v => this.answers ? f(v) : '？')].forEach(value => { const td = document.createElement('td'); td.textContent = value; tr.append(td); }); body.append(tr);
    }); table.append(body); host.append(table);
  }
}
TeachingApplications.register('packaging', host => new PackagingApplication(host));
