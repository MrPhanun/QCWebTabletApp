// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// OQC Data Information: the paper "OQC Inspection record" (REF QC-RE-002 REV:02) as a fill-in form
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
        <td><input data-pos="${i}" aria-label="Length position ${i}"></td>
        <td><input class="spec" data-spec="${i}" aria-label="Spec ${i}"></td>
        ${CIRC.map((_, s) => `<td class="smp"><input class="smp" inputmode="decimal" aria-label="Row ${i} sample ${s + 1}"></td>`).join('')}
      </tr>`).join('')}
        <tr class="sec"><td colspan="3">${bi('លទ្ធផល', 'Result')}</td><td colspan="5">${res(`Length ${from}-${from + 10}`)}</td></tr>
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
      <button class="icon-btn" id="oqcFindBtn" type="button" aria-expanded="false" aria-controls="oqcFind">${ico('search')}${T('b.search')}</button>
      <button class="icon-btn" id="oqcNew" type="button">${ico('sparkle')}${T('b.new')}</button>
      <button class="icon-btn" id="oqcPrint" type="button" ${can('daily.excel') ? '' : 'hidden'}>${ico('excel')}${T('b.excel')}</button>
      <div class="oqc-pager" role="group" aria-label="Pages">
        <button class="icon-btn" id="oqcPrev" type="button" ${TT('t.prevPage')}>${svg('chev', 'i flip')}</button>
        <span class="oqc-pageno" id="oqcPageInfo" aria-live="polite">Page 1 / 1</span>
        <button class="icon-btn next" id="oqcNext" type="button">${ico('filePlus')}${T('b.addPage')}</button>
        <button class="icon-btn del" id="oqcDelPage" type="button" ${TT('t.removeThisPage')} hidden>${ico('fileMinus')}${T('b.removePage')}</button>
      </div>
      <span class="oqc-rec" id="oqcRec" data-state="new">New</span>
      <div class="msg" id="oqcMsg" role="status"></div>
    </div>
    <div class="oqc-find" id="oqcFind" hidden>
      <div class="oqc-find-bar">
        <label class="search">${svg('list')}<input id="oqcFindQ" type="search" ${P('ph.find')} aria-label="Search saved records"></label>
        <span class="count" id="oqcFindCount"></span>
        <span class="spinner" aria-hidden="true"></span>
        <button class="icon-btn" id="oqcFindClose" type="button">${ico('x')}${T('b.close')}</button>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr>${['h.lot', 'h.box', 'h.itemCode', 'h.partNo', 'h.customer', 'h.checkDate', 'h.pages', 'h.status', 'h.total', 'h.lastSaved'].map(k => `<th>${T(k)}</th>`).join('')}<th></th></tr></thead>
        <tbody id="oqcFindBody"></tbody>
      </table></div>
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
          : `<td><input id="${id}" aria-label="${esc(en)}"${id === 'oqcQty' || id === 'oqcSpot' ? ' inputmode="numeric"' : ''}></td>`).join('')}</tr>
      </table></div>

      <div class="oqc-cols">
        <table class="oqc">
          <tr><th>${bi('ប្រភេទត្រួតពិនិត្យ', 'INSPECTION ITEM')}</th><th class="c">${bi('លទ្ធផល', 'Result')}</th></tr>
          <tr class="sec"><td>${bi('1) ត្រួតពិនិត្យវត្ថុធាតុដើម', 'MATERIAL CHECK')}</td>
            <td class="rc"><select class="res" id="oqcMatRes" aria-label="Material check result"><option value=""></option><option>OK</option><option>NG</option></select></td></tr>
          ${MATERIAL.map(([n, km, en]) => `<tr>
            <td colspan="2"><div class="oqc-sec-title">${n} <span class="km">${km}</span> <span class="en">[${en}]</span></div>
              <textarea id="oqc-${en.toLowerCase()}" rows="3" aria-label="Material ${en}"></textarea></td></tr>`).join('')}
        </table>
        <table class="oqc">
          <tr><th>${bi('ប្រភេទត្រួតពិនិត្យ', 'INSPECTION ITEM')}</th><th class="c">${bi('លទ្ធផល', 'Result')}</th></tr>
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

  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('oqcMsg').textContent = text; $('oqcMsg').className = 'msg ' + kind; };
  const setRes = (sel, v) => { sel.value = v; sel.dataset.v = v; };

  // SPEC formats: "100±2", "100+2/-1", "98-102"
  function parseSpec(s) {
    const N = '(-?\\d+(?:\\.\\d+)?)';
    let m;
    if ((m = s.match(new RegExp(`^\\s*${N}\\s*±\\s*${N}\\s*$`)))) return [+m[1] - +m[2], +m[1] + +m[2]];
    if ((m = s.match(new RegExp(`^\\s*${N}\\s*\\+\\s*${N}\\s*/?\\s*-\\s*${N}\\s*$`)))) return [+m[1] - +m[3], +m[1] + +m[2]];
    if ((m = s.match(new RegExp(`^\\s*${N}\\s*[-~–]\\s*${N}\\s*$`)))) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
    return null;
  }

  // Samples outside SPEC turn red; the table's Result becomes NG/OK once any sample can be checked
  function checkLength(table) {
    const { checked, bad } = markLength(table);
    if (checked) setRes(table.querySelector('select.res'), bad ? 'NG' : 'OK');
  }
  const REQUIRED_SAMPLES = 3;   // ①②③ must be measured; ④⑤ are optional
  // Colour out-of-SPEC samples red; returns how many samples could be checked / were NG
  function markLength(table) {
    let checked = 0, bad = 0;
    table.querySelectorAll('tbody tr:not(.sec)').forEach(tr => {
      const spec = parseSpec(tr.querySelector('.spec').value);
      tr.querySelectorAll('input.smp').forEach(inp => {
        const v = inp.value.trim();
        let ng = false;
        if (v !== '' && spec) {
          const n = Number(v);
          checked++;
          ng = !Number.isFinite(n) || n < spec[0] - 1e-9 || n > spec[1] + 1e-9;
          if (ng) bad++;
        }
        inp.classList.toggle('ng', ng);
      });
    });
    // Rows without a SPEC are not measured: show them as blank cells (no input boxes), like the paper form
    table.querySelectorAll('tbody tr:not(.sec)').forEach(tr => {
      tr.classList.toggle('nospec', !tr.querySelector('[data-spec]').value.trim());
      tr.classList.toggle('nopos', !tr.querySelector('[data-pos]').value.trim());
    });
    slashUnused(table);
    return { checked, bad };
  }
  // ①②③ measured and all within SPEC in every used row, and none of ④⑤ used: strike out the ④⑤ block with one diagonal line,
  // from the top-right of ⑤ to the bottom-left of ④, like on paper. Each cell draws its piece of the line in %,
  // so it stays straight at any size, including the printed sheet.
  function slashUnused(table) {
    table.querySelectorAll('svg.slash').forEach(x => x.remove());
    const rows = [...table.querySelectorAll('tbody tr:not(.sec)')];
    const extra = rows.some(tr => [...tr.querySelectorAll('input.smp')].slice(REQUIRED_SAMPLES).some(i => i.value.trim() !== ''));
    // Only rows with a SPEC are checked: each needs ①②③ measured and none of them red (out of SPEC)
    const used = rows.filter(tr => tr.querySelector('[data-spec]').value.trim());
    const allGood = used.length > 0 && used.every(tr => [...tr.querySelectorAll('input.smp')].slice(0, REQUIRED_SAMPLES)
      .every(i => i.value.trim() !== '' && !i.classList.contains('ng')));
    const on = allGood && !extra;
    table.classList.toggle('slashed', on);
    if (!on) return;
    const n = rows.length, cols = 5 - REQUIRED_SAMPLES;
    rows.forEach((tr, r) => {
      [...tr.querySelectorAll('td.smp')].slice(REQUIRED_SAMPLES).forEach((td, c) => {
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
    const len = e.target.closest('.oqc-len');
    if (len) { checkLength(len); updateTotal(); }
  });
  $('oqcForm').addEventListener('change', e => {
    if (!e.target.matches('select.res')) return;
    e.target.dataset.v = e.target.value;
    if (e.target.id !== 'oqcTotal') updateTotal();
  });
  // 1) MATERIAL CHECK starts as OK; the inspector changes it to NG if needed
  setRes($('oqcMatRes'), 'OK');
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
        $('oqcScan').select();
        return;
      }
      // A saved record is open and this is another label: start a new record for it
      if (rec.id) {
        if (dirty && !await confirmDiscard()) return;
        return renderOQC(panel, { scan: code });
      }
      // Everything comes from the barcode itself; Customer + SPEC come from MstSpec once the Part No is entered
      rec.box = box; rec.itemCode = item;
      $('oqcCustomer').value = '';
      $('oqcPart').value = '';
      $('oqcLot').value = lot;
      $('oqcQty').value = /^\d+$/.test(qtyInCode) ? qtyInCode : '';
      $('oqcSpot').value = '';
      fillSpec(null);
      // A new label is a new inspection: clear the previous label's samples and length results
      panel.querySelectorAll('.oqc-len input.smp').forEach(inp => { inp.value = ''; inp.classList.remove('ng'); });
      panel.querySelectorAll('.oqc-len select.res').forEach(sel => setRes(sel, ''));
      panel.querySelectorAll('.oqc-len').forEach(markLength);
      updateTotal();
      markDirty();   // a freshly scanned form is not saved yet

      const notes = [t('o.scanned', { lot, box, item })];
      const warnings = [];
      if (prob) {
        await fillSpot();
        if ($('oqcMsg').className.includes('ok')) notes.push($('oqcMsg').textContent); else warnings.push($('oqcMsg').textContent);
      }
      msg([...notes, ...warnings, t('o.enterPart')].join(' · '), warnings.length ? 'err' : 'ok');
      lastPart = '';
      $('oqcPart').focus();
      return;
    } catch (err) { msg(err.message); }
    $('oqcScan').select();
  }

  // Wire / Terminal / Housing / Other + Length Check Position / SPEC from a SPEC (null clears them).
  // Each SPEC line goes to the row with № = LineNo; other rows are cleared.
  function fillSpec(spec) {
    ['wire', 'terminal', 'housing', 'other'].forEach(k => $('oqc-' + k).value = spec ? spec[k] || '' : '');
    const byLine = new Map(((spec && spec.lengths) || []).map(l => [Number(l.line), l]));
    for (let i = 1; i <= 22; i++) {
      const l = byLine.get(i);
      panel.querySelector(`[data-pos="${i}"]`).value = l ? l.position || '' : '';
      panel.querySelector(`[data-spec="${i}"]`).value = l ? l.spec || '' : '';
    }
    panel.querySelectorAll('.oqc-len').forEach(markLength);
    return byLine.size;
  }
  // Part No -> SPEC master (MstSpec): Customer, material text and length rows
  let lastPart = '';
  async function lookupPart() {
    const part = $('oqcPart').value.trim();
    if (!part || part === lastPart) return;
    lastPart = part;
    try {
      const r = await api('GET', `/api/oqc/spec?partNo=${encodeURIComponent(part)}`);
      if ($('oqcPart').value.trim() !== part) return;   // typed something else meanwhile
      if (r.customer) $('oqcCustomer').value = r.customer;
      const n = fillSpec(r);
      markDirty();
      msg([t('o.specFound', { part }), n ? t('o.lines', { n }) : ''].filter(Boolean).join(' · '), 'ok');
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
  const fields = root => [...root.querySelectorAll('input, select, textarea')];
  const snapshot = () => ({ vals: fields($('oqcForm')).map(c => c.value), prob });
  function setProbUI(root, p) {
    root.querySelectorAll('.oqc-prob button').forEach(b => b.setAttribute('aria-pressed', b.dataset.prob === p));
  }
  function applySnapshot(root, snap) {
    fields(root).forEach((c, i) => {
      c.value = snap.vals[i] ?? '';
      if (c.matches('select.res')) c.dataset.v = c.value;
    });
    setProbUI(root, snap.prob);
    root.querySelectorAll('.oqc-len').forEach(markLength);
  }
  function showPages() {
    const n = pages.length;
    $('oqcPageInfo').textContent = t('pg', { n: cur + 1, total: n });
    panel.querySelector('.oqc-sheet-page').textContent = `Page ${cur + 1} / ${n}`;
    $('oqcPrev').disabled = cur === 0;
    $('oqcNext').innerHTML = cur === n - 1 ? ico('filePlus') + T('b.addPage') : T('b.nextPage') + ' ' + svg('chev');
    $('oqcDelPage').hidden = n === 1;
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
    const copy = { vals: [...pages[cur].vals], prob: pages[cur].prob };
    fields($('oqcForm')).forEach((c, i) => { if (c.closest('.oqc-len')) copy.vals[i] = ''; });
    pages.push(copy);
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

  // ---- Before printing, every page must be complete (Remarks and the material text are optional)
  const CIRCLED = ['①', '②', '③', '④', '⑤'];
  function missingOn(root) {
    const miss = [];
    const need = (el, label) => { if (el && !String(el.value || '').trim()) miss.push({ el, label }); };
    need(root.querySelector('input[type="date"]'), fieldName('Check date'));
    ['CUSTOMER', 'PART №', 'LOT №', 'QUANTITY', 'SPOT CHECK'].forEach(a => need(root.querySelector(`input[aria-label="${a}"]`), fieldName(a)));
    if (!root.querySelector('.oqc-prob button[aria-pressed="true"]')) miss.push({ el: root.querySelector('.oqc-prob'), label: fieldName('Probability') });
    root.querySelectorAll('select.res').forEach(sel => {
      if (sel.closest('.oqc-len') || sel.getAttribute('aria-label') === 'Total determination') return;
      need(sel, fieldName(sel.getAttribute('aria-label').replace(/ result$/, '').replace(/^Material check$/, 'Material check')));
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
        const empty = [...tr.querySelectorAll('input.smp')].slice(0, REQUIRED_SAMPLES).map((inp, i) => inp.value.trim() ? null : { el: inp, i }).filter(Boolean);
        if (empty.length) {
          empty.forEach(x => miss.push({ el: x.el, label: null }));
          miss.push({ el: null, label: t('o.lenSample', { no, list: empty.map(x => CIRCLED[x.i]).join('') }) });
        }
      });
      if (used) need(table.querySelector('select.res'), fieldName('Length Check result'));
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

  // Print every page, one A4 sheet each — only when nothing is missing
  $('oqcPrint').onclick = async () => {
    pages[cur] = snapshot();
    clearMissing();
    const problems = pages.map((snap, i) => {
      const tmp = $('oqcForm').cloneNode(true);
      applySnapshot(tmp, snap);
      return { page: i, miss: missingOn(tmp) };
    }).filter(x => x.miss.length);
    if (problems.length) {
      const first = problems[0].page;
      if (first !== cur) goTo(first);
      missingOn($('oqcForm')).forEach(m => m.el && m.el.classList.add('missing'));
      const lines = problems.map(x => {
        const labels = x.miss.map(m => m.label).filter(Boolean);
        const shown = labels.slice(0, 8).map(esc).join(', ') + (labels.length > 8 ? ' ' + t('o.more', { n: labels.length - 8 }) : '');
        return `<b>${esc(t('o.pageN', { n: x.page + 1 }))}:</b> ${shown}`;
      });
      await uiAlert({ icon: '📝', title: t('o.notReadyT'),
        message: `${esc(t('o.notReadyM'))}<br><br>${lines.join('<br>')}`, ok: t('b.gotIt') });
      const firstEl = panel.querySelector('.missing');
      if (firstEl) { firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (firstEl.focus) firstEl.focus({ preventScroll: true }); }
      return;
    }
    // Complete: download every page as an Excel file filled into "OQC Data.xlsx"
    const named = pages.map(namedFromSnap);
    const lot = named[0].lot || 'OQC';
    try {
      const file = await downloadExcel('oqc', `OQC_${lot}${rec.box ? '_' + rec.box : ''}`, named);
      msg(t('o.excelDone', { file }), 'ok');
    } catch (err) { msg(err.message); }
  };
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
        spec: tr.querySelector('[data-spec]').value.trim(), samples: [...tr.querySelectorAll('input.smp')].map(i => i.value.trim()) };
      if (l.position || l.spec || l.samples.some(Boolean)) lens.push(l);
    });
    const pressed = root.querySelector('.oqc-prob button[aria-pressed="true"]');
    return {
      checkDate: v('input[type="date"]'), customer: v('input[aria-label="CUSTOMER"]'), partNo: v('input[aria-label="PART №"]'),
      lot: v('input[aria-label="LOT №"]'), qty: v('input[aria-label="QUANTITY"]'), spot: v('input[aria-label="SPOT CHECK"]'),
      probability: pressed ? pressed.dataset.prob : '',
      items: Object.fromEntries([...root.querySelectorAll('select.res')]
        .filter(x => !x.closest('.oqc-len') && x.getAttribute('aria-label') !== 'Total determination')
        .map(x => [x.getAttribute('aria-label').replace(/ result$/, ''), x.value])),
      material: Object.fromEntries([...root.querySelectorAll('textarea[aria-label^="Material "]')]
        .map(t => [t.getAttribute('aria-label').slice(9).toLowerCase(), t.value])),
      lengths: lens, lengthResults: [...root.querySelectorAll('.oqc-len select.res')].map(x => x.value),
      total: v('select[aria-label="Total determination"]'), remarks: v('textarea[aria-label="Remarks"]'),
      checkedBy: v('input[aria-label="Checked by"]'), inspector: v('input[aria-label="Inspector"]')
    };
  }
  function writeNamed(root, d) {
    const set = (q, val) => { const el = root.querySelector(q); if (el && val != null) el.value = val; };
    set('input[type="date"]', d.checkDate); set('input[aria-label="CUSTOMER"]', d.customer); set('input[aria-label="PART №"]', d.partNo);
    set('input[aria-label="LOT №"]', d.lot); set('input[aria-label="QUANTITY"]', d.qty); set('input[aria-label="SPOT CHECK"]', d.spot);
    setProbUI(root, d.probability || '');
    root.querySelectorAll('select.res').forEach(x => {
      const key = (x.getAttribute('aria-label') || '').replace(/ result$/, '');
      if (d.items && key in d.items) x.value = d.items[key];
    });
    Object.entries(d.material || {}).forEach(([k, val]) => set(`textarea[aria-label="Material ${k[0].toUpperCase() + k.slice(1)}"]`, val));
    root.querySelectorAll('.oqc-len input').forEach(i => { i.value = ''; });
    (d.lengths || []).forEach(l => {
      const tr = root.querySelector(`.oqc-len [data-pos="${l.no}"]`)?.closest('tr');
      if (!tr) return;
      tr.querySelector('[data-pos]').value = l.position || '';
      tr.querySelector('[data-spec]').value = l.spec || '';
      tr.querySelectorAll('input.smp').forEach((i, k) => { i.value = (l.samples || [])[k] || ''; });
    });
    root.querySelectorAll('.oqc-len select.res').forEach((x, k) => { x.value = (d.lengthResults || [])[k] || ''; });
    set('select[aria-label="Total determination"]', d.total); set('textarea[aria-label="Remarks"]', d.remarks);
    set('input[aria-label="Checked by"]', d.checkedBy); set('input[aria-label="Inspector"]', d.inspector);
    root.querySelectorAll('select.res').forEach(x => { x.dataset.v = x.value; });
  }
  const pageClone = () => $('oqcForm').cloneNode(true);
  function namedFromSnap(snap) { const t = pageClone(); applySnapshot(t, snap); return readNamed(t); }
  function snapFromNamed(d) { const t = pageClone(); writeNamed(t, d); return { vals: fields(t).map(c => c.value), prob: d.probability || '' }; }
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
    const totals = named.map(n => n.total);
    const body = {
      lot: h.lot, box: rec.box, itemCode: rec.itemCode, partNo: h.partNo, customer: h.customer, checkDate: h.checkDate, qty: h.qty,
      probability: h.probability, inspector: h.inspector, checkedBy: h.checkedBy,
      total: totals.includes('NG') ? 'NG' : totals.length && totals.every(t => t === 'OK') ? 'OK' : '',
      complete: pages.every(pageComplete), pages: named
    };
    const id = forceId || rec.id;
    $('oqcSave').disabled = true;
    try {
      const out = await api(id ? 'PUT' : 'POST', id ? `/api/oqc/records/${id}` : '/api/oqc/records', body);
      rec.id = out.id; dirty = false; setStatus();
      msg(t('o.saved', { id: rec.id, lot: h.lot, box: rec.box ? `, Box ${rec.box}` : '', n: pages.length, state: t(body.complete ? 'st.complete' : 'o.draftLong') }), 'ok');
      if (!$('oqcFind').hidden) findRecords();
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
    cur = 0;
    applySnapshot($('oqcForm'), pages[0]);
    prob = pages[0].prob;
    rec = { id: r.id, box: r.box, itemCode: r.itemCode };
    dirty = false;
    clearMissing();
    showPages(); setStatus();
    $('oqcScan').value = r.box ? `${r.lot}/${r.itemCode}/${r.qty ?? ''}/${r.box}` : '';
    lastScan = $('oqcScan').value;
    return r;
  }

  // Search panel
  let findTimer = 0;
  async function findRecords() {
    try {
      const list = await api('GET', `/api/oqc/records?q=${encodeURIComponent($('oqcFindQ').value.trim())}`);
      $('oqcFindCount').textContent = t('rec.count', { n: list.length === 200 ? '200+' : list.length, s: list.length === 1 ? '' : 's' });
      const s2 = x => esc(String(x ?? ''));
      $('oqcFindBody').innerHTML = list.map(r => `<tr class="${r.id === rec.id ? 'editing' : ''}">
          <td class="num">${s2(r.lot)}</td><td>${s2(r.box)}</td><td class="num">${s2(r.itemCode)}</td><td>${s2(r.partNo)}</td>
          <td class="txt" title="${s2(r.customer)}">${s2(r.customer)}</td><td>${s2(r.checkDate)}</td><td class="num">${r.pageCount}</td>
          <td><span class="pill ${r.complete ? 'done' : 'draft'}">${esc(t(r.complete ? 'st.complete' : 'st.draft'))}</span></td>
          <td>${r.total ? `<span class="pill ${r.total === 'NG' ? 'ng' : 'ok'}">${r.total}</span>` : ''}</td>
          <td class="meta">${s2(r.updateBy)} · ${fmtDate(r.updateDate)}</td>
          <td><div class="row-actions"><button class="icon-btn" data-open="${r.id}">${ico('folderOpen')}${T('b.open')}</button></div></td>
        </tr>`).join('') || `<tr><td colspan="11" class="empty-row">${esc(t($('oqcFindQ').value.trim() ? 'rec.noMatch' : 'rec.none'))}</td></tr>`;
    } catch (err) { msg(err.message); }
  }
  function toggleFind(open) {
    $('oqcFind').hidden = !open;
    $('oqcFindBtn').setAttribute('aria-expanded', open);
    if (open) { findRecords(); $('oqcFindQ').focus(); }
  }
  $('oqcFindBtn').onclick = () => toggleFind($('oqcFind').hidden);
  $('oqcFindClose').onclick = () => toggleFind(false);
  $('oqcFindQ').addEventListener('input', () => { clearTimeout(findTimer); findTimer = setTimeout(findRecords, 300); });
  $('oqcFindBody').onclick = async e => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    const id = Number(b.dataset.open);
    if (id !== rec.id && dirty && !await confirmDiscard()) return;
    try {
      const r = await loadRecord(id);
      toggleFind(false);
      msg(t('o.openedRec', { id: r.id, lot: r.lot, box: r.box ? `, Box ${r.box}` : '', state: t(r.complete ? 'st.complete' : 'st.draft') }), 'ok');
      $('oqcForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { msg(err.message); }
  };
  $('oqcSave').onclick = () => saveRecord();
  setStatus();
  langHook = () => { setStatus(); showPages(); if (!$('oqcFind').hidden) findRecords(); };
  if (opts.scan) { $('oqcScan').value = opts.scan; scan(); }

  $('oqcNew').onclick = async () => {
    if (!await uiConfirm({ icon: '🧹', title: t('o.freshT'), message: esc(t('o.freshM')),
      ok: t('b.clearIt'), cancel: t('b.keepEditing') })) return;
    renderOQC(panel);
  };
}
