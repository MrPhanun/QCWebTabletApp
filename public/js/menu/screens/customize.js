// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Administration › Customize UI: font sizes, column widths, spacing and colours of the OQC Data Information sheet.
// The look is saved once on the server (/api/ui-settings) and applies to every user. It is applied as one <style> block
// of override rules (only the values changed from the default), on screen only: printing keeps its own layout.
const UI_FONTS = [['', 'Default'], ['Plus Jakarta Sans', 'Plus Jakarta Sans'], ['Inter', 'Inter'], ['Poppins', 'Poppins'], ['Arial', 'Arial'], ['Tahoma', 'Tahoma']];
// [key, label key, kind, default, min, max, step, unit]
const UI_GROUPS = [
  { k: 'cz.gFont', items: [
    ['fontFamily', 'cz.fontFamily', 'font', ''],
    ['sheetFont', 'cz.sheetFont', 'num', 13, 9, 24, 0.5, 'px'],
    ['titleKm', 'cz.titleKm', 'num', 22, 12, 40, 1, 'px'],
    ['titleEn', 'cz.titleEn', 'num', 17, 10, 32, 1, 'px'],
    ['thFont', 'cz.thFont', 'num', 13, 9, 24, 0.5, 'px'],
    ['enFont', 'cz.enFont', 'num', 11, 8, 20, 0.5, 'px'],
    ['posFont', 'cz.posFont', 'num', 11, 8, 22, 0.5, 'px'],
    ['specFont', 'cz.specFont', 'num', 14, 9, 26, 0.5, 'px'],
    ['smpFont', 'cz.smpFont', 'num', 13, 9, 24, 0.5, 'px'],
    ['resFont', 'cz.resFont', 'num', 13, 9, 24, 0.5, 'px']
  ]},
  { k: 'cz.gWidth', items: [
    ['lenNo', 'cz.lenNo', 'num', 5, 5, 60, 1, 'px'],
    ['lenPos', 'cz.lenPos', 'num', 24, 10, 50, 1, '%'],
    ['lenSpec', 'cz.lenSpec', 'num', 15, 8, 40, 1, '%'],
    ['lenSmp', 'cz.lenSmp', 'num', 10, 5, 20, 0.5, '%'],
    ['lenMin', 'cz.lenMin', 'num', 480, 300, 900, 10, 'px'],
    ['colSplit', 'cz.colSplit', 'num', 50, 30, 70, 1, '%'],
    ['rcWidth', 'cz.rcWidth', 'num', 84, 50, 200, 2, 'px'],
    ['remarks', 'cz.remarks', 'num', 52, 25, 75, 1, '%']
  ]},
  { k: 'cz.gSpace', items: [
    ['cellPad', 'cz.cellPad', 'num', 5, 0, 16, 1, 'px'],
    ['lenPad', 'cz.lenPad', 'num', 3, 0, 14, 1, 'px'],
    ['resH', 'cz.resH', 'num', 32, 22, 48, 1, 'px'],
    ['matRows', 'cz.matRows', 'num', 64, 30, 200, 2, 'px']
  ]},
  { k: 'cz.gColor', items: [
    ['sheetBg', 'cz.sheetBg', 'color', '#ffffff'],
    ['sheetBorder', 'cz.sheetBorder', 'color', '#8fb3a4'],
    ['gridColor', 'cz.gridColor', 'color', '#b5ccc2'],
    ['headBg', 'cz.headBg', 'color', '#f0f9f6'],
    ['inkColor', 'cz.inkColor', 'color', '#0f172a']
  ]},
  // Sizes in the Excel download and the PDF (server/excel-builder.js). Defaults = the template's own sizes; keep the keys,
  // defaults and ranges in step with server/pdf-options.js
  { k: 'cz.gPdf', pdf: true, items: [
    ['pdfCustFont', 'cz.pdfCustFont', 'num', 14, 8, 20, 0.5, 'pt'],
    ['pdfInfoFont', 'cz.pdfInfoFont', 'num', 10.5, 7, 16, 0.5, 'pt'],
    ['pdfMatFont', 'cz.pdfMatFont', 'num', 12, 7, 16, 0.5, 'pt'],
    ['pdfPosFont', 'cz.pdfPosFont', 'num', 10, 6, 14, 0.5, 'pt'],
    ['pdfSpecFont', 'cz.pdfSpecFont', 'num', 10.5, 7, 16, 0.5, 'pt'],
    ['pdfSmpFont', 'cz.pdfSmpFont', 'num', 10.5, 7, 16, 0.5, 'pt'],
    ['pdfResFont', 'cz.pdfResFont', 'num', 9, 6, 14, 0.5, 'pt'],
    ['pdfItemResFont', 'cz.pdfItemResFont', 'num', 10.5, 7, 16, 0.5, 'pt'],
    ['pdfFootFont', 'cz.pdfFootFont', 'num', 10.5, 7, 16, 0.5, 'pt'],
    ['pdfPosW', 'cz.pdfPosW', 'num', 135, 100, 180, 1, '%'],
    ['pdfSpecW', 'cz.pdfSpecW', 'num', 133, 90, 170, 1, '%'],
    ['pdfNoW', 'cz.pdfNoW', 'num', 100, 50, 200, 1, '%'],
    ['pdfSmpW', 'cz.pdfSmpW', 'num', 100, 60, 170, 1, '%'],
    ['pdfLenRowH', 'cz.pdfLenRowH', 'num', 22.5, 15, 36, 0.5, 'pt']
  ]}
];
const UI_ITEMS = UI_GROUPS.flatMap(g => g.items);
const UI_DEFAULT = Object.fromEntries(UI_ITEMS.map(i => [i[0], i[3]]));
let uiSaved = {};   // values changed from the default, as saved on the server

