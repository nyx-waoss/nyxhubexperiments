(() => {
  const I = window.Intel;
  const FLAG = 'dash-intel-connected', PROFILE = 'dash-sync-profile';
  let client = null, token = null, exp = 0, pending = null;
  const have = () => token && Date.now() < exp - 60000;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const hint = () => { try { return (JSON.parse(localStorage.getItem(PROFILE)) || {}).email; } catch (e) { return null; } };

  function waitGsi() {
    return new Promise((res, rej) => {
      const t0 = Date.now();
      const t = setInterval(() => {
        if (window.google && google.accounts && google.accounts.oauth2) { clearInterval(t); res(); }
        else if (Date.now() - t0 > 20000) { clearInterval(t); rej(new Error('Google no cargó')); }
      }, 200);
    });
  }
  async function init() {
    if (client) return;
    await waitGsi();
    client = google.accounts.oauth2.initTokenClient({
      client_id: I.config.CLIENT_ID,
      scope: I.config.SCOPES,
      callback: r => {
        const p = pending; pending = null;
        if (r.error) return p && p.rej(r);
        token = r.access_token; exp = Date.now() + r.expires_in * 1000;
        const all = google.accounts.oauth2.hasGrantedAllScopes(r, ...I.config.SCOPES.split(' '));
        p && p.res({ allScopes: all });
      },
      error_callback: e => { const p = pending; pending = null; p && p.rej(e); }
    });
  }
  function request(prompt) {
    return new Promise((res, rej) => {
      pending = { res, rej };
      const cfg = { prompt };
      const h = hint(); if (prompt === '' && h) cfg.login_hint = h;
      client.requestAccessToken(cfg);
    });
  }

  async function api(url, tries = 3) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      const t = await G.token();
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
      if (r.status === 401) { token = null; continue; }
      if (r.status === 429 || r.status >= 500) { await sleep(800 * 2 ** i); continue; }
      if (!r.ok) {
        const e = new Error('HTTP ' + r.status); e.status = r.status;
        e.body = await r.text().catch(() => ''); throw e;
      }
      return r.json();
    }
    throw lastErr || new Error('Reintentos agotados');
  }
  async function paged(url, key, maxPages = 5) {
    let out = [], pt = '', n = 0;
    do {
      const u = url + (pt ? (url.includes('?') ? '&' : '?') + 'pageToken=' + encodeURIComponent(pt) : '');
      const j = await api(u);
      out = out.concat(j[key] || []);
      pt = j.nextPageToken; n++;
    } while (pt && n < maxPages);
    return out;
  }

  const G = I.google = {
    isConnected: () => localStorage.getItem(FLAG) === '1',
    account: () => localStorage.getItem('dash-intel-account') || '',
    async connect() {                         // llamar SOLO desde un click del usuario
      await init();
      const r = await request('consent');
      localStorage.setItem(FLAG, '1');
      return r;
    },
    async token() {
      if (have()) return token;
      await init();
      await request('');                      // refresco silencioso (puede pedir click si el navegador bloquea el popup)
      return token;
    },
    disconnect() {
      token = null; exp = 0;
      localStorage.removeItem(FLAG);
      localStorage.removeItem('dash-intel-account');
      I.store.clearCache();
    },
    api, paged
  };
})();