const { sql, getPool } = require('../db');
const { sendJson, readJson } = require('../http');
const { sessions } = require('../session');
const { defaultPerms, loadUserPerms } = require('../permissions');

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

module.exports = { handleUsers, handleUserName };
