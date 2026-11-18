/**
 * Hairlux Agent portal: shared page helpers, the signed-in app shell (top bar
 * on desktop, bottom bar on phones) and the account gate (an agent who is
 * still being reviewed, or has new terms to accept, goes to the status page).
 */
var UI = (function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ngn(n) {
    if (n === null || n === undefined || n === '') return '-';
    var v = Number(n);
    var d = v % 1 ? 2 : 0;
    return (v < 0 ? '-' : '') + '₦' + Math.abs(v).toLocaleString('en-NG', { minimumFractionDigits: d, maximumFractionDigits: 2 });
  }
  function num(n) { return Number(n || 0).toLocaleString('en-NG'); }
  function date(v) { return v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
  function dateTime(v) { return v ? new Date(v).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
  /** A YYYY-MM-DD day, e.g. "Tue 17 Nov". */
  function day(d) { return d ? new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '-'; }
  /** Today in Lagos (UTC+1), YYYY-MM-DD. */
  function today() { return new Date(Date.now() + 3600000).toISOString().slice(0, 10); }

  function toast(msg, kind) {
    var wrap = $('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); document.body.appendChild(wrap); }
    var t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, kind === 'bad' ? 7000 : 4000);
  }

  /** Disable a button and show a spinner while fn runs. */
  async function busy(btn, fn) {
    var html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>' + esc(btn.dataset.busy || 'Please wait');
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
  }

  function badge(map, key) {
    var m = map[key] || { label: key, cls: '' };
    return '<span class="badge ' + m.cls + '">' + esc(m.label) + '</span>';
  }
  /** A progress bar with "value of target" above it. */
  function bar(label, value, target, pct) {
    var p = pct === undefined ? (target > 0 ? Math.round(value / target * 100) : 100) : pct;
    return '<div class="meter"><div class="row between"><span class="meter-label">' + esc(label) + '</span><span class="meter-n"><strong>' + num(value) + '</strong> / ' + num(target) + '</span></div>' +
      '<div class="progress' + (p >= 100 ? ' done' : '') + '"><div style="width:' + Math.min(100, p) + '%"></div></div></div>';
  }

  var AGENT_STATUS = {
    PENDING: { label: 'Under review', cls: 'warn' },
    APPROVED: { label: 'Approved', cls: 'ok' },
    ACTIVE: { label: 'Active', cls: 'ok' },
    SUSPENDED: { label: 'Suspended', cls: 'bad' },
    REJECTED: { label: 'Not approved', cls: 'bad' },
    DEACTIVATED: { label: 'Closed', cls: 'bad' },
  };

  var NAV = [
    { href: 'dashboard.html', label: 'Home' },
    { href: 'leads.html', label: 'Leads' },
    { href: 'customers.html', label: 'Customers' },
    { href: 'results.html', label: 'Results' },
    { href: 'wallet.html', label: 'Wallet' },
    { href: 'refer.html', label: 'My code' },
    { href: 'profile.html', label: 'Profile' },
  ];

  /** Signed-in pages: redirect to sign in if needed, then draw the top and bottom bars. */
  function shell() {
    if (!AgentApi.signedIn()) {
      var here = location.pathname.split('/').pop() || 'dashboard.html';
      location.replace('log-in.html?next=' + encodeURIComponent(here + location.search));
      return false;
    }
    var page = location.pathname.split('/').pop() || 'dashboard.html';
    var u = AgentApi.user() || {};
    var links = NAV.map(function (n) { return '<a href="' + n.href + '"' + (n.href === page ? ' class="active" aria-current="page"' : '') + '>' + esc(n.label) + '</a>'; }).join('');
    var top = document.createElement('header');
    top.className = 'topbar';
    top.innerHTML = '<div class="inner"><a class="brand" href="dashboard.html"><img src="assets/img/logo-side-white.webp" alt="Hairlux"><span>Agents</span></a>' +
      '<nav class="topnav" aria-label="Main">' + links + '</nav>' +
      '<div class="who"><a class="bell" href="notifications.html" aria-label="Notifications" title="Notifications">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/></svg>' +
      '<span class="dot hidden" id="bell-count"></span></a>' +
      '<span class="name">' + esc([u.firstName, u.lastName].filter(Boolean).join(' ')) + '</span><button class="btn btn-outline btn-sm" id="btn-signout">Sign out</button></div></div>';
    document.body.prepend(top);
    var bottom = document.createElement('nav');
    bottom.className = 'bottomnav';
    bottom.setAttribute('aria-label', 'Main');
    bottom.innerHTML = links;
    document.body.appendChild(bottom);
    $('#btn-signout').addEventListener('click', AgentApi.signOut);
    AgentApi.request('/agent/notifications?unread=true&limit=1').then(function (r) {
      var n = (r.meta && r.meta.unread) || 0;
      var el = $('#bell-count');
      if (el && n) { el.textContent = n > 9 ? '9+' : n; el.classList.remove('hidden'); }
    }).catch(function () { /* the bell just shows no count */ });
    return true;
  }

  /**
   * The agent's account (cached for the visit). Pages that need a working
   * agent call it with { active: true }: anyone not ACTIVE, or with new terms
   * to accept, is sent to the status page.
   */
  async function me(opts) {
    opts = opts || {};
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem('hxa_me') || 'null'); } catch (e) { cached = null; }
    var m = (!opts.fresh && cached) ? cached : await AgentApi.request('/agent/me');
    try { sessionStorage.setItem('hxa_me', JSON.stringify(m)); } catch (e) { /* private mode */ }
    if (opts.active && (m.status !== 'ACTIVE' || m.needsTerms)) {
      location.replace('status.html');
      throw new Error('redirecting');
    }
    return m;
  }
  function forgetMe() { try { sessionStorage.removeItem('hxa_me'); } catch (e) { /* private mode */ } }

  function params() { return new URLSearchParams(location.search); }

  /** Only same-site relative pages are followed after sign-in. */
  function safeNext(fallback) {
    var n = params().get('next') || '';
    return /^[a-z0-9\-]+\.html(\?[^#]*)?$/i.test(n) ? n : fallback;
  }

  /** A simple dialog: open(html) returns the dialog element; close() hides it. */
  function dialog(title, html) {
    var d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = '<form method="dialog" class="dialog-head"><h3>' + esc(title) + '</h3><button class="btn btn-link" aria-label="Close" value="close">&times;</button></form><div class="dialog-body">' + html + '</div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    return d;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copied.', 'ok'); }
    catch (e) { window.prompt('Copy this:', text); }
  }

  return {
    $: $, $all: $all, esc: esc, ngn: ngn, num: num, date: date, dateTime: dateTime, day: day, today: today, toast: toast, busy: busy,
    badge: badge, bar: bar, AGENT_STATUS: AGENT_STATUS, shell: shell, me: me, forgetMe: forgetMe, params: params, safeNext: safeNext,
    dialog: dialog, copy: copy,
  };
})();

// Installable app: register the service worker (pages still work without it).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ }); });
}
