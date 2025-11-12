CM.Views.Inventory.render = async function() {
  const root = document.getElementById('view');
  let rows = await CM.DB.listInventory();
  let sort = { field:'name', dir: 'asc' }; // asc|desc
  let filters = { purchasePrice:null, sellingPrice:null, stock:null };

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Inventory</h1>
        <div class="flex gap-2">
          <button id="btnExport" class="btn btn-primary"><i data-lucide="download"></i>Export XLSX</button>
          <button id="btnAdd" class="btn btn-primary"><i data-lucide="plus"></i>Add Item</button>
        </div>
      </div>

      <div class="card p-3 overflow-auto">
        <table class="table w-full min-w-[720px]">
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
    </div>`;

  lucide.createIcons();

  function applySortFilter(data){
    let out = [...data];
    // filters: {col: {op:'lt'|'gt'|'range', a:number, b?:number}}
    ['purchasePrice','sellingPrice','stock'].forEach(col => {
      const f = filters[col];
      if (!f) return;
      if (f.op==='lt') out = out.filter(x => (x[col]||0) < f.a);
      if (f.op==='gt') out = out.filter(x => (x[col]||0) > f.a);
      if (f.op==='range') out = out.filter(x => (x[col]||0) >= f.a && (x[col]||0) <= f.b);
    });

    out.sort((a,b) => {
      const A=a[sort.field], B=b[sort.field];
      if (typeof A === 'string') return sort.dir==='asc'? A.localeCompare(B): B.localeCompare(A);
      return sort.dir==='asc'? (A-B):(B-A);
    });
    return out;
  }

  function render(){
    const body = document.getElementById('invBody');
    const data = applySortFilter(rows);
    body.innerHTML = '';
    data.forEach(r => body.appendChild(CM.utils.el(`
      <tr class="hover-row">
        <td>${r.name}</td>
        <td>₹${r.purchasePrice}</td>
        <td>₹${r.sellingPrice}</td>
        <td class="${r.stock<10?'text-[var(--danger)]':''}">${r.stock} ${r.stock<10?'<span class="badge badge-low ml-1">LOW</span>':''}</td>
        <td>
          <button class="icon-btn" data-edit="${r.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn" data-del="${r.id}"><i data-lucide="trash"></i></button>
        </td>
      </tr>`)));
    lucide.createIcons();
  }
  render();

  // Sort
  root.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', ()=>{
    const f = b.dataset.sort; sort.field===f ? (sort.dir = sort.dir==='asc'?'desc':'asc') : (sort={ field:f, dir:'asc' }); render();
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
    const modal = CM.utils.el(`<div class="modal-backdrop"><div class="modal">
      <header><h3>Filter by ${col}</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
      <div class="body">
        <div class="space-y-4">
          <div>
            <label>Filter Type</label>
            <div class="space-y-2">
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="op" value="lt" checked style="cursor:pointer"/>
                <span>Less than</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="op" value="gt" style="cursor:pointer"/>
                <span>Greater than</span>
              </label>
              <label class="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="op" value="range" style="cursor:pointer"/>
                <span>Range</span>
              </label>
            </div>
          </div>
          <div>
            <label>Value</label>
            <input id="a" type="number" class="input" placeholder="From"/>
          </div>
          <div id="rangeDiv" class="hidden">
            <label>To</label>
            <input id="b" type="number" class="input" placeholder="To"/>
          </div>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnClear">Clear Filter</button>
        <button class="btn btn-primary" id="btnApply"><i data-lucide="filter"></i>Apply Filter</button>
      </footer>
    </div></div>`);
    document.getElementById('modal-root').appendChild(modal);
    lucide.createIcons();
    const close = ()=> document.getElementById('modal-root').removeChild(modal);
    const rangeDiv = modal.querySelector('#rangeDiv');
    
    modal.querySelector('#xClose').onclick=close;
    modal.querySelector('input[name="op"][value="range"]').addEventListener('change',()=> rangeDiv.classList.remove('hidden'));
    modal.querySelector('input[name="op"][value="lt"]').addEventListener('change',()=> rangeDiv.classList.add('hidden'));
    modal.querySelector('input[name="op"][value="gt"]').addEventListener('change',()=> rangeDiv.classList.add('hidden'));
    modal.querySelector('#btnClear').onclick = ()=>{ filters[col]=null; updateFilterButtons(); render(); close(); };
    modal.querySelector('#btnApply').onclick = ()=>{
      const op = modal.querySelector('input[name="op"]:checked').value;
      const a = Number(modal.querySelector('#a').value);
      const b = Number(modal.querySelector('#b').value);
      if (!Number.isFinite(a)) {
        CM.UI.toast('Please enter a valid filter value', 'error', 'Validation Error');
        return;
      }
      filters[col] = op==='range'? { op, a, b } : { op, a };
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
    if (id) { const it = rows.find(r=>r.id===id); openEdit(it); }
    const did = e.target.closest('[data-del]')?.dataset.del;
    if (did) {
      if (await CM.utils.confirm('Delete item','This action cannot be undone.')) {
        try {
          await CM.DB.deleteInventory(did);
          rows = rows.filter(r=>r.id!==did);
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
    const modal = CM.utils.el(`<div class="modal-backdrop"><div class="modal">
      <header><h3>${isNew?'Add New Item':'Edit Item'}</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
      <div class="body">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label>Item Name</label>
            <input id="name" class="input" placeholder="e.g., Pencil, Notebook" value="${item.name}"/>
          </div>
          <div>
            <label>Purchase Price (₹)</label>
            <input id="purchasePrice" type="number" min="0" step="0.01" class="input" placeholder="Cost price" value="${item.purchasePrice}"/>
          </div>
          <div>
            <label>Selling Price (₹)</label>
            <input id="sellingPrice" type="number" min="0" step="0.01" class="input" placeholder="Sale price" value="${item.sellingPrice}"/>
          </div>
          <div>
            <label>Stock Quantity</label>
            <input id="stock" type="number" min="0" step="1" class="input" placeholder="Units in stock" value="${item.stock}"/>
          </div>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnCancel">Cancel</button>
        <button class="btn btn-primary" id="btnSave"><i data-lucide="save"></i>Save Item</button>
      </footer>
    </div></div>`);
    document.getElementById('modal-root').appendChild(modal);
    lucide.createIcons();
    const close=()=> document.getElementById('modal-root').removeChild(modal);
    modal.querySelector('#xClose').onclick=close;
    modal.querySelector('#btnCancel').onclick=close;
    
    // Handle Enter key to submit form
    const handleEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        modal.querySelector('#btnSave').click();
      }
    };
    modal.querySelectorAll('.input').forEach(input => {
      input.addEventListener('keypress', handleEnter);
    });
    
    modal.querySelector('#btnSave').onclick = async ()=>{
      const name = modal.querySelector('#name').value.trim();
      const purchasePrice = Number(modal.querySelector('#purchasePrice').value);
      const sellingPrice = Number(modal.querySelector('#sellingPrice').value);
      const stock = Number(modal.querySelector('#stock').value);
      
      if (!name) {
        CM.UI.toast('Please enter an item name', 'error', 'Validation Error');
        return;
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice<0) {
        CM.UI.toast('Please enter a valid purchase price', 'error', 'Validation Error');
        return;
      }
      if (!Number.isFinite(sellingPrice) || sellingPrice<0) {
        CM.UI.toast('Please enter a valid selling price', 'error', 'Validation Error');
        return;
      }
      if (sellingPrice < purchasePrice) {
        CM.UI.toast('Selling price cannot be less than purchase price', 'error', 'Price Error');
        return;
      }
      if (!Number.isFinite(stock) || stock<0) {
        CM.UI.toast('Please enter a valid stock quantity', 'error', 'Validation Error');
        return;
      }

      try {
        if (isNew) {
          const created = await CM.DB.addInventory({ name, purchasePrice, sellingPrice, stock });
          rows.push(created);
          CM.UI.toast(`${name} added to inventory`, 'success', 'Item Added');
        } else {
          await CM.DB.updateInventory(item.id, { name, purchasePrice, sellingPrice, stock });
          Object.assign(rows.find(r=>r.id===item.id), { name, purchasePrice, sellingPrice, stock });
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
  document.getElementById('btnExport').addEventListener('click', ()=>{
    try {
      CM.exporter.toXlsx('inventory.xlsx', rows.map(r=>({ Name:r.name, Purchase:r.purchasePrice, Selling:r.sellingPrice, Stock:r.stock })));
      CM.UI.toast('Inventory exported successfully', 'success', 'Export Complete');
    } catch (err) {
      CM.UI.toast('Failed to export inventory', 'error', 'Export Failed');
    }
  });
};
