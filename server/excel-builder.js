// Fill an OQC Inspection record template with one or more pages and return the .xlsx bytes.
// The template is used exactly as it is: values are written into its own cells (package XML) and nothing else changes —
// no merging, no borders, no styles, no print setup. Pages are stacked on one worksheet, 43 rows each.
const path = require('path');
const fs = require('fs');
const JSZip = require('jszip');

// OQC Data Information uses the "OQC Data Information" sheet of its template file (the file also holds a "Spec" sheet);
// the SPEC page uses the print template
const TEMPLATES = {
  oqc: { file: path.join(__dirname, '..', 'templates', 'OQC Data.xlsx'), sheet: 'OQC Data Information', drawing: true },
  spec: { file: path.join(__dirname, '..', 'templates', 'Spec.xlsx'), sheet: null }
};
const ROWS = 11;              // length rows per table (№ 1-11 left, 12-22 right)

// Length columns in the template: [№, Position, SPEC, sample ①..⑤] as [first, last] column letters
const LEFT = { pos: ['C', 'G'], spec: ['H', 'J'], samples: [['K', 'L'], ['M', 'O'], ['P', 'R'], ['S', 'U'], ['V', 'X']], result: ['K', 'X'] };
const RIGHT = { pos: ['AA', 'AE'], spec: ['AF', 'AH'], samples: [['AI', 'AJ'], ['AK', 'AM'], ['AN', 'AP'], ['AQ', 'AS'], ['AT', 'AV']], result: ['AI', 'AV'] };
const FIRST_LEN_ROW = 30, RESULT_ROW = 41;
const ITEM_ROWS = [9, 11, 13, 15, 17, 19, 21, 23, 25];   // 3) INSPECTION POINT ① .. ⑨, two rows each (result in column AT)
// 1) MATERIAL CHECK: text area under each label (left of the Result column) and that material's Result cell
const MATERIAL = { wire: 'C10:AB12', terminal: 'C14:AB17', housing: 'C19:AB22', other: 'C24:AB26' };
const MATERIAL_RESULT = { wire: 'AC9', terminal: 'AC13', housing: 'AC18', other: 'AC23' };
// The merged Result box of each material (a material that is not used gets a line over it too)
const MATERIAL_RESULT_BOX = { wire: 'AC9:AE12', terminal: 'AC13:AE17', housing: 'AC18:AE22', other: 'AC23:AE26' };
// OQC: the material text goes one line per row of its area, in column C
const MATERIAL_ROWS = { wire: [10, 11, 12], terminal: [14, 15, 16, 17], housing: [19, 20, 21, 22], other: [24, 25, 26] };
// Saved result key of one material (the page's "Material Wire result" select, ...)
const materialKey = k => 'Material ' + k[0].toUpperCase() + k.slice(1);
// SPEC template: the material text goes into the text box with one of these shape names (any letter case).
// A box missing from the template falls back to the first cell of its MATERIAL range.
const SPEC_TEXTBOX = { wire: ['Wire', 'TextBox 11'], terminal: ['Terminal', 'TextBox 14'], housing: ['Housing', 'TextBox 12'], other: ['Other', 'TextBox 13'] };

const colName = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const colNum = c => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colLetter = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const asNum = v => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : v);
// 2026-10-19 -> 19-10-2026
const dmy = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(s || ''); };

const xmlText = s => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');


