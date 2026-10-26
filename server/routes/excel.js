const { sendJson, readJson } = require('../http');
const { buildOqcWorkbook } = require('../excel-builder');
const fs = require('fs');
const { printXlsx } = require('../print-xlsx');
const { config } = require('../config');
const path = require('path');
const { sql, getPool } = require('../db');
const { recordFile, saveRecordFile } = require('../record-files');

// Printer the PDF button sends to (override with "pdfPrinter" in config/<env>.json)
const PDF_PRINTER = config.pdfPrinter || 'Microsoft Print to PDF';
// File name: OQC_<dd-mm-yyyy>.pdf (today)
const pdfBase = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `OQC_${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`; };

// Read and check the request shared by the Excel and PDF downloads: { fileName, itemList, pages } (null = already answered)
async function readExportRequest(req, res, session, ext) {
  if (!session) { sendJson(res, 401, { error: 'Not logged in' }); return null; }
  if (req.method !== 'POST') { sendJson(res, 405, { error: 'Method not allowed' }); return null; }
  let body;
  try { body = await readJson(req, 2000000); } catch { sendJson(res, 400, { error: 'Invalid request' }); return null; }
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const itemList = Array.isArray(body.itemList) ? body.itemList.slice(0, 9).map(x => [String(x[0] ?? ''), String(x[1] ?? '')]) : [];
  if (!pages.length || pages.length > 50 || pages.some(p => !p || typeof p !== 'object')) { sendJson(res, 400, { error: 'Invalid request' }); return null; }
  const name = (String(body.fileName || 'OQC').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'OQC') + ext;
  return { pages, itemList, name };
}

function sendFile(res, buf, name, type) {
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Content-Length': buf.length,
    'Cache-Control': 'no-store'
  });
  res.end(Buffer.from(buf));
}

// Download as an Excel file: POST /api/excel/oqc (OQC Data Information -> "OQC Data.xlsx")
// or /api/excel/spec (SPEC -> "Spec.xlsx"); body { fileName, itemList: [[Khmer, English], ...], pages: [page, ...] }
async function handleOqcExcel(req, res, session, kind) {
  const r = await readExportRequest(req, res, session, '.xlsx');
  if (!r) return;
  try {
    sendFile(res, await buildOqcWorkbook(r.pages, r.itemList, kind), r.name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } catch (err) {
    console.error('Excel export error:', err.message);
    sendJson(res, 500, { error: 'Could not create the Excel file' });
  }
}

// PDF: POST /api/pdf/oqc, same body as the Excel download. The filled "OQC Data.xlsx" is made, printed to the
// "Microsoft Print to PDF" printer of the PC the server runs on (into a temporary folder), and the PDF is sent back to the browser.
async function handleOqcPdf(req, res, session) {
  const r = await readExportRequest(req, res, session, '.pdf');
  if (!r) return;
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'qc-pdf-'));
  try {
    const saved = await printXlsx(await buildOqcWorkbook(r.pages, r.itemList, 'oqc'), PDF_PRINTER, dir, pdfBase());
    sendFile(res, fs.readFileSync(saved), r.name, 'application/pdf');
  } catch (err) {
    console.error('PDF print error:', err.message);
    sendJson(res, 500, { error: `Could not print to ${PDF_PRINTER} — ${err.message}` });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// Download of a saved record: POST /api/oqc/records/:id/excel and /pdf, body { itemList }.
// Printed (the file was made before and the record has not changed since): the stored file is sent again.
// Draft: the file is made from the saved record, stored on the server, and the record becomes Printed for that file.
async function handleRecordExport(req, res, session, id, kind) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req, 200000); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
  const itemList = Array.isArray(body.itemList) ? body.itemList.slice(0, 9).map(x => [String(x[0] ?? ''), String(x[1] ?? '')]) : [];
  const isPdf = kind === 'pdf', ext = isPdf ? '.pdf' : '.xlsx', flag = isPdf ? 'PdfPrinted' : 'ExcelPrinted', stamp = isPdf ? 'PdfDate' : 'ExcelDate';
  try {
    const pool = await getPool();
    const rec = (await pool.request().input('id', sql.Int, id).query(
      `SELECT LotNo, BoxNo, Data, UpdateDate, ${flag} AS printed FROM OqcRecord WHERE SysNo = @id`)).recordset[0];
    if (!rec) return sendJson(res, 404, { error: 'This record no longer exists' });
    const name = `OQC_${rec.LotNo}${rec.BoxNo ? '_' + rec.BoxNo : ''}`.replace(/[^\w.-]+/g, '_').slice(0, 80) + ext;
    const type = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const file = recordFile(id, ext);
    // A stored file made before the templates or the builder last changed is made again, so template changes show up
    const stale = f => { try { return fs.statSync(file).mtimeMs < fs.statSync(f).mtimeMs; } catch { return false; } };
    const outdated = [path.join(__dirname, '..', 'excel-builder.js'), ...fs.readdirSync(path.join(__dirname, '..', '..', 'templates')).map(n => path.join(__dirname, '..', '..', 'templates', n))].some(stale);
    if (rec.printed && fs.existsSync(file) && !outdated) return sendFile(res, fs.readFileSync(file), name, type);

    const pages = JSON.parse(rec.Data);
    let buf;
    if (isPdf) {
      const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'qc-pdf-'));
      try { buf = fs.readFileSync(await printXlsx(await buildOqcWorkbook(pages, itemList, 'oqc'), PDF_PRINTER, dir, pdfBase())); }
      finally { fs.rmSync(dir, { recursive: true, force: true }); }
    } else buf = await buildOqcWorkbook(pages, itemList, 'oqc');
    saveRecordFile(id, ext, buf);
    // Printed only if the record is still the one the file was made from; a save in the meantime keeps it Draft
    const { rowsAffected } = await pool.request().input('id', sql.Int, id).input('upd', sql.DateTime, rec.UpdateDate).query(
      `UPDATE OqcRecord SET ${flag} = 1, ${stamp} = GETDATE() WHERE SysNo = @id AND UpdateDate = @upd`);
    if (!rowsAffected[0]) fs.rmSync(file, { force: true });
    sendFile(res, buf, name, type);
  } catch (err) {
    console.error('Record export error:', err.message);
    sendJson(res, 500, { error: isPdf ? `Could not print to ${PDF_PRINTER} — ${err.message}` : 'Could not create the Excel file' });
  }
}

module.exports = { handleOqcExcel, handleOqcPdf, handleRecordExport };
