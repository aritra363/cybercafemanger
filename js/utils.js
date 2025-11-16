window.CM = window.CM || {};

CM.utils = (() => {
  const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
  const fmtNum = (n) => new Intl.NumberFormat('en-IN').format(n || 0);
  const todayRange = () => { const d = new Date(); d.setHours(0,0,0,0); const s = d; const e = new Date(d); e.setHours(23,59,59,999); return [s,e]; };
  const weekRange = () => { const now=new Date(); const day=now.getDay(); const diff = (day===0?6:day-1); const start=new Date(now); start.setDate(now.getDate()-diff); start.setHours(0,0,0,0); const end=new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999); return [start,end]; };
  const monthRange = () => { const now=new Date(); const start=new Date(now.getFullYear(), now.getMonth(), 1); const end=new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59,999); return [start,end]; };
  const yearRange = () => { const now=new Date(); const start=new Date(now.getFullYear(),0,1); const end=new Date(now.getFullYear(),11,31,23,59,59,999); return [start,end]; };

  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const byId = (id) => document.getElementById(id);

  const between = (d, s, e) => d >= s && d <= e;

  const downloadBlob = (blob, filename) => {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const valNum = (v, fallback=0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const confirm = async (title, message) => new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const modal = el(`<div class="modal-backdrop">
      <div class="modal" style="max-width: 400px;">
        <header>
          <h3>${title}</h3>
          <button class="icon-btn" id="xClose"><i data-lucide="x"></i></button>
        </header>
        <div class="body">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 2rem; color: var(--danger);">⚠️</div>
            <div style="flex: 1; color: var(--muted-foreground);">${message}</div>
          </div>
        </div>
        <footer>
          <button class="btn btn-soft" id="btnCancel">Cancel</button>
          <button class="btn btn-danger" id="btnOk"><i data-lucide="trash-2"></i>Delete</button>
        </footer>
      </div>
    </div>`);
    root.appendChild(modal);
    lucide.createIcons();
    modal.querySelector('#xClose').onclick = () => { root.removeChild(modal); resolve(false); };
    modal.querySelector('#btnCancel').onclick = () => { root.removeChild(modal); resolve(false); };
    modal.querySelector('#btnOk').onclick = () => { root.removeChild(modal); resolve(true); };
  });

  return { fmtINR, fmtNum, todayRange, weekRange, monthRange, yearRange, byId, el, between, downloadBlob, valNum, confirm };
})();
