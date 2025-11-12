CM.Views.POS.render = async function() {
  const root = document.getElementById('view');
  const inventory = await CM.DB.listInventory();
  const cart = CM.State.cart;

  root.innerHTML = `
    <div class="grid md:grid-cols-2 gap-4">
      <div class="space-y-4">
        <div class="card p-4">
          <h2 class="font-semibold mb-3">Add Item</h2>
          <div class="mb-2">
            <input id="searchItem" class="input" placeholder="Search inventory..." />
          </div>
          <div class="max-h-56 overflow-auto border rounded-lg" id="inventoryTable"></div>
          <div class="flex gap-2 mt-3">
            <input id="qty" type="number" min="1" class="input w-32" placeholder="Qty" value="1"/>
            <button id="btnAddItem" class="btn btn-primary"><i data-lucide="plus"></i>Add to Cart</button>
          </div>
        </div>

        <div class="card p-4">
          <h2 class="font-semibold mb-3">Add Service</h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input id="svcName" class="input" placeholder="Service name" />
            <input id="svcPrice" type="number" min="0" class="input" placeholder="Price" />
            <button id="btnAddSvc" class="btn btn-primary"><i data-lucide="plus"></i>Add Service</button>
          </div>
        </div>
      </div>

      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-semibold">Current Sale</h2>
          <button id="btnClear" class="btn btn-soft">Clear</button>
        </div>
        <div id="cartList" class="space-y-2"></div>
        <div class="mt-3 border-t border-[var(--border)] pt-3 flex justify-between items-center">
          <div class="text-sm text-[var(--muted-foreground)]">Grand Total</div>
          <div id="grandTotal" class="text-xl font-semibold"></div>
        </div>
        <div class="mt-3 flex justify-end">
          <button id="btnComplete" class="btn btn-primary"><i data-lucide="check"></i>Complete Sale</button>
        </div>
      </div>
    </div>`;

  lucide.createIcons();

  // Inventory table with selection logic
  const tableWrap = document.getElementById('inventoryTable');
  let selectedId = null;
  function renderInventory(filter=''){
    const rows = inventory
      .filter(x => x.name.toLowerCase().includes(filter.toLowerCase()))
      .map(x => `<tr data-id="${x.id}" class="cursor-pointer hover-row ${selectedId===x.id?'bg-[var(--muted)]':''}"><td class="p-2">${x.name}</td><td class="p-2">₹${x.sellingPrice}</td><td class="p-2 ${x.stock<10?'text-[var(--danger)]':''}">${x.stock}</td></tr>`).join('');
    tableWrap.innerHTML = `<table class="table w-full"><thead><tr><th>Name</th><th>Price</th><th>Stock</th></tr></thead><tbody>${rows}</tbody></table>`;
    tableWrap.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', () => {
      selectedId = tr.dataset.id; renderInventory(document.getElementById('searchItem').value);
    }));
  }
  renderInventory();

  document.getElementById('searchItem').addEventListener('input', (e)=> renderInventory(e.target.value));

  document.getElementById('btnAddItem').addEventListener('click', () => {
    if (!selectedId) {
      CM.UI.toast('Please select an item from the list', 'warning', 'No Item Selected');
      return;
    }
    const item = inventory.find(i=>i.id===selectedId);
    const qty = Math.max(1, Number(document.getElementById('qty').value||1));
    if (qty > item.stock) {
      CM.UI.toast(`Only ${item.stock} units available in stock`, 'error', 'Insufficient Stock');
      return;
    }
    // push/update cart line
    const existing = cart.items.find(i=>i.type==='item' && i.id===item.id);
    if (existing) existing.quantity += qty; else cart.items.push({ type:'item', id:item.id, name:item.name, price:item.sellingPrice, quantity:qty, purchasePrice:item.purchasePrice });
    CM.UI.toast(`${item.name} x${qty} added to cart`, 'success', 'Item Added');
    renderCart();
  });

  document.getElementById('btnAddSvc').addEventListener('click', () => {
    const name = document.getElementById('svcName').value.trim();
    const price = Number(document.getElementById('svcPrice').value);
    if (!name || !Number.isFinite(price) || price<0) {
      CM.UI.toast('Enter a valid service name and price', 'error', 'Validation Error');
      return;
    }
    cart.items.push({ type:'service', id:`svc_${Date.now()}`, name, price, quantity:1 });
    CM.UI.toast(`${name} service added to cart`, 'success', 'Service Added');
    document.getElementById('svcName').value=''; document.getElementById('svcPrice').value='';
    renderCart();
  });

  document.getElementById('btnClear').addEventListener('click', () => {
    cart.items=[];
    CM.UI.toast('Cart cleared', 'info', 'Cart Cleared');
    renderCart();
  });

  function renderCart(){
    const list = document.getElementById('cartList');
    list.innerHTML = '';
    cart.items.forEach((it, idx) => {
      const lineTotal = it.price * it.quantity;
      const row = CM.utils.el(`<div class="flex items-center justify-between gap-3 p-2 border rounded-lg border-[var(--border)]">
        <div class="flex-1">
          <div class="font-medium">${it.name}</div>
          <div class="text-xs text-[var(--muted-foreground)]">${it.quantity} × ₹${it.price} = ₹${lineTotal}</div>
        </div>
        <div class="flex items-center gap-2">
          <input type="number" min="1" value="${it.quantity}" class="input w-20" data-idx="${idx}" data-field="quantity"/>
          <input type="number" min="0" value="${it.price}" class="input w-24" data-idx="${idx}" data-field="price"/>
          <button class="icon-btn" data-remove="${idx}"><i data-lucide="trash"></i></button>
        </div>
      </div>`);
      list.appendChild(row);
    });
    lucide.createIcons();

    // attach edits/removes
    list.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      const i = Number(b.dataset.remove);
      const itemName = cart.items[i].name;
      cart.items.splice(i,1);
      CM.UI.toast(`${itemName} removed from cart`, 'success', 'Item Removed');
      renderCart();
    }));
    list.querySelectorAll('input[data-field]').forEach(inp => inp.addEventListener('change', () => {
      const i = Number(inp.dataset.idx); const f = inp.dataset.field; const val = Number(inp.value);
      if (!Number.isFinite(val) || val<0) return;
      // If item and editing quantity, ensure stock
      if (f==='quantity' && cart.items[i].type==='item') {
        const inv = inventory.find(x=>x.id===cart.items[i].id);
        if (val > inv.stock) {
          CM.UI.toast(`Only ${inv.stock} units available in stock`, 'error', 'Stock Limit');
          inp.value=cart.items[i].quantity;
          return;
        }
      }
      cart.items[i][f] = f==='quantity'? Math.max(1, val) : val;
      renderCart();
    }));

    const total = cart.items.reduce((s,x)=> s + (x.price*x.quantity), 0);
    document.getElementById('grandTotal').textContent = CM.utils.fmtINR(total);
  }
  renderCart();

  document.getElementById('btnComplete').addEventListener('click', async () => {
    if (!cart.items.length) {
      CM.UI.toast('Please add items to cart before completing sale', 'warning', 'Empty Cart');
      return;
    }

    // Build sale doc
    const now = new Date();
    const items = cart.items.map(i => ({ id:i.id, name:i.name, price:i.price, quantity:i.quantity, type:i.type, ...(i.purchasePrice!==undefined?{purchasePrice:i.purchasePrice}:{} ) }));
    const totalAmount = cart.items.reduce((s,i)=> s + i.price*i.quantity, 0);
    const totalCost = cart.items.filter(i=>i.type==='item').reduce((s,i)=> s + (i.purchasePrice||0)*i.quantity, 0);

    const itemDeltas = cart.items.filter(i=>i.type==='item').map(i => ({ id:i.id, qty:i.quantity }));

    try {
      await CM.DB.addSale({ date: now, totalAmount, totalCost, items }, itemDeltas);
      cart.items = [];
      renderCart();
      CM.UI.toast(`Sale completed - Total: ${CM.utils.fmtINR(totalAmount)}`, 'success', 'Sale Complete');
    } catch (e) {
      console.error(e);
      CM.UI.toast('Failed to save sale. Please try again', 'error', 'Save Failed');
    }
  });
};
