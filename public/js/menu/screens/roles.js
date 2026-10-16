// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// Roles & Permissions: one row per user, one tick per page (View) and button (Add / Edit / Delete / Excel)
const PERM_GROUPS = [
  { k: 'm.sampling', keys: ['sampling.view', 'sampling.add', 'sampling.edit', 'sampling.delete'] },
  { k: 'm.spec', keys: ['spec.view', 'spec.add', 'spec.edit', 'spec.delete', 'spec.excel'] },
  { k: 'm.daily', keys: ['daily.view', 'daily.add', 'daily.edit', 'daily.excel'] },
  { k: 'm.users', keys: ['users.view', 'users.add', 'users.edit', 'users.delete'] },
  { k: 'm.roles', keys: ['roles.view', 'roles.edit'] }
];
function renderRoles(panel) {
  const canEdit = can('roles.edit');
  let users = [], orig = new Map(), draft = new Map();
  const KEYS = PERM_GROUPS.flatMap(g => g.keys);
  const groupOf = k => PERM_GROUPS.find(g => g.keys.includes(k));
  panel.innerHTML = `
    <div class="readonly-note" ${canEdit ? 'hidden' : ''}>${svg('lock')} ${T('r.readonly')}</div>
    <p class="perm-hint">${T('r.hint')}</p>
    <div class="spec-bar">
      <label class="search">${svg('search')}<input id="pmSearch" type="search" ${P('r.search')} aria-label="Search users"></label>
      <span class="count" id="pmCount"></span>
      <span class="spinner" aria-hidden="true"></span><span class="busy-note">${T('loading')}</span>
    </div>
    <div class="msg" id="pmMsg" role="status"></div>
    <div class="table-wrap perm-wrap"><table class="perm-grid">
      <thead>
        <tr><th rowspan="2" class="sticky">${T('r.user')}</th>
          ${PERM_GROUPS.map(g => `<th colspan="${g.keys.length}" class="grp">${T(g.k)}</th>`).join('')}
          <th rowspan="2"></th></tr>
        <tr>${KEYS.map(k => `<th class="act"><button type="button" data-col="${k}" ${canEdit ? '' : 'disabled'} title="${esc(t('r.all'))}">${T('p.' + k.split('.')[1])}</button></th>`).join('')}</tr>
      </thead>
      <tbody id="pmBody"></tbody>
    </table></div>
    <div class="perm-save" id="pmSave" hidden>
      <span id="pmChanges"></span>
      <button class="icon-btn" id="pmCancel" type="button">${ico('x')}${T('b.cancel')}</button>
      <button class="btn-primary" id="pmApply" type="button">${ico('save')}${T('b.save')}</button>
    </div>`;
  const $ = id => panel.querySelector('#' + id);
  const msg = (text, kind = 'err') => { $('pmMsg').textContent = text; $('pmMsg').className = 'msg ' + kind; };
  const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
  const changedIds = () => users.map(u => u.id).filter(id => !sameSet(orig.get(id), draft.get(id)));

  function load(list) {
    users = list;
    orig = new Map(list.map(u => [u.id, new Set(u.perms)]));
    draft = new Map(list.map(u => [u.id, new Set(u.perms)]));
    draw();
  }
  function draw() {
    const q = $('pmSearch').value.trim().toLowerCase();
    const list = users.filter(u => !q || [u.id, u.username, u.role, u.dept].some(v => String(v || '').toLowerCase().includes(q)));
    $('pmCount').textContent = q ? t('u.countOf', { n: list.length, total: users.length }) : t('u.count', { n: users.length });
    const s2 = v => esc(String(v ?? ''));
    $('pmBody').innerHTML = list.map(u => {
      const d = draft.get(u.id), o = orig.get(u.id);
      return `<tr data-id="${s2(u.id)}"${u.id === currentUser.id ? ' class="me"' : ''}>
        <td class="sticky"><div class="pm-user">
          <span class="u-av">${s2(String(u.username || '?').trim().charAt(0).toUpperCase())}</span>
          <span class="pm-who"><b>${s2(u.username)}</b><small>${s2(u.id)} · ${s2(u.role)}${u.dept ? ' · ' + s2(u.dept) : ''}</small></span>
          <span class="pill ${u.custom ? 'custom' : 'default'}">${esc(t(u.custom ? 'r.custom' : 'r.default'))}</span>
        </div></td>
        ${KEYS.map(k => `<td class="cb${d.has(k) !== o.has(k) ? ' changed' : ''}${k.endsWith('.view') ? ' view' : ''}">
          <label class="tick"><input type="checkbox" data-k="${k}" ${d.has(k) ? 'checked' : ''} ${canEdit ? '' : 'disabled'}
            aria-label="${s2(u.username)} ${esc(t(groupOf(k).k))} ${esc(t('p.' + k.split('.')[1]))}"><span></span></label></td>`).join('')}
        <td>${canEdit && u.custom ? `<button class="icon-btn" data-reset="${s2(u.id)}" title="${esc(t('r.reset'))}">${ico('x')}${T('r.reset')}</button>` : ''}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="${KEYS.length + 2}" class="empty-row">${esc(t('u.none'))}</td></tr>`;
    const n = changedIds().length;
    $('pmSave').hidden = !n;
    $('pmChanges').textContent = t('r.changes', { n });
  }

  // Tick a box: using a button needs the page's View; removing View removes that page's buttons too
  function setPerm(id, k, on) {
    const d = draft.get(id);
    const g = groupOf(k), view = g.keys[0];
    if (on) { d.add(k); d.add(view); }
    else { d.delete(k); if (k === view) g.keys.forEach(x => d.delete(x)); }
  }
  $('pmBody').addEventListener('change', e => {
    const cb = e.target.closest('input[data-k]'); if (!cb) return;
    setPerm(cb.closest('tr').dataset.id, cb.dataset.k, cb.checked);
    draw();
  });
  // Column header: tick / untick that permission for every user in the list
  panel.querySelector('thead').addEventListener('click', e => {
    const b = e.target.closest('[data-col]'); if (!b || !canEdit) return;
    const ids = [...$('pmBody').querySelectorAll('tr[data-id]')].map(tr => tr.dataset.id);
    const allOn = ids.every(id => draft.get(id).has(b.dataset.col));
    ids.forEach(id => setPerm(id, b.dataset.col, !allOn));
    draw();
  });
  $('pmBody').addEventListener('click', async e => {
    const b = e.target.closest('[data-reset]'); if (!b) return;
    const u = users.find(x => x.id === b.dataset.reset);
    if (!await uiConfirm({ icon: '↺', title: t('r.resetT', { name: u.username }), message: esc(t('r.resetM')), ok: t('r.reset'), cancel: t('b.cancel') })) return;
    await save([{ id: u.id, perms: null }]);
  });
  $('pmCancel').onclick = () => { draft = new Map([...orig].map(([id, set]) => [id, new Set(set)])); draw(); msg(''); };
  $('pmApply').onclick = () => save(changedIds().map(id => ({ id, perms: [...draft.get(id)] })));
  async function save(list) {
    if (!list.length) return;
    $('pmApply').disabled = true;
    try {
      const r = await api('PUT', '/api/permissions', { users: list });
      load(r.users);
      msg(t('r.saved'), 'ok');
      // My own rights changed: reload so the menu and buttons follow them
      if (list.some(x => x.id === currentUser.id)) setTimeout(() => location.reload(), 900);
    } catch (err) { msg(err.message); } finally { $('pmApply').disabled = false; }
  }
  $('pmSearch').addEventListener('input', draw);
  langHook = draw;
  api('GET', '/api/permissions').then(r => load(r.users)).catch(err => msg(err.message));
}