// A value is used only if it fits its option (number in range, #rrggbb colour, a listed font); anything else = default
function uiClean(src) {
  const out = {};
  for (const [key, , kind, def, min, max] of UI_ITEMS) {
    let v = src && src[key];
    if (kind === 'num') { if (v === '' || v === null || typeof v === 'boolean') continue; v = Number(v); if (!Number.isFinite(v) || v < min || v > max) continue; }
    else if (kind === 'color') { if (!/^#[0-9a-f]{6}$/i.test(String(v || ''))) continue; v = String(v).toLowerCase(); }
    else if (kind === 'font') { if (!UI_FONTS.some(f => f[0] === v)) continue; }
    if (v !== def) out[key] = v;
  }
  return out;
}

// Override rules for the values in `vals`, under the selector S (the sheet)
function uiCss(vals, S) {
  const px = n => `${+n}px`, r = [];
  const has = k => vals[k] !== undefined;
  const add = (cond, css) => { if (cond) r.push(css); };
  const v = vals;
  add(has('fontFamily') && v.fontFamily, `${S}, ${S} input, ${S} textarea, ${S} select, ${S} .oqc-co b, ${S} .oqc-title b { font-family: "${v.fontFamily}", "Noto Sans Khmer", sans-serif; }`);
  // (not the Length Position / SPEC boxes, which have their own sizes below)
  add(has('sheetFont'), `${S}, ${S} input:not([data-pos]):not(.spec), ${S} textarea { font-size: ${px(v.sheetFont)}; }`);
  add(has('titleKm'), `${S} .oqc-title .km { font-size: ${px(v.titleKm)}; }`);
  add(has('titleEn'), `${S} .oqc-title b { font-size: ${px(v.titleEn)}; }`);
  add(has('thFont'), `${S} table.oqc th { font-size: ${px(v.thFont)}; }`);
  add(has('enFont'), `${S} .en { font-size: ${px(v.enFont)}; }`);
  add(has('posFont'), `${S} .oqc-len input[data-pos], ${S} .oqc-len .pos-view { font-size: ${px(v.posFont)}; } ${S} .oqc-len .pos-view.long { font-size: ${px(v.posFont * 0.86)}; }`);
  add(has('specFont'), `${S} .oqc-len .spec-view { font-size: ${px(v.specFont)}; } ${S} .oqc-len .spec-view .frac, ${S} .oqc-len input.spec { font-size: ${px(v.specFont * 0.86)}; }`);
  add(has('smpFont'), `${S} .oqc-len input.smp { font-size: ${px(v.smpFont)}; }`);
  add(has('resFont'), `${S} select.res { font-size: ${px(v.resFont)}; } ${S} .oqc-len select.len-res { font-size: ${px(v.resFont - 1)}; }`);
  add(has('lenNo'), `${S} .oqc-len th.no, ${S} .oqc-len td.no { width: ${px(v.lenNo)}; }`);
  add(has('lenPos'), `${S} .oqc-len tr:not(.sec) td:nth-child(2) { width: ${v.lenPos}%; }`);
  add(has('lenSpec'), `${S} .oqc-len tr:not(.sec) td:nth-child(3) { width: ${v.lenSpec}%; }`);
  add(has('lenSmp'), `${S} .oqc-len td.smp, ${S} .oqc-len td.smp-res { width: ${v.lenSmp}%; }`);
  add(has('lenMin'), `${S} .oqc-len { min-width: ${px(v.lenMin)}; }`);
  add(has('colSplit'), `@media (min-width: 1101px) { ${S} .oqc-cols { grid-template-columns: minmax(0, ${v.colSplit}fr) minmax(0, ${100 - v.colSplit}fr); } }`);
  add(has('rcWidth'), `${S} table.oqc td.rc { width: ${px(v.rcWidth)}; }`);
  add(has('remarks'), `${S} .oqc-foot td[rowspan] { width: ${v.remarks}% !important; }`);
  add(has('cellPad'), `${S} table.oqc:not(.oqc-len) th, ${S} table.oqc:not(.oqc-len) td { padding-top: ${px(v.cellPad)}; padding-bottom: ${px(v.cellPad)}; }`);
  add(has('lenPad'), `${S} .oqc-len td, ${S} .oqc-len th { padding-top: ${px(v.lenPad)}; padding-bottom: ${px(v.lenPad)}; }`);
  add(has('resH'), `${S} select.res { height: ${px(v.resH)}; } ${S} .oqc-len select.len-res { height: ${px(v.resH - 2)}; }`);
  add(has('matRows'), `${S} .oqc-cols textarea[id^="oqc-"] { min-height: ${px(v.matRows)}; }`);
  add(has('sheetBg'), `${S} { background: ${v.sheetBg}; }`);
  add(has('sheetBorder'), `${S} { border-color: ${v.sheetBorder}; }`);
  add(has('gridColor'), `${S} table.oqc th, ${S} table.oqc td { border-color: ${v.gridColor}; }`);
  add(has('headBg'), `${S} table.oqc th { background: ${v.headBg}; }`);
  add(has('inkColor'), `${S}, ${S} input, ${S} textarea, ${S} .oqc-len .pos-view { color: ${v.inkColor}; }`);
  return r.length ? `@media screen {\n${r.join('\n')}\n}` : '';
}

// One <style> per id, after all the stylesheets
function uiStyle(id, css) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('style'); el.id = id; document.head.appendChild(el); }
  el.textContent = css;
}
// The saved look: every OQC sheet (not the SPEC page, which shares the sheet classes)
const applyUiSettings = vals => { uiSaved = uiClean(vals); uiStyle('uiCustom', uiCss(uiSaved, '.oqc-sheet:not(.spec-page)')); };
function loadUiSettings() {
  if (!(can('daily.view') || can('ui.view'))) return Promise.resolve();
  return fetch('/api/ui-settings').then(r => r.ok ? r.json() : {}).then(d => applyUiSettings(d.settings || {})).catch(() => {});
}

