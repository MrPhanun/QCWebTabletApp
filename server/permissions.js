const { sql, getPool } = require('./db');

// Only QC department users may change QC master data
const isQC = dept => String(dept || '').trim().toUpperCase() === 'QC';

// ---- Roles & Permissions (MstPermission): per user, which pages they can see and which buttons they can use ----
const PERMS = [
  'sampling.view', 'sampling.add', 'sampling.edit', 'sampling.delete',
  'spec.view', 'spec.add', 'spec.edit', 'spec.delete', 'spec.excel',
  'daily.view', 'daily.add', 'daily.edit', 'daily.delete', 'daily.excel',
  'users.view', 'users.add', 'users.edit', 'users.delete',
  'roles.view', 'roles.edit'
];
// Rules for users who were never customised: everyone views and downloads Excel, QC department adds / edits / deletes,
// Admin role manages users and permissions (same as before permissions existed)
function defaultPerms(role, dept) {
  const p = ['sampling.view', 'spec.view', 'spec.excel', 'daily.view', 'daily.excel'];
  if (isQC(dept)) p.push('sampling.add', 'sampling.edit', 'sampling.delete', 'spec.add', 'spec.edit', 'spec.delete', 'daily.add', 'daily.edit', 'daily.delete');
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
  if (/^\/api\/spec(\/\d+)?$/.test(urlPath)) return by({ GET: 'spec.view', POST: 'spec.add', PUT: 'spec.edit', DELETE: 'spec.delete' });
  if (/^\/api\/oqc\/records(\/\d+)?$/.test(urlPath)) return by({ GET: 'daily.view', POST: 'daily.add', PUT: 'daily.edit', DELETE: 'daily.delete' });
  if (urlPath === '/api/oqc/spec' || urlPath === '/api/oqc/label' || urlPath === '/api/user/name') return 'daily.view';
  if (urlPath === '/api/excel/oqc' || urlPath === '/api/pdf/oqc') return 'daily.excel';
  if (urlPath === '/api/excel/spec') return 'spec.excel';
  if (/^\/api\/users(\/[^/]+)?$/.test(urlPath)) return by({ GET: 'users.view', POST: 'users.add', PUT: 'users.edit', DELETE: 'users.delete' });
  if (urlPath === '/api/permissions') return by({ GET: 'roles.view', PUT: 'roles.edit' });
  return null;
}

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

module.exports = { isQC, PERMS, defaultPerms, getPerms, permFor, loadUserPerms };
