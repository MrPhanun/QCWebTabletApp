const { sql, getPool, MAX_INT } = require('../db');
const { sendJson, readJson } = require('../http');
const { removeRecordFiles } = require('../record-files');

// ---- Saved OQC records (OqcRecord): one per label (LotNo + BoxNo), all pages in Data as JSON ----
const REC_COLS = `SysNo AS id, LotNo AS lot, BoxNo AS box, ItemCode AS itemCode, PartNo AS partNo, [Type] AS type, Customer AS customer,
  CONVERT(varchar(10), CheckDate, 23) AS checkDate, CONVERT(varchar(10), ShipmentDate, 23) AS shipDate, Qty AS qty, ExcelPrinted AS excelPrinted, PdfPrinted AS pdfPrinted, Probability AS probability, Total AS total,
  Inspector AS inspector, CheckedBy AS checkedBy, PageCount AS pageCount, Complete AS complete,
  RegBy AS regBy, RegDate AS regDate, UpdateBy AS updateBy, UpdateDate AS updateDate`;

function validateRecord(b) {
  const str = (v, max, name) => {
    const x = String(v ?? '').trim();
    if (x.length > max) throw new Error(`${name} must be ${max} characters or less`);
    return x;
  };
  try {
    const r = {
      lot: str(b.lot, 50, 'Lot №'), box: str(b.box, 20, 'Box'), itemCode: str(b.itemCode, 50, 'Item Code'),
      partNo: str(b.partNo, 100, 'Part №'), customer: str(b.customer, 200, 'Customer'),
      probability: str(b.probability, 10, 'Probability'), total: str(b.total, 2, 'Total'),
      inspector: str(b.inspector, 80, 'Inspector'), checkedBy: str(b.checkedBy, 80, 'Checked by'),
      complete: !!b.complete
    };
    if (!r.lot) return { error: 'Lot № is required to save — scan the label or type the Lot №' };
    if (!['', 'OK', 'NG'].includes(r.total)) return { error: 'Total must be OK or NG' };
    r.checkDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.checkDate || '')) ? b.checkDate : null;
    // Shipment Date is a condition for saving
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.shipDate || '')) || isNaN(Date.parse(b.shipDate))) return { error: 'Pick the Shipment Date to save' };
    r.shipDate = b.shipDate;
    const qty = Number(b.qty);
    r.type = String(b.type || 'Normal').trim();
    if (!['Normal', 'First Slot', 'Sample'].includes(r.type)) return { error: 'Type must be Normal, First Slot or Sample' };
    r.qty = String(b.qty ?? '').trim() !== '' && Number.isInteger(qty) && qty >= 0 && qty <= MAX_INT ? qty : null;
    if (!Array.isArray(b.pages) || !b.pages.length || b.pages.length > 50) return { error: 'A record needs 1 to 50 pages' };
    r.data = JSON.stringify(b.pages);
    if (r.data.length > 1000000) return { error: 'This record is too large to save' };
    r.pageCount = b.pages.length;
    return r;
  } catch (e) { return { error: e.message }; }
}

