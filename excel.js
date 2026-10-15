// Fill an OQC Inspection record template with one or more pages and return the .xlsx bytes.
// Each page becomes its own worksheet ("Page 1", "Page 2", ...). Values are written into the template's own cells,
// keeping its fonts, sizes, borders and layout, so the file looks like the template.
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

// OQC Data Information uses its own template (footer has Total Determination); the SPEC page uses the print template
const TEMPLATES = {
  oqc: path.join(__dirname, 'OQC Data.xlsx'),
  spec: path.join(__dirname, 'Spec.xlsx')
};
const REQUIRED_SAMPLES = 3;   // same rule as the page: ①②③ required, ④⑤ optional
const ROWS = 11;              // length rows per table (№ 1-11 left, 12-22 right)

// Length columns in the template: [№, Position, SPEC, sample ①..⑤] as [first, last] column letters
const LEFT = { pos: ['C', 'G'], spec: ['H', 'J'], samples: [['K', 'L'], ['M', 'O'], ['P', 'R'], ['S', 'U'], ['V', 'X']], result: ['K', 'X'] };
const RIGHT = { pos: ['AA', 'AE'], spec: ['AF', 'AH'], samples: [['AI', 'AJ'], ['AK', 'AM'], ['AN', 'AP'], ['AQ', 'AS'], ['AT', 'AV']], result: ['AI', 'AV'] };
const FIRST_LEN_ROW = 30, RESULT_ROW = 41;
const ITEM_ROWS = [9, 11, 13, 15, 17, 19, 21, 23, 25];   // items 3) .. 11), two rows each
const MATERIAL = { wire: 'C12:AE14', terminal: 'C16:AE18', housing: 'C20:AE23', other: 'C25:AE26' };
// SPEC and OQC templates: the material text goes into the text box with one of these shape names (any letter case).
// A box missing from the template falls back to the first cell of its MATERIAL range.
const SPEC_TEXTBOX = { wire: ['Wire', 'TextBox 11'], terminal: ['Terminal', 'TextBox 14'], housing: ['Housing', 'TextBox 12'], other: ['Other', 'TextBox 13'] };

const colNum = c => c.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colLetter = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };

// Same SPEC formats as the page: "100±2", "100+2/-1", "98-102", "1~3mm"
function parseSpec(s) {
  const N = '(-?\\d+(?:\\.\\d+)?)';
  const t = String(s || '').replace(/\s*mm\s*$/i, '');
  let m;
  if ((m = t.match(new RegExp(`^\\s*${N}\\s*±\\s*${N}\\s*$`)))) return [+m[1] - +m[2], +m[1] + +m[2]];
  if ((m = t.match(new RegExp(`^\\s*${N}\\s*\\+\\s*${N}\\s*/?\\s*-\\s*${N}\\s*$`)))) return [+m[1] - +m[3], +m[1] + +m[2]];
  if ((m = t.match(new RegExp(`^\\s*${N}\\s*[-~–]\\s*${N}\\s*$`)))) return [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])];
  return null;
}
const isNg = (value, spec) => {
  const range = parseSpec(spec);
  if (!range || String(value).trim() === '') return false;
  const n = Number(value);
  return !Number.isFinite(n) || n < range[0] - 1e-9 || n > range[1] + 1e-9;
};

// Merge a range, first undoing any template merge that overlaps it
function merge(ws, range) {
  const [a, b] = range.split(':');
  const [, c1, r1] = a.match(/^([A-Z]+)(\d+)$/), [, c2, r2] = b.match(/^([A-Z]+)(\d+)$/);
  for (let r = +r1; r <= +r2; r++) for (let c = colNum(c1); c <= colNum(c2); c++) ws.unMergeCells(`${colLetter(c)}${r}`);
  ws.mergeCells(range);
}

// exceljs shares one style object between template cells that look alike; give a cell its own copy before changing it
function ownStyle(cell) {
  cell.style = JSON.parse(JSON.stringify(cell.style || {}));
  return cell;
}

// Write a value and keep the template cell's own font, size and borders. Only what is needed to place the value
// is added: alignment inside a merged box, wrap for long text, shrink-to-fit for long names, red for NG.
function put(ws, addr, value, { align, valign, wrap, shrink, color } = {}) {
  const cell = ownStyle(ws.getCell(addr));
  cell.value = value === undefined || value === null ? '' : value;
  if (color) cell.font = { ...cell.font, color: { argb: color } };
  if (align || valign || wrap || shrink) {
    cell.alignment = { ...cell.alignment, ...(align ? { horizontal: align } : {}), ...(valign ? { vertical: valign } : {}),
      ...(wrap ? { wrapText: true } : {}), ...(shrink ? { shrinkToFit: true, wrapText: false } : {}) };
  }
}
const asNum = v => (v !== '' && v != null && Number.isFinite(Number(v)) ? Number(v) : v);
const RED = 'FFDC2626';

