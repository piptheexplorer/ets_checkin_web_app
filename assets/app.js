(() => {
  const state = {
    apiBase: '', token: '', device: '', entrance: '', siteName: '',
    events: [], eventId: '', eventDate: '', currentTicket: null,
    scanner: null, scannerRunning: false, refreshTimer: null, lastScan: '', lastScanAt: 0,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    panel: $('[data-connection-panel]'), dashboard: $('[data-dashboard]'), siteLabel: $('[data-site-label]'),
    connectionState: $('[data-connection-state]'), apiBase: $('[data-api-base]'), token: $('[data-api-token]'), device: $('[data-device-name]'), defaultEntrance: $('[data-default-entrance]'),
    save: $('[data-save-connection]'), clear: $('[data-clear-connection]'), openSettings: $('[data-open-settings]'), fullscreen: $('[data-fullscreen]'),
    eventSelect: $('[data-event-select]'), dateSelect: $('[data-date-select]'), entrance: $('[data-entrance]'), refresh: $('[data-refresh]'), lastRefresh: $('[data-last-refresh]'),
    autoCheckin: $('[data-auto-checkin]'), startScanner: $('[data-start-scanner]'), stopScanner: $('[data-stop-scanner]'), ticketInput: $('[data-ticket-input]'), validate: $('[data-validate]'), checkinCurrent: $('[data-checkin-current]'), undoCurrent: $('[data-undo-current]'), scanResult: $('[data-scan-result]'),
    search: $('[data-search]'), statusFilter: $('[data-status-filter]'), typeFilter: $('[data-type-filter]'), rosterBody: $('[data-roster-body]'), rosterCount: $('[data-roster-count]'), activityList: $('[data-activity-list]'),
    progressBar: $('[data-progress-bar]'), progressLabel: $('[data-progress-label]'),
  };

  function storageLoad() {
    const saved = JSON.parse(localStorage.getItem('etsCheckinApp') || '{}');
    state.apiBase = saved.apiBase || '';
    state.token = saved.token || '';
    state.device = saved.device || '';
    state.entrance = saved.entrance || '';
    els.apiBase.value = state.apiBase;
    els.token.value = state.token;
    els.device.value = state.device;
    els.defaultEntrance.value = state.entrance;
    els.entrance.value = state.entrance;
  }

  function storageSave() {
    localStorage.setItem('etsCheckinApp', JSON.stringify({ apiBase: state.apiBase, token: state.token, device: state.device, entrance: state.entrance }));
  }

  function normaliseBase(input) {
    let value = (input || '').trim().replace(/\/+$/, '');
    if (!value) return '';
    if (value.includes('/wp-json/ets-app/v1')) return value;
    return value + '/wp-json/ets-app/v1';
  }

  async function api(path, options = {}) {
    if (!state.apiBase || !state.token) throw new Error('The app is not connected yet.');
    const headers = { 'Authorization': `Bearer ${state.token}`, 'Content-Type': 'application/json', 'X-ETS-Device': state.device || 'Check-in web app' };
    const response = await fetch(state.apiBase + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    let data = {};
    const text = await response.text();
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { message: text }; }
    if (!response.ok) {
      const error = new Error(data.message || data?.data?.message || `Request failed (${response.status})`);
      error.data = data; error.status = response.status;
      throw error;
    }
    return data;
  }

  function setConnectionState(text, good = false) {
    els.connectionState.textContent = text;
    els.connectionState.style.background = good ? 'rgba(34,197,94,.16)' : 'rgba(255,255,255,.08)';
    els.connectionState.style.color = good ? '#bbf7d0' : '#d1d5db';
  }

  async function testConnection() {
    state.apiBase = normaliseBase(els.apiBase.value);
    state.token = els.token.value.trim();
    state.device = els.device.value.trim() || 'Check-in web app';
    state.entrance = els.defaultEntrance.value.trim() || els.entrance.value.trim();
    els.apiBase.value = state.apiBase;
    els.entrance.value = state.entrance;
    storageSave();
    const site = await api('/site');
    state.siteName = site.site_name || 'Connected site';
    els.siteLabel.textContent = `${state.siteName} · ${site.token_name || 'App token'}`;
    setConnectionState('Connected', true);
    els.dashboard.hidden = false;
    await loadEvents();
    scheduleRefresh();
  }

  async function loadEvents() {
    const data = await api('/events');
    state.events = data.events || [];
    renderEventSelect();
    await loadDashboard();
  }

  function renderEventSelect() {
    const previous = state.eventId;
    els.eventSelect.innerHTML = '<option value="">All events</option>' + state.events.map(event => `<option value="${event.id}">${escapeHtml(event.title)}</option>`).join('');
    if (previous && state.events.some(e => String(e.id) === String(previous))) els.eventSelect.value = previous;
    state.eventId = els.eventSelect.value;
    renderDateSelect();
  }

  function renderDateSelect() {
    const event = state.events.find(e => String(e.id) === String(els.eventSelect.value));
    const dates = event?.dates || [];
    els.dateSelect.innerHTML = '<option value="">All dates</option>' + dates.map(d => `<option value="${escapeAttr(d.date)}">${escapeHtml(d.label || d.date)}${d.time ? ' · ' + escapeHtml(d.time) : ''}</option>`).join('');
    if (state.eventDate && dates.some(d => d.date === state.eventDate)) els.dateSelect.value = state.eventDate;
    state.eventDate = els.dateSelect.value;
  }

  async function loadDashboard() {
    if (!state.apiBase || !state.token) return;
    state.eventId = els.eventSelect.value;
    state.eventDate = els.dateSelect.value;
    const params = new URLSearchParams({ event_id: state.eventId, event_date: state.eventDate, search: els.search.value || '', status: els.statusFilter.value || '', ticket_type: els.typeFilter.value || '' });
    const data = await api('/dashboard?' + params.toString());
    renderStats(data.stats || {});
    renderActivity(data.activity || []);
    renderRoster(data.tickets || [], data.ticket_count || 0);
    renderTicketTypes(data.ticket_types || []);
    els.lastRefresh.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  }

  function renderStats(stats) {
    $$('[data-stat]').forEach(el => {
      const key = el.dataset.stat;
      const value = stats[key];
      el.textContent = value === null || value === undefined || value === '' ? '—' : value;
    });
    $('[data-stat-label="attendance_percent"]').textContent = `${stats.attendance_percent || 0}% attendance`;
    $('[data-stat-label="capacity"]').textContent = stats.capacity ? `${stats.capacity_used || 0} / ${stats.capacity} allocated` : 'No date capacity selected';
    const pct = Math.max(0, Math.min(100, Number(stats.attendance_percent || 0)));
    els.progressBar.style.width = pct + '%';
    els.progressLabel.textContent = `${pct}% checked in`;
  }

  function renderActivity(items) {
    if (!items.length) { els.activityList.innerHTML = '<p class="empty">No activity yet.</p>'; return; }
    els.activityList.innerHTML = items.map(item => `
      <div class="activity-item">
        <strong>${escapeHtml(item.attendee || item.ticket_id || 'Ticket')}</strong>
        <span>${escapeHtml(item.action || 'checkin')} · ${escapeHtml(item.ticket_type || '')} · ${escapeHtml(item.entrance || '')}</span><br>
        <span>${escapeHtml(item.time || '')} ${item.staff ? '· ' + escapeHtml(item.staff) : ''}</span>
      </div>`).join('');
  }

  function renderTicketTypes(types) {
    const current = els.typeFilter.value;
    const options = '<option value="">All ticket types</option>' + types.map(type => `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`).join('');
    if (els.typeFilter.innerHTML !== options) {
      els.typeFilter.innerHTML = options;
      els.typeFilter.value = current;
    }
  }

  function renderRoster(tickets, count) {
    els.rosterCount.textContent = `${count} result${count === 1 ? '' : 's'}`;
    if (!tickets.length) { els.rosterBody.innerHTML = '<tr><td colspan="5" class="empty">No tickets found.</td></tr>'; return; }
    els.rosterBody.innerHTML = tickets.map(ticket => {
      const attendee = ticket.attendee_name || ticket.customer_name || 'Unnamed attendee';
      const email = ticket.attendee_email || ticket.customer_email || '';
      const statusClass = ticket.is_invalid ? 'invalid' : (!ticket.is_attendance_ticket ? 'pass' : (ticket.checked_in ? 'checked' : ''));
      const statusText = ticket.is_invalid ? 'Invalid' : (!ticket.is_attendance_ticket ? 'Add-on pass' : (ticket.checked_in ? 'Checked in' : 'Not arrived'));
      const canCheck = ticket.is_attendance_ticket && !ticket.is_invalid && !ticket.checked_in;
      const canUndo = ticket.is_attendance_ticket && !ticket.is_invalid && ticket.checked_in;
      return `<tr>
        <td><strong>${escapeHtml(attendee)}</strong><br><small>${escapeHtml(email)}</small></td>
        <td>${escapeHtml(ticket.ticket_type || 'Ticket')}<br><small>${escapeHtml(ticket.ticket_id || '')}</small></td>
        <td>${escapeHtml(ticket.event_date_label || '')}</td>
        <td><span class="status ${statusClass}">${statusText}</span>${ticket.checked_in_at ? `<br><small>${escapeHtml(ticket.checked_in_at)}</small>` : ''}</td>
        <td><div class="table-actions">
          <button data-row-validate="${escapeAttr(ticket.ticket_id)}">View</button>
          ${canCheck ? `<button class="primary" data-row-checkin="${escapeAttr(ticket.ticket_id)}">Check in</button>` : ''}
          ${canUndo ? `<button class="danger ghost" data-row-undo="${escapeAttr(ticket.ticket_id)}">Undo</button>` : ''}
        </div></td>
      </tr>`;
    }).join('');
  }

  async function validateTicket(raw) {
    const ticket_id = (raw || els.ticketInput.value || '').trim();
    if (!ticket_id) return showMessage('Please enter or scan a ticket.', 'warning');
    try {
      const data = await api('/tickets/validate', { method: 'POST', body: JSON.stringify(payload({ ticket_id })) });
      state.currentTicket = data;
      renderScanResult(data, 'Valid ticket');
      if (els.autoCheckin.checked && !data.checked_in && !data.is_invalid) await checkInTicket(data.ticket_id);
      return data;
    } catch (error) {
      const ticket = error.data?.ticket;
      state.currentTicket = ticket || null;
      if (ticket) renderScanResult(ticket, error.message, true); else showMessage(error.message, 'invalid');
    }
  }

  async function checkInTicket(ticketId) {
    const id = ticketId || state.currentTicket?.ticket_id;
    if (!id) return;
    try {
      const data = await api('/tickets/check-in', { method: 'POST', body: JSON.stringify(payload({ ticket_id: id })) });
      state.currentTicket = data.ticket;
      renderScanResult(data.ticket, data.message || 'Checked in');
      await loadDashboard();
    } catch (error) {
      if (error.data?.ticket) renderScanResult(error.data.ticket, error.message, true); else showMessage(error.message, 'invalid');
      await loadDashboard();
    }
  }

  async function undoTicket(ticketId) {
    const id = ticketId || state.currentTicket?.ticket_id;
    if (!id) return;
    try {
      const data = await api('/tickets/undo', { method: 'POST', body: JSON.stringify(payload({ ticket_id: id })) });
      state.currentTicket = data.ticket;
      renderScanResult(data.ticket, data.message || 'Check-in undone', true);
      await loadDashboard();
    } catch (error) {
      if (error.data?.ticket) renderScanResult(error.data.ticket, error.message, true); else showMessage(error.message, 'invalid');
      await loadDashboard();
    }
  }

  function payload(extra = {}) {
    return { event_id: els.eventSelect.value || '', event_date: els.dateSelect.value || '', entrance: els.entrance.value.trim(), device_name: state.device || 'Check-in web app', ...extra };
  }

  function renderScanResult(ticket, message, warning = false) {
    const attendee = ticket.attendee_name || ticket.customer_name || 'Unnamed attendee';
    const email = ticket.attendee_email || ticket.customer_email || '';
    const invalid = warning || ticket.is_invalid || ticket.ticket_status === 'cancelled' || ticket.ticket_status === 'refunded';
    const checked = !!ticket.checked_in;
    els.scanResult.className = 'scan-result';
    els.scanResult.innerHTML = `
      <div class="ticket-card-result">
        <div class="result-status ${invalid ? 'invalid' : (checked ? 'warning' : '')}">${escapeHtml(message || (checked ? 'Already checked in' : 'Valid ticket'))}</div>
        <h3>${escapeHtml(attendee)}</h3>
        <p class="muted result-email">${escapeHtml(email)}</p>
        <dl>
          <div><dt>Ticket</dt><dd>${escapeHtml(ticket.ticket_type || 'Ticket')} · ${escapeHtml(ticket.ticket_id || '')}</dd></div>
          <div><dt>Event</dt><dd>${escapeHtml(ticket.event_title || '')}</dd></div>
          <div><dt>Valid date</dt><dd>${escapeHtml(ticket.event_date || ticket.scope_date || '')}</dd></div>
          <div><dt>Checked in</dt><dd>${checked ? `${escapeHtml(ticket.checked_in_at || '')}${ticket.checked_in_entrance ? ' · ' + escapeHtml(ticket.checked_in_entrance) : ''}` : 'No'}</dd></div>
        </dl>
      </div>`;
    els.checkinCurrent.disabled = invalid || checked || ticket.ticket_kind !== 'ticket';
    els.undoCurrent.disabled = invalid || !checked || ticket.ticket_kind !== 'ticket';
  }

  function showMessage(message, type = 'info') {
    els.scanResult.className = `scan-result ${type}`;
    els.scanResult.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
    els.checkinCurrent.disabled = true;
    els.undoCurrent.disabled = true;
  }

  async function startScanner() {
    if (!window.Html5Qrcode) return showMessage('QR scanner library has not loaded yet.', 'invalid');
    if (!state.scanner) state.scanner = new Html5Qrcode('qr-reader');
    try {
      await state.scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 260 } }, async decoded => {
        const now = Date.now();
        if (decoded === state.lastScan && now - state.lastScanAt < 2500) return;
        state.lastScan = decoded; state.lastScanAt = now;
        els.ticketInput.value = decoded;
        await validateTicket(decoded);
      });
      state.scannerRunning = true;
      els.startScanner.disabled = true;
      els.stopScanner.disabled = false;
    } catch (error) {
      showMessage(error.message || 'Could not start the camera.', 'invalid');
    }
  }

  async function stopScanner() {
    if (!state.scanner || !state.scannerRunning) return;
    await state.scanner.stop();
    state.scannerRunning = false;
    els.startScanner.disabled = false;
    els.stopScanner.disabled = true;
  }

  function scheduleRefresh() {
    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => loadDashboard().catch(() => {}), 10000);
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch])); }
  function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#039;'); }

  els.save.addEventListener('click', () => testConnection().catch(error => { setConnectionState('Connection failed'); showMessage(error.message, 'invalid'); }));
  els.clear.addEventListener('click', () => { localStorage.removeItem('etsCheckinApp'); location.reload(); });
  els.openSettings.addEventListener('click', () => { els.panel.hidden = !els.panel.hidden; });
  els.fullscreen.addEventListener('click', () => { document.body.classList.toggle('is-door-mode'); if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.(); });
  els.eventSelect.addEventListener('change', () => { renderDateSelect(); loadDashboard().catch(console.error); });
  els.dateSelect.addEventListener('change', () => loadDashboard().catch(console.error));
  els.entrance.addEventListener('change', () => { state.entrance = els.entrance.value.trim(); storageSave(); });
  els.refresh.addEventListener('click', () => loadDashboard().catch(error => showMessage(error.message, 'invalid')));
  els.validate.addEventListener('click', () => validateTicket());
  els.checkinCurrent.addEventListener('click', () => checkInTicket());
  els.undoCurrent.addEventListener('click', () => undoTicket());
  els.startScanner.addEventListener('click', startScanner);
  els.stopScanner.addEventListener('click', stopScanner);
  els.search.addEventListener('input', debounce(() => loadDashboard().catch(console.error), 350));
  els.statusFilter.addEventListener('change', () => loadDashboard().catch(console.error));
  els.typeFilter.addEventListener('change', () => loadDashboard().catch(console.error));
  els.rosterBody.addEventListener('click', event => {
    const view = event.target.closest('[data-row-validate]');
    const check = event.target.closest('[data-row-checkin]');
    const undo = event.target.closest('[data-row-undo]');
    if (view) validateTicket(view.dataset.rowValidate);
    if (check) checkInTicket(check.dataset.rowCheckin);
    if (undo) undoTicket(undo.dataset.rowUndo);
  });

  function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); }; }

  storageLoad();
  if (state.apiBase && state.token) testConnection().catch(() => setConnectionState('Saved connection needs attention'));
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => {});
})();
