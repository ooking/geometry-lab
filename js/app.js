/** Navigation and lazy initialization for the teaching workspaces. */
document.addEventListener('DOMContentLoaded', () => {
  const labs = new Map();
  window.TeachingApplications?.mount();
  const constructors = { unfold: 'UnfoldLab', views: 'ViewsLab', section: 'SectionLab' };
  const tabs = [...document.querySelectorAll('.tab-btn')];
  const panels = [...document.querySelectorAll('.tab-panel')];
  let activeName = null;

  const header = document.querySelector('.header-bar');
  let layoutFrame = null;
  function updateStageLayout() {
    const headerHeight = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--app-header-height', `${headerHeight}px`);
    const panel = document.getElementById(`panel-${activeName}`);
    const stage = panel?.querySelector('.stage-card');
    if (!stage) return;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const chromeHeight = [...stage.children].filter(child => !child.classList.contains('stage-canvas-container'))
      .reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
    const desktop = window.matchMedia('(min-width: 1201px)').matches;
    const available = desktop
      ? viewportHeight - Math.max(stage.getBoundingClientRect().top, headerHeight + 12) - 16
      : viewportHeight * 0.55 + chromeHeight;
    const height = Math.round(Math.max(chromeHeight + 200, desktop ? available : Math.min(available, chromeHeight + 560)));
    if (stage.style.height !== `${height}px`) stage.style.height = `${height}px`;
  }
  function scheduleStageLayout() {
    if (layoutFrame !== null) return;
    layoutFrame = requestAnimationFrame(() => { layoutFrame = null; updateStageLayout(); });
  }
  const layoutObserver = new ResizeObserver(scheduleStageLayout);
  layoutObserver.observe(header);
  document.querySelectorAll('.stage-header, .views-observe-toolbar, .lesson-prompt').forEach(element => layoutObserver.observe(element));
  window.addEventListener('resize', scheduleStageLayout);
  window.addEventListener('scroll', scheduleStageLayout, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleStageLayout);

  function activate(name, focus = false) {
    if (!constructors[name]) return;
    activeName = name;
    tabs.forEach(tab => {
      const active = tab.dataset.target === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    panels.forEach(panel => panel.classList.toggle('active', panel.id === `panel-${name}`));
    labs.forEach(lab => lab.setActive(false));
    window.TeachingApplications?.setWorkspace(name);
    // Wait for the visible panel's layout, and disregard superseded navigation.
    requestAnimationFrame(() => {
      if (activeName !== name) return;
      updateStageLayout();
      if (!labs.has(name)) {
        const container = document.getElementById(`canvas-${name}-container`);
        try {
          if (!window.THREE || !window[constructors[name]]) throw new Error('绘图组件未加载');
          labs.set(name, new window[constructors[name]]());
        } catch (error) {
          console.error('工作区初始化失败', error);
          container.querySelectorAll('canvas, .viewport-error').forEach(element => element.remove());
          const message = document.createElement('p');
          message.className = 'viewport-error';
          message.setAttribute('role', 'alert');
          message.textContent = '暂时无法显示立体图形。请确认浏览器已开启硬件加速，并刷新页面重试。';
          container.appendChild(message);
          return;
        }
      }
      labs.get(name).setActive(true);
    });
  }

  document.querySelector('.nav-tabs')?.setAttribute('role', 'tablist');
  tabs.forEach((tab, index) => {
    tab.id = `tab-${tab.dataset.target}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `panel-${tab.dataset.target}`);
    const panel = document.getElementById(`panel-${tab.dataset.target}`);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => activate(tab.dataset.target));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        activate(tabs[target].dataset.target, true);
      }
    });
  });

  document.addEventListener('visibilitychange', () => {
    labs.forEach((lab, name) => lab.setActive(name === activeName));
    window.TeachingApplications?.setWorkspace(activeName);
  });

  const fullscreen = document.getElementById('btn-fullscreen');
  if (fullscreen) {
    if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
    fullscreen.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (error) {
        fullscreen.textContent = '全屏不可用，请重试';
        console.warn('全屏请求失败', error);
      }
    });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.textContent = document.fullscreenElement ? '⛶ 退出全屏' : '⛶ 全屏演示';
      updateStageLayout();
      labs.get(activeName)?.resize();
    });
  }
  activate(tabs.find(tab => tab.classList.contains('active'))?.dataset.target || 'unfold');
});
