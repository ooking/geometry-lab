/**
 * ===================================================================
 * 几何空间探索实验室 (MathSpace 3D Geometric Lab)
 * 全局主控制器与导航管理器 (app.js)
 * ===================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // 检查并初始化各模块
  let unfoldLab = null;
  let viewsLab = null;
  let sectionLab = null;
  let packingLab = null;

  // 初始化第一个激活的模块
  const initActiveModule = (tabName) => {
    setTimeout(() => {
      if (tabName === 'unfold') {
        if (!unfoldLab && window.UnfoldLab) {
          unfoldLab = new window.UnfoldLab();
        } else if (unfoldLab && unfoldLab.renderer) {
          resizeLab(unfoldLab);
        }
      } else if (tabName === 'views') {
        if (!viewsLab && window.ViewsLab) {
          viewsLab = new window.ViewsLab();
        } else if (viewsLab && viewsLab.renderer) {
          resizeLab(viewsLab);
        }
      } else if (tabName === 'section') {
        if (!sectionLab && window.SectionLab) {
          sectionLab = new window.SectionLab();
        } else if (sectionLab && sectionLab.renderer) {
          resizeLab(sectionLab);
        }
      } else if (tabName === 'packing') {
        if (!packingLab && window.PackingLab) {
          packingLab = new window.PackingLab();
        } else if (packingLab && packingLab.renderer) {
          resizeLab(packingLab);
        }
      }
    }, 50);
  };

  const resizeLab = (labInstance) => {
    if (!labInstance || !labInstance.container || !labInstance.renderer) return;
    const w = labInstance.container.clientWidth;
    const h = labInstance.container.clientHeight;
    if (w > 0 && h > 0) {
      labInstance.camera.aspect = w / h;
      labInstance.camera.updateProjectionMatrix();
      labInstance.renderer.setSize(w, h);
    }
  };

  // 导航 Tab 切换
  const navTabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;

      navTabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const activePanel = document.getElementById(`panel-${target}`);
      if (activePanel) {
        activePanel.classList.add('active');
        initActiveModule(target);
      }
    });
  });

  // 知识库折叠抽屉
  const drawers = document.querySelectorAll('.knowledge-drawer');
  drawers.forEach(drawer => {
    const header = drawer.querySelector('.knowledge-header');
    const body = drawer.querySelector('.knowledge-body');
    if (header && body) {
      header.addEventListener('click', () => {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        const arrow = header.querySelector('.drawer-arrow');
        if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
      });
    }
  });

  // 全屏演示按钮
  const btnFullscreen = document.getElementById('btn-fullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('全屏请求失败:', err);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }

  // 默认启动第一个模块
  initActiveModule('unfold');
});
