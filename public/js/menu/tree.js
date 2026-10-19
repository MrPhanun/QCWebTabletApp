// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Menu tree. `roles` limits a node (and its children) to those user roles.
const MENU = [
  { id: 'dashboard', k: 'm.dashboard', icon: 'home' },
  { id: 'master', k: 'm.master', icon: 'folder', children: [
    { id: 'sampling', k: 'm.sampling', icon: 'layers', perm: 'sampling.view' },
    { id: 'spec', k: 'm.spec', icon: 'ruler', perm: 'spec.view' }
  ]},
  { id: 'reports', k: 'm.reports', icon: 'chart', children: [
    { id: 'daily', k: 'm.daily', icon: 'calendar', perm: 'daily.view' },
    { id: 'draft', k: 'm.draft', icon: 'search', perm: 'daily.view' }
  ]},
  { id: 'admin', k: 'm.admin', icon: 'shield', children: [
    { id: 'users', k: 'm.users', icon: 'users', perm: 'users.view' },
    { id: 'roles', k: 'm.roles', icon: 'lock', perm: 'roles.view' }
  ]}
];

const treeEl = document.getElementById('tree');
const STORE_KEY = 'qc-menu-state';
let nodesById = {};
let state = { open: ['master'], selected: 'dashboard' };
try { Object.assign(state, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); } catch {}
const saveState = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} };

const countLeaves = n => n.children ? n.children.reduce((a, c) => a + countLeaves(c), 0) : 1;

// Keep the pages this user may view; a group with no visible pages disappears
function filterByPerm(nodes) {
  return nodes.filter(n => !n.perm || can(n.perm))
    .map(n => n.children ? { ...n, children: filterByPerm(n.children) } : n)
    .filter(n => !n.children || n.children.length);
}

function buildTree(nodes, parentEl, parent, level) {
  for (const n of nodes) {
    n.parent = parent;
    nodesById[n.id] = n;
    const li = document.createElement('li');
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-level', level);
    li.dataset.id = n.id;
    const hasKids = !!(n.children && n.children.length);
    if (hasKids) li.setAttribute('aria-expanded', state.open.includes(n.id));
    li.innerHTML = `<button class="node" tabindex="-1">
        ${svg('chev', 'i chev' + (hasKids ? '' : ' blank'))}
        <span class="ic">${svg(n.icon)}</span>
        <span class="label">${esc(labelOf(n))}</span>
        ${hasKids ? `<span class="count">${countLeaves(n)}</span>` : ''}
      </button>`;
    n.li = li;
    parentEl.appendChild(li);
    if (hasKids) {
      const ul = document.createElement('ul');
      ul.setAttribute('role', 'group');
      li.appendChild(ul);
      buildTree(n.children, ul, n, level + 1);
    }
  }
}

function setExpanded(n, open) {
  if (!n.children || !n.children.length) return;
  n.li.setAttribute('aria-expanded', open);
  state.open = state.open.filter(id => id !== n.id);
  if (open) state.open.push(n.id);
  saveState();
}

function pathOf(n) { const p = []; for (let x = n; x; x = x.parent) p.unshift(x); return p; }

function select(id, { focus = false } = {}) {
  const n = nodesById[id] || nodesById.dashboard;
  treeEl.querySelectorAll('[aria-selected="true"]').forEach(el => el.removeAttribute('aria-selected'));
  n.li.setAttribute('aria-selected', 'true');
  pathOf(n).slice(0, -1).forEach(a => setExpanded(a, true));
  setRoving(n);
  if (focus) n.li.querySelector('.node').focus();
  state.selected = n.id;
  saveState();
  renderContent(n);
  // On phones, close the drawer once a screen (not a group) is picked
  if (!(n.children && n.children.length)) document.body.classList.remove('nav-open');
}

const labelOf = n => t(n.k);
function renderHeader(n) {
  document.getElementById('crumbs').innerHTML = pathOf(n).map((p, i) =>
    (i ? '<span class="sep">›</span>' : '') + `<span>${esc(labelOf(p))}</span>`).join('');
  document.getElementById('title').innerHTML = `<span class="ic-wrap">${svg(n.icon)}</span>${esc(labelOf(n))}`;
}
function renderContent(n) {
  renderHeader(n);
  langHook = null;
  const panel = document.getElementById('panel');
  if (SCREENS[n.id]) return SCREENS[n.id](panel);
  const items = n.id === 'dashboard' ? treeData.filter(x => x.id !== 'dashboard') : n.children;
  if (items && items.length) {
    panel.innerHTML = `<div class="tiles">${items.map(c =>
      `<button class="tile" data-go="${c.id}"><span class="ic-wrap">${svg(c.icon)}</span>${T(c.k)}</button>`).join('')}</div>`;
  } else {
    panel.innerHTML = `<div class="placeholder">${svg(n.icon)}<b>${T(n.k)}</b>${T('notBuilt')}</div>`;
  }
}

