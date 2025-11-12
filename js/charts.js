window.CM = window.CM || {};

CM.Charts = (() => {
  function line(ctx, labels, sales, profits) {
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Sales', data: sales, tension: .3 },
          { label: 'Profit', data: profits, tension: .3 },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { x: { grid: { display:false } }, y: { beginAtZero:true } }
      }
    });
  }
  return { line };
})();
