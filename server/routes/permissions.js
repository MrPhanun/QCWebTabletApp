const { sql, getPool } = require('../db');
const { sendJson, readJson } = require('../http');
const { PERMS, defaultPerms, loadUserPerms } = require('../permissions');

// GET /api/permissions: every user with their permissions; PUT: save { users: [{ id, perms: [...] | null }] } (null = back to default)
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

module.exports = { handlePermissions };
