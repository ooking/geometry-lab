/** Bootstrap standalone application pages without constructing any general lab. */
document.addEventListener('DOMContentLoaded', () => {
  const workspace = document.querySelector('.tab-panel.active');
  const name = workspace.id.replace(/^panel-/, '');
  TeachingApplications.mount();
  TeachingApplications.setWorkspace(name);
  document.addEventListener('visibilitychange', () => TeachingApplications.setWorkspace(name));
  const header = document.querySelector('.header-bar');
  const updateHeaderHeight = () => document.documentElement.style.setProperty('--app-header-height', `${header.getBoundingClientRect().height}px`);
  new ResizeObserver(updateHeaderHeight).observe(header); updateHeaderHeight();
  const fullscreen = document.getElementById('btn-fullscreen');
  if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (error) { fullscreen.textContent = '全屏不可用，请重试'; console.warn('全屏请求失败', error); }
  });
  document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '⛶ 退出全屏' : '⛶ 全屏演示'; });
});
