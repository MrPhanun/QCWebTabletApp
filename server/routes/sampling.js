const { sql, getPool, MAX_INT } = require('../db');
const { sendJson, readJson } = require('../http');

// ---- Sampling plan master (MstSamplingPlan) ----
const LEVELS = ['Normal', 'Hard'];
const isPosInt = v => Number.isInteger(v) && v >= 1 && v <= MAX_INT;

function validateSampling(b) {
  const r = { level: b.level, from: Number(b.qtyFrom), to: Number(b.qtyTo), sample: Number(b.sampleQty) };
  if (!LEVELS.includes(r.level)) return { error: 'Level must be Normal or Hard' };
  if (!isPosInt(r.from) || !isPosInt(r.to)) return { error: 'Shipment Qty From and To must be whole numbers of 1 or more' };
  if (r.to < r.from) return { error: 'Shipment Qty "To" must be greater than or equal to "From"' };
  if (!isPosInt(r.sample)) return { error: 'Inspection All Qty must be a whole number of 1 or more' };
  return r;
}

// Insert (id = 0) or update one row, refusing a range that overlaps another range of the same level.
// The overlap check and the write run in one transaction with range locks, so two users can't race.
async function saveSampling(id, r, userId) {
  const pool = await getPool();
  const write = id
    ? `UPDATE MstSamplingPlan SET [Level]=@level, QtyFrom=@from, QtyTo=@to, SampleQty=@sample, UpdateBy=@user, UpdateDate=GETDATE() WHERE SysNo=@id;
       SET @rc = @@ROWCOUNT; SET @newId = @id;`
    : `INSERT INTO MstSamplingPlan ([Level], QtyFrom, QtyTo, SampleQty, RegBy, UpdateBy) VALUES (@level, @from, @to, @sample, @user, @user);
       SET @rc = @@ROWCOUNT; SET @newId = SCOPE_IDENTITY();`;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('level', sql.VarChar(10), r.level)
    .input('from', sql.Int, r.from)
    .input('to', sql.Int, r.to)
    .input('sample', sql.Int, r.sample)
    .input('user', sql.VarChar(80), userId)
    .query(`SET XACT_ABORT ON;
      DECLARE @cf int, @ct int, @rc int = 0, @newId int = NULL;
      BEGIN TRAN;
      SELECT TOP 1 @cf = QtyFrom, @ct = QtyTo FROM MstSamplingPlan WITH (UPDLOCK, HOLDLOCK)
        WHERE [Level] = @level AND QtyFrom <= @to AND QtyTo >= @from AND SysNo <> @id;
      IF @cf IS NULL BEGIN ${write} END
      COMMIT;
      SELECT @cf AS cf, @ct AS ct, @rc AS rc, @newId AS newId;`);
  return result.recordset[0];
}

async function handleSampling(req, res, session, id) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  try {
    const pool = await getPool();
    if (!id && req.method === 'GET') {
      const { recordset } = await pool.request().query(
        `SELECT SysNo AS id, [Level] AS level, QtyFrom AS qtyFrom, QtyTo AS qtyTo, SampleQty AS sampleQty,
                RegBy AS regBy, RegDate AS regDate, UpdateBy AS updateBy, UpdateDate AS updateDate
         FROM MstSamplingPlan ORDER BY [Level], QtyFrom`);
      return sendJson(res, 200, recordset);
    }
    if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
      let body;
      try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
      const r = validateSampling(body);
      if (r.error) return sendJson(res, 400, r);
      const out = await saveSampling(id || 0, r, session.id);
      if (out.cf != null) return sendJson(res, 409, { error: `Overlaps the existing ${r.level} range ${out.cf}-${out.ct}` });
      if (!out.rc) return sendJson(res, 404, { error: 'This range no longer exists' });
      return sendJson(res, id ? 200 : 201, { id: out.newId });
    }
    if (req.method === 'DELETE' && id) {
      const { rowsAffected } = await pool.request().input('id', sql.Int, id).query('DELETE FROM MstSamplingPlan WHERE SysNo = @id');
      return rowsAffected[0] ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'This range no longer exists' });
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('Sampling plan error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

// Which sample Qty applies to a shipment? GET /api/sampling/lookup?level=Hard&qty=120
async function handleSamplingLookup(req, res, session) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  const q = new URL(req.url, 'http://x').searchParams;
  const level = q.get('level'), qty = Number(q.get('qty'));
  if (!LEVELS.includes(level) || !isPosInt(qty)) return sendJson(res, 400, { error: 'Give level (Normal or Hard) and qty (whole number)' });
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().input('level', sql.VarChar(10), level).input('qty', sql.Int, qty).query(
      `SELECT TOP 1 QtyFrom AS qtyFrom, QtyTo AS qtyTo, SampleQty AS sampleQty FROM MstSamplingPlan
       WHERE [Level] = @level AND @qty BETWEEN QtyFrom AND QtyTo`);
    recordset[0] ? sendJson(res, 200, { level, qty, ...recordset[0] }) : sendJson(res, 404, { error: `No ${level} range covers ${qty}` });
  } catch (err) {
    console.error('Sampling lookup error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

module.exports = { handleSampling, handleSamplingLookup };
