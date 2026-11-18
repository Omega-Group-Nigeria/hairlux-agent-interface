/**
 * Hairlux Agent portal: API client and session.
 * Agents sign in with their AGENT account (separate from any customer or
 * staff account on the same email). Tokens live in localStorage under hxa_*.
 */
var AgentApi = (function () {
  'use strict';

  var KEYS = { access: 'hxa_access_token', refresh: 'hxa_refresh_token', user: 'hxa_user' };
  var base = (window.AGENT_CONFIG && window.AGENT_CONFIG.API_BASE || '').replace(/\/+$/, '');
  var refreshing = null;

  function store(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function saveSession(data) {
    if (data.accessToken) store(KEYS.access, data.accessToken);
    if (data.refreshToken) store(KEYS.refresh, data.refreshToken);
    if (data.user) store(KEYS.user, JSON.stringify(data.user));
  }
  function clearSession() {
    store(KEYS.access, null); store(KEYS.refresh, null); store(KEYS.user, null);
    try { sessionStorage.removeItem('hxa_me'); } catch (e) { /* private mode */ }
  }
  function user() { try { return JSON.parse(read(KEYS.user) || 'null'); } catch (e) { return null; } }
  function signedIn() { return !!read(KEYS.access); }

  function message(raw, status) {
    var m = raw && raw.message;
    if (Array.isArray(m)) m = m.join('. ');
    return m || (status === 0 ? 'Could not reach Hairlux. Check your connection.' : 'Something went wrong (' + status + ').');
  }

  async function refresh() {
    var token = read(KEYS.refresh);
    if (!token) return false;
    if (!refreshing) {
      refreshing = fetch(base + '/auth/refresh-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }),
      }).then(async function (r) {
        if (!r.ok) return false;
        var raw = await r.json().catch(function () { return {}; });
        saveSession(raw.data || raw);
        return true;
      }).catch(function () { return false; }).finally(function () { setTimeout(function () { refreshing = null; }, 0); });
    }
    return refreshing;
  }

  /**
   * request('/agent/me') or request('/agent/me', { method: 'PATCH', json: {...} })
   * or { method: 'POST', form: FormData }. Returns the response's data.
   */
  async function request(path, opts, retried) {
    opts = opts || {};
    var headers = {};
    var body;
    if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
    else if (opts.form) body = opts.form;
    var token = read(KEYS.access);
    if (token && !opts.anonymous) headers.Authorization = 'Bearer ' + token;
    var res;
    try {
      res = await fetch(base + path, { method: opts.method || 'GET', headers: headers, body: body });
    } catch (e) {
      throw new Error(message(null, 0));
    }
    if (res.status === 401 && !opts.anonymous && !retried) {
      if (await refresh()) return request(path, opts, true);
      clearSession();
      var here = location.pathname.split('/').pop() || 'index.html';
      location.href = 'log-in.html?next=' + encodeURIComponent(here + location.search);
      throw new Error('Please sign in again.');
    }
    var raw = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(message(raw, res.status));
      err.status = res.status;
      throw err;
    }
    return raw.data !== undefined ? raw.data : raw;
  }

  async function signOut() {
    var token = read(KEYS.refresh);
    if (token) { fetch(base + '/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + read(KEYS.access) }, body: JSON.stringify({ refreshToken: token }) }).catch(function () {}); }
    clearSession();
    location.href = 'log-in.html';
  }

  return { request: request, saveSession: saveSession, clearSession: clearSession, user: user, signedIn: signedIn, signOut: signOut };
})();
