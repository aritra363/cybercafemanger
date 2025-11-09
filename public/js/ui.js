window.CM = window.CM || {};

CM.UI = (() => {
  const view = () => document.getElementById('view');

  function initNav() {
    const links = document.querySelectorAll('.navlink');
    links.forEach(btn => btn.addEventListener('click', () => {
      const r = btn.getAttribute('data-route');
      CM.Router.go(r);
      if (window.innerWidth < 768) toggleSidebar(false);
    }));
  }

  function initMobileHeader() {
    const btn = document.getElementById('btnMobileNav');
    if (!btn) return;
    btn.addEventListener('click', () => toggleSidebar());
  }

  function toggleSidebar(force) {
    const sb = document.getElementById('sidebar');
    const hidden = sb.classList.contains('-translate-x-full');
    const show = (force===undefined) ? hidden : !force;
    sb.classList.toggle('-translate-x-full', show);
  }

  function setActive(route) {
    document.querySelectorAll('.navlink').forEach(b => {
      const active = b.getAttribute('data-route') === route;
      b.classList.toggle('bg-[var(--muted)]', active);
      b.classList.toggle('text-[var(--primary)]', active);
    });
  }

  function initThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.addEventListener('click', () => {
        const t = b.dataset.theme; CM.State.theme = t;
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('cm:theme', t);
      });
    });
  }

  function toast(msg, type='info') {
    const root = document.getElementById('toast-root');
    const el = CM.utils.el(`<div class="px-3 py-2 rounded-lg shadow-md text-sm ${type==='error'?'bg-red-600 text-white':'bg-[var(--card)] border'}">${msg}</div>`);
    root.appendChild(el);
    setTimeout(() => root.removeChild(el), 3000);
  }

  // Simple router
  CM.Router = {
    go(route) {
      CM.State.route = route; setActive(route);
      if (route === 'dashboard') CM.Views.Dashboard.render();
      if (route === 'pos') CM.Views.POS.render();
      if (route === 'inventory') CM.Views.Inventory.render();
      if (route === 'sales') CM.Views.Sales.render();
      if (route === 'expenses') CM.Views.Expenses.render();
      lucide.createIcons();
    }
  };

  function init() { initNav(); initMobileHeader(); initThemeButtons(); }

  return { init, toast };
})();

window.CM.Views = { Dashboard:{}, POS:{}, Inventory:{}, Sales:{}, Expenses:{} };