function fillPage(ws, d, itemList, kind, boxes = new Set()) {
  // Check date: beside the CHECK DATE label, in the label's font
  merge(ws, 'AT3:AV3');
  put(ws, 'AT3', d.checkDate || '', { align: 'center', valign: 'middle' });
  ws.getCell('AT3').font = { ...ws.getCell('AO3').font };

  // Info row (template fonts: Cambria for Customer / Part №, Times New Roman for the rest)
  // Customer box is sized for a short code (e.g. CPT): longer names wrap, in a smaller size only when needed
  const cust = String(d.customer || '');
  put(ws, 'A7', cust, { wrap: true });
  if (cust.length > 14) ws.getCell('A7').font = { ...ws.getCell('A7').font, size: cust.length > 34 ? 8 : cust.length > 24 ? 9 : 10 };
  put(ws, 'I7', d.partNo, { shrink: true });
  put(ws, 'U7', d.lot, { shrink: true });
  put(ws, 'AB7', asNum(d.qty), { shrink: true });
  put(ws, 'AI7', asNum(d.spot), { shrink: true });
  put(ws, 'AP7', d.probability, { shrink: true });
  put(ws, 'S9', d.partNo, { shrink: true });

  // 1) Material check: result + text under Wire / Terminal / Housing / Other
  const items = d.items || {};
  put(ws, 'AC9', items['Material check'] || '', { color: items['Material check'] === 'NG' ? RED : undefined });
  for (const [k, range] of Object.entries(MATERIAL)) {
    if (boxes.has(k)) continue;   // goes into the template's text box instead (addTextBoxes)
    merge(ws, range);
    put(ws, range.split(':')[0], (d.material || {})[k] || '', { align: 'left', valign: 'top', wrap: true });
  }

  // Items 3) .. 11): the labels follow the current form (text only, template fonts kept); results in AT:AV
  itemList.forEach(([km, en], i) => {
    const r = ITEM_ROWS[i];
    if (!r) return;
    const [, no, kmText] = String(km).match(/^(\d+\))\s*(.*)$/) || [null, '', km];
    ws.getCell(`AF${r}`).value = no;
    ws.getCell(`AG${r}`).value = kmText;
    merge(ws, `AG${r + 1}:AS${r + 1}`);
    put(ws, `AG${r + 1}`, `[${en}]`, { shrink: true });   // long names (e.g. RoHS) fit the box like the template's row 24
    merge(ws, `AT${r}:AV${r + 1}`);
    put(ws, `AT${r}`, items[en] || '', { align: 'center', valign: 'middle', color: items[en] === 'NG' ? RED : undefined });
  });

  // 2) Length check
  const byNo = new Map((d.lengths || []).map(l => [Number(l.no), l]));
  [LEFT, RIGHT].forEach((side, t) => {
    const lines = [];
    for (let i = 0; i < ROWS; i++) lines.push(byNo.get(t * ROWS + i + 1) || { position: '', spec: '', samples: [] });
    // One diagonal line over ④⑤ when every row with a SPEC has ①②③ within SPEC and nobody used ④⑤ (same rule as the page)
    const used = lines.filter(l => String(l.spec || '').trim());
    const extra = lines.some(l => (l.samples || []).slice(REQUIRED_SAMPLES).some(v => String(v || '').trim()));
    const slash = used.length > 0 && !extra && used.every(l =>
      [0, 1, 2].every(k => String((l.samples || [])[k] || '').trim() && !isNg(l.samples[k], l.spec)));

    lines.forEach((l, i) => {
      const r = FIRST_LEN_ROW + i;
      put(ws, `${side.pos[0]}${r}`, l.position || '');
      put(ws, `${side.spec[0]}${r}`, l.spec || '');
      side.samples.forEach(([c1, c2], k) => {
        if (slash && k >= REQUIRED_SAMPLES) return;
        merge(ws, `${c1}${r}:${c2}${r}`);
        const v = (l.samples || [])[k] || '';
        put(ws, `${c1}${r}`, asNum(v), { align: 'center', color: isNg(v, l.spec) ? RED : undefined });
      });
    });
    if (slash) {
      const [c1] = side.samples[REQUIRED_SAMPLES], [, c2] = side.samples[4];
      merge(ws, `${c1}${FIRST_LEN_ROW}:${c2}${FIRST_LEN_ROW + ROWS - 1}`);
      const thin = { style: 'thin', color: { argb: 'FF000000' } };
      ownStyle(ws.getCell(`${c1}${FIRST_LEN_ROW}`)).border = { top: thin, left: thin, bottom: thin, right: thin,
        diagonal: { up: true, down: false, style: 'thin', color: { argb: 'FF000000' } } };
    }
    const res = (d.lengthResults || [])[t] || '';
    merge(ws, `${side.result[0]}${RESULT_ROW}:${side.result[1]}${RESULT_ROW}`);
    put(ws, `${side.result[0]}${RESULT_ROW}`, res, { align: 'center', color: res === 'NG' ? RED : undefined });
  });

  // Footer: remarks, total determination (OQC template only), checked by, inspector
  merge(ws, 'A43:AC43');
  put(ws, 'A43', d.remarks || '', { align: 'left', wrap: true });
  if (kind === 'oqc') put(ws, 'AD43', d.total || '', { color: d.total === 'NG' ? RED : undefined });
  put(ws, 'AK43', d.checkedBy || '', { shrink: true });
  put(ws, 'AQ43', d.inspector || '', { shrink: true });
}

