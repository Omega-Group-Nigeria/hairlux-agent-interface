/**
 * Wallet: available and pending money, what it is made of, withdraw (amount
 * plus the last 4 digits of the bank account on file), withdrawals with their
 * status, and the full history.
 */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc, ngn = UI.ngn;
  var WD = {
    PENDING: { label: 'Waiting for approval', cls: 'warn' },
    APPROVED: { label: 'Approved, being paid', cls: 'gold' },
    PROCESSING: { label: 'Being paid', cls: 'gold' },
    PAID: { label: 'Paid', cls: 'ok' },
    FAILED: { label: 'Failed, money returned', cls: 'bad' },
    REJECTED: { label: 'Not approved, money returned', cls: 'bad' },
    CANCELLED: { label: 'Cancelled', cls: '' },
  };
  var ENTRY = {
    DAILY_EARNING: 'Daily earning', MONTHLY_BONUS: 'Monthly bonus', INCENTIVE: 'Incentive', WITHDRAWAL: 'Withdrawal',
    WITHDRAWAL_REVERSAL: 'Withdrawal returned', ADJUSTMENT: 'Adjustment',
  };
  var me = null;
  var page = 1;
  var entries = [];
  var balance = null;
  var rules = null;

  async function loadSummary() {
    balance = await AgentApi.request('/agent/wallet');
    var b = balance;
    var canWithdraw = me.status === 'ACTIVE' && !me.needsTerms;
    $('#summary').innerHTML = '<div class="card earn-hero"><div><div class="muted small">Available to withdraw</div><div class="big">' + ngn(b.available) + '</div>' +
      '<p class="muted mb-0">' + ngn(b.pending) + ' pending: earnings can be withdrawn 24 hours after the day ends.' + (b.inWithdrawal ? ' ' + ngn(b.inWithdrawal) + ' is in a withdrawal now.' : '') + '</p></div>' +
      '<div>' + (canWithdraw ? '<button class="btn btn-gold" id="btn-withdraw"' + (b.available > 0 ? '' : ' disabled') + '>Withdraw</button>' : '') + '</div></div>' +
      '<div class="card"><div class="stats">' +
      '<div class="stat"><div class="n">' + ngn(b.dailyEarnings) + '</div><div class="l">Daily earnings (all time)</div></div>' +
      '<div class="stat"><div class="n">' + ngn(b.monthlyBonuses) + '</div><div class="l">Monthly bonuses</div></div>' +
      '<div class="stat"><div class="n">' + ngn(b.incentives) + '</div><div class="l">Incentives</div></div>' +
      '<div class="stat"><div class="n">' + ngn(b.totalWithdrawn) + '</div><div class="l">Total withdrawn</div></div></div>' +
      (me.withdrawalsLocked ? '<div class="alert warn mt-3 mb-0"><strong>Withdrawals are on hold</strong>Contact Hairlux to find out why.</div>' : '') +
      (!me.bank ? '<div class="alert info mt-3 mb-0"><strong>Add your bank account</strong>You need it to withdraw. <a href="profile.html#bank">Add it now</a></div>' : '') + '</div>';
    var btn = $('#btn-withdraw');
    if (btn) btn.addEventListener('click', withdraw);
  }

  async function loadWithdrawals() {
    var r = await AgentApi.request('/agent/withdrawals?limit=20');
    $('#withdrawals').innerHTML = r.data.length ? '<div class="table-wrap"><table class="otable"><thead><tr><th>Date</th><th class="num">Amount</th><th class="num">Sent to bank</th><th>Status</th><th></th></tr></thead><tbody>' +
      r.data.map(function (w) {
        return '<tr><td>' + UI.dateTime(w.createdAt) + '<div class="small muted mono">' + esc(w.reference) + '</div></td>' +
          '<td class="num">' + ngn(w.amount) + (w.fee ? '<div class="small muted">' + ngn(w.fee) + ' charge</div>' : '') + '</td>' +
          '<td class="num">' + ngn(w.netAmount) + '<div class="small muted">' + esc(w.bankName || '') + ' ' + esc(w.accountNumber) + '</div></td>' +
          '<td>' + UI.badge(WD, w.status) + (w.rejectedReason ? '<div class="small muted">' + esc(w.rejectedReason) + '</div>' : '') + (w.failureReason ? '<div class="small muted">' + esc(w.failureReason) + '</div>' : '') + '</td>' +
          '<td class="num">' + (w.status === 'PENDING' ? '<button class="btn btn-outline btn-sm" data-cancel="' + esc(w.id) + '">Cancel</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted mb-0">No withdrawals yet.</p>';
  }

  async function loadLedger(more) {
    if (!more) { page = 1; entries = []; }
    var r = await AgentApi.request('/agent/wallet/transactions?page=' + page + '&limit=20');
    entries = entries.concat(r.data);
    $('#ledger').innerHTML = entries.length ? '<div class="table-wrap"><table class="otable"><thead><tr><th>Date</th><th>What</th><th class="num">Amount</th><th>Can withdraw</th></tr></thead><tbody>' +
      entries.map(function (e) {
        return '<tr><td>' + UI.dateTime(e.createdAt) + '</td><td><strong>' + esc(ENTRY[e.type] || e.type) + '</strong><div class="small muted">' + esc(e.note || '') + ' <span class="mono">' + esc(e.reference) + '</span></div></td>' +
          '<td class="num money' + (e.amount < 0 ? ' neg' : '') + '">' + ngn(e.amount) + '</td><td class="small">' + (e.amount < 0 ? '' : e.isAvailable ? 'Yes' : 'From ' + UI.dateTime(e.availableAt)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="muted mb-0">Your earnings, bonuses and withdrawals show here.</p>';
    $('#btn-more').classList.toggle('hidden', r.meta.page >= r.meta.totalPages);
  }

  function withdraw() {
    if (!me.bank) { location.href = 'profile.html#bank'; return; }
    var b = me.bank;
    var d = UI.dialog('Withdraw to your bank',
      '<form id="w-form" novalidate>' +
      '<p class="small muted">Available: <strong>' + ngn(balance.available) + '</strong>. The money goes to <strong>' + esc(b.bankName || '') + ' ' + esc(b.accountNumber) + '</strong> (' + esc(b.accountName) + ').</p>' +
      '<div class="field"><label for="w-amount">Amount</label><div class="input-group"><input class="input" id="w-amount" type="number" min="1" step="0.01" inputmode="decimal" value="' + Math.floor(balance.available) + '"><span class="addon">NGN</span></div>' +
      '<div class="hint" id="w-hint">' + (rules ? 'Minimum ' + ngn(rules.min) + (rules.fee ? '. A ' + ngn(rules.fee) + ' charge comes off each withdrawal.' : '.') +
        (rules.interval ? ' One withdrawal every ' + rules.interval + ' day' + (rules.interval === 1 ? '' : 's') + '.' : '') : '') + '</div></div>' +
      '<div class="field"><label for="w-last4">Confirm: last 4 digits of your account number</label><input class="input" id="w-last4" inputmode="numeric" maxlength="4" placeholder="e.g. 6789" autocomplete="off"></div>' +
      '<div class="error-text hidden" id="w-error"></div>' +
      '<div class="row end"><button class="btn btn-gold" id="w-go" data-busy="Sending">Withdraw</button></div></form>');
    $('#w-form', d).addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#w-error', d);
      err.classList.add('hidden');
      var amount = Number($('#w-amount', d).value);
      var last4 = $('#w-last4', d).value.trim();
      if (!(amount > 0)) { err.textContent = 'Enter an amount.'; err.classList.remove('hidden'); return; }
      if (amount > balance.available) { err.textContent = 'You can withdraw up to ' + ngn(balance.available) + '.'; err.classList.remove('hidden'); return; }
      if (!/^\d{4}$/.test(last4)) { err.textContent = 'Enter the last 4 digits of your account number.'; err.classList.remove('hidden'); return; }
      UI.busy($('#w-go', d), async function () {
        try {
          var w = await AgentApi.request('/agent/withdrawals', { method: 'POST', json: { amount: amount, confirmAccountLast4: last4 } });
          d.close();
          UI.toast(w.status === 'PENDING' ? 'Withdrawal requested. Hairlux will approve it shortly.' : 'Withdrawal on its way.', 'ok');
          refresh();
        } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      });
    });
  }

  async function refresh() {
    try { await Promise.all([loadSummary(), loadWithdrawals(), loadLedger()]); }
    catch (e) { $('#summary').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  }

  try { me = await UI.me({ fresh: true }); } catch (e) { $('#summary').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; return; }
  AgentApi.request('/public/agents/info', { anonymous: true }).then(function (i) {
    rules = { min: i.minWithdrawal, fee: i.withdrawalFee, interval: i.withdrawalIntervalDays };
  }).catch(function () { /* the hint stays empty; the API still checks */ });
  $('#withdrawals').addEventListener('click', async function (e) {
    var c = e.target.closest('[data-cancel]');
    if (!c || !confirm('Cancel this withdrawal? The money goes back to your wallet.')) return;
    try { await AgentApi.request('/agent/withdrawals/' + c.dataset.cancel + '/cancel', { method: 'POST' }); UI.toast('Withdrawal cancelled.', 'ok'); refresh(); }
    catch (ex) { UI.toast(ex.message, 'bad'); }
  });
  $('#btn-more').addEventListener('click', function () { page++; loadLedger(true).catch(function (e) { UI.toast(e.message, 'bad'); }); });
  refresh();
})();
