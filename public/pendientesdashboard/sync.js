/* Sincronización con Google Drive. Primero local, la nube va en segundo plano.
   Guarda un solo archivo JSON en la carpeta oculta de la app (appDataFolder).
   Requiere window.DashApp (ver app.js). */
(() => {
  'use strict';
  const CLIENT_ID = '900038530821-8hr79gkg9jj7fvmbs6386obf3bljcsc8.apps.googleusercontent.com';
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
  const FILE = 'dashboard-tareas.json';
  const D = 'https://www.googleapis.com/drive/v3', U = 'https://www.googleapis.com/upload/drive/v3';
  const K = { profile: 'dash-sync-profile', file: 'dash-sync-file', last: 'dash-sync-last' };
  const ls = {
    get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const G = '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';

  const app = window.DashApp;
  if (!app) return;

  /* ============ Detección de cambios locales ============ */
  const sigOf = t => JSON.stringify({ ...t, updatedAt: undefined });
  let shadow = new Map(), shadowName = '';
  function resetShadow(st) {
    shadow = new Map(st.tasks.map(t => [t.id, sigOf(t)]));
    shadowName = st.name;
  }
  function stamp(st) {
    const now = Date.now(), seen = new Set();
    st.deleted = st.deleted || {};
    for (const t of st.tasks) {
      seen.add(t.id);
      const s = sigOf(t);
      if (shadow.get(t.id) !== s) { t.updatedAt = now; shadow.set(t.id, s); delete st.deleted[t.id]; }
    }
    for (const id of [...shadow.keys()]) if (!seen.has(id)) { st.deleted[id] = now; shadow.delete(id); }
    if (st.name !== shadowName) { st.nameAt = now; shadowName = st.name; }
  }

  /* ============ Mezcla (gana lo más reciente) ============ */
  const canon = s => JSON.stringify({ n: s.name, a: s.nameAt || 0, d: s.deleted || {}, t: [...s.tasks].sort((x, y) => x.id < y.id ? -1 : 1) },
    (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
  function merge(a, b) {
    const del = { ...((b && b.deleted) || {}) };
    for (const [id, ts] of Object.entries(a.deleted || {})) del[id] = Math.max(del[id] || 0, ts);
    const map = new Map();
    for (const t of [...((b && b.tasks) || []), ...a.tasks]) {
      const cur = map.get(t.id);
      if (!cur || (t.updatedAt || 0) >= (cur.updatedAt || 0)) map.set(t.id, t);
    }
    for (const [id, t] of [...map]) if (del[id] && del[id] >= (t.updatedAt || 0)) map.delete(id);
    const old = Date.now() - 60 * 864e5;
    for (const id of Object.keys(del)) if (del[id] < old) delete del[id];
    const useLocal = !b || (a.nameAt || 0) >= (b.nameAt || 0);
    return { version: 2, name: useLocal ? a.name : b.name, nameAt: useLocal ? a.nameAt || 0 : b.nameAt, tasks: [...map.values()], deleted: del };
  }

  /* ============ Google Identity y token ============ */
  let tokenClient = null, tok = null, tokExp = 0, pend = null, refT, armed = false;
  let profile = ls.get(K.profile), status = 'idle', busy = false, again = false, saveT;
  const haveToken = () => tok && Date.now() < tokExp - 60000;

  function loadGsi() {
    return new Promise(res => {
      if (window.google && google.accounts) return res();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = res; s.onerror = () => { s.remove(); window.addEventListener('online', () => loadGsi().then(res), { once: true }); };
      document.head.appendChild(s);
    });
  }
  function initClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES,
      callback: r => {
        const p = pend; pend = null;
        if (r.error) return p && p.rej(r);
        tok = r.access_token; tokExp = Date.now() + r.expires_in * 1000;
        clearTimeout(refT); refT = setTimeout(trySilent, Math.max(60e3, r.expires_in * 1000 - 300e3));
        p && p.res();
      },
      error_callback: e => { const p = pend; pend = null; p && p.rej(e); }
    });
  }
  function request(prompt) {
    if (!tokenClient) return Promise.reject({ type: 'not_ready' });
    return new Promise((res, rej) => {
      pend = { res, rej };
      const cfg = { prompt };
      if (prompt === '' && profile) cfg.login_hint = profile.email;
      tokenClient.requestAccessToken(cfg);
    });
  }
  function armGesture() {
    if (armed) return; armed = true;
    document.addEventListener('click', () => { armed = false; trySilent(); }, { once: true, capture: true });
  }
  function trySilent() {
    if (!profile || !tokenClient) return Promise.resolve();
    return request('').then(() => sync()).catch(() => { setStatus('reconnect'); armGesture(); });
  }

  async function signIn() {
    if (CLIENT_ID.startsWith('TU_')) return app.toast('fi-rr-exclamation', 'Falta configurar el Client ID en sync.js');
    if (!tokenClient) return app.toast('fi-rr-exclamation', 'Google aún no carga, intenta de nuevo');
    try {
      await request('select_account');
      const p = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok } })).json();
      if (profile && profile.email !== p.email) ls.del(K.file);
      profile = { name: p.name, email: p.email, picture: p.picture };
      ls.set(K.profile, profile); setStatus('idle'); sync();
    } catch (e) {
      if (e && e.type !== 'popup_closed') app.toast('fi-rr-exclamation', 'No se pudo iniciar sesión');
    }
  }
  function signOut() {
    try { if (tok) google.accounts.oauth2.revoke(tok, () => {}); } catch (e) {}
    tok = null; profile = null; clearTimeout(refT);
    ls.del(K.profile); ls.del(K.file); ls.del(K.last);
    closeMenu(); setStatus('idle');
    app.toast('fi-rr-sign-out-alt', 'Sesión cerrada. Tus datos siguen en este dispositivo');
  }

  /* ============ Google Drive ============ */
  async function api(url, opts = {}, retry = true) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + tok, ...(opts.headers || {}) } });
    if (r.status === 401 && retry) { tok = null; await request(''); return api(url, opts, false); }
    if (!r.ok) throw new Error('Drive ' + r.status);
    return r;
  }
  async function pull() {
    let id = ls.get(K.file);
    if (!id) {
      const q = encodeURIComponent(`name='${FILE}' and trashed=false`);
      const r = await (await api(`${D}/files?spaces=appDataFolder&q=${q}&fields=files(id)`)).json();
      id = r.files && r.files[0] && r.files[0].id;
      if (id) ls.set(K.file, id);
    }
    if (!id) return null;
    try { return { id, data: await (await api(`${D}/files/${id}?alt=media`)).json() }; }
    catch (e) { if (/404/.test(e.message)) { ls.del(K.file); return null; } throw e; }
  }
  async function push(data, id) {
    const body = JSON.stringify(data);
    if (id) return api(`${U}/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
    const b = 'dashboundary', meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
    const mp = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
    const r = await (await api(`${U}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: mp })).json();
    ls.set(K.file, r.id);
  }

  async function sync() {
    if (!profile) return;
    if (!navigator.onLine) return setStatus('offline');
    if (!haveToken()) return trySilent();
    if (busy) { again = true; return; }
    busy = true; setStatus('syncing');
    try {
      const remote = await pull();
      const local = app.getState();
      const merged = merge(local, remote && remote.data);
      const localChanged = canon(merged) !== canon(local);
      const remoteChanged = !remote || canon(merged) !== canon(remote.data);
      if (localChanged) {
        app.setState(merged); resetShadow(merged);
        if (remote) app.toast('fi-rr-refresh', 'Datos sincronizados');
      }
      if (remoteChanged) await push(merged, remote && remote.id);
      ls.set(K.last, Date.now()); setStatus('ok');
    } catch (e) {
      console.error('Sync:', e); setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      busy = false;
      if (again) { again = false; sync(); }
    }
  }
  function schedule() {
    if (!profile) return;
    clearTimeout(saveT); saveT = setTimeout(sync, 2500);
  }

  /* ============ Interfaz ============ */
  const btn = document.createElement('button');
  btn.id = 'syncBtn';
  const nio = document.getElementById('invokeNioBtn');
  nio ? nio.parentNode.insertBefore(btn, nio) : document.querySelector('.top').appendChild(btn);
  const menu = document.createElement('div');
  menu.id = 'syncMenu'; document.body.appendChild(menu);

  const ICON = { idle: 'fi-rr-check', ok: 'fi-rr-check', syncing: 'fi-rr-refresh', error: 'fi-rr-exclamation', reconnect: 'fi-rr-exclamation', offline: 'fi-rr-cloud' };
  const TEXT = { idle: 'Listo para sincronizar', ok: 'Todo sincronizado', syncing: 'Sincronizando...', error: 'No se pudo sincronizar', reconnect: 'Toca para reconectar con Google', offline: 'Sin conexión, se sincronizará después' };
  function setStatus(s) { status = s; renderBtn(); if (menu.classList.contains('open')) renderMenu(); }
  function renderBtn() {
    btn.className = 'btn secondary sync ' + (profile ? status : 'out');
    btn.innerHTML = profile
      ? `<img class="avatar" alt="" referrerpolicy="no-referrer" src="${profile.picture || ''}"><i class="fi ${ICON[status]} st"></i>`
      : `${G}<span>Iniciar sesión</span>`;
    btn.title = profile ? TEXT[status] : 'Inicia sesión con Google para sincronizar';
  }
  const ago = ts => {
    if (!ts) return 'nunca';
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : new Date(ts).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
  };
  function renderMenu() {
    menu.innerHTML = '';
    const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
    const who = mk('div', 'who');
    const img = mk('img'); img.src = profile.picture || ''; img.alt = ''; img.referrerPolicy = 'no-referrer';
    const info = mk('div'); info.append(mk('b', '', profile.name || 'Mi cuenta'), mk('small', '', profile.email));
    who.append(img, info);
    const st = mk('div', 'stat'); st.append(mk('i', 'fi ' + ICON[status]), mk('span', '', `${TEXT[status]}. Última vez: ${ago(ls.get(K.last))}`));
    const now = mk('button', 'btn ghost'); now.innerHTML = '<i class="fi fi-rr-refresh"></i><span>Sincronizar ahora</span>';
    now.onclick = () => { closeMenu(); haveToken() ? sync() : trySilent(); };
    const out = mk('button', 'btn danger'); out.innerHTML = '<i class="fi fi-rr-sign-out-alt"></i><span>Cerrar sesión</span>';
    out.onclick = signOut;
    menu.append(who, st, now, out);
  }
  function openMenu() {
    renderMenu();
    const r = btn.getBoundingClientRect();
    menu.style.top = r.bottom + 10 + 'px'; menu.style.right = Math.max(12, innerWidth - r.right) + 'px';
    menu.classList.add('open');
  }
  const closeMenu = () => menu.classList.remove('open');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (!profile) return signIn();
    if (status === 'reconnect') return trySilent();
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) closeMenu(); });

  /* ============ Arranque ============ */
  resetShadow(app.getState());
  renderBtn();
  loadGsi().then(() => { initClient(); if (profile) trySilent(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && profile) haveToken() ? sync() : trySilent(); });
  window.addEventListener('online', () => profile && sync());
  window.addEventListener('offline', () => profile && setStatus('offline'));
  setInterval(() => { if (!document.hidden && profile && haveToken()) sync(); }, 120000);

  window.DashSync = { stamp, schedule, sync };
})();