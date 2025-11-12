CM.Views.Sales.render = async function() {
  const root = document.getElementById('view');
  const ranges = ['today','week','month','year','all','custom'];
  const state = CM.State.filters.sales;

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Sales History</h1>
        <div class="flex flex-wrap gap-2">
          ${ranges.map(r=>`<button class="btn btn-soft ${state.range===r?'ring-2 ring-[var(--primary)]':''}" data-range="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
          <input type="date" id="fromDate" class="input w-40 hidden"/>
          <input type="date" id="toDate" class="input w-40 hidden"/>
          <button id="btnExport" class="btn btn-primary"><i data-lucide="download"></i>Export XLSX</button>
        </div>
      </div>

      <div class="card p-3 overflow-auto">
        <table class="table w-full min-w-[760px]">
          <thead><tr><th>Date</th><th>Items/Services</th><th>Total</th></tr></thead>
          <tbody id="salesBody"></tbody>
        </table>
      </div>
    </div>`;

  lucide.createIcons();

  const applyRangeUI = () => {
    const show = state.range==='custom';
    document.getElementById('fromDate').classList.toggle('hidden', !show);
    document.getElementById('toDate').classList.toggle('hidden', !show);
    
    // Update button styling
    root.querySelectorAll('[data-range]').forEach(b => {
      const isActive = b.dataset.range === state.range;
      b.classList.toggle('ring-2', isActive);
      b.classList.toggle('ring-[var(--primary)]', isActive);
    });
  };
  applyRangeUI();

  root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', async ()=>{
    state.range = b.dataset.range;
    applyRangeUI();
    await refresh();
  }));
  document.getElementById('fromDate').addEventListener('change', refresh);
  document.getElementById('toDate').addEventListener('change', refresh);

  let exportRows = [];

  async function refresh(){
    let start, end; const rng = state.range;
    if (rng==='today') [start,end] = CM.utils.todayRange();
    else if (rng==='week') [start,end] = CM.utils.weekRange();
    else if (rng==='month') [start,end] = CM.utils.monthRange();
    else if (rng==='year') [start,end] = CM.utils.yearRange();
    else if (rng==='custom') { start = new Date(document.getElementById('fromDate').value); end = new Date(document.getElementById('toDate').value); if (!start||!end) return; }

    const sales = await CM.DB.listSales(rng==='all'? null : { start, end });
    const body = document.getElementById('salesBody'); body.innerHTML='';
    sales.forEach(s => {
      const d = s.date?.toDate ? s.date.toDate(): new Date(s.date);
      const items = (s.items||[]).map(i=>`${i.name} x${i.quantity}`).join(', ');
      body.appendChild(CM.utils.el(`<tr class="hover-row"><td>${d.toLocaleString()}</td><td>${items}</td><td>${CM.utils.fmtINR(s.totalAmount)}</td></tr>`));
    });
    exportRows = sales.map(s=>({
      Date:(s.date?.toDate? s.date.toDate(): new Date(s.date)).toLocaleString(),
      Items:(s.items||[]).map(i=>`${i.name} x${i.quantity} @ ${i.price}`).join('; '),
      Total:s.totalAmount,
      COGS:s.totalCost,
      Profit:(s.totalAmount||0)-(s.totalCost||0)
    }));
  }

  await refresh();

  document.getElementById('btnExport').addEventListener('click', ()=> {
    try {
      CM.exporter.toXlsx('sales.xlsx', exportRows);
      CM.UI.toast('Sales data exported successfully', 'success', 'Export Complete');
    } catch (err) {
      CM.UI.toast('Failed to export sales data', 'error', 'Export Failed');
    }
  });
};
