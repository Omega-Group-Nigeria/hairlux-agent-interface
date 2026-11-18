/**
 * Home: today against the targets, what today will earn, this week and month,
 * monthly bonus progress, the wallet, recent days, and a quick form for the
 * engagements and downloads the agent reports themselves.
 */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc, ngn = UI.ngn, num = UI.num;
  var box = $('#content');
  var DAY = {
    OPEN: { label: 'Today', cls: '' },
    NOT_QUALIFIED: { label: 'Target not met', cls: '' },
    AWAITING_APPROVAL: { label: 'Waiting for approval', cls: 'warn' },
    APPROVED: { label: 'Earned', cls: 'ok' },
    REJECTED: { label: 'Not approved', cls: 'bad' },
  };

  async function load() {
    var m = await UI.me({ active: true });
    $('#page-title').textContent = 'Hello, ' + m.firstName;
    var d = await AgentApi.request('/agent/dashboard');
    var t = d.today, c = t.counts, tg = d.targets, mo = d.month, w = d.wallet;

    var hero = '<div class="card earn-hero"><div>' +
      '<div class="muted small">Today, ' + esc(UI.day(t.day)) + '</div>' +
      (t.qualified && t.expectedEarning > 0
        ? '<div class="big">' + ngn(t.expectedEarning) + ' earned</div><p class="muted mb-0">You met today\'s target. It goes into your wallet when the day closes, and you can withdraw it 24 hours later.</p>'
        : '<div class="big">Earn ' + ngn(d.dailyEarningAmount) + ' today</div><p class="muted mb-0">Bring in ' + tg.qualifyRegistrations + ' verified sign-ups and ' + tg.qualifyPaidBookings + ' paid bookings today.</p>') +
      (d.alerts.length ? '<div class="mt-3"><span class="pill">' + esc(d.alerts[0]) + '</span></div>' : '') +
      '</div><div><div class="muted small">Wallet</div><div class="big">' + ngn(w.available) + '</div>' +
      '<div class="muted small">' + ngn(w.pending) + ' pending</div>' +
      '<a class="btn btn-gold btn-sm mt-3" href="wallet.html">Withdraw</a></div></div>';

    var todayCard = '<div class="card"><div class="card-head"><h2>Today\'s targets</h2><a class="small" href="refer.html">Share your code</a></div>' +
      '<div class="grid-2">' +
      '<div>' + UI.bar('Verified sign-ups (counts for pay)', c.registrations, tg.registrations) + UI.bar('Paid bookings (counts for pay)', c.paidBookings, tg.paidBookings) + '</div>' +
      '<div>' + UI.bar('Leads logged', c.leads, tg.leads) + UI.bar('Customers spoken to', c.engagements, tg.engagements) + '</div>' +
      '</div>' +
      '<form class="row mt-2" id="activity" novalidate>' +
      '<div class="small muted grow" style="min-width:200px">Record the people you spoke to and the app downloads you helped with today. These show in your results but do not decide your pay.</div>' +
      '<input class="input" style="width:120px" type="number" min="0" id="a-eng" placeholder="Spoke to" aria-label="Customers spoken to" value="' + (c.engagements || '') + '">' +
      '<input class="input" style="width:120px" type="number" min="0" id="a-dl" placeholder="Downloads" aria-label="App downloads" value="' + (c.downloads || '') + '">' +
      '<button class="btn btn-dark btn-sm" id="a-save" data-busy="Saving">Save</button></form></div>';

    var levels = mo.bonusLevels.map(function (l) {
      return '<div class="level' + (l.reached ? ' reached' : '') + '"><strong>' + ngn(l.amount) + '</strong>' + (l.reached ? 'Reached' : 'at ' + l.bookings + ' paid bookings') + '</div>';
    }).join('');
    var monthCard = '<div class="card"><div class="card-head"><h2>This month</h2><a class="small" href="results.html?period=month">See every day</a></div>' +
      UI.bar('Paid bookings this month', mo.counts.paidBookings, mo.paidBookingsTarget, mo.paidBookingsProgress) +
      (mo.nextBonus ? '<p class="small"><strong>' + mo.nextBonus.bookingsToGo + ' more paid booking' + (mo.nextBonus.bookingsToGo === 1 ? '' : 's') + '</strong> to your ' + ngn(mo.nextBonus.amount) + ' bonus.</p>' : '<p class="small">You have reached every bonus level this month.</p>') +
      (levels ? '<div class="levels mb-3">' + levels + '</div>' : '') +
      '<div class="stats"><div class="stat"><div class="n">' + ngn(mo.earned.daily) + '</div><div class="l">Daily earnings</div></div>' +
      '<div class="stat"><div class="n">' + ngn(mo.earned.bonuses) + '</div><div class="l">Bonuses</div></div>' +
      '<div class="stat"><div class="n">' + ngn(mo.earned.incentives) + '</div><div class="l">Incentives</div></div>' +
      '<div class="stat"><div class="n">' + num(mo.counts.registrations) + '</div><div class="l">Sign-ups this month</div></div></div></div>';

    var wk = d.week.counts;
    var weekCard = '<div class="card"><div class="card-head"><h2>This week</h2><a class="small" href="results.html">See every day</a></div>' +
      '<div class="stats"><div class="stat"><div class="n">' + num(wk.registrations) + '</div><div class="l">Sign-ups</div></div>' +
      '<div class="stat"><div class="n">' + num(wk.paidBookings) + '</div><div class="l">Paid bookings</div></div>' +
      '<div class="stat"><div class="n">' + num(wk.leads) + '</div><div class="l">Leads</div></div>' +
      '<div class="stat"><div class="n">' + num(wk.engagements) + '</div><div class="l">Spoke to</div></div></div></div>';

    var days = d.recentDays.length ? '<div class="table-wrap"><table class="otable"><thead><tr><th>Day</th><th class="num">Sign-ups</th><th class="num">Paid bookings</th><th>Result</th><th class="num">Earning</th></tr></thead><tbody>' +
      d.recentDays.map(function (r) {
        return '<tr><td>' + esc(UI.day(r.day)) + '</td><td class="num">' + r.registrations + '</td><td class="num">' + r.paidBookings + '</td><td>' + UI.badge(DAY, r.status) + '</td><td class="num">' + (r.earning ? ngn(r.earning) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted mb-0">Your days show here once they close (just after midnight).</p>';

    box.innerHTML = hero + todayCard + '<div class="grid-2 gap">' + monthCard + weekCard + '</div><div class="card"><div class="card-head"><h2>Recent days</h2></div>' + days + '</div>';

    $('#activity').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('#a-save');
      UI.busy(btn, async function () {
        try {
          await AgentApi.request('/agent/activity', { method: 'POST', json: { engagements: Number($('#a-eng').value || 0), downloads: Number($('#a-dl').value || 0) } });
          UI.toast('Saved.', 'ok');
          load();
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    });
  }

  try { await load(); } catch (e) { if (e.message !== 'redirecting') box.innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
})();
