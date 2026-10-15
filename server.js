const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
const { buildOqcWorkbook } = require('./excel');

// Pick environment: --env=development|production, else NODE_ENV, else development
const arg = process.argv.find(a => a.startsWith('--env='));
const envName = (arg && arg.split('=')[1]) || process.env.NODE_ENV || 'development';
const configFile = path.join(__dirname, 'config', `${envName}.json`);
if (!fs.existsSync(configFile)) {
  console.error(`Unknown environment "${envName}". Use development or production.`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// Secrets live in .env.<env> (gitignored). Real environment variables take precedence.
const envFile = path.join(__dirname, `.env.${envName}`);
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
}
config.database.password = process.env.DB_PASSWORD;
const PORT = process.env.PORT || config.port;

// SQL Server connection pool (connects lazily, reconnects after a failure)
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    const { server, database, user, password } = config.database;
    poolPromise = new sql.ConnectionPool({
      server, database, user, password,
      options: { encrypt: false, trustServerCertificate: true }
    }).connect().catch(err => { poolPromise = null; throw err; });
  }
  return poolPromise;
}

// In-memory sessions: token -> { id, username, role, expires }
const SESSION_HOURS = 8;
const sessions = new Map();
function getSession(req) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);
  const s = m && sessions.get(m[1]);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(m[1]); return null; }
  return { token: m[1], ...s };
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function readJson(req, maxChars = 20000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > maxChars) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// Only QC department users may change QC master data
const isQC = dept => String(dept || '').trim().toUpperCase() === 'QC';

// ---- Roles & Permissions (MstPermission): per user, which pages they can see and which buttons they can use ----
const PERMS = [
  'sampling.view', 'sampling.add', 'sampling.edit', 'sampling.delete',
  'spec.view', 'spec.add', 'spec.edit', 'spec.delete', 'spec.excel',
  'daily.view', 'daily.add', 'daily.edit', 'daily.excel',
  'users.view', 'users.add', 'users.edit', 'users.delete',
  'roles.view', 'roles.edit'
];
// Rules for users who were never customised: everyone views and downloads Excel, QC department adds / edits / deletes,
// Admin role manages users and permissions (same as before permissions existed)
function defaultPerms(role, dept) {
  const p = ['sampling.view', 'spec.view', 'spec.excel', 'daily.view', 'daily.excel'];
  if (isQC(dept)) p.push('sampling.add', 'sampling.edit', 'sampling.delete', 'spec.add', 'spec.edit', 'spec.delete', 'daily.add', 'daily.edit');
  if (role === 'Admin') p.push('users.view', 'users.add', 'users.edit', 'users.delete', 'roles.view', 'roles.edit');
  return p;
}
// Effective permissions of a signed-in user (read on every request, so changes apply without logging in again)
async function getPerms(session) {
  const { recordset } = await (await getPool()).request().input('id', sql.VarChar(10), session.id)
    .query('SELECT PermKey FROM MstPermission WHERE UserID = @id');
  const keys = recordset.map(r => r.PermKey);
  return keys.includes('_custom') ? keys.filter(k => PERMS.includes(k)) : defaultPerms(session.role, session.dept);
}
// Which permission an API call needs (any one of a list is enough)
function permFor(urlPath, method) {
  const by = map => map[method] || null;
  if (urlPath === '/api/sampling/lookup') return ['daily.view', 'sampling.view'];
  if (/^\/api\/sampling(\/\d+)?$/.test(urlPath)) return by({ GET: 'sampling.view', POST: 'sampling.add', PUT: 'sampling.edit', DELETE: 'sampling.delete' });
  if (urlPath === '/api/spec/lookup') return ['spec.add', 'spec.edit'];
  if (/^\/api\/spec(\/\d+)?$/.test(urlPath)) return by({ GET: 'spec.view', POST: 'spec.add', PUT: 'spec.edit', DELETE: 'spec.delete' });
  if (/^\/api\/oqc\/records(\/\d+)?$/.test(urlPath)) return by({ GET: 'daily.view', POST: 'daily.add', PUT: 'daily.edit' });
  if (urlPath === '/api/oqc/label' || urlPath === '/api/user/name') return 'daily.view';
  if (urlPath === '/api/excel/oqc') return 'daily.excel';
  if (urlPath === '/api/excel/spec') return 'spec.excel';
  if (/^\/api\/users(\/[^/]+)?$/.test(urlPath)) return by({ GET: 'users.view', POST: 'users.add', PUT: 'users.edit', DELETE: 'users.delete' });
  if (urlPath === '/api/permissions') return by({ GET: 'roles.view', PUT: 'roles.edit' });
  return null;
}

