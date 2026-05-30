/**
 * Apply priority validation fixes to wedding-master.json
 * Usage: node scripts/wedding/apply-priority-fixes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MASTER_PATH = join(ROOT, 'data', 'wedding-master.json');
const ROOMING_PATH = join(ROOT, 'data', 'rooming-pax.json');

const FX = 1.37;

function parseNights(n) {
  const v = parseInt(String(n), 10);
  return Number.isFinite(v) ? v : null;
}

function guestFromRow(row) {
  return {
    pax: String(row[0]),
    roomRequest: row[1],
    lastName: row[2],
    firstName: row[3],
    middle: row[4] ?? '',
    supplier: row[5],
    nights: row[6],
    checkIn: row[7],
    checkOut: row[8],
    notes: row[9] ?? '',
  };
}

function assignRooms(guests) {
  const byPax = new Map(guests.map((g) => [g.pax, g]));
  const assigned = new Set();
  const rooms = [];

  function addRoom(members) {
    const room = members.filter(Boolean);
    if (!room.length) return;
    for (const m of room) assigned.add(m.pax);
    rooms.push(room);
  }

  // Explicit same-room notes
  for (const g of guests) {
    if (assigned.has(g.pax)) continue;
    const m = g.notes.match(/Same room as PAX (\d+[a-z]?)/i);
    if (m) {
      const partner = byPax.get(m[1]);
      if (partner && !assigned.has(partner.pax)) {
        addRoom([g, partner]);
      }
    }
  }

  // Infants share parent room
  for (const g of guests) {
    if (assigned.has(g.pax)) continue;
    const m = g.notes.match(/shared room with parents \(PAX (\d+[a-z]?)-(\d+[a-z]?)\)/i);
    if (m) {
      const parentRoom = rooms.find((r) => r.some((p) => p.pax === m[1] || p.pax === m[2]));
      if (parentRoom) {
        parentRoom.push(g);
        assigned.add(g.pax);
      }
    }
  }

  // Pair same last name + supplier (couples/families)
  const remaining = guests.filter((g) => !assigned.has(g.pax));
  const bySupplier = new Map();
  for (const g of remaining) {
    if (!bySupplier.has(g.supplier)) bySupplier.set(g.supplier, []);
    bySupplier.get(g.supplier).push(g);
  }
  for (const [, list] of bySupplier) {
    const singles = [...list];
    const used = new Set();
    for (let i = 0; i < singles.length; i++) {
      if (used.has(i)) continue;
      const a = singles[i];
      let paired = false;
      for (let j = i + 1; j < singles.length; j++) {
        if (used.has(j)) continue;
        const b = singles[j];
        if (a.lastName === b.lastName && a.lastName && a.lastName !== 'TBA') {
          addRoom([a, b]);
          used.add(i);
          used.add(j);
          paired = true;
          break;
        }
      }
      if (!paired && !assigned.has(a.pax)) {
        addRoom([a]);
        used.add(i);
      }
    }
  }

  return rooms;
}

function computeRoomStats(guests) {
  const rooms = assignRooms(guests);
  const supplierStats = {};
  let totalRoomNights = 0;
  let totalRoomsKnown = 0;

  for (const room of rooms) {
    const supplier = room[0].supplier;
    const nights = parseNights(room[0].nights);
    if (!supplierStats[supplier]) {
      supplierStats[supplier] = { pax: 0, rooms: 0, roomNights: 0, nights: nights };
    }
    supplierStats[supplier].pax += room.length;
    supplierStats[supplier].rooms += 1;
    if (nights) {
      supplierStats[supplier].roomNights += nights;
      totalRoomNights += nights;
    }
    totalRoomsKnown += 1;
  }

  return { rooms, supplierStats, totalRoomsKnown, totalRoomNights };
}

function countBySupplier(guests) {
  const counts = {};
  for (const g of guests) {
    counts[g.supplier] = (counts[g.supplier] ?? 0) + 1;
  }
  return counts;
}

function usdValue(b) {
  if (b.usd != null) return b.usd;
  if (b.cad != null) return Math.round(b.cad / FX);
  return 0;
}

function recalcBudgetPaidPct(budget) {
  let paid = 0;
  let total = 0;
  for (const b of budget) {
    const val = usdValue(b);
    if (val <= 0) continue;
    total += val;
    if (b.status === 'PAID' || b.status === 'PARTIAL') paid += val;
  }
  return total ? Math.round((paid / total) * 100) : 0;
}

function buildGroups(supplierStats, supplierCounts) {
  const ac = supplierStats['Air Canada Vacations'] ?? { pax: 0, rooms: 0, roomNights: 0 };
  const transat = supplierStats['Air Transat (5N charter)'] ?? { pax: 0, rooms: 0, roomNights: 0 };
  const sunwing7 = supplierStats['Sunwing Vacations (7N charter)'] ?? { pax: 0, rooms: 0, roomNights: 0 };
  const land = supplierStats['Travel Brands Land Only'] ?? { pax: 0, rooms: 0, roomNights: 0 };
  const beloved = supplierStats['Sunwing Conf #152409712 (Beloved sep.)'] ?? { pax: 0, rooms: 0, roomNights: 0 };

  return [
    {
      supplier: 'Air Canada Vacations',
      nights: '7N',
      checkIn: '2026-06-16',
      checkOut: '2026-06-23',
      pax: supplierCounts['Air Canada Vacations'] ?? ac.pax,
      rooms: ac.rooms,
      roomNights: ac.roomNights,
      flight: 'AC1810 06:50 YYZ→CUN',
      status: 'BOOKED',
    },
    {
      supplier: 'Air Transat (5N charter)',
      nights: '5N',
      checkIn: '2026-06-17',
      checkOut: '2026-06-22',
      pax: supplierCounts['Air Transat (5N charter)'] ?? transat.pax,
      rooms: transat.rooms,
      roomNights: transat.roomNights,
      flight: 'TS326 Jun 17 07:00 YYZ→CUN · TS327 Jun 22 return · 2-flight group charter',
      status: 'BOOKED',
      alert: '5N · check-in Jun 17 · Welcome Party same day 17:30',
    },
    {
      supplier: 'Sunwing Vacations (7N charter)',
      nights: '7N',
      checkIn: '2026-06-16',
      checkOut: '2026-06-23',
      pax: supplierCounts['Sunwing Vacations (7N charter)'] ?? sunwing7.pax,
      rooms: sunwing7.rooms,
      roomNights: sunwing7.roomNights,
      flight: 'WS2776 15:15 YYZ→CUN',
      status: 'BOOKED',
    },
    {
      supplier: 'Sunwing Conf #152409712 (Beloved sep.)',
      nights: '5N',
      checkIn: '2026-06-17',
      checkOut: '2026-06-22',
      pax: supplierCounts['Sunwing Conf #152409712 (Beloved sep.)'] ?? beloved.pax,
      rooms: beloved.rooms,
      roomNights: beloved.roomNights,
      flight: 'Beloved Planners · Bldg 16',
      status: 'BOOKED',
    },
    {
      supplier: 'Travel Brands Land Only',
      nights: '7N est.',
      checkIn: 'TBC',
      checkOut: 'TBC',
      pax: supplierCounts['Travel Brands Land Only'] ?? land.pax,
      rooms: land.rooms,
      roomNights: null,
      flight: 'Own flights',
      status: 'BUS SCHEDULE TBD',
    },
    {
      supplier: 'Travel Brands - Deviation',
      nights: 'TBC',
      checkIn: 'TBC',
      checkOut: 'TBC',
      pax: supplierCounts['Travel Brands - Deviation'] ?? 0,
      rooms: (supplierStats['Travel Brands - Deviation'] ?? {}).rooms ?? 0,
      roomNights: null,
      flight: 'Deviation bookings',
      status: 'CONFIRM DATES',
    },
  ];
}

function applyBudgetFixes(budget) {
  const set = (id, patch) => {
    const row = budget.find((b) => b.id === id);
    if (row) Object.assign(row, patch);
  };

  set(2, { usd: 59144, notes: 'Full wedding package · Palladium CM · deposit schedule on file' });
  set(3, { usd: 1600, notes: '22 days overdue — call Natasha · Deposit #3' });
  set(4, { cad: 12755, notes: '5 days overdue — balance due now' });
  set(5, { usd: 9311, notes: 'Prior deposit paid · contract on file' });
  set(6, {
    usd: 20584.4,
    notes: 'Quotes 279122 ($16,652) + 279827 truss ($3,932.40) · sign by May 27',
  });
  set(7, { usd: 20584.4, notes: 'Alternative · same scope as Mills James total' });
  set(8, { usd: 43202.46, notes: 'C4179 · 5 events · florals excluded · 50% deposit ~$21,601' });
  set(14, { usd: 20608.33, notes: 'Jun 20 ceremony day · S01545 on file' });

  // Add truss line if missing
  if (!budget.find((b) => b.id === 29)) {
    budget.push({
      id: 29,
      item: 'Mills James — Box Truss (279827)',
      category: 'AV',
      usd: 3932.4,
      cad: null,
      status: 'EXPIRES TOMORROW',
      due: '2026-05-27',
      notes: 'Reception box truss · bundled in line #6 total',
    });
  }

  // Florist placeholder
  if (!budget.find((b) => b.id === 30)) {
    budget.push({
      id: 30,
      item: 'Florals — Armando Lara (AL Studio)',
      category: 'Decor',
      usd: null,
      cad: null,
      status: 'QUOTED',
      due: '2026-05-28',
      notes: 'Quote received May 15 · NOT in GAMA C4179 · SAW pending',
    });
  }
}

function applyAlertFixes(alerts) {
  const next = [
    { level: 'critical', text: 'Zuniga Quote EXPIRED May 25 — GAMA C4179 preferred path' },
    { level: 'urgent', text: 'Mills James AV Expires May 27 — Sign 279122 + 279827 ($20,584)' },
    { level: 'critical', text: 'Majestic Films Balance Overdue — $12,755 CAD' },
    { level: 'critical', text: 'Palladium Deposit #3 Overdue — $1,600 USD' },
    { level: 'info', text: 'GAMA Decor QUOTED (C4179 $43,202) — Wire 50% on CLABE receipt' },
    { level: 'urgent', text: 'Florals NOT in GAMA scope — Review Armando Lara quote + SAW' },
  ];
  alerts.length = 0;
  alerts.push(...next);
}

function applyTaskFixes(tasks) {
  const gama = tasks.thisWeek.find((t) => t.id === 'c1g');
  if (gama) {
    gama.task = 'Sign GAMA C4179 + wire 50% deposit (~$21,601 USD) on CLABE receipt';
  }
  const gamaSprint = tasks.sprint.find((t) => t.task.includes('GAMA'));
  if (gamaSprint) {
    gamaSprint.task = 'Sign GAMA C4179 decor quote';
    gamaSprint.status = 'By May 28';
  }
  if (!tasks.thisWeek.find((t) => t.id === 'c1m')) {
    tasks.thisWeek.push({
      id: 'c1m',
      owner: 'Jennyfer',
      task: 'Source florist (Armando Lara quote on file) + submit florals SAW to Natasha',
      due: '2026-05-28',
    });
  }
}

function applyVendorFixes(vendors) {
  const gama = vendors.find((v) => v.name === 'Grupo Gama');
  if (gama) {
    gama.quoteUsd = 43202.46;
    gama.email = 'ventas7@grupogama.mx';
    gama.status = 'QUOTED';
    gama.notes = 'C4179 accepted · florals excluded · wire 50% ~$21,601';
  }

  const al = vendors.find((v) => v.name.includes('AL Studio'));
  if (al) {
    al.status = 'QUOTED';
    al.notes = 'Florist quote May 15 via Beloved · review + SAW submission pending';
  } else {
    vendors.push({
      name: 'Armando Lara · AL Studio',
      role: 'Florist',
      org: 'AL Studio',
      tier: 'local',
      email: null,
      phone: null,
      whatsapp: null,
      status: 'QUOTED',
      quoteUsd: null,
      events: 'Ceremony + reception florals',
      notes: 'NOT in GAMA C4179 · quote PDF May 15 · SAW gap',
    });
  }

  const natasha = vendors.find((v) => v.name === 'Natasha Lima');
  if (natasha) natasha.quoteUsd = 59144;
}

function applyAvQuotes(avQuotes) {
  avQuotes.millsJames = {
    usd: 20584.4,
    mainQuoteUsd: 16652,
    trussQuoteUsd: 3932.4,
    quotes: ['279122', '279827'],
    expires: '2026-05-27',
    vendor: 'Mills James',
  };
  avQuotes.avDelCaribe.usd = 20584.4;
}

function main() {
  const master = JSON.parse(readFileSync(MASTER_PATH, 'utf8'));
  const roomingData = JSON.parse(readFileSync(ROOMING_PATH, 'utf8'));
  const guests = roomingData.rows.map(guestFromRow);

  const supplierCounts = countBySupplier(guests);
  const { supplierStats, totalRoomsKnown, totalRoomNights } = computeRoomStats(guests);
  const groups = buildGroups(supplierStats, supplierCounts);

  applyBudgetFixes(master.budget);
  applyAlertFixes(master.alerts);
  applyTaskFixes(master.tasks);
  applyVendorFixes(master.vendors);
  applyAvQuotes(master.avQuotes);

  master.meta.lastUpdated = new Date().toISOString();
  master.meta.pax = guests.length;
  master.meta.rooms = totalRoomsKnown;
  master.meta.daysToArrival = 21;
  master.meta.budgetPaidPct = recalcBudgetPaidPct(master.budget);

  master.rooming = {
    ...master.rooming,
    summary: {
      pax: guests.length,
      rooms: totalRoomsKnown,
      roomNights: totalRoomNights,
      suppliers: {
        ac: supplierCounts['Air Canada Vacations'] ?? 0,
        transat: supplierCounts['Air Transat (5N charter)'] ?? 0,
        sunwing7: supplierCounts['Sunwing Vacations (7N charter)'] ?? 0,
        landOnly: supplierCounts['Travel Brands Land Only'] ?? 0,
        beloved: supplierCounts['Sunwing Conf #152409712 (Beloved sep.)'] ?? 0,
        deviation: supplierCounts['Travel Brands - Deviation'] ?? 0,
      },
    },
    groups,
    supplierCounts,
    supplierRoomStats: supplierStats,
    paxRows: guests.length,
    lastPull: new Date().toISOString(),
    localSource: 'data/rooming-pax.json',
    validationGaps: [
      'PAX 85 TBA placeholder — confirm or drop',
      'PAX 128/129/131 Gottumukkala — confirm occupants with Raj',
      'PAX 81 SUBBALAKSHMI/TUMULURI name order — confirm surname',
      'PAX 122/123 KARAVADI/KARAWADI spelling',
      'Beloved PAX 100–103 Land Only vs Sunwing #152409712 discrepancy',
      'Land Only + Deviation dates/nights TBC — bus schedule pending',
    ],
  };

  // Update comms metadata
  const m7 = master.comms.find((c) => c.id === 'm7');
  if (m7) m7.title = 'GAMA Decor — Sign C4179 + Wire Deposit';

  writeFileSync(MASTER_PATH, JSON.stringify(master, null, 2) + '\n');

  console.log('✓ wedding-master.json updated');
  console.log(`  PAX: ${guests.length} · Rooms: ${totalRoomsKnown} · Room-nights (known): ${totalRoomNights}`);
  console.log(`  Budget paid: ${master.meta.budgetPaidPct}%`);
  console.log('  Supplier room stats:', JSON.stringify(supplierStats, null, 2));
}

main();
