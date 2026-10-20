// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// OQC Data Information: the paper "OQC Inspection record" (REF QC-RE-002 REV:03) as a fill-in form
function renderOQC(panel, opts = {}) {
  const res = (label, def = '') => `<select class="res" aria-label="${esc(label)} result"${def ? ` data-v="${def}"` : ''}>${
    ['', 'OK', 'NG', '/'].map(v => `<option value="${v}"${v === def ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
  const CIRC = OQC_CIRC, INFO = OQC_INFO, MATERIAL = OQC_MATERIAL, ITEMS = OQC_ITEMS;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const lenTable = from => `<table class="oqc oqc-len">
      <thead>
        <tr><th class="c" rowspan="2">№</th><th rowspan="2">${bi('ទីតាំងប្រវែង', 'Length Position')}</th>
          <th rowspan="2">${bi('តំលៃប្រវែងកំណត់', 'SPEC')}</th><th class="c" colspan="5">Sample</th></tr>
        <tr>${CIRC.map(c => `<th class="c">${c}</th>`).join('')}</tr>
      </thead>
      <tbody>${Array.from({ length: 11 }, (_, k) => from + k).map(i => `<tr>
        <td class="no">${i}</td>
        <td class="pos-cell"><input data-pos="${i}" aria-label="Length position ${i}"><span class="pos-view" aria-hidden="true"></span></td>
        <td class="spc"><input class="spec" data-spec="${i}" aria-label="Spec ${i}"><span class="spec-view" aria-hidden="true"></span><input type="hidden" data-range="${i}"></td>
        ${CIRC.map((_, s) => `<td class="smp"><input class="smp" inputmode="decimal" aria-label="Row ${i} sample ${s + 1}"></td>`).join('')}
      </tr>`).join('')}
        <tr class="sec"><td colspan="3">${bi('លទ្ធផល', 'Result')}</td>${CIRC.map(c =>
          `<td class="smp-res">${res(`Length ${from}-${from + 10} ${c}`).replace('class="res"', 'class="res len-res"')}</td>`).join('')}</tr>
      </tbody>
    </table>`;

  panel.innerHTML = `
    <div class="oqc-toolbar">
      <label class="search oqc-scan">
        <svg class="i" viewBox="0 0 24 24"><path d="M3 7V4h3M21 7V4h-3M3 17v3h3M21 17v3h-3M7 8v8M10 8v8M13 8v8M17 8v8"/></svg>
        <input id="oqcScan" ${P('ph.scan')} aria-label="Scan label barcode" autocomplete="off">
        <span class="spinner" aria-hidden="true"></span><span class="busy-note">${T('loading')}</span>
      </label>
      <button class="btn-primary oqc-save" id="oqcSave" type="button" ${can('daily.add') || can('daily.edit') ? '' : 'disabled ' + TT('e.noPerm')}>${ico('save')}${T('b.save')}</button>
      <label class="oqc-ship">${T('o.shipDate')}<input type="date" id="oqcShip" aria-label="Shipment Date" required></label>
      <button class="icon-btn" id="oqcNew" type="button">${ico('sparkle')}${T('b.new')}</button>
      <div class="oqc-pager" role="group" aria-label="Pages">
        <button class="icon-btn" id="oqcPrev" type="button" ${TT('t.prevPage')}>${svg('chev', 'i flip')}</button>
        <span class="oqc-pageno" id="oqcPageInfo" aria-live="polite">Page 1 / 1</span>
        <button class="icon-btn next" id="oqcNext" type="button">${ico('filePlus')}${T('b.addPage')}</button>
        <label class="oqc-sample"><input type="checkbox" id="oqcSample" class="sample-in"><span>Sample</span></label>
        <button class="icon-btn del" id="oqcDelPage" type="button" ${TT('t.removeThisPage')} hidden>${ico('fileMinus')}${T('b.removePage')}</button>
      </div>
      <span class="oqc-rec" id="oqcRec" data-state="new">New</span>
      <div class="msg" id="oqcMsg" role="status"></div>
    </div>
    <form class="oqc-sheet" id="oqcForm" autocomplete="off" onsubmit="return false">
      ${oqcHead(`<label>${bi('ថ្ងៃត្រួតពិនិត្យ', 'CHECK DATE')}<input type="date" id="oqcDate" value="${today}"></label><small class="oqc-sheet-page">Page 1 / 1</small>`)}

      <div class="oqc-info-wrap"><table class="oqc oqc-info">
        <tr>${INFO.map(([km, en]) => `<th class="c">${bi(km, en)}</th>`).join('')}</tr>
        <tr>${INFO.map(([, en, id]) => id === 'oqcProb'
          ? `<td><div class="seg oqc-prob" role="group" aria-label="Probability">
              <button type="button" data-prob="Normal" aria-pressed="false">Normal</button>
              <button type="button" data-prob="Strict" aria-pressed="false">Strict</button>
            </div></td>`
          : id === 'oqcLot'
            ? `<td><div class="lot-pick"><input id="oqcLot" aria-label="${esc(en)}" inputmode="numeric" maxlength="10" ${P('ph.lotDate')} autocomplete="off">
                <button type="button" class="lot-btn" id="oqcLotBtn" ${TT('t.pickDate')}>${svg('calendar')}</button>
                <input type="date" id="oqcLotPick" tabindex="-1" aria-label="Lot date picker"></div></td>`
          : `<td><input id="${id}" aria-label="${esc(en)}"${id === 'oqcQty' || id === 'oqcSpot' ? ' inputmode="numeric"' : ''}></td>`).join('')}</tr>
      </table></div>

      <div class="oqc-cols">
        <table class="oqc">
          ${OQC_MAT_HEAD}
          ${MATERIAL.map(([n, km, en]) => `<tr>
            <td><div class="oqc-sec-title">${n} <span class="km">${km}</span> <span class="en">[${en}]</span></div>
              <textarea id="oqc-${en.toLowerCase()}" rows="3" aria-label="Material ${en}"></textarea></td>
            <td class="rc"><select class="res mat-res" aria-label="Material ${en} result"><option value=""></option><option>OK</option><option>NG</option><option>/</option></select></td></tr>`).join('')}
        </table>
        <table class="oqc">
          ${OQC_ITEM_HEAD}
          ${ITEMS.map(([km, en, def]) => `<tr>
            <td>${bi(km, en)}</td>
            <td class="rc">${res(en, def)}</td></tr>`).join('')}
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
          <td rowspan="2" style="width:52%">${bi('កំណត់សំគាល់', 'Remarks')}<textarea rows="3" aria-label="Remarks"></textarea></td>
          <th class="c">${bi('សរុបលទ្ធផល', 'Total Determination')}</th>
          <th class="c">${bi('ត្រួតពិនិត្យដោយ', 'Checked by')}</th>
          <th class="c">${bi('អ្នកត្រួតពិនិត្យ', 'Inspector')}</th>
        </tr>
        <tr>
          <td><select class="res" id="oqcTotal" aria-label="Total determination"><option value=""></option><option>OK</option><option>NG</option></select></td>
          <td><input id="oqcChecked" class="badge-in" aria-label="Checked by" ${P('ph.badge')}></td>
          <td><input id="oqcInspector" class="badge-in" aria-label="Inspector" ${P('ph.badge')} value="${esc(String((currentUser && currentUser.username) || ''))}"></td>
        </tr>
      </table></div>
    </form>`;

  enhanceDates(panel);
  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('oqcMsg').textContent = text; $('oqcMsg').className = 'msg ' + kind; };
  const setRes = (sel, v) => { sel.value = v; sel.dataset.v = v; };

  // SPEC formats: "100±2", "100+2/-1", "100 (+10/-5)", "98-102"
  function parseSpec(s) {
    const N = '(-?\\d+(?:\\.\\d+)?)';
    let m;
    if ((m = s.match(new RegExp(`^\\s*${N}\\s*±\\s*${N}\\s*$`)))) return [+m[1] - +m[2], +m[1] + +m[2]];
    if ((m = s.match(new RegExp(`^\\s*${N}\\s*\\(?\\s*\\+\\s*${N}\\s*/?\\s*-\\s*${N}\\s*\\)?\\s*$`)))) return [+m[1] - +m[3], +m[1] + +m[2]];
    if ((m = s.match(new RegExp(`^\\s*${N}\\s*[-~–]\\s*${N}\\s*$`)))) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
    return null;
  }

  // Range of a SPEC line from the SPEC master, "8-12" (min-max); OK / NG compares against it. A SPEC typed here without a
  // Range (or an older record) is read from its text instead.
  function parseRange(s) {
    const m = String(s || '').match(/^\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*$/);
    return m ? [+m[1], +m[2]] : null;
  }

  // Samples outside SPEC turn red. Each sample column ① .. ⑤ has its own Result under the table: NG if any of its
  // samples is out of SPEC, OK once one can be checked, blank otherwise; ④⑤ get "/" while they are struck out (not used)
  function checkLength(table) {
    const cols = markLength(table);
    const sample = isSample(table);
    table.querySelectorAll('select.len-res').forEach((sel, k) =>
      setRes(sel, sample && k >= SAMPLE_COLS ? '/' : cols[k].bad ? 'NG' : cols[k].checked ? 'OK' : ''));
  }
  // Sample ticked: only ①②③ are measured and ④⑤ are "/". Normal / First Slot (not ticked): all five ①②③④⑤ must be filled.
  const SAMPLE_COLS = 3;
  const isSample = table => table.closest('form')?.dataset.sample === '1';
  const requiredSamples = table => isSample(table) ? SAMPLE_COLS : 5;
  // Colour out-of-SPEC samples red; returns per sample column how many samples could be checked / were NG
  function markLength(table) {
    const cols = OQC_CIRC.map(() => ({ checked: 0, bad: 0 }));
    table.querySelectorAll('tbody tr:not(.sec)').forEach(tr => {
      const spec = parseRange(tr.querySelector('[data-range]').value) || parseSpec(tr.querySelector('.spec').value);
      tr.querySelectorAll('input.smp').forEach((inp, k) => {
        const v = inp.value.trim();
        let ng = false;
        if (v !== '' && spec) {
          const n = Number(v);
          cols[k].checked++;
          ng = !Number.isFinite(n) || n < spec[0] - 1e-9 || n > spec[1] + 1e-9;
          if (ng) cols[k].bad++;
        }
        inp.classList.toggle('ng', ng);
      });
    });
    // Rows without a SPEC are not measured: show them as blank cells (no input boxes), like the paper form
    table.querySelectorAll('tbody tr:not(.sec)').forEach(tr => {
      tr.querySelector('.spec-view').innerHTML = specHtml(tr.querySelector('[data-spec]').value);   // 100 ± 10 over 5, like the sheet
      tr.classList.toggle('nospec', !tr.querySelector('[data-spec]').value.trim());
      tr.classList.toggle('nopos', !tr.querySelector('[data-pos]').value.trim());
    });
    showPositions(table);
    slashUnused(table);
    return cols;
  }
  // Sample: ④⑤ are not measured: they are cleared, locked and struck out with one diagonal line, from the top-right of ⑤ to the
  // bottom-left of ④, like on paper. Each cell draws its piece of the line in %, so it stays straight at any size, including the printed sheet.
  function slashUnused(table) {
    table.querySelectorAll('svg.slash').forEach(x => x.remove());
    const on = isSample(table);
    table.classList.toggle('slashed', on);
    const rows = [...table.querySelectorAll('tbody tr:not(.sec)')];
    rows.forEach(tr => [...tr.querySelectorAll('input.smp')].slice(SAMPLE_COLS).forEach(i => {
      if (on) { i.value = ''; i.classList.remove('ng'); }
      i.readOnly = on; i.tabIndex = on ? -1 : 0;
    }));
    if (!on) return;
    const n = rows.length, cols = 5 - SAMPLE_COLS;
    rows.forEach((tr, r) => {
      [...tr.querySelectorAll('td.smp')].slice(SAMPLE_COLS).forEach((td, c) => {
        const x = y => ((cols - cols * y / n - c) * 100).toFixed(2) + '%';
        td.insertAdjacentHTML('beforeend', `<svg class="slash" aria-hidden="true"><line x1="${x(r)}" y1="0" x2="${x(r + 1)}" y2="100%"/></svg>`);
      });
    });
  }

  // Total Determination: NG if any item is NG, OK once something is OK and nothing is NG
  function updateTotal() {
    const vals = [...panel.querySelectorAll('select.res:not(#oqcTotal)')].map(s => s.value);
    setRes($('oqcTotal'), vals.includes('NG') ? 'NG' : vals.includes('OK') ? 'OK' : '');
  }

  $('oqcForm').addEventListener('input', e => {
    if (e.target.matches('input.spec')) e.target.closest('td').querySelector('[data-range]').value = '';
    const len = e.target.closest('.oqc-len');
    if (len) { checkLength(len); updateTotal(); }
  });
  // Sample tickbox: ④⑤ switch between "/" (Sample) and measured (Normal / First Slot)
  $('oqcSample').addEventListener('change', () => {
    $('oqcForm').dataset.sample = $('oqcSample').checked ? '1' : '';
    panel.querySelectorAll('.oqc-len').forEach(checkLength); updateTotal(); markDirty();
  });
  $('oqcForm').addEventListener('change', e => {
    if (!e.target.matches('select.res')) return;
    e.target.dataset.v = e.target.value;
    if (e.target.id !== 'oqcTotal') updateTotal();
  });
  // 1) MATERIAL CHECK (each material) starts as OK; the inspector changes it to NG, or "/" when that material is not used
  panel.querySelectorAll('select.mat-res').forEach(sel => setRes(sel, 'OK'));
  // "/" draws a line across the material's text. Pages after the first always have "/" (page 1 holds the material check).
  function markMaterial() {
    panel.querySelectorAll('select.mat-res').forEach(sel => {
      if (cur > 0) setRes(sel, '/');
      sel.disabled = cur > 0;
      const ta = sel.closest('tr').querySelector('textarea');
      ta.classList.toggle('slashed', sel.value === '/');
      ta.readOnly = sel.value === '/';
    });
  }
  $('oqcForm').addEventListener('change', e => { if (e.target.matches('select.mat-res')) markMaterial(); });
  updateTotal();

  // PROBABILITY (Normal / Strict) + QUANTITY -> SPOT CHECK = Inspection All Qty of the OQC Inspection
  // range whose Shipment Qty covers the quantity. Strict uses the ranges stored as level "Hard".
  const LEVEL_OF = { Normal: 'Normal', Strict: 'Hard' };
  let prob = '';
  async function fillSpot() {
    const qty = $('oqcQty').value.trim();
    if (!prob) return msg(t('o.chooseProb'));
    if (!/^\d+$/.test(qty) || Number(qty) < 1) return msg(t('o.enterQty'));
    try {
      const r = await api('GET', `/api/sampling/lookup?level=${LEVEL_OF[prob]}&qty=${qty}`);
      $('oqcSpot').value = r.sampleQty;
      msg(t('o.spot', { n: r.sampleQty, prob, range: `${r.qtyFrom}-${r.qtyTo}` }), 'ok');
    } catch (err) {
      $('oqcSpot').value = '';
      msg(/range covers/.test(err.message)
        ? t('o.noRange', { prob, qty })
        : err.message);
    }
  }
  panel.querySelectorAll('.oqc-prob button').forEach(b => b.onclick = () => {
    prob = b.dataset.prob;
    panel.querySelectorAll('.oqc-prob button').forEach(x => x.setAttribute('aria-pressed', x === b));
    fillSpot();
  });
  $('oqcQty').addEventListener('change', () => { if (prob) fillSpot(); });

  // Scanner types the barcode "26-0700394/8802/4500/002" = LotNo / ItemCode / Qty / BoxNO,
  // followed by Enter or Tab (or nothing: then it runs when the box loses focus)
  let lastScan = '';
  // A label that was read (record opened or new form filled): empty the box for the next label
  // (a label that could not be read stays in the box, selected)
  const clearScan = () => { $('oqcScan').value = ''; lastScan = ''; };
  async function scan() {
    const code = $('oqcScan').value.trim();
    if (!code) return;
    lastScan = code;
    const m = code.match(/^\*?([^/*]+)\/([^/]*)\/([^/]*)\/([^/*]+)\*?$/);
    if (!m) return msg(t('o.badCode', { code }));
    const lot = m[1].trim(), item = m[2].trim(), qtyInCode = m[3].trim(), box = m[4].trim();
    try {
      // Already saved? Open it to update instead of starting over
      const saved = await api('GET', `/api/oqc/records?lot=${encodeURIComponent(lot)}&box=${encodeURIComponent(box)}`);
      if (saved.length) {
        if (saved[0].id !== rec.id) {
          if (dirty && !await confirmDiscard()) return;
          await loadRecord(saved[0].id);
        }
        const s0 = saved[0];
        msg(t('o.openedSaved', { lot, box, state: t(s0.complete ? 'st.complete' : 'st.draft'), by: s0.updateBy, date: fmtDate(s0.updateDate) }), 'ok');
        clearScan();
        $('oqcScan').focus();
        return;
      }
      // A saved record is open and this is another label: start a new record for it
      if (rec.id) {
        if (dirty && !await confirmDiscard()) return;
        return renderOQC(panel, { scan: code });
      }
      // Lot No, Part No and Qty of the label from its receive transaction in Marunix; when the label is not there,
      // Lot and Qty come from the barcode itself and the Part No is typed by hand. Customer + SPEC come from the Part No.
      let label = null, labelErr = '';
      try { label = await api('GET', `/api/oqc/label?lot=${encodeURIComponent(lot)}&item=${encodeURIComponent(item)}&box=${encodeURIComponent(box)}`); }
      catch (err) { labelErr = err.status === 404 ? t('o.labelMissing', { lot, item, box }) : err.message; }
      rec.box = box; rec.itemCode = item;
      $('oqcCustomer').value = '';
      $('oqcPart').value = label ? label.partNo : '';
      $('oqcLot').value = '';   // Lot № is a date (dd-mm-yyyy) typed or picked by hand
      $('oqcQty').value = label && label.qty != null ? String(label.qty) : /^\d+$/.test(qtyInCode) ? qtyInCode : '';
      $('oqcSpot').value = '';
      if (cur > 0) panel.querySelectorAll('select.mat-res').forEach(sel => setRes(sel, 'OK'));   // was a later page's "/"
      pages = [null]; cur = 0;   // back to one page; the Part No's SPEC adds the pages it needs
      fillSpec(null);
      formType = ''; setForm();
      // A new label is a new inspection: clear the previous label's samples and length results
      panel.querySelectorAll('.oqc-len input.smp').forEach(inp => { inp.value = ''; inp.classList.remove('ng'); });
      panel.querySelectorAll('.oqc-len select.res').forEach(sel => setRes(sel, ''));
      panel.querySelectorAll('.oqc-len').forEach(markLength);
      updateTotal();
      markDirty();   // a freshly scanned form is not saved yet

      const notes = [t('o.scanned', { lot, box, item })];
      const warnings = labelErr ? [labelErr] : [];
      if (prob) {
        await fillSpot();
        if ($('oqcMsg').className.includes('ok')) notes.push($('oqcMsg').textContent); else warnings.push($('oqcMsg').textContent);
      }
      clearScan();
      lastPart = '';
      if (label && label.partNo) {
        // Part No from Marunix -> Customer, material and SPEC rows (lookupPart shows its own message)
        await lookupPart();
        const specMsg = $('oqcMsg').textContent, specOk = $('oqcMsg').className.includes('ok');
        msg([...notes, t('o.labelFound', { part: label.partNo, qty: $('oqcQty').value }), ...warnings, specMsg].join(' · '),
          warnings.length || !specOk ? 'err' : 'ok');
        $('oqcScan').focus();
        return;
      }
      msg([...notes, ...warnings, t('o.enterPart')].join(' · '), warnings.length ? 'err' : 'ok');
      $('oqcPart').focus();
      return;
    } catch (err) { msg(err.message); }
    $('oqcScan').select();
  }

  // Wire / Terminal / Housing / Other + Length Check Position / SPEC from a SPEC (null clears them).
  // 22 SPEC lines per page: LineNo 1-22 on page 1, 23-44 on page 2 (as № 1-22), ...; pages are added as needed,
  // copied from this page without its Length Check. Rows without a SPEC line are cleared.
  const PER_PAGE = 22;
  function fillSpec(spec) {
    // A SPEC line counts only when it has a Length Position; the other rows stay blank
    const byLine = new Map(((spec && spec.lengths) || []).filter(l => String(l.position || '').trim()).map(l => [Number(l.line), l]));
    const need = Math.max(1, Math.ceil(Math.max(0, ...byLine.keys()) / PER_PAGE));
    pages[cur] = snapshot();
    while (pages.length < need) pages.push(withoutLengths(pages[cur]));
    pages.forEach((snap, p) => {
      const root = p === cur ? $('oqcForm') : pageClone();
      if (p !== cur) applySnapshot(root, snap);
      ['wire', 'terminal', 'housing', 'other'].forEach(k => root.querySelector('#oqc-' + k).value = spec ? spec[k] || '' : '');
      for (let i = 1; i <= PER_PAGE; i++) {
        const l = byLine.get(p * PER_PAGE + i);
        root.querySelector(`[data-pos="${i}"]`).value = l ? l.position || '' : '';
        root.querySelector(`[data-spec="${i}"]`).value = l ? specText(l) : '';
        root.querySelector(`[data-range="${i}"]`).value = l ? l.range || '' : '';
      }
      if (p === cur) root.querySelectorAll('.oqc-len').forEach(markLength);
      else pages[p] = { vals: fields(root).map(c => c.value), prob: snap.prob, sample: snap.sample };
    });
    showPages();
    return { lines: byLine.size, pages: need };
  }
  // Part No -> SPEC master (MstSpec): Customer, material text and length rows
  // The Part No's SPEC Type picks the form: First Slot = the Spec form (First Lot, QC-RE-048), anything else = OQC Data (QC-RE-002).
  // It is saved with every page, and the Excel / PDF use the matching template.
  let formType = '';
  function setForm() {
    const f = OQC_FORMS[formType === 'First Slot' ? 'spec' : 'oqc'];
    const title = panel.querySelector('.oqc-title');
    title.querySelector('.km').textContent = f.km;
    title.querySelector('b').textContent = `[${f.en}]`;
    panel.querySelector('.oqc-ref small').innerHTML = f.ref;
    $('oqcForm').dataset.form = formType === 'First Slot' ? 'first' : 'normal';
  }
  let lastPart = '';
  async function lookupPart() {
    const part = $('oqcPart').value.trim();
    if (!part || part === lastPart) return;
    lastPart = part;
    try {
      const r = await api('GET', `/api/oqc/spec?partNo=${encodeURIComponent(part)}`);
      if ($('oqcPart').value.trim() !== part) return;   // typed something else meanwhile
      if (r.choices) {   // the Part No has more than one SPEC: choose which one this item needs
        const pick = await uiChoose({ title: t('o.chooseSpecT'), message: esc(t('o.chooseSpecM', { part, n: r.choices.length })),
          choices: r.choices.map(c => ({ value: c.partNo, label: c.partNo, sub: [c.customer, c.type === 'First Slot' ? t('type.firstSlot') : ''].filter(Boolean).join(' · ') })) });
        lastPart = '';
        if (!pick) return msg(t('o.specNotChosen', { part }));
        $('oqcPart').value = pick;
        return lookupPart();
      }
      if (r.partNo && r.partNo !== part) { $('oqcPart').value = r.partNo; lastPart = r.partNo; }
      if (r.customer) $('oqcCustomer').value = r.customer;
      formType = r.type === 'First Slot' ? 'First Slot' : 'Normal'; setForm();
      const n = fillSpec(r);
      markDirty();
      msg([t('o.specFound', { part }), n.lines ? t('o.lines', { n: n.lines }) : '', n.pages > 1 ? t('o.specPages', { n: n.pages }) : '']
        .filter(Boolean).join(' · '), 'ok');
    } catch (err) {
      lastPart = '';   // allow a retry of the same Part No
      msg(err.status === 404 ? t('o.noSpec', { part }) : err.message);
    }
  }
  $('oqcPart').addEventListener('change', lookupPart);
  $('oqcPart').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lastPart = ''; lookupPart(); } });
  $('oqcScan').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return;
    e.preventDefault();
    scan();
  });
  $('oqcScan').addEventListener('change', () => { if ($('oqcScan').value.trim() !== lastScan) scan(); });
  $('oqcScan').focus();

  // LOT № is a date, dd-mm-yyyy: type digits (the dashes are added) or pick it with the calendar button
  const lotIn = $('oqcLot'), lotPick = $('oqcLotPick');
  const validLot = s => {
    const m = String(s).match(/^(\d{2})-(\d{2})-(\d{4})$/); if (!m) return false;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1];
  };
  lotIn.addEventListener('input', () => {
    if (!/^[\d-]*$/.test(lotIn.value)) return;   // an older record's text Lot is left as it is
    const d = lotIn.value.replace(/\D/g, '').slice(0, 8);
    lotIn.value = d.length > 4 ? `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}-${d.slice(2)}` : d;
  });
  $('oqcLotBtn').onclick = () => {
    const m = lotIn.value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    lotPick.value = m ? `${m[3]}-${m[2]}-${m[1]}` : '';
    try { lotPick.showPicker(); } catch { lotPick.focus(); lotPick.click(); }
  };
  lotPick.addEventListener('change', e => {
    e.stopPropagation();
    if (!lotPick.value) return;
    const [y, m, d] = lotPick.value.split('-');
    lotIn.value = `${d}-${m}-${y}`;
    lotIn.classList.remove('missing');
    lotIn.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Checked by / Inspector: a scanned staff badge "MKH-2398" becomes the Username of tbUser ID 2398;
  // anything else is kept as typed by hand
  async function resolveBadge(inp) {
    const m = inp.value.trim().match(/^MKH-?([\w-]{1,10})$/i);
    if (!m) return;
    try {
      const u = await api('GET', `/api/user/name?id=${encodeURIComponent(m[1])}`);
      inp.value = u.username;
      msg(t('o.badge', { field: fieldName(inp.getAttribute('aria-label')), name: u.username, id: u.id }), 'ok');
    } catch (err) { msg(`${fieldName(inp.getAttribute('aria-label'))}: ${err.message}`); inp.select(); }
  }
  panel.querySelectorAll('.badge-in').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === 'Tab') && /^MKH-?/i.test(inp.value.trim())) { e.preventDefault(); resolveBadge(inp); }
    });
    inp.addEventListener('change', () => resolveBadge(inp));
  });

  // ---- Pages: each page is a snapshot of every field on the sheet. "Add page" on the last page adds a page that
  // copies the current one (header, inspection items, material check, footer) with an empty Length Check.
  let pages = [null], cur = 0;
  const fields = root => [...root.querySelectorAll('input, select, textarea')].filter(c => c.type !== 'checkbox');   // the Sample tickbox is kept apart, like Probability
  const snapshot = () => ({ vals: fields($('oqcForm')).map(c => c.value), prob, sample: $('oqcSample').checked });
  // A copy of a page with an empty Length Check (Position, SPEC, samples, results)
  function withoutLengths(snap) {
    const copy = { vals: [...snap.vals], prob: snap.prob, sample: snap.sample };
    fields($('oqcForm')).forEach((c, i) => {
      if (c.closest('.oqc-len')) copy.vals[i] = '';
      if (c.matches('select.mat-res')) copy.vals[i] = '/';   // later pages: material check "/"
    });
    return copy;
  }
  function setProbUI(root, p) {
    root.querySelectorAll('.oqc-prob button').forEach(b => b.setAttribute('aria-pressed', b.dataset.prob === p));
  }
  function applySnapshot(root, snap) {
    fields(root).forEach((c, i) => {
      c.value = snap.vals[i] ?? '';
      if (c.matches('select.res')) c.dataset.v = c.value;
    });
    setProbUI(root, snap.prob);
    root.dataset.sample = snap.sample ? '1' : '';
    if (root === $('oqcForm')) $('oqcSample').checked = !!snap.sample;
    root.querySelectorAll('.oqc-len').forEach(markLength);
  }
  function showPages() {
    const n = pages.length;
    $('oqcPageInfo').textContent = t('pg', { n: cur + 1, total: n });
    panel.querySelector('.oqc-sheet-page').textContent = `Page ${cur + 1} / ${n}`;
    $('oqcPrev').disabled = cur === 0;
    $('oqcNext').innerHTML = cur === n - 1 ? ico('filePlus') + T('b.addPage') : T('b.nextPage') + ' ' + svg('chev');
    $('oqcDelPage').hidden = n === 1;
    markMaterial();
  }
  function goTo(i) {
    pages[cur] = snapshot();
    cur = i;
    applySnapshot($('oqcForm'), pages[cur]);
    prob = pages[cur].prob;
    showPages();
    $('oqcForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('oqcPrev').onclick = () => { if (cur > 0) goTo(cur - 1); };
  $('oqcNext').onclick = () => {
    if (cur < pages.length - 1) return goTo(cur + 1);
    // New page: copy this page, then empty its Length Check (Position, SPEC, samples, results)
    pages[cur] = snapshot();
    pages.push(withoutLengths(pages[cur]));
    goTo(pages.length - 1);
    markDirty();
    updateTotal();
    msg(t('o.pageAdded', { n: cur + 1, from: cur }), 'ok');
  };
  $('oqcDelPage').onclick = async () => {
    if (!await uiConfirm({ tone: 'danger', icon: '🗑️', title: t('o.removeT', { n: cur + 1 }),
      message: t('o.removeM'), ok: t('b.remove'), cancel: t('b.keep') })) return;
    pages.splice(cur, 1);
    markDirty();
    cur = Math.min(cur, pages.length - 1);
    applySnapshot($('oqcForm'), pages[cur]);
    prob = pages[cur].prob;
    showPages();
    msg(t('o.pageRemoved', { n: pages.length }), 'ok');
  };

  showPages();
  panel.querySelectorAll('.oqc-len').forEach(markLength);   // blank rows without SPEC from the start

  // ---- Before printing, every page must be complete (Remarks is optional; material text needs text unless its result is "/")
  const CIRCLED = ['①', '②', '③', '④', '⑤'];
  function missingOn(root) {
    const miss = [];
    const need = (el, label) => { if (el && !String(el.value || '').trim()) miss.push({ el, label }); };
    need(root.querySelector('input[type="date"]'), fieldName('Check date'));
    ['CUSTOMER', 'PART №', 'LOT №', 'QUANTITY', 'SPOT CHECK'].forEach(a => need(root.querySelector(`input[aria-label="${a}"]`), fieldName(a)));
    // Material text can't be blank, unless its result is "/" (not used: the box shows the diagonal line)
    root.querySelectorAll('textarea[aria-label^="Material "]').forEach(ta => {
      if (ta.closest('tr').querySelector('select.mat-res')?.value === '/') return;
      need(ta, fieldName(ta.getAttribute('aria-label')));
    });
    if (!root.querySelector('.oqc-prob button[aria-pressed="true"]')) miss.push({ el: root.querySelector('.oqc-prob'), label: fieldName('Probability') });
    root.querySelectorAll('select.res').forEach(sel => {
      if (sel.closest('.oqc-len') || sel.getAttribute('aria-label') === 'Total determination') return;
      need(sel, fieldName(sel.getAttribute('aria-label').replace(/ result$/, '')));
    });
    root.querySelectorAll('.oqc-len').forEach(table => {
      let used = false;
      table.querySelectorAll('tbody tr:not(.sec)').forEach(tr => {
        const no = tr.querySelector('.no').textContent.trim();
        const pos = tr.querySelector('[data-pos]'), spec = tr.querySelector('[data-spec]');
        // Only rows with a SPEC are checked (a Position without SPEC is not measured)
        if (!spec.value.trim()) return;
        used = true;
        if (!pos.value.trim()) miss.push({ el: pos, label: t('o.lenPos', { no }) });
        const empty = [...tr.querySelectorAll('input.smp')].slice(0, requiredSamples(table)).map((inp, i) => inp.value.trim() ? null : { el: inp, i }).filter(Boolean);
        if (empty.length) {
          empty.forEach(x => miss.push({ el: x.el, label: null }));
          miss.push({ el: null, label: t('o.lenSample', { no, list: empty.map(x => CIRCLED[x.i]).join('') }) });
        }
      });
      // Results of ①②③ (Sample) or of all five ①..⑤ (Normal / First Slot)
      if (used) table.querySelectorAll('select.len-res').forEach((sel, k) => {
        if (k < requiredSamples(table)) need(sel, `${fieldName('Length Check result')} ${CIRCLED[k]}`);
      });
    });
    need(root.querySelector('select[aria-label="Total determination"]'), fieldName('Total Determination'));
    need(root.querySelector('input[aria-label="Checked by"]'), fieldName('Checked by'));
    need(root.querySelector('input[aria-label="Inspector"]'), fieldName('Inspector'));
    return miss;
  }
  function clearMissing() { panel.querySelectorAll('.missing').forEach(el => el.classList.remove('missing')); }
  $('oqcForm').addEventListener('input', e => e.target.classList.remove('missing'));
  $('oqcForm').addEventListener('change', e => e.target.classList.remove('missing'));
  $('oqcForm').addEventListener('click', e => { const g = e.target.closest('.oqc-prob'); if (g) g.classList.remove('missing'); });

  // Every page must be complete before Excel / PDF. What is still empty, per page ([] = complete).
  function missingProblems() {
    pages[cur] = snapshot();
    return pages.map((snap, i) => {
      const tmp = $('oqcForm').cloneNode(true);
      applySnapshot(tmp, snap);
      return { page: i, miss: missingOn(tmp) };
    }).filter(x => x.miss.length);
  }
  const problemLines = problems => problems.map(x => {
    const labels = x.miss.map(m => m.label).filter(Boolean);
    const shown = labels.slice(0, 8).map(esc).join(', ') + (labels.length > 8 ? ' ' + t('o.more', { n: labels.length - 8 }) : '');
    return `<b>${esc(t('o.pageN', { n: x.page + 1 }))}:</b> ${shown}`;
  });
  // Outline what is empty in red and go to the first page that has gaps. true = nothing missing.
  function showMissing() {
    clearMissing();
    const problems = missingProblems();
    if (!problems.length) return true;
    const first = problems[0].page;
    if (first !== cur) goTo(first);
    missingOn($('oqcForm')).forEach(m => m.el && m.el.classList.add('missing'));
    msg(t('o.notReadyM'));
    const firstEl = panel.querySelector('.missing');
    if (firstEl) { firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (firstEl.focus) firstEl.focus({ preventScroll: true }); }
    return false;
  }

  // ---- Saved records: each page is stored with named fields (not positions), so later form changes keep old records readable
  let rec = { id: 0, box: '', itemCode: '' }, dirty = false;
  const canSave = can('daily.add') || can('daily.edit');
  function setStatus() {
    const el = $('oqcRec');
    el.dataset.state = rec.id ? (dirty ? 'changed' : 'saved') : (dirty ? 'unsaved' : 'new');
    el.textContent = rec.id ? t(dirty ? 'st.changed' : 'st.saved', { id: rec.id }) : t(dirty ? 'st.newUnsaved' : 'st.new');
  }
  const markDirty = () => { if (!dirty) { dirty = true; setStatus(); } };
  $('oqcForm').addEventListener('input', markDirty);
  $('oqcForm').addEventListener('change', markDirty);
  $('oqcForm').addEventListener('click', e => { if (e.target.closest('.oqc-prob button')) markDirty(); });
  const confirmDiscard = () => uiConfirm({ tone: 'danger', icon: '📝', title: t('o.discardT'),
    message: esc(t('o.discardM')), ok: t('b.continue'), cancel: t('b.stay') });

  function readNamed(root) {
    const v = q => { const el = root.querySelector(q); return el ? el.value.trim() : ''; };
    const lens = [];
    root.querySelectorAll('.oqc-len tbody tr:not(.sec)').forEach(tr => {
      const l = { no: Number(tr.querySelector('.no').textContent), position: tr.querySelector('[data-pos]').value.trim(),
        spec: tr.querySelector('[data-spec]').value.trim(), range: tr.querySelector('[data-range]').value,
        samples: [...tr.querySelectorAll('input.smp')].map(i => i.value.trim()) };
      if (l.position || l.spec || l.samples.some(Boolean)) lens.push(l);
    });
    const pressed = root.querySelector('.oqc-prob button[aria-pressed="true"]');
    return {
      checkDate: v('input[type="date"]'), customer: v('input[aria-label="CUSTOMER"]'), partNo: v('input[aria-label="PART №"]'),
      lot: v('input[aria-label="LOT №"]'), qty: v('input[aria-label="QUANTITY"]'), spot: v('input[aria-label="SPOT CHECK"]'),
      probability: pressed ? pressed.dataset.prob : '',
      type: formType,
      sample: root.dataset.sample === '1',
      items: Object.fromEntries([...root.querySelectorAll('select.res')]
        .filter(x => !x.closest('.oqc-len') && x.getAttribute('aria-label') !== 'Total determination')
        .map(x => [x.getAttribute('aria-label').replace(/ result$/, ''), x.value])),
      material: Object.fromEntries([...root.querySelectorAll('textarea[aria-label^="Material "]')]
        .map(t => [t.getAttribute('aria-label').slice(9).toLowerCase(), t.value])),
      // Per table (№ 1-11, № 12-22): the results of samples ① .. ⑤
      lengths: lens, lengthResults: [...root.querySelectorAll('.oqc-len')].map(tb => [...tb.querySelectorAll('select.len-res')].map(x => x.value)),
      total: v('select[aria-label="Total determination"]'), remarks: v('textarea[aria-label="Remarks"]'),
      checkedBy: v('input[aria-label="Checked by"]'), inspector: v('input[aria-label="Inspector"]')
    };
  }
  function writeNamed(root, d) {
    const set = (q, val) => { const el = root.querySelector(q); if (el && val != null) el.value = val; };
    set('input[type="date"]', d.checkDate); set('input[aria-label="CUSTOMER"]', d.customer); set('input[aria-label="PART №"]', d.partNo);
    set('input[aria-label="LOT №"]', d.lot); set('input[aria-label="QUANTITY"]', d.qty); set('input[aria-label="SPOT CHECK"]', d.spot);
    setProbUI(root, d.probability || '');
    root.dataset.sample = d.sample ? '1' : '';
    root.querySelectorAll('select.res').forEach(x => {
      const key = (x.getAttribute('aria-label') || '').replace(/ result$/, '');
      // Older records: one 'Material check' result for all materials; renamed items under their old key
      const old = x.matches('.mat-res') ? 'Material check' : OQC_ITEM_OLD_KEYS[key];
      if (d.items && key in d.items) x.value = d.items[key];
      else if (d.items && old in d.items) x.value = d.items[old];
    });
    Object.entries(d.material || {}).forEach(([k, val]) => set(`textarea[aria-label="Material ${k[0].toUpperCase() + k.slice(1)}"]`, val));
    root.querySelectorAll('.oqc-len input').forEach(i => { i.value = ''; });
    (d.lengths || []).forEach(l => {
      const tr = root.querySelector(`.oqc-len [data-pos="${l.no}"]`)?.closest('tr');
      if (!tr) return;
      tr.querySelector('[data-pos]').value = l.position || '';
      tr.querySelector('[data-spec]').value = l.spec || '';
      tr.querySelector('[data-range]').value = l.range || '';
      tr.querySelectorAll('input.smp').forEach((i, k) => { i.value = (l.samples || [])[k] || ''; });
    });
    // Records saved before the per-sample results have one result per table: work them out from the samples
    root.querySelectorAll('.oqc-len').forEach((tb, t) => {
      const r = (d.lengthResults || [])[t];
      if (Array.isArray(r)) tb.querySelectorAll('select.len-res').forEach((x, k) => { x.value = r[k] || ''; });
      else checkLength(tb);
    });
    set('select[aria-label="Total determination"]', d.total); set('textarea[aria-label="Remarks"]', d.remarks);
    set('input[aria-label="Checked by"]', d.checkedBy); set('input[aria-label="Inspector"]', d.inspector);
    root.querySelectorAll('select.res').forEach(x => { x.dataset.v = x.value; });
  }
  const pageClone = () => $('oqcForm').cloneNode(true);
  function namedFromSnap(snap) { const t = pageClone(); applySnapshot(t, snap); return readNamed(t); }
  function snapFromNamed(d) { const t = pageClone(); writeNamed(t, d); return { vals: fields(t).map(c => c.value), prob: d.probability || '', sample: !!d.sample }; }
  function pageComplete(snap) { const t = pageClone(); applySnapshot(t, snap); return !missingOn(t).length; }

  async function saveRecord(forceId) {
    if (!can((forceId || rec.id) ? 'daily.edit' : 'daily.add')) return msg(t('e.noPerm'));
    pages[cur] = snapshot();
    clearMissing();
    const named = pages.map(namedFromSnap), h = named[0];
    if (!h.lot) {
      if (cur !== 0) goTo(0);
      $('oqcLot').classList.add('missing'); $('oqcLot').focus();
      return msg(t('o.needLot'));
    }
    if (!validLot(h.lot)) {
      if (cur !== 0) goTo(0);
      $('oqcLot').classList.add('missing'); $('oqcLot').focus();
      return msg(t('o.badLot'));
    }
    if (!$('oqcShip').value) {
      $('oqcShip').classList.add('missing'); $('oqcShip').focus();
      return msg(t('o.needShip'));
    }
    const totals = named.map(n => n.total);
    const body = {
      shipDate: $('oqcShip').value,
      lot: h.lot, box: rec.box, itemCode: rec.itemCode, partNo: h.partNo, customer: h.customer, checkDate: h.checkDate, qty: h.qty,
      probability: h.probability, type: h.sample ? 'Sample' : formType === 'First Slot' ? 'First Slot' : 'Normal', inspector: h.inspector, checkedBy: h.checkedBy,
      total: totals.includes('NG') ? 'NG' : totals.length && totals.every(t => t === 'OK') ? 'OK' : '',
      complete: pages.every(pageComplete), pages: named
    };
    const id = forceId || rec.id;
    $('oqcSave').disabled = true;
    try {
      const out = await api(id ? 'PUT' : 'POST', id ? `/api/oqc/records/${id}` : '/api/oqc/records', body);
      rec.id = out.id; dirty = false; setStatus();
      msg(t('o.saved', { id: rec.id, lot: h.lot, box: rec.box ? `, Box ${rec.box}` : '', n: pages.length, state: t(body.complete ? 'st.complete' : 'o.draftLong') }), 'ok');
    } catch (err) {
      if (err.status === 409 && err.data && err.data.existingId) {
        const go = await uiConfirm({ tone: 'danger', icon: '🗂️', title: t('o.dupT'),
          message: esc(t('o.dupM', { err: err.message, id: err.data.existingId })),
          ok: t('b.replace'), cancel: t('b.cancel') });
        if (go) return saveRecord(err.data.existingId);
        return msg(t('o.notSaved'));
      }
      msg(err.message);
    } finally { $('oqcSave').disabled = !canSave; }
  }

  async function loadRecord(id) {
    const r = await api('GET', `/api/oqc/records/${id}`);
    pages = r.pages.map(snapFromNamed);
    formType = (r.pages[0] && r.pages[0].type) || '';
    setForm();
    cur = 0;
    applySnapshot($('oqcForm'), pages[0]);
    prob = pages[0].prob;
    rec = { id: r.id, box: r.box, itemCode: r.itemCode };
    $('oqcShip').value = r.shipDate || '';
    dirty = false;
    clearMissing();
    showPages(); setStatus();
    clearScan();
    return r;
  }

  $('oqcSave').onclick = () => saveRecord();
  setStatus();
  // Search Draft / Save asks what is still empty in a record (it renders this screen off-screen to find out)
  if (opts.report) {
    loadRecord(opts.report.id).then(() => opts.report.done(problemLines(missingProblems()))).catch(err => opts.report.done(null, err));
    return;
  }
  langHook = () => { setStatus(); showPages(); };
  $('oqcShip').addEventListener('input', e => { e.target.classList.remove('missing'); markDirty(); });
  $('oqcShip').addEventListener('change', e => { e.target.classList.remove('missing'); markDirty(); });
  // Search Draft / Save sends a record here (Open) or asks for its PDF
  if (pendingOqc) {
    const job = pendingOqc; pendingOqc = null;
    loadRecord(job.id).then(r => {
      msg(t('o.openedRec', { id: r.id, lot: r.lot, box: r.box ? `, Box ${r.box}` : '', state: t(r.complete ? 'st.complete' : 'st.draft') }), 'ok');
      if (job.check) showMissing();   // a draft: outline in red what is still to be filled in
    }).catch(err => msg(err.message));
  }
  if (opts.scan) { $('oqcScan').value = opts.scan; scan(); }

  $('oqcNew').onclick = async () => {
    if (!await uiConfirm({ icon: '🧹', title: t('o.freshT'), message: esc(t('o.freshM')),
      ok: t('b.clearIt'), cancel: t('b.keepEditing') })) return;
    renderOQC(panel);
  };
}