// GET /api/permissions: every user with their permissions; PUT: save { users: [{ id, perms: [...] | null }] } (null = back to default)
// Every user with their effective permissions
async function loadUserPerms(pool) {
  const users = (await pool.request().query('SELECT ID AS id, Username AS username, UserRole AS role, Dept AS dept FROM tbUser ORDER BY ID')).recordset;
  const rows = (await pool.request().query('SELECT UserID, PermKey FROM MstPermission')).recordset;
  return users.map(u => {
    const keys = rows.filter(r => r.UserID.trim() === String(u.id).trim()).map(r => r.PermKey);
    const custom = keys.includes('_custom');
    return { ...u, dept: (u.dept || '').trim(), custom, perms: custom ? keys.filter(k => PERMS.includes(k)) : defaultPerms(u.role, u.dept) };
  });
}

async function handlePermissions(req, res, session) {
  try {
    const pool = await getPool();
    const loadAll = () => loadUserPerms(pool);
    if (req.method === 'GET') return sendJson(res, 200, { perms: PERMS, users: await loadAll() });
    if (req.method !== 'PUT') return sendJson(res, 405, { error: 'Method not allowed' });

    let body;
    try { body = await readJson(req, 200000); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
    const changes = Array.isArray(body.users) ? body.users : [];
    if (!changes.length || changes.length > 500) return sendJson(res, 400, { error: 'Invalid request' });
    const all = await loadAll();
    const byId = new Map(all.map(u => [String(u.id).trim(), u]));
    for (const c of changes) {
      const u = byId.get(String(c.id || '').trim());
      if (!u) return sendJson(res, 400, { error: `No user with ID ${c.id}` });
      if (c.perms !== null && (!Array.isArray(c.perms) || c.perms.some(k => !PERMS.includes(k)))) return sendJson(res, 400, { error: 'Invalid request' });
      u.next = c.perms === null ? defaultPerms(u.role, u.dept) : [...new Set(c.perms)];
      u.reset = c.perms === null;
    }
    // Nobody locks themselves out, and someone can always manage permissions
    const me = byId.get(String(session.id).trim());
    if (me && me.next && !(me.next.includes('roles.view') && me.next.includes('roles.edit'))) {
      return sendJson(res, 400, { error: 'You cannot remove your own Roles & Permissions access' });
    }
    if (!all.some(u => (u.next || u.perms).includes('roles.edit'))) {
      return sendJson(res, 400, { error: 'At least one user must keep Roles & Permissions access' });
    }
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const u of all.filter(x => x.next)) {
        await new sql.Request(tx).input('id', sql.VarChar(10), u.id).query('DELETE FROM MstPermission WHERE UserID = @id');
        if (u.reset) continue;
        for (const k of ['_custom', ...u.next]) {
          await new sql.Request(tx).input('id', sql.VarChar(10), u.id).input('k', sql.VarChar(50), k).input('by', sql.VarChar(80), session.id)
            .query('INSERT INTO MstPermission (UserID, PermKey, UpdateBy) VALUES (@id, @k, @by)');
        }
      }
      await tx.commit();
    } catch (err) { await tx.rollback().catch(() => {}); throw err; }
    sendJson(res, 200, { perms: PERMS, users: await loadAll() });
  } catch (err) {
    console.error('Permissions error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function handleLogin(req, res) {
  let body;
  try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
  const login = String(body.id || '').trim();
  const password = String(body.password || '');
  if (!login || !password) return sendJson(res, 400, { error: 'Please enter ID and password' });
  // tbUser.ID is varchar(10); a longer ID can't exist (and SQL Server would reject it)
  if (login.length > 10) return sendJson(res, 401, { error: 'Incorrect ID or password' });

  try {
    const pool = await getPool();
    // Users sign in with their ID only
    const result = await pool.request()
      .input('login', sql.VarChar(10), login)
      .query('SELECT TOP 1 ID, Username, UserRole, Dept, Password FROM tbUser WHERE ID = @login');
    const user = result.recordset[0];
    // tbUser stores plain-text passwords; compare in JS so the match is case-sensitive
    if (!user || !safeEqual(user.Password, password)) {
      return sendJson(res, 401, { error: 'Incorrect ID or password' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.ID, username: user.Username, role: user.UserRole, dept: (user.Dept || '').trim(), expires: Date.now() + SESSION_HOURS * 3600e3 });
    sendJson(res, 200, { id: user.ID, username: user.Username, role: user.UserRole, dept: (user.Dept || '').trim(), canEditQC: isQC(user.Dept) }, {
      'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    sendJson(res, 500, { error: 'Cannot connect to the database' });
  }
}

// ---- Sampling plan master (MstSamplingPlan) ----
const LEVELS = ['Normal', 'Hard'];
const MAX_INT = 2147483647;
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

// ---- Saved OQC records (OqcRecord): one per label (LotNo + BoxNo), all pages in Data as JSON ----
const REC_COLS = `SysNo AS id, LotNo AS lot, BoxNo AS box, ItemCode AS itemCode, PartNo AS partNo, Customer AS customer,
  CONVERT(varchar(10), CheckDate, 23) AS checkDate, Qty AS qty, Probability AS probability, Total AS total,
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
    const qty = Number(b.qty);
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
    .input('customer', sql.NVarChar(200), r.customer).input('checkDate', sql.Date, r.checkDate)
    .input('qty', sql.Int, r.qty).input('probability', sql.VarChar(10), r.probability).input('total', sql.VarChar(2), r.total)
    .input('inspector', sql.NVarChar(80), r.inspector).input('checkedBy', sql.NVarChar(80), r.checkedBy)
    .input('pageCount', sql.TinyInt, r.pageCount).input('complete', sql.Bit, r.complete)
    .input('data', sql.NVarChar(sql.MAX), r.data).input('user', sql.VarChar(80), userId)
    .query(`SET XACT_ABORT ON;
      DECLARE @dup int = NULL, @rc int = 0, @newId int = NULL;
      BEGIN TRAN;
      SELECT TOP 1 @dup = SysNo FROM OqcRecord WITH (UPDLOCK, HOLDLOCK) WHERE LotNo = @lot AND BoxNo = @box AND SysNo <> @id;
      IF @dup IS NULL
      BEGIN
        IF @id = 0
        BEGIN
          INSERT INTO OqcRecord (LotNo, BoxNo, ItemCode, PartNo, Customer, CheckDate, Qty, Probability, Total, Inspector, CheckedBy,
                                 PageCount, Complete, Data, RegBy, UpdateBy)
          VALUES (@lot, @box, @itemCode, @partNo, @customer, @checkDate, @qty, @probability, @total, @inspector, @checkedBy,
                  @pageCount, @complete, @data, @user, @user);
          SET @rc = @@ROWCOUNT; SET @newId = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
          UPDATE OqcRecord SET LotNo=@lot, BoxNo=@box, ItemCode=@itemCode, PartNo=@partNo, Customer=@customer, CheckDate=@checkDate,
            Qty=@qty, Probability=@probability, Total=@total, Inspector=@inspector, CheckedBy=@checkedBy, PageCount=@pageCount,
            Complete=@complete, Data=@data, UpdateBy=@user, UpdateDate=GETDATE()
          WHERE SysNo = @id;
          SET @rc = @@ROWCOUNT; SET @newId = @id;
        END
      END
      COMMIT;
      SELECT @dup AS dup, @rc AS rc, @newId AS newId;`);
  return result.recordset[0];
}

// GET  /api/oqc/records?q=text        search (newest first, max 200)
// GET  /api/oqc/records?lot=..&box=.. the record of one label (for scan)
// GET  /api/oqc/records/:id           one record with its pages
// POST /api/oqc/records, PUT /api/oqc/records/:id   save (QC department only)
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
      if (q.has('lot')) {
        const { recordset } = await pool.request().input('lot', sql.VarChar(50), String(q.get('lot')).trim().slice(0, 50))
          .input('box', sql.VarChar(20), String(q.get('box') || '').trim().slice(0, 20))
          .query(`SELECT ${REC_COLS} FROM OqcRecord WHERE LotNo = @lot AND BoxNo = @box`);
        return sendJson(res, 200, recordset);
      }
      const text = String(q.get('q') || '').trim().slice(0, 100);
      const like = '%' + text.replace(/[\\%_[]/g, c => '\\' + c) + '%';
      const { recordset } = await pool.request().input('text', sql.NVarChar(100), text).input('like', sql.NVarChar(210), like)
        .query(`SELECT TOP 200 ${REC_COLS} FROM OqcRecord
          WHERE @text = '' OR LotNo LIKE @like ESCAPE '\\' OR BoxNo LIKE @like ESCAPE '\\' OR ItemCode LIKE @like ESCAPE '\\'
             OR PartNo LIKE @like ESCAPE '\\' OR Customer LIKE @like ESCAPE '\\' OR Inspector LIKE @like ESCAPE '\\'
          ORDER BY UpdateDate DESC`);
      return sendJson(res, 200, recordset);
    }
    if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
      let body;
      try { body = await readJson(req, 2000000); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
      const r = validateRecord(body);
      if (r.error) return sendJson(res, 400, r);
      const out = await saveRecord(id || 0, r, session.id);
      if (out.dup != null) return sendJson(res, 409, { error: `Lot ${r.lot}${r.box ? `, Box ${r.box}` : ''} is already saved`, existingId: out.dup });
      if (!out.rc) return sendJson(res, 404, { error: 'This record no longer exists' });
      return sendJson(res, id ? 200 : 201, { id: out.newId });
    }
    sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('OQC record error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

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

// User Management (tbUser). The Password column is never sent.
//   GET    /api/users       everyone
//   POST   /api/users       add    { id, username, role, dept, password }
//   PUT    /api/users/:id   edit   { username, role, dept, password }  (blank password = keep the current one)
//   DELETE /api/users/:id   delete (also removes their MstPermission rows)
// tbUser is shared with other applications, so passwords stay plain text like the existing rows.
const USER_ROLES = ['Admin', 'User'];
function validateUser(b, isNew) {
  const s = v => String(v ?? '').trim();
  const u = { id: s(b.id), username: s(b.username), role: s(b.role), dept: s(b.dept), password: String(b.password ?? '') };
  if (isNew) {
    if (!u.id) return { error: 'ID is required' };
    if (!/^[A-Za-z0-9._-]{1,10}$/.test(u.id)) return { error: 'ID must be 1 to 10 letters, digits, dot, dash or underscore' };
  }
  if (!u.username) return { error: 'Username is required' };
  if (u.username.length > 80) return { error: 'Username must be 80 characters or less' };
  if (!USER_ROLES.includes(u.role)) return { error: 'Role must be Admin or User' };
  if (u.dept.length > 50) return { error: 'Department must be 50 characters or less' };
  if (isNew && !u.password) return { error: 'Password is required' };
  if (u.password.length > 100) return { error: 'Password must be 100 characters or less' };
  return { user: u };
}
const userList = pool => pool.request().query(
  `SELECT ID AS id, Username AS username, UserRole AS role, Dept AS dept,
          RegBy AS regBy, RegDate AS regDate, UpdateBy AS updateBy, UpdateDate AS updateDate
   FROM tbUser ORDER BY ID`).then(r => r.recordset);

async function handleUsers(req, res, session, rawId) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  let id = '';
  try { id = decodeURIComponent(rawId).trim(); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) return sendJson(res, 405, { error: 'Method not allowed' });
  // GET / POST work on the list, PUT / DELETE on one user
  if (['PUT', 'DELETE'].includes(req.method) !== Boolean(id)) return sendJson(res, 404, { error: 'Not found' });
  try {
    const pool = await getPool();
    if (req.method === 'GET') return sendJson(res, 200, await userList(pool));

    const all = await loadUserPerms(pool);
    const me = String(session.id).trim();
    const target = id && all.find(u => String(u.id).trim().toLowerCase() === id.toLowerCase());
    if (id && !target) return sendJson(res, 404, { error: 'This user no longer exists' });
    // Someone must always be able to manage permissions (the same rule as Roles & Permissions)
    const keepsRoles = next => all.some(u => (next(u) || u.perms).includes('roles.edit'));

    if (req.method === 'DELETE') {
      if (String(target.id).trim() === me) return sendJson(res, 400, { error: 'You cannot delete your own user' });
      if (!keepsRoles(u => u === target ? [] : null)) return sendJson(res, 400, { error: 'At least one user must keep Roles & Permissions access' });
      const tx = new sql.Transaction(pool);
      await tx.begin();
      try {
        await new sql.Request(tx).input('id', sql.VarChar(10), target.id).query('DELETE FROM MstPermission WHERE UserID = @id');
        await new sql.Request(tx).input('id', sql.VarChar(10), target.id).query('DELETE FROM tbUser WHERE ID = @id');
        await tx.commit();
      } catch (err) { await tx.rollback().catch(() => {}); throw err; }
      // Their open sessions end now
      for (const [token, s] of sessions) if (String(s.id).trim() === String(target.id).trim()) sessions.delete(token);
      return sendJson(res, 200, await userList(pool));
    }

    let body;
    try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
    const v = validateUser(body, req.method === 'POST');
    if (v.error) return sendJson(res, 400, { error: v.error });
    const u = v.user;
    const by = String(session.username || session.id).slice(0, 80);

    if (req.method === 'POST') {
      if (all.some(x => String(x.id).trim().toLowerCase() === u.id.toLowerCase())) return sendJson(res, 400, { error: `ID ${u.id} already exists` });
      await pool.request()
        .input('id', sql.VarChar(10), u.id).input('username', sql.VarChar(80), u.username).input('role', sql.VarChar(50), u.role)
        .input('password', sql.VarChar(100), u.password).input('dept', sql.VarChar(50), u.dept || null).input('by', sql.VarChar(80), by)
        .query(`INSERT INTO tbUser (ID, Username, UserRole, Password, Dept, RegBy, RegDate, UpdateBy, UpdateDate)
                VALUES (@id, @username, @role, @password, @dept, @by, GETDATE(), @by, GETDATE())`);
      return sendJson(res, 201, await userList(pool));
    }

    // PUT: a role / department change also changes the default permissions of a user who was never customised
    const nextPerms = x => x === target && !x.custom ? defaultPerms(u.role, u.dept) : null;
    if (String(target.id).trim() === me && !(nextPerms(target) || target.perms).includes('roles.edit')) {
      return sendJson(res, 400, { error: 'You cannot remove your own Roles & Permissions access' });
    }
    if (!keepsRoles(nextPerms)) return sendJson(res, 400, { error: 'At least one user must keep Roles & Permissions access' });
    await pool.request()
      .input('id', sql.VarChar(10), target.id).input('username', sql.VarChar(80), u.username).input('role', sql.VarChar(50), u.role)
      .input('password', sql.VarChar(100), u.password).input('dept', sql.VarChar(50), u.dept || null).input('by', sql.VarChar(80), by)
      .query(`UPDATE tbUser SET Username = @username, UserRole = @role, Dept = @dept,
                Password = CASE WHEN @password = '' THEN Password ELSE @password END, UpdateBy = @by, UpdateDate = GETDATE()
              WHERE ID = @id`);
    // Open sessions of this user pick up the new name / role / department straight away
    for (const s of sessions.values()) {
      if (String(s.id).trim() === String(target.id).trim()) Object.assign(s, { username: u.username, role: u.role, dept: u.dept });
    }
    sendJson(res, 200, await userList(pool));
  } catch (err) {
    console.error('Users error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

// Staff badge "MKH-2398" -> tbUser.ID 2398 -> Username (for Checked by / Inspector on the OQC record)
// GET /api/user/name?id=2398 — returns the Username only
async function handleUserName(req, res, session) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  const id = String(new URL(req.url, 'http://x').searchParams.get('id') || '').trim();
  // tbUser.ID is varchar(10)
  if (!/^[\w-]{1,10}$/.test(id)) return sendJson(res, 400, { error: 'Not a valid staff ID' });
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().input('id', sql.VarChar(10), id)
      .query('SELECT TOP 1 Username AS username FROM tbUser WHERE ID = @id');
    recordset[0] ? sendJson(res, 200, { id, username: String(recordset[0].username ?? '').trim() })
      : sendJson(res, 404, { error: `No user with ID ${id}` });
  } catch (err) {
    console.error('User lookup error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

// ---- SPEC master (MstSpec + MstSpecLength): per ItemCode material text and length SPEC rows ----
const SPEC_TEXT = { customer: 100, partNo: 100, wire: 1000, terminal: 1000, housing: 1000, other: 1000 };
const SPEC_LINES = 22;

function validateSpec(b) {
  const r = { itemCode: String(b.itemCode || '').trim(), lengths: [] };
  if (!r.itemCode) return { error: 'Item Code is required' };
  if (r.itemCode.length > 50) return { error: 'Item Code must be 50 characters or less' };
  for (const [k, max] of Object.entries(SPEC_TEXT)) {
    r[k] = String(b[k] ?? '').trim();
    if (r[k].length > max) return { error: `${k} must be ${max} characters or less` };
  }
  for (const l of Array.isArray(b.lengths) ? b.lengths : []) {
    const no = Number(l.no), position = String(l.position ?? '').trim(), spec = String(l.spec ?? '').trim();
    if (!position && !spec) continue;
    if (!Number.isInteger(no) || no < 1 || no > SPEC_LINES) return { error: `Length № must be 1-${SPEC_LINES}` };
    if (position.length > 50 || spec.length > 50) return { error: `Length № ${no}: Position and SPEC must be 50 characters or less` };
    if (r.lengths.some(x => x.no === no)) return { error: `Length № ${no} is given twice` };
    r.lengths.push({ no, position, spec });
  }
  return r;
}

// Insert (id = 0) or update the item and replace its length rows, all in one transaction
async function saveSpec(id, r, userId) {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const head = await new sql.Request(tx)
      .input('id', sql.Int, id).input('itemCode', sql.VarChar(50), r.itemCode)
      .input('customer', sql.NVarChar(100), r.customer).input('partNo', sql.NVarChar(100), r.partNo).input('wire', sql.NVarChar(1000), r.wire)
      .input('terminal', sql.NVarChar(1000), r.terminal).input('housing', sql.NVarChar(1000), r.housing)
      .input('other', sql.NVarChar(1000), r.other).input('user', sql.VarChar(80), userId)
      .query(`IF EXISTS (SELECT 1 FROM MstSpec WITH (UPDLOCK, HOLDLOCK) WHERE ItemCode = @itemCode AND SysNo <> @id)
          SELECT CAST(1 AS bit) AS dup, 0 AS rc, NULL AS newId
        ELSE IF @id = 0 BEGIN
          INSERT INTO MstSpec (ItemCode, Customer, PartNo, Wire, Terminal, Housing, Other, RegBy, UpdateBy)
            VALUES (@itemCode, @customer, @partNo, @wire, @terminal, @housing, @other, @user, @user);
          SELECT CAST(0 AS bit) AS dup, @@ROWCOUNT AS rc, CAST(SCOPE_IDENTITY() AS int) AS newId
        END ELSE BEGIN
          UPDATE MstSpec SET ItemCode=@itemCode, Customer=@customer, PartNo=@partNo, Wire=@wire, Terminal=@terminal, Housing=@housing, Other=@other,
            UpdateBy=@user, UpdateDate=GETDATE() WHERE SysNo=@id;
          SELECT CAST(0 AS bit) AS dup, @@ROWCOUNT AS rc, @id AS newId
        END`);
    const out = head.recordset[0];
    if (out.dup || !out.rc) { await tx.rollback(); return out; }
    await new sql.Request(tx).input('id', sql.Int, out.newId).query('DELETE FROM MstSpecLength WHERE SpecNo = @id');
    for (const l of r.lengths) {
      await new sql.Request(tx).input('id', sql.Int, out.newId).input('no', sql.TinyInt, l.no)
        .input('position', sql.NVarChar(50), l.position).input('spec', sql.NVarChar(50), l.spec)
        .query('INSERT INTO MstSpecLength (SpecNo, [LineNo], Position, Spec) VALUES (@id, @no, @position, @spec)');
    }
    await tx.commit();
    return out;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

// BOM raw material Type (PEDeptDB.tbRawMaterial.Type) -> QC Type on the OQC record
const QC_TYPE = {
  'cable tie': 'other', connector: 'housing', 'ferrite core': 'other', fuse: 'other', header: 'housing', holder: 'housing',
  housing: 'housing', inlet: 'other', microswitch: 'eol', relay: 'eol', resistance: 'eol', resistor: 'eol', semi: 'other',
  solder: 'eol', switch: 'other', tape: 'other', terminal: 'terminal', tube: 'other', wire: 'wire'
};

// Item Code (= Marunix ItemCode = BOM FG Code) -> Part No + RM Names grouped by QC Type
// GET /api/spec/lookup?itemCode=9487
async function handleSpecLookup(req, res, session) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  const itemCode = String(new URL(req.url, 'http://x').searchParams.get('itemCode') || '').trim();
  if (!itemCode || itemCode.length > 50) return sendJson(res, 400, { error: 'Give an Item Code' });
  try {
    const pool = await getPool();
    const item = await pool.request().input('code', sql.VarChar(50), itemCode).query(
      'SELECT TOP 1 Remark2 AS partNo FROM [192.168.1.21].[Marunix].[dbo].[mstitem] WHERE ItemCode = @code');
    const bom = await pool.request().input('code', sql.VarChar(50), itemCode).query(
      `SELECT [RM Code] AS code, [RM Name] AS name, tbR.Type AS type
       FROM [RawMaterialWHDB].[dbo].[vw_GetOBSMstBOM] tbB
       LEFT JOIN PEDeptDB.[dbo].tbRawMaterial tbR ON tbB.[RM Code] = tbR.Code
       WHERE [FG Code] = @code`);
    if (!item.recordset[0] && !bom.recordset.length) return sendJson(res, 404, { error: `Item Code ${itemCode} not found` });
    const groups = { wire: [], terminal: [], housing: [], other: [], eol: [] }, unclassified = [];
    for (const r of bom.recordset) {
      const name = String(r.name ?? '').trim();
      const qc = QC_TYPE[String(r.type ?? '').trim().replace(/\s+/g, ' ').toLowerCase()];
      if (!qc) unclassified.push({ code: r.code, name, type: r.type });
      else if (name && !groups[qc].includes(name)) groups[qc].push(name);
    }
    sendJson(res, 200, {
      itemCode, partNo: item.recordset[0] ? String(item.recordset[0].partNo ?? '').trim() : '',
      wire: groups.wire.join(', '), terminal: groups.terminal.join(', '), housing: groups.housing.join(', '),
      other: groups.other.join(', '), eol: groups.eol.join(', '), bomRows: bom.recordset.length, unclassified
    });
  } catch (err) {
    console.error('SPEC lookup error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

async function handleSpec(req, res, session, id) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  try {
    const pool = await getPool();
    if (!id && req.method === 'GET') {
      const heads = await pool.request().query(
        `SELECT SysNo AS id, ItemCode AS itemCode, Customer AS customer, PartNo AS partNo, Wire AS wire, Terminal AS terminal, Housing AS housing, Other AS other,
                UpdateBy AS updateBy, UpdateDate AS updateDate
         FROM MstSpec ORDER BY ItemCode`);
      const lines = await pool.request().query(
        'SELECT SpecNo AS specNo, [LineNo] AS no, Position AS position, Spec AS spec FROM MstSpecLength ORDER BY SpecNo, [LineNo]');
      const byId = new Map(heads.recordset.map(h => [h.id, { ...h, lengths: [] }]));
      for (const l of lines.recordset) byId.get(l.specNo)?.lengths.push({ no: l.no, position: l.position, spec: l.spec });
      return sendJson(res, 200, [...byId.values()]);
    }
    if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
      let body;
      try { body = await readJson(req); } catch { return sendJson(res, 400, { error: 'Invalid request' }); }
      const r = validateSpec(body);
      if (r.error) return sendJson(res, 400, r);
      const out = await saveSpec(id || 0, r, session.id);
      if (out.dup) return sendJson(res, 409, { error: `Item Code ${r.itemCode} already exists` });
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

// Shipping label barcode "26-0700394/8802/4500/002" = LotNo / ItemCode / Qty / BoxNO
// GET /api/oqc/label?lot=26-0700394&item=8802&box=002
// -> label data from the Marunix DB (by LotNo + BoxNO) and the SPEC material text (MstSpec by ItemCode)
async function handleOqcLabel(req, res, session) {
  if (!session) return sendJson(res, 401, { error: 'Not logged in' });
  const q = new URL(req.url, 'http://x').searchParams;
  const lot = String(q.get('lot') || '').trim(), box = String(q.get('box') || '').trim(), item = String(q.get('item') || '').trim();
  if (!/^[\w-]{1,50}$/.test(lot) || !/^\w{1,20}$/.test(box) || item.length > 50) return sendJson(res, 400, { error: 'Not a valid label barcode' });
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().input('lot', sql.VarChar(50), lot).input('box', sql.VarChar(20), box).query(
      `SELECT TOP 1 tbT.ItemCode AS itemCode, Remark4 AS customer, Remark2 AS partNo, RealValueQty AS qty, CustomerName AS vendor, CustomerCode AS customerCode
       FROM [192.168.1.21].[Marunix].[dbo].[prgalltransaction] tbT
       LEFT JOIN [192.168.1.21].[Marunix].[dbo].[mstitem] tbM ON tbT.ItemCode = tbM.ItemCode
       LEFT JOIN [192.168.1.21].[Marunix].[dbo].[mstcustomer] tbS ON tbM.EndUserName = tbS.CustomerCode
       WHERE GRICode = 30 AND tbT.TypeCode = 1 AND LotNo = @lot AND BoxNO = @box`);
    const label = recordset[0] || null;
    const dbItem = label ? String(label.itemCode ?? '').trim() : '';
    // The Item Code printed in the code wins; the Marunix row's ItemCode is the fallback
    const itemCode = item || dbItem;
    const spec = itemCode ? (await pool.request().input('item', sql.VarChar(50), itemCode).query(
      'SELECT TOP 1 Wire AS wire, Terminal AS terminal, Housing AS housing, Other AS other FROM MstSpec WHERE ItemCode = @item')).recordset[0] : null;
    if (!label && !spec) return sendJson(res, 404, { error: `No label found for Lot ${lot}, Box ${box}${itemCode ? ` and no SPEC for Item Code ${itemCode}` : ''}` });
    // Length Check rows of the SPEC: № on the record = LineNo
    if (spec) {
      const { recordset: lines } = await pool.request().input('item', sql.VarChar(50), itemCode).query(
        `SELECT ItemCode, [LineNo] AS Line, Position, Spec FROM MstSpec tbS
         LEFT JOIN MstSpecLength tbL ON tbS.SysNo = tbL.SpecNo WHERE tbS.ItemCode = @item`);
      // LEFT JOIN gives one row with Line = NULL when the item has no length rows
      spec.lengths = lines.filter(l => l.Line != null).sort((a, b) => a.Line - b.Line)
        .map(l => ({ line: l.Line, position: l.Position ?? '', spec: l.Spec ?? '' }));
    }
    sendJson(res, 200, { lot, box, ...(label || {}), itemCode, labelFound: !!label, spec: spec || null,
      itemMismatch: !!(item && dbItem && item !== dbItem) ? dbItem : null });
  } catch (err) {
    console.error('OQC label error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// URL path -> file on disk, for files whose name differs from their URL
const aliases = { 'favicon.ico': 'QC App.ico' };
// Only these are public; server.js, package.json and config/ are never served
const publicFiles = new Set(['login.html', 'home.html', 'menu.html', 'favicon.ico', 'spec-print.js']);
// Pages that require a logged-in session
const protectedPages = new Set(['/home.html', '/menu.html']);

http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // Browser-side config, generated per environment
  if (urlPath === '/config.js') {
    const { name, apiBaseUrl, showEnvBadge } = config;
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    return res.end(`window.APP_ENV = ${JSON.stringify({ name, apiBaseUrl, showEnvBadge })};`);
  }

  // API
  if (urlPath === '/api/login' && req.method === 'POST') return handleLogin(req, res);
  if (urlPath === '/api/logout' && req.method === 'POST') {
    const s = getSession(req);
    if (s) sessions.delete(s.token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }
  if (urlPath === '/api/me') {
    const s = getSession(req);
    if (!s) return sendJson(res, 401, { error: 'Not logged in' });
    try {
      return sendJson(res, 200, { id: s.id, username: s.username, role: s.role, dept: s.dept, perms: await getPerms(s) });
    } catch (err) {
      console.error('Permissions error:', err.message);
      return sendJson(res, 500, { error: 'Database error' });
    }
  }
  // Every API call below needs a permission (see permFor); checked here once for all routes
  const need = permFor(urlPath, req.method);
  if (need) {
    const s = getSession(req);
    if (!s) return sendJson(res, 401, { error: 'Not logged in' });
    let perms;
    try { perms = await getPerms(s); } catch (err) { console.error('Permissions error:', err.message); return sendJson(res, 500, { error: 'Database error' }); }
    if (![].concat(need).some(k => perms.includes(k))) return sendJson(res, 403, { error: 'You do not have permission to do this' });
  }
  if (urlPath === '/api/permissions') return handlePermissions(req, res, getSession(req));
  const xm = urlPath.match(/^\/api\/excel\/(oqc|spec)$/);
  if (xm) return handleOqcExcel(req, res, getSession(req), xm[1]);
  const um = urlPath.match(/^\/api\/users(?:\/([^/]+))?$/);
  if (um) return handleUsers(req, res, getSession(req), um[1] || '');
  if (urlPath === '/api/user/name') return handleUserName(req, res, getSession(req));
  if (urlPath === '/api/spec/lookup') return handleSpecLookup(req, res, getSession(req));
  const spm = urlPath.match(/^\/api\/spec(?:\/(\d+))?$/);
  if (spm) return handleSpec(req, res, getSession(req), spm[1] ? Number(spm[1]) : 0);
  const orm = urlPath.match(/^\/api\/oqc\/records(?:\/(\d+))?$/);
  if (orm) return handleOqcRecords(req, res, getSession(req), orm[1] ? Number(orm[1]) : 0);
  if (urlPath === '/api/oqc/label') return handleOqcLabel(req, res, getSession(req));
  if (urlPath === '/api/sampling/lookup') return handleSamplingLookup(req, res, getSession(req));
  const sm = urlPath.match(/^\/api\/sampling(?:\/(\d+))?$/);
  if (sm) return handleSampling(req, res, getSession(req), sm[1] ? Number(sm[1]) : 0);

  // Pages: logged-in users skip the login page; home requires a session
  const session = getSession(req);
  if ((urlPath === '/' || urlPath === '/login.html') && session) { res.writeHead(302, { Location: '/menu.html' }); return res.end(); }
  if (protectedPages.has(urlPath) && !session) { res.writeHead(302, { Location: '/' }); return res.end(); }

  const rel = urlPath === '/' ? 'login.html' : decodeURIComponent(urlPath).replace(/^\/+/, '');
  if (!publicFiles.has(rel)) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, aliases[rel] || rel), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(rel)] || 'application/octet-stream',
      // HTML pages depend on login state, so never cache them
      'Cache-Control': config.cache && !rel.endsWith('.html') ? 'public, max-age=3600' : 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, config.bindHost || config.host, () => console.log(`[${config.name}] listening on ${config.bindHost || config.host}:${PORT} -> http://${config.host}:${PORT}`));
