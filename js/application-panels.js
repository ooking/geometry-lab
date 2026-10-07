/** Independent teaching applications: factories receive only their own host. */
window.TeachingApplications = (() => {
  const factories = new Map(), instances = new Map();
  let activeWorkspace = null;
  function sync(host, record) {
    const active = host.closest('.tab-panel')?.id === `panel-${activeWorkspace}` && (host.tagName !== 'DETAILS' || host.open) && !document.hidden;
    if (active && !record.instance) record.instance = factories.get(host.dataset.teachingApplication)(host);
    record.instance?.setActive(active);
  }
  return {
    register(name, factory) {
      if (factories.has(name)) throw new Error(`应用面板已注册：${name}`);
      factories.set(name, factory);
    },
    mount() {
      document.querySelectorAll('[data-teaching-application]').forEach(host => {
        if (instances.has(host) || !factories.has(host.dataset.teachingApplication)) return;
        const record = { instance: null }; instances.set(host, record);
        host.addEventListener('toggle', () => sync(host, record));
      });
    },
    setWorkspace(name) {
      activeWorkspace = name;
      instances.forEach((record, host) => sync(host, record));
    }
  };
})();
