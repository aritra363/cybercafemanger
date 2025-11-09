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

  // Filter modal
  root.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', ()=>{
    const col = b.dataset.filter;
    const modal = CM.utils.el(`<div class="modal-backdrop"><div class="modal">
      <header><h3 class="font-semibold">Filter ${col}</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
      <div class="body space-y-3">
        <label class="flex items-center gap-2"><input type="radio" name="op" value="lt" checked/> Less than</label>
        <label class="flex items-center gap-2"><input type="radio" name="op" value="gt"/> Greater than</label>
        <label class="flex items-center gap-2"><input type="radio" name="op" value="range"/> Range</label>
        <div class="grid grid-cols-2 gap-2">
          <input id="a" type="number" class="input" placeholder="Value"/>
          <input id="b" type="number" class="input hidden" placeholder="To"/>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnClear">Clear</button>
        <button class="btn btn-primary" id="btnApply">Apply</button>
      </footer>
    </div></div>`);
    document.getElementById('modal-root').appendChild(modal);
    lucide.createIcons();
    const close = ()=> document.getElementById('modal-root').removeChild(modal);
    modal.querySelector('#xClose').onclick=close;
    modal.querySelector('input[name="op"][value="range"]').addEventListener('change',()=> modal.querySelector('#b').classList.remove('hidden'));
    modal.querySelector('input[name="op"][value="lt"]').addEventListener('change',()=> modal.querySelector('#b').classList.add('hidden'));
    modal.querySelector('input[name="op"][value="gt"]').addEventListener('change',()=> modal.querySelector('#b').classList.add('hidden'));
    modal.querySelector('#btnClear').onclick = ()=>{ filters[col]=null; render(); close(); };
    modal.querySelector('#btnApply').onclick = ()=>{
      const op = modal.querySelector('input[name="op"]:checked').value;
      const a = Number(modal.querySelector('#a').value);
      const b = Number(modal.querySelector('#b').value);
      if (!Number.isFinite(a)) return CM.UI.toast('Enter value','error');
      filters[col] = op==='range'? { op, a, b } : { op, a };
      render(); close();
    };
  }));

  // Add/Edit item modal
  document.getElementById('btnAdd').addEventListener('click', ()=> openEdit());
  root.addEventListener('click', async (e)=>{
    const id = e.target.closest('[data-edit]')?.dataset.edit;
    if (id) { const it = rows.find(r=>r.id===id); openEdit(it); }
    const did = e.target.closest('[data-del]')?.dataset.del;
    if (did) { if (await CM.utils.confirm('Delete item','This action cannot be undone.')) { await CM.DB.deleteInventory(did); rows = rows.filter(r=>r.id!==did); render(); CM.UI.toast('Item deleted'); } }
  });

  function openEdit(item){
    const isNew = !item;
    item = item || { name:'', purchasePrice:0, sellingPrice:0, stock:0 };
    const modal = CM.utils.el(`<div class="modal-backdrop"><div class="modal">
      <header><h3 class="font-semibold">${isNew?'Add':'Edit'} Item</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
      <div class="body grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-sm">Name</label>
          <input id="name" class="input" value="${item.name}"/>
        </div>
        <div>
          <label class="text-sm">Purchase Price</label>
          <input id="purchasePrice" type="number" min="0" class="input" value="${item.purchasePrice}"/>
        </div>
        <div>
          <label class="text-sm">Selling Price</label>
          <input id="sellingPrice" type="number" min="0" class="input" value="${item.sellingPrice}"/>
        </div>
        <div>
          <label class="text-sm">Stock</label>
          <input id="stock" type="number" min="0" class="input" value="${item.stock}"/>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnCancel">Cancel</button>
        <button class="btn btn-primary" id="btnSave">Save</button>
      </footer>
    </div></div>`);
    document.getElementById('modal-root').appendChild(modal);
    lucide.createIcons();
    const close=()=> document.getElementById('modal-root').removeChild(modal);
    modal.querySelector('#xClose').onclick=close;
    modal.querySelector('#btnCancel').onclick=close;
    modal.querySelector('#btnSave').onclick = async ()=>{
      const name = modal.querySelector('#name').value.trim();
      const purchasePrice = Number(modal.querySelector('#purchasePrice').value);
      const sellingPrice = Number(modal.querySelector('#sellingPrice').value);
      const stock = Number(modal.querySelector('#stock').value);
      if (!name) return CM.UI.toast('Name required','error');
      if (!Number.isFinite(purchasePrice) || purchasePrice<0) return CM.UI.toast('Invalid purchase price','error');
      if (!Number.isFinite(sellingPrice) || sellingPrice<0) return CM.UI.toast('Invalid selling price','error');
      if (sellingPrice < purchasePrice) return CM.UI.toast('Selling price cannot be less than purchase price','error');
      if (!Number.isFinite(stock) || stock<0) return CM.UI.toast('Invalid stock','error');

      try {
        if (isNew) {
          const created = await CM.DB.addInventory({ name, purchasePrice, sellingPrice, stock });
          rows.push(created);
        } else {
          await CM.DB.updateInventory(item.id, { name, purchasePrice, sellingPrice, stock });
          Object.assign(rows.find(r=>r.id===item.id), { name, purchasePrice, sellingPrice, stock });
        }
        render(); close(); CM.UI.toast('Saved');
      } catch(e){ console.error(e); CM.UI.toast('Save failed','error'); }
    };
  }

  // Export
  document.getElementById('btnExport').addEventListener('click', ()=>{
    CM.exporter.toXlsx('inventory.xlsx', rows.map(r=>({ Name:r.name, Purchase:r.purchasePrice, Selling:r.sellingPrice, Stock:r.stock })));
  });
};
