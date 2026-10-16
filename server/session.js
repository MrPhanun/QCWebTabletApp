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

module.exports = { SESSION_HOURS, sessions, getSession };
