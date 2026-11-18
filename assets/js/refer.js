/** My code: Agent ID, referral code, personal sign-up link and QR code, with copy, share and download. */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  try {
    await UI.me({ active: true });
    var k = await AgentApi.request('/agent/referral');
    var shareText = 'Book your hair and beauty services with Hairlux. Sign up with my code ' + k.referralCode + ': ' + k.referralLink;
    $('#content').innerHTML =
      '<div class="card"><div class="qr-box"><img src="' + esc(k.qrCodeDataUrl) + '" alt="QR code for your sign-up link">' +
      '<div><div class="muted small">Your code</div><div class="code-chip">' + esc(k.referralCode) + '</div>' +
      '<p class="small muted">Agent ID ' + esc(k.agentNumber) + '</p>' +
      '<div class="field"><label for="link">Your sign-up link</label><input class="input" id="link" readonly value="' + esc(k.referralLink) + '"></div>' +
      '<div class="row"><button class="btn btn-gold btn-sm" id="share">Share</button><button class="btn btn-outline btn-sm" id="copy-link">Copy link</button>' +
      '<button class="btn btn-outline btn-sm" id="copy-code">Copy code</button><a class="btn btn-outline btn-sm" download="hairlux-' + esc(k.referralCode) + '-qr.png" href="' + esc(k.qrCodeDataUrl) + '">Download QR code</a></div></div></div></div>' +
      '<div class="card"><h2>How to get credit</h2><ul class="tips">' +
      '<li>Customers scan your QR code or open your link: your code is filled in for them.</li>' +
      '<li>Customers who sign up in the Hairlux app type your code in the referral code box.</li>' +
      '<li>They must verify their email before they count as your sign-up.</li>' +
      '<li>Their first paid booking counts as your paid booking.</li>' +
      '<li>Spoke to someone who will sign up later? Add them under Leads with their phone number: if they sign up in the following weeks without a code, they still count for you.</li>' +
      '</ul></div>';
    $('#copy-link').addEventListener('click', function () { UI.copy(k.referralLink); });
    $('#copy-code').addEventListener('click', function () { UI.copy(k.referralCode); });
    $('#share').addEventListener('click', async function () {
      if (navigator.share) { try { await navigator.share({ title: 'Hairlux', text: shareText, url: k.referralLink }); } catch (e) { /* closed */ } }
      else UI.copy(shareText);
    });
  } catch (e) {
    if (e.message !== 'redirecting') $('#content').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>';
  }
})();
