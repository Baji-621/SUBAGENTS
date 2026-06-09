#!/usr/bin/env node
/**
 * sync-sheets.mjs — Push/pull wedding budget data with Google Sheets
 * Usage:
 *   npm run sync:sheets              push all tabs
 *   npm run budget:push              push budget tab only
 *   npm run budget:pull              pull & print latest budget from sheet
 *   node scripts/sync-sheets.mjs --pull --sheet=budget
 *
 * Primary sheet: 1lwmu8dTuz4KtyX_lwsdGMzqJ6BM9mINafDmzdQd2t3w
 * Rooming sheet: 1WZbTwbJA36cdCqZmFrcaEYSdGyfCl1rPS7Vh8qa-nKs
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const TOKEN_FILE = path.join(ROOT, '.google-token.json');

// ── Sheet IDs ───────────────────────────────────────────────────────────────
const SHEETS = {
  budget:  '1lwmu8dTuz4KtyX_lwsdGMzqJ6BM9mINafDmzdQd2t3w',
  rooming: '1WZbTwbJA36cdCqZmFrcaEYSdGyfCl1rPS7Vh8qa-nKs',
};

// ── Budget data — Jun 3 reconciled ─────────────────────────────────────────
const FX_RATE = 1.38034989;
const BUDGET_ROWS = [
  // [ID, Item, Category, Native Cur, Native Amt, CAD Forecast, Status, Due, Notes]
  ['1',  'Couple\'s Trip TR37577',              'Travel',     'CAD', 8976,      8976,     'PAID',              '—',        'AC1810 Jun 16 · Couple-paid'],
  ['2',  'Palladium Wedding Package',           'Venue',      'USD', 25000,     34509,    'ESTIMATED',         'TBC',      'Est. ±5% · ref $59,144 Natasha'],
  ['3',  'Palladium Deposit #3',               'Venue',      'USD', 1600,      2209,     'OVERDUE',           '2026-05-26','Call Natasha immediately'],
  ['4',  'Majestic Films — Balance',           'Video',      'CAD', 12755,     12755,    'OVERDUE',           '2026-05-26','Pay majestic-films-ltd.vsco.page/pay'],
  ['6',  'Mills James AV Q279122+Q279827',     'AV',         'USD', 18125.13,  25019,    'SIGN NOW',          '2026-06-06','Sign by Jun 6 — 7 days before event'],
  ['8',  'AL Studio — Decor + Florals',        'Decor',      'USD', 43126.48,  59530,    'SELECTED',          '2026-06-07','Pending sign · aleventstudio02@gmail.com'],
  ['9',  'Zuñiga Jun 3 (Path A alt)',          'Decor',      'USD', 25491,     35186,    'REFERENCE',         '2026-06-13','Alt: no florals · expires Jun 13'],
  ['10', 'Drums in Paradise',                  'Ent.',       'USD', 3386,      4674,     'DUE',               '2026-06-12','Quote valid Jun 12'],
  ['11', 'Loto Mehndi (Jun 16 + Jun 18)',      'Beauty',     'USD', 1763.20,   2434,     'COMMITTED',         '—',        'Signed PO · 50% to Palladium CM'],
  ['13', 'DJ Jethu (JEYARAJAH SHARAN)',        'Ent.',       'USD', 4000,      5521,     'DUE',               '—',        'AV rider approved Apr 14'],
  ['14', 'Patravali South Asian Catering',     'Catering',   'USD', 13188.97,  18205,    'DUE',               '2026-11-10','S01545 · 100-130 pax'],
  ['15', 'Something Borrowed Photography',     'Photo',      'CAD', 14238,     14238,    'SIGNED',            '2026-06-17','Signed May 15 · verify retainer'],
  ['16', 'Beauty by Sharda (HMUA)',            'Beauty',     'USD', 3300,      4555,     'ESTIMATED',         '—',        'Full wedding week · invoice pending'],
  ['17', 'Banu Prakash — Priest',             'Officiant',  '—',   0,         0,        'REFERENCE',         '—',        'Group room rate'],
  ['19', 'Baraat Boat',                        'Ent.',       'USD', 150,       207,      'DUE',               '—',        '$150/8 pax · Jun 19'],
  ['20', 'Tasting Apr 27',                    'Venue',      'USD', 350,       483,      'PAID',              '—',        'Paid'],
  ['21', 'Misc / Gratuities',                 'Other',      'USD', 2000,      2761,     'DUE',               '—',        'Tips + sundry'],
  ['22', 'Reception Food + Drinks (Bhogali)', 'Catering',   'USD', 10800,     14908,    'COMMITTED',         '—',        '$90×120 guests · TBC Natasha'],
];

const SUMMARY_ROWS = [
  ['As of',                  '2026-06-03'],
  ['FX rate (USD→CAD)',      FX_RATE.toString()],
  ['Original Budget (CAD)',  '150000'],
  ['Forecast Total (CAD)',   '206428'],
  ['Paid to Date (CAD)',     '9459'],
  ['Committed unpaid (CAD)', '76871'],
  ['Due / Open (CAD)',       '85589'],
  ['Over-budget variance',   '+56428'],
  ['Variance %',             '+37.6%'],
  ['Last sync',              new Date().toISOString()],
  ['Zuñiga Jun 3 (USD)',     '25491'],
  ['Mills James total (USD)','18125.13'],
  ['AL Studio (USD)',        '43126.48'],
  ['BP Total (USD)',         '154943.53'],
];

// ── Auth ────────────────────────────────────────────────────────────────────
function getAuth() {
  const env = loadEnv();
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌  Run npm run link:google first to set up credentials.');
    process.exit(1);
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');

  // Try token file first, then .env.local refresh token
  if (fs.existsSync(TOKEN_FILE)) {
    auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
  } else if (env.GOOGLE_REFRESH_TOKEN) {
    auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
  } else {
    console.error('❌  No token found. Run npm run link:google first.');
    process.exit(1);
  }

  // Auto-save refreshed tokens
  auth.on('tokens', tokens => {
    if (tokens.refresh_token && fs.existsSync(TOKEN_FILE)) {
      const existing = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ ...existing, ...tokens }, null, 2));
    }
  });

  return auth;
}

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── Push budget tab ─────────────────────────────────────────────────────────
async function pushBudget(sheets, spreadsheetId) {
  console.log('📊  Pushing Budget Master tab...');

  const headerRow = ['ID', 'Item', 'Category', 'Native Cur', 'Native Amt',
                     'CAD Forecast', 'Status', 'Due', 'Notes'];
  const values = [headerRow, ...BUDGET_ROWS];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Budget Master!A1',
    valueInputOption: 'RAW',
    requestBody: { values },
  });
  console.log(`   ✅  Budget Master updated — ${BUDGET_ROWS.length} rows`);

  // Forecast Summary tab
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Forecast Summary!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [['Metric', 'Value'], ...SUMMARY_ROWS] },
  });
  console.log(`   ✅  Forecast Summary updated`);
}

// ── Pull and print budget ───────────────────────────────────────────────────
async function pullBudget(sheets, spreadsheetId) {
  console.log('📥  Pulling Budget Master from sheet...\n');
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Budget Master!A1:I50',
  });
  const rows = res.data.values || [];
  if (!rows.length) { console.log('   (empty)'); return; }

  const [header, ...data] = rows;
  console.log(header.map(h => h.padEnd(22)).join(' | '));
  console.log('─'.repeat(header.length * 23));
  for (const row of data) {
    console.log(row.map((c, i) => String(c ?? '').padEnd(22)).join(' | '));
  }
}

// ── Push Decor Comparison tab ───────────────────────────────────────────────
async function pushDecorComparison(sheets, spreadsheetId) {
  console.log('🎨  Pushing Decor Comparison tab...');
  const header = ['Vendor', 'Total USD', 'CAD @ 1.3803', 'Includes Florals', 'Status', 'Expires', 'Notes'];
  const rows = [
    ['Zuñiga Jun 3 (V3)',         25491,    35186,   'No',  'SIGN BY JUN 13',  '2026-06-13', 'No florals · expires Jun 13'],
    ['Zuñiga May 28 (V2)',        37021.40, 51103,   'No',  'EXPIRED',         'Expired',    'Reference only'],
    ['Zuñiga ~May 25 (V1)',       43940.80, 60657,   'No',  'EXPIRED',         'Expired',    'Original expired quote'],
    ['AL Studio (SELECTED)',      43126.48, 59530,   'Yes', 'SELECTED',        'Open',       'Pending sign · integrated florals'],
    ['GAMA C4179',                43202.46, 59635,   'No',  'REFERENCE',       '—',          'Comparison only · no florals'],
    ['AV del Caribe',             20584.40, 28414,   'No',  'REFERENCE',       '—',          'AV only — not decor'],
    ['BP Hybrid (AL Studio + Zuñiga)', 62632, 86453, 'Yes', 'REFERENCE',       '—',          'Beloved Planners model'],
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Decor Comparison!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [header, ...rows] },
  });
  console.log('   ✅  Decor Comparison updated');
}

// ── Push Revision Log ──────────────────────────────────────────────────────
async function pushRevisionLog(sheets, spreadsheetId) {
  console.log('📋  Appending Revision Log entry...');
  const entry = [
    `rev-${new Date().toISOString().slice(0,10)}-jun3-sync`,
    new Date().toISOString(),
    'CB_Financial_Analysis_Jun03.html + sync-sheets.mjs',
    206428,
    56428,
    19,
    'Zuñiga V3 $25,491 added; Mills James confirmed $18,125.13; BP CSV $154,943.53 reconciled'
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Revision Log!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [entry] },
  });
  console.log('   ✅  Revision Log appended');
}

// ── CLI arg parser ─────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isPull = args.includes('--pull');
const sheetArg = args.find(a => a.startsWith('--sheet='))?.split('=')[1] || 'all';

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n📊  B&C Wedding OS — Google Sheets Sync\n');

  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = SHEETS.budget;

  // Verify sheet access
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });
    const sheetNames = meta.data.sheets?.map(s => s.properties.title) || [];
    console.log(`✅  Connected to: "${meta.data.properties.title}"`);
    console.log(`   Tabs: ${sheetNames.join(', ')}\n`);
  } catch (err) {
    console.error('❌  Cannot access spreadsheet:', err.message);
    console.error('   Make sure the sheet is shared with your Google account.');
    process.exit(1);
  }

  if (isPull) {
    await pullBudget(sheets, spreadsheetId);
    return;
  }

  // Push
  if (sheetArg === 'budget' || sheetArg === 'all') {
    await pushBudget(sheets, spreadsheetId);
  }
  if (sheetArg === 'decor' || sheetArg === 'all') {
    await pushDecorComparison(sheets, spreadsheetId);
  }
  if (sheetArg === 'all') {
    await pushRevisionLog(sheets, spreadsheetId);
  }

  console.log('\n🎉  Sync complete!');
  console.log(`   View sheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n`);
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1); });
