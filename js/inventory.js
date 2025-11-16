CM.Views.Inventory.render = async function() {
  const root = document.getElementById('view');
  let rowsCache = null;  // Cache for all inventory items (loaded once, used for export)
  let sort = { field:'name', dir: 'asc' }; // asc|desc
  let filters = { purchasePrice:null, sellingPrice:null, stock:null };
  let searchTerm = '';
  
  // Initialize pagination state
  const state = CM.State.filters.inventory = CM.State.filters.inventory || {};
  state.page = state.page || 1;
  state.itemsPerPage = state.itemsPerPage || 10;

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Inventory</h1>
        <div class="flex gap-2 flex-wrap">
          <input id="searchInput" type="text" class="input flex-1 min-w-[200px]" placeholder="Search by name..."/>
          <button id="btnExport" class="btn btn-primary"><i data-lucide="download"></i>Export XLSX</button>
          <button id="btnAdd" class="btn btn-primary"><i data-lucide="plus"></i>Add Item</button>
        </div>
      </div>

      <div class="card p-3 overflow-auto">
        <table class="table w-full inventory-table">
          <thead>
            <tr>
              ${['name','purchasePrice','sellingPrice','stock'].map(col => `
                <th>
                  <div class="flex items-center gap-1">
                    <button class="flex items-center gap-1" data-sort="${col}">${col[0].toUpperCase()+col.slice(1)}<i data-lucide="arrow-up-down" class="w-4 h-4"></i></button>
                    ${['purchasePrice','sellingPrice','stock'].includes(col)?`<button data-filter="${col}" class="icon-btn" title="Filter"><i data-lucide="filter"></i></button>`:''}
                  </div>
                </th>`).join('')}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="invBody"></tbody>
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

  // Fetch stock threshold from database for low stock highlighting
  let stockThreshold = 10;
  CM.DB.getStockThreshold().then(threshold => {
    stockThreshold = threshold;
    render();
  });

  function applySortFilter(data){
    let out = [...data];
    
    // Apply filters first
    ['purchasePrice','sellingPrice','stock'].forEach(col => {
      const f = filters[col];
      if (!f) return;
      if (f.op==='lt') out = out.filter(x => (x[col]||0) < f.a);
      if (f.op==='gt') out = out.filter(x => (x[col]||0) > f.a);
      if (f.op==='range') out = out.filter(x => (x[col]||0) >= f.a && (x[col]||0) <= f.b);
    });

    // Apply search on filtered data (or all data if no filters)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      out = out.filter(x => x.name.toLowerCase().includes(term));
    }

    // Apply sorting
    out.sort((a,b) => {
      const A=a[sort.field], B=b[sort.field];
      if (typeof A === 'string') return sort.dir==='asc'? A.localeCompare(B): B.localeCompare(A);
      return sort.dir==='asc'? (A-B):(B-A);
    });
    return out;
  }

  async function render() {
    // Re-render table with current data
    const filteredData = applySortFilter(rowsCache || []);
    const start = (state.page - 1) * state.itemsPerPage;
    const end = start + state.itemsPerPage;
    const paged = filteredData.slice(start, end);
    renderTable(paged);
    updatePageInfo();
  }

  async function loadAllForCache() {
    // Load and cache all inventory items for export
    if (rowsCache !== null) {
      console.log('📦 [Inventory] Using cached data (no DB query)');
      return rowsCache;
    }
    
    console.log('🔄 [Inventory] Loading data from database...');
    const startTime = performance.now();
    rowsCache = await CM.DB.listInventory();
    const loadTime = (performance.now() - startTime).toFixed(2);
    
    // Performance monitoring
    const dataSize = JSON.stringify(rowsCache).length;
    const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
    console.log(`✅ [Inventory] Loaded ${rowsCache.length} items in ${loadTime}ms (${dataSizeMB}MB)`);
    
    // Alert if data is getting large
    if (rowsCache.length > 5000) {
      console.warn(`⚠️  [Inventory] Large dataset detected (${rowsCache.length} items). Consider implementing server-side pagination.`);
    }
    
    return rowsCache;
  }

  function render(){
    // Load all data in the background
    loadAllForCache().then(rows => {
      const data = applySortFilter(rows);
      const totalItems = data.length;
      const totalPages = Math.ceil(totalItems / state.itemsPerPage) || 1;
      
      // Clamp page to valid range
      if (state.page > totalPages) state.page = totalPages;
      if (state.page < 1) state.page = 1;

      const startIdx = (state.page - 1) * state.itemsPerPage;
      const endIdx = startIdx + state.itemsPerPage;
      const pageData = data.slice(startIdx, endIdx);

      const body = document.getElementById('invBody');
      body.innerHTML = '';
      
      if (pageData.length === 0) {
        body.appendChild(CM.utils.el(`<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--muted-foreground);">No items found</td></tr>`));
      } else {
        pageData.forEach(r => body.appendChild(CM.utils.el(`
          <tr class="hover-row">
            <td>${r.name}</td>
            <td>₹${r.purchasePrice}</td>
            <td>₹${r.sellingPrice}</td>
            <td class="${r.stock<stockThreshold?'text-[var(--danger)]':''}">${r.stock} ${r.stock<stockThreshold?'<span class="badge badge-low ml-1"><i data-lucide="alert-circle"></i></span>':''}</td>
            <td>
              <button class="icon-btn" data-edit="${r.id}"><i data-lucide="pencil"></i></button>
              <button class="icon-btn" data-del="${r.id}"><i data-lucide="trash"></i></button>
            </td>
          </tr>`)));
      }

      // Update page info
      const pageInfo = document.getElementById('pageInfo');
      if (totalItems === 0) {
        pageInfo.textContent = 'No items';
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
          render();
        });
        pageNumbers.appendChild(btn);
      }

      // Update prev/next buttons
      const btnPrev = document.getElementById('btnPrevPage');
      const btnNext = document.getElementById('btnNextPage');
      btnPrev.disabled = state.page === 1;
      btnNext.disabled = state.page === totalPages;
      
      lucide.createIcons();
      
      // Update icons based on current design theme
      const currentDesign = localStorage.getItem("cm:designTheme") || "glass-modern";
      if (CM.UI && CM.UI.updateIconsForDesignTheme) {
        CM.UI.updateIconsForDesignTheme(currentDesign);
      }
    });
  }
  render();

  // Search functionality with debouncing for better performance
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Debounce search - wait 300ms before executing
    searchTimeout = setTimeout(() => {
      searchTerm = e.target.value;
      state.page = 1;
      render();
    }, 300);
  });

  // Items per page
  document.getElementById('itemsPerPage').addEventListener('change', (e) => {
    state.itemsPerPage = parseInt(e.target.value);
    state.page = 1;
    render();
  });

  // Prev/Next buttons
  document.getElementById('btnPrevPage').addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      render();
    }
  });
  document.getElementById('btnNextPage').addEventListener('click', () => {
    const totalItems = applySortFilter(rows).length;
    const totalPages = Math.ceil(totalItems / state.itemsPerPage) || 1;
    if (state.page < totalPages) {
      state.page++;
      render();
    }
  });

  // Sort
  root.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', ()=>{
    const f = b.dataset.sort; sort.field===f ? (sort.dir = sort.dir==='asc'?'desc':'asc') : (sort={ field:f, dir:'asc' }); state.page = 1; render();
  }));

  function updateFilterButtons() {
    root.querySelectorAll('[data-filter]').forEach(btn => {
      const col = btn.dataset.filter;
      const hasFilter = filters[col] !== null;
      
      // Clear any existing content
      btn.innerHTML = '';
      
      if (hasFilter) {
        // Show trash icon when filter is active
        btn.innerHTML = '<i data-lucide="trash-2"></i>';
        btn.title = `Clear filter on ${col}`;
        btn.style.color = 'var(--danger)';
        btn.style.background = 'color-mix(in srgb, var(--danger) 10%, transparent)';
      } else {
        // Show filter icon when no filter
        btn.innerHTML = '<i data-lucide="filter"></i>';
        btn.title = `Filter by ${col}`;
        btn.style.color = 'inherit';
        btn.style.background = 'transparent';
      }
      
      lucide.createIcons();
    });
  }

  // Filter modal and button click handler
  root.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('[data-filter]');
    if (!filterBtn) return;
    
    const col = filterBtn.dataset.filter;
    const hasFilter = filters[col] !== null;
    
    // If filter exists and user clicks the button, clear it
    if (hasFilter) {
      filters[col] = null;
      CM.UI.toast(`Filter cleared on ${col}`, 'success', 'Filter Cleared');
      updateFilterButtons();
      render();
      return;
    }
    
    // Otherwise, show the filter modal
    const modalHTML = `<div class="modal-backdrop"><div class="modal">
      <header><h3>Filter by ${col}</h3><button class="icon-btn" id="filterClose"><i data-lucide="x"></i></button></header>
      <div class="body">
        <div class="space-y-4">
          <div>
            <label>Filter Type</label>
            <div class="space-y-2">
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" id="opLt" name="filterOp" value="lt" checked style="cursor:pointer"/>
                <span>Less than</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" id="opGt" name="filterOp" value="gt" style="cursor:pointer"/>
                <span>Greater than</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" id="opRange" name="filterOp" value="range" style="cursor:pointer"/>
                <span>Range</span>
              </label>
            </div>
          </div>
          <div>
            <label>Value</label>
            <input id="filterFrom" type="number" class="input" placeholder="From"/>
          </div>
          <div id="filterRangeDiv" class="hidden">
            <label>To</label>
            <input id="filterTo" type="number" class="input" placeholder="To"/>
          </div>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnClearFilter">Clear Filter</button>
        <button class="btn btn-primary" id="btnApplyFilter"><i data-lucide="filter"></i>Apply Filter</button>
      </footer>
    </div></div>`;
    
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = '';
    const backdrop = CM.utils.el(modalHTML);
    modalRoot.appendChild(backdrop);
    lucide.createIcons();
    
    const modal = backdrop.querySelector('.modal');
    
    const close = () => {
      modalRoot.innerHTML = '';
    };
    
    // Get all elements
    const closeBtn = modal.querySelector('#filterClose');
    const opLt = modal.querySelector('#opLt');
    const opGt = modal.querySelector('#opGt');
    const opRange = modal.querySelector('#opRange');
    const filterFrom = modal.querySelector('#filterFrom');
    const filterTo = modal.querySelector('#filterTo');
    const filterRangeDiv = modal.querySelector('#filterRangeDiv');
    const clearBtn = modal.querySelector('#btnClearFilter');
    const applyBtn = modal.querySelector('#btnApplyFilter');
    
    closeBtn.onclick = close;
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };
    
    // Show/hide range div based on selected option
    opRange.addEventListener('change', () => filterRangeDiv.classList.remove('hidden'));
    opLt.addEventListener('change', () => filterRangeDiv.classList.add('hidden'));
    opGt.addEventListener('change', () => filterRangeDiv.classList.add('hidden'));
    
    clearBtn.onclick = () => {
      filters[col] = null;
      updateFilterButtons();
      render();
      close();
    };
    
    applyBtn.onclick = () => {
      const op = modal.querySelector('input[name="filterOp"]:checked').value;
      const a = Number(filterFrom.value);
      const b = Number(filterTo.value);
      
      if (!Number.isFinite(a)) {
        CM.UI.toast('Please enter a valid filter value', 'error', 'Validation Error');
        return;
      }
      
      filters[col] = op === 'range' ? { op, a, b } : { op, a };
      CM.UI.toast(`Filter applied to ${col}`, 'success', 'Filter Applied');
      updateFilterButtons();
      render();
      close();
    };
  });
  
  updateFilterButtons();

  // Add/Edit item modal
  document.getElementById('btnAdd').addEventListener('click', ()=> openEdit());
  root.addEventListener('click', async (e)=>{
    const id = e.target.closest('[data-edit]')?.dataset.edit;
    if (id) { 
      const rows = await loadAllForCache();
      const it = rows.find(r=>r.id===id); 
      openEdit(it); 
    }
    const did = e.target.closest('[data-del]')?.dataset.del;
    if (did) {
      if (await CM.utils.confirm('Delete item','This action cannot be undone.')) {
        try {
          await CM.DB.deleteInventory(did);
          rowsCache = null;  // Clear cache so it reloads
          render();
          CM.UI.toast('Item deleted successfully', 'success', 'Item Deleted');
        } catch (err) {
          CM.UI.toast('Failed to delete item', 'error', 'Delete Failed');
        }
      }
    }
  });

  function openEdit(item){
    const isNew = !item;
    item = item || { name:'', purchasePrice:0, sellingPrice:0, stock:0 };
    
    // Create modal HTML
    const modalHTML = `<div class="modal-backdrop"><div class="modal">
      <header><h3>${isNew?'Add New Item':'Edit Item'}</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
      <div class="body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label>Item Name</label>
            <input id="invName" class="input" placeholder="e.g., Pencil, Notebook" value="${item.name}"/>
          </div>
          <div>
            <label>Purchase Price (₹)</label>
            <input id="invPurchasePrice" type="number" min="0" step="0.01" class="input" placeholder="Cost price" value="${item.purchasePrice}"/>
          </div>
          <div>
            <label>Selling Price (₹)</label>
            <input id="invSellingPrice" type="number" min="0" step="0.01" class="input" placeholder="Sale price" value="${item.sellingPrice}"/>
          </div>
          <div>
            <label>Stock Quantity</label>
            <input id="invStock" type="number" min="0" step="1" class="input" placeholder="Units in stock" value="${item.stock}"/>
          </div>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnCancel">Cancel</button>
        <button class="btn btn-primary" id="btnSave"><i data-lucide="save"></i>Save Item</button>
      </footer>
    </div></div>`;
    
    // Clear any existing modals
    const modalRoot = document.getElementById('modal-root');
    modalRoot.innerHTML = '';
    
    // Create and append modal
    const backdrop = CM.utils.el(modalHTML);
    modalRoot.appendChild(backdrop);
    lucide.createIcons();
    
    // The modal is inside the backdrop
    const modal = backdrop.querySelector('.modal');
    
    // Create close function
    const close = () => {
      modalRoot.innerHTML = '';
    };
    
    // Get all elements we need
    const closeBtn = modal.querySelector('#xClose');
    const cancelBtn = modal.querySelector('#btnCancel');
    const saveBtn = modal.querySelector('#btnSave');
    const nameInput = modal.querySelector('#invName');
    const purchasePriceInput = modal.querySelector('#invPurchasePrice');
    const sellingPriceInput = modal.querySelector('#invSellingPrice');
    const stockInput = modal.querySelector('#invStock');
    
    closeBtn.onclick = close;
    cancelBtn.onclick = close;
    
    // Close on backdrop click
    backdrop.onclick = (e) => {
      if (e.target === backdrop) close();
    };
    
    // Enter key to save
    [nameInput, purchasePriceInput, sellingPriceInput, stockInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveBtn.click();
        }
      });
    });
    
    saveBtn.onclick = async () => {
      const name = nameInput.value.trim();
      const purchasePrice = Number(purchasePriceInput.value);
      const sellingPrice = Number(sellingPriceInput.value);
      const stock = Number(stockInput.value);
      
      if (!name) {
        CM.UI.toast('Please enter an item name', 'error', 'Validation Error');
        return;
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        CM.UI.toast('Please enter a valid purchase price', 'error', 'Validation Error');
        return;
      }
      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
        CM.UI.toast('Please enter a valid selling price', 'error', 'Validation Error');
        return;
      }
      if (sellingPrice < purchasePrice) {
        CM.UI.toast('Selling price cannot be less than purchase price', 'error', 'Price Error');
        return;
      }
      if (!Number.isFinite(stock) || stock < 0) {
        CM.UI.toast('Please enter a valid stock quantity', 'error', 'Validation Error');
        return;
      }

      try {
        if (isNew) {
          const created = await CM.DB.addInventory({ name, purchasePrice, sellingPrice, stock });
          rowsCache = null;  // Clear cache so it reloads
          CM.UI.toast(`${name} added to inventory`, 'success', 'Item Added');
        } else {
          await CM.DB.updateInventory(item.id, { name, purchasePrice, sellingPrice, stock });
          rowsCache = null;  // Clear cache so it reloads
          CM.UI.toast(`${name} updated successfully`, 'success', 'Item Updated');
        }
        render();
        close();
      } catch(e){
        console.error(e);
        CM.UI.toast('Failed to save item. Please try again', 'error', 'Save Failed');
      }
    };
  }

  // Export
  document.getElementById('btnExport').addEventListener('click', async ()=>{
    try {
      const rows = await loadAllForCache();
      const exportData = rows.map(r=>({ 
        Name: r.name, 
        'Purchase Price': r.purchasePrice, 
        'Selling Price': r.sellingPrice, 
        Stock: r.stock 
      }));
      CM.exporter.inventoryToXlsx(exportData, 0);  // 0 means highlight items with stock <= 0
      CM.UI.toast('Inventory exported successfully', 'success', 'Export Complete');
    } catch (err) {
      CM.UI.toast('Failed to export inventory', 'error', 'Export Failed');
    }
  });
};