// Roving tabindex: only one tree item is in the tab order
function setRoving(n) {
  treeEl.querySelectorAll('.node[tabindex="0"]').forEach(b => b.tabIndex = -1);
  n.li.querySelector('.node').tabIndex = 0;
}

const visibleNodes = () => [...treeEl.querySelectorAll('li')]
  .filter(li => li.offsetParent !== null && li.style.display !== 'none')
  .map(li => nodesById[li.dataset.id]);

treeEl.addEventListener('click', e => {
  const btn = e.target.closest('.node'); if (!btn) return;
  const n = nodesById[btn.parentElement.dataset.id];
  if (n.children && n.children.length) {
    const open = n.li.getAttribute('aria-expanded') === 'true';
    // Clicking the arrow only toggles; clicking the label opens and selects
    if (e.target.closest('.chev')) return setExpanded(n, !open);
    setExpanded(n, !open || state.selected !== n.id ? true : false);
  }
  select(n.id);
});

treeEl.addEventListener('keydown', e => {
  const btn = e.target.closest('.node'); if (!btn) return;
  const n = nodesById[btn.parentElement.dataset.id];
  const vis = visibleNodes(), i = vis.indexOf(n);
  const hasKids = n.children && n.children.length;
  const open = n.li.getAttribute('aria-expanded') === 'true';
  const focusNode = m => { if (m) { setRoving(m); m.li.querySelector('.node').focus(); } };
  switch (e.key) {
    case 'ArrowDown': focusNode(vis[i + 1]); break;
    case 'ArrowUp': focusNode(vis[i - 1]); break;
    case 'ArrowRight': if (hasKids) open ? focusNode(n.children[0]) : setExpanded(n, true); break;
    case 'ArrowLeft': if (hasKids && open) setExpanded(n, false); else focusNode(n.parent); break;
    case 'Home': focusNode(vis[0]); break;
    case 'End': focusNode(vis[vis.length - 1]); break;
    case 'Enter': case ' ': select(n.id, { focus: true }); break;
    default: return;
  }
  e.preventDefault();
});

document.getElementById('panel').addEventListener('click', e => {
  const t = e.target.closest('[data-go]'); if (t) select(t.dataset.go);
});

document.getElementById('expandAll').onclick = () => Object.values(nodesById).forEach(n => setExpanded(n, true));
document.getElementById('collapseAll').onclick = () => Object.values(nodesById).forEach(n => setExpanded(n, false));

// Search: show matching items plus their parents, expanded
document.getElementById('filter').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  let any = false;
  const walk = n => {
    const self = !q || (STR[n.k] || [labelOf(n)]).some(x => x.toLowerCase().includes(q));   // matches either language
    const kid = (n.children || []).map(walk).some(Boolean);
    const show = self || kid;
    n.li.style.display = show ? '' : 'none';
    if (q && kid) n.li.setAttribute('aria-expanded', 'true');
    if (!q && n.children && n.children.length) n.li.setAttribute('aria-expanded', state.open.includes(n.id));
    const label = n.li.querySelector(':scope > .node .label');
    const lbl = labelOf(n);
    const at = q ? lbl.toLowerCase().indexOf(q) : -1;
    label.innerHTML = at < 0 ? esc(lbl)
      : esc(lbl.slice(0, at)) + '<mark>' + esc(lbl.slice(at, at + q.length)) + '</mark>' + esc(lbl.slice(at + q.length));
    if (show) any = true;
    return show;
  };
  treeData.forEach(walk);
  document.getElementById('treeEmpty').style.display = any ? 'none' : 'block';
});

// Mobile drawer
// ☰: on phones the menu slides in/out; on desktop it hides/shows the menu column (remembered)
const NAV_KEY = 'qc-nav-hidden';
const phone = window.matchMedia('(max-width: 860px)');
const menuToggle = document.getElementById('menuToggle');
function syncToggle() {
  const open = phone.matches ? document.body.classList.contains('nav-open') : !document.body.classList.contains('nav-hidden');
  const label = t(open ? 't.hideMenu' : 't.showMenu');
  menuToggle.setAttribute('aria-label', label);
  menuToggle.title = label;
  menuToggle.setAttribute('aria-expanded', open);
}
try { if (localStorage.getItem(NAV_KEY) === '1') document.body.classList.add('nav-hidden'); } catch {}
menuToggle.onclick = () => {
  if (phone.matches) document.body.classList.toggle('nav-open');
  else {
    const hidden = document.body.classList.toggle('nav-hidden');
    try { localStorage.setItem(NAV_KEY, hidden ? '1' : '0'); } catch {}
  }
  syncToggle();
};
phone.addEventListener('change', syncToggle);
new MutationObserver(syncToggle).observe(document.body, { attributes: true, attributeFilter: ['class'] });
syncToggle();
document.getElementById('scrim').onclick = () => document.body.classList.remove('nav-open');
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('nav-open'); });
