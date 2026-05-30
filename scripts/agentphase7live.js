/**
 * Phase 7 — Live ops: pathname routes, drag kanban, live stats refresh, KPI recompute
 */
(function (global) {
  'use strict';

  const LIVE_INTERVAL_MS = 60_000;
  let liveTimer = null;
  let dragBound = false;

  const PATH_ROUTES = new Set([
    'dashboard', 'events', 'tasks', 'vendors', 'rooming', 'comms', 'av', 'ops',
    'beloved', 'travel', 'budget', 'contacts',
  ]);

  function bootstrapPathRoute() {
    const path = location.pathname.replace(/\/+$/, '');
    const m = path.match(/\/app(?:\/([^/?#]+))?$/i);
    if (!m) return;
    const seg = (m[1] || 'dashboard').toLowerCase();
    const target = PATH_ROUTES.has(seg) ? seg : 'dashboard';
    const want = '#/' + (target === 'dashboard' ? '' : target);
    if (location.hash !== want && location.hash !== want.replace(/\/$/, '')) {
      location.hash = want;
    }
  }

  function computeBudgetStats() {
    const fx = global.DATA?.meta?.fxDefault ?? 1.37;
    const list = global.BcCmdCrud?.getMergedBudget?.() ?? global.DATA?.budget ?? [];
    let totalUsd = 0;
    let paidUsd = 0;
    for (const b of list) {
      const amt = b.usd ?? (b.cad ? b.cad / fx : 0);
      if (amt && b.status !== 'REFERENCE' && b.status !== 'EVALUATING') totalUsd += amt;
      if (b.status === 'PAID' && amt) paidUsd += amt;
    }
    return { totalBudgetUsd: Math.round(totalUsd), paidBudgetUsd: Math.round(paidUsd) };
  }

  function computeVendorStats() {
    const list = global.BcCmdCrud?.getMergedVendors?.() ?? global.DATA?.vendors ?? [];
    return {
      totalVendors: list.length,
      activeVendors: list.filter((v) => /ACTIVE|CONFIRMED|SIGNED|URGENT/i.test(v.status)).length,
    };
  }

  function refreshAllStats() {
    if (!global.DATA?.stats) return;
    if (typeof global.refreshStats === 'function') global.refreshStats();
    Object.assign(global.DATA.stats, computeBudgetStats(), computeVendorStats());
    global.DATA.stats.lastLiveRefresh = new Date().toISOString();
  }

  function startLiveStats() {
    if (liveTimer) return;
    refreshAllStats();
    liveTimer = setInterval(() => {
      refreshAllStats();
      const r = typeof global.route === 'function' ? global.route() : 'dashboard';
      if (r === 'dashboard' && typeof global.render === 'function') global.render();
    }, LIVE_INTERVAL_MS);
  }

  function kanbanColStatus(colEl) {
    const h = colEl?.querySelector('h3')?.textContent?.toLowerCase() || '';
    if (h.startsWith('in progress')) return 'in_progress';
    if (h.startsWith('done')) return 'done';
    return 'todo';
  }

  function bindDragKanban() {
    const main = document.getElementById('main');
    if (!main || dragBound) return;
    dragBound = true;

    main.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.task-item[data-task-id]');
      if (!card || !main.querySelector('[data-task-board="kanban"]')) return;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      e.dataTransfer.effectAllowed = 'move';
    });

    main.addEventListener('dragend', (e) => {
      e.target.closest('.task-item')?.classList.remove('dragging');
    });

    main.addEventListener('dragover', (e) => {
      if (!e.target.closest('[data-task-board="kanban"]')) return;
      const col = e.target.closest('.k-col');
      if (!col) return;
      e.preventDefault();
      col.classList.add('drag-over');
    });

    main.addEventListener('dragleave', (e) => {
      e.target.closest('.k-col')?.classList.remove('drag-over');
    });

    main.addEventListener('drop', (e) => {
      const board = e.target.closest('[data-task-board="kanban"]');
      if (!board) return;
      const col = e.target.closest('.k-col');
      if (!col) return;
      e.preventDefault();
      col.classList.remove('drag-over');
      board.querySelectorAll('.k-col').forEach((c) => c.classList.remove('drag-over'));
      const id = e.dataTransfer.getData('text/plain');
      if (!id || typeof global.setTaskField !== 'function') return;
      const status = kanbanColStatus(col);
      global.setTaskField(id, { status });
      if (typeof global.saveTaskState === 'function') global.saveTaskState();
      refreshAllStats();
      if (typeof global.render === 'function') global.render();
    });
  }

  function patchRenderTaskCard() {
    if (typeof global.renderTaskCard !== 'function') return;
    const orig = global.renderTaskCard;
    global.renderTaskCard = function (t, opts) {
      let html = orig(t, opts);
      if (!opts?.compact && html.includes('class="task-item')) {
        html = html.replace(
          'class="task-item',
          'draggable="true" class="task-item'
        );
      }
      return html;
    };
  }

  function initPhase7Live() {
    bootstrapPathRoute();
    patchRenderTaskCard();
    refreshAllStats();
    startLiveStats();
    bindDragKanban();

    const origRender = global.render;
    if (origRender && !global.__bcRenderPatched) {
      global.render = function () {
        refreshAllStats();
        origRender();
        bindDragKanban();
      };
      global.__bcRenderPatched = true;
    }
  }

  global.BcCmdLive = { initPhase7Live, refreshAllStats, bootstrapPathRoute };
})(typeof window !== 'undefined' ? window : globalThis);