// Insert (id = 0) or update; one record per Lot + Box, checked inside the transaction
async function saveRecord(id, r, userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id).input('lot', sql.VarChar(50), r.lot).input('box', sql.VarChar(20), r.box)
    .input('itemCode', sql.VarChar(50), r.itemCode).input('partNo', sql.NVarChar(100), r.partNo)
    .input('customer', sql.NVarChar(200), r.customer).input('checkDate', sql.Date, r.checkDate).input('shipDate', sql.Date, r.shipDate)
    .input('qty', sql.Int, r.qty).input('type', sql.VarChar(20), r.type).input('probability', sql.VarChar(10), r.probability).input('total', sql.VarChar(2), r.total)
    .input('inspector', sql.NVarChar(80), r.inspector).input('checkedBy', sql.NVarChar(80), r.checkedBy)
    .input('pageCount', sql.TinyInt, r.pageCount).input('complete', sql.Bit, r.complete)
    .input('data', sql.NVarChar(sql.MAX), r.data).input('user', sql.VarChar(80), userId)
    .query(`SET XACT_ABORT ON;
      DECLARE @dup int = NULL, @rc int = 0, @newId int = NULL, @reset bit = 0;
      BEGIN TRAN;
      SELECT TOP 1 @dup = SysNo FROM OqcRecord WITH (UPDLOCK, HOLDLOCK) WHERE LotNo = @lot AND BoxNo = @box AND SysNo <> @id;
      IF @dup IS NULL
      BEGIN
        IF @id = 0
        BEGIN
          INSERT INTO OqcRecord (LotNo, BoxNo, ItemCode, PartNo, [Type], Customer, CheckDate, ShipmentDate, Qty, Probability, Total, Inspector, CheckedBy,
                                 PageCount, Complete, Data, RegBy, UpdateBy)
          VALUES (@lot, @box, @itemCode, @partNo, @type, @customer, @checkDate, @shipDate, @qty, @probability, @total, @inspector, @checkedBy,
                  @pageCount, @complete, @data, @user, @user);
          SET @rc = @@ROWCOUNT; SET @newId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
          -- Anything changed (Data holds every page): the stored Excel / PDF are out of date, back to Draft
          IF NOT EXISTS (SELECT 1 FROM OqcRecord WHERE SysNo = @id AND LotNo = @lot AND BoxNo = @box AND PartNo = @partNo
              AND ISNULL(ShipmentDate, '1900-01-01') = @shipDate AND ISNULL(Qty, -1) = ISNULL(@qty, -1)
              AND Complete = @complete AND Data = @data COLLATE Latin1_General_BIN2)
            SET @reset = 1;
          UPDATE OqcRecord SET LotNo=@lot, BoxNo=@box, ItemCode=@itemCode, PartNo=@partNo, [Type]=@type, Customer=@customer, CheckDate=@checkDate, ShipmentDate=@shipDate,
            Qty=@qty,
            ExcelPrinted = CASE WHEN @reset = 1 THEN 0 ELSE ExcelPrinted END, PdfPrinted = CASE WHEN @reset = 1 THEN 0 ELSE PdfPrinted END, Probability=@probability, Total=@total, Inspector=@inspector, CheckedBy=@checkedBy, PageCount=@pageCount,
            Complete=@complete, Data=@data, UpdateBy=@user, UpdateDate=GETDATE()
          WHERE SysNo = @id;
          SET @rc = @@ROWCOUNT; SET @newId = @id;
        END
        -- Once a record (draft or saved) exists for the Part No, its SPEC is no longer a First Slot
        IF @rc > 0 AND @partNo <> ''
          UPDATE MstSpec SET [Type] = 'Normal' WHERE PartNo = @partNo AND [Type] = 'First Slot';
      END
      COMMIT;
      SELECT @dup AS dup, @rc AS rc, @newId AS newId, @reset AS reset;`);
  return result.recordset[0];
}

