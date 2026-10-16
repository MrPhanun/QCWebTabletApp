// Pages, CSS, JS and icons: everything in public/ is served as-is
const fs = require('fs');
const path = require('path');
const { config } = require('./config');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
// Pages that require a logged-in session
const protectedPages = new Set(['/home.html', '/menu.html']);

// Browser-side config, generated per environment (GET /config.js)
function serveConfigJs(res) {
  const { name, apiBaseUrl, showEnvBadge } = config;
  res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
  res.end(`window.APP_ENV = ${JSON.stringify({ name, apiBaseUrl, showEnvBadge })};`);
}

function serveStatic(req, res, urlPath, session) {
  // Logged-in users skip the login page; the other pages require a session
  if ((urlPath === '/' || urlPath === '/login.html') && session) { res.writeHead(302, { Location: '/menu.html' }); return res.end(); }
  if (protectedPages.has(urlPath) && !session) { res.writeHead(302, { Location: '/' }); return res.end(); }

  const notFound = () => { res.writeHead(404); res.end('Not found'); };
  let rel;
  try { rel = urlPath === '/' ? 'login.html' : decodeURIComponent(urlPath).replace(/^\/+/, ''); } catch { return notFound(); }
  // Never serve anything outside public/ (server code, config, .env)
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return notFound();
  fs.readFile(file, (err, data) => {
    if (err) return notFound();
    res.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      // Pages depend on login state, and pages, CSS and JS must stay in step after an update, so only icons/images are cached
      'Cache-Control': config.cache && !/\.(html|css|js)$/.test(file) ? 'public, max-age=3600' : 'no-store'
    });
    res.end(data);
  });
}

module.exports = { serveConfigJs, serveStatic };
