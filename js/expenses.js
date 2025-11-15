CM.Views.Expenses.render = async function() {
  const root = document.getElementById('view');
  const state = CM.State.filters.expenses;
  
  // Initialize pagination state
  state.page = state.page || 1;
  state.itemsPerPage = state.itemsPerPage || 10;

  let expensesCache = null;  // Cache for all expenses (loaded once, used for export)
  let exportRows = [];

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Expenses</h1>
        <div class="flex flex-wrap gap-2">
          ${['today','week','month','year','all','custom'].map(r=>`<button class="btn btn-soft ${state.range===r?'ring-2 ring-[var(--primary)]':''}" data-range="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
          <input type="date" id="fromDate" class="input w-40 hidden"/>
          <input type="date" id="toDate" class="input w-40 hidden"/>
          <button id="btnExport" class="btn btn-primary"><i data-lucide="download"></i>Export XLSX</button>
          <button id="btnAdd" class="btn btn-primary"><i data-lucide="plus"></i>Add Expense</button>
        </div>
      </div>

      <div class="card p-3 overflow-auto">
        <table class="table w-full expense-table">
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody id="expBody"></tbody>
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

  async function loadAllForCache(){
    // Load and cache all expenses for export
    if (expensesCache !== null) {
      console.log('📦 [Expenses] Using cached data (no DB query)');
      return expensesCache;
    }
    
    console.log('🔄 [Expenses] Loading data from database...');
    const startTime = performance.now();
    let start, end; const rng = state.range;
    if (rng==='today') [start,end] = CM.utils.todayRange();
    else if (rng==='week') [start,end] = CM.utils.weekRange();
    else if (rng==='month') [start,end] = CM.utils.monthRange();
    else if (rng==='year') [start,end] = CM.utils.yearRange();
    else if (rng==='custom') { start=new Date(document.getElementById('fromDate').value); end=new Date(document.getElementById('toDate').value); if (!start||!end) return []; }

    expensesCache = await CM.DB.listExpenses(rng==='all'? null : { start, end });
    const loadTime = (performance.now() - startTime).toFixed(2);
    
    // Performance monitoring
    const dataSize = JSON.stringify(expensesCache).length;
    const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
    console.log(`✅ [Expenses] Loaded ${expensesCache.length} records in ${loadTime}ms (${dataSizeMB}MB)`);
    
    // Alert if data is getting large
    if (expensesCache.length > 5000) {
      console.warn(`⚠️  [Expenses] Large dataset detected (${expensesCache.length} records). Consider implementing server-side pagination.`);
    }
    
    return expensesCache;
  }

  async function refresh(){
    // Clear cache when changing range/filter
    expensesCache = null;
    console.log('🗑️  [Expenses] Cache cleared');
    renderPage();
  }

  function renderPage() {
    // Load all data in the background
    loadAllForCache().then(allExpenses => {
      const totalItems = allExpenses.length;
      const totalPages = Math.ceil(totalItems / state.itemsPerPage) || 1;
      
      // Clamp page to valid range
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const startIdx = (state.page - 1) * state.itemsPerPage;
      const endIdx = startIdx + state.itemsPerPage;
      const pageData = allExpenses.slice(startIdx, endIdx);

      const body = document.getElementById('expBody');
      body.innerHTML = '';
      pageData.forEach(x => {
        const d = x.date?.toDate? x.date.toDate(): new Date(x.date);
        body.appendChild(CM.utils.el(`<tr class="hover-row"><td>${d.toLocaleDateString()}</td><td>${x.description}</td><td>${CM.utils.fmtINR(x.amount)}</td><td style="display: flex; gap: 0.5rem;"><button class="icon-btn" data-edit="${x.id}"><i data-lucide="edit"></i></button><button class="icon-btn" data-del="${x.id}"><i data-lucide="trash"></i></button></td></tr>`));
      });

      // Update page info
      const pageInfo = document.getElementById('pageInfo');
      if (totalItems === 0) {
        pageInfo.textContent = 'No expenses';
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

      // Update prev/next buttons
      const btnPrev = document.getElementById('btnPrevPage');
      const btnNext = document.getElementById('btnNextPage');
      btnPrev.disabled = state.page === 1;
      btnNext.disabled = state.page === totalPages;

      // Prepare export data from all expenses (not just current page)
      exportRows = allExpenses.map(x=>({ Date:(x.date?.toDate? x.date.toDate(): new Date(x.date)).toLocaleDateString(), Description:x.description, Amount:x.amount }));

      lucide.createIcons();
    });
  }

  await refresh();

  // Prev/Next buttons
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      renderPage();
    }
  });
  document.getElementById('btnNextPage').addEventListener('click', async () => {
    const allExpenses = await loadAllForCache();
    const totalPages = Math.ceil(allExpenses.length / state.itemsPerPage) || 1;
    if (state.page < totalPages) {
      state.page++;
      renderPage();
    }
  });

  // Add/Edit expense modal
  document.getElementById('btnAdd').addEventListener('click', ()=> openEdit());
  root.addEventListener('click', async (e)=>{
    const id = e.target.closest('[data-edit]')?.dataset.edit;
    if (id) { 
      const allExpenses = await loadAllForCache();
      const exp = allExpenses.find(r=>r.id===id); 
      openEdit(exp); 
    }
    const did = e.target.closest('[data-del]')?.dataset.del;
    if (did) {
      if (await CM.utils.confirm('Delete expense','This will remove the expense.')) {
        try {
          await CM.DB.deleteExpense(did);
          expensesCache = null;  // Clear cache so it reloads
          CM.UI.toast('Expense deleted successfully', 'success', 'Deleted');
          await refresh();
        } catch (err) {
          CM.UI.toast('Failed to delete expense', 'error', 'Delete Failed');
        }
      }
    }
  });

  function openEdit(expense){
    const isNew = !expense;
    const today = new Date().toISOString().split('T')[0];
    expense = expense || { date: today, description:'', amount:0 };
    const expDate = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
    const dateStr = expDate.toISOString().split('T')[0];
    
    // Create modal HTML
    const modalHTML = `<div class="modal-backdrop">
      <div class="modal">
        <header><h3>${isNew?'Record New Expense':'Edit Expense'}</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
        <div class="body">
          <div class="space-y-4">
            <div>
              <label>Date</label>
              <input id="expDate" type="date" class="input" value="${dateStr}"/>
            </div>
            <div>
              <label>Description</label>
              <input id="expDesc" class="input" placeholder="e.g., Office supplies, Rent, etc." value="${expense.description}"/>
            </div>
            <div>
              <label>Amount (₹)</label>
              <input id="expAmt" type="number" min="0" step="0.01" class="input" placeholder="Enter amount" value="${expense.amount}"/>
            </div>
          </div>
        </div>
        <footer>
          <button class="btn btn-soft" id="btnCancel">Cancel</button>
          <button class="btn btn-primary" id="btnSave"><i data-lucide="save"></i>${isNew?'Add':'Update'} Expense</button>
        </footer>
      </div>
    </div>`;
    
    // Clear any existing modals
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = '';
    
    // Create and append modal
    const backdrop = CM.utils.el(modalHTML);
    modalRoot.appendChild(backdrop);
    
    // Get modal and elements - query from backdrop
    const modal = backdrop.querySelector('.modal');
    
    // Debug: Check if modal exists
    if (!modal) {
      console.error('❌ [Expenses] Modal element not found!', { backdrop, backdropClass: backdrop?.className });
      return;
    }
    
    lucide.createIcons();
    
    // Create close function
    const close = () => {
      modalRoot.innerHTML = '';
    };
    
    // Attach event listeners to the NEW modal elements
    const closeBtn = modal.querySelector('#xClose');
    const cancelBtn = modal.querySelector('#btnCancel');
    const saveBtn = modal.querySelector('#btnSave');
    const dateInput = modal.querySelector('#expDate');
    const descInput = modal.querySelector('#expDesc');
    const amtInput = modal.querySelector('#expAmt');
    
    // Debug: Log each element individually
    console.log('✅ [Expenses] closeBtn:', closeBtn);
    console.log('✅ [Expenses] cancelBtn:', cancelBtn);
    console.log('✅ [Expenses] saveBtn:', saveBtn);
    console.log('✅ [Expenses] dateInput:', dateInput);
    console.log('✅ [Expenses] descInput:', descInput);
    console.log('✅ [Expenses] amtInput:', amtInput);
    
    if (closeBtn) closeBtn.onclick = close;
    if (cancelBtn) cancelBtn.onclick = close;
    
    // Close on backdrop click
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };
    
    // Enter key to save
    if (dateInput && descInput && amtInput && saveBtn) {
      [dateInput, descInput, amtInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveBtn.click();
          }
        });
      });
    }
    
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const dateValue = dateInput.value;
        const descValue = descInput.value.trim();
        const amtValue = Number(amtInput.value);
      
        if (!dateValue || !descValue || !Number.isFinite(amtValue) || amtValue < 0) {
          CM.UI.toast('Please fill all fields correctly', 'error', 'Validation Error');
          return;
        }
      
        try {
          if (isNew) {
            await CM.DB.addExpense({ date: new Date(dateValue), description: descValue, amount: amtValue });
            expensesCache = null;  // Clear cache so it reloads
            CM.UI.toast('Expense added successfully', 'success', 'Expense Created');
          } else {
            await CM.DB.updateExpense(expense.id, { date: new Date(dateValue), description: descValue, amount: amtValue });
            expensesCache = null;  // Clear cache so it reloads
            CM.UI.toast('Expense updated successfully', 'success', 'Expense Updated');
          }
          close();
          await refresh();
        } catch (err) {
          CM.UI.toast(`Failed to ${isNew?'add':'update'} expense`, 'error', isNew?'Add Failed':'Update Failed');
        }
      };
    }
  }

  document.getElementById('btnExport').addEventListener('click', async ()=> {
    try {
      await loadAllForCache();  // Wait for all data to load
      CM.exporter.toXlsx('expenses.xlsx', exportRows);
      CM.UI.toast('Expenses exported successfully', 'success', 'Export Complete');
    } catch (err) {
      CM.UI.toast('Failed to export expenses', 'error', 'Export Failed');
    }
  });
};
