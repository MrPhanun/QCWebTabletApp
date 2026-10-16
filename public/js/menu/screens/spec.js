// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// SPEC master: per Part No the material check text (Wire / Terminal / Housing / Other)
// and up to 22 Length Position + SPEC rows, edited in the same layout as the OQC record
function renderSpec(panel) {
  const canAdd = can('spec.add'), canEdit = can('spec.edit'), canDel = can('spec.delete'), canExcel = can('spec.excel');
  // [field, №, Khmer, English] for 1) MATERIAL CHECK
  const MATERIAL = [['wire', '①', 'ខ្សែ', 'Wire'], ['terminal', '②', 'ធឺរមីណល', 'Terminal'], ['housing', '③', 'ហៅស៊ីង', 'Housing'], ['other', '④', 'ផ្សេងៗ', 'Other']];
  let rows = [], editId = 0, mode = '';   // mode: '' (closed) | 'new' | 'edit' | 'copy' | 'view'
  // Cells that are only filled in during an inspection show as greyed blanks
  const na = (attrs = '') => `<td class="na" ${attrs}></td>`;

  const lenTable = from => `<table class="oqc oqc-len">
      <thead>
        <tr><th class="c" rowspan="2">№</th><th rowspan="2">${bi('ទីតាំងប្រវែង', 'Length Position')}</th>
          <th rowspan="2">${bi('តំលៃប្រវែងកំនត់', 'SPEC')}</th><th class="c" colspan="5">Sample</th></tr>
        <tr>${OQC_CIRC.map(c => `<th class="c">${c}</th>`).join('')}</tr>
      </thead>
      <tbody>${Array.from({ length: 11 }, (_, k) => from + k).map(i => `<tr>
        <td class="no">${i}</td>
        <td class="pos"><input data-pos="${i}" maxlength="50" aria-label="Length position ${i}"></td>
        <td class="spc"><input data-spec="${i}" maxlength="50" aria-label="SPEC ${i}" placeholder="20±5"></td>
        ${OQC_CIRC.map(() => na()).join('')}</tr>`).join('')}
        <tr class="sec"><td colspan="3">${bi('លទ្ធផល', 'Result')}</td>${na('colspan="5"')}</tr>
      </tbody></table>`;

  panel.innerHTML = `
    <div class="readonly-note" ${canAdd || canEdit || canDel ? 'hidden' : ''}>${svg('lock')} ${T('sc.readonly')}</div>
    <div class="msg" id="scMsg" role="status"></div>
    <form class="oqc-sheet spec-editor" id="scForm" novalidate autocomplete="off" hidden>
      <div class="spec-edit-bar">
        <h3><span id="scTitle"></span><small id="scSub"></small></h3>
        <div class="form-actions">
          <button class="icon-btn" id="scPrint" type="button">${ico('excel')}${T('b.excel')}</button>
          <button class="icon-btn" id="scCancel" type="button">${ico('x')}${T('b.cancel')}</button>
          <button class="btn-primary" id="scSave" type="submit">${ico('save')}${T('b.save')}</button>
        </div>
      </div>
      ${oqcHead(`<span>${bi('ថ្ងៃត្រួតពិនិត្យ', 'CHECK DATE')}</span>`)}

      <div class="oqc-info-wrap"><table class="oqc oqc-info">
        <tr>${OQC_INFO.map(([km, en]) => `<th class="c">${bi(km, en)}</th>`).join('')}</tr>
        <tr>${OQC_INFO.map(([, en]) => en === 'CUSTOMER'
          ? `<td><input id="scCustomer" class="big" maxlength="100" aria-label="Customer"></td>`
          : en === 'PART №' ? `<td><input id="scPart" class="big" maxlength="100" aria-label="Part No" placeholder="FM4-H915-000"></td>` : na()).join('')}</tr>
      </table></div>

      <div class="oqc-cols">
        <table class="oqc">
          <tr><th>${bi('ប្រការត្រូវពិនិត្យ', 'INSPECTION ITEM')}</th><th class="c">${bi('លទ្ធផល', 'Result')}</th></tr>
          <tr class="sec"><td>${bi('1) ត្រួតពិនិត្យវត្ថុធាតុដើម', 'MATERIAL CHECK')}</td>${na()}</tr>
          ${MATERIAL.map(([k, n, km, en]) => `<tr><td colspan="2">
            <div class="oqc-sec-title">${n} <span class="km">${km}</span> <span class="en">[${en}]</span></div>
            <textarea id="sc-${k}" rows="2" maxlength="1000" aria-label="${en}"></textarea></td></tr>`).join('')}
        </table>
        <table class="oqc">
          <tr><th>${bi('ប្រការត្រូវពិនិត្យ', 'INSPECTION ITEM')}</th><th class="c">${bi('លទ្ធផល', 'Result')}</th></tr>
          ${OQC_ITEMS.map(([km, en]) => `<tr><td>${bi(km, en)}</td>${na()}</tr>`).join('')}
        </table>
      </div>

      <div>
        <div class="oqc-sec-title"><span class="km">2) ត្រួតពិនិត្យប្រវែង</span> <span class="en">[Length Check]</span></div>
        <div class="oqc-cols">
          <div class="oqc-len-wrap">${lenTable(1)}</div>
          <div class="oqc-len-wrap">${lenTable(12)}</div>
        </div>
      </div>

      <div class="oqc-foot-wrap"><table class="oqc oqc-foot">
        <tr>
          <td rowspan="2" style="width:52%">${bi('កំនត់សំគាល់', 'Remarks')}</td>
          <th class="c">${bi('អនុម័តដោយ', 'Approved by')}</th>
          <th class="c">${bi('ត្រួតពិនិត្យដោយ', 'Checked by')}</th>
          <th class="c">${bi('អ្នកត្រួតពិនិត្យ', 'Inspector')}</th>
        </tr>
        <tr>${na()}${na()}${na()}</tr>
      </table></div>
    </form>
    <div class="spec-bar">
      <label class="search">${svg('list')}<input id="scSearch" type="search" ${P('ph.scSearch')} aria-label="Search SPEC"></label>
      ${canAdd ? `<button class="btn-primary" id="scAdd" type="button">${ico('plus')}${T('b.add')}</button>` : ''}
      <span class="count" id="scCount"></span>
      <span class="spinner" aria-hidden="true"></span><span class="busy-note">${T('loading')}</span>
    </div>
    <div class="table-wrap spec-list"><table class="data">
      <thead><tr>${['h.customer', 'h.partNo', 'h.wire', 'h.terminal', 'h.housing', 'h.other', 'h.length', 'h.lastUpdated'].map(k => `<th>${T(k)}</th>`).join('')}<th></th></tr></thead>
      <tbody id="scBody"></tbody>
    </table></div>`;

  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('scMsg').textContent = text; $('scMsg').className = 'msg ' + kind; };
  const s = v => esc(String(v ?? ''));

  function drawList() {
    const q = $('scSearch').value.trim().toLowerCase();
    const hit = r => !q || [r.customer, r.partNo, r.wire, r.terminal, r.housing, r.other, ...r.lengths.flatMap(l => [l.position, l.spec])]
      .some(v => String(v || '').toLowerCase().includes(q));
    const list = rows.filter(hit);
    $('scCount').textContent = q ? t('sc.countOf', { n: list.length, total: rows.length }) : t('sc.count', { n: rows.length });
    $('scBody').innerHTML = list.map(r => `<tr class="${r.id === editId && mode === 'edit' ? 'editing' : r.id === editId && mode === 'copy' ? 'copying' : ''}">
        <td>${s(r.customer)}</td>
        <td>${s(r.partNo)}</td>
        ${['wire', 'terminal', 'housing', 'other'].map(k => `<td class="txt" title="${s(r[k])}">${s(r[k])}</td>`).join('')}
        <td class="num">${r.lengths.length}</td>
        <td class="meta">${s(r.updateBy)} · ${fmtDate(r.updateDate)}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-act="view" data-id="${r.id}">${ico('eye')}${T('b.view')}</button>
          ${canExcel ? `<button class="icon-btn" data-act="print" data-id="${r.id}">${ico('excel')}${T('b.excel')}</button>` : ''}
          ${canEdit ? `<button class="icon-btn" data-act="edit" data-id="${r.id}">${ico('pencil')}${T('b.edit')}</button>` : ''}
          ${canAdd ? `<button class="icon-btn" data-act="copy" data-id="${r.id}">${ico('copy')}${T('b.copy')}</button>` : ''}
          ${canDel ? `<button class="icon-btn del" data-act="del" data-id="${r.id}">${ico('trash')}${T('b.delete')}</button>` : ''}</div></td>
      </tr>`).join('') || `<tr><td colspan="9" class="empty-row">${esc(t(rows.length ? 'sc.noMatch' : 'sc.none'))}</td></tr>`;
  }

  // Open the editor: 'new' = blank, 'edit' = this row, 'copy' = this row's data with a blank Part No, 'view' = read-only
  function openEditor(m, r) {
    mode = m; editId = r ? r.id : 0;
    $('scForm').reset();
    if (r) {
      $('scCustomer').value = r.customer || '';
      $('scPart').value = m === 'copy' ? '' : r.partNo || '';
      MATERIAL.forEach(([k]) => $('sc-' + k).value = r[k] || '');
      r.lengths.forEach(l => {
        const p = panel.querySelector(`[data-pos="${l.no}"]`), sp = panel.querySelector(`[data-spec="${l.no}"]`);
        if (p) p.value = l.position; if (sp) sp.value = l.spec;
      });
    }
    edR = r;
    setEditorTitle();
    $('scForm').querySelectorAll('input, textarea').forEach(i => i.disabled = m === 'view');
    $('scSave').hidden = m === 'view' || (m === 'edit' ? !canEdit : !canAdd);
    $('scPrint').hidden = !canExcel;

    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    $('scForm').hidden = false;
    fitText();
    msg('');
    drawList();
    $('scForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (m !== 'view') (m === 'edit' ? $('scCustomer') : $('scPart')).focus({ preventScroll: true });
  }
  let edR = null;
  function setEditorTitle() {
    if (!mode) return;
    $('scTitle').textContent = mode === 'new' ? t('sc.new') : mode === 'edit' ? t('sc.edit', { code: edR.partNo })
      : mode === 'copy' ? t('sc.copyT') : edR.partNo;
    $('scSub').textContent = mode === 'copy' ? t('sc.copiedFrom', { code: edR.partNo }) : '';
    $('scCancel').innerHTML = ico('x') + T(mode === 'view' ? 'b.close' : 'b.cancel');
  }
  function closeEditor() { mode = ''; editId = 0; $('scForm').hidden = true; drawList(); }

  async function load() {
    try { rows = await api('GET', '/api/spec'); drawList(); }
    catch (e) { msg(e.message); }
  }

  // Grow the material boxes to fit their text, so long material lists are fully visible and printed
  const fitText = () => MATERIAL.forEach(([k]) => { const t = $('sc-' + k); t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; });
  MATERIAL.forEach(([k]) => $('sc-' + k).addEventListener('input', fitText));
  // Values on screen (for the editor's Print button)
  function formData() {
    const d = { customer: $('scCustomer').value.trim(), partNo: $('scPart').value.trim(), lengths: [] };
    MATERIAL.forEach(([k]) => d[k] = $('sc-' + k).value.trim());
    for (let i = 1; i <= 22; i++) {
      d.lengths.push({ no: i, position: panel.querySelector(`[data-pos="${i}"]`).value.trim(), spec: panel.querySelector(`[data-spec="${i}"]`).value.trim() });
    }
    return d;
  }
  // SPEC -> Excel: one page with Customer, Part No, material text and the length Position / SPEC rows
  async function specExcel(r, code) {
    const page = { customer: r.customer || '', partNo: r.partNo || '', items: {}, total: '',
      material: { wire: r.wire || '', terminal: r.terminal || '', housing: r.housing || '', other: r.other || '' },
      lengths: (r.lengths || []).map(l => ({ no: l.no, position: l.position || '', spec: l.spec || '', samples: [] })) };
    try {
      const file = await downloadExcel('spec', `SPEC_${code || r.partNo || 'new'}`, [page]);
      msg(t('o.excelDone', { file }), 'ok');
    } catch (err) { msg(err.message); }
  }
  $('scPrint').onclick = () => specExcel(formData(), $('scPart').value.trim());

  $('scSearch').addEventListener('input', drawList);
  if (canAdd) $('scAdd').onclick = () => openEditor('new');
  $('scCancel').onclick = () => { closeEditor(); msg(''); };

  $('scBody').onclick = async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const r = rows.find(x => x.id === Number(b.dataset.id)); if (!r) return;
    if (b.dataset.act === 'print') return specExcel(r, r.partNo);
    if (b.dataset.act !== 'del') return openEditor(b.dataset.act, r);
    if (!await uiConfirm({ tone: 'danger', icon: '🗑️', title: t('sc.delT'),
      message: t('sc.delM', { code: esc(r.partNo), part: r.customer ? ` (${esc(r.customer)})` : '' }),
      ok: t('b.delete'), cancel: t('b.keep') })) return;
    try {
      await api('DELETE', `/api/spec/${r.id}`);
      if (editId === r.id) closeEditor();
      msg(t('sc.deleted', { code: r.partNo }), 'ok');
      await load();
    } catch (err) { msg(err.message); }
  };

  $('scForm').onsubmit = async e => {
    e.preventDefault();
    if (mode === 'view') return;
    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    const partNo = $('scPart').value.trim();
    if (!partNo) { $('scPart').classList.add('bad'); $('scPart').focus(); return msg(t('sc.needCode')); }
    const body = { partNo, customer: $('scCustomer').value.trim(), lengths: [] };
    MATERIAL.forEach(([k]) => body[k] = $('sc-' + k).value.trim());
    for (let i = 1; i <= 22; i++) {
      const position = panel.querySelector(`[data-pos="${i}"]`).value.trim(), spec = panel.querySelector(`[data-spec="${i}"]`).value.trim();
      if (position || spec) body.lengths.push({ no: i, position, spec });
    }
    $('scSave').disabled = true;
    try {
      if (mode === 'edit') await api('PUT', `/api/spec/${editId}`, body);
      else await api('POST', '/api/spec', body);
      msg(t(mode === 'edit' ? 'sc.saved' : 'sc.added', { code: partNo }), 'ok');
      closeEditor();
      await load();
    } catch (err) {
      if (/Part No/.test(err.message)) { $('scPart').classList.add('bad'); $('scPart').focus(); }
      msg(err.message);
    } finally { $('scSave').disabled = false; }
  };

  langHook = () => { drawList(); setEditorTitle(); };
  load();
}
