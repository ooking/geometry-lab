/** Shared second-level menus for standalone teaching pages. */
document.addEventListener('DOMContentLoaded', () => {
  const menus = [...document.querySelectorAll('.nav-submenu')];
  document.addEventListener('click', event => { menus.forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    menus.forEach(menu => { if (menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  });
});
