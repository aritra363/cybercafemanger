window.CM = window.CM || {};

CM.State = {
  route: 'dashboard',
  theme: localStorage.getItem('cm:theme') || 'ocean-light',
  filters: {
    dashboard: { range: 'today', custom: null },
    sales:     { range: 'today', custom: null },
    expenses:  { range: 'today', custom: null }
  },
  cart: { items: [] },
};

// Apply theme on load
document.documentElement.setAttribute('data-theme', CM.State.theme);
