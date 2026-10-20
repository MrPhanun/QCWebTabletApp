// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Search Draft / Save: find saved OQC records (by text and Shipment Date); each row can be opened in OQC Data
// Information, exported to Excel, printed to PDF or deleted.
let pendingOqc = null;   // { id, pdf, check }: read by renderOQC when it opens
function gotoOQC(id, pdf, check) { pendingOqc = { id, pdf: !!pdf, check: !!check }; select('daily'); }

function renderDraft(panel) {
  const canExcel = can('daily.excel');
  panel.innerHTML = `
    <div class="oqc-toolbar">
      <label class="search oqc-scan">
        ${svg('list')}<input id="drQ" type="search" ${P('ph.find')} aria-label="Search saved records" autocomplete="off">
        <span class="spinner" aria-hidden="true"></span><span class="busy-note">${T('loading')}</span>
      </label>
      <label class="oqc-ship">${T('o.shipFrom')}<input type="date" id="drFrom" aria-label="Shipment Date from"></label>
      <label class="oqc-ship">${T('o.shipTo')}<input type="date" id="drTo" aria-label="Shipment Date to"></label>
      <select id="drCust" class="cust-filter" aria-label="Filter by Customer"><option value="">${esc(t('cust.all'))}</option></select>
      <div class="seg type-seg" id="drType" role="group" aria-label="Filter by Type" data-value="">
        <button type="button" data-type="" aria-pressed="true">${T('type.all')}</button>
        <button type="button" data-type="Normal" aria-pressed="false">${T('type.normal')}</button>
        <button type="button" data-type="First Slot" aria-pressed="false">${T('type.firstSlot')}</button>
        <button type="button" data-type="Sample" aria-pressed="false">${T('type.sample')}</button>
      </div>
      <button class="btn-primary" id="drSearch" type="button">${ico('search')}${T('b.search')}</button>
      <span class="count" id="drCount"></span>
      <div class="msg" id="drMsg" role="status"></div>
    </div>
    <div class="table-wrap"><table class="data">
      <thead><tr>${['h.lot', 'h.box', 'h.itemCode', 'h.partNo', 'h.type', 'h.customer', 'h.checkDate', 'h.shipDate', 'h.shipQty', 'h.pages', 'h.status', 'h.total', 'h.excelStatus', 'h.pdfStatus', 'h.lastSaved']
        .map(k => `<th>${T(k)}</th>`).join('')}<th></th></tr></thead>
      <tbody id="drBody"></tbody>
    </table></div>`;

  enhanceDates(panel);
  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('drMsg').textContent = text; $('drMsg').className = 'msg ' + kind; };
  const s2 = x => esc(String(x ?? ''));
  let list = [], timer = 0;

  // Excel / PDF status: Draft until it is downloaded, then Printed (back to Draft when the record changes)
  const printPill = on => `<span class="pill ${on ? 'done' : 'draft'}">${esc(t(on ? 'st.printed' : 'st.draft'))}</span>`;
  const typePill = ty => `<span class="type-badge ${ty === 'First Slot' ? 'first' : ty === 'Sample' ? 'sample' : 'normal'}">${esc(t(ty === 'First Slot' ? 'type.firstSlot' : ty === 'Sample' ? 'type.sample' : 'type.normal'))}</span>`;
  const label = r => `${r.lot}${r.box ? ` / Box ${r.box}` : ''}`;

  // Customer list: every Customer on the saved records (the chosen one stays selected)
  async function fillCustomers() {
    try {
      const names = await api('GET', '/api/oqc/records?customers=1'), sel = $('drCust'), keep = sel.value;
      sel.innerHTML = `<option value="">${esc(t('cust.all'))}</option>` + names.map(n => `<option value="${s2(n)}">${s2(n)}</option>`).join('');
      sel.value = names.includes(keep) ? keep : '';
    } catch { /* the list is only a help: search still works */ }
  }
  async function search() {
    const qs = new URLSearchParams({ q: $('drQ').value.trim(), from: $('drFrom').value, to: $('drTo').value, type: $('drType').dataset.value, customer: $('drCust').value });
    try {
      list = await api('GET', `/api/oqc/records?${qs}`);
      $('drCount').textContent = t('rec.count', { n: list.length === 200 ? '200+' : list.length, s: list.length === 1 ? '' : 's' });
      const filtered = $('drQ').value.trim() || $('drFrom').value || $('drTo').value || $('drType').dataset.value || $('drCust').value;
      $('drBody').innerHTML = list.map(r => `<tr data-id="${r.id}">
          <td class="num">${s2(r.lot)}</td><td>${s2(r.box)}</td><td class="num">${s2(r.itemCode)}</td><td>${s2(r.partNo)}</td>
          <td>${typePill(r.type)}</td>
          <td class="txt" title="${s2(r.customer)}">${s2(r.customer)}</td><td>${s2(r.checkDate)}</td><td>${s2(r.shipDate)}</td>
          <td class="num">${r.qty ?? ''}</td>
          <td class="num">${r.pageCount}</td>
          <td><span class="pill ${r.complete ? 'done' : 'draft'}">${esc(t(r.complete ? 'st.complete' : 'st.draft'))}</span></td>
          <td>${r.total ? `<span class="pill ${r.total === 'NG' ? 'ng' : 'ok'}">${r.total}</span>` : ''}</td>
          <td>${printPill(r.excelPrinted)}</td><td>${printPill(r.pdfPrinted)}</td>
          <td class="meta">${s2(r.updateBy)} · ${fmtDate(r.updateDate)}</td>
          <td><div class="row-actions"><button class="icon-btn" data-open="${r.id}">${ico('folderOpen')}${T('b.open')}</button>${canExcel
            ? `<button class="icon-btn" data-excel="${r.id}">${ico('excel')}${T('b.excel')}</button><button class="icon-btn" data-pdf="${r.id}">${ico('printer')}${T('b.pdf')}</button>` : ''}${can('daily.delete')
            ? `<button class="icon-btn del" data-del="${r.id}">${ico('trash')}${T('b.delete')}</button>` : ''}</div></td>
        </tr>`).join('') || `<tr><td colspan="16" class="empty-row">${esc(t(filtered ? 'rec.noMatch' : 'rec.none'))}</td></tr>`;
    } catch (err) { msg(err.message); }
  }

  // What is still empty in a record: OQC Data Information is rendered off-screen with the record and checked
  function missingFor(id) {
    const hook = langHook;
    return new Promise((resolve, reject) => renderOQC(document.createElement('div'), { report: { id, done: (lines, err) => err ? reject(err) : resolve(lines) } }))
      .finally(() => { langHook = hook; });
  }
  // Saving a draft may leave anything blank, but Excel / PDF need every requirement filled in: otherwise say what is missing
  async function needComplete(r) {
    if (r.complete) return true;
    let lines = [];
    try { lines = await missingFor(r.id); } catch (err) { msg(err.message); return false; }
    if (!lines.length) return true;
    msg(t('dr.cantPrint', { label: label(r) }));
    await uiAlert({ icon: '🚫', title: t('dr.cantPrintT'), message: `${esc(t('dr.cantPrint', { label: label(r) }))}<br><br>${lines.join('<br>')}`, ok: t('b.gotIt') });
    return false;
  }

  $('drBody').onclick = async e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const id = Number(btn.dataset.open || btn.dataset.excel || btn.dataset.pdf || btn.dataset.del);
    const r = list.find(x => x.id === id); if (!r) return;
    if (btn.dataset.open) return gotoOQC(id, false, !r.complete);
    // PDF: the filled "OQC Data.xlsx" is printed to a PDF (Microsoft Print to PDF) and saved on this computer
    if (btn.dataset.pdf) {
      try {
        if (!await needComplete(r)) return;
        const full = await api('GET', `/api/oqc/records/${id}`);
        const file = await downloadFile(`/api/oqc/records/${id}/pdf`, `OQC_${full.lot}${full.box ? '_' + full.box : ''}`, '.pdf', []);
        msg(t('o.excelDone', { file }), 'ok');
        search();
      } catch (err) { msg(err.message); }
      return;
    }
    // Excel: the saved pages go into "OQC Data.xlsx", downloaded
    if (btn.dataset.excel) {
      try {
        if (!await needComplete(r)) return;
        const full = await api('GET', `/api/oqc/records/${id}`);
        const file = await downloadFile(`/api/oqc/records/${id}/excel`, `OQC_${full.lot}${full.box ? '_' + full.box : ''}`, '.xlsx', []);
        msg(t('o.excelDone', { file }), 'ok');
        search();
      } catch (err) { msg(err.message); }
      return;
    }
    if (btn.dataset.del) {
      if (!await uiConfirm({ tone: 'danger', icon: '🗑️', title: t('o.delT'), message: t('o.delM', { label: esc(label(r)) }),
        ok: t('b.delete'), cancel: t('b.cancel') })) return;
      try {
        await api('DELETE', `/api/oqc/records/${id}`);
        msg(t('o.deleted', { label: label(r) }), 'ok');
        search();
      } catch (err) { msg(err.message); }
    }
  };

  $('drSearch').onclick = search;
  $('drQ').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 300); });
  $('drType').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('drType').dataset.value = b.dataset.type;
    $('drType').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    search();
  });
  $('drCust').addEventListener('change', search);
  $('drFrom').addEventListener('change', search);
  $('drTo').addEventListener('change', search);
  langHook = () => { fillCustomers(); search(); };
  fillCustomers();
  search();
  $('drQ').focus();
}
