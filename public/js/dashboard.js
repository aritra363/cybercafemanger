CM.Views.Dashboard.render = async function() {
  const root = document.getElementById('view');
  const rangeBtns = ['today','week','month','year','custom'];
  const current = CM.State.filters.dashboard.range;

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Dashboard</h1>
        <div class="flex flex-wrap gap-2">
          ${rangeBtns.map(r=>`<button class="btn btn-soft ${current===r?'ring-2 ring-[var(--primary)]':''}" data-range="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
          <input type="date" id="fromDate" class="input w-40 hidden"/>
          <input type="date" id="toDate" class="input w-40 hidden"/>
          <button id="btnExport" class="btn btn-primary"><i data-lucide="download"></i>Export XLSX</button>
        </div>
      </div>

      <div class="grid md:grid-cols-4 gap-4">
        <div class="card p-4" id="kpiSales"></div>
        <div class="card p-4" id="kpiGross"></div>
        <div class="card p-4" id="kpiExpenses"></div>
        <div class="card p-4" id="kpiNet"></div>
      </div>

      <div class="card p-4">
        <h3 class="font-semibold mb-3">Sales & Profit</h3>
        <canvas id="salesChart" height="120"></canvas>
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div class="card p-4">
          <div class="flex items-center justify-between mb-2"><h3 class="font-semibold">Recent Sales</h3></div>
          <div class="overflow-auto">
            <table class="table w-full">
              <thead><tr><th>Date</th><th>Items/Services</th><th>Total</th></tr></thead>
              <tbody id="recentSalesBody"></tbody>
            </table>
          </div>
        </div>
        <div class="card p-4">
          <div class="flex items-center justify-between mb-2"><h3 class="font-semibold">Low Stock Alerts</h3></div>
          <ul id="lowStockList" class="space-y-2"></ul>
        </div>
      </div>
    </div>`;

  lucide.createIcons();

  const applyRangeUI = () => {
    const range = CM.State.filters.dashboard.range;
    const showCustom = range==='custom';
    document.getElementById('fromDate').classList.toggle('hidden', !showCustom);
    document.getElementById('toDate').classList.toggle('hidden', !showCustom);
  };
  applyRangeUI();

  root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', async () => {
    CM.State.filters.dashboard.range = b.dataset.range; applyRangeUI();
    await refresh();
  }));

  document.getElementById('fromDate').addEventListener('change', refresh);
  document.getElementById('toDate').addEventListener('change', refresh);

  document.getElementById('btnExport').addEventListener('click', () => {
    CM.exporter.toXlsx(`dashboard_${Date.now()}.xlsx`, dashboardExportRows);
  });

  let dashboardExportRows = [];
  let chart;

  async function refresh(){
    // Determine date range
    let start, end; const rng = CM.State.filters.dashboard.range;
    if (rng==='today') [start,end] = CM.utils.todayRange();
    else if (rng==='week') [start,end] = CM.utils.weekRange();
    else if (rng==='month') [start,end] = CM.utils.monthRange();
    else if (rng==='year') [start,end] = CM.utils.yearRange();
    else if (rng==='custom') { start = new Date(document.getElementById('fromDate').value); end = new Date(document.getElementById('toDate').value); if (!start || !end) return; }

    // Fetch data
    const [sales, expenses, inventory] = await Promise.all([
      CM.DB.listSales({ start, end }),
      CM.DB.listExpenses({ start, end }),
      CM.DB.listInventory(),
    ]);

    // KPIs
    const totalSales = sales.reduce((s,x)=>s+(x.totalAmount||0),0);
    const cogs = sales.reduce((s,x)=>s+(x.totalCost||0),0);
    const gross = totalSales - cogs;
    const exp = expenses.reduce((s,x)=>s+(x.amount||0),0);
    const net = gross - exp;

    document.getElementById('kpiSales').innerHTML = `<div class="text-sm text-[var(--muted-foreground)]">Total Sales</div><div class="text-2xl font-semibold">${CM.utils.fmtINR(totalSales)}</div>`;
    document.getElementById('kpiGross').innerHTML = `<div class="text-sm text-[var(--muted-foreground)]">Gross Profit</div><div class="text-2xl font-semibold">${CM.utils.fmtINR(gross)}</div>`;
    document.getElementById('kpiExpenses').innerHTML = `<div class="text-sm text-[var(--muted-foreground)]">Expenses</div><div class="text-2xl font-semibold">${CM.utils.fmtINR(exp)}</div>`;
    document.getElementById('kpiNet').innerHTML = `<div class="text-sm text-[var(--muted-foreground)]">Net Profit</div><div class="text-2xl font-semibold ${net>=0?'text-[var(--success)]':'text-[var(--danger)]'}">${CM.utils.fmtINR(net)}</div>`;

    // Recent sales
    const body = document.getElementById('recentSalesBody');
    body.innerHTML = '';
    sales.slice(0,5).forEach(s => {
      const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      const items = (s.items||[]).map(i=>i.name).join(', ');
      body.appendChild(CM.utils.el(`<tr class="hover-row"><td>${date.toLocaleString()}</td><td>${items}</td><td>${CM.utils.fmtINR(s.totalAmount)}</td></tr>`));
    });

    // Low stock
    const low = inventory.filter(i => (i.stock||0) < 10);
    const list = document.getElementById('lowStockList');
    list.innerHTML = low.length? '' : '<div class="text-sm text-[var(--muted-foreground)]">No low stock.</div>';
    low.forEach(i => list.appendChild(CM.utils.el(`<li class="flex justify-between items-center p-2 border rounded-md border-[var(--border)]"><div>${i.name}</div><span class="badge badge-low">${i.stock} left</span></li>`)));

    // Chart (group by day)
    const byDay = {};
    sales.forEach(s => { const d = (s.date?.toDate? s.date.toDate(): new Date(s.date)); const k = d.toISOString().slice(0,10); if (!byDay[k]) byDay[k] = { sales:0, profit:0 }; byDay[k].sales += s.totalAmount||0; byDay[k].profit += (s.totalAmount||0)-(s.totalCost||0); });
    const labels = Object.keys(byDay).sort();
    const salesArr = labels.map(k => byDay[k].sales);
    const profitArr = labels.map(k => byDay[k].profit);

    const ctx = document.getElementById('salesChart');
    if (chart) chart.destroy();
    chart = CM.Charts.line(ctx, labels, salesArr, profitArr);

    // Export rows
    dashboardExportRows = sales.map(s => ({
      Date: (s.date?.toDate? s.date.toDate(): new Date(s.date)).toLocaleString(),
      Total: s.totalAmount,
      COGS: s.totalCost,
      Profit: (s.totalAmount||0)-(s.totalCost||0),
      Items: (s.items||[]).map(i=>`${i.name} x${i.quantity} @ ${i.price}`).join('; ')
    }));
  }

  await refresh();
};
