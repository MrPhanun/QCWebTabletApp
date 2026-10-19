// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// ---- Screens: menu ids that have a real screen instead of the placeholder ----
const SCREENS = { sampling: renderSampling, spec: renderSpec, daily: renderOQC, draft: renderDraft, users: renderUsers, roles: renderRoles };

// Language switch: update text in place (forms keep what was typed), then let lists/counters redraw
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'km';
  try { localStorage.setItem(LANG_KEY, LANG); } catch {}
  applyLang();
  Object.values(nodesById).forEach(n => { const el = n.li && n.li.querySelector(':scope > .node .label'); if (el) el.textContent = labelOf(n); });
  if (document.getElementById('filter').value) document.getElementById('filter').dispatchEvent(new Event('input'));
  if (nodesById[state.selected]) renderHeader(nodesById[state.selected]);
  syncToggle();
  if (langHook) langHook();
}
document.querySelectorAll('.lang-switch button').forEach(b => b.onclick = () => setLang(b.dataset.lang));
applyLang();

document.getElementById('logout').onclick = async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.replace('/');
};

if (window.APP_ENV && window.APP_ENV.showEnvBadge) {
  const b = document.getElementById('envBadge');
  b.textContent = window.APP_ENV.name; b.style.display = 'inline-block';
}

// Load the signed-in user, then build the menu for their role
let treeData = [], currentUser = null;
setBusy(true);
fetch('/api/me').finally(() => setBusy(false)).then(r => r.ok ? r.json() : Promise.reject()).then(u => {
  currentUser = u;
  document.getElementById('userName').textContent = u.username;
  document.getElementById('userRole').textContent = [u.role, u.dept, u.id].filter(Boolean).join(' • ');
  document.getElementById('avatar').textContent = (u.username || '?').trim().charAt(0).toUpperCase();
  treeData = filterByPerm(MENU);
  buildTree(treeData, treeEl, null, 1);
  select(nodesById[state.selected] ? state.selected : 'dashboard');
}).catch(() => location.replace('/'));
