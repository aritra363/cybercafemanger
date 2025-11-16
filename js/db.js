window.CM = window.CM || {};

CM.DB = (() => {
  const waitReady = () => new Promise((res) => {
    if (CM.firebase?.db) return res();
    document.addEventListener('cm:firebase-ready', () => res(), { once:true });
  });

  async function addInventory(item) {
    await waitReady();
    const { db, fire } = CM.firebase;
    const ref = await fire.addDoc(fire.collection(db, 'inventory'), item);
    return { id: ref.id, ...item };
  }
  async function updateInventory(id, patch) {
    await waitReady(); const { db, fire } = CM.firebase;
    await fire.updateDoc(fire.doc(db, 'inventory', id), patch);
  }
  async function deleteInventory(id) {
    await waitReady(); const { db, fire } = CM.firebase;
    await fire.deleteDoc(fire.doc(db, 'inventory', id));
  }
  async function listInventory() {
    await waitReady(); const { db, fire } = CM.firebase;
    const snap = await fire.getDocs(fire.query(fire.collection(db,'inventory'), fire.orderBy('name')));
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }

  async function addExpense(exp) {
    await waitReady(); const { db, fire } = CM.firebase;
    const ref = await fire.addDoc(fire.collection(db,'expenses'), exp);
    return { id: ref.id, ...exp };
  }
  async function listExpenses(range) {
    await waitReady(); const { db, fire } = CM.firebase;
    let q = fire.collection(db,'expenses');
    if (range?.start && range?.end) {
      q = fire.query(q, fire.where('date','>=', range.start), fire.where('date','<=', range.end), fire.orderBy('date','desc'));
    } else q = fire.query(q, fire.orderBy('date','desc'));
    const snap = await fire.getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }
  async function deleteExpense(id) {
    await waitReady(); const { db, fire } = CM.firebase;
    await fire.deleteDoc(fire.doc(db,'expenses', id));
  }
  async function updateExpense(id, updates) {
    await waitReady(); const { db, fire } = CM.firebase;
    await fire.updateDoc(fire.doc(db,'expenses', id), updates);
  }

  async function getStockThreshold() {
    await waitReady(); const { db, fire } = CM.firebase;
    try {
      const docRef = fire.doc(db, 'settings', 'stockThreshold');
      const snap = await fire.getDoc(docRef);
      return snap.exists() ? snap.data().value : 10;
    } catch (e) {
      console.warn('Error fetching stock threshold:', e);
      return 10;
    }
  }

  async function setStockThreshold(value) {
    await waitReady(); const { db, fire } = CM.firebase;
    try {
      const docRef = fire.doc(db, 'settings', 'stockThreshold');
      await fire.setDoc(docRef, { value }, { merge: true });
      return value;
    } catch (e) {
      console.error('Error saving stock threshold:', e);
      throw e;
    }
  }

  async function addSale(sale, itemDeltas) {
    await waitReady(); const { db, fire } = CM.firebase;
    // Batch: create sale and update stocks atomically
    const batch = fire.writeBatch(db);
    const saleRef = fire.doc(fire.collection(db,'sales'));
    batch.set(saleRef, sale);
    for (const { id, qty } of itemDeltas) {
      const invRef = fire.doc(db,'inventory', id);
      batch.update(invRef, { stock: fire.increment(-qty) });
    }
    await batch.commit();
    return saleRef.id;
  }
  async function listSales(range) {
    await waitReady(); const { db, fire } = CM.firebase;
    let q = fire.collection(db,'sales');
    if (range?.start && range?.end) {
      q = fire.query(q, fire.where('date','>=', range.start), fire.where('date','<=', range.end), fire.orderBy('date','desc'));
    } else q = fire.query(q, fire.orderBy('date','desc'));
    const snap = await fire.getDocs(q);
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  }

  return { addInventory, updateInventory, deleteInventory, listInventory, addExpense, listExpenses, deleteExpense, updateExpense, addSale, listSales, getStockThreshold, setStockThreshold };
})();
