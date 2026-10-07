/** Navigation and lazy initialization for the teaching workspaces. */
document.addEventListener('DOMContentLoaded', () => {
  const labs = new Map();
  const constructors = { unfold: 'UnfoldLab', views: 'ViewsLab', section: 'SectionLab' };
  const tabs = [...document.querySelectorAll('.tab-btn')];
  const panels = [...document.querySelectorAll('.tab-panel')];
  let activeName = null;

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
    // Wait for the visible panel's layout, and disregard superseded navigation.
    requestAnimationFrame(() => {
      if (activeName !== name) return;
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
      labs.get(activeName)?.resize();
    });
  }
  activate(tabs.find(tab => tab.classList.contains('active'))?.dataset.target || 'unfold');
});
