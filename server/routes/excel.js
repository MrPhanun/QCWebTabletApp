const { sendJson, readJson } = require('../http');
const { buildOqcWorkbook } = require('../excel-builder');

// Download as an Excel file: POST /api/excel/oqc (OQC Data Information -> "OQC Data.xlsx")
// or /api/excel/spec (SPEC -> "Spec.xlsx"); body { fileName, itemList: [[Khmer, English], ...], pages: [page, ...] }
async function handleOqcExcel(req, res, session, kind) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
  let body;
  try { body = await readJson(req, 2000000); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const itemList = Array.isArray(body.itemList) ? body.itemList.slice(0, 9).map(x => [String(x[0] ?? ''), String(x[1] ?? '')]) : [];
  if (!pages.length || pages.length > 50 || pages.some(p => !p || typeof p !== 'object')) return sendJson(res, 400, { error: 'Invalid request' });
  const name = (String(body.fileName || 'OQC').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'OQC') + '.xlsx';
  try {
    const buf = await buildOqcWorkbook(pages, itemList, kind);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': buf.length,
      'Cache-Control': 'no-store'
    });
    res.end(Buffer.from(buf));
  } catch (err) {
    console.error('Excel export error:', err.message);
    sendJson(res, 500, { error: 'Could not create the Excel file' });
  }
}

module.exports = { handleOqcExcel };
