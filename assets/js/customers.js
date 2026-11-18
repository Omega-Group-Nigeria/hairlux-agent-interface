/** Customers credited to the agent, and whether their first paid booking has counted. */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var CUST = {
    REGISTERED: { label: 'Signed up, no paid booking yet', cls: 'warn' },
    QUALIFIED: { label: 'Paid booking counted', cls: 'ok' },
    DISQUALIFIED: { label: 'Does not count', cls: 'bad' },
  };
  var SOURCE = { CODE: 'Your code', LINK: 'Your link or QR', LEAD: 'Your lead', ADMIN: 'Added by Hairlux' };
  var page = 1;
  var rows = [];

  async function load(more) {
    if (!more) { page = 1; rows = []; }
    try {
      var r = await AgentApi.request('/agent/customers?page=' + page + '&limit=20');
      rows = rows.concat(r.data);
      $('#list').innerHTML = rows.length ? '<div class="list">' + rows.map(function (c) {
        return '<div class="item"><div class="top"><div><div class="name">' + esc(c.name) + '</div><div class="small muted">' + esc(c.phone || '') + ' · ' + esc(SOURCE[c.source] || c.source) + '</div></div>' +
          UI.badge(CUST, c.status) + '</div>' +
          '<div class="small muted">Signed up ' + UI.date(c.registeredAt) + (c.emailVerified ? '' : ' · <strong style="display:inline;color:var(--warn)">email not verified yet</strong> (they do not count until they verify)') +
          (c.qualifiedDay ? ' · Counted on ' + esc(UI.day(c.qualifiedDay)) : '') + '</div></div>';
      }).join('') + '</div>' : '<div class="empty"><h3>No customers yet</h3><p>Share your code, link or QR code. Customers who sign up with it appear here.</p><a class="btn btn-gold" href="refer.html">Get my code</a></div>';
      $('#btn-more').classList.toggle('hidden', r.meta.page >= r.meta.totalPages);
    } catch (e) { $('#list').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  }

  try { await UI.me({ active: true }); } catch (e) { return; }
  $('#btn-more').addEventListener('click', function () { page++; load(true); });
  load();
})();
