window.CM = window.CM || {};

CM.State = {
  route: 'dashboard',
  theme: localStorage.getItem('cm:theme') || 'ocean-light',
  filters: {
    dashboard: { range: 'month', custom: null },
    sales:     { range: 'month', custom: null },
    expenses:  { range: 'month', custom: null }
  },
  cart: { items: [] },
};

// Apply theme on load
document.documentElement.setAttribute('data-theme', CM.State.theme);
