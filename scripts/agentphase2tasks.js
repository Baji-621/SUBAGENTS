/* Phase 2 — interactive task management (splice into APP_JS in build-command-center-app.mjs) */

const TASK_STORAGE_KEY = 'bc_cmd_tasks';
const TASK_STATUSES = ['todo', 'in_progress', 'done'];

function emptyTaskState() {
  return { edits: {}, added: [], deleted: [] };
}

function loadTaskState() {
  try {
    const raw = sessionStorage.getItem(TASK_STORAGE_KEY);
    if (!raw) return emptyTaskState();
    const parsed = JSON.parse(raw);
    return {
      edits: parsed.edits && typeof parsed.edits === 'object' ? parsed.edits : {},
      added: Array.isArray(parsed.added) ? parsed.added : [],
      deleted: Array.isArray(parsed.deleted) ? parsed.deleted : [],
    };
  } catch (e) {
    return emptyTaskState();
  }
}

function saveTaskState(state) {
  const payload = state || loadTaskState();
  try {
    sessionStorage.setItem(TASK_STORAGE_KEY, JSON.stringify({
      edits: payload.edits || {},
      added: payload.added || [],
      deleted: payload.deleted || [],
    }));
  } catch (e) { /* quota / private mode */ }
}

function bucketDefaultStatus(bucket) {
  const b = String(bucket || '').toLowerCase();
  if (b === 'urgent') return 'todo';
  if (b === 'thisweek' || b === 'this_week' || b === 'this week') return 'in_progress';
  if (b === 'sprint') return 'done';
  return 'todo';
}

function statusFromRaw(raw) {
  const s = String(raw || '').toLowerCase().replace(/\s+/g, '_');
  if (s === 'done' || s === 'closed' || s === 'complete' || s === 'completed') return 'done';
  if (s === 'in_progress' || s === 'inprogress' || s === 'progress' || s === 'active' || s === 'tmrw' || s === 'tomorrow') return 'in_progress';
  if (s === 'milestone') return 'done';
  if (s === 'todo' || s === 'open' || s === 'pending' || s === 'new') return 'todo';
  return '';
}

function normalizeStatus(t) {
  if (!t) return 'todo';
  const explicit = statusFromRaw(t.status);
  if (explicit) return explicit;
  return bucketDefaultStatus(t.bucket);
}

function resolveBaseId(t, index) {
  return t.id != null && t.id !== '' ? String(t.id) : 'ssot-' + index;
}

function getMergedTasks(baseTasks) {
  const state = loadTaskState();
  const deleted = new Set((state.deleted || []).map(String));
  const merged = [];

  (baseTasks || []).forEach((base, index) => {
    const id = resolveBaseId(base, index);
    if (deleted.has(id)) return;
    const edit = state.edits[id] || {};
    const row = Object.assign({}, base, edit, { id });
    row.status = normalizeStatus(row);
    merged.push(row);
  });

  for (const added of state.added || []) {
    if (!added || !added.id || deleted.has(String(added.id))) continue;
    const row = Object.assign({}, added);
    row.status = normalizeStatus(row);
    merged.push(row);
  }

  return merged;
}

function findMergedTask(id) {
  return getMergedTasks(DATA.tasks || []).find(t => String(t.id) === String(id));
}

function isLocalTaskId(id) {
  return String(id).startsWith('local-');
}

function patchTaskState(mutator) {
  const state = loadTaskState();
  mutator(state);
  saveTaskState(state);
}

function setTaskField(id, fields) {
  patchTaskState(state => {
    if (isLocalTaskId(id)) {
      const idx = state.added.findIndex(t => String(t.id) === String(id));
      if (idx >= 0) Object.assign(state.added[idx], fields);
      return;
    }
    state.edits[id] = Object.assign({}, state.edits[id] || {}, fields);
  });
}