// Copy the template's sheet inside the .xlsx package so every page is an exact copy of it (styles, merges, print setup)
async function templateWithPages(file, count) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  if (count > 1) {
    const sheet = (await zip.file('xl/worksheets/sheet1.xml').async('string')).replace(/ tabSelected="1"/, '');
    const relsFile = zip.file('xl/worksheets/_rels/sheet1.xml.rels');
    const rels = relsFile ? await relsFile.async('string') : null;
    let wb = await zip.file('xl/workbook.xml').async('string');
    let wbRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
    let types = await zip.file('[Content_Types].xml').async('string');
    for (let i = 2; i <= count; i++) {
      zip.file(`xl/worksheets/sheet${i}.xml`, sheet);
      if (rels) zip.file(`xl/worksheets/_rels/sheet${i}.xml.rels`, rels);
      wb = wb.replace('</sheets>', `<sheet name="Page ${i}" sheetId="${100 + i}" r:id="rIdPage${i}"/></sheets>`);
      wbRels = wbRels.replace('</Relationships>',
        `<Relationship Id="rIdPage${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/></Relationships>`);
      types = types.replace('</Types>',
        `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    }
    zip.file('xl/workbook.xml', wb);
    zip.file('xl/_rels/workbook.xml.rels', wbRels);
    zip.file('[Content_Types].xml', types);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

// kind: 'oqc' (OQC Data Information) or 'spec' (SPEC page); pages: page objects with named fields
// (as saved by OQC Data Information); itemList: [[Khmer, English], ...] for items 3)-11)
async function buildOqcWorkbook(pages, itemList, kind = 'oqc') {
  if (kind === 'spec') return buildSpecWorkbook(pages);
  const tpl = await JSZip.loadAsync(fs.readFileSync(TEMPLATES.oqc));
  const drawingFile = tpl.file('xl/drawings/drawing1.xml');
  const drawing = drawingFile ? await drawingFile.async('string') : '';
  const boxes = new Set(Object.keys(SPEC_TEXTBOX).filter(k => hasShape(drawing, SPEC_TEXTBOX[k])));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await templateWithPages(TEMPLATES.oqc, pages.length));
  wb.worksheets.forEach((ws, i) => {
    ws.name = `Page ${i + 1}`;
    fillPage(ws, pages[i], itemList, kind, boxes);
    ws.pageSetup.printArea = 'A1:AV43';
    // Always one A4 page per sheet (the OQC template's fixed 83% scale is too wide for A4)
    Object.assign(ws.pageSetup, { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, scale: 100 });
  });
  const buf = await wb.xlsx.writeBuffer();
  return drawing ? addTextBoxes(buf, drawing, pages) : buf;
}

// exceljs drops shapes it can't read, so give every sheet its own copy of the template's drawing
// (text boxes and other shapes), with the Wire / Terminal / Housing / Other text boxes filled
async function addTextBoxes(buf, drawing, pages) {
  const zip = await JSZip.loadAsync(buf);
  const wb = await zip.file('xl/workbook.xml').async('string');
  const wbRels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  let types = await zip.file('[Content_Types].xml').async('string');
  const sheetIds = [...wb.matchAll(/<sheet\b[^>]*\br:id="([^"]+)"/g)].map(m => m[1]);
  for (let i = 0; i < sheetIds.length; i++) {
    const rel = wbRels.match(new RegExp(`<Relationship\\b[^>]*Id="${sheetIds[i]}"[^>]*>`))[0];
    const sheetPath = 'xl/' + rel.match(/Target="([^"]+)"/)[1].replace(/^\/?xl\//, '');
    const relsPath = sheetPath.replace(/([^/]+)$/, '_rels/$1.rels');

    let xml = drawing;
    for (const [k, names] of Object.entries(SPEC_TEXTBOX)) {
      if (hasShape(xml, names)) xml = fillTextBox(xml, names, (pages[i].material || {})[k] || '');
    }
    zip.file(`xl/drawings/drawing${i + 1}.xml`, xml);
    types = types.replace('</Types>',
      `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);

    const relsFile = zip.file(relsPath);
    const drawingRel = `<Relationship Id="rIdTextBoxes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${i + 1}.xml"/>`;
    zip.file(relsPath, relsFile
      ? (await relsFile.async('string')).replace('</Relationships>', drawingRel + '</Relationships>')
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRel}</Relationships>`);

    // <drawing> goes before these elements (schema order), else just before </worksheet>
    let sheet = await zip.file(sheetPath).async('string');
    if (!/<worksheet\b[^>]*xmlns:r=/.test(sheet)) {
      sheet = sheet.replace(/<worksheet\b/, '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
    }
    const at = sheet.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b|<\/worksheet>/);
    zip.file(sheetPath, sheet.slice(0, at) + '<drawing r:id="rIdTextBoxes"/>' + sheet.slice(at));
  }
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---- SPEC: the original "Spec.xlsx", untouched except for the data written into it ----
// Values go straight into the template's own (empty, styled) cells and text boxes in the package XML, so
// fonts, merges, print setup, shapes and everything else stay exactly as in the template.
const xmlText = s => String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Put text into an existing cell, keeping its style (s=) and dropping any old value
function setCell(sheet, ref, text) {
  if (text === undefined || text === null || String(text) === '') return sheet;
  const re = new RegExp(`<c r="${ref}"((?:\\s+[\\w:]+="[^"]*")*)\\s*(?:/>|>[\\s\\S]*?</c>)`);
  const m = sheet.match(re);
  if (!m) throw new Error(`SPEC template has no cell ${ref}`);
  const attrs = m[1].replace(/\s+t="[^"]*"/, '');
  return sheet.replace(re, `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${xmlText(text)}</t></is></c>`);
}

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

function fillSpecSheet(sheet, d) {
  sheet = setCell(sheet, 'A7', d.customer);
  sheet = setCell(sheet, 'I7', d.partNo);
  sheet = setCell(sheet, 'S9', d.partNo);
  const byNo = new Map((d.lengths || []).map(l => [Number(l.no), l]));
  [LEFT, RIGHT].forEach((side, t) => {
    for (let i = 0; i < ROWS; i++) {
      const l = byNo.get(t * ROWS + i + 1);
      if (!l) continue;
      sheet = setCell(sheet, `${side.pos[0]}${FIRST_LEN_ROW + i}`, l.position);
      sheet = setCell(sheet, `${side.spec[0]}${FIRST_LEN_ROW + i}`, l.spec);
    }
  });
  return sheet;
}

async function buildSpecWorkbook(pages) {
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATES.spec));
  const read = p => zip.file(p).async('string');
  const sheet1 = await read('xl/worksheets/sheet1.xml');
  const relsFile = zip.file('xl/worksheets/_rels/sheet1.xml.rels');
  const rels1 = relsFile ? await relsFile.async('string') : '';
  const drawingTarget = (rels1.match(/Target="\.\.\/drawings\/([^"]+)"/) || [])[1];
  const drawing1 = drawingTarget ? await read(`xl/drawings/${drawingTarget}`) : '';
  const printerTarget = (rels1.match(/Target="\.\.\/printerSettings\/([^"]+)"/) || [])[1];
  let wb = await read('xl/workbook.xml');
  let wbRels = await read('xl/_rels/workbook.xml.rels');
  let types = await read('[Content_Types].xml');
  const sheetName = (wb.match(/<sheet\b[^>]*name="([^"]+)"/) || [])[1] || 'Template';
  const printArea = (wb.match(/<definedName name="_xlnm.Print_Area" localSheetId="0">[^!]*!([^<]+)<\/definedName>/) || [])[1];

  pages.forEach((d, i) => {
    const n = i + 1;
    // Material text: in its text box, or in the box's cells when the template has no such text box
    let drawing = drawing1;
    let sheet = n === 1 ? sheet1 : sheet1.replace(/ tabSelected="1"/, '');
    for (const [k, names] of Object.entries(SPEC_TEXTBOX)) {
      const text = (d.material || {})[k] || '';
      if (hasShape(drawing, names)) drawing = fillTextBox(drawing, names, text);
      else sheet = setCell(sheet, MATERIAL[k].split(':')[0], text);
    }
    sheet = fillSpecSheet(sheet, d);
    if (n === 1) {
      zip.file('xl/worksheets/sheet1.xml', sheet);
      if (drawingTarget) zip.file(`xl/drawings/${drawingTarget}`, drawing);
      return;
    }

    // Further pages: a copy of the template sheet with its own drawing and printer settings
    const sheetPath = `xl/worksheets/sheetPage${n}.xml`;
    zip.file(sheetPath, sheet);
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
      `<Override PartName="/${sheetPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  });
  zip.file('xl/workbook.xml', wb);
  zip.file('xl/_rels/workbook.xml.rels', wbRels);
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { buildOqcWorkbook };
