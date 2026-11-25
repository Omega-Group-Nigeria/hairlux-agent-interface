/**
 * Profile: photo, contact details, address, emergency contact, the payout
 * bank account (name checked with Paystack), and the agent terms.
 * Works while the application is still being reviewed. Once approved, a new
 * photo, address or bank account waits for Hairlux to approve it.
 */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var me = null;
  var banks = null;

  function waiting(type) { return (me.pendingChanges || []).filter(function (c) { return c.type === type; })[0]; }

  /** A change waiting for Hairlux, with a button to withdraw it. */
  function waitingBox(c, what, current) {
    if (!c) return '';
    return '<div class="alert info mt-2"><strong>Waiting for Hairlux to approve</strong>' + what +
      '<div class="small muted mt-2">Sent ' + UI.dateTime(c.createdAt) + '. ' + current + ' ' +
      '<button class="btn-link small" type="button" data-cancel-change="' + esc(c.id) + '">Withdraw this change</button></div></div>';
  }

  function render() {
    var m = me;
    var approved = ['APPROVED', 'ACTIVE', 'SUSPENDED'].indexOf(m.status) >= 0;
    var wPhoto = waiting('PHOTO'), wAddress = waiting('ADDRESS'), wBank = waiting('BANK');
    $('#content').innerHTML =
      '<div class="card"><div class="card-head"><h2>You</h2>' + UI.badge(UI.AGENT_STATUS, m.status) + '</div>' +
      '<div class="photo-row mb-3">' + (m.photoUrl ? '<img class="avatar" src="' + esc(m.photoUrl) + '" alt="Your photo">' : '<div class="avatar">No photo</div>') +
      '<div><div class="name"><strong>' + esc(m.firstName + ' ' + m.lastName) + '</strong></div><div class="small muted">Agent ID ' + esc(m.agentNumber) + ' · Code ' + esc(m.referralCode) + '</div>' +
      '<label class="btn btn-outline btn-sm mt-2" for="photo">' + (m.photoUrl ? 'Change photo' : 'Add a photo') + '</label><input type="file" id="photo" accept="image/jpeg,image/png,image/webp" class="hidden">' +
      '<div class="small muted mt-2">A clear, recent photo of your face. JPG, PNG or WebP, up to 5 MB. Only you and Hairlux staff can see it.' +
      (approved && m.photoUrl ? ' A new photo is checked by Hairlux before it replaces this one.' : '') + '</div>' +
      waitingBox(wPhoto, wPhoto && wPhoto.photoUrl ? '<img class="avatar mt-2" src="' + esc(wPhoto.photoUrl) + '" alt="New photo">' : 'New photo', 'Your current photo stays until then.') +
      '</div></div>' +
      '<div class="kv"><div><div class="label">Email</div>' + esc(m.email) + '</div><div><div class="label">Phone</div>' + esc(m.phone || '-') + '</div>' +
      '<div><div class="label">Area</div>' + esc(m.territory) + (m.state ? ', ' + esc(m.state) : '') + ' <span class="small muted">(Hairlux changes this for you)</span></div></div>' +
      '<form id="p-form" novalidate><div class="field"><label for="p-address">Home address</label><input class="input" id="p-address" value="' + esc(m.address) + '">' +
      (approved ? '<div class="hint small muted">A new address is checked by Hairlux before it changes.</div>' : '') +
      waitingBox(wAddress, wAddress ? esc(wAddress.address) : '', 'Your current address stays until then.') + '</div>' +
      '<div class="grid-2"><div class="field"><label for="p-ec-name">Emergency contact</label><input class="input" id="p-ec-name" value="' + esc(m.emergencyContactName || '') + '"></div>' +
      '<div class="field"><label for="p-ec-phone">Their phone</label><input class="input" id="p-ec-phone" type="tel" value="' + esc(m.emergencyContactPhone || '') + '"></div></div>' +
      '<div class="row end"><button class="btn btn-dark btn-sm" id="p-save" data-busy="Saving">Save details</button></div></form></div>' +

      '<div class="card section" id="bank"><div class="card-head"><div><h2>Bank account</h2><p class="small muted mb-0">Your withdrawals are paid here. The account should be in your name.' +
      (approved && m.bank ? ' A new account is checked by Hairlux before withdrawals go to it.' : '') + '</p></div></div>' +
      waitingBox(wBank, wBank && wBank.bank ? esc(wBank.bank.bankName || '') + ' ' + esc(wBank.bank.accountNumber) + ' (' + esc(wBank.bank.accountName) + ')' + (wBank.bank.nameMatches ? '' : '<div class="small">The name is different from yours, so Hairlux will check it.</div>') : '', 'Withdrawals keep going to your current account until then.') +
      (m.bank ? '<div class="bank-row"><div class="acct"><strong>' + esc(m.bank.bankName || m.bank.bankCode) + '</strong> ' + esc(m.bank.accountNumber) + '<div class="small muted">' + esc(m.bank.accountName) + '</div></div>' +
        (m.bank.verified ? '<span class="badge ok">Checked</span>' : '') + '</div>' : '') +
      '<form id="b-form" novalidate><div class="grid-2"><div class="field"><label for="b-bank">Bank</label><select class="input" id="b-bank"><option value="">Loading banks...</option></select></div>' +
      '<div class="field"><label for="b-acct">Account number</label><input class="input" id="b-acct" inputmode="numeric" maxlength="10" placeholder="10 digits"></div></div>' +
      '<div class="resolved hidden" id="b-name"></div><div class="error-text hidden" id="b-error"></div>' +
      '<div class="row end"><button class="btn btn-gold btn-sm" id="b-save" data-busy="Checking" disabled>' + (m.bank ? 'Change bank account' : 'Save bank account') + '</button></div></form></div>' +

      '<div class="card"><div class="card-head"><h2>Agent terms</h2>' + (m.termsAcceptedAt ? '<span class="small muted">Accepted ' + UI.date(m.termsAcceptedAt) + ' (version ' + esc(m.termsVersion) + ')</span>' : '') + '</div>' +
      '<details><summary class="small" style="cursor:pointer">Read the terms</summary><div class="terms mt-3" id="terms-text">Loading...</div></details></div>';

    $('#photo').addEventListener('change', uploadPhoto);
    UI.$all('[data-cancel-change]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        try {
          await AgentApi.request('/agent/change-requests/' + b.dataset.cancelChange + '/cancel', { method: 'POST' });
          me = await UI.me({ fresh: true });
          render();
          UI.toast('Change withdrawn.', 'ok');
        } catch (ex) { b.disabled = false; UI.toast(ex.message, 'bad'); }
      });
    });
    $('#p-form').addEventListener('submit', saveDetails);
    wireBank();
    $('details').addEventListener('toggle', function () {
      AgentApi.request('/agent/terms').then(function (t) { $('#terms-text').textContent = t.termsText || 'Hairlux has not added the terms yet.'; }).catch(function (e) { $('#terms-text').textContent = e.message; });
    }, { once: true });
  }

  async function uploadPhoto(e) {
    var f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { UI.toast('The photo must be 5 MB or smaller.', 'bad'); return; }
    var fd = new FormData();
    fd.append('photo', f);
    UI.toast('Uploading your photo...');
    try {
      await AgentApi.request('/agent/me/photo', { method: 'POST', form: fd });
      me = await UI.me({ fresh: true });
      render();
      UI.toast(waiting('PHOTO') ? 'New photo sent to Hairlux for approval.' : 'Photo saved.', 'ok');
    } catch (ex) { UI.toast(ex.message, 'bad'); }
  }

  function saveDetails(e) {
    e.preventDefault();
    var body = { address: $('#p-address').value.trim(), emergencyContactName: $('#p-ec-name').value.trim(), emergencyContactPhone: $('#p-ec-phone').value.trim() };
    if (!body.address) { UI.toast('Enter your home address.', 'bad'); return; }
    UI.busy($('#p-save'), async function () {
      try {
        await AgentApi.request('/agent/me', { method: 'PATCH', json: body });
        me = await UI.me({ fresh: true });
        render();
        UI.toast(waiting('ADDRESS') ? 'Saved. Your new address is sent to Hairlux for approval.' : 'Details saved.', 'ok');
      }
      catch (ex) { UI.toast(ex.message, 'bad'); }
    });
  }

  function wireBank() {
    var sel = $('#b-bank'), acct = $('#b-acct'), name = $('#b-name'), err = $('#b-error'), btn = $('#b-save');
    var resolved = null;
    (banks ? Promise.resolve(banks) : AgentApi.request('/agent/banks')).then(function (list) {
      banks = list;
      sel.innerHTML = '<option value="">Choose your bank</option>' + list.map(function (b) { return '<option value="' + esc(b.code) + '">' + esc(b.name) + '</option>'; }).join('');
    }).catch(function () { sel.innerHTML = '<option value="">Could not load banks. Reload the page.</option>'; });
    async function check() {
      resolved = null; btn.disabled = true; name.classList.add('hidden'); err.classList.add('hidden');
      acct.value = acct.value.replace(/\D/g, '').slice(0, 10);
      if (!sel.value || acct.value.length !== 10) return;
      name.textContent = 'Checking the account...'; name.classList.remove('hidden');
      try {
        var r = await AgentApi.request('/agent/bank/resolve', { method: 'POST', json: { bankCode: sel.value, accountNumber: acct.value } });
        resolved = r;
        name.textContent = r.accountName;
        btn.disabled = false;
      } catch (ex) { name.classList.add('hidden'); err.textContent = ex.message; err.classList.remove('hidden'); }
    }
    sel.addEventListener('change', check);
    acct.addEventListener('input', check);
    $('#b-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!resolved) return;
      if (!confirm('Pay your withdrawals to ' + resolved.accountName + ', ' + acct.value + '?')) return;
      UI.busy(btn, async function () {
        try {
          var r = await AgentApi.request('/agent/bank', { method: 'POST', json: { bankCode: sel.value, accountNumber: acct.value, bankName: sel.options[sel.selectedIndex].text } });
          me = await UI.me({ fresh: true });
          render();
          UI.toast(r.pendingApproval ? 'New bank account sent to Hairlux for approval. Withdrawals keep going to your current account until then.'
            : r.accountNameMatches === false ? 'Saved. The account name is different from your name, so Hairlux may check it.' : 'Bank account saved.', r.accountNameMatches === false && !r.pendingApproval ? '' : 'ok');
        } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      });
    });
  }

  try { me = await UI.me({ fresh: true }); render(); }
  catch (e) { $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
})();
