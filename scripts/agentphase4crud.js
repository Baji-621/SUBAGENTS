/**
 * Phase 4 — Client-side CRUD overlay for Command Center
 * sessionStorage keys: bc_cmd_vendors | budget | contacts | events
 * Merge local layer with embedded DATA on load.
 */
(function (global) {
  'use strict';

  const KEYS = {
    vendors: 'bc_cmd_vendors',
    budget: 'bc_cmd_budget',
    contacts: 'bc_cmd_contacts',
    events: 'bc_cmd_events',
    theme: 'bc_cmd_theme',
    dark: 'bc_cmd_dark',
  };

  const ID_PREFIX = 'local-';

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

  function fmtShort(iso) {
    if (!iso) return { d: '—', m: '' };
    const d = new Date(iso + 'T12:00:00');
    return { d: d.getDate(), m: d.toLocaleDateString('en-US', { month: 'short' }) };
  }

  function loadLayer(key) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveLayer(key, arr) {
    sessionStorage.setItem(key, JSON.stringify(arr));
  }

  function newLocalId() {
    return ID_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function stripMeta(item) {
    const out = { ...item };
    delete out._updated;
    delete out._deleted;
    delete out._added;
    delete out._source;
    return out;
  }

  function mergeList(baseItems, layer, idPrefix) {
    const base = (baseItems || []).map((item, i) => ({
      ...item,
      id: item.id != null ? String(item.id) : `${idPrefix}-${i}`,
      _source: 'master',
    }));
    const deleted = new Set(layer.filter((x) => x._deleted).map((x) => String(x.id)));
    const updates = new Map(
      layer.filter((x) => x._updated && !x._deleted).map((x) => [String(x.id), x])
    );
    const added = layer.filter((x) => String(x.id || '').startsWith(ID_PREFIX) && !x._deleted);

    const merged = base
      .filter((x) => !deleted.has(x.id))
      .map((x) => (updates.has(x.id) ? { ...x, ...stripMeta(updates.get(x.id)), _source: x._source } : x));

    return [...merged, ...added.map((x) => ({ ...stripMeta(x), _source: 'local' }))];
  }

  function pushLayer(key, record) {
    const layer = loadLayer(key);
    layer.push(record);
    saveLayer(key, layer);
  }

  function upsertLayer(key, id, patch, flags) {
    const layer = loadLayer(key);
    const sid = String(id);
    if (sid.startsWith(ID_PREFIX)) {
      const idx = layer.findIndex((x) => String(x.id) === sid);
      if (idx >= 0) {
        layer[idx] = { ...layer[idx], ...patch, id: sid, ...flags };
      } else {
        layer.push({ ...patch, id: sid, ...flags });
      }
    } else {
      const idx = layer.findIndex((x) => String(x.id) === sid && x._updated);
      const record = { ...patch, id: sid, ...flags };
      if (idx >= 0) layer[idx] = { ...layer[idx], ...record };
      else layer.push(record);
    }
    saveLayer(key, layer);
  }

  function removeFromLayer(key, id) {
    const sid = String(id);
    let layer = loadLayer(key);
    if (sid.startsWith(ID_PREFIX)) {
      layer = layer.filter((x) => String(x.id) !== sid);
    } else {
      layer = layer.filter((x) => !(String(x.id) === sid && x._updated));
      layer.push({ id: sid, _deleted: true });
    }
    saveLayer(key, layer);
  }

  function toCsv(rows, columns) {
    const escCell = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => escCell(c.label)).join(',');
    const body = rows
      .map((row) => columns.map((c) => escCell(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(','))
      .join('\n');
    return header + '\n' + body;
  }

  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function eventRoute(name) {
    const n = String(name || '').toLowerCase();
    if (/ceremony|wedding|muhurtham|reception|patravali|baraat|pooja|maticoor|snathakam/i.test(n)) {
      if (/sangeet/i.test(n)) return 'sangeet';
      if (/haldi/i.test(n)) return 'haldi';
      if (/welcome|arrival/i.test(n)) return 'welcome';
      if (/ceremony|wedding|muhurtham/i.test(n)) return 'ceremony';
    }
    if (/sangeet/i.test(n)) return 'sangeet';
    if (/haldi|mehndi/i.test(n)) return 'haldi';
    if (/welcome|arrival/i.test(n)) return 'welcome';
    if (/ceremony|wedding|reception|baraat/i.test(n)) return 'ceremony';
    return '';
  }

  function eventChipHtml(name) {
    const route = eventRoute(name);
    if (!route) return '';
    return `<span class="event-chip chip-${route}" data-route="${route}">${esc(route)}</span>`;
  }

  function toolbarHtml(entityLabel, entityKey) {
    return (
      `<div class="crud-toolbar" data-entity="${esc(entityKey)}">` +
      `<span class="toolbar-title">${esc(entityLabel)} · local edits in this session</span>` +
      `<div class="toolbar-actions">` +
      `<button type="button" class="btn-primary" data-crud-add="${esc(entityKey)}">+ Add</button>` +
      `<button type="button" class="btn-ghost" data-crud-export="${esc(entityKey)}">Export CSV</button>` +
      (entityKey === 'budget'
        ? `<button type="button" class="btn-ghost" data-budget-sync-export>Export sync bundle</button>`
        : '') +
      `<button type="button" class="btn-ghost" data-crud-backup>Backup JSON</button>` +
      `</div></div>`
    );
  }

  function rowActionsHtml(id) {
    return (
      `<div class="crud-row-actions">` +
      `<button type="button" class="btn-ghost btn-icon" data-crud-edit="${esc(id)}">Edit</button>` +
      `<button type="button" class="btn-ghost btn-icon btn-danger" data-crud-delete="${esc(id)}">Delete</button>` +
      `</div>`
    );
  }

  function localBadge(item) {
    return item._source === 'local' || String(item.id || '').startsWith(ID_PREFIX)
      ? '<span class="local-badge">local</span>'
      : '';
  }

  /* ── Public merge getters ── */
  function getMergedVendors() {
    return mergeList(global.DATA?.vendors, loadLayer(KEYS.vendors), 'master-v');
  }

  function getMergedBudget() {
    return mergeList(global.DATA?.budget, loadLayer(KEYS.budget), 'master-b');
  }

  function getMergedContacts() {
    return mergeList(global.DATA?.contacts, loadLayer(KEYS.contacts), 'master-c');
  }

  function getMergedEvents() {
    return mergeList(global.DATA?.events, loadLayer(KEYS.events), 'master-e');
  }

  /* ── Vendors CRUD ── */
  function addVendor(item) {
    const id = newLocalId();
    pushLayer(KEYS.vendors, { ...item, id, _added: true });
    return id;
  }

  function updateVendor(id, patch) {
    upsertLayer(KEYS.vendors, id, patch, { _updated: true });
  }

  function deleteVendor(id) {
    removeFromLayer(KEYS.vendors, id);
  }

  function exportVendorsCsv() {
    const rows = getMergedVendors();
    const csv = toCsv(rows, [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'org', label: 'Organization' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'events', label: 'Events' },
      { key: 'notes', label: 'Notes' },
    ]);
    downloadText('bc-vendors.csv', csv, 'text/csv');
  }

  /* ── Budget CRUD ── */
  function addBudget(item) {
    const id = newLocalId();
    pushLayer(KEYS.budget, { ...item, id, _added: true });
    return id;
  }

  function updateBudget(id, patch) {
    upsertLayer(KEYS.budget, id, patch, { _updated: true });
  }

  function deleteBudget(id) {
    removeFromLayer(KEYS.budget, id);
  }

  function exportBudgetSyncBundle() {
    const layer = loadLayer(KEYS.budget);
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'bc_cmd_budget',
      layer,
      mergedCount: getMergedBudget().length,
    };
    downloadText('budget-sync-overlay.json', JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportBudgetCsv() {
    const rows = getMergedBudget();
    const csv = toCsv(rows, [
      { key: 'category', label: 'Category' },
      { key: 'item', label: 'Item' },
      { key: 'usd', label: 'USD' },
      { key: 'cad', label: 'CAD' },
      { key: 'status', label: 'Status' },
      { key: 'due', label: 'Due' },
      { key: 'notes', label: 'Notes' },
    ]);
    downloadText('bc-budget.csv', csv, 'text/csv');
  }

  /* ── Contacts CRUD ── */
  function addContact(item) {
    const id = newLocalId();
    pushLayer(KEYS.contacts, { ...item, id, _added: true });
    return id;
  }

  function updateContact(id, patch) {
    upsertLayer(KEYS.contacts, id, patch, { _updated: true });
  }

  function deleteContact(id) {
    removeFromLayer(KEYS.contacts, id);
  }

  function exportContactsCsv() {
    const rows = getMergedContacts();
    const csv = toCsv(rows, [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'company', label: 'Company' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'category', label: 'Category' },
    ]);
    downloadText('bc-contacts.csv', csv, 'text/csv');
  }

  /* ── Events CRUD ── */
  function addEvent(item) {
    const id = newLocalId();
    pushLayer(KEYS.events, { ...item, id, _added: true });
    return id;
  }

  function updateEvent(id, patch) {
    upsertLayer(KEYS.events, id, patch, { _updated: true });
  }

  function deleteEvent(id) {
    removeFromLayer(KEYS.events, id);
  }

  function exportEventsCsv() {
    const rows = getMergedEvents();
    const csv = toCsv(rows, [
      { key: 'name', label: 'Name' },
      { key: 'date', label: 'Date' },
      { key: 'time', label: 'Time' },
      { key: 'venue', label: 'Venue' },
      { key: 'theme', label: 'Theme' },
      { key: 'notes', label: 'Notes' },
    ]);
    downloadText('bc-events.csv', csv, 'text/csv');
  }

  function exportAllJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      vendors: loadLayer(KEYS.vendors),
      budget: loadLayer(KEYS.budget),
      contacts: loadLayer(KEYS.contacts),
      events: loadLayer(KEYS.events),
      merged: {
        vendors: getMergedVendors(),
        budget: getMergedBudget(),
        contacts: getMergedContacts(),
        events: getMergedEvents(),
      },
    };
    downloadText(
      'bc-cmd-local-backup.json',
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  /* ── Modal ── */
  let modalEntity = null;
  let modalItemId = null;

  const FORM_FIELDS = {
    vendors: [
      { name: 'name', label: 'Name', required: true },
      { name: 'role', label: 'Role' },
      { name: 'org', label: 'Organization' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      { name: 'status', label: 'Status' },
      { name: 'events', label: 'Events' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    budget: [
      { name: 'category', label: 'Category', required: true },
      { name: 'item', label: 'Item', required: true },
      { name: 'usd', label: 'USD', type: 'number' },
      { name: 'cad', label: 'CAD', type: 'number' },
      { name: 'status', label: 'Status' },
      { name: 'due', label: 'Due', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    contacts: [
      { name: 'name', label: 'Name', required: true },
      { name: 'role', label: 'Role' },
      { name: 'company', label: 'Company' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: ['planner', 'vendor', 'travel', 'family', 'other'],
      },
    ],
    events: [
      { name: 'name', label: 'Event name', required: true },
      { name: 'date', label: 'Date', type: 'date' },
      { name: 'time', label: 'Time' },
      { name: 'venue', label: 'Venue' },
      { name: 'theme', label: 'Dress / theme' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
  };

  function ensureModalDom() {
    if (document.getElementById('bc-crud-modal')) return;
    const el = document.createElement('div');
    el.id = 'bc-crud-modal';
    el.className = 'modal-backdrop';
    el.hidden = true;
    el.innerHTML =
      '<div class="modal-panel" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2 id="bc-modal-title">Edit</h2>' +
      '<button type="button" class="modal-close" id="bc-modal-close" aria-label="Close">×</button></div>' +
      '<div class="modal-body"><form id="bc-modal-form" class="crud-form"></form></div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      if (e.target === el) hideModal();
    });
    document.getElementById('bc-modal-close').addEventListener('click', hideModal);
    document.getElementById('bc-modal-form').addEventListener('submit', onModalSubmit);
  }

  function findItem(entity, id) {
    const getters = {
      vendors: getMergedVendors,
      budget: getMergedBudget,
      contacts: getMergedContacts,
      events: getMergedEvents,
    };
    return (getters[entity]() || []).find((x) => String(x.id) === String(id));
  }

  function buildFormHtml(entity, item) {
    const fields = FORM_FIELDS[entity] || [];
    return fields
      .map((f) => {
        const val = item ? item[f.name] : '';
        const req = f.required ? ' required' : '';
        if (f.type === 'textarea') {
          return (
            `<div class="form-row"><label for="f-${f.name}">${esc(f.label)}</label>` +
            `<textarea id="f-${f.name}" name="${esc(f.name)}"${req}>${esc(val)}</textarea></div>`
          );
        }
        if (f.type === 'select') {
          const opts = (f.options || [])
            .map(
              (o) =>
                `<option value="${esc(o)}"${String(val) === o ? ' selected' : ''}>${esc(o)}</option>`
            )
            .join('');
          return (
            `<div class="form-row"><label for="f-${f.name}">${esc(f.label)}</label>` +
            `<select id="f-${f.name}" name="${esc(f.name)}"${req}>${opts}</select></div>`
          );
        }
        const type = f.type || 'text';
        const numVal = val != null && val !== '' ? val : '';
        return (
          `<div class="form-row"><label for="f-${f.name}">${esc(f.label)}</label>` +
          `<input id="f-${f.name}" name="${esc(f.name)}" type="${type}" value="${esc(numVal)}"${req}></div>`
        );
      })
      .join('') +
      '<div class="form-actions">' +
      '<button type="button" class="btn-ghost" id="bc-modal-cancel">Cancel</button>' +
      '<button type="submit" class="btn-primary">Save</button></div>';
  }

  function showModal(entity, item) {
    ensureModalDom();
    modalEntity = entity;
    modalItemId = item ? item.id : null;
    const backdrop = document.getElementById('bc-crud-modal');
    const title = document.getElementById('bc-modal-title');
    const form = document.getElementById('bc-modal-form');
    title.textContent = item ? `Edit ${entity.slice(0, -1)}` : `Add ${entity.slice(0, -1)}`;
    form.innerHTML = buildFormHtml(entity, item || null);
    form.querySelector('#bc-modal-cancel').addEventListener('click', hideModal);
    backdrop.hidden = false;
  }

  function hideModal() {
    const backdrop = document.getElementById('bc-crud-modal');
    if (backdrop) backdrop.hidden = true;
    modalEntity = null;
    modalItemId = null;
  }

  function readFormData(form) {
    const data = {};
    new FormData(form).forEach((v, k) => {
      if (k === 'usd' || k === 'cad') {
        data[k] = v === '' ? null : Number(v);
      } else {
        data[k] = v;
      }
    });
    return data;
  }

  function onModalSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = readFormData(form);
    const ops = {
      vendors: { add: addVendor, update: updateVendor },
      budget: { add: addBudget, update: updateBudget },
      contacts: { add: addContact, update: updateContact },
      events: { add: addEvent, update: updateEvent },
    };
    const op = ops[modalEntity];
    if (!op) return;
    if (modalItemId) op.update(modalItemId, data);
    else op.add(data);
    hideModal();
    if (typeof global.render === 'function') global.render();
  }

  /* ── Updated renderers ── */
  function renderVendors() {
    const list = getMergedVendors();
    const cards = list
      .map((v) => {
        const bc =
          v.status === 'ACTIVE' || v.status === 'CONFIRMED' || v.status === 'SIGNED'
            ? 'b-ok'
            : 'b-warn';
        const cls = v._source === 'local' ? ' local-item' : '';
        return (
          `<article class="v-card${cls}" data-id="${esc(v.id)}">` +
          `<h3>${esc(v.name)}${localBadge(v)}</h3>` +
          `<div class="v-role">${esc(v.role)} · ${esc(v.org)}</div>` +
          `<span class="badge ${bc}">${esc(v.status)}</span>` +
          (v.email
            ? `<div class="v-row"><strong>Email</strong> <a href="mailto:${esc(v.email)}">${esc(v.email)}</a></div>`
            : '') +
          (v.phone
            ? `<div class="v-row"><strong>Phone</strong> <a href="tel:${esc(v.phone)}">${esc(v.phone)}</a></div>`
            : '') +
          (v.events ? `<div class="v-row"><strong>Events</strong> ${esc(v.events)}</div>` : '') +
          (v.notes ? `<div class="v-row">${esc(v.notes)}</div>` : '') +
          rowActionsHtml(v.id) +
          `</article>`
        );
      })
      .join('');
    return (
      `<div class="page-head"><h1 class="font-serif">Vendor Roster</h1>` +
      `<p>${list.length} vendors · master + session edits</p></div>` +
      toolbarHtml('Vendors', 'vendors') +
      `<div class="vendor-grid">${cards}</div>`
    );
  }

  function renderBudget() {
    const list = getMergedBudget();
    const rows = list
      .map((b) => {
        const amt =
          b.usd != null
            ? '$' + Number(b.usd).toLocaleString()
            : b.cad != null
              ? 'C$' + Number(b.cad).toLocaleString()
              : '—';
        const sc =
          b.status === 'PAID'
            ? 'b-ok'
            : b.status === 'OVERDUE'
              ? 'b-bad'
              : b.status === 'REFERENCE'
                ? 'b-muted'
                : 'b-warn';
        const cls = b._source === 'local' ? ' class="local-item"' : '';
        return (
          `<tr${cls} data-id="${esc(b.id)}">` +
          `<td>${esc(b.category)}</td><td>${esc(b.item)}${localBadge(b)}</td><td>${amt}</td>` +
          `<td><span class="badge ${sc}">${esc(b.status)}</span></td>` +
          `<td style="font-size:12px;color:var(--muted)">${esc(b.due || '')}</td>` +
          `<td>${rowActionsHtml(b.id)}</td></tr>`
        );
      })
      .join('');
    const s = global.DATA?.stats || {};
    return (
      `<div class="page-head"><h1 class="font-serif">Budget Overview</h1>` +
      `<p>Master + session edits · FX ${global.DATA?.meta?.fxDefault || 1.37} · <a href="https://docs.google.com/spreadsheets/d/1lwmu8dTuz4KtyX_lwsdGMzqJ6BM9mINafDmzdQd2t3w/edit#gid=0" target="_blank" rel="noopener" style="color:var(--accent)">OS_Budget sheet ↗</a></p></div>` +
      toolbarHtml('Budget', 'budget') +
      `<div class="grid-4" style="grid-template-columns:repeat(3,1fr)">` +
      `<div class="card"><div class="card-label">Est. Total (USD)</div><div class="card-val">$${(s.totalBudgetUsd || 0).toLocaleString()}</div></div>` +
      `<div class="card"><div class="card-label">Paid</div><div class="card-val">$${(s.paidBudgetUsd || 0).toLocaleString()}</div></div>` +
      `<div class="card"><div class="card-label">Remaining</div><div class="card-val">$${Math.max(0, (s.totalBudgetUsd || 0) - (s.paidBudgetUsd || 0)).toLocaleString()}</div></div></div>` +
      `<div class="card" style="margin-top:16px;overflow-x:auto"><table><thead><tr>` +
      `<th>Category</th><th>Item</th><th>Amount</th><th>Status</th><th>Due</th><th>Actions</th>` +
      `</tr></thead><tbody>${rows}</tbody></table></div>`
    );
  }

  function renderContacts() {
    const list = getMergedContacts();
    const quick = list.filter((c) => /raj|jennyfer|natasha/i.test(c.name)).slice(0, 3);
    const quickHtml = quick
      .map(
        (c) =>
          `<a class="quick-btn" href="tel:${esc(c.phone || '')}">${esc(c.name)}` +
          `<br><span style="font-size:12px;font-weight:400">${esc(c.phone || c.email || '')}</span></a>`
      )
      .join('');
    const rows = list
      .map((c) => {
        const cls = c._source === 'local' ? ' local-item' : '';
        return (
          `<div class="contact-row${cls}" data-id="${esc(c.id)}">` +
          `<span class="name">${esc(c.name)}${localBadge(c)}</span>` +
          `<span class="badge b-muted">${esc(c.category)}</span>` +
          `<span style="color:var(--muted);font-size:13px">${esc(c.role)}${c.company ? ' · ' + esc(c.company) : ''}</span>` +
          (c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '') +
          (c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '') +
          rowActionsHtml(c.id) +
          `</div>`
        );
      })
      .join('');
    return (
      `<div class="page-head"><h1 class="font-serif">Contacts &amp; Communications</h1></div>` +
      toolbarHtml('Contacts', 'contacts') +
      `<div class="quick-dial">${quickHtml}</div>` +
      `<div class="contact-list">${rows}</div>`
    );
  }

  function renderEvents() {
    const list = getMergedEvents();
    const groups = {};
    for (const e of list) {
      (groups[e.date || 'TBD'] = groups[e.date || 'TBD'] || []).push(e);
    }
    const html = Object.keys(groups)
      .sort()
      .map((date) => {
        const { d, m } = fmtShort(date === 'TBD' ? '' : date);
        const rows = groups[date]
          .map((e) => {
            const key = date === '2026-06-20' || date === '2026-06-21';
            const cls = e._source === 'local' ? ' local-item' : '';
            return (
              `<div class="event-row${key ? ' key' : ''}${cls}" data-id="${esc(e.id)}">` +
              `<div class="date-badge"><div class="d">${d}</div><div class="m">${m}</div></div>` +
              `<div style="flex:1">` +
              `<strong class="font-serif" style="font-size:18px">${esc(e.name)}</strong>` +
              localBadge(e) +
              ` ${eventChipHtml(e.name)}` +
              (key ? ' <span class="badge b-warn">Key Event</span>' : '') +
              `<div style="font-size:12px;color:var(--muted);margin-top:6px">${esc(e.time)} · ${esc(e.venue)}</div>` +
              (e.theme
                ? `<div style="font-size:12px;color:var(--accent);margin-top:4px;font-style:italic">Dress: ${esc(e.theme)}</div>`
                : '') +
              rowActionsHtml(e.id) +
              `</div></div>`
            );
          })
          .join('');
        return (
          `<div class="section-title font-serif">${date === 'TBD' ? 'Unscheduled' : fmtDate(date)}</div>` +
          `<div class="card">${rows}</div>`
        );
      })
      .join('');
    return (
      `<div class="page-head"><h1 class="font-serif">Wedding Week</h1>` +
      `<p>Jun 16–22, 2026 · master + session edits</p></div>` +
      toolbarHtml('Events', 'events') +
      html
    );
  }

  /* ── Theme picker ── */
  function applyTheme(themeId) {
    const html = document.documentElement;
    html.setAttribute('data-theme', themeId);
    try {
      sessionStorage.setItem(KEYS.theme, themeId);
    } catch (_) {}
    document.querySelectorAll('.theme-swatch').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === themeId);
    });
  }

  function applyDarkMode(dark) {
    document.documentElement.classList.toggle('dark', dark);
    try {
      sessionStorage.setItem(KEYS.dark, dark ? '1' : '0');
    } catch (_) {}
  }

  function initThemePicker() {
    const foot = document.querySelector('.sb-foot');
    if (!foot || document.getElementById('bc-theme-picker')) return;

    const savedTheme = sessionStorage.getItem(KEYS.theme) || 'ivory';
    const savedDark = sessionStorage.getItem(KEYS.dark) === '1';
    applyTheme(savedTheme);
    applyDarkMode(savedDark);

    const picker = document.createElement('div');
    picker.id = 'bc-theme-picker';
    picker.className = 'theme-picker';
    picker.innerHTML =
      '<div class="theme-picker-label">Chromatic preset</div>' +
      '<div class="theme-swatches">' +
      ['ivory', 'midnight', 'turmeric', 'peacock']
        .map(
          (t) =>
            `<button type="button" class="theme-swatch${t === savedTheme ? ' active' : ''}" data-theme="${t}">${t}</button>`
        )
        .join('') +
      '</div>' +
      `<button type="button" class="mode-toggle" id="bc-mode-toggle">${savedDark ? '☀ Light mode' : '☾ Dark mode'}</button>`;

    const oldBtn = document.getElementById('theme-btn');
    if (oldBtn) oldBtn.remove();
    foot.insertBefore(picker, foot.firstChild);

    picker.querySelectorAll('.theme-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.theme;
        if (t === 'midnight') {
          applyTheme('midnight');
          applyDarkMode(true);
        } else {
          applyTheme(t);
          applyDarkMode(false);
        }
        updateModeLabel();
      });
    });

    function updateModeLabel() {
      const toggle = document.getElementById('bc-mode-toggle');
      if (toggle) {
        toggle.textContent = document.documentElement.classList.contains('dark')
          ? '☀ Light mode'
          : '☾ Dark mode';
      }
    }

    document.getElementById('bc-mode-toggle').addEventListener('click', () => {
      const next = !document.documentElement.classList.contains('dark');
      applyDarkMode(next);
      if (next && !document.documentElement.getAttribute('data-theme')) applyTheme('midnight');
      updateModeLabel();
    });
  }

  /* ── CRUD click delegation ── */
  function bindCrudClicks() {
    const main = document.getElementById('main');
    if (!main || main.dataset.crudBound) return;
    main.dataset.crudBound = '1';

    main.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-crud-add]');
      if (addBtn) {
        showModal(addBtn.dataset.crudAdd, null);
        return;
      }
      if (e.target.closest('[data-budget-sync-export]')) {
        exportBudgetSyncBundle();
        return;
      }
      const exportBtn = e.target.closest('[data-crud-export]');
      if (exportBtn) {
        const map = {
          vendors: exportVendorsCsv,
          budget: exportBudgetCsv,
          contacts: exportContactsCsv,
          events: exportEventsCsv,
        };
        (map[exportBtn.dataset.crudExport] || exportAllJson)();
        return;
      }
      if (e.target.closest('[data-crud-backup]')) {
        exportAllJson();
        return;
      }
      const editBtn = e.target.closest('[data-crud-edit]');
      if (editBtn) {
        const row = editBtn.closest('[data-id]');
        const entity = routeToEntity(currentRoute());
        const id = editBtn.dataset.crudEdit;
        const item = findItem(entity, id);
        if (item) showModal(entity, item);
        return;
      }
      const delBtn = e.target.closest('[data-crud-delete]');
      if (delBtn) {
        const entity = routeToEntity(currentRoute());
        const id = delBtn.dataset.crudDelete;
        if (!confirm('Remove this item from the merged view? Local deletes stay in session only.')) return;
        const delMap = {
          vendors: deleteVendor,
          budget: deleteBudget,
          contacts: deleteContact,
          events: deleteEvent,
        };
        (delMap[entity] || (() => {}))(id);
        if (typeof global.render === 'function') global.render();
      }
    });
  }

  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    return h.split('/')[0] || 'dashboard';
  }

  function routeToEntity(r) {
    if (r === 'vendors' || r === 'budget' || r === 'contacts' || r === 'events') return r;
    const toolbar = document.querySelector('.crud-toolbar[data-entity]');
    if (toolbar) return toolbar.dataset.entity;
    return 'vendors';
  }

  function patchRenderers() {
    if (!global.RENDERERS) return;
    global.RENDERERS.vendors = renderVendors;
    global.RENDERERS.budget = renderBudget;
    global.RENDERERS.contacts = renderContacts;
    global.RENDERERS.events = renderEvents;
  }

  function initPhase4Crud() {
    ensureModalDom();
    patchRenderers();
    bindCrudClicks();
    initThemePicker();
  }

  const api = {
    KEYS,
    getMergedVendors,
    getMergedBudget,
    getMergedContacts,
    getMergedEvents,
    addVendor,
    updateVendor,
    deleteVendor,
    exportVendorsCsv,
    addBudget,
    updateBudget,
    deleteBudget,
    exportBudgetCsv,
    exportBudgetSyncBundle,
    addContact,
    updateContact,
    deleteContact,
    exportContactsCsv,
    addEvent,
    updateEvent,
    deleteEvent,
    exportEventsCsv,
    exportAllJson,
    rowActionsHtml,
    showModal,
    hideModal,
    renderVendors,
    renderBudget,
    renderContacts,
    renderEvents,
    initPhase4Crud,
    applyTheme,
    applyDarkMode,
    eventRoute,
  };

  global.BcCmdCrud = api;
})(typeof window !== 'undefined' ? window : globalThis);
