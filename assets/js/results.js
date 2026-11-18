/** Results: day-by-day counts and earnings for a day, week or month, against the targets. */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc, num = UI.num, ngn = UI.ngn;
  var DAY = {
    OPEN: { label: 'In progress', cls: '' },
    NOT_QUALIFIED: { label: 'Target not met', cls: '' },
    AWAITING_APPROVAL: { label: 'Waiting for approval', cls: 'warn' },
    APPROVED: { label: 'Earned', cls: 'ok' },
    REJECTED: { label: 'Not approved', cls: 'bad' },
  };
  var period = ['day', 'week', 'month'].indexOf(UI.params().get('period')) >= 0 ? UI.params().get('period') : 'week';
  var anchor = UI.today();
  var last = null;

  function shift(dir) {
    var d = new Date(anchor + 'T12:00:00Z');
    if (period === 'day') d.setUTCDate(d.getUTCDate() + dir);
    else if (period === 'week') d.setUTCDate(d.getUTCDate() + 7 * dir);
    else { d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + dir); }
    var next = d.toISOString().slice(0, 10);
    if (dir > 0 && next > UI.today() && (!last || last.to >= UI.today())) return;
    anchor = next > UI.today() ? UI.today() : next;
    load();
  }

  async function load() {
    $('#content').innerHTML = '<div class="loading"><span class="spinner"></span></div>';
    $('#periods').querySelectorAll('[data-period]').forEach(function (b) { b.classList.toggle('active', b.dataset.period === period); });
    try {
      var r = await AgentApi.request('/agent/performance?period=' + period + '&date=' + anchor);
      last = r;
      $('#range').textContent = r.from === r.to ? UI.day(r.from) : UI.day(r.from) + ' to ' + UI.day(r.to);
      $('#next').disabled = r.to >= UI.today();
      var t = r.totals, tg = r.targets || {};
      var n = r.days.length || 1;
      var earned = r.days.reduce(function (s, d) { return s + (d.status === 'APPROVED' ? d.earning : 0); }, 0);
      var qualified = r.days.filter(function (d) { return d.qualified; }).length;
      var html = '<div class="stats mb-3"><div class="stat"><div class="n">' + ngn(earned) + '</div><div class="l">Daily earnings</div></div>' +
        '<div class="stat"><div class="n">' + qualified + ' / ' + r.days.length + '</div><div class="l">Days target met</div></div>' +
        '<div class="stat"><div class="n">' + num(t.paidBookings) + '</div><div class="l">Paid bookings</div></div>' +
        '<div class="stat"><div class="n">' + (t.registrations ? Math.round(t.paidBookings / t.registrations * 100) : 0) + '%</div><div class="l">Sign-ups who booked</div></div></div>';
      html += '<div class="grid-2">' +
        '<div>' + UI.bar('Verified sign-ups', t.registrations, (tg.registrations || 0) * n) + UI.bar('Paid bookings', t.paidBookings, (tg.paidBookings || 0) * n) + '</div>' +
        '<div>' + UI.bar('Leads logged', t.leads, (tg.leads || 0) * n) + UI.bar('Customers spoken to', t.engagements, (tg.engagements || 0) * n) + '</div></div>';
      html += r.days.length ? '<div class="table-wrap mt-3"><table class="otable"><thead><tr><th>Day</th><th class="num">Sign-ups</th><th class="num">Paid bookings</th><th class="num">Leads</th><th class="num">Spoke to</th><th class="num">Downloads</th><th>Result</th><th class="num">Earning</th></tr></thead><tbody>' +
        r.days.slice().reverse().map(function (d) {
          return '<tr><td>' + esc(UI.day(d.day)) + '</td><td class="num">' + d.counts.registrations + '</td><td class="num">' + d.counts.paidBookings + '</td><td class="num">' + d.counts.leads + '</td>' +
            '<td class="num">' + d.counts.engagements + '</td><td class="num">' + d.counts.downloads + '</td><td>' + UI.badge(DAY, d.status) + '</td>' +
            '<td class="num">' + (d.earning ? ngn(d.earning) + (d.releaseAt && d.status === 'APPROVED' && new Date(d.releaseAt) > new Date() ? '<div class="small muted">from ' + UI.dateTime(d.releaseAt) + '</div>' : '') : '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="muted mt-3">Nothing to show for this period.</p>';
      html += '<p class="small muted mb-0">Pay is based on verified sign-ups and paid bookings only. Customers spoken to and downloads are what you recorded yourself.</p>';
      $('#content').innerHTML = html;
    } catch (e) { $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  }

  try { await UI.me({ active: true }); } catch (e) { return; }
  $('#periods').addEventListener('click', function (e) {
    var b = e.target.closest('[data-period]');
    if (!b) return;
    period = b.dataset.period;
    anchor = UI.today();
    load();
  });
  $('#prev').addEventListener('click', function () { shift(-1); });
  $('#next').addEventListener('click', function () { shift(1); });
  load();
})();
