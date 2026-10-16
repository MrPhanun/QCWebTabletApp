// Login / logout / who am I
const crypto = require('crypto');
const { sql, getPool } = require('../db');
const { sendJson, readJson } = require('../http');
const { SESSION_HOURS, sessions, getSession } = require('../session');
const { isQC, getPerms } = require('../permissions');

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

function handleLogout(req, res) {
  const s = getSession(req);
  if (s) sessions.delete(s.token);
  sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
}

// The signed-in user with their effective permissions
async function handleMe(req, res) {
  const s = getSession(req);
  if (!s) return sendJson(res, 401, { error: 'Not logged in' });
  try {
    sendJson(res, 200, { id: s.id, username: s.username, role: s.role, dept: s.dept, perms: await getPerms(s) });
  } catch (err) {
    console.error('Permissions error:', err.message);
    sendJson(res, 500, { error: 'Database error' });
  }
}

module.exports = { handleLogin, handleLogout, handleMe };
