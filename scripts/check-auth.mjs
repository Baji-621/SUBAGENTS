#!/usr/bin/env node
/**
 * check-auth.mjs — verify Google + GitHub token health
 * Usage: npm run check:auth
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const TOKEN_FILE = path.join(ROOT, '.google-token.json');

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

async function checkGoogle(env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('❌  Google — GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing in .env.local');
    return false;
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret, 'urn:ietf:wg:oauth:2.0:oob');

  if (fs.existsSync(TOKEN_FILE)) {
    auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
  } else if (env.GOOGLE_REFRESH_TOKEN) {
    auth.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
  } else {
    console.log('❌  Google — no token file and no GOOGLE_REFRESH_TOKEN. Run npm run link:google');
    return false;
  }

  let ok = true;

  // Sheets
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({
      spreadsheetId: '1lwmu8dTuz4KtyX_lwsdGMzqJ6BM9mINafDmzdQd2t3w',
      fields: 'properties.title',
    });
    console.log(`✅  Google Sheets — "${res.data.properties.title}"`);
  } catch (e) {
    console.log('❌  Google Sheets —', e.message);
    ok = false;
  }

  // Drive
  try {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.about.get({ fields: 'user.emailAddress,storageQuota' });
    const used = Math.round(res.data.storageQuota?.usage / 1024 / 1024);
    console.log(`✅  Google Drive  — ${res.data.user.emailAddress} (${used} MB used)`);
  } catch (e) {
    console.log('❌  Google Drive  —', e.message);
    ok = false;
  }

  // Gmail
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const res = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅  Gmail        — ${res.data.emailAddress} (${res.data.threadsTotal?.toLocaleString()} threads)`);
  } catch (e) {
    console.log('❌  Gmail        —', e.message);
    ok = false;
  }

  return ok;
}

function checkGitHub() {
  try {
    const remote = execSync('git remote get-url origin', { cwd: ROOT, encoding: 'utf8' }).trim();
    console.log(`✅  Git remote   — ${remote}`);

    const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf8' }).trim();
    console.log(`✅  Git branch   — ${branch}`);

    // Test push access by doing a dry-run fetch
    execSync('git fetch --dry-run origin 2>&1', { cwd: ROOT, encoding: 'utf8' });
    console.log(`✅  GitHub fetch — OK`);
  } catch (e) {
    console.log('❌  GitHub —', e.message.split('\n')[0]);
    return false;
  }
  return true;
}

async function main() {
  console.log('\n🔍  B&C Wedding OS — Auth Health Check\n');

  const env = loadEnv();
  const envExists = fs.existsSync(ENV_FILE);

  console.log(`📁  .env.local   — ${envExists ? '✅ found' : '❌ missing (run: cp .env.template .env.local)'}`);
  console.log(`🔑  Token file   — ${fs.existsSync(TOKEN_FILE) ? '✅ found' : '⚠️  missing'}\n`);

  console.log('── Google ────────────────────────────────────────────────');
  const googleOk = await checkGoogle(env);

  console.log('\n── GitHub ────────────────────────────────────────────────');
  const gitOk = checkGitHub();

  console.log('\n─────────────────────────────────────────────────────────');
  if (googleOk && gitOk) {
    console.log('🎉  All systems operational! Ready to sync.\n');
  } else {
    console.log('⚠️   Some checks failed. See above for details.\n');
    if (!googleOk) console.log('   → Run: npm run link:google');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
