const { sendJson, readJson } = require('../http');
const { buildOqcWorkbook } = require('../excel-builder');
const fs = require('fs');
const { printXlsx } = require('../print-xlsx');
const { config } = require('../config');
const path = require('path');

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

module.exports = { handleOqcExcel, handleOqcPdf };
