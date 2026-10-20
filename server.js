// Entry point: start the HTTP server and send each request to its handler.
// The handlers live in server/routes/, one file per feature (see README.md).
const http = require('http');
const { config, PORT } = require('./server/config');
const { sendJson } = require('./server/http');
const { getSession } = require('./server/session');
const { getPerms, permFor } = require('./server/permissions');
const { serveConfigJs, serveStatic } = require('./server/static');
const { handleLogin, handleLogout, handleMe } = require('./server/routes/auth');
const { handlePermissions } = require('./server/routes/permissions');
const { handleOqcExcel, handleOqcPdf, handleRecordExport } = require('./server/routes/excel');
const { handleUsers, handleUserName } = require('./server/routes/users');
const { handleSpec } = require('./server/routes/spec');
const { handleOqcRecords, handleOqcSpec, handleOqcLabel } = require('./server/routes/oqc');
const { handleSampling, handleSamplingLookup } = require('./server/routes/sampling');

http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  if (urlPath === '/config.js') return serveConfigJs(res);

  // API
  if (urlPath === '/api/login' && req.method === 'POST') return handleLogin(req, res);
  if (urlPath === '/api/logout' && req.method === 'POST') return handleLogout(req, res);
  if (urlPath === '/api/me') return handleMe(req, res);
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
  if (urlPath === '/api/pdf/oqc') return handleOqcPdf(req, res, getSession(req));
  const um = urlPath.match(/^\/api\/users(?:\/([^/]+))?$/);
  if (um) return handleUsers(req, res, getSession(req), um[1] || '');
  if (urlPath === '/api/user/name') return handleUserName(req, res, getSession(req));
  const spm = urlPath.match(/^\/api\/spec(?:\/(\d+))?$/);
  if (spm) return handleSpec(req, res, getSession(req), spm[1] ? Number(spm[1]) : 0);
  const rxm = urlPath.match(/^\/api\/oqc\/records\/(\d+)\/(excel|pdf)$/);
  if (rxm) return handleRecordExport(req, res, getSession(req), Number(rxm[1]), rxm[2]);
  const orm = urlPath.match(/^\/api\/oqc\/records(?:\/(\d+))?$/);
  if (orm) return handleOqcRecords(req, res, getSession(req), orm[1] ? Number(orm[1]) : 0);
  if (urlPath === '/api/oqc/spec') return handleOqcSpec(req, res, getSession(req));
  if (urlPath === '/api/oqc/label') return handleOqcLabel(req, res, getSession(req));
  if (urlPath === '/api/sampling/lookup') return handleSamplingLookup(req, res, getSession(req));
  const sm = urlPath.match(/^\/api\/sampling(?:\/(\d+))?$/);
  if (sm) return handleSampling(req, res, getSession(req), sm[1] ? Number(sm[1]) : 0);

  // Pages and files from public/
  serveStatic(req, res, urlPath, getSession(req));
}).listen(PORT, config.bindHost || config.host, () => console.log(`[${config.name}] listening on ${config.bindHost || config.host}:${PORT} -> http://${config.host}:${PORT}`));
