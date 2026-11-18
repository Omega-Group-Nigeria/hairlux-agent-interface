/**
 * Account status: where an agent lands until they can work. Under review,
 * not approved, suspended or closed: what that means. Approved, or new terms:
 * read and accept the agent terms (an approved agent becomes active).
 */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var box = $('#content');

  function checklist(m) {
    var items = [
      [true, 'Application sent'],
      [m.emailVerified !== false, 'Email verified', m.emailVerified === false ? 'verify-email.html?email=' + encodeURIComponent(m.email) : null],
      [!!m.photoUrl, 'Photograph added', 'profile.html'],
      [!!m.bank, 'Bank account added (for payments)', 'profile.html'],
      [m.status !== 'PENDING', 'Approved by Hairlux'],
      [m.status === 'ACTIVE' && !m.needsTerms, 'Agent terms accepted'],
    ];
    return '<ul class="checklist">' + items.map(function (i) {
      return '<li class="' + (i[0] ? 'done' : '') + '"><span class="tick">&#10003;</span><span class="what">' + esc(i[1]) + '</span>' +
        (!i[0] && i[2] ? '<a class="btn btn-outline btn-sm" href="' + i[2] + '">Do it now</a>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  async function render() {
    var m = await UI.me({ fresh: true });
    var head = '';
    if (m.status === 'ACTIVE' && !m.needsTerms) { location.replace('dashboard.html'); return; }
    if (m.status === 'PENDING') {
      head = '<div class="card hero-status"><div><span class="badge warn">Under review</span><div class="state">Thanks, ' + esc(m.firstName) + '. We are reviewing your application.</div>' +
        '<p class="muted mb-0">Your Agent ID is <strong>' + esc(m.agentNumber) + '</strong>. We will email you when you are approved. Meanwhile, add your photograph and bank account so you are ready to start.</p></div></div>';
    } else if (m.status === 'REJECTED') {
      head = '<div class="alert bad"><strong>Your application was not approved</strong>' + esc(m.statusReason || 'Thank you for applying.') + '</div>';
    } else if (m.status === 'SUSPENDED') {
      head = '<div class="alert bad"><strong>Your agent account is suspended</strong>' + esc(m.statusReason || 'Contact Hairlux for help.') +
        ' You can still see your wallet. <a href="wallet.html">Open wallet</a></div>';
    } else if (m.status === 'DEACTIVATED') {
      head = '<div class="alert bad"><strong>Your agent account is closed</strong>Contact Hairlux about any money left in your wallet.</div>';
    }
    var terms = '';
    if (m.status === 'APPROVED' || (m.status === 'ACTIVE' && m.needsTerms)) {
      var t = await AgentApi.request('/agent/terms');
      terms = '<div class="card"><div class="card-head"><div><h2>' + (m.status === 'APPROVED' ? 'You are approved. Read the agent terms to start' : 'The agent terms have changed') + '</h2>' +
        '<p class="muted mb-0">Version ' + t.termsVersion + '. Read them to the end, then accept.</p></div></div>' +
        '<div class="terms" id="terms">' + esc(t.termsText || 'Hairlux has not added the terms text yet. Contact Hairlux before you accept.') + '</div>' +
        '<label class="check mt-3"><input type="checkbox" id="agree"><span>I have read and accept the Hairlux agent terms.</span></label>' +
        '<div class="row end mt-3"><button class="btn btn-gold" id="btn-accept" disabled data-busy="Saving">' + (m.status === 'APPROVED' ? 'Accept and start' : 'Accept') + '</button></div></div>';
    }
    box.innerHTML = head + terms + '<div class="card"><div class="card-head"><h2>Getting started</h2></div>' + checklist(m) + '</div>';
    var agree = $('#agree');
    if (agree) {
      agree.addEventListener('change', function () { $('#btn-accept').disabled = !agree.checked; });
      $('#btn-accept').addEventListener('click', function () {
        var btn = $('#btn-accept');
        UI.busy(btn, async function () {
          try {
            await AgentApi.request('/agent/terms/accept', { method: 'POST', json: { termsVersion: t.termsVersion } });
            UI.forgetMe();
            var first = m.status === 'APPROVED';
            UI.toast(first ? 'Welcome aboard. You can start now.' : 'Thanks. The new terms are accepted.', 'ok');
            setTimeout(function () { location.href = first ? 'refer.html' : 'dashboard.html'; }, 800);
          } catch (e) { UI.toast(e.message, 'bad'); }
        });
      });
    }
  }

  try { await render(); } catch (e) { if (e.message !== 'redirecting') box.innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
})();
