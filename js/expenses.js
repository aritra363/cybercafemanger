CM.Views.Expenses.render = async function() {
  const root = document.getElementById('view');
  const state = CM.State.filters.expenses;

  root.innerHTML = `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-semibold">Expenses</h1>
        <div class="flex gap-2">
          ${['today','week','month','year','all','custom'].map(r=>`<button class="btn btn-soft ${state.range===r?'ring-2 ring-[var(--primary)]':''}" data-range="${r}">${r[0].toUpperCase()+r.slice(1)}</button>`).join('')}
          <input type="date" id="fromDate" class="input w-40 hidden"/>
          <input type="date" id="toDate" class="input w-40 hidden"/>
          <button id="btnExport" class="btn btn-primary"><i data-lucide="download"></i>Export XLSX</button>
          <button id="btnAdd" class="btn btn-primary"><i data-lucide="plus"></i>Add Expense</button>
        </div>
      </div>

      <div class="card p-3 overflow-auto">
        <table class="table w-full min-w-[640px]">
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
          <tbody id="expBody"></tbody>
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
    else if (rng==='custom') { start=new Date(document.getElementById('fromDate').value); end=new Date(document.getElementById('toDate').value); if (!start||!end) return; }

    const items = await CM.DB.listExpenses(rng==='all'? null : { start, end });
    const body = document.getElementById('expBody'); body.innerHTML='';
    items.forEach(x => {
      const d = x.date?.toDate? x.date.toDate(): new Date(x.date);
      body.appendChild(CM.utils.el(`<tr class="hover-row"><td>${d.toLocaleDateString()}</td><td>${x.description}</td><td>${CM.utils.fmtINR(x.amount)}</td><td><button class="icon-btn" data-del="${x.id}"><i data-lucide="trash"></i></button></td></tr>`));
    });
    exportRows = items.map(x=>({ Date:(x.date?.toDate? x.date.toDate(): new Date(x.date)).toLocaleDateString(), Description:x.description, Amount:x.amount }));
  }

  await refresh();

  // Add
  document.getElementById('btnAdd').addEventListener('click', ()=>{
    const modal = CM.utils.el(`<div class="modal-backdrop"><div class="modal">
      <header><h3>Record New Expense</h3><button class="icon-btn" id="xClose"><i data-lucide="x"></i></button></header>
      <div class="body">
        <div class="space-y-4">
          <div>
            <label>Date</label>
            <input id="date" type="date" class="input"/>
          </div>
          <div>
            <label>Description</label>
            <input id="desc" class="input" placeholder="e.g., Office supplies, Rent, etc."/>
          </div>
          <div>
            <label>Amount (₹)</label>
            <input id="amt" type="number" min="0" step="0.01" class="input" placeholder="Enter amount"/>
          </div>
        </div>
      </div>
      <footer>
        <button class="btn btn-soft" id="btnCancel">Cancel</button>
        <button class="btn btn-primary" id="btnSave"><i data-lucide="save"></i>Add Expense</button>
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
      const dateStr = modal.querySelector('#date').value; const description = modal.querySelector('#desc').value.trim(); const amount = Number(modal.querySelector('#amt').value);
      if (!dateStr || !description || !Number.isFinite(amount) || amount<0) {
        CM.UI.toast('Please fill all fields correctly', 'error', 'Validation Error');
        return;
      }
      try {
        await CM.DB.addExpense({ date:new Date(dateStr), description, amount });
        close();
        CM.UI.toast('Expense added successfully', 'success', 'Expense Created');
        await refresh();
      } catch (err) {
        CM.UI.toast('Failed to add expense', 'error', 'Add Failed');
      }
    };
  });

  // Delete
  root.addEventListener('click', async (e)=>{
    const id = e.target.closest('[data-del]')?.dataset.del; if (!id) return;
    if (await CM.utils.confirm('Delete expense','This will remove the expense.')) {
      try {
        await CM.DB.deleteExpense(id);
        CM.UI.toast('Expense deleted successfully', 'success', 'Deleted');
        await refresh();
      } catch (err) {
        CM.UI.toast('Failed to delete expense', 'error', 'Delete Failed');
      }
    }
  });

  document.getElementById('btnExport').addEventListener('click', ()=> {
    try {
      CM.exporter.toXlsx('expenses.xlsx', exportRows);
      CM.UI.toast('Expenses exported successfully', 'success', 'Export Complete');
    } catch (err) {
      CM.UI.toast('Failed to export expenses', 'error', 'Export Failed');
    }
  });
};