function renderCustomize(panel) {
  const canEdit = can('ui.edit');
  let draft = { ...UI_DEFAULT, ...uiSaved };
  const S = '.ui-preview .oqc-sheet';
  const unitOf = i => i[7] ? `<span class="cz-unit">${i[7]}</span>` : '';
  const ctl = i => {
    const [key, , kind, , min, max, step] = i, dis = canEdit ? '' : ' disabled';
    if (kind === 'font') return `<select data-k="${key}"${dis}>${UI_FONTS.map(([v, l]) => `<option value="${esc(v)}">${esc(v ? l : t('cz.default'))}</option>`).join('')}</select>`;
    if (kind === 'color') return `<input type="color" data-k="${key}"${dis}><code class="cz-hex" data-hex="${key}"></code>`;
    return `<input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}"${dis}>
      <input type="number" class="cz-num" data-n="${key}" min="${min}" max="${max}" step="${step}"${dis}>${unitOf(i)}`;
  };
  // A small copy of the OQC sheet with sample values; the draft look is applied to it as you change things
  const smp = [['1', '10(4-CN1)', '100 (+10/-5)', ['101', '99', '102']], ['2', '12(4-CN2PU_ AH-3)', '250±5', ['249', '251', '256']],
    ['3', '13(SW)', '30±2', ['30', '31', '29']]];
  const lenTbl = () => `<table class="oqc oqc-len">
      <thead><tr><th class="c no" rowspan="2">№</th><th rowspan="2">${bi('ទីតាំងប្រវែង', 'Length Position')}</th>
        <th rowspan="2">${bi('តំលៃប្រវែងកំណត់', 'SPEC')}</th><th class="c" colspan="5">Sample</th></tr>
        <tr>${OQC_CIRC.map(c => `<th class="c">${c}</th>`).join('')}</tr></thead>
      <tbody>${smp.map(([n, pos, spec, vals]) => `<tr><td class="no">${n}</td>
        <td class="pos-cell"><input data-pos value="${esc(pos)}" tabindex="-1" readonly><span class="pos-view${pos.length > 14 ? ' long' : ''}">${esc(pos)}</span></td>
        <td class="spc"><input class="spec" value="${esc(spec)}" tabindex="-1" readonly><span class="spec-view">${specHtml(spec)}</span></td>
        ${OQC_CIRC.map((_, s) => `<td class="smp"><input class="smp${vals[s] === '256' ? ' ng' : ''}" value="${vals[s] || ''}" tabindex="-1" readonly></td>`).join('')}</tr>`).join('')}
        <tr class="sec"><td colspan="3">${bi('លទ្ធផល', 'Result')}</td>${OQC_CIRC.map((_, s) => `<td class="smp-res"><select class="res len-res" data-v="${s === 1 ? 'NG' : 'OK'}" tabindex="-1"><option>${s === 1 ? 'NG' : 'OK'}</option></select></td>`).join('')}</tr>
      </tbody></table>`;
  const res = v => `<select class="res" data-v="${v}" tabindex="-1"><option>${v}</option></select>`;
  const preview = `<div class="oqc-sheet" aria-hidden="true">
      ${oqcHead(`<label>${bi('ថ្ងៃត្រួតពិនិត្យ', 'CHECK DATE')}<input value="12-11-2026" tabindex="-1" readonly></label><small class="oqc-sheet-page">Page 1 / 1</small>`)}
      <div class="oqc-info-wrap"><table class="oqc oqc-info">
        <tr>${OQC_INFO.map(([km, en]) => `<th class="c">${bi(km, en)}</th>`).join('')}</tr>
        <tr>${['MARUNIX', 'AB-1234-00', '12-11-2026', '500', '13'].map(x => `<td><input value="${x}" tabindex="-1" readonly></td>`).join('')}
          <td><div class="seg oqc-prob"><button type="button" data-prob="Normal" aria-pressed="true" tabindex="-1">Normal</button><button type="button" data-prob="Strict" aria-pressed="false" tabindex="-1">Strict</button></div></td></tr>
      </table></div>
      <div class="oqc-cols">
        <table class="oqc">${OQC_MAT_HEAD}${OQC_MATERIAL.slice(0, 2).map(([n, km, en]) => `<tr>
          <td><div class="oqc-sec-title">${n} <span class="km">${km}</span> <span class="en">[${en}]</span></div>
            <textarea id="oqc-pv-${en.toLowerCase()}" rows="3" tabindex="-1" readonly>AVSS 0.5 BK</textarea></td><td class="rc">${res('OK')}</td></tr>`).join('')}</table>
        <table class="oqc">${OQC_ITEM_HEAD}${OQC_ITEMS.slice(0, 4).map(([km, en]) => `<tr><td>${bi(km, en)}</td><td class="rc">${res('OK')}</td></tr>`).join('')}</table>
      </div>
      <div><div class="oqc-sec-title"><span class="km">2) ត្រួតពិនិត្យប្រវែង</span> <span class="en">[Length Check]</span></div>
        <div class="oqc-cols"><div class="oqc-len-wrap">${lenTbl()}</div><div class="oqc-len-wrap">${lenTbl()}</div></div></div>
      <div class="oqc-foot-wrap"><table class="oqc oqc-foot"><tr>
        <td rowspan="2" style="width:52%"><div class="remark-row"><span class="remark-label">${bi('កំណត់សំគាល់', 'Remarks')}</span><textarea rows="2" tabindex="-1" readonly></textarea></div></td>
        <th class="c">${bi('សរុបលទ្ធផល', 'Total Determination')}</th><th class="c">${bi('ត្រួតពិនិត្យដោយ', 'Checked by')}</th><th class="c">${bi('អ្នកត្រួតពិនិត្យ', 'Inspector')}</th></tr>
        <tr><td>${res('OK')}</td><td><input value="2398" tabindex="-1" readonly></td><td><input value="${esc(String((currentUser && currentUser.username) || ''))}" tabindex="-1" readonly></td></tr>
      </table></div>
    </div>`;

  panel.innerHTML = `
    <div class="readonly-note" ${canEdit ? 'hidden' : ''}>${svg('lock')} ${T('cz.readonly')}</div>
    <p class="perm-hint">${T('cz.hint')}</p>
    <div class="cz-layout">
      <div class="cz-side">
        ${UI_GROUPS.map(g => `<section class="cz-group"><h3>${T(g.k)}</h3>
          ${g.items.map(i => `<div class="cz-row" data-row="${i[0]}">
            <label class="cz-label" for="cz-${i[0]}">${T(i[1])}</label>
            <div class="cz-ctl">${ctl(i).replace(`data-k="${i[0]}"`, `data-k="${i[0]}" id="cz-${i[0]}"`)}</div>
            <button type="button" class="cz-reset" data-reset="${i[0]}" ${TT('cz.resetOne')}${canEdit ? '' : ' disabled'}>↺</button>
          </div>`).join('')}${g.pdf ? `<p class="cz-note">${T('cz.pdfNote')}</p>
          <div class="cz-test"><button class="icon-btn" type="button" data-test="excel" ${canEdit && can('daily.excel') ? '' : 'disabled'}>${ico('excel')}${T('cz.testExcel')}</button>
            <button class="icon-btn" type="button" data-test="pdf" ${canEdit && can('daily.excel') ? '' : 'disabled'}>${ico('printer')}${T('cz.testPdf')}</button></div>` : ''}</section>`).join('')}
      </div>
      <div class="cz-main">
        <div class="cz-bar">
          <span class="cz-state" id="czState"></span>
          <div class="msg" id="czMsg" role="status"></div>
          <span class="spacer"></span>
          <button class="icon-btn" id="czDefault" type="button" ${canEdit ? '' : 'disabled'}>${ico('sparkle')}${T('cz.allDefault')}</button>
          <button class="icon-btn" id="czCancel" type="button" ${canEdit ? '' : 'disabled'}>${ico('x')}${T('b.cancel')}</button>
          <button class="btn-primary" id="czSave" type="button" ${canEdit ? '' : 'disabled'}>${ico('save')}${T('b.save')}</button>
        </div>
        <div class="cz-preview-title">${T('cz.preview')}</div>
        <div class="ui-preview">${preview}</div>
      </div>
    </div>`;
  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('czMsg').textContent = text; $('czMsg').className = 'msg ' + kind; };
  const same = (a, b) => { const ka = Object.keys(a), kb = Object.keys(b); return ka.length === kb.length && ka.every(k => a[k] === b[k]); };

  function show() {
    for (const [key, , kind] of UI_ITEMS) {
      const el = panel.querySelector(`[data-k="${key}"]`), v = draft[key];
      el.value = v;
      if (kind === 'num') panel.querySelector(`[data-n="${key}"]`).value = v;
      if (kind === 'color') panel.querySelector(`[data-hex="${key}"]`).textContent = v;
      panel.querySelector(`[data-row="${key}"]`).classList.toggle('changed', v !== UI_DEFAULT[key]);
    }
    const changed = !same(uiClean(draft), uiSaved);
    $('czState').textContent = changed ? t('cz.unsaved') : t('cz.saved');
    $('czState').dataset.state = changed ? 'changed' : 'saved';
    if (canEdit) { $('czSave').disabled = !changed; $('czCancel').disabled = !changed; }
    // Preview: every value (not only the changed ones), so it never mixes with the saved look
    uiStyle('uiCustomDraft', uiCss({ ...UI_DEFAULT, ...draft, fontFamily: draft.fontFamily || undefined }, S));
  }
  const set = (key, raw) => {
    const item = UI_ITEMS.find(i => i[0] === key);
    let v = raw;
    if (item[2] === 'num') { v = Number(raw); if (raw === '' || !Number.isFinite(v)) return; v = Math.min(item[5], Math.max(item[4], v)); }
    draft[key] = v; show();
  };
  panel.addEventListener('input', e => {
    const k = e.target.dataset.k || e.target.dataset.n;
    if (k && e.target.type !== 'number') set(k, e.target.value);
  });
  // Number boxes apply when you leave them or press Enter (so typing "1" on the way to "14" does not jump the slider)
  panel.addEventListener('change', e => { const k = e.target.dataset.n || e.target.dataset.k; if (k) set(k, e.target.value); });
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-reset]'); if (!b) return;
    draft[b.dataset.reset] = UI_DEFAULT[b.dataset.reset]; show();
  });
  // Test Excel / Test PDF: the sample record above, made with the PDF / Excel values as they are now (saved or not)
  const testPage = () => ({
    customer: 'MARUNIX', partNo: 'SAMPLE-0001', lot: '12-11-2026', qty: '500', spot: '13', probability: 'Normal', checkDate: '2026-11-12',
    material: { wire: 'AVSS 0.5 BK, AVSS 0.85 RD', terminal: 'SWPT-001T-P025', housing: 'PHR-4', other: '/' },
    items: { 'Material Wire': 'OK', 'Material Terminal': 'OK', 'Material Housing': 'OK', 'Material Other': '/', ...Object.fromEntries(OQC_ITEMS.map(([, en, def]) => [en, def])) },
    lengths: smp.map(([n, pos, spec, vals]) => ({ no: +n, position: pos, spec, samples: vals })),
    lengthResults: [['OK', 'NG', 'OK', '/', '/'], ['', '', '', '', '']],
    remarks: 'Sample', total: 'OK', checkedBy: '2398', inspector: String((currentUser && currentUser.username) || '')
  });
  panel.addEventListener('click', async e => {
    const b = e.target.closest('[data-test]'); if (!b) return;
    const pdf = b.dataset.test === 'pdf';
    const pdfPreview = Object.fromEntries(Object.entries(uiClean(draft)).filter(([k]) => k.startsWith('pdf')));
    b.disabled = true; setBusy(true); msg(pdf ? t('cz.testing') : '', 'ok');
    try {
      const res = await fetch(pdf ? '/api/pdf/oqc' : '/api/excel/oqc', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: 'Customize_test', itemList: OQC_ITEMS.map(([km, en]) => [km, en]), pages: [testPage()], pdfPreview }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ? trServer(d.error) : t('e.request', { status: res.status })); }
      const url = URL.createObjectURL(await res.blob()), a = document.createElement('a');
      a.href = url; a.download = 'Customize_test' + (pdf ? '.pdf' : '.xlsx'); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      msg(t('cz.testDone'), 'ok');
    } catch (err) { msg(err instanceof TypeError ? t('e.server') : err.message); }
    finally { b.disabled = false; setBusy(false); }
  });
  $('czDefault').onclick = () => { draft = { ...UI_DEFAULT }; show(); msg(t('cz.defaultNote'), 'ok'); };
  $('czCancel').onclick = () => { draft = { ...UI_DEFAULT, ...uiSaved }; show(); msg(''); };
  $('czSave').onclick = async () => {
    $('czSave').disabled = true;
    try {
      const d = await api('PUT', '/api/ui-settings', { settings: uiClean(draft) });
      applyUiSettings(d.settings || {});
      draft = { ...UI_DEFAULT, ...uiSaved };
      msg(t('cz.savedMsg'), 'ok');
    } catch (err) { msg(err.message); }
    show();
  };

  langHook = () => { const o = panel.querySelector('[data-k="fontFamily"] option[value=""]'); if (o) o.textContent = t('cz.default'); };
  // Start from what the server has now (someone else may have changed it since this page was loaded)
  show();
  setBusy(true);
  fetch('/api/ui-settings').then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !panel.isConnected) return;
    applyUiSettings(d.settings || {});
    draft = { ...UI_DEFAULT, ...uiSaved };
    show();
  }).catch(() => {}).finally(() => setBusy(false));
}
