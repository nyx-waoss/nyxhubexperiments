(() => {
  const I = window.Intel;
  const CK = 'dash-intel-cache-v1', SK = 'dash-intel-stats-v1';
  const rd = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  I.store = {
    cache: () => rd(CK, null),
    saveCache: c => wr(CK, c),
    clearCache: () => { try { localStorage.removeItem(CK); } catch (e) {} },

    stats: () => rd(SK, {}),
    bump(keys, field) {
      const s = rd(SK, {});
      for (const k of keys) { s[k] = s[k] || { acc: 0, dis: 0 }; s[k][field]++; }
      wr(SK, s);
    },

    intel() {
      const st = DashApp.getState();
      st.intel = st.intel || {};
      for (const k of ['dismissed', 'accepted', 'snoozed', 'courseMap']) st.intel[k] = st.intel[k] || {};
      return st.intel;
    },
    commit() { DashApp.save(); }
  };
})();