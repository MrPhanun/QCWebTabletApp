const { sql, getPool } = require('../db');
const { sendJson, readJson } = require('../http');
const { specRange } = require('../spec-range');

// ---- SPEC master (MstSpec + MstSpecLength): per Part No material text and length SPEC rows ----
const SPEC_TEXT = { customer: 100, wire: 1000, terminal: 1000, housing: 1000, other: 1000 };
const SPEC_TYPES = ['Normal', 'First Slot'];
const SPEC_LINES = 200;   // 22 per page (the OQC record's Length Check), up to 10 pages
// Tolerance as stored: a number gets its sign ("5" -> "-5" / "+5"); anything else is kept as typed
const tol = (v, sign) => {
  const x = String(v ?? '').trim();
  return /^[+-]?\d+(\.\d+)?$/.test(x) ? sign + x.replace(/^[+-]/, '') : x;
};

function validateSpec(b) {
  const r = { partNo: String(b.partNo || '').trim(), lengths: [] };
  if (!r.partNo) return { error: 'Part No is required' };
  if (r.partNo.length > 100) return { error: 'Part No must be 100 characters or less' };
  r.type = String(b.type || 'Normal').trim();
  if (!SPEC_TYPES.includes(r.type)) return { error: 'Type must be Normal or First Slot' };
  for (const [k, max] of Object.entries(SPEC_TEXT)) {
    r[k] = String(b[k] ?? '').trim();
    if (r[k].length > max) return { error: `${k} must be ${max} characters or less` };
  }
  for (const l of Array.isArray(b.lengths) ? b.lengths : []) {
    const no = Number(l.no), position = String(l.position ?? '').trim(), spec = String(l.spec ?? '').trim();
    const specMinus = tol(l.specMinus, '-'), specPlus = tol(l.specPlus, '+');
    if (!position && !spec && !specMinus && !specPlus) continue;
    if (!Number.isInteger(no) || no < 1 || no > SPEC_LINES) return { error: `Length № must be 1-${SPEC_LINES}` };
    if (position.length > 100 || spec.length > 100) return { error: `Length № ${no}: Position and SPEC must be 100 characters or less` };
    if (specMinus.length > 20 || specPlus.length > 20) return { error: `Length № ${no}: SPEC - and + must be 20 characters or less` };
    if (r.lengths.some(x => x.no === no)) return { error: `Length № ${no} is given twice` };
    r.lengths.push({ no, position, spec, specMinus, specPlus, range: specRange(spec, specMinus, specPlus) });
  }
  return r;
}

// Insert (id = 0) or update the item and replace its length rows, all in one transaction
async function saveSpec(id, r, userId) {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const head = await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('customer', sql.NVarChar(100), r.customer).input('partNo', sql.NVarChar(100), r.partNo).input('wire', sql.NVarChar(1000), r.wire)
      .input('terminal', sql.NVarChar(1000), r.terminal).input('housing', sql.NVarChar(1000), r.housing)
      .input('other', sql.NVarChar(1000), r.other).input('type', sql.VarChar(20), r.type).input('user', sql.VarChar(80), userId)
      .query(`-- A Part No that already has an OQC record (Search Draft / Save) is no longer First Slot
      IF @type = 'First Slot' AND EXISTS (SELECT 1 FROM OqcRecord WHERE PartNo = @partNo) SET @type = 'Normal';
      IF EXISTS (SELECT 1 FROM MstSpec WITH (UPDLOCK, HOLDLOCK) WHERE PartNo = @partNo AND Wire = @wire AND Terminal = @terminal AND Housing = @housing AND Other = @other AND SysNo <> @id)
          SELECT CAST(1 AS bit) AS dup, 0 AS rc, NULL AS newId
        ELSE IF @id = 0 BEGIN
          INSERT INTO MstSpec (Customer, PartNo, [Type], Wire, Terminal, Housing, Other, RegBy, UpdateBy)
            VALUES (@customer, @partNo, @type, @wire, @terminal, @housing, @other, @user, @user);
          SELECT CAST(0 AS bit) AS dup, @@ROWCOUNT AS rc, CAST(SCOPE_IDENTITY() AS int) AS newId
        END ELSE BEGIN
          UPDATE MstSpec SET Customer=@customer, PartNo=@partNo, [Type]=@type, Wire=@wire, Terminal=@terminal, Housing=@housing, Other=@other,
            UpdateBy=@user, UpdateDate=GETDATE() WHERE SysNo=@id;
          SELECT CAST(0 AS bit) AS dup, @@ROWCOUNT AS rc, @id AS newId
        END`);
    const out = head.recordset[0];
    if (out.dup || !out.rc) { await tx.rollback(); return out; }
    await new sql.Request(tx).input('id', sql.Int, out.newId).query('DELETE FROM MstSpecLength WHERE SpecNo = @id');
    for (const l of r.lengths) {
      await new sql.Request(tx).input('id', sql.Int, out.newId).input('no', sql.TinyInt, l.no)
        .input('position', sql.NVarChar(100), l.position).input('spec', sql.NVarChar(100), l.spec)
        .input('minus', sql.NVarChar(20), l.specMinus).input('plus', sql.NVarChar(20), l.specPlus).input('range', sql.NVarChar(30), l.range)
        .query(`INSERT INTO MstSpecLength (SpecNo, [LineNo], Position, Spec, SpecMinus, SpecPlus, [Range])
                VALUES (@id, @no, @position, @spec, @minus, @plus, @range)`);
    }
    await tx.commit();
    return out;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

async function handleSpec(req, res, session, id) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  try {
    const pool = await getPool();
    if (!id && req.method === 'GET') {
      const heads = await pool.request().query(
        `SELECT SysNo AS id, Customer AS customer, PartNo AS partNo, [Type] AS type, Wire AS wire, Terminal AS terminal, Housing AS housing, Other AS other,
                UpdateBy AS updateBy, UpdateDate AS updateDate
         FROM MstSpec ORDER BY PartNo`);
      const lines = await pool.request().query(
        `SELECT SpecNo AS specNo, [LineNo] AS no, Position AS position, Spec AS spec, SpecMinus AS specMinus, SpecPlus AS specPlus,
                [Range] AS range FROM MstSpecLength ORDER BY SpecNo, [LineNo]`);
      const byId = new Map(heads.recordset.map(h => [h.id, { ...h, lengths: [] }]));
      for (const l of lines.recordset) byId.get(l.specNo)?.lengths.push({ no: l.no, position: l.position, spec: l.spec, specMinus: l.specMinus, specPlus: l.specPlus, range: l.range });
      return sendJson(res, 200, [...byId.values()]);
    }
    if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
      let body;
      try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
      const r = validateSpec(body);
      if (r.error) return sendJson(res, 400, r);
      const out = await saveSpec(id || 0, r, session.id);
      if (out.dup) return sendJson(res, 409, { error: `Part No ${r.partNo} already has a SPEC with the same Wire, Terminal, Housing and Other` });
      if (!out.rc) return sendJson(res, 404, { error: 'This item no longer exists' });
      return sendJson(res, id ? 200 : 201, { id: out.newId });
    }
    if (req.method === 'DELETE' && id) {
      const { rowsAffected } = await pool.request().input('id', sql.Int, id).query('DELETE FROM MstSpec WHERE SysNo = @id');
      return rowsAffected[0] ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'This item no longer exists' });
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('SPEC error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

module.exports = { handleSpec };
