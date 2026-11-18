/**
 * Hairlux Agent portal: apply, sign in, email verification, password reset.
 * Every call names the AGENT account type, so a customer or staff account on
 * the same email is never touched.
 */
var AuthPages = (function () {
  'use strict';
  var $ = UI.$;

  function showError(msg) {
    var el = $('#error');
    el.textContent = msg;
    el.classList.toggle('hidden', !msg);
  }
  function val(id) { return ($('#' + id).value || '').trim(); }

  function afterSignIn(user) {
    UI.forgetMe();
    if (user && user.emailVerified === false) {
      location.href = 'verify-email.html?email=' + encodeURIComponent(user.email);
      return;
    }
    location.href = UI.safeNext('dashboard.html');
  }

  /** The API's 409 says which detail clashes (phone or email): tell the applicant that one. */
  function conflictMessage(apiMessage) {
    var m = String(apiMessage || '').toLowerCase();
    if (m.indexOf('phone') !== -1) return 'This phone number is already used by another Hairlux account. Use a different phone number.';
    if (m.indexOf('email') !== -1) return 'An agent account already uses this email. Sign in instead, or reset your password.';
    return apiMessage || 'These details are already used by another account.';
  }

  function signUp() {
    if (AgentApi.signedIn()) { location.replace('dashboard.html'); return; }
    AgentApi.request('/public/agents/info', { anonymous: true }).then(function (i) {
      if (!i.acceptingApplications) { $('#closed').classList.remove('hidden'); $('#submit').disabled = true; }
    }).catch(function () {});
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var body = {
        firstName: val('firstName'), lastName: val('lastName'), email: val('email').toLowerCase(), phone: val('phone'),
        address: val('address'), territory: val('territory'), password: $('#password').value,
      };
      ['state', 'emergencyContactName', 'emergencyContactPhone'].forEach(function (k) { if (val(k)) body[k] = val(k); });
      if (!body.firstName || !body.lastName || !body.email || !body.phone || !body.address || !body.territory || !body.password) {
        showError('Fill in every field that is not marked optional.');
        return;
      }
      if (body.password.length < 8 || !/[A-Z]/.test(body.password) || !/[a-z]/.test(body.password) || !/\d/.test(body.password)) {
        showError('Your password needs at least 8 characters, with a capital letter, a small letter and a number.');
        return;
      }
      await UI.busy($('#submit'), async function () {
        try {
          var data = await AgentApi.request('/auth/register-agent', { method: 'POST', json: body, anonymous: true });
          AgentApi.saveSession(data);
          location.href = 'verify-email.html?email=' + encodeURIComponent(body.email);
        } catch (err) {
          showError(err.status === 409 ? conflictMessage(err.message) : err.message);
        }
      });
    });
  }

  function logIn() {
    if (AgentApi.signedIn()) { location.replace(UI.safeNext('dashboard.html')); return; }
    var prefill = UI.params().get('email');
    if (prefill) $('#email').value = prefill;
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var email = val('email').toLowerCase();
      var password = $('#password').value;
      if (!email || !password) { showError('Enter your email and password.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          var data = await AgentApi.request('/auth/login', { method: 'POST', json: { email: email, password: password, type: 'AGENT' }, anonymous: true });
          AgentApi.saveSession(data);
          afterSignIn(data.user);
        } catch (err) {
          showError(/No agent account/i.test(err.message) ? 'There is no agent account for this email. Apply to be an agent first.' : err.message);
        }
      });
    });
  }

  function verifyEmail() {
    var u = AgentApi.user();
    var email = (UI.params().get('email') || (u && u.email) || '').toLowerCase();
    if (!email) { location.replace('log-in.html'); return; }
    $('#email-label').textContent = email;
    $('#code').addEventListener('input', function (e) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var code = val('code');
      if (code.length !== 6) { showError('Enter the 6-digit code.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          var data = await AgentApi.request('/auth/verify-otp', { method: 'POST', json: { email: email, otpCode: code, type: 'AGENT' }, anonymous: true });
          if (data && (data.accessToken || data.user)) AgentApi.saveSession(data);
          var cur = AgentApi.user();
          if (cur) { cur.emailVerified = true; AgentApi.saveSession({ user: cur }); }
          UI.toast('Email verified.', 'ok');
          location.href = AgentApi.signedIn() ? 'status.html' : 'log-in.html';
        } catch (err) { showError(err.message); }
      });
    });
    $('#resend').addEventListener('click', async function () {
      await UI.busy($('#resend'), async function () {
        try {
          await AgentApi.request('/auth/resend-otp', { method: 'POST', json: { email: email, type: 'AGENT' }, anonymous: true });
          UI.toast('A new code is on its way.', 'ok');
        } catch (err) { UI.toast(err.message, 'bad'); }
      });
    });
  }

  function forgot() {
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var email = val('email').toLowerCase();
      if (!email) { showError('Enter your email.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          await AgentApi.request('/auth/forgot-password', { method: 'POST', json: { email: email, type: 'AGENT' }, anonymous: true });
          $('#sent').classList.remove('hidden');
          $('#form').classList.add('hidden');
        } catch (err) { showError(err.message); }
      });
    });
  }

  function reset() {
    var token = UI.params().get('token');
    if (!token) { showError('This reset link is incomplete. Request a new one.'); $('#submit').disabled = true; }
    $('#form').addEventListener('submit', async function (e) {
      e.preventDefault();
      showError('');
      var pw = $('#password').value;
      if (pw !== $('#confirm').value) { showError('The two passwords do not match.'); return; }
      await UI.busy($('#submit'), async function () {
        try {
          await AgentApi.request('/auth/reset-password', { method: 'POST', json: { token: token, newPassword: pw }, anonymous: true });
          AgentApi.clearSession();
          UI.toast('Password changed. Sign in with your new password.', 'ok');
          setTimeout(function () { location.href = 'log-in.html'; }, 1200);
        } catch (err) { showError(err.message); }
      });
    });
  }

  return { signUp: signUp, logIn: logIn, verifyEmail: verifyEmail, forgot: forgot, reset: reset };
})();