function cycleStatus(id) {
  const t = findMergedTask(id);
  if (!t) return;
  const order = TASK_STATUSES;
  const cur = normalizeStatus(t);
  const next = order[(order.indexOf(cur) + 1) % order.length];
  setTaskField(id, { status: next });
  saveTaskState();
  refreshStats();
  render();
}

function toggleTaskDone(id) {
  const t = findMergedTask(id);
  if (!t) return;
  const next = normalizeStatus(t) === 'done' ? 'todo' : 'done';
  setTaskField(id, { status: next });
  saveTaskState();
  refreshStats();
  render();
}

function addTask(fields) {
  const owner = String(fields?.owner || '').trim();
  const task = String(fields?.task || '').trim();
  if (!task) return false;
  const priority = String(fields?.priority || 'medium').toLowerCase();
  let bucket = 'thisWeek';
  if (priority === 'urgent' || priority === 'high') bucket = 'urgent';
  else if (priority === 'low' || priority === 'sprint') bucket = 'sprint';

  const row = {
    id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    owner: owner || 'Baji',
    task,
    due: fields?.due || '',
    bucket,
    priority,
    status: 'todo',
  };

  patchTaskState(state => {
    state.added.push(row);
  });
  saveTaskState();
  refreshStats();
  render();
  return true;
}

function deleteTask(id) {
  const sid = String(id);
  patchTaskState(state => {
    if (isLocalTaskId(sid)) {
      state.added = state.added.filter(t => String(t.id) !== sid);
      return;
    }
    if (!state.deleted.includes(sid)) state.deleted.push(sid);
    delete state.edits[sid];
  });
  saveTaskState();
  refreshStats();
  render();
}

