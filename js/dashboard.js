CM.Views.Dashboard.render = async function() {
  const root = document.getElementById('view');
  const rangeBtns = ['today','week','month','year','custom'];
  const current = CM.State.filters.dashboard.range;

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Dashboard</h1>
        <div class="flex flex-wrap gap-2 items-center">
          ${rangeBtns.map(r=>`<button class="btn btn-soft ${current===r?'ring-2 ring-[var(--primary)]':''}" data-range="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
          <input type="date" id="fromDate" class="input w-40 hidden"/>
          <input type="date" id="toDate" class="input w-40 hidden"/>
          <div class="flex items-center gap-2">
            <label for="stockThreshold" class="text-sm font-medium">Stock Alert Below:</label>
            <input type="number" id="stockThreshold" class="input w-20" value="10" min="1"/>
            <span class="text-sm text-[var(--muted-foreground)]">units</span>
            <button id="btnUpdateThreshold" class="btn btn-soft text-xs"><i data-lucide="refresh-cw"></i>Update</button>
          </div>
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
        <div class="text-sm text-[var(--muted-foreground)]">Total Inventory Value Left</div>
        <div class="text-2xl font-semibold" id="totalInventoryValue">₹0.00</div>
      </div>

      <div class="card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 class="font-semibold">Sales & Profit</h3>
          <div id="chartGroupOptions" class="flex gap-2"></div>
        </div>
        <div style="height: 300px; position: relative;">
          <canvas id="salesChart"></canvas>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-semibold mb-3">Summary Metrics</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="summaryChart"></canvas>
        </div>
      </div>

      <div class="card p-4">
        <h3 class="font-semibold mb-3">Inventory Status</h3>
        <div style="height: 300px; position: relative;">
          <canvas id="inventoryChart"></canvas>
        </div>
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
    
    // Update button styling
    root.querySelectorAll('[data-range]').forEach(b => {
      const isActive = b.dataset.range === range;
      b.classList.toggle('ring-2', isActive);
      b.classList.toggle('ring-[var(--primary)]', isActive);
    });
  };
  applyRangeUI();

  root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', async () => {
    CM.State.filters.dashboard.range = b.dataset.range;
    applyRangeUI();
    await refresh();
  }));

  document.getElementById('fromDate').addEventListener('change', refresh);
  document.getElementById('toDate').addEventListener('change', refresh);

  // Load stock threshold from database
  const loadedThreshold = await CM.DB.getStockThreshold();
  const stockThresholdInput = document.getElementById('stockThreshold');
  if (stockThresholdInput) {
    stockThresholdInput.value = loadedThreshold;
  }

  document.getElementById('btnUpdateThreshold').addEventListener('click', async () => {
    const threshold = parseInt(document.getElementById('stockThreshold').value) || 10;
    if (threshold < 1) {
      CM.UI.toast('Stock threshold must be at least 1', 'error', 'Invalid Value');
      return;
    }
    try {
      await CM.DB.setStockThreshold(threshold);
      CM.UI.toast(`Stock alert threshold saved: ${threshold} units`, 'success', 'Saved');
      await refresh();
    } catch (err) {
      CM.UI.toast('Failed to save threshold to database', 'error', 'Error');
    }
  });

  document.getElementById('btnExport').addEventListener('click', async () => {
    try {
      const range = CM.State.filters.dashboard.range;
      
      // Determine date range based on selected range
      let start, end;
      if (range==='today') [start,end] = CM.utils.todayRange();
      else if (range==='week') [start,end] = CM.utils.weekRange();
      else if (range==='month') [start,end] = CM.utils.monthRange();
      else if (range==='year') [start,end] = CM.utils.yearRange();
      else if (range==='custom') { 
        const fromVal = document.getElementById('fromDate').value;
        const toVal = document.getElementById('toDate').value;
        if (!fromVal || !toVal) {
          CM.UI.toast('Please select both dates for custom range', 'error', 'Invalid Range');
          return;
        }
        start = new Date(fromVal + 'T00:00:00');
        end = new Date(toVal + 'T23:59:59');
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          CM.UI.toast('Invalid date range selected', 'error', 'Invalid Range');
          return;
        }
      }
      
      // Fetch fresh data for export
      const [sales, inventory, expenses] = await Promise.all([
        CM.DB.listSales({ start, end }),
        CM.DB.listInventory(),
        CM.DB.listExpenses({ start, end })
      ]);

      // Calculate summary metrics
      const totalSales = sales.reduce((s,x)=>s+(x.totalAmount||0),0);
      const cogs = sales.reduce((s,x)=>s+(x.totalCost||0),0);
      const gross = totalSales - cogs;
      const exp = expenses.reduce((s,x)=>s+(x.amount||0),0);
      const net = gross - exp;

      // Calculate inventory stats
      const totalStockValue = inventory.reduce((sum, i) => sum + ((i.stock || 0) * (i.purchasePrice || 0)), 0);
      let totalSoldValue = 0;
      sales.forEach(s => {
        (s.items || []).forEach(item => {
          totalSoldValue += (item.quantity || 0) * (item.purchasePrice || 0);
        });
      });

      // Prepare sales data for export
      const salesExportData = sales.slice(0, 10).map(s => {
        const date = s.date?.toDate ? s.date.toDate() : new Date(s.date);
        const items = (s.items||[]).map(i=>i.name).join(', ');
        return {
          Date: date.toLocaleString('en-IN'),
          Items: items,
          Total: s.totalAmount
        };
      });

      // Call new dashboard export function
      const summaryMetrics = {
        totalSales,
        cogs,
        expenses: exp,
        grossProfit: gross,
        netProfit: net
      };

      const inventoryStats = {
        totalStockValue,
        totalSoldValue
      };

      CM.exporter.dashboardToXlsx(salesExportData, summaryMetrics, inventoryStats);
      CM.UI.toast('Dashboard exported successfully', 'success', 'Export Complete');
    } catch (err) {
      console.error('Export error:', err);
      CM.UI.toast('Failed to export dashboard data', 'error', 'Export Failed');
    }
  });

  let dashboardExportRows = [];
  let chart, summaryChart, inventoryChart;
  let currentGroupBy = 'day';  // Default grouping
  let currentStart, currentEnd;  // Store current date range for chart updates

  // Determine grouping options based on date range
  function determineGrouping(start, end) {
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const rng = CM.State.filters.dashboard.range;
    
    if (rng === 'today') {
      return { options: ['hour'], default: 'hour', showButtons: false };
    } else if (rng === 'week') {
      return { options: ['day'], default: 'day', showButtons: false };
    } else if (rng === 'month') {
      return { options: ['week', 'day'], default: 'week', showButtons: true };
    } else if (rng === 'year') {
      return { options: ['month'], default: 'month', showButtons: false };
    } else if (rng === 'custom') {
      if (diffDays < 7) {
        return { options: ['hour'], default: 'hour', showButtons: false };
      } else if (diffDays < 30) {
        return { options: ['day'], default: 'day', showButtons: false };
      } else if (diffDays < 90) {
        return { options: ['day', 'month'], default: 'day', showButtons: true };
      } else {
        return { options: ['month'], default: 'month', showButtons: false };
      }
    }
  }

  // Format label based on grouping type
  function formatLabel(key, groupBy) {
    if (groupBy === 'hour') {
      // Show only time if same day, otherwise show date and time
      return key.slice(11, 13) + ':00';  // Just HH:00
    } else if (groupBy === 'day') {
      // Show date
      const d = new Date(key + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } else if (groupBy === 'week') {
      // Show week range
      const parts = key.split(' to ');
      const start = new Date(parts[0] + 'T00:00:00');
      const end = new Date(parts[1] + 'T00:00:00');
      return `${start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`;
    } else if (groupBy === 'month') {
      // Show month
      const d = new Date(key + '-01T00:00:00');
      return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    }
    return key;
  }

  // Group sales data by specified period and include all periods (even empty ones)
  function groupSalesData(sales, groupBy, start, end) {
    const grouped = {};
    const allPeriods = [];
    
    // First, aggregate sales data
    sales.forEach(s => {
      const d = s.date?.toDate ? s.date.toDate() : new Date(s.date);
      let key;
      
      if (groupBy === 'hour') {
        key = d.toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH:00
      } else if (groupBy === 'day') {
        key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      } else if (groupBy === 'week') {
        // Start from Monday of the week containing d
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        key = `${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}`;
      } else if (groupBy === 'month') {
        key = d.toISOString().slice(0, 7); // YYYY-MM
      }
      
      if (!grouped[key]) {
        grouped[key] = { sales: 0, profit: 0 };
      }
      grouped[key].sales += s.totalAmount || 0;
      grouped[key].profit += (s.totalAmount || 0) - (s.totalCost || 0);
    });
    
    // Generate all periods in the range
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    
    if (groupBy === 'hour') {
      while (current <= endDate) {
        const key = current.toISOString().slice(0, 13) + ':00';
        if (!grouped[key]) grouped[key] = { sales: 0, profit: 0 };
        allPeriods.push(key);
        current.setHours(current.getHours() + 1);
      }
    } else if (groupBy === 'day') {
      while (current <= endDate) {
        const key = current.toISOString().slice(0, 10);
        if (!grouped[key]) grouped[key] = { sales: 0, profit: 0 };
        allPeriods.push(key);
        current.setDate(current.getDate() + 1);
      }
    } else if (groupBy === 'week') {
      // Find the Monday of the week containing start date
      const weekStart = new Date(current);
      const dayOfWeek = weekStart.getDay();
      const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      
      while (weekStart <= endDate) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const key = `${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}`;
        if (!grouped[key]) grouped[key] = { sales: 0, profit: 0 };
        allPeriods.push(key);
        weekStart.setDate(weekStart.getDate() + 7);
      }
    } else if (groupBy === 'month') {
      while (current.toISOString().slice(0, 7) <= endDate.toISOString().slice(0, 7)) {
        const key = current.toISOString().slice(0, 7);
        if (!grouped[key]) grouped[key] = { sales: 0, profit: 0 };
        allPeriods.push(key);
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    // Remove duplicates and sort
    const uniquePeriods = [...new Set(allPeriods)].sort();
    
    // Create formatted labels
    const labels = uniquePeriods.map(p => formatLabel(p, groupBy));
    
    return { grouped, periods: uniquePeriods, labels };
  }

  function updateSummaryChart(totalSales, cogs, expenses, grossProfit, netProfit) {
    const ctx = document.getElementById('summaryChart');
    if (summaryChart) summaryChart.destroy();
    
    const theme = getComputedStyle(document.documentElement);
    const primaryColor = theme.getPropertyValue('--primary').trim();
    const successColor = theme.getPropertyValue('--success').trim() || '#10b981';
    const dangerColor = theme.getPropertyValue('--danger').trim() || '#dc2626';
    const warningColor = theme.getPropertyValue('--warning').trim() || '#f59e0b';
    const mutedColor = theme.getPropertyValue('--muted').trim() || '#f3f4f6';
    
    summaryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Total Sales', 'COGS', 'Expenses', 'Gross Profit', 'Net Profit'],
        datasets: [{
          label: 'Amount (₹)',
          data: [totalSales, cogs, expenses, grossProfit, netProfit],
          backgroundColor: [
            primaryColor,      // Total Sales - Neon Pink
            dangerColor,        // COGS - Red
            warningColor,       // Expenses - Orange
            '#3b82f6',          // Gross Profit - Blue
            netProfit >= 0 ? successColor : dangerColor  // Net Profit - Green if positive, Red if negative
          ],
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { callback: v => CM.utils.fmtINR(v) }
          }
        }
      }
    });
  }

  function updateInventoryChart(inventory, sales) {
    // Calculate current stock value
    const totalStockValue = inventory.reduce((sum, i) => sum + ((i.stock || 0) * (i.purchasePrice || 0)), 0);
    
    // Calculate sold stock value from sales data
    let totalSoldValue = 0;
    sales.forEach(s => {
      (s.items || []).forEach(item => {
        totalSoldValue += (item.quantity || 0) * (item.purchasePrice || 0);
      });
    });
    
    const ctx = document.getElementById('inventoryChart');
    if (inventoryChart) inventoryChart.destroy();
    
    const theme = getComputedStyle(document.documentElement);
    const primaryColor = theme.getPropertyValue('--primary').trim();
    const successColor = theme.getPropertyValue('--success').trim() || '#10b981';
    
    // Prepare labels with values
    const stockLeftLabel = `Stock Left: ${CM.utils.fmtINR(totalStockValue)}`;
    const stockSoldLabel = `Stock Sold: ${CM.utils.fmtINR(totalSoldValue)}`;
    
    inventoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [stockLeftLabel, stockSoldLabel],
        datasets: [{
          data: [totalStockValue || 1, totalSoldValue || 1],  // Use 1 as minimum for visibility
          backgroundColor: [successColor, primaryColor],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 15, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.dataIndex === 0) {
                  return `Stock Left: ${CM.utils.fmtINR(totalStockValue)}`;
                } else {
                  return `Stock Sold: ${CM.utils.fmtINR(totalSoldValue)}`;
                }
              }
            }
          }
        }
      }
    });
  }

  async function refresh(){
    // Determine date range
    let start, end; const rng = CM.State.filters.dashboard.range;
    if (rng==='today') [start,end] = CM.utils.todayRange();
    else if (rng==='week') [start,end] = CM.utils.weekRange();
    else if (rng==='month') [start,end] = CM.utils.monthRange();
    else if (rng==='year') [start,end] = CM.utils.yearRange();
    else if (rng==='custom') { 
      const fromVal = document.getElementById('fromDate').value;
      const toVal = document.getElementById('toDate').value;
      if (!fromVal || !toVal) return;
      start = new Date(fromVal + 'T00:00:00');
      end = new Date(toVal + 'T23:59:59');
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    }

    // Load threshold from database
    const threshold = await CM.DB.getStockThreshold();
    const stockThresholdElement = document.getElementById('stockThreshold');
    if (stockThresholdElement) {
      stockThresholdElement.value = threshold;
    }

    // Determine grouping
    const groupInfo = determineGrouping(start, end);
    currentGroupBy = groupInfo.default;
    
    // Show/hide grouping buttons
    const optionsDiv = document.getElementById('chartGroupOptions');
    optionsDiv.innerHTML = '';
    if (groupInfo.showButtons && groupInfo.options.length > 1) {
      groupInfo.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = `btn btn-soft text-xs ${currentGroupBy === opt ? 'ring-2 ring-[var(--primary)]' : ''}`;
        btn.textContent = opt === 'hour' ? 'By Hour' : opt === 'day' ? 'By Day' : opt === 'week' ? 'By Week' : 'By Month';
        btn.addEventListener('click', () => {
          currentGroupBy = opt;
          updateChart(sales, currentStart, currentEnd);
          // Update button styling
          optionsDiv.querySelectorAll('button').forEach(b => b.classList.remove('ring-2', 'ring-[var(--primary)]'));
          btn.classList.add('ring-2', 'ring-[var(--primary)]');
        });
        optionsDiv.appendChild(btn);
      });
    }

    // Fetch data
    const [sales, expenses, inventory] = await Promise.all([
      CM.DB.listSales({ start, end }),
      CM.DB.listExpenses({ start, end }),
      CM.DB.listInventory(),
    ]);

    // Store for updateChart
    currentStart = start;
    currentEnd = end;

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

    // Low stock with dynamic threshold from database
    const low = inventory.filter(i => (i.stock||0) < threshold);
    const list = document.getElementById('lowStockList');
    list.innerHTML = low.length? '' : '<div class="text-sm text-[var(--muted-foreground)]">No low stock.</div>';
    low.forEach(i => list.appendChild(CM.utils.el(`<li class="flex justify-between items-center p-2 border rounded-md border-[var(--border)]"><div>${i.name}</div><span class="badge badge-low"><i data-lucide="alert-circle"></i>${i.stock} left</span></li>`)));

    // Total inventory value (all items still in stock)
    const totalInventoryValue = inventory.reduce((sum, i) => sum + ((i.stock || 0) * (i.purchasePrice || 0)), 0);
    document.getElementById('totalInventoryValue').textContent = CM.utils.fmtINR(totalInventoryValue);

    // Update charts
    updateChart(sales, start, end);
    updateSummaryChart(totalSales, cogs, exp, gross, net);
    updateInventoryChart(inventory, sales);

    // Export rows
    dashboardExportRows = sales.map(s => ({
      Date: (s.date?.toDate? s.date.toDate(): new Date(s.date)).toLocaleString(),
      Total: s.totalAmount,
      COGS: s.totalCost,
      Profit: (s.totalAmount||0)-(s.totalCost||0),
      Items: (s.items||[]).map(i=>`${i.name} x${i.quantity} @ ${i.price}`).join('; ')
    }));
  }

  function updateChart(sales, start, end) {
    const { grouped, periods, labels } = groupSalesData(sales, currentGroupBy, start, end);
    const salesArr = periods.map(p => grouped[p].sales);
    const profitArr = periods.map(p => grouped[p].profit);

    const ctx = document.getElementById('salesChart');
    if (chart) chart.destroy();
    chart = CM.Charts.line(ctx, labels, salesArr, profitArr);
  }

  await refresh();
};