// GET  /api/oqc/records?q=text&from=YYYY-MM-DD&to=YYYY-MM-DD   search (newest first, max 200); from / to = Shipment Date range
// GET  /api/oqc/records?lot=..&box=.. the record of one label (for scan)
// GET  /api/oqc/records/:id           one record with its pages
// POST /api/oqc/records, PUT /api/oqc/records/:id   save (QC department only)
// DELETE /api/oqc/records/:id         delete (permission daily.delete)
async function handleOqcRecords(req, res, session, id) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  try {
    const pool = await getPool();
    if (req.method === 'GET' && id) {
      const { recordset } = await pool.request().input('id', sql.Int, id).query(`SELECT ${REC_COLS}, Data AS data FROM OqcRecord WHERE SysNo = @id`);
      if (!recordset[0]) return sendJson(res, 404, { error: 'This record no longer exists' });
      const rec = recordset[0];
      rec.pages = JSON.parse(rec.data);
      delete rec.data;
      return sendJson(res, 200, rec);
    }
    if (req.method === 'GET') {
      const q = new URL(req.url, 'http://x').searchParams;
      if (q.has('customers')) {   // every Customer on the saved records, for the Customer search list
        const { recordset } = await pool.request().query("SELECT DISTINCT Customer AS customer FROM OqcRecord WHERE Customer <> '' ORDER BY Customer");
        return sendJson(res, 200, recordset.map(x => x.customer));
      }
      if (q.has('lot')) {
        const { recordset } = await pool.request().input('lot', sql.VarChar(50), String(q.get('lot')).trim().slice(0, 50))
          .input('box', sql.VarChar(20), String(q.get('box') || '').trim().slice(0, 20))
          .query(`SELECT ${REC_COLS} FROM OqcRecord WHERE LotNo = @lot AND BoxNo = @box`);
        return sendJson(res, 200, recordset);
      }
      const text = String(q.get('q') || '').trim().slice(0, 100);
      const like = '%' + text.replace(/[\\%_[]/g, c => '\\' + c) + '%';
      const type = ['Normal', 'First Slot', 'Sample'].includes(q.get('type')) ? q.get('type') : '';
      const customer = String(q.get('customer') || '').trim().slice(0, 200);
      const day = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(Date.parse(v)) ? v : null;
      const { recordset } = await pool.request().input('text', sql.NVarChar(100), text).input('like', sql.NVarChar(210), like)
        .input('type', sql.VarChar(20), type).input('customer', sql.NVarChar(200), customer).input('from', sql.Date, day(q.get('from'))).input('to', sql.Date, day(q.get('to')))
        .query(`SELECT TOP 200 ${REC_COLS} FROM OqcRecord
          WHERE (@text = '' OR LotNo LIKE @like ESCAPE '\\' OR BoxNo LIKE @like ESCAPE '\\' OR ItemCode LIKE @like ESCAPE '\\'
             OR PartNo LIKE @like ESCAPE '\\' OR Customer LIKE @like ESCAPE '\\' OR Inspector LIKE @like ESCAPE '\\')
            AND (@type = '' OR [Type] = @type) AND (@customer = '' OR Customer = @customer)
            AND (@from IS NULL OR ShipmentDate >= @from) AND (@to IS NULL OR ShipmentDate <= @to)
          ORDER BY ShipmentDate DESC, UpdateDate DESC`);
      return sendJson(res, 200, recordset);
    }
    if (req.method === 'DELETE' && id) {
      const { rowsAffected } = await pool.request().input('id', sql.Int, id).query('DELETE FROM OqcRecord WHERE SysNo = @id');
      if (!rowsAffected[0]) return sendJson(res, 404, { error: 'This record no longer exists' });
      removeRecordFiles(id);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
      let body;
      try { body = await readJson(req, 2000000); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
      const r = validateRecord(body);
      if (r.error) return sendJson(res, 400, r);
      const out = await saveRecord(id || 0, r, session.id);
      if (out.dup != null) return sendJson(res, 409, { error: `Lot ${r.lot}${r.box ? `, Box ${r.box}` : ''} is already saved`, existingId: out.dup });
      if (!out.rc) return sendJson(res, 404, { error: 'This record no longer exists' });
      if (out.reset) removeRecordFiles(out.newId);
      return sendJson(res, id ? 200 : 201, { id: out.newId });
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('OQC record error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

// Part No typed on the OQC record -> Customer, material text and length rows from the SPEC master (MstSpec)
// GET /api/oqc/spec?partNo=FM4-H915-000
async function handleOqcSpec(req, res, session) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  const partNo = String(new URL(req.url, 'http://x').searchParams.get('partNo') || '').trim();
  if (!partNo || partNo.length > 100) return sendJson(res, 400, { error: 'Give a Part No' });
  try {
    const pool = await getPool();
    // The label's Part No (e.g. FM4-H915-000) matches the SPEC of that Part No and its numbered versions (FM4-H915-000(001), (002), ...)
    const like = partNo.replace(/[\\%_[]/g, c => '\\' + c) + '(%';
    const found = (await pool.request().input('part', sql.NVarChar(100), partNo).input('like', sql.NVarChar(210), like).query(
      `SELECT SysNo AS id, Customer AS customer, PartNo AS partNo, [Type] AS type, Wire AS wire, Terminal AS terminal, Housing AS housing, Other AS other
       FROM MstSpec WHERE PartNo = @part OR PartNo LIKE @like ESCAPE '\\' ORDER BY PartNo`)).recordset;
    // More than one SPEC: the user chooses which one this item needs
    if (found.length > 1) return sendJson(res, 200, { choices: found.map(x => ({ partNo: x.partNo, customer: x.customer, type: x.type })) });
    const spec = found[0];
    if (!spec) return sendJson(res, 404, { error: `No SPEC for Part No ${partNo} — add it in Master Data › SPEC` });
    // Length Check rows of the SPEC: № on the record = LineNo
    const { recordset: lines } = await pool.request().input('id', sql.Int, spec.id).query(
      `SELECT [LineNo] AS line, Position AS position, Spec AS spec, SpecMinus AS specMinus, SpecPlus AS specPlus, [Range] AS range
       FROM MstSpecLength WHERE SpecNo = @id AND LTRIM(RTRIM(ISNULL(Position, ''))) <> '' ORDER BY [LineNo]`);
    delete spec.id;
    sendJson(res, 200, { ...spec, lengths: lines });
  } catch (err) {
    console.error('OQC SPEC error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

// Scanned label -> its receive transaction in Marunix (linked server 192.168.1.21): Lot No, Part No (item name), Qty, Box
// GET /api/oqc/label?lot=23-0902722&item=8047&box=001   (barcode "23-0902722/8047/8/001"; box "001" is BoxNO "1")
async function handleOqcLabel(req, res, session) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  const q = new URL(req.url, 'http://x').searchParams;
  const lot = String(q.get('lot') || '').trim(), item = String(q.get('item') || '').trim(), box = String(q.get('box') || '').trim();
  if (!lot || !item || !box || lot.length > 50 || item.length > 50 || box.length > 20) return sendJson(res, 400, { error: 'Invalid request' });
  const boxNum = /^\d+$/.test(box) ? String(Number(box)) : box;
  try {
    const pool = await getPool();
    const { recordset } = await pool.request()
      .input('lot', sql.VarChar(50), lot).input('item', sql.VarChar(50), item)
      .input('box', sql.VarChar(20), box).input('boxNum', sql.VarChar(20), boxNum)
      .query(`SELECT TOP 1 tbt.LotNo AS lot, tbm.ItemName AS partNo, tbt.ReceiveQty AS qty, tbt.BoxNO AS box
        FROM [192.168.1.21].[Marunix].[dbo].[prgalltransaction] tbt
        LEFT JOIN [192.168.1.21].[Marunix].[dbo].[mstitem] tbm ON tbt.ItemCode = tbm.ItemCode
        WHERE tbt.GRICode = '30' AND tbt.TypeCode = 1 AND tbt.LotNo = @lot AND tbt.ItemCode = @item
          AND tbt.BoxNO IN (@box, @boxNum)`);
    if (!recordset[0]) return sendJson(res, 404, { error: `Label ${lot}, Item Code ${item}, Box ${box} is not in Marunix` });
    const r = recordset[0];
    sendJson(res, 200, { lot: String(r.lot || '').trim(), partNo: String(r.partNo || '').trim(), qty: r.qty, box: String(r.box || '').trim() });
  } catch (err) {
    console.error('OQC label error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

module.exports = { handleOqcRecords, handleOqcSpec, handleOqcLabel };
