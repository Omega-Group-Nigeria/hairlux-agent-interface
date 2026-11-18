/** Notifications from Hairlux: approvals, targets met, earnings, bonuses, withdrawals and announcements. */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var page = 1;
  var rows = [];
  var LINKS = {
    'agent.withdrawal': 'wallet.html', 'agent.released': 'wallet.html', 'agent.bonus': 'wallet.html', 'agent.incentive': 'wallet.html',
    'agent.target_met': 'results.html', 'agent.earning_approved': 'results.html', 'agent.earning_rejected': 'results.html',
    'agent.paid_booking': 'customers.html', 'agent.account': 'status.html', 'agent.bank': 'profile.html',
  };

  async function load(more) {
    if (!more) { page = 1; rows = []; }
    try {
      var r = await AgentApi.request('/agent/notifications?page=' + page + '&limit=20');
      rows = rows.concat(r.data);
      $('#unread').textContent = r.meta.unread ? r.meta.unread + ' unread' : 'All read';
      $('#btn-read').disabled = !r.meta.unread;
      $('#list').innerHTML = rows.length ? '<div class="list">' + rows.map(function (n) {
        var link = LINKS[n.type];
        return '<div class="item' + (n.isRead ? '' : ' unread') + '"><div class="top"><div class="name">' + esc(n.title) + '</div><span class="small muted">' + UI.dateTime(n.createdAt) + '</span></div>' +
          '<div class="small" style="white-space:pre-line">' + esc(n.body) + '</div>' + (link ? '<div><a class="small" href="' + link + '">Open</a></div>' : '') + '</div>';
      }).join('') + '</div>' : '<div class="empty"><h3>Nothing yet</h3><p>Messages from Hairlux about your account, earnings and withdrawals show here.</p></div>';
      $('#btn-more').classList.toggle('hidden', r.meta.page >= r.meta.totalPages);
    } catch (e) { $('#list').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  }

  $('#btn-read').addEventListener('click', async function () {
    try {
      await AgentApi.request('/agent/notifications/read', { method: 'POST', json: {} });
      var b = $('#bell-count'); if (b) b.classList.add('hidden');
      load();
    } catch (e) { UI.toast(e.message, 'bad'); }
  });
  $('#btn-more').addEventListener('click', function () { page++; load(true); });
  load();
})();
