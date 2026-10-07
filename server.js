const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');

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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
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

  try {
    const pool = await getPool();
    // Users may sign in with either their ID or their Username
    const result = await pool.request()
      .input('login', sql.VarChar(80), login)
      .query('SELECT TOP 1 ID, Username, UserRole, Password FROM tbUser WHERE ID = @login OR Username = @login');
    const user = result.recordset[0];
    // tbUser stores plain-text passwords; compare in JS so the match is case-sensitive
    if (!user || !safeEqual(user.Password, password)) {
      return sendJson(res, 401, { error: 'Incorrect ID or password' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { id: user.ID, username: user.Username, role: user.UserRole, expires: Date.now() + SESSION_HOURS * 3600e3 });
    sendJson(res, 200, { id: user.ID, username: user.Username, role: user.UserRole }, {
      'Set-Cookie': `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}`
    });
  } catch (err) {
    console.error('Login failed:', err.message);
    sendJson(res, 500, { error: 'Cannot connect to the database' });
  }
}

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// URL path -> file on disk, for files whose name differs from their URL
const aliases = { 'favicon.ico': 'QC App.ico' };
// Only these are public; server.js, package.json and config/ are never served
const publicFiles = new Set(['login.html', 'home.html', 'favicon.ico']);

http.createServer((req, res) => {
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
    return s ? sendJson(res, 200, { id: s.id, username: s.username, role: s.role }) : sendJson(res, 401, { error: 'Not logged in' });
  }

  // Pages: logged-in users skip the login page; home requires a session
  const session = getSession(req);
  if ((urlPath === '/' || urlPath === '/login.html') && session) { res.writeHead(302, { Location: '/home.html' }); return res.end(); }
  if (urlPath === '/home.html' && !session) { res.writeHead(302, { Location: '/' }); return res.end(); }

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
