/**
 * Budget overlay merge — Command Center sessionStorage → wedding-master.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OVERLAY_PATH = join(ROOT, 'data', 'budget-sync-overlay.json');
export const MASTER_PATH = join(ROOT, 'data', 'wedding-master.json');

export function loadOverlay(path = OVERLAY_PATH) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function findBudgetRow(budget, id) {
  return budget.findIndex((b) => String(b.id) === String(id));
}

export function applyOverlayToMaster(master, overlay) {
  if (!overlay) return { applied: 0, added: 0, removed: 0, skipped: true };

  master.budget = master.budget ?? [];
  const budget = master.budget;
  const layer = overlay.layer ?? [];
  const deleted = new Set(layer.filter((x) => x._deleted).map((x) => String(x.id)));
  let applied = 0;
  let added = 0;
  let removed = 0;

  master.budget = budget.filter((b) => {
    if (deleted.has(String(b.id))) {
      removed++;
      return false;
    }
    return true;
  });

  for (const row of layer) {
    if (row._deleted) continue;
    const sid = String(row.id ?? '');
    if (sid.startsWith('local-') && row._added) {
      const { _added, _updated, _deleted, _source, ...rest } = row;
      master.budget.push(rest);
      added++;
      continue;
    }
    const idx = findBudgetRow(master.budget, row.id);
    if (idx >= 0 && row._updated) {
      const { _updated, _deleted, _source, ...patch } = row;
      master.budget[idx] = { ...master.budget[idx], ...patch };
      applied++;
    }
  }

  master.meta = master.meta ?? {};
  master.meta.lastUpdated = new Date().toISOString();
  master.meta.lastBudgetSync = overlay.exportedAt ?? new Date().toISOString();

  return { applied, added, removed, skipped: false };
}

export function saveMaster(master) {
  writeFileSync(MASTER_PATH, JSON.stringify(master, null, 2), 'utf8');
}

export function rowsToBudget(rows) {
  return rows
    .filter((r) => r[1])
    .map((r) => ({
      id: r[0] ? Number(r[0]) || r[0] : undefined,
      item: r[1] ?? '',
      category: r[2] ?? '',
      usd: r[3] === '' || r[3] == null ? null : Number(String(r[3]).replace(/[$,]/g, '')),
      cad: r[4] === '' || r[4] == null ? null : Number(String(r[4]).replace(/[$,C]/g, '')),
      status: r[5] ?? 'OPEN',
      due: r[6] || null,
      notes: r[7] ?? '',
    }));
}
