CM.Views.Sales.render = async function() {
  const root = document.getElementById('view');
  const ranges = ['today','week','month','year','all','custom'];
  const state = CM.State.filters.sales;
  
  // Initialize pagination and sorting state
  state.page = state.page || 1;
  state.itemsPerPage = state.itemsPerPage || 10;
  state.sortField = state.sortField || 'date';
  state.sortDir = state.sortDir || 'desc';
  state.expandedRows = state.expandedRows || {};

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
        <table class="table w-full sales-table">
          <thead><tr>
            <th style="width: 40px;"></th>
            <th><button class="flex items-center gap-1 cursor-pointer sales-header-btn" data-sort="date">Date <i data-lucide="arrow-up-down" class="w-4 h-4"></i></button></th>
            <th>Items/Services</th>
            <th><button class="flex items-center gap-1 cursor-pointer sales-header-btn" data-sort="totalAmount">Total Sales <i data-lucide="arrow-up-down" class="w-4 h-4"></i></button></th>
            <th><button class="flex items-center gap-1 cursor-pointer sales-header-btn" data-sort="totalCost">COGS <i data-lucide="arrow-up-down" class="w-4 h-4"></i></button></th>
            <th><button class="flex items-center gap-1 cursor-pointer sales-header-btn" data-sort="grossProfit">Gross Profit <i data-lucide="arrow-up-down" class="w-4 h-4"></i></button></th>
            <th><button class="flex items-center gap-1 cursor-pointer sales-header-btn" data-sort="netProfit">Net Profit <i data-lucide="arrow-up-down" class="w-4 h-4"></i></button></th>
          </tr></thead>
          <tbody id="salesBody"></tbody>
        </table>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-4 p-3">
        <div class="flex items-center gap-2">
          <label for="itemsPerPage" class="text-sm font-medium">Items per page:</label>
          <select id="itemsPerPage" class="input w-20">
            <option value="10" ${state.itemsPerPage === 10 ? 'selected' : ''}>10</option>
            <option value="20" ${state.itemsPerPage === 20 ? 'selected' : ''}>20</option>
            <option value="50" ${state.itemsPerPage === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${state.itemsPerPage === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <span id="pageInfo" class="text-sm text-[var(--muted-foreground)]"></span>
        </div>
        <div class="flex gap-2">
          <button id="btnPrevPage" class="btn btn-soft"><i data-lucide="chevron-left"></i>Previous</button>
          <div id="pageNumbers" class="flex gap-1"></div>
          <button id="btnNextPage" class="btn btn-soft">Next<i data-lucide="chevron-right"></i></button>
        </div>
      </div>
    </div>`;

  lucide.createIcons();

  const applyRangeUI = () => {
    const show = state.range==='custom';
    document.getElementById('fromDate').classList.toggle('hidden', !show);
    document.getElementById('toDate').classList.toggle('hidden', !show);
    
    root.querySelectorAll('[data-range]').forEach(b => {
      const isActive = b.dataset.range === state.range;
      b.classList.toggle('ring-2', isActive);
      b.classList.toggle('ring-[var(--primary)]', isActive);
    });
  };
  applyRangeUI();

  root.querySelectorAll('[data-range]').forEach(b => b.addEventListener('click', async ()=>{
    state.range = b.dataset.range;
    state.page = 1;
    applyRangeUI();
    await refresh();
  }));
  document.getElementById('fromDate').addEventListener('change', async () => { state.page = 1; await refresh(); });
  document.getElementById('toDate').addEventListener('change', async () => { state.page = 1; await refresh(); });
  document.getElementById('itemsPerPage').addEventListener('change', async (e) => { 
    state.itemsPerPage = parseInt(e.target.value);
    state.page = 1;
    await refresh();
  });

  let allSalesCache = null;  // Cache for all sales (loaded once, used for export)
  let allSalesMetadata = null;  // Track total count
  let exportRows = [];

  async function loadAllForExport(){
    // Load all sales once and cache for export
    if (allSalesCache !== null) {
      console.log('📦 [Sales] Using cached data (no DB query)');
      return allSalesCache;
    }
    
    console.log('🔄 [Sales] Loading data from database...');
    const startTime = performance.now();
    let start, end; const rng = state.range;
    if (rng==='today') [start,end] = CM.utils.todayRange();
    else if (rng==='week') [start,end] = CM.utils.weekRange();
    else if (rng==='month') [start,end] = CM.utils.monthRange();
    else if (rng==='year') [start,end] = CM.utils.yearRange();
    else if (rng==='custom') { start = new Date(document.getElementById('fromDate').value); end = new Date(document.getElementById('toDate').value); if (!start||!end) return []; }

    const sales = await CM.DB.listSales(rng==='all'? null : { start, end });
    const loadTime = (performance.now() - startTime).toFixed(2);
    
    // Performance monitoring
    const dataSize = JSON.stringify(sales).length;
    const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
    console.log(`✅ [Sales] Loaded ${sales.length} records in ${loadTime}ms (${dataSizeMB}MB)`);
    
    // Alert if data is getting large
    if (sales.length > 5000) {
      console.warn(`⚠️  [Sales] Large dataset detected (${sales.length} records). Consider implementing server-side pagination.`);
    }
    
    // Add calculated fields
    allSalesCache = sales.map(s => ({
      ...s,
      grossProfit: (s.totalAmount || 0) - (s.totalCost || 0),
      netProfit: (s.totalAmount || 0) - (s.totalCost || 0)
    }));
    
    allSalesMetadata = { totalCount: allSalesCache.length };
    return allSalesCache;
  }

  async function refresh(){
    // Clear cache when changing range/filter
    allSalesCache = null;
    allSalesMetadata = null;
    console.log('🗑️  [Sales] Cache cleared');
    renderPage();
  }

  function sortSales(data) {
    let sorted = [...data];
    sorted.sort((a, b) => {
      let aVal = a[state.sortField];
      let bVal = b[state.sortField];
      
      if (state.sortField === 'date') {
        aVal = (a.date?.toDate ? a.date.toDate() : new Date(a.date)).getTime();
        bVal = (b.date?.toDate ? b.date.toDate() : new Date(b.date)).getTime();
      }
      
      if (typeof aVal === 'string') {
        return state.sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return state.sortDir === 'asc' ? (aVal - bVal) : (bVal - aVal);
    });
    return sorted;
  }

  function renderPage() {
    // Start loading in background
    loadAllForExport().then(allSales => {
      const sortedSales = sortSales(allSales);
      const totalItems = sortedSales.length;
      const totalPages = Math.ceil(totalItems / state.itemsPerPage) || 1;
      
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const startIdx = (state.page - 1) * state.itemsPerPage;
      const endIdx = startIdx + state.itemsPerPage;
      const pageData = sortedSales.slice(startIdx, endIdx);

      const body = document.getElementById('salesBody');
      body.innerHTML = '';
      
      pageData.forEach((s, idx) => {
        const saleId = `sale_${startIdx + idx}`;
        const isExpanded = state.expandedRows[saleId];
        const d = s.date?.toDate ? s.date.toDate(): new Date(s.date);
        const itemCount = (s.items || []).length;
        const hasMultiple = itemCount > 1;
        const itemsStr = (s.items||[]).map(i=>`${i.name} x${i.quantity}`).join(', ');
        
        const row = document.createElement('tr');
        row.className = 'hover-row';
        row.innerHTML = `
          <td style="text-align: center;">
            ${hasMultiple ? `<button class="icon-btn expand-btn" data-id="${saleId}" style="padding: 0.25rem;"><i data-lucide="chevron-${isExpanded ? 'down' : 'right'}"></i></button>` : ''}
          </td>
          <td>${d.toLocaleString()}</td>
          <td>${itemsStr}</td>
          <td>${CM.utils.fmtINR(s.totalAmount)}</td>
          <td>${CM.utils.fmtINR(s.totalCost)}</td>
          <td>${s.grossProfit < 0 ? `${CM.utils.fmtINR(s.grossProfit)} <span class="badge badge-loss">Loss</span>` : CM.utils.fmtINR(s.grossProfit)}</td>
          <td>${s.netProfit < 0 ? `${CM.utils.fmtINR(s.netProfit)} <span class="badge badge-loss">Loss</span>` : CM.utils.fmtINR(s.netProfit)}</td>
        `;
        body.appendChild(row);
        
        // Add expanded details row if needed
        if (hasMultiple && isExpanded) {
          const detailsRow = document.createElement('tr');
          detailsRow.className = 'bg-[var(--muted)]';
          let detailsHTML = `<td colspan="7"><div style="padding: 1rem;">
            <table class="sales-mini-table" style="width: 100%;">
              <thead style="border-bottom: 1px solid var(--border);">
                <tr>
                  <th style="text-align: left; white-space: nowrap;">Item/Service</th>
                  <th style="text-align: right; white-space: nowrap;">Total Sales</th>
                  <th style="text-align: right; white-space: nowrap;">COGS</th>
                  <th style="text-align: right; white-space: nowrap;">Gross Profit</th>
                  <th style="text-align: right; white-space: nowrap;">Net Profit</th>
                </tr>
              </thead>
              <tbody>`;
          
          (s.items || []).forEach(item => {
            const itemCost = item.purchasePrice || 0;
            const itemSales = item.quantity * item.price;
            const itemCogs = item.quantity * itemCost;
            const itemGrossProfit = itemSales - itemCogs;
            const itemNetProfit = itemGrossProfit;
            const grossProfitDisplay = itemGrossProfit < 0 ? `${CM.utils.fmtINR(itemGrossProfit)} <span class="badge badge-loss">Loss</span>` : CM.utils.fmtINR(itemGrossProfit);
            const netProfitDisplay = itemNetProfit < 0 ? `${CM.utils.fmtINR(itemNetProfit)} <span class="badge badge-loss">Loss</span>` : CM.utils.fmtINR(itemNetProfit);
            const itemRow = `
              <tr style="border-bottom: 1px solid var(--border);">
                <td>${item.name} (x${item.quantity})</td>
                <td style="text-align: right;">${CM.utils.fmtINR(itemSales)}</td>
                <td style="text-align: right;">${CM.utils.fmtINR(itemCogs)}</td>
                <td style="text-align: right;">${grossProfitDisplay}</td>
                <td style="text-align: right;">${netProfitDisplay}</td>
              </tr>
            `;
            detailsHTML += itemRow;
          });
          
          detailsHTML += `</tbody></table></div></td>`;
          detailsRow.innerHTML = detailsHTML;
          body.appendChild(detailsRow);
        }
      });

      // Update page info
      const pageInfo = document.getElementById('pageInfo');
      if (totalItems === 0) {
        pageInfo.textContent = 'No sales records';
      } else {
        pageInfo.textContent = `Showing ${startIdx + 1}–${Math.min(endIdx, totalItems)} of ${totalItems}`;
      }

      // Render page numbers
      const pageNumbers = document.getElementById('pageNumbers');
      pageNumbers.innerHTML = '';
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `btn btn-soft ${i === state.page ? 'ring-2 ring-[var(--primary)]' : ''}`;
        btn.textContent = i;
        btn.addEventListener('click', () => {
          state.page = i;
          renderPage();
        });
        pageNumbers.appendChild(btn);
      }

      document.getElementById('btnPrevPage').disabled = state.page === 1;
      document.getElementById('btnNextPage').disabled = state.page === totalPages;

      // Prepare export data with items for mini tables
      exportRows = allSales.map(s=>({
        Date:(s.date?.toDate? s.date.toDate(): new Date(s.date)).toLocaleString(),
        Items:(s.items||[]).map(i=>`${i.name} x${i.quantity} @ ${i.price}`).join('; '),
        'Total Sales':s.totalAmount,
        COGS:s.totalCost,
        'Gross Profit':s.grossProfit,
        'Net Profit':s.netProfit,
        _itemsData: s.items || []  // Raw items data for mini table in export
      }));

      // Attach expand button listeners
      body.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          state.expandedRows[id] = !state.expandedRows[id];
          renderPage();
        });
      });

      lucide.createIcons();
    });
  }

  // Sort column headers
  root.addEventListener('click', (e) => {
    const sortBtn = e.target.closest('[data-sort]');
    if (!sortBtn) return;
    
    const field = sortBtn.dataset.sort;
    if (state.sortField === field) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortField = field;
      state.sortDir = 'asc';
    }
    state.page = 1;
    renderPage();
  });

  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      renderPage();
    }
  });
  document.getElementById('btnNextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(allSales.length / state.itemsPerPage) || 1;
    if (state.page < totalPages) {
      state.page++;
      renderPage();
    }
  });

  await refresh();

  document.getElementById('btnExport').addEventListener('click', async ()=> {
    try {
      // Wait for all data to load before exporting
      await loadAllForExport();
      CM.exporter.salesToXlsx(exportRows);
      CM.UI.toast('Sales data exported successfully', 'success', 'Export Complete');
    } catch (err) {
      CM.UI.toast('Failed to export sales data', 'error', 'Export Failed');
    }
  });
};
