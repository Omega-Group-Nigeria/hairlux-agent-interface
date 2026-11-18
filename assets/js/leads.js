/**
 * Leads: people the agent spoke to. Add, update the follow-up status, delete.
 * A lead who signs up later with the same phone (without a code) is credited
 * to the agent; signed-up and paid statuses are set by Hairlux.
 */
(async function () {
  'use strict';
  if (!UI.shell()) return;
  var $ = UI.$, esc = UI.esc;
  var LEAD = {
    NEW: { label: 'New', cls: '' },
    CONTACTED: { label: 'Contacted', cls: 'gold' },
    INTERESTED: { label: 'Interested', cls: 'gold' },
    REGISTERED: { label: 'Signed up', cls: 'ok' },
    BOOKING_PENDING: { label: 'Booking pending', cls: 'warn' },
    PAID_BOOKING: { label: 'Paid booking', cls: 'ok' },
    NOT_CONVERTED: { label: 'Not converted', cls: 'bad' },
  };
  var EDITABLE = ['NEW', 'CONTACTED', 'INTERESTED', 'NOT_CONVERTED'];
  var status = '';
  var page = 1;
  var rows = [];
  var timer = null;

  function renderFilters(counts) {
    var all = Object.keys(counts || {}).reduce(function (t, k) { return t + counts[k]; }, 0);
    $('#filters').innerHTML = '<button class="chip' + (status ? '' : ' active') + '" data-s="">All <span class="count">' + (all || '') + '</span></button>' +
      Object.keys(LEAD).map(function (k) {
        return '<button class="chip' + (status === k ? ' active' : '') + '" data-s="' + k + '">' + esc(LEAD[k].label) + ' <span class="count">' + ((counts || {})[k] || '') + '</span></button>';
      }).join('');
  }

  function item(l) {
    return '<div class="item"><div class="top"><div><div class="name">' + esc(l.name) + '</div>' +
      '<div class="small muted">' + esc(l.phone) + (l.email ? ' · ' + esc(l.email) : '') + (l.location ? ' · ' + esc(l.location) : '') + '</div></div>' +
      UI.badge(LEAD, l.status) + '</div>' +
      (l.serviceInterest || l.source ? '<div class="small">' + esc([l.serviceInterest && 'Wants: ' + l.serviceInterest, l.source && 'From: ' + l.source].filter(Boolean).join(' · ')) + '</div>' : '') +
      (l.notes ? '<div class="small muted">' + esc(l.notes) + '</div>' : '') +
      '<div class="row between mt-2"><span class="small muted">Logged ' + UI.dateTime(l.createdAt) + (l.followUpAt ? ' · Follow up ' + UI.date(l.followUpAt) : '') + '</span>' +
      '<span class="row"><button class="btn btn-outline btn-sm" data-edit="' + esc(l.id) + '">Update</button>' +
      (l.customerUserId ? '' : '<button class="btn btn-danger-outline btn-sm" data-del="' + esc(l.id) + '">Delete</button>') + '</span></div></div>';
  }

  async function load(more) {
    if (!more) { page = 1; rows = []; $('#list').innerHTML = '<div class="loading"><span class="spinner"></span></div>'; }
    var q = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) q.set('status', status);
    var s = $('#search').value.trim();
    if (s) q.set('search', s);
    try {
      var r = await AgentApi.request('/agent/leads?' + q.toString());
      rows = rows.concat(r.data);
      renderFilters(r.counts);
      $('#list').innerHTML = rows.length ? '<div class="list">' + rows.map(item).join('') + '</div>'
        : '<div class="empty"><h3>No leads here yet</h3><p>Log everyone you speak to. If they sign up later with the same phone number, they count for you, even without your code.</p></div>';
      $('#btn-more').classList.toggle('hidden', r.meta.page >= r.meta.totalPages);
    } catch (e) { if (e.message !== 'redirecting') $('#list').innerHTML = '<div class="alert bad">' + esc(e.message) + '</div>'; }
  }

  function form(l) {
    l = l || {};
    var locked = l.id && EDITABLE.indexOf(l.status) < 0;
    var d = UI.dialog(l.id ? 'Update lead' : 'Add a lead',
      '<form id="lead-form" novalidate>' +
      '<div class="field"><label for="l-name">Name</label><input class="input" id="l-name" value="' + esc(l.name || '') + '" required></div>' +
      '<div class="field"><label for="l-phone">Phone number</label><input class="input" id="l-phone" type="tel" inputmode="tel" value="' + esc(l.phone || '') + '"' + (l.id ? ' disabled' : '') + ' required>' +
      (l.id ? '' : '<div class="hint">If they sign up later with this number, they count for you.</div>') + '</div>' +
      '<div class="grid-2"><div class="field"><label for="l-email">Email (optional)</label><input class="input" id="l-email" type="email" value="' + esc(l.email || '') + '"></div>' +
      '<div class="field"><label for="l-location">Area (optional)</label><input class="input" id="l-location" value="' + esc(l.location || '') + '"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="l-interest">Service they want (optional)</label><input class="input" id="l-interest" placeholder="e.g. Braids, nails" value="' + esc(l.serviceInterest || '') + '"></div>' +
      '<div class="field"><label for="l-source">Where you met (optional)</label><input class="input" id="l-source" placeholder="e.g. Market, church, office" value="' + esc(l.source || '') + '"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="l-status">Status</label><select class="input" id="l-status"' + (locked ? ' disabled' : '') + '>' +
      (locked ? '<option>' + esc(LEAD[l.status].label) + '</option>' : EDITABLE.map(function (k) { return '<option value="' + k + '"' + ((l.status || 'NEW') === k ? ' selected' : '') + '>' + esc(LEAD[k].label) + '</option>'; }).join('')) +
      '</select></div><div class="field"><label for="l-follow">Follow up on (optional)</label><input class="input" id="l-follow" type="date" value="' + esc(l.followUpAt ? String(l.followUpAt).slice(0, 10) : '') + '"></div></div>' +
      '<div class="field"><label for="l-notes">Notes (optional)</label><textarea class="input" id="l-notes" maxlength="1000">' + esc(l.notes || '') + '</textarea></div>' +
      '<div class="error-text hidden" id="l-error"></div>' +
      '<div class="row end"><button class="btn btn-gold" id="l-save" data-busy="Saving">' + (l.id ? 'Save' : 'Add lead') + '</button></div></form>');
    $('#lead-form', d).addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('#l-error', d);
      err.classList.add('hidden');
      var body = { name: $('#l-name', d).value.trim() };
      var opt = { email: '#l-email', location: '#l-location', serviceInterest: '#l-interest', source: '#l-source', notes: '#l-notes' };
      Object.keys(opt).forEach(function (k) { var v = $(opt[k], d).value.trim(); if (v || l.id) body[k] = v; });
      if (!body.email) delete body.email;
      var f = $('#l-follow', d).value;
      if (f) body.followUpAt = new Date(f + 'T09:00:00').toISOString();
      var wanted = locked ? null : $('#l-status', d).value;
      if (l.id && wanted) body.status = wanted;
      if (!l.id) {
        body.phone = $('#l-phone', d).value.trim();
        if (!body.phone) { err.textContent = 'Enter their phone number.'; err.classList.remove('hidden'); return; }
      }
      if (!body.name) { err.textContent = 'Enter their name.'; err.classList.remove('hidden'); return; }
      UI.busy($('#l-save', d), async function () {
        try {
          if (l.id) await AgentApi.request('/agent/leads/' + l.id, { method: 'PATCH', json: body });
          else {
            var created = await AgentApi.request('/agent/leads', { method: 'POST', json: body });
            // New leads start as New; another status is set straight after (the API only lets agents set it by update).
            if (wanted && wanted !== 'NEW' && created.status === 'NEW') await AgentApi.request('/agent/leads/' + created.id, { method: 'PATCH', json: { status: wanted } });
          }
          d.close();
          UI.toast(l.id ? 'Lead updated.' : 'Lead added.', 'ok');
          load();
        } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      });
    });
  }

  try { await UI.me({ active: true }); } catch (e) { return; }
  $('#filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-s]');
    if (!b) return;
    status = b.dataset.s;
    load();
  });
  $('#search').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(load, 300); });
  $('#btn-add').addEventListener('click', function () { form(); });
  $('#btn-more').addEventListener('click', function () { page++; load(true); });
  $('#list').addEventListener('click', async function (e) {
    var ed = e.target.closest('[data-edit]');
    if (ed) return form(rows.find(function (r) { return r.id === ed.dataset.edit; }));
    var del = e.target.closest('[data-del]');
    if (del && confirm('Delete this lead?')) {
      try { await AgentApi.request('/agent/leads/' + del.dataset.del, { method: 'DELETE' }); UI.toast('Lead deleted.', 'ok'); load(); }
      catch (ex) { UI.toast(ex.message, 'bad'); }
    }
  });
  load();
  if (UI.params().get('add')) form();
})();
