// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// In-app dialog instead of the browser's confirm()/alert(). Resolves true for the main button, false otherwise.
// tone: 'primary' (green) | 'danger' (red, Cancel focused first) | 'info' (amber); cancel: null for a one-button notice
function uiDialog({ title, message, ok = t('b.ok'), cancel = t('b.cancel'), tone = 'primary', icon = '✨' }) {
  return new Promise(resolve => {
    const back = document.activeElement;
    const scrim = document.createElement('div');
    scrim.className = 'dlg-scrim';
    scrim.innerHTML = `<div class="dlg ${tone}" role="alertdialog" aria-modal="true" aria-labelledby="dlgTitle" aria-describedby="dlgMsg">
        <div class="dlg-ic" aria-hidden="true">${icon}</div>
        <h2 id="dlgTitle">${esc(title)}</h2>
        <p id="dlgMsg">${message}</p>
        <div class="dlg-actions">
          ${cancel ? `<button type="button" class="dlg-btn ghost" data-v="0">${esc(cancel)}</button>` : ''}
          <button type="button" class="dlg-btn go" data-v="1">${ico(tone === 'danger' ? 'trash' : 'check2')}${esc(ok)}</button>
        </div>
      </div>`;
    document.body.appendChild(scrim);
    const btns = [...scrim.querySelectorAll('.dlg-btn')];
    const close = v => {
      document.removeEventListener('keydown', onKey, true);
      scrim.classList.remove('show');
      setTimeout(() => scrim.remove(), 180);
      if (back && back.focus) back.focus({ preventScroll: true });
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Tab') {   // keep focus inside the dialog
        e.preventDefault();
        const i = btns.indexOf(document.activeElement);
        btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    btns.forEach(b => b.onclick = () => close(b.dataset.v === '1'));
    scrim.addEventListener('mousedown', e => { if (e.target === scrim) close(false); });
    requestAnimationFrame(() => scrim.classList.add('show'));
    // Risky actions start on Cancel, so Enter doesn't delete by accident
    (tone === 'danger' && cancel ? btns[0] : btns[btns.length - 1]).focus();
  });
}
const uiConfirm = opts => uiDialog(opts);
const uiAlert = opts => uiDialog({ cancel: null, tone: 'info', icon: '⚠️', ...opts });

// Permissions of the signed-in user (from /api/me); the server checks them again on every call
const can = k => !!(currentUser && Array.isArray(currentUser.perms) && currentUser.perms.includes(k));

// While any request runs: wait cursor + loading bar (body.busy)
let busyCount = 0;
function setBusy(on) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  document.body.classList.toggle('busy', busyCount > 0);
}

async function api(method, url, body) {
  setBusy(true);
  try {
    const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) { location.replace('/'); throw new Error(t('e.session')); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error ? trServer(data.error) : t('e.request', { status: res.status })), { status: res.status, data });
    return data;
  } catch (err) {
    throw err instanceof TypeError ? new Error(t('e.server')) : err;
  } finally { setBusy(false); }
}
// POST the record to /api/excel/<kind> and save the .xlsx the server returns.
// kind: 'oqc' -> "OQC Data.xlsx", 'spec' -> "Spec.xlsx"
async function downloadExcel(kind, fileName, pages) {
  setBusy(true);
  try {
    const res = await fetch(`/api/excel/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, itemList: OQC_ITEMS.map(i => [i[0], i[1]]), pages }) });
    if (res.status === 401) { location.replace('/'); throw new Error(t('e.session')); }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ? trServer(data.error) : t('e.request', { status: res.status }));
    }
    const blob = await res.blob();
    const name = (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '') || [])[1] || `${fileName}.xlsx`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return name;
  } catch (err) {
    throw err instanceof TypeError ? new Error(t('e.server')) : err;
  } finally { setBusy(false); }
}
const fmtDate = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
