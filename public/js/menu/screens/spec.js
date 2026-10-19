// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// SPEC master: per Part No the material check text (Wire / Terminal / Housing / Other)
// and its Length Position + SPEC rows, edited in the same layout as the OQC record. Like the paper file, every 22 lines
// are one more sheet below the first (stored LineNo 1-22 on page 1, 23-44 on page 2, ...; each page shows № 1-22).
function renderSpec(panel) {
  const canAdd = can('spec.add'), canEdit = can('spec.edit'), canDel = can('spec.delete'), canExcel = can('spec.excel');
  // [field, №, Khmer, English] for 1) MATERIAL CHECK
  const MATERIAL = [['wire', '①', 'ខ្សែ', 'Wire'], ['terminal', '②', 'ធឺរមីណល', 'Terminal'], ['housing', '③', 'ហៅស៊ីង', 'Housing'], ['other', '④', 'ផ្សេងៗ', 'Other']];
  const PER_PAGE = 22, MAX_LINES = 200, MAX_PAGES = Math.ceil(MAX_LINES / PER_PAGE);
  let rows = [], editId = 0, mode = '';   // mode: '' (closed) | 'new' | 'edit' | 'copy' | 'view'
  // Cells that are only filled in during an inspection show as greyed blanks
  const na = (attrs = '') => `<td class="na" ${attrs}></td>`;

  // Rows № from..from+10 of page p; inputs carry the stored LineNo (p * 22 + №). Lines past 200 can't be used.
  const lenTable = (p, from) => `<table class="oqc oqc-len">
      <thead>
        <tr><th class="c" rowspan="2">№</th><th rowspan="2">${bi('ទីតាំងប្រវែង', 'Length Position')}</th>
          <th rowspan="2">${bi('តំលៃប្រវែងកំនត់', 'SPEC')}</th><th class="c" colspan="5">Sample</th></tr>
        <tr>${OQC_CIRC.map(c => `<th class="c">${c}</th>`).join('')}</tr>
      </thead>
      <tbody>${Array.from({ length: 11 }, (_, k) => from + k).map(i => {
        const line = p * PER_PAGE + i;
        return line > MAX_LINES ? `<tr><td class="no">${i}</td>${na()}${na()}${OQC_CIRC.map(() => na()).join('')}</tr>` : `<tr>
        <td class="no">${i}</td>
        <td class="pos pos-cell"><input data-pos="${line}" maxlength="100" aria-label="Length position ${line}"><span class="pos-view" aria-hidden="true"></span></td>
        <td class="spc"><div class="spec-tol">
          <input data-spec="${line}" maxlength="100" aria-label="SPEC ${line}" placeholder=" ">
          <span class="pm">±</span><span class="tol"><input data-plus="${line}" maxlength="20" aria-label="SPEC plus ${line}" placeholder=" "><input data-minus="${line}" maxlength="20" aria-label="SPEC minus ${line}" placeholder=" "></span>
        </div></td>
        ${OQC_CIRC.map(() => na()).join('')}</tr>`;
      }).join('')}
        <tr class="sec"><td colspan="3">${bi('លទ្ធផល', 'Result')}</td>${OQC_CIRC.map(() => na()).join('')}</tr>
      </tbody></table>`;

  // One sheet. Page 1 holds the Customer / Part No / material fields; later pages show copies of them (data-of)
  const field = (p, id, html) => p ? html.replace(/\bid="([^"]+)"/, 'data-of="$1" readonly tabindex="-1"') : html;
  const sheet = (p, total) => `
    <section class="oqc-sheet spec-page" data-page="${p}">
      ${oqcHead(`<span>${bi('ថ្ងៃត្រួតពិនិត្យ', 'CHECK DATE')}</span><small class="oqc-sheet-page">Page ${p + 1} / ${total}</small>`, 'spec')}

      <div class="oqc-info-wrap"><table class="oqc oqc-info">
        <tr>${OQC_INFO.map(([km, en]) => `<th class="c">${bi(km, en)}</th>`).join('')}</tr>
        <tr>${OQC_INFO.map(([, en]) => en === 'CUSTOMER'
          ? `<td>${field(p, 'scCustomer', '<input id="scCustomer" class="big" maxlength="100" aria-label="Customer">')}</td>`
          : en === 'PART №' ? `<td>${field(p, 'scPart', '<input id="scPart" class="big" maxlength="100" aria-label="Part No" placeholder="FM4-H915-000">')}</td>` : na()).join('')}</tr>
      </table></div>

      <div class="oqc-cols">
        <table class="oqc">
          ${OQC_MAT_HEAD}
          ${MATERIAL.map(([k, n, km, en]) => `<tr><td>
            <div class="oqc-sec-title">${n} <span class="km">${km}</span> <span class="en">[${en}]</span></div>
            ${field(p, 'sc-' + k, `<textarea id="sc-${k}" rows="2" maxlength="1000" aria-label="${en}"></textarea>`)}</td>${na()}</tr>`).join('')}
        </table>
        <table class="oqc">
          ${OQC_ITEM_HEAD}
          ${OQC_ITEMS.map(([km, en]) => `<tr><td>${bi(km, en)}</td>${na()}</tr>`).join('')}
        </table>
      </div>

      <div>
        <div class="spec-len-head">
          <div class="oqc-sec-title"><span class="km">2) ត្រួតពិនិត្យប្រវែង</span> <span class="en">[Length Check]</span></div>
          ${p ? `<button class="icon-btn del spec-del-page" type="button" data-del-page="${p}">${ico('fileMinus')}${T('b.removePage')}</button>` : ''}
        </div>
        <div class="oqc-cols">
          <div class="oqc-len-wrap">${lenTable(p, 1)}</div>
          <div class="oqc-len-wrap">${lenTable(p, 12)}</div>
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
    </section>`;

  panel.innerHTML = `
    <div class="readonly-note" ${canAdd || canEdit || canDel ? 'hidden' : ''}>${svg('lock')} ${T('sc.readonly')}</div>
    <div class="msg" id="scMsg" role="status"></div>
    <form class="spec-editor" id="scForm" novalidate autocomplete="off" hidden>
      <div class="spec-edit-bar">
        <h3><span id="scTitle"></span><small id="scSub"></small></h3>
        <div class="form-actions">
          <button class="icon-btn" id="scPrint" type="button">${ico('excel')}${T('b.excel')}</button>
          <button class="icon-btn" id="scCancel" type="button">${ico('x')}${T('b.cancel')}</button>
          <button class="btn-primary" id="scSave" type="submit">${ico('save')}${T('b.save')}</button>
        </div>
      </div>
      <div class="spec-pages" id="scPages"></div>
      <div class="spec-add-page"><button class="icon-btn" id="scAddPage" type="button">${ico('filePlus')}${T('b.addPage')}</button></div>
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
    const hit = r => !q || [r.customer, r.partNo, r.wire, r.terminal, r.housing, r.other, ...r.lengths.flatMap(l => [l.position, specText(l)])]
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

  // ---- Pages: head = Customer / Part No / material (page 1 fields), lens[LineNo - 1] = { position, spec, specMinus, specPlus }
  const pageCount = () => panel.querySelectorAll('.spec-page').length;
  function readHead() {
    const h = { customer: $('scCustomer') ? $('scCustomer').value : '', partNo: $('scPart') ? $('scPart').value : '' };
    MATERIAL.forEach(([k]) => h[k] = $('sc-' + k) ? $('sc-' + k).value : '');
    return h;
  }
  function readLens() {
    const lens = [];
    const val = (k, no) => panel.querySelector(`[data-${k}="${no}"]`).value.trim();
    panel.querySelectorAll('[data-pos]').forEach(p => {
      const no = Number(p.dataset.pos);
      lens[no - 1] = { position: p.value.trim(), spec: val('spec', no), specMinus: val('minus', no), specPlus: val('plus', no) };
    });
    return lens;
  }
  // Draw n sheets, one below the other, filled with head + lens
  function drawPages(n, head, lens) {
    $('scPages').innerHTML = Array.from({ length: n }, (_, p) => sheet(p, n)).join('');
    $('scCustomer').value = head.customer || '';
    $('scPart').value = head.partNo || '';
    MATERIAL.forEach(([k]) => $('sc-' + k).value = head[k] || '');
    lens.forEach((l, k) => {
      if (!l) return;
      [['pos', 'position'], ['spec', 'spec'], ['minus', 'specMinus'], ['plus', 'specPlus']].forEach(([attr, key]) => {
        const x = panel.querySelector(`[data-${attr}="${k + 1}"]`);
        // Tolerances show as on the sheet, without their sign (100 ± 10 over 5); the server adds + / - back on save
        if (x) x.value = (attr === 'minus' || attr === 'plus' ? String(l[key] || '').replace(/^[+-](?=\d)/, '') : l[key]) || '';
      });
    });
    const view = mode === 'view';
    $('scPages').querySelectorAll('input, textarea').forEach(i => i.disabled = view);
    $('scPages').querySelectorAll('.spec-del-page').forEach(b => b.hidden = view);
    $('scAddPage').hidden = view || n >= MAX_PAGES;
    showPositions($('scPages'));
    mirror();
  }
  // Copy the page 1 Customer / Part No / material into the later pages, and grow the material boxes to fit their text
  function mirror() {
    panel.querySelectorAll('[data-of]').forEach(x => { x.value = $(x.dataset.of).value; });
    panel.querySelectorAll('.spec-page textarea').forEach(t => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; });
  }
  $('scPages').addEventListener('input', e => { if (e.target.id) mirror(); });
  $('scPages').addEventListener('focusout', e => { if (e.target.matches('[data-pos]')) showPositions(e.target.closest('td')); });
  // All length lines with a Position or SPEC, numbered 1-200 across the pages
  const lengthLines = () => readLens().map((l, k) => l && (l.position || l.spec || l.specMinus || l.specPlus) ? { no: k + 1, ...l } : null).filter(Boolean);

  $('scAddPage').onclick = () => {
    const n = pageCount();
    if (n >= MAX_PAGES) return msg(t('sc.maxPages', { n: MAX_PAGES }));
    drawPages(n + 1, readHead(), readLens());
    const first = panel.querySelector(`[data-pos="${n * PER_PAGE + 1}"]`);
    first.closest('.spec-page').scrollIntoView({ behavior: 'smooth', block: 'start' });
    first.focus({ preventScroll: true });
  };
  // Remove one page: its lines go, and the lines of the pages below move up one page
  $('scPages').addEventListener('click', async e => {
    const b = e.target.closest('[data-del-page]'); if (!b) return;
    const p = Number(b.dataset.delPage);
    if (!await uiConfirm({ tone: 'danger', icon: '🗑️', title: t('o.removeT', { n: p + 1 }),
      message: esc(t('sc.removeM')), ok: t('b.remove'), cancel: t('b.keep') })) return;
    const lens = readLens();
    lens.splice(p * PER_PAGE, PER_PAGE);
    drawPages(pageCount() - 1, readHead(), lens);
  });

  // Open the editor: 'new' = blank, 'edit' = this row, 'copy' = this row's data with a blank Part No, 'view' = read-only
  function openEditor(m, r) {
    mode = m; editId = r ? r.id : 0;
    const head = r ? { ...r, partNo: m === 'copy' ? '' : r.partNo } : {};
    const lens = [];
    if (r) r.lengths.forEach(l => { lens[l.no - 1] = { position: l.position || '', spec: l.spec || '', specMinus: l.specMinus || '', specPlus: l.specPlus || '' }; });
    drawPages(Math.max(1, Math.ceil(lens.length / PER_PAGE)), head, lens);
    edR = r;
    setEditorTitle();
    $('scSave').hidden = m === 'view' || (m === 'edit' ? !canEdit : !canAdd);
    $('scPrint').hidden = !canExcel;

    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    $('scForm').hidden = false;
    mirror();
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
  function closeEditor() { mode = ''; editId = 0; $('scForm').hidden = true; $('scPages').innerHTML = ''; drawList(); }

  async function load() {
    try { rows = await api('GET', '/api/spec'); drawList(); }
    catch (e) { msg(e.message); }
  }

  // Values on screen (for the editor's Print button)
  function formData() {
    const h = readHead(), d = { customer: h.customer.trim(), partNo: h.partNo.trim(), lengths: lengthLines() };
    MATERIAL.forEach(([k]) => d[k] = h[k].trim());
    return d;
  }
  // SPEC -> Excel: one page per 22 length lines, each with Customer, Part No, material text and its Position / SPEC rows (№ 1-22);
  // the sheet has one SPEC column, so Spec / - / + are written together ("100 (+10/-5)", "30±5")
  async function specExcel(r, code) {
    const lines = r.lengths || [];
    const count = Math.max(1, Math.ceil(Math.max(0, ...lines.map(l => l.no)) / PER_PAGE));
    const pages = Array.from({ length: count }, (_, p) => ({ customer: r.customer || '', partNo: r.partNo || '', items: {}, total: '',
      material: { wire: r.wire || '', terminal: r.terminal || '', housing: r.housing || '', other: r.other || '' },
      lengths: lines.filter(l => Math.ceil(l.no / PER_PAGE) === p + 1)
        .map(l => ({ no: l.no - p * PER_PAGE, position: l.position || '', spec: specText(l), samples: [] })) }));
    try {
      const out = await openExcel(`SPEC_${code || r.partNo || 'new'}`, pages, 'spec');
      msg(t('o.fileOpened', { file: out.file, folder: out.folder }), 'ok');
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
    const body = formData();
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

  langHook = () => {
    drawList(); setEditorTitle();
    if (mode) drawPages(pageCount(), readHead(), readLens());   // redraw the sheets in the new language, keeping what is typed
  };
  load();
}
