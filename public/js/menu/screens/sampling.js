// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Sampling Plan: Level + Shipment Qty range ("101-150") -> sample Qty
function renderSampling(panel) {
  let rows = [], editId = 0, level = 'Normal', status = 'active';   // status: 'active' | 'deleted' (Delete only sets DelStatus)
  // Add / Edit / Delete follow Roles & Permissions (the server enforces them too)
  const canAdd = can('sampling.add'), canEdit = can('sampling.edit'), canDel = can('sampling.delete');
  panel.innerHTML = `
    <div class="readonly-note" ${canAdd || canEdit || canDel ? 'hidden' : ''}>
      ${svg('lock')} ${T('sp.readonly')}
    </div>
    <form class="form-grid" id="spForm" novalidate ${canAdd ? '' : 'hidden'}>
      <div class="fld fld-level">${T('sp.level')}
        <div class="seg" role="group" aria-label="Level">
          <button type="button" data-level="Normal" aria-pressed="true">Normal</button>
          <button type="button" data-level="Hard" aria-pressed="false">Strict</button>
        </div>
      </div>
      <label class="fld">${T('sp.ship')} <input id="spRange" inputmode="numeric" ${P('ph.range')} autocomplete="off"></label>
      <label class="fld">${T('sp.inspAll')} <input id="spQty" inputmode="numeric" ${P('ph.qty')} autocomplete="off"></label>
      <div class="form-actions">
        <button class="btn-primary" id="spSubmit" type="submit">${ico('plus')}${T('b.add')}</button>
        <button class="icon-btn" id="spCancel" type="button" hidden>${ico('x')}${T('b.cancel')}</button>
      </div>
    </form>
    <label class="flt-pdf"><span>${T('h.delStatus')}</span>
      <div class="seg type-seg" id="spStatus" role="group" aria-label="Filter by Record Status">
        <button type="button" data-v="active" aria-pressed="true">${T('st.active')}</button>
        <button type="button" data-v="deleted" aria-pressed="false">${T('st.deleted')}</button>
      </div></label>
    <div class="msg" id="spMsg" role="status"></div>
    <div id="spTables"></div>`;

  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('spMsg').textContent = text; $('spMsg').className = 'msg ' + kind; };
  const setLevel = l => {
    level = l;
    panel.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.level === l));
  };
  panel.querySelectorAll('.seg button').forEach(b => b.onclick = () => setLevel(b.dataset.level));

  function resetForm() {
    editId = 0;
    $('spForm').reset();
    $('spSubmit').innerHTML = ico('plus') + T('b.add');
    $('spCancel').hidden = true;
    $('spForm').hidden = !canAdd;
    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    drawTables();
  }
  $('spCancel').onclick = () => { resetForm(); msg(''); };

  function drawTables() {
    $('spTables').innerHTML = ['Normal', 'Hard'].map(l => {
      const list = rows.filter(r => r.level === l).sort((a, b) => a.qtyFrom - b.qtyFrom);
      let body = '';
      list.forEach((r, i) => {
        const prev = list[i - 1];
        if (status === 'active' && prev && r.qtyFrom > prev.qtyTo + 1) {
          body += `<tr class="gap"><td colspan="4">${esc(t('sp.gap', { from: prev.qtyTo + 1, to: r.qtyFrom - 1, level: LVL(l) }))}</td></tr>`;
        }
        body += `<tr class="${status === 'deleted' ? 'deleted' : r.id === editId ? 'editing' : ''}">
          <td class="num">${r.qtyFrom}-${r.qtyTo}</td>
          <td class="num">${r.sampleQty}</td>
          <td class="meta">${esc(String(r.updateBy || ''))} · ${fmtDate(r.updateDate)}</td>
          <td>${status === 'active' && (canEdit || canDel) ? `<div class="row-actions">
            ${canEdit ? `<button class="icon-btn" data-edit="${r.id}">${ico('pencil')}${T('b.edit')}</button>` : ''}
            ${canDel ? `<button class="icon-btn del" data-del="${r.id}">${ico('trash')}${T('b.delete')}</button>` : ''}
          </div>` : ''}</td></tr>`;
      });
      return `<div class="lvl-head"><span class="lvl-pill ${l}">${LVL(l)}</span>${esc(t('sp.count', { n: list.length }))}</div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>${T('sp.ship')}</th><th>${T('sp.inspAll')}</th><th>${T('h.lastUpdated')}</th><th></th></tr></thead>
          <tbody>${body || `<tr><td colspan="4" class="empty-row">${esc(t('sp.none', { level: LVL(l) }))}</td></tr>`}</tbody>
        </table></div>`;
    }).join('');
  }

  async function load() {
    try { rows = await api('GET', `/api/sampling?status=${status}`); drawTables(); }
    catch (e) { msg(e.message); }
  }
  $('spStatus').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    status = b.dataset.v;
    $('spStatus').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    if (editId) resetForm();
    $('spForm').hidden = !canAdd || status === 'deleted';
    msg('');
    load();
  };

  $('spTables').onclick = async e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) {
      $('spForm').hidden = false;
      const r = rows.find(x => x.id === Number(ed.dataset.edit));
      editId = r.id;
      setLevel(r.level);
      $('spRange').value = `${r.qtyFrom}-${r.qtyTo}`;
      $('spQty').value = r.sampleQty;
      $('spSubmit').innerHTML = ico('save') + T('b.save');
      $('spCancel').hidden = false;
      msg(t('sp.editing', { level: LVL(r.level), range: `${r.qtyFrom}-${r.qtyTo}` }), 'ok');
      drawTables();
      $('spRange').focus();
    }
    if (del) {
      const r = rows.find(x => x.id === Number(del.dataset.del));
      if (!await uiConfirm({ tone: 'danger', icon: '🗑️', title: t('sp.delT'),
        message: t('sp.delM', { level: LVL(r.level), range: `${r.qtyFrom}-${r.qtyTo}`, qty: r.sampleQty }),
        ok: t('b.delete'), cancel: t('b.keep') })) return;
      try {
        await api('DELETE', `/api/sampling/${r.id}`);
        if (editId === r.id) resetForm();
        msg(t('sp.deleted', { level: LVL(r.level), range: `${r.qtyFrom}-${r.qtyTo}` }), 'ok');
        await load();
      } catch (err) { msg(err.message); }
    }
  };

  $('spForm').onsubmit = async e => {
    e.preventDefault();
    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    const m = $('spRange').value.match(/^\s*(\d+)\s*[-–~]\s*(\d+)\s*$/);
    const qty = $('spQty').value.trim();
    if (!m) { $('spRange').classList.add('bad'); $('spRange').focus(); return msg(t('sp.errRange')); }
    const from = Number(m[1]), to = Number(m[2]);
    if (to < from) { $('spRange').classList.add('bad'); $('spRange').focus(); return msg(t('sp.errOrder')); }
    if (!/^\d+$/.test(qty) || Number(qty) < 1) { $('spQty').classList.add('bad'); $('spQty').focus(); return msg(t('sp.errQty')); }

    $('spSubmit').disabled = true;
    try {
      const body = { level, qtyFrom: from, qtyTo: to, sampleQty: Number(qty) };
      if (editId) await api('PUT', `/api/sampling/${editId}`, body);
      else await api('POST', '/api/sampling', body);
      msg(t(editId ? 'sp.saved' : 'sp.added', { level: LVL(level), range: `${from}-${to}`, qty }), 'ok');
      const keepLevel = level;
      resetForm(); setLevel(keepLevel);
      await load();
      $('spRange').focus();
    } catch (err) {
      if (/overlap/i.test(err.message)) $('spRange').classList.add('bad');
      msg(err.message);
    } finally { $('spSubmit').disabled = false; }
  };

  langHook = drawTables;
  load();
}
