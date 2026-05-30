/**
 * Phase 7 — Vendors page (product register · Chromatic Ritual)
 * Replaces card grid with grouped roster rows, filters, inline actions.
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function statusClass(st) {
    const s = String(st || '').toUpperCase();
    if (s === 'ACTIVE' || s === 'CONFIRMED' || s === 'SIGNED' || s === 'PAID') return 'b-ok';
    if (s === 'OVERDUE' || s === 'URGENT') return 'b-bad';
    if (s === 'REFERENCE' || s === 'EVALUATING' || s === 'SUPERSEDED') return 'b-muted';
    return 'b-warn';
  }

  function tierLabel(t) {
    if (t === 'internal') return 'Planners & venue';
    if (t === 'critical') return 'Critical path';
    return 'Vendors';
  }

  function groupVendors(list) {
    const order = ['internal', 'critical', 'vendor', 'other'];
    const groups = new Map();
    for (const v of list) {
      const tier = v.tier || 'vendor';
      const key = order.includes(tier) ? tier : 'other';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(v);
    }
    return order.filter((k) => groups.has(k)).map((k) => ({ tier: k, label: tierLabel(k), items: groups.get(k) }));
  }

  function contactActions(v) {
    const parts = [];
    if (v.email) {
      parts.push(
        `<a class="v-act" href="mailto:${esc(v.email)}" title="Email">Email</a>`
      );
    }
    if (v.phone) {
      parts.push(`<a class="v-act" href="tel:${esc(v.phone)}" title="Call">Call</a>`);
    }
    if (v.whatsapp) {
      const wa = String(v.whatsapp).replace(/\D/g, '');
      parts.push(
        `<a class="v-act" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">WA</a>`
      );
    }
    return parts.length ? `<div class="v-actions">${parts.join('')}</div>` : '';
  }

  function renderVendorRow(v, crud) {
    const local =
      v._source === 'local' || String(v.id || '').startsWith('local-')
        ? '<span class="local-badge">local</span>'
        : '';
    const quote =
      v.quoteUsd != null && v.quoteUsd !== ''
        ? `<span class="v-quote">$${Number(v.quoteUsd).toLocaleString()}</span>`
        : '';
    const chips = (v.events || '')
      .split(/[,·]/)
      .slice(0, 2)
      .map((e) => `<span class="v-chip">${esc(e.trim())}</span>`)
      .join('');
    return (
      `<article class="v-row${v._source === 'local' ? ' local-item' : ''}" data-id="${esc(v.id)}">` +
      `<div class="v-row-main">` +
      `<div class="v-row-head">` +
      `<span class="v-name">${esc(v.name)}${local}</span>` +
      `<span class="badge ${statusClass(v.status)}">${esc(v.status)}</span>` +
      quote +
      `</div>` +
      `<div class="v-meta">${esc(v.role)} · ${esc(v.org)}</div>` +
      (chips ? `<div class="v-chips">${chips}</div>` : '') +
      (v.notes ? `<p class="v-notes">${esc(v.notes)}</p>` : '') +
      `</div>` +
      contactActions(v) +
      (crud ? global.BcCmdCrud?.rowActionsHtml?.(v.id) ?? '' : '') +
      `</article>`
    );
  }

  function renderVendorsRich() {
    const list = global.BcCmdCrud?.getMergedVendors?.() ?? global.DATA?.vendors ?? [];
    const active = list.filter((v) => /ACTIVE|CONFIRMED|SIGNED|URGENT/i.test(v.status)).length;
    const groups = groupVendors(list);

    const body = groups
      .map(
        (g) =>
          `<section class="v-section">` +
          `<h2 class="v-section-title font-serif">${esc(g.label)} <span class="v-count">${g.items.length}</span></h2>` +
          `<div class="v-roster">${g.items.map((v) => renderVendorRow(v, true)).join('')}</div>` +
          `</section>`
      )
      .join('');

    const toolbar = global.BcCmdCrud?.toolbarHtml?.('Vendors', 'vendors') ?? '';

    return (
      `<div class="page-head"><h1 class="font-serif">Vendor roster</h1>` +
      `<p>${list.length} contacts · ${active} active · grouped by tier</p></div>` +
      `<div class="v-toolbar-extra">` +
      `<input type="search" id="v-search" class="v-search" placeholder="Filter by name, org, role…" aria-label="Filter vendors">` +
      `<a class="v-ext-link" href="/vendors" target="_blank" rel="noopener">Open vendors ops hub ↗</a>` +
      `</div>` +
      toolbar +
      `<div id="v-roster-root">${body}</div>`
    );
  }

  let bound = false;

  function bindVendorFilter() {
    if (bound) return;
    const main = document.getElementById('main');
    if (!main) return;
    main.addEventListener('input', (e) => {
      if (e.target.id !== 'v-search') return;
      const q = e.target.value.toLowerCase();
      main.querySelectorAll('.v-row').forEach((row) => {
        const text = row.textContent.toLowerCase();
        row.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });
    bound = true;
  }

  function initPhase7Vendors() {
    global.RENDERERS = global.RENDERERS || {};
    global.RENDERERS.vendors = renderVendorsRich;
    bindVendorFilter();
  }

  global.BcCmdVendors = { initPhase7Vendors, renderVendorsRich };
})(typeof window !== 'undefined' ? window : globalThis);
