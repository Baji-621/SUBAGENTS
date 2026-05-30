/**
 * Phase 6 — Extended ops pages: rooming, comms, AV, ops hub, beloved, travel
 * Registers RENDERERS on window.RENDERERS (patched in initApp).
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  }

  function pageHead(title, sub) {
    return (
      '<div class="page-head"><h1 class="font-serif">' +
      esc(title) +
      '</h1><p>' +
      esc(sub) +
      '</p></div>'
    );
  }

  function kpiCards(items) {
    return (
      '<div class="grid-4">' +
      items
        .map(
          (k) =>
            '<div class="card"><div class="card-label">' +
            esc(k.label) +
            '</div><div class="card-val">' +
            esc(k.val) +
            '</div></div>'
        )
        .join('') +
      '</div>'
    );
  }

  function renderRooming() {
    const r = DATA.rooming || {};
    const s = r.summary || {};
    const gaps = r.validationGaps || [];
    const groups = r.groups || [];
    const links =
      '<div class="hub-grid" style="margin-bottom:24px">' +
      [
        ['Rooming hub', '/rooming', 'All stakeholder dashboards'],
        ['Natasha (Palladium)', '/rooming/natasha', 'Front desk · SAW'],
        ['Raj (AbsoluteWed)', '/rooming/raj', 'Travel matrix rollups'],
        ['Beloved handoff', '/05_Communications/CB_Beloved_Rooming_Dashboard.html', 'Planner block Bldg 16'],
        ['Couple summary', '/05_Communications/CB_Couple_Rooming_Summary.html', 'Internal view'],
      ]
        .map(
          ([t, href, d]) =>
            '<a class="hub-card" href="' +
            esc(href) +
            '" target="_blank" rel="noopener"><strong>' +
            esc(t) +
            '</strong><div style="font-size:12px;color:var(--muted);margin-top:6px">' +
            esc(d) +
            '</div></a>'
        )
        .join('') +
      '</div>';

    const table =
      groups.length === 0
        ? '<p>No supplier groups in SSOT.</p>'
        : '<table><thead><tr><th>Supplier</th><th>Nights</th><th>Check-in</th><th>Pax</th><th>Rooms</th><th>Status</th></tr></thead><tbody>' +
          groups
            .map(
              (g) =>
                '<tr><td>' +
                esc(g.supplier) +
                '</td><td>' +
                esc(g.nights) +
                '</td><td>' +
                fmtDate(g.checkIn) +
                '</td><td>' +
                esc(g.pax) +
                '</td><td>' +
                esc(g.rooms) +
                '</td><td><span class="badge">' +
                esc(g.status) +
                '</span></td></tr>'
            )
            .join('') +
          '</tbody></table>';

    const gapBlock =
      gaps.length === 0
        ? ''
        : '<div class="section-title font-serif">Validation gaps</div><ul class="gap-list">' +
          gaps.map((g) => '<li>' + esc(g) + '</li>').join('') +
          '</ul>';

    const sheet =
      r.sheetUrl
        ? '<p style="margin-top:16px;font-size:13px"><a href="' +
          esc(r.sheetUrl) +
          '" target="_blank" rel="noopener" style="color:var(--accent)">Open rooming matrix sheet →</a></p>'
        : '';

    return (
      pageHead('Rooming', '133 pax · sheet wins · stakeholder dashboards') +
      kpiCards([
        { label: 'Total pax', val: s.pax ?? '—' },
        { label: 'Rooms', val: s.rooms ?? '—' },
        { label: 'Room nights', val: s.roomNights ?? '—' },
        { label: 'Palladium block', val: (s.palladiumPax ?? '—') + ' pax' },
      ]) +
      links +
      '<div class="section-title font-serif">Supplier groups</div>' +
      table +
      gapBlock +
      sheet
    );
  }

  function renderComms() {
    const list = DATA.comms || [];
    if (!list.length) {
      return pageHead('Comms', 'Draft messages from SSOT') + '<p>No comms drafts.</p>';
    }
    const cards = list
      .map((m) => {
        const ch = String(m.channel || 'email').toLowerCase();
        const body = m.body || m.subject || m.title || '';
        const wa =
          m.wa && ch === 'whatsapp'
            ? ' · WA ' + esc(m.wa)
            : m.email
              ? ' · ' + esc(m.email)
              : '';
        return (
          '<div class="comms-card card" data-comms-id="' +
          esc(m.id) +
          '"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
          '<strong style="color:var(--display)">' +
          esc(m.title) +
          '</strong><span class="ch-tag">' +
          esc(ch) +
          '</span></div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:6px">To: ' +
          esc(m.to) +
          wa +
          '</div>' +
          (m.subject
            ? '<div style="font-size:12px;margin-top:8px"><strong>Subject:</strong> ' + esc(m.subject) + '</div>'
            : '') +
          (m.body
            ? '<pre style="white-space:pre-wrap;font-size:12px;margin-top:10px;padding:12px;border-radius:8px;background:var(--surface2);max-height:160px;overflow:auto">' +
              esc(m.body) +
              '</pre>'
            : '') +
          '<div>' +
          (m.subject
            ? '<button type="button" class="copy-btn" data-comms-copy="subject" data-comms-id="' +
              esc(m.id) +
              '">Copy subject</button>'
            : '') +
          (body
            ? '<button type="button" class="copy-btn" data-comms-copy="body" data-comms-id="' +
              esc(m.id) +
              '">Copy body</button>'
            : '') +
          (m.wa && ch === 'whatsapp'
            ? '<a class="copy-btn" href="https://wa.me/' +
              esc(String(m.wa).replace(/\D/g, '')) +
              '" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block">Open WhatsApp</a>'
            : '') +
          (m.email
            ? '<a class="copy-btn" href="mailto:' +
              esc(m.email) +
              '?subject=' +
              encodeURIComponent(m.subject || m.title || '') +
              '" style="text-decoration:none;display:inline-block">Open email</a>'
            : '') +
          '</div></div>'
        );
      })
      .join('');

    return (
      pageHead('Comms', 'Copy-paste drafts · T9 parity · sheet tracks sent status only') +
      '<p style="font-size:13px;color:var(--muted);margin-bottom:16px">' +
      list.length +
      ' drafts · also see <a href="/ops" target="_blank" rel="noopener" style="color:var(--accent)">/ops</a> accountability</p>' +
      cards
    );
  }

  function renderAv() {
    const matrix = DATA.avMatrix || [];
    const quotes = DATA.avQuotes || {};
    const mj = quotes.millsJames || {};
    const adc = quotes.avDelCaribe || {};

    const quoteBlock =
      '<div class="av-quote">' +
      '<div class="card"><div class="card-label">Mills James (preferred)</div><div class="card-val">$' +
      esc(String(mj.usd ?? '—').replace(/\B(?=(\d{3})+(?!\d))/g, ',')) +
      '</div><div style="font-size:12px;color:var(--muted);margin-top:8px">Quotes ' +
      esc((mj.quotes || []).join(', ')) +
      ' · expires ' +
      esc(mj.expires || '—') +
      '</div></div>' +
      '<div class="card"><div class="card-label">AV del Caribe (reference)</div><div class="card-val">$' +
      esc(String(adc.usd ?? '—').replace(/\B(?=(\d{3})+(?!\d))/g, ',')) +
      '</div><div style="font-size:12px;color:var(--muted);margin-top:8px">' +
      esc(adc.events ?? 8) +
      ' events scoped</div></div></div>';

    const rows = matrix
      .map((ev) => {
        const audio = (ev.audio || []).map((a) => '<li>' + esc(a) + '</li>').join('');
        const light = (ev.lighting || []).map((l) => '<li>' + esc(l) + '</li>').join('');
        return (
          '<tr><td><strong>' +
          esc(ev.event) +
          '</strong><br><span style="font-size:11px;color:var(--muted)">' +
          fmtDate(ev.date) +
          ' · ' +
          esc(ev.time) +
          '</span></td><td>' +
          esc(ev.venue) +
          '</td><td><ul style="margin:0;padding-left:16px;font-size:12px">' +
          (audio || '<li>—</li>') +
          '</ul></td><td><ul style="margin:0;padding-left:16px;font-size:12px">' +
          (light || '<li>—</li>') +
          '</ul></td></tr>'
        );
      })
      .join('');

    return (
      pageHead('AV matrix', 'Mills James scope · sign before quote expiry') +
      quoteBlock +
      '<div class="section-title font-serif">Event × equipment</div>' +
      '<table><thead><tr><th>Event</th><th>Venue</th><th>Audio</th><th>Lighting</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>'
    );
  }

  function renderOpsHub() {
    const hubs = [
      ['Wedding OS v6', '/os', '15-tab legacy console · comms · SAW · vault'],
      ['Ops sprint', '/ops', 'Accountability · May 29 command'],
      ['Entertainment', '/entertainment', 'DJ cues · Spotify · ENT tabs'],
      ['Vendors ops', '/vendors', 'Payments stack · vendor SSOT hub'],
      ['Guest itinerary', '/itinerary', 'Raj-facing week schedule'],
      ['Comms transfer', '/transfer', 'Transfer studio · agent skills'],
      ['eDoc kit', '/edoc', 'Raj rooming splitter guides'],
      ['Guest site', 'https://ckwedsbm.netlify.app', 'Public RSVP site (external)'],
    ];
    return (
      pageHead('Ops hub', 'Deep links to standalone tools — opens in new tab') +
      '<div class="hub-grid">' +
      hubs
        .map(
          ([t, href, d]) =>
            '<a class="hub-card" href="' +
            esc(href) +
            '" target="_blank" rel="noopener"><strong>' +
            esc(t) +
            '</strong><div style="font-size:12px;color:var(--muted);margin-top:6px">' +
            esc(d) +
            '</div><div style="font-size:11px;color:var(--accent);margin-top:8px">' +
            esc(href) +
            ' →</div></a>'
        )
        .join('') +
      '</div>'
    );
  }

  function renderBeloved() {
    const b = DATA.beloved || {};
    const rooms = (b.rooms || [])
      .map(
        (rm, i) =>
          '<div class="contact-row card"><span class="name">Room ' +
          (i + 1) +
          '</span><span>' +
          esc((rm.occupants || []).join(' · ')) +
          '</span></div>'
      )
      .join('');
    return (
      pageHead('Beloved Planners', 'Building 16 block · Sunwing via AbsoluteWed') +
      kpiCards([
        { label: 'Confirmation', val: b.confirmation || '—' },
        { label: 'Building', val: b.building ?? '—' },
        { label: 'Stay', val: (b.stay || '—').split('·')[0].trim() },
        { label: 'Rooms', val: (b.rooms || []).length },
      ]) +
      '<div style="font-size:13px;margin-bottom:16px;color:var(--muted)">' +
      esc(b.supplier) +
      '</div>' +
      '<div class="section-title font-serif">Occupants</div>' +
      (rooms || '<p>No room assignments.</p>') +
      '<p style="margin-top:16px"><a href="/rooming/beloved" target="_blank" rel="noopener" style="color:var(--accent)">Open Beloved rooming dashboard →</a></p>'
    );
  }

  function renderTravel() {
    const aw = DATA.absoluteWed || {};
    const contacts = (aw.contacts || [])
      .map(
        (c) =>
          '<div class="contact-row card"><span class="name">' +
          esc(c.name) +
          '</span><span style="font-size:12px;color:var(--muted)">' +
          esc(c.role) +
          '</span><a href="mailto:' +
          esc(c.email) +
          '" style="color:var(--accent);font-size:13px">' +
          esc(c.email) +
          '</a><span style="font-size:13px">' +
          esc(c.phone) +
          '</span></div>'
      )
      .join('');
    const rate = aw.landOnlyRate || {};
    return (
      pageHead('Travel · AbsoluteWed', 'Raj / Jean · transfers · land-only policy') +
      '<div class="banner" style="margin-bottom:20px">' +
      esc(aw.transferPolicy) +
      '</div>' +
      kpiCards([
        { label: 'Land-only rate', val: 'C$' + (rate.cad ?? '—') },
        { label: 'Nights', val: rate.nights ?? '—' },
        { label: 'Includes', val: 'AI only' },
      ]) +
      '<div class="section-title font-serif">Key contacts</div>' +
      '<div class="contact-list">' +
      contacts +
      '</div>' +
      '<p style="margin-top:16px"><a href="/rooming/raj" target="_blank" rel="noopener" style="color:var(--accent)">Raj rooming dashboard →</a></p>'
    );
  }

  let phase6Bound = false;

  function bindPhase6Events() {
    if (phase6Bound) return;
    const main = document.getElementById('main');
    if (!main) return;
    main.addEventListener('click', (e) => {
      const commsBtn = e.target.closest('[data-comms-copy]');
      if (commsBtn) {
        const id = commsBtn.dataset.commsId;
        const field = commsBtn.dataset.commsCopy;
        const item = (DATA.comms || []).find((x) => String(x.id) === String(id));
        const text =
          field === 'subject'
            ? item?.subject || ''
            : item?.body || item?.subject || item?.title || '';
        if (!text) return;
        navigator.clipboard.writeText(text).then(
          () => {
            const prev = commsBtn.textContent;
            commsBtn.textContent = 'Copied!';
            setTimeout(() => {
              commsBtn.textContent = prev;
            }, 1500);
          },
          () => alert('Copy failed — select text manually')
        );
        return;
      }
      const btn = e.target.closest('[data-copy-text]');
      if (!btn) return;
      const text = btn.getAttribute('data-copy-text');
      if (!text) return;
      navigator.clipboard.writeText(text).then(
        () => {
          const prev = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = prev;
          }, 1500);
        },
        () => alert('Copy failed — select text manually')
      );
    });
    phase6Bound = true;
  }

  function registerRenderers() {
    global.RENDERERS = global.RENDERERS || {};
    global.RENDERERS.rooming = renderRooming;
    global.RENDERERS.comms = renderComms;
    global.RENDERERS.av = renderAv;
    global.RENDERERS.ops = renderOpsHub;
    global.RENDERERS.beloved = renderBeloved;
    global.RENDERERS.travel = renderTravel;
  }

  function initPhase6Pages() {
    registerRenderers();
    bindPhase6Events();
  }

  global.BcCmdPages = { initPhase6Pages, registerRenderers };
})(typeof window !== 'undefined' ? window : globalThis);