// Put a value into an existing cell of the sheet XML, keeping the cell's own style (s=). Nothing else is touched: the cell is
// not merged and its border, font and alignment stay as in the template. A number is stored as a number, anything else as
// text. An empty value leaves the cell as it is.
function setCell(sheet, ref, value) {
  if (value === undefined || value === null || String(value) === '') return sheet;
  const isNum = typeof value === 'number' && Number.isFinite(value);
  // { text, size, font }: the text as a run with its own size, for a value that does not fit its cell (the cell style stays)
  const body = isNum ? `<v>${value}</v>`
    : typeof value === 'object' ? `<is><r><rPr><sz val="${value.size}"/><rFont val="${xmlText(value.font)}"/></rPr><t xml:space="preserve">${xmlText(value.text)}</t></r></is>`
    : `<is><t xml:space="preserve">${xmlText(value)}</t></is>`;
  const type = isNum ? '' : ' t="inlineStr"';
  const re = new RegExp(`<c r="${ref}"((?:\\s+[\\w:]+="[^"]*")*)\\s*(?:/>|>[\\s\\S]*?</c>)`);
  const m = sheet.match(re);
  if (m) return sheet.replace(re, () => `<c r="${ref}"${m[1].replace(/\s+t="[^"]*"/, '')}${type}>${body}</c>`);
  // The template has no such cell (an unstyled blank): add it to its row, in column order
  const [, col, rowNo] = ref.match(/^([A-Z]+)(\d+)$/);
  const rowRe = new RegExp(`<row r="${rowNo}"((?:\\s+[\\w:]+="[^"]*")*)\\s*(?:/>|>([\\s\\S]*?)</row>)`);
  const rm = sheet.match(rowRe);
  if (!rm) throw new Error(`Template has no row ${rowNo} for cell ${ref}`);
  const cell = `<c r="${ref}"${type}>${body}</c>`;
  let inner = rm[2] || '';
  const after = (inner.match(/<c r="[A-Z]+\d+"(?:[^>]*\/>|[^>]*>[\s\S]*?<\/c>)/g) || []).find(c => colNum(c.match(/<c r="([A-Z]+)/)[1]) > colNum(col));
  inner = after ? inner.replace(after, () => cell + after) : inner + cell;
  return sheet.replace(rowRe, () => `<row r="${rowNo}"${rm[1]}>${inner}</row>`);
}

// Merge a box the way the template merges its other boxes (nothing is restyled: each cell keeps its own borders)
function addMerge(sheet, range) {
  if (sheet.includes(`<mergeCell ref="${range}"/>`)) return sheet;
  return sheet.replace(/<mergeCells count="(\d+)">/, (m, n) => `<mergeCells count="${+n + 1}"><mergeCell ref="${range}"/>`);
}
// Give a cell the style (s=) of another template cell
function useStyle(sheet, ref, s) {
  return sheet.replace(new RegExp(`(<c r="${ref}"[^>]*?\\bs=")\\d+(")`), (m, a, b) => a + s + b);
}
const styleOf = (sheet, ref) => (sheet.match(new RegExp(`<c r="${ref}"[^>]*?\\bs="(\\d+)"`)) || [])[1];

// ---- Cell styles (xl/styles.xml): a copy of an existing style with one change, added at the end so nothing else moves ----
const xfList = styles => (styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g)) || [];
function addXf(ctx, xf) {
  const n = xfList(ctx.styles).length;
  ctx.styles = ctx.styles.replace(/<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/, (m, body) => `<cellXfs count="${n + 1}">${body}${xf}</cellXfs>`);
  return n;
}
// An xf with its text centered (horizontal + vertical); borders, font and number format as they were
function centerXf(xf) {
  const al = '<alignment horizontal="center" vertical="center"/>';
  let out = xf.replace(/\s*applyAlignment="[^"]*"/, '');
  if (/<alignment\b[^>]*\/>/.test(out)) out = out.replace(/<alignment\b[^>]*\/>/, al);
  else if (/\/>$/.test(out)) out = out.replace(/\/>$/, `>${al}</xf>`);
  else if (out.includes('<protection')) out = out.replace('<protection', al + '<protection');
  else out = out.replace(/<\/xf>$/, al + '</xf>');
  return out.replace(/<xf\b/, '<xf applyAlignment="1"');
}
// Style index s with centered text
function centeredStyle(ctx, s) {
  ctx.cache = ctx.cache || {};
  const key = 'c' + s;
  return ctx.cache[key] ?? (ctx.cache[key] = addXf(ctx, centerXf(xfList(ctx.styles)[+s])));
}
// Style index s, centered, with its border plus one thin diagonal line from bottom-left to top-right
function diagonalStyle(ctx, s, down = false) {
  ctx.cache = ctx.cache || {};
  const key = (down ? 'D' : 'd') + s;
  if (ctx.cache[key] !== undefined) return ctx.cache[key];
  const xf = xfList(ctx.styles)[+s];
  const borders = ctx.styles.match(/<borders\b[^>]*>([\s\S]*?)<\/borders>/)[1].match(/<border\b[^>]*?(?:\/>|>[\s\S]*?<\/border>)/g) || [];
  const diagonal = '<diagonal style="thin"><color rgb="FF000000"/></diagonal>';
  let b = borders[+((xf.match(/\bborderId="(\d+)"/) || [])[1] || 0)] || '<border/>';
  if (/\/>$/.test(b) && !b.includes('</border>')) b = '<border><left/><right/><top/><bottom/><diagonal/></border>';
  b = b.replace(/<border\b[^>]*?>/, down ? '<border diagonalDown="1">' : '<border diagonalUp="1">');
  b = /<diagonal\b/.test(b) ? b.replace(/<diagonal\b[^>]*\/>|<diagonal\b[^>]*>[\s\S]*?<\/diagonal>/, diagonal) : b.replace('</border>', diagonal + '</border>');
  ctx.styles = ctx.styles.replace(/<borders count="\d+">([\s\S]*?)<\/borders>/, (m, body) => `<borders count="${borders.length + 1}">${body}${b}</borders>`);
  const withBorder = centerXf(xf).replace(/\s*borderId="\d+"/, '').replace(/\s*applyBorder="[^"]*"/, '').replace(/<xf\b/, `<xf borderId="${borders.length}" applyBorder="1"`);
  return (ctx.cache[key] = addXf(ctx, withBorder));
}
// A number only when it reads back exactly the same ("440" yes, "4.0" and "007" stay text)
const exactNum = v => { const t = String(v ?? '').trim(); return t !== '' && Number.isFinite(Number(t)) && String(Number(t)) === t ? Number(t) : String(v ?? ''); };

// A SPEC "100 (+10/-5)" written as on the screen: "100 ±" with 10 above 5 beside it. The template's merged SPEC box (3 cells) is split
// into "100 ±" (first two cells) and the stacked tolerance (last cell, two small lines); the outer border stays, no line between them.
// Anything else (30±5, (60)) goes into the whole box as before.
const SPEC_TOL = /^\s*(\d+(?:\.\d+)?)\s*\(\s*\+\s*(\d+(?:\.\d+)?)\s*\/\s*-\s*(\d+(?:\.\d+)?)\s*\)\s*$/;
function specSplitStyles(ctx) {
  if (ctx.cache && ctx.cache.spec) return ctx.cache.spec;
  ctx.cache = ctx.cache || {};
  const edge = (n, open) => `<border><left${open === 'L' ? '' : ' style="thin"'}>${open === 'L' ? '' : '<color indexed="64"/>'}</left><right${open === 'R' ? '' : ' style="thin"'}>${open === 'R' ? '' : '<color indexed="64"/>'}</right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>`;
  const nB = +ctx.styles.match(/<borders count="(\d+)"/)[1], nF = +ctx.styles.match(/<fonts count="(\d+)"/)[1];
  ctx.styles = ctx.styles
    .replace(/<borders count="\d+">([\s\S]*?)<\/borders>/, (m, b) => `<borders count="${nB + 2}">${b}${edge(0, 'R')}${edge(0, 'L')}</borders>`)
    .replace(/<fonts count="\d+"([^>]*)>([\s\S]*?)<\/fonts>/, (m, a, b) => `<fonts count="${nF + 2}"${a}>${b}<font><sz val="9"/><name val="Cambria"/><family val="1"/></font><font><sz val="10.5"/><name val="Cambria"/><family val="1"/></font></fonts>`);
  const left = addXf(ctx, `<xf numFmtId="0" fontId="${nF + 1}" fillId="0" borderId="${nB}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>`);
  const right = addXf(ctx, `<xf numFmtId="0" fontId="${nF}" fillId="0" borderId="${nB + 1}" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>`);
  return (ctx.cache.spec = { left, right });
}
function setSpec(sheet, side, row, spec, ctx) {
  const m = String(spec ?? '').match(SPEC_TOL);
  const [c1, c3] = side.spec, c2 = colName(colNum(c1) + 1);
  if (!m && ctx && String(spec ?? '') !== '') {
    // plain SPEC text (30±5, Max10, (60)): middle left in its box
    const s = styleOf(sheet, `${c1}${row}`);
    if (s !== undefined) {
      const key = 'l' + s;
      ctx.cache = ctx.cache || {};
      ctx.cache[key] ??= addXf(ctx, centerXf(xfList(ctx.styles)[+s]).replace('horizontal="center"', 'horizontal="left"'));
      sheet = useStyle(sheet, `${c1}${row}`, ctx.cache[key]);
    }
  }
  if (!m || !ctx) return setCell(sheet, `${c1}${row}`, String(spec ?? '') === '' ? spec : { text: String(spec), size: 10.5, font: 'Cambria' });
  const st = specSplitStyles(ctx);
  sheet = sheet.replace(`<mergeCell ref="${c1}${row}:${c3}${row}"/>`, `<mergeCell ref="${c1}${row}:${c2}${row}"/>`);
  sheet = useStyle(useStyle(sheet, `${c1}${row}`, st.left), `${c2}${row}`, st.left);
  sheet = useStyle(sheet, `${c3}${row}`, st.right);
  sheet = setCell(sheet, `${c1}${row}`, `${m[1]} ±`);
  return setCell(sheet, `${c3}${row}`, `${m[2]}
${m[3]}`);
}

// The two Length Check tables (left and right) get the same column widths: each part (position, SPEC, each sample) takes the average
// of its two widths, shared out over that part's columns in proportion to what they were
function equalizeLengthTables(sheet) {
  const m = sheet.match(/<cols>([\s\S]*?)<\/cols>/);
  if (!m) return sheet;
  const cols = [];   // per column: [attributes without min/max/width, width]
  for (const c of m[1].match(/<col\b[^>]*\/>/g) || []) {
    const a = k => (c.match(new RegExp(`\\b${k}="([^"]*)"`)) || [])[1];
    const rest = c.replace(/\s(?:min|max|width)="[^"]*"/g, '').replace(/^<col/, '').replace(/\/>$/, '');
    for (let i = +a('min'); i <= Math.min(+a('max'), 100); i++) cols[i] = [rest, +a('width')];
  }
  const parts = k => [LEFT.pos, LEFT.spec, ...LEFT.samples].map((l, i) => [l, [RIGHT.pos, RIGHT.spec, ...RIGHT.samples][i]]);
  for (const [l, r] of parts()) {
    const idx = ([a, b]) => Array.from({ length: colNum(b) - colNum(a) + 1 }, (_, i) => colNum(a) + i);
    const li = idx(l), ri = idx(r);
    if (l === LEFT.spec) {   // the SPEC box is split into "100 ±" and the stacked tolerance: column by column the same, so the split falls at the same place
      li.forEach((c, k) => { cols[c][1] = cols[ri[k]][1] = Math.round((cols[c][1] + cols[ri[k]][1]) / 2 * 1000) / 1000; });
      continue;
    }
    const sum = ix => ix.reduce((t, i) => t + cols[i][1], 0);
    const target = (sum(li) + sum(ri)) / 2;
    for (const ix of [li, ri]) { const f = target / sum(ix); for (const i of ix) cols[i][1] = Math.round(cols[i][1] * f * 1000) / 1000; }
  }
  const out = cols.map((c, i) => c && `<col min="${i}" max="${i}" width="${c[1]}"${c[0]}/>`).filter(Boolean).join('');
  return sheet.replace(m[0], `<cols>${out}${(m[1].match(/<col\b[^>]*\bmin="\d{3,}"[^>]*\/>/g) || []).join('')}</cols>`);
}

// A material line is one cell per row (no wrapping, it would run on past the Result box): a line longer than the box goes
// on under it, broken after a space / comma / semicolon where it can
const MATERIAL_LINE_MAX = 58;
function wrapLine(line) {
  const out = [];
  let rest = String(line);
  while (rest.length > MATERIAL_LINE_MAX) {
    const head = rest.slice(0, MATERIAL_LINE_MAX + 1);
    const at = Math.max(head.lastIndexOf(' '), head.lastIndexOf(','), head.lastIndexOf(';'));
    const cut = at > MATERIAL_LINE_MAX / 2 ? at + 1 : MATERIAL_LINE_MAX;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  out.push(rest);
  return out;
}

// ---- OQC Data Information: values pasted into the template's own cells, nothing else changed ----
function fillOqcSheet(sheet, d, itemList, ctx, textBoxes = false) {
  const set = (ref, v) => { sheet = setCell(sheet, ref, v); };
  sheet = equalizeLengthTables(sheet);
  const items = d.items || {};
  // AT3:AV3 are three small unmerged cells: the date runs across them, a little smaller so that it fits
  if (d.checkDate) set('AT3', { text: dmy(d.checkDate), size: 8, font: 'Times New Roman' });
  // Info row
  set('A7', d.customer); set('I7', d.partNo); set('U7', d.lot);
  set('AB7', asNum(d.qty)); set('AI7', asNum(d.spot)); set('AP7', d.probability);
  // 1) Material check: each material's result, and its text one line per row
  // (records saved before the per-material results have one 'Material check' result for all four)
  // (a material that is not used ("/") has no result text: a line is drawn over its Result box instead)
  for (const [k, ref] of Object.entries(MATERIAL_RESULT)) set(ref, String((d.material || {})[k] || '') === '/' ? '' : items[materialKey(k)] ?? items['Material check'] ?? '');
  for (const [k, rows] of Object.entries(MATERIAL_ROWS)) {
    // Not used ("/"): no text, a line shape is drawn over the box instead (see addMaterialLines)
    if (String((d.material || {})[k] || '') === '/') continue;
    if (textBoxes) continue;
    const lines = String((d.material || {})[k] || '').split(/\r?\n/).flatMap(wrapLine);
    if (lines.length > rows.length) lines.splice(rows.length - 1, lines.length - rows.length + 1, lines.slice(rows.length - 1).join(' '));
    // every line takes the font of the first line (the lower rows of a box are set smaller in the template)
    const first = styleOf(sheet, `C${rows[0]}`);
    lines.forEach((line, i) => {
      if (i > 0 && first !== undefined && line) sheet = useStyle(sheet, `C${rows[i]}`, first);
      set(`C${rows[i]}`, line);
    });
  }
  // 3) Inspection point ① .. ⑨ (same order as itemList)
  // Every result is a 3-column x 2-row box, merged and centered like ⑤ (AT17:AV18) is in the template: the box is merged,
  // and its first cell takes ⑤'s style when it has the same borders but is not centered (same top and left lines, so no line changes)
  const centered = styleOf(sheet, 'AT17');
  itemList.forEach(([, en], i) => {
    const r = ITEM_ROWS[i];
    if (!r) return;
    sheet = addMerge(sheet, `AT${r}:AV${r + 1}`);
    if (styleOf(sheet, `AT${r}`) === '18') sheet = useStyle(sheet, `AT${r}`, centered);
    set(`AT${r}`, items[en] === '/' ? '' : items[en] || '');   // "/" (not used): a line is drawn over the box instead (see addMaterialLines)
  });
  // 2) Length check: № 1-11 on the left table, 12-22 on the right
  const byNo = new Map((d.lengths || []).map(l => [Number(l.no), l]));
  // Merge a cell box and center its text (the box keeps its cells' own borders)
  const centerBox = (c1, c2, r) => {
    sheet = addMerge(sheet, `${c1}${r}:${c2}${r}`);
    const s = styleOf(sheet, `${c1}${r}`);
    if (s !== undefined) sheet = useStyle(sheet, `${c1}${r}`, centeredStyle(ctx, s));
  };
  [LEFT, RIGHT].forEach((side, t) => {
    const res = (d.lengthResults || [])[t] || '';
    // ④⑤ not used (their results are "/"): one diagonal line over the whole ④⑤ block, as on the page
    const slash = Array.isArray(res) && res[3] === '/' && res[4] === '/';
    for (let i = 0; i < ROWS; i++) {
      const l = byNo.get(t * ROWS + i + 1);
      const r = FIRST_LEN_ROW + i;
      side.samples.forEach(([c1, c2]) => centerBox(c1, c2, r));
      if (!l) continue;
      set(`${side.pos[0]}${r}`, exactNum(l.position));
      sheet = setSpec(sheet, side, r, l.spec, ctx);
      side.samples.forEach(([c1], k) => set(`${c1}${r}`, exactNum((l.samples || [])[k])));
    }
    // ④⑤ "/": the columns and rows stay as they are; the line is a shape over them (see addMaterialLines)
    // Result row: one result under each sample ① .. ⑤ (records saved before that have one result for the whole table)
    side.samples.forEach(([c1, c2]) => centerBox(c1, c2, RESULT_ROW));
    if (Array.isArray(res)) side.samples.forEach(([c1], k) => set(`${c1}${RESULT_ROW}`, slash && k >= 3 ? '' : res[k] || ''));   // ④⑤ "/": the line crosses the Result row instead of a "/" text
    else set(`${side.samples[0][0]}${RESULT_ROW}`, res);
  });
  // Footer: remarks, total determination, checked by, inspector
  set('A43', d.remarks);
  set('AD43', d.total);
  set('AK43', d.checkedBy);
  set('AQ43', d.inspector);
  return sheet;
}


// A material that is not used ("/"): one straight line shape over its whole text area, bottom-left to top-right.
// Added to the sheet's drawing (anchored to the cells, so it follows the rows when pages are stacked).
function addMaterialLines(drawing, d, itemList = []) {
  const anchors = [];
  Object.entries(MATERIAL).forEach(([k, range], i) => {
    if (String((d.material || {})[k] || '') !== '/') return;
    // A thin black line over the material's Result box too
    drawing = showRedLine(drawing, anchors, k[0].toUpperCase() + k.slice(1) + 'ResultLine', 910 + i, `Not used ${k} result`, MATERIAL_RESULT_BOX[k]);
    // The template (Spec.xlsx) has its own hidden line shape per material ("TerminalLine", ...): it is made visible
    const own = [k[0].toUpperCase() + k.slice(1) + 'Line'];
    if (hasShape(drawing, own)) {
      // ... where the template placed it (the template decides the line's size and position)
      drawing = drawing.replace(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g, a => hasShape(a, own) ? unhide(a) : a);
      return;
    }
    const [, c1, r1, c2, r2] = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    const pt = (c, r) => `<xdr:col>${c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
    anchors.push(`<xdr:twoCellAnchor><xdr:from>${pt(colNum(c1) - 1, +r1 - 1)}</xdr:from><xdr:to>${pt(colNum(c2), +r2)}</xdr:to>`
      + `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${900 + i}" name="Not used ${k}"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>`
      + `<xdr:spPr><a:xfrm flipV="1"><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom>`
      + `<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp><xdr:clientData/></xdr:twoCellAnchor>`);
  });
  // 3) Inspection point not used ("/"): a thin line over its Result box
  itemList.forEach(([, en], i) => {
    if (ITEM_ROWS[i] && (d.items || {})[en] === '/') anchors.push(redLine(930 + i, `Not used item ${i + 1}`, `AT${ITEM_ROWS[i]}:AV${ITEM_ROWS[i] + 1}`));
  });
  // Length Check ④⑤ not used ("/" results): one thin black line over the whole ④⑤ block (no thin diagonal under it)
  [LEFT, RIGHT].forEach((side, t) => {
    const res = (d.lengthResults || [])[t];
    if (!(Array.isArray(res) && res[3] === '/' && res[4] === '/')) return;
    drawing = showRedLine(drawing, anchors, `LengthLine${t + 1}`, 920 + t, `Not used length ${t + 1}`, `${side.samples[3][0]}${FIRST_LEN_ROW}:${side.samples[4][1]}${RESULT_ROW}`);
  });
  return anchors.length ? drawing.replace('</xdr:wsDr>', anchors.join('') + '</xdr:wsDr>') : drawing;
}
// The template carries a hidden red line per place (named like "WireResultLine", "LengthLine1"): it is made visible; a template
// without it gets a new line shape (pushed to anchors)
const THIN_BLACK = '<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>';   // the one line style for "not used" lines
function showRedLine(drawing, anchors, own, id, name, range) {
  if (!hasShape(drawing, [own])) { anchors.push(redLine(id, name, range)); return drawing; }
  // ... stretched over the range, corner to corner
  const [, c1, r1, c2, r2] = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  const pt = (c, r) => `<xdr:col>${c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  const box = `<xdr:from>${pt(colNum(c1) - 1, +r1 - 1)}</xdr:from><xdr:to>${pt(colNum(c2), +r2)}</xdr:to>`;
  return drawing.replace(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g,
    a => hasShape(a, [own]) ? unhide(a).replace(/<a:ln\b[\s\S]*?<\/a:ln>/, THIN_BLACK).replace(/<xdr:from>[\s\S]*?<\/xdr:to>/, box) : a);
}
// A thin black line shape from the bottom-left to the top-right corner of a cell range ("AC9:AE12"), anchored to the cells
function redLine(id, name, range) {
  const [, c1, r1, c2, r2] = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  const pt = (c, r) => `<xdr:col>${c}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>0</xdr:rowOff>`;
  return `<xdr:twoCellAnchor><xdr:from>${pt(colNum(c1) - 1, +r1 - 1)}</xdr:from><xdr:to>${pt(colNum(c2), +r2)}</xdr:to>`
    + `<xdr:cxnSp macro=""><xdr:nvCxnSpPr><xdr:cNvPr id="${id}" name="${name}"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>`
    + `<xdr:spPr><a:xfrm flipV="1"><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom>`
    + `<a:ln w="9525"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></xdr:spPr></xdr:cxnSp><xdr:clientData/></xdr:twoCellAnchor>`;
}

// ---- SPEC: the original "Spec.xlsx", untouched except for the data written into it ----
const unhide = a => a.replace(/(<xdr:cNvPr\b[^>]*?)\s+hidden="1"/, '$1');
// Does this drawing XML (or one shape anchor of it) have a shape with one of these names?
const hasShape = (xml, names) => names.some(name =>
  new RegExp(`<xdr:cNvPr\\b[^>]*\\sname="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i').test(xml));

// Replace one text box's text, one paragraph per line, laid out like the sample text in the template:
// blank (spaces-only) lines at the top are kept as they are, and every line takes the first sample line's
// paragraph and font properties and its leading spaces (the indent).
function fillTextBox(xml, names, text) {
  const anchors = /<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g;
  const tag = name => new RegExp(`<a:${name}\\b[^>]*/>|<a:${name}\\b[^>]*>[\\s\\S]*?</a:${name}>`);
  return xml.replace(anchors, a => {
    if (!hasShape(a, names)) return a;
    if (String(text || '').trim()) a = unhide(a);   // the template keeps its text boxes hidden until they have text
    return a.replace(/(<xdr:txBody>[\s\S]*?<a:lstStyle\/>)([\s\S]*?)(<\/xdr:txBody>)/, (m, head, body, tail) => {
      const paras = body.match(/<a:p>[\s\S]*?<\/a:p>|<a:p\/>/g) || [];
      const textOf = p => [...p.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(t => t[1]).join('');
      let keep = 0;
      while (keep < paras.length - 1 && !textOf(paras[keep]).trim()) keep++;
      const sample = paras[keep] || '';
      const pPr = (sample.match(tag('pPr')) || [''])[0];
      const rPr = (sample.match(tag('rPr')) || [])[0]
        || (sample.match(tag('endParaRPr')) || [''])[0].replace(/endParaRPr/g, 'rPr');
      const indent = (textOf(sample).match(/^ */) || [''])[0];
      const lines = String(text || '').split(/\r?\n/).map(line =>
        line.trim() ? `<a:p>${pPr}<a:r>${rPr}<a:t>${xmlText(indent + line)}</a:t></a:r></a:p>` : `<a:p>${pPr}</a:p>`);
      return head + paras.slice(0, keep).join('') + lines.join('') + tail;
    });
  });
}

function fillSpecSheet(sheet, d, ctx) {
  sheet = setCell(sheet, 'A7', d.customer);
  sheet = setCell(sheet, 'I7', d.partNo);
  const byNo = new Map((d.lengths || []).map(l => [Number(l.no), l]));
  [LEFT, RIGHT].forEach((side, t) => {
    for (let i = 0; i < ROWS; i++) {
      const l = byNo.get(t * ROWS + i + 1);
      if (!l) continue;
      sheet = setCell(sheet, `${side.pos[0]}${FIRST_LEN_ROW + i}`, l.position);
      sheet = setSpec(sheet, side, FIRST_LEN_ROW + i, l.spec, ctx);
    }
  });
  return sheet;
}

// ---- Build a workbook from a template file: one copy of its sheet per page, values written into the XML ----
// fill(sheetXml, page, drawingXml, ctx) -> { sheet, drawing }. Everything else in the template (styles, merges, borders, shapes,
// print setup) is copied as it is. A template file with several sheets keeps only the wanted one.
async function buildSheetWorkbook(tpl, pages, fill) {
  const zip = await JSZip.loadAsync(fs.readFileSync(tpl.file));
  const read = p => zip.file(p).async('string');
  let wb = await read('xl/workbook.xml');
  let wbRels = await read('xl/_rels/workbook.xml.rels');
  let types = await read('[Content_Types].xml');
  const ctx = { styles: await read('xl/styles.xml') };   // cell styles; a fill may add styles (centered text, a diagonal line)
  const relTag = id => wbRels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*/>`))[0];
  const partOf = rel => 'xl/' + rel.match(/Target="([^"]+)"/)[1].replace(/^\/?xl\//, '');
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tags = [...wb.matchAll(/<sheet\b[^>]*\/>/g)].map(m => m[0]);
  const wanted = tpl.sheet ? tags.findIndex(t => t.includes(`name="${tpl.sheet}"`)) : 0;
  if (wanted < 0) throw new Error(`Template has no sheet "${tpl.sheet}"`);

  // Drop the other sheets (their parts, relationships, print areas)
  for (let i = 0; i < tags.length; i++) {
    if (i === wanted) continue;
    const rel = relTag(tags[i].match(/\br:id="([^"]+)"/)[1]);
    const sp = partOf(rel), relsP = sp.replace(/([^/]+)$/, '_rels/$1.rels');
    if (zip.file(relsP)) {
      for (const m of (await read(relsP)).matchAll(/Target="\.\.\/(printerSettings\/[^"]+)"/g)) zip.remove('xl/' + m[1]);
      zip.remove(relsP);
    }
    zip.remove(sp);
    types = types.replace(new RegExp(`<Override PartName="/${escRe(sp)}"[^>]*/>`), '');
    wb = wb.replace(tags[i], '');
    wbRels = wbRels.replace(rel, '');
  }
  wb = wb.replace(/<definedName\b[^>]*localSheetId="(\d+)"[^>]*>[\s\S]*?<\/definedName>/g, (m, id) => +id === wanted ? m.replace(/localSheetId="\d+"/, 'localSheetId="0"') : '')
    .replace(/<definedNames>\s*<\/definedNames>/, '')
    .replace(/(<workbookView\b[^>]*?)\s+(?:activeTab|firstSheet)="\d+"/g, '$1');

  const sheetTag = wb.match(/<sheet\b[^>]*\/>/)[0];
  const sheetPath = partOf(relTag(sheetTag.match(/\br:id="([^"]+)"/)[1]));
  const relsPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels');
  let sheet1 = await read(sheetPath);
  const relsFile = zip.file(relsPath);
  let rels1 = relsFile ? await relsFile.async('string') : '';
  // A template without a drawing (OQC Data) gets an empty one, so shapes (the "not used" lines) can be added
  if (tpl.drawing && !/Target="\.\.\/drawings\//.test(rels1)) {
    // The template's shapes may sit on another sheet of the file (e.g. its "Spec" sheet): that drawing is used for this sheet too
    const donor = zip.file('xl/drawings/drawing1.xml');
    if (!donor) zip.file('xl/drawings/drawing1.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"></xdr:wsDr>');
    rels1 = (rels1 || '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
      .replace('</Relationships>', '<Relationship Id="rIdDrw1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
    zip.file(relsPath, rels1);
    if (!types.includes('/xl/drawings/drawing1.xml')) types = types.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
    const at = sheet1.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>/);
    sheet1 = sheet1.slice(0, at) + '<drawing r:id="rIdDrw1"/>' + sheet1.slice(at);
  }
  const drawingTarget = (rels1.match(/Target="\.\.\/drawings\/([^"]+)"/) || [])[1];
  const drawing1 = drawingTarget ? await read(`xl/drawings/${drawingTarget}`) : '';
  const printerTarget = (rels1.match(/Target="\.\.\/printerSettings\/([^"]+)"/) || [])[1];
  const sheetName = (sheetTag.match(/\bname="([^"]+)"/) || [])[1] || 'Template';
  const printArea = (wb.match(/<definedName name="_xlnm.Print_Area" localSheetId="0">[^!]*!([^<]+)<\/definedName>/) || [])[1];

  pages.forEach((d, i) => {
    const n = i + 1;
    const out = fill(n === 1 ? sheet1 : sheet1.replace(/ tabSelected="1"/, ''), d, drawing1, ctx);
    const sheet = out.sheet, drawing = out.drawing;
    if (n === 1) {
      zip.file(sheetPath, sheet);
      if (drawingTarget) zip.file(`xl/drawings/${drawingTarget}`, drawing);
      return;
    }

    // Further pages: a copy of the template sheet with its own drawing and printer settings
    const pagePath = `xl/worksheets/sheetPage${n}.xml`;
    zip.file(pagePath, sheet);
    let rels = rels1;
    if (drawingTarget) {
      zip.file(`xl/drawings/drawingPage${n}.xml`, drawing);
      rels = rels.replace(`../drawings/${drawingTarget}`, `../drawings/drawingPage${n}.xml`);
      types = types.replace('</Types>', `<Override PartName="/xl/drawings/drawingPage${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    }
    if (printerTarget) {
      zip.file(`xl/printerSettings/printerSettingsPage${n}.bin`, zip.file(`xl/printerSettings/${printerTarget}`).async('nodebuffer'));
      rels = rels.replace(`../printerSettings/${printerTarget}`, `../printerSettings/printerSettingsPage${n}.bin`);
    }
    if (rels) zip.file(`xl/worksheets/_rels/sheetPage${n}.xml.rels`, rels);
    wb = wb.replace('</sheets>', `<sheet name="${xmlText(sheetName)} (${n})" sheetId="${100 + n}" r:id="rIdPage${n}"/></sheets>`);
    if (printArea) {
      wb = wb.replace('</definedNames>',
        `<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xmlText(sheetName)} (${n})'!${printArea}</definedName></definedNames>`);
    }
    wbRels = wbRels.replace('</Relationships>',
      `<Relationship Id="rIdPage${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheetPage${n}.xml"/></Relationships>`);
    types = types.replace('</Types>',
      `<Override PartName="/${pagePath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  });
  zip.file('xl/workbook.xml', wb);
  zip.file('xl/_rels/workbook.xml.rels', wbRels);
  zip.file('[Content_Types].xml', types);
  zip.file('xl/styles.xml', ctx.styles);
  // SPEC column header on three lines: តំលៃ / ប្រវែងកំនត់ / [SPEC]
  if (zip.file('xl/sharedStrings.xml')) zip.file('xl/sharedStrings.xml', (await read('xl/sharedStrings.xml')).replace('<t>តំលៃប្រវែងកំនត់[SPEC]</t>', '<t xml:space="preserve">តំលៃ\nប្រវែងកំនត់\n[SPEC]</t>'));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// SPEC: the material text goes into its text box, or into the box's first cell when the template has no such text box
async function buildSpecWorkbook(pages) {
  const buf = await buildSheetWorkbook(TEMPLATES.spec, pages, (sheet, d, drawing, ctx) => {
    for (const [k, names] of Object.entries(SPEC_TEXTBOX)) {
      const text = (d.material || {})[k] || '';
      if (hasShape(drawing, names)) drawing = fillTextBox(drawing, names, text);
      else sheet = setCell(sheet, MATERIAL[k].split(':')[0], text);
    }
    return { sheet: fillSpecSheet(sheet, d, ctx), drawing };
  });
  return stackPages(buf, pages[0].partNo);
}

// kind: 'oqc' (OQC Data Information) or 'spec' (SPEC page); pages: page objects with named fields
// (as saved by OQC Data Information); itemList: [[Khmer, English], ...] for items 3)-11)
async function buildOqcWorkbook(pages, itemList, kind = 'oqc') {
  if (kind === 'spec') return buildSpecWorkbook(pages);
  // Pages 2, 3, ... (SPEC lines 23-44, 45-66, ...) show "/" for the Wire / Terminal / Housing / Other text and results;
  // on page 1 a material whose result is "/" (not used) shows "/" as its text too
  pages = pages.map((d, i) => {
    const items = { ...(d.items || {}) };
    if (i > 0) Object.keys(MATERIAL).forEach(k => { items[materialKey(k)] = '/'; });
    const material = Object.fromEntries(Object.keys(MATERIAL).map(k =>
      [k, items[materialKey(k)] === '/' ? '/' : (d.material || {})[k] || '']));
    return { ...d, items, material };
  });
  // First Slot (the Part No's SPEC Type) uses the Spec template (form "First Lot"): same layout, but the material text is in text boxes
  if (kind === 'oqc' && pages[0].type === 'First Slot') {
    const buf = await buildSheetWorkbook(TEMPLATES.spec, pages, (sheet, d, drawing, ctx) => {
      for (const [k, names] of Object.entries(SPEC_TEXTBOX)) {
        const m = (d.material || {})[k] || '', text = m === '/' ? '' : m;   // "/" is drawn as a line instead
        if (hasShape(drawing, names)) drawing = fillTextBox(drawing, names, text);
        else sheet = setCell(sheet, MATERIAL[k].split(':')[0], text);
      }
      return { sheet: fillOqcSheet(sheet, d, itemList, ctx, true), drawing: addMaterialLines(drawing, d, itemList) };
    });
    return stackPages(buf, pages[0].partNo);
  }
  const buf = await buildSheetWorkbook(TEMPLATES.oqc, pages, (sheet, d, drawing, ctx) => ({ sheet: fillOqcSheet(sheet, d, itemList, ctx), drawing: addMaterialLines(drawing, d, itemList) }));
  return stackPages(buf, pages[0].partNo);
}

// ---- All pages on one worksheet, like the paper files (e.g. "KM (ADXDN ).xlsx"): page 1 is rows 1-43, page 2 rows 44-86, ...
// Takes a workbook whose sheets are the pages (each filled from the 43-row template, with its own text boxes) and moves
// every page's rows, merges and text boxes onto the first sheet, 43 rows further down per page, with a page break
// after each page and one print area. The sheet is named after the Part No.
const PAGE_ROWS = 43, LAST_COL = 48;   // template print area A1:AV43
const A4 = { w: 595.3, h: 841.9 };     // points

async function stackPages(buf, sheetName) {
  const zip = await JSZip.loadAsync(buf);
  const read = p => zip.file(p).async('string');
  let wb = await read('xl/workbook.xml'), wbRels = await read('xl/_rels/workbook.xml.rels'), types = await read('[Content_Types].xml');
  const relTag = (rels, id) => rels.match(new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*/>`))[0];
  const target = (tag, dir) => path.posix.normalize(dir + '/' + tag.match(/Target="([^"]+)"/)[1]).replace(/^\/?/, '');
  const pages = await Promise.all([...wb.matchAll(/<sheet\b[^>]*\br:id="([^"]+)"[^>]*\/>/g)].map(async m => {
    const rel = relTag(wbRels, m[1]);
    const sheetPath = target(rel, 'xl').replace(/^xl\/xl\//, 'xl/');
    const relsPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels');
    const rels = zip.file(relsPath) ? await read(relsPath) : '';
    const sheet = await read(sheetPath);
    const drawingId = (sheet.match(/<drawing r:id="([^"]+)"/) || [])[1];
    const drawingPath = drawingId ? target(relTag(rels, drawingId), path.posix.dirname(sheetPath)) : '';
    return { tag: m[0], relId: m[1], relTag: rel, sheetPath, relsPath, rels, sheet, drawingPath, drawing: drawingPath ? await read(drawingPath) : '' };
  }));
  const n = pages.length, first = pages[0];

  // Rows, cells and merges of each page, moved down by 43 rows per page (template rows below 43 are left out)
  const rowOf = ref => +ref.match(/\d+/)[0];
  const shift = (ref, by) => ref.replace(/([A-Z]+)(\d+)/g, (m, c, r) => c + (+r + by));
  let rows = '', merges = [], anchors = [];
  pages.forEach((p, i) => {
    const by = i * PAGE_ROWS;
    const data = (p.sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/) || [])[1] || '';
    rows += (data.match(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g) || [])
      .filter(r => +r.match(/<row r="(\d+)"/)[1] <= PAGE_ROWS)
      .map(r => r.replace(/<row r="(\d+)"/, (m, x) => `<row r="${+x + by}"`).replace(/<c r="([A-Z]+\d+)"/g, (m, ref) => `<c r="${shift(ref, by)}"`))
      .join('');
    merges.push(...[...p.sheet.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map(m => m[1])
      .filter(ref => rowOf(ref) <= PAGE_ROWS).map(ref => shift(ref, by)));
    anchors.push(...(p.drawing.match(/<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g) || [])
      .map(a => a.replace(/<xdr:row>(\d+)<\/xdr:row>/g, (m, r) => `<xdr:row>${+r + by}</xdr:row>`)
        .replace(/<a:extLst>(?:(?!<\/a:extLst>)[\s\S])*?a16:creationId[\s\S]*?<\/a:extLst>/g, '')));
  });
  let id = 1;
  anchors = anchors.map(a => a.replace(/(<xdr:cNvPr\b[^>]*\bid=")\d+"/g, (m, head) => `${head}${++id}"`));

  // One print page per 43 rows: no fit-to-page (Excel ignores page breaks with it); one scale that fits a page on A4
  const sheet0 = first.sheet;
  const widths = Array(LAST_COL + 1).fill(+(sheet0.match(/<sheetFormatPr\b[^>]*defaultColWidth="([\d.]+)"/) || [, 9])[1]);
  for (const m of sheet0.matchAll(/<col\b[^>]*\bmin="(\d+)"[^>]*\bmax="(\d+)"[^>]*\bwidth="([\d.]+)"[^>]*\/>/g)) {
    for (let c = +m[1]; c <= Math.min(+m[2], LAST_COL); c++) widths[c] = +m[3];
  }
  const hidden = new Set([...sheet0.matchAll(/<col\b[^>]*\bmin="(\d+)"[^>]*\bmax="(\d+)"[^>]*\bhidden="1"/g)].flatMap(m => Array.from({ length: m[2] - m[1] + 1 }, (_, k) => +m[1] + k)));
  let wPt = 0;
  for (let c = 1; c <= LAST_COL; c++) if (!hidden.has(c)) wPt += Math.trunc((256 * widths[c] + Math.trunc(128 / 7)) / 256 * 7) * 0.75;
  const defH = +(sheet0.match(/<sheetFormatPr\b[^>]*defaultRowHeight="([\d.]+)"/) || [, 15])[1];
  const heights = {};
  for (const m of sheet0.matchAll(/<row r="(\d+)"[^>]*?\bht="([\d.]+)"/g)) heights[m[1]] = +m[2];
  let hPt = 0;
  for (let r = 1; r <= PAGE_ROWS; r++) hPt += heights[r] ?? defH;
  const mg = sheet0.match(/<pageMargins\b[^>]*\/>/);
  const margin = k => +((mg && mg[0].match(new RegExp(`\\b${k}="([\\d.]+)"`))) || [, 0])[1] * 72;
  const tplScale = +(sheet0.match(/<pageSetup\b[^>]*\bscale="(\d+)"/) || [, 100])[1];
  const scale = Math.max(10, Math.min(tplScale, Math.floor(100 * Math.min(
    (A4.w - margin('left') - margin('right')) / wPt, (A4.h - margin('top') - margin('bottom')) / hPt))));

  const last = PAGE_ROWS * n;
  let sheet = sheet0
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${colLetter(LAST_COL)}${last}"/>`)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>|<sheetData\/>/, `<sheetData>${rows}</sheetData>`)
    .replace(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/, `<mergeCells count="${merges.length}">${merges.map(r => `<mergeCell ref="${r}"/>`).join('')}</mergeCells>`)
    .replace(/(<pageSetUpPr\b[^>]*?)\s+fitToPage="(?:1|true)"/, '$1')
    .replace(/<pageSetup\b[^>]*?\/>/, tag => tag.replace(/\s+(?:scale|fitToWidth|fitToHeight|paperSize|orientation)="[^"]*"/g, '')
      .replace('<pageSetup', `<pageSetup paperSize="9" scale="${scale}" orientation="portrait"`))
    .replace(/<rowBreaks\b[\s\S]*?<\/rowBreaks>/, '');
  if (n > 1) {
    const brks = Array.from({ length: n - 1 }, (_, k) => `<brk id="${(k + 1) * PAGE_ROWS}" max="16383" man="1"/>`).join('');
    const at = sheet.search(/<(colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>/);
    sheet = sheet.slice(0, at) + `<rowBreaks count="${n - 1}" manualBreakCount="${n - 1}">${brks}</rowBreaks>` + sheet.slice(at);
  }
  zip.file(first.sheetPath, sheet);
  if (first.drawingPath) {
    zip.file(first.drawingPath, first.drawing.replace(/(<xdr:wsDr\b[^>]*>)[\s\S]*(<\/xdr:wsDr>)/, (m, head, tail) => head + anchors.join('') + tail));
  }

  // Remove the other page sheets, their drawings and printer settings
  for (const p of pages.slice(1)) {
    wb = wb.replace(p.tag, '');
    wbRels = wbRels.replace(p.relTag, '');
    const parts = [p.sheetPath, p.drawingPath, ...[...p.rels.matchAll(/<Relationship\b[^>]*\/>/g)]
      .map(m => target(m[0], path.posix.dirname(p.sheetPath))).filter(x => /printerSettings/.test(x))].filter(Boolean);
    for (const part of parts) {
      if (part !== first.drawingPath) zip.remove(part);
      types = types.replace(new RegExp(`<Override PartName="/${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`), '');
    }
    if (p.rels) zip.remove(p.relsPath);
  }
  // Sheet name (Part No; Excel: max 31 characters, none of []:*?/\), one print area, first tab active
  const name = String(sheetName || '').replace(/[[\]:*?/\\]/g, '-').trim().slice(0, 31) || 'Page';
  wb = wb.replace(first.tag, first.tag.replace(/\bname="[^"]*"/, `name="${xmlText(name)}"`))
    .replace(/<definedName name="_xlnm\.Print_Area"[^>]*>[^<]*<\/definedName>/g, '')
    .replace(/<definedNames>\s*<\/definedNames>|<definedNames\/>/, '')
    .replace(/(<workbookView\b[^>]*?)\s+(?:activeTab|firstSheet)="\d+"/g, '$1');
  const area = `<definedName name="_xlnm.Print_Area" localSheetId="0">'${xmlText(name).replace(/'/g, "''")}'!$A$1:$${colLetter(LAST_COL)}$${last}</definedName>`;
  wb = wb.includes('<definedNames>') ? wb.replace('<definedNames>', '<definedNames>' + area) : wb.replace('</sheets>', `</sheets><definedNames>${area}</definedNames>`);
  zip.file('xl/workbook.xml', wb);
  zip.file('xl/_rels/workbook.xml.rels', wbRels);
  // docProps/app.xml lists the old sheet names; it is optional, so leave it out
  if (zip.file('docProps/app.xml')) {
    zip.remove('docProps/app.xml');
    types = types.replace(/<Override PartName="\/docProps\/app\.xml"[^>]*\/>/, '');
    zip.file('_rels/.rels', (await read('_rels/.rels')).replace(/<Relationship\b[^>]*Target="\/?docProps\/app\.xml"[^>]*\/>/, ''));
  }
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { buildOqcWorkbook };