function csvCell(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportTasksCsv() {
  const tasks = getMergedTasks(DATA.tasks || []);
  const headers = ['id', 'owner', 'task', 'due', 'status', 'bucket', 'priority'];
  const lines = [headers.join(',')].concat(
    tasks.map(t => headers.map(h => csvCell(t[h])).join(','))
  );
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bc-wedding-tasks-' + new Date().toISOString().slice(0, 10) + '.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportTaskSyncBundle() {
  const state = loadTaskState();
  const merged = getMergedTasks(DATA.tasks || []);
  const payload = {
    exportedAt: new Date().toISOString(),
    source: 'CB_Command_Center_App',
    edits: state.edits,
    added: state.added,
    deleted: state.deleted,
    mergedTasks: merged.map(t => ({
      id: t.id,
      owner: t.owner,
      task: t.task,
      due: t.due,
      status: normalizeStatus(t),
      bucket: t.bucket,
      priority: t.priority,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'task-sync-overlay.json';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function resetLocalTaskChanges() {
  try {
    sessionStorage.removeItem(TASK_STORAGE_KEY);
  } catch (e) { /* ignore */ }
  refreshStats();
  render();
}

function hasLocalTaskChanges() {
  const s = loadTaskState();
  return Object.keys(s.edits).length > 0 || s.added.length > 0 || s.deleted.length > 0;
}

function refreshStats() {
  if (!DATA || !DATA.stats) return;
  const tasks = getMergedTasks(DATA.tasks || []);
  const open = tasks.filter(t => normalizeStatus(t) !== 'done');
  DATA.stats.openTasks = open.length;
  DATA.stats.urgentTasks = tasks.filter(
    t => String(t.bucket || '').toLowerCase() === 'urgent' && normalizeStatus(t) !== 'done'
  ).length;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(st) {
  if (st === 'in_progress') return 'In progress';
  if (st === 'done') return 'Done';
  return 'Todo';
}

function renderStatusSelect(id, st) {
  return '<select class="task-status-select" data-action="task-status" data-task-id="' + esc(id) + '" aria-label="Task status">' +
    TASK_STATUSES.map(s =>
      '<option value="' + s + '"' + (s === st ? ' selected' : '') + '>' + statusLabel(s) + '</option>'
    ).join('') +
    '</select>';
}

function renderTaskCard(t, opts) {
  const compact = !!(opts && opts.compact);
  const st = normalizeStatus(t);
  const overdue = t.due && t.due < todayIso() && st !== 'done';
  const checked = st === 'done';
  const id = esc(t.id);
  const controls = compact
    ? '<input type="checkbox" class="task-check" data-action="task-toggle" data-task-id="' + id + '"' +
      (checked ? ' checked' : '') + ' aria-label="Mark task done">'
    : '<input type="checkbox" class="task-check" data-action="task-toggle" data-task-id="' + id + '"' +
      (checked ? ' checked' : '') + ' aria-label="Mark task done">' +
      renderStatusSelect(t.id, st) +
      '<button type="button" class="task-del-btn" data-action="task-delete" data-task-id="' + id + '" aria-label="Delete task" title="Delete">×</button>';

  return '<div class="task-item' + (overdue ? ' overdue' : '') + (checked ? ' done' : '') + '" data-task-id="' + id + '">' +
    controls +
    '<div class="task-body">' +
    '<span class="badge b-muted">' + esc(t.bucket || '—') + '</span> ' +
    '<strong>' + esc(t.owner) + '</strong>' +
    '<div style="margin-top:6px' + (checked ? ';text-decoration:line-through;opacity:.75' : '') + '">' + esc(t.task) + '</div>' +
    (t.due ? '<div style="font-size:11px;color:var(--muted);margin-top:4px">Due ' + esc(t.due) + '</div>' : '') +
    '</div></div>';
}

function renderDashboard() {
  const s = DATA.stats;
  const days = s.daysUntilWedding;
  const daysLabel = days > 0 ? days + ' days until the ceremony' : days === 0 ? 'The day has arrived!' : 'Celebration complete';
  const alerts = (DATA.alerts || []).slice(0, 5).map(a =>
    '<div class="alert ' + esc(a.level) + '">' + esc(a.text) + '</div>'
  ).join('');
  const upcoming = (DATA.events || []).slice(0, 4).map(e => {
    const { d, m } = fmtShort(e.date);
    const key = e.date === '2026-06-20' || e.date === '2026-06-21';
    return '<div class="event-row' + (key ? ' key' : '') + '">' +
      '<div class="date-badge"><div class="d">' + d + '</div><div class="m">' + m + '</div></div>' +
      '<div><strong>' + esc(e.name) + '</strong><div style="font-size:12px;color:var(--muted);margin-top:4px">' +
      esc(e.time || '') + ' · ' + esc(e.venue) + '</div></div></div>';
  }).join('');
  const merged = getMergedTasks(DATA.tasks || []);
  const priorityTasks = merged
    .filter(t => String(t.bucket || '').toLowerCase() === 'urgent')
    .slice(0, 6);
  const tasksHtml = priorityTasks.length
    ? priorityTasks.map(t => renderTaskCard(t, { compact: true })).join('')
    : '<p style="color:var(--muted)">None</p>';
  const paidPct = s.totalBudgetUsd ? Math.round((s.paidBudgetUsd / s.totalBudgetUsd) * 100) : s.budgetPaidPct;
  const openCount = s.openTasks != null ? s.openTasks : merged.filter(t => normalizeStatus(t) !== 'done').length;

  return '<div class="page-head"><h1 class="font-serif">Wedding Command Center</h1>' +
    '<p>Bharadwaj &amp; Catherina · Grand Palladium, Cancún · June 20, 2026</p></div>' +
    '<div class="banner">' + esc(days > 0 ? days + ' days to go' : daysLabel) +
    ' · Hindu Ceremony · June 20 · 7:55 AM · Glassroom</div>' +
    (alerts ? '<div class="alert-list">' + alerts + '</div>' : '') +
    '<div class="grid-4">' +
    '<div class="card"><div class="card-label">Days Until</div><div class="card-val">' + (days > 0 ? days : '✦') + '</div><div style="font-size:12px;color:var(--muted)">' + esc(daysLabel) + '</div></div>' +
    '<div class="card"><div class="card-label">Urgent Tasks</div><div class="card-val">' + s.urgentTasks + '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin-top:6px">' + openCount + ' open overall</div>' +
    '<div class="progress"><span style="width:' + Math.min(100, s.urgentTasks * 10) + '%"></span></div></div>' +
    '<div class="card"><div class="card-label">Active Vendors</div><div class="card-val">' + s.activeVendors + '/' + s.totalVendors + '</div></div>' +
    '<div class="card"><div class="card-label">Budget Paid</div><div class="card-val">' + paidPct + '%</div><div class="progress"><span style="width:' + paidPct + '%"></span></div></div>' +
    '</div>' +
    '<div class="section-title font-serif">Upcoming Events</div><div class="card">' + (upcoming || '<p style="color:var(--muted)">No events</p>') + '</div>' +
    '<div class="section-title font-serif">Priority Tasks</div><div class="task-list" data-task-list="dashboard">' + tasksHtml + '</div>' +
    (s.lastLiveRefresh ? '<p class="live-pill">Live stats · refreshed <strong>' + esc(new Date(s.lastLiveRefresh).toLocaleTimeString()) + '</strong></p>' : '');
}

function renderTasks() {
  const merged = getMergedTasks(DATA.tasks || []);
  const cols = { todo: [], in_progress: [], done: [] };
  for (const t of merged) {
    const st = normalizeStatus(t);
    if (st === 'done') cols.done.push(t);
    else if (st === 'in_progress') cols.in_progress.push(t);
    else cols.todo.push(t);
  }

  function col(title, items) {
    return '<div class="k-col"><h3>' + title + ' (' + items.length + ')</h3>' +
      '<div class="task-list">' +
      (items.length ? items.map(t => renderTaskCard(t)).join('') : '<p style="color:var(--muted);font-size:12px">No tasks</p>') +
      '</div></div>';
  }

  const localHint = hasLocalTaskChanges()
    ? '<span class="badge b-warn" style="margin-left:8px">Local edits</span>'
    : '';

  return '<div class="page-head"><h1 class="font-serif">Task Tracker</h1><p>' + merged.length + ' items · SSOT + session overrides' + localHint + '</p></div>' +
    '<div class="task-toolbar" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px">' +
    '<button type="button" class="btn-primary" style="width:auto" data-action="task-add-toggle" data-testid="task-add-toggle">+ Add Task</button>' +
    '<button type="button" class="theme-btn" style="width:auto;margin:0" data-action="task-export-csv" data-testid="task-export-csv">Export CSV</button>' +
    '<button type="button" class="theme-btn" style="width:auto;margin:0" data-action="task-export-sync" data-testid="task-export-sync">Export sync bundle</button>' +
    '<button type="button" class="theme-btn" style="width:auto;margin:0" data-action="task-reset" data-testid="task-reset">Reset local changes</button>' +
    '</div>' +
    '<form id="task-add-form" class="card" style="display:none;margin-bottom:16px" data-task-form="add">' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">' +
    '<label style="font-size:12px;color:var(--muted)">Owner<input name="owner" class="gate-input" style="margin-top:4px" placeholder="Baji" data-testid="task-add-owner"></label>' +
    '<label style="font-size:12px;color:var(--muted)">Task<input name="task" class="gate-input" style="margin-top:4px" required placeholder="What needs doing?" data-testid="task-add-task"></label>' +
    '<label style="font-size:12px;color:var(--muted)">Due<input name="due" type="date" class="gate-input" style="margin-top:4px" data-testid="task-add-due"></label>' +
    '<label style="font-size:12px;color:var(--muted)">Priority<select name="priority" class="gate-input" style="margin-top:4px" data-testid="task-add-priority">' +
    '<option value="urgent">Urgent</option><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></label>' +
    '</div>' +
    '<div style="display:flex;gap:10px;margin-top:12px">' +
    '<button type="submit" class="gate-btn" style="width:auto;padding:10px 18px" data-action="task-add-submit" data-testid="task-add-submit">Save task</button>' +
    '<button type="button" class="theme-btn" style="width:auto;margin:0" data-action="task-add-cancel">Cancel</button>' +
    '</div></form>' +
    '<div class="kanban" data-task-board="kanban">' +
    col('Todo', cols.todo) + col('In progress', cols.in_progress) + col('Done', cols.done) +
    '</div>';
}

let taskEventsBound = false;

function handleTaskClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === 'task-add-toggle') {
    const form = document.getElementById('task-add-form');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    return;
  }
  if (action === 'task-add-cancel') {
    const form = document.getElementById('task-add-form');
    if (form) {
      form.style.display = 'none';
      form.reset();
    }
    return;
  }
  if (action === 'task-export-csv') {
    exportTasksCsv();
    return;
  }
  if (action === 'task-export-sync') {
    exportTaskSyncBundle();
    return;
  }
  if (action === 'task-reset') {
    if (confirm('Clear all local task edits, additions, and deletions? SSOT data in the page is unchanged.')) {
      resetLocalTaskChanges();
    }
    return;
  }
  if (action === 'task-delete') {
    const id = actionEl.dataset.taskId;
    if (id && confirm('Remove this task from your local view?')) deleteTask(id);
    return;
  }
  if (action === 'task-toggle') {
    const id = actionEl.dataset.taskId;
    if (id) toggleTaskDone(id);
  }
}

function handleTaskChange(e) {
  const el = e.target.closest('[data-action="task-status"]');
  if (!el) return;
  const id = el.dataset.taskId;
  const status = el.value;
  if (!id || !TASK_STATUSES.includes(status)) return;
  setTaskField(id, { status });
  saveTaskState();
  refreshStats();
  render();
}

function handleTaskSubmit(e) {
  const form = e.target.closest('#task-add-form');
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const ok = addTask({
    owner: fd.get('owner'),
    task: fd.get('task'),
    due: fd.get('due'),
    priority: fd.get('priority'),
  });
  if (ok) {
    form.reset();
    form.style.display = 'none';
  }
}

function bindTaskEvents() {
  const main = document.getElementById('main');
  if (!main) return;
  if (!taskEventsBound) {
    main.addEventListener('click', handleTaskClick);
    main.addEventListener('change', handleTaskChange);
    main.addEventListener('submit', handleTaskSubmit);
    taskEventsBound = true;
  }
}

function render() {
  const r = route();
  setActiveNav(r);
  const fn = RENDERERS[r] || RENDERERS.dashboard;
  document.getElementById('main').innerHTML = fn();
  document.title = 'B & C Command Center · ' + r.charAt(0).toUpperCase() + r.slice(1);
  bindTaskEvents();
}

function initApp() {
  try {
    const el = document.getElementById('wedding-data');
    DATA = JSON.parse(el.textContent);
    window.DATA = DATA;
  } catch (e) {
    document.getElementById('main').innerHTML = '<p>Failed to load data.</p>';
    return;
  }
  refreshStats();
  window.RENDERERS = RENDERERS;
  RENDERERS.dashboard = renderDashboard;
  RENDERERS.tasks = renderTasks;
  if (typeof BcCmdPages !== 'undefined') BcCmdPages.initPhase6Pages();
  if (typeof BcCmdCrud !== 'undefined') BcCmdCrud.initPhase4Crud();
  if (typeof BcCmdVendors !== 'undefined') BcCmdVendors.initPhase7Vendors();
  if (typeof BcCmdLive !== 'undefined') BcCmdLive.initPhase7Live();
  document.getElementById('gate').style.display = 'none';
  document.getElementById('app').classList.add('ready');
  if (!window.__bcHashBound) {
    window.addEventListener('hashchange', render);
    window.__bcHashBound = true;
  }
  render();
}

window.render = render;
window.initApp = initApp;
window.route = route;
window.setTaskField = setTaskField;
window.saveTaskState = saveTaskState;
window.renderTaskCard = renderTaskCard;
window.refreshStats = refreshStats;
