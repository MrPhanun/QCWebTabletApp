// Part of menu.html. All files under js/menu/ are plain scripts that share one global scope;
// they are loaded in the order listed at the bottom of menu.html.

// User Management: everyone in tbUser; add / edit / delete follow Roles & Permissions (passwords are never loaded)
function renderUsers(panel) {
  let rows = [], editId = '';
  const canAdd = can('users.add'), canEdit = can('users.edit'), canDel = can('users.delete');
  const me = String(currentUser && currentUser.id || '').trim();
  panel.innerHTML = `
    <form class="form-grid users-form" id="usForm" novalidate autocomplete="off" ${canAdd ? '' : 'hidden'}>
      <label class="fld">${T('u.id')} <input id="usId" maxlength="10" ${P('u.phId')} autocomplete="off"></label>
      <label class="fld">${T('u.name')} <input id="usName" maxlength="80" ${P('u.phName')} autocomplete="off"></label>
      <label class="fld">${T('u.password')} <input id="usPass" type="password" maxlength="100" autocomplete="new-password"></label>
      <label class="fld">${T('u.role')} <select id="usRole"><option value="User">User</option><option value="Admin">Admin</option></select></label>
      <label class="fld">${T('u.dept')} <input id="usDept" maxlength="50" list="usDepts" ${P('u.phDept')} autocomplete="off"></label>
      <datalist id="usDepts"></datalist>
      <div class="form-actions">
        <button class="btn-primary" id="usSubmit" type="submit">${ico('plus')}${T('b.add')}</button>
        <button class="icon-btn" id="usCancel" type="button" hidden>${ico('x')}${T('b.cancel')}</button>
      </div>
    </form>
    <div class="spec-bar">
      <label class="search">${svg('search')}<input id="usSearch" type="search" ${P('u.search')} aria-label="Search users"></label>
      <span class="count" id="usCount"></span>
      <span class="spinner" aria-hidden="true"></span><span class="busy-note">${T('loading')}</span>
    </div>
    <div class="msg" id="usMsg" role="status"></div>
    <div class="table-wrap"><table class="data">
      <thead><tr>${['u.id', 'u.name', 'u.role', 'u.dept', 'u.created', 'u.updated'].map(k => `<th>${T(k)}</th>`).join('')}<th></th></tr></thead>
      <tbody id="usBody"></tbody>
    </table></div>`;
  const $ = id => panel.querySelector('#' + id);
  const s = v => esc(String(v ?? ''));
  const msg = (text, kind = 'err') => { $('usMsg').textContent = text; $('usMsg').className = 'msg ' + kind; };
  const sameId = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  const setPassHint = () => $('usPass').placeholder = t(editId ? 'u.phPassKeep' : 'u.phPass');

  function resetForm() {
    editId = '';
    $('usForm').reset();
    $('usId').disabled = false;
    $('usSubmit').innerHTML = ico('plus') + T('b.add');
    $('usCancel').hidden = true;
    $('usForm').hidden = !canAdd;
    setPassHint();
    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    draw();
  }
  $('usCancel').onclick = () => { resetForm(); msg(''); };

  function draw() {
    const q = $('usSearch').value.trim().toLowerCase();
    const list = rows.filter(r => !q || [r.id, r.username, r.role, r.dept].some(v => String(v || '').toLowerCase().includes(q)));
    $('usCount').textContent = q ? t('u.countOf', { n: list.length, total: rows.length }) : t('u.count', { n: rows.length });
    $('usBody').innerHTML = list.map(r => {
      const id = String(r.id).trim(), self = sameId(id, me);
      return `<tr class="${editId && sameId(id, editId) ? 'editing' : ''}">
        <td class="num">${s(id)}</td>
        <td><span class="u-name"><span class="u-av">${s(String(r.username || '?').trim().charAt(0).toUpperCase())}</span>${s(r.username)}</span></td>
        <td><span class="pill ${r.role === 'Admin' ? 'admin' : 'user'}">${s(r.role)}</span></td>
        <td>${r.dept ? `<span class="pill dept">${s(r.dept)}</span>` : `<span class="meta">${esc(t('u.noDept'))}</span>`}</td>
        <td class="meta">${s(r.regBy)} · ${fmtDate(r.regDate)}</td>
        <td class="meta">${s(r.updateBy)} · ${fmtDate(r.updateDate)}</td>
        <td>${canEdit || canDel ? `<div class="row-actions">
          ${canEdit ? `<button class="icon-btn" data-edit="${s(id)}">${ico('pencil')}${T('b.edit')}</button>` : ''}
          ${canDel && !self ? `<button class="icon-btn del" data-del="${s(id)}">${ico('trash')}${T('b.delete')}</button>` : ''}
        </div>` : ''}</td></tr>`;
    }).join('') || `<tr><td colspan="7" class="empty-row">${esc(t('u.none'))}</td></tr>`;
  }

  function setRows(list) {
    rows = list;
    const depts = [...new Set(['QC', ...rows.map(r => String(r.dept || '').trim()).filter(Boolean)])].sort();
    $('usDepts').innerHTML = depts.map(d => `<option value="${s(d)}">`).join('');
    draw();
  }
  async function load() {
    try { setRows(await api('GET', '/api/users')); } catch (err) { msg(err.message); }
  }

  $('usBody').onclick = async e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) {
      const r = rows.find(x => sameId(x.id, ed.dataset.edit));
      if (!r) return;
      editId = String(r.id).trim();
      $('usForm').hidden = false;
      $('usId').value = editId; $('usId').disabled = true;
      $('usName').value = String(r.username || '').trim();
      $('usPass').value = '';
      $('usRole').value = r.role === 'Admin' ? 'Admin' : 'User';
      $('usDept').value = String(r.dept || '').trim();
      setPassHint();
      $('usSubmit').innerHTML = ico('save') + T('b.save');
      $('usCancel').hidden = false;
      panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
      msg(t('u.editing', { id: editId, name: String(r.username || '').trim() }), 'ok');
      draw();
      $('usName').focus();
    }
    if (del) {
      const r = rows.find(x => sameId(x.id, del.dataset.del));
      if (!r) return;
      const id = String(r.id).trim(), name = String(r.username || '').trim();
      if (!await uiConfirm({ tone: 'danger', icon: '🗑️', title: t('u.delT'),
        message: t('u.delM', { id: esc(id), name: esc(name) }), ok: t('b.delete'), cancel: t('b.keep') })) return;
      try {
        setRows(await api('DELETE', `/api/users/${encodeURIComponent(id)}`));
        if (sameId(editId, id)) resetForm();
        msg(t('u.deleted', { id, name }), 'ok');
      } catch (err) { msg(err.message); }
    }
  };

  $('usForm').onsubmit = async e => {
    e.preventDefault();
    panel.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
    const bad = (field, key) => { $(field).classList.add('bad'); $(field).focus(); msg(t(key)); };
    const body = { id: $('usId').value.trim(), username: $('usName').value.trim(), password: $('usPass').value,
      role: $('usRole').value, dept: $('usDept').value.trim() };
    if (!editId && !/^[A-Za-z0-9._-]{1,10}$/.test(body.id)) return bad('usId', 'u.errId');
    if (!body.username) return bad('usName', 'u.errName');
    if (!editId && !body.password) return bad('usPass', 'u.errPass');

    $('usSubmit').disabled = true;
    try {
      if (editId) setRows(await api('PUT', `/api/users/${encodeURIComponent(editId)}`, body));
      else setRows(await api('POST', '/api/users', body));
      msg(t(editId ? 'u.saved' : 'u.added', { id: editId || body.id, name: body.username }), 'ok');
      // Changing your own role or department changes what you may do, so reload to get the new permissions
      if (editId && sameId(editId, me)) { setTimeout(() => location.reload(), 900); return; }
      resetForm();
      $('usId').focus();
    } catch (err) {
      if (/already exists|^ID\b/i.test(err.message)) $('usId').classList.add('bad');
      msg(err.message);
    } finally { $('usSubmit').disabled = false; }
  };

  $('usSearch').addEventListener('input', draw);
  langHook = () => { draw(); setPassHint(); };
  setPassHint();
  load();
}
