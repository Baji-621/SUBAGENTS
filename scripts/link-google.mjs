#!/usr/bin/env node
/**
 * One-time Google OAuth2 setup — run locally, saves refresh token to .env.local
 * Usage: npm run link:google
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com → APIs & Services → Credentials
 *   2. Create OAuth 2.0 Client ID → "Desktop app"
 *   3. Enable: Google Sheets API, Google Drive API, Gmail API
 *   4. Copy Client ID + Client Secret into .env.local (see .env.template)
 *   5. Run: npm run link:google
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const TOKEN_FILE = path.join(ROOT, '.google-token.json');

// ── Scopes ─────────────────────────────────────────────────────────────────
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',       // read/write Sheets
  'https://www.googleapis.com/auth/drive.file',         // Drive files created by this app
  'https://www.googleapis.com/auth/drive.readonly',     // read existing Drive files
  'https://mail.google.com/',                           // Gmail full access (send/read)
];

// ── Load credentials from .env.local ───────────────────────────────────────
function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`\n❌  .env.local not found at ${ENV_FILE}`);
    console.error('   Copy .env.template → .env.local and fill in your Google credentials.\n');
    process.exit(1);
  }
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  const env = {};
  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.+?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── Prompt helper ──────────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ── Update a key in .env.local ─────────────────────────────────────────────
function upsertEnv(file, key, value) {
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + '\n' + line + '\n';
  }
  fs.writeFileSync(file, content);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔐  B&C Wedding OS — Google OAuth2 Setup\n');

  const env = loadEnv();
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local\n');
    process.exit(1);
  }

  // Check for existing valid token
  if (fs.existsSync(TOKEN_FILE)) {
    const tok = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (tok.refresh_token) {
      const reauth = await ask('⚠️  Token already exists. Re-authorise? [y/N] ');
      if (reauth.toLowerCase() !== 'y') {
        console.log('✅  Using existing token. Run npm run check:auth to verify.\n');
        process.exit(0);
      }
    }
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob'  // out-of-band — works in any environment
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',           // force refresh_token every time
  });

  console.log('1️⃣   Open this URL in your browser:\n');
  console.log('   ' + authUrl);
  console.log('\n2️⃣   Sign in with bmadduluri@gmail.com and grant access.');
  console.log('3️⃣   Copy the authorisation code shown on the final page.\n');

  const code = await ask('Paste the authorisation code here: ');

  let tokens;
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
  } catch (err) {
    console.error('\n❌  Failed to exchange code:', err.message);
    process.exit(1);
  }

  if (!tokens.refresh_token) {
    console.warn('\n⚠️  No refresh_token returned. Try revoking access at https://myaccount.google.com/permissions and re-running.');
  }

  // Save token file
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
  console.log(`\n✅  Token saved to ${TOKEN_FILE}`);

  // Save refresh token to .env.local for CI/headless use
  if (tokens.refresh_token) {
    upsertEnv(ENV_FILE, 'GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
    console.log(`✅  GOOGLE_REFRESH_TOKEN written to .env.local`);
  }

  // Quick verification
  console.log('\n🔍  Verifying access...');
  oauth2Client.setCredentials(tokens);

  try {
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const res = await sheets.spreadsheets.get({
      spreadsheetId: '1lwmu8dTuz4KtyX_lwsdGMzqJ6BM9mINafDmzdQd2t3w',
      fields: 'properties.title',
    });
    console.log(`✅  Google Sheets OK — "${res.data.properties.title}"`);
  } catch (e) {
    console.warn('⚠️  Sheets check failed:', e.message);
  }

  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const res = await drive.about.get({ fields: 'user' });
    console.log(`✅  Google Drive OK — ${res.data.user.emailAddress}`);
  } catch (e) {
    console.warn('⚠️  Drive check failed:', e.message);
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅  Gmail OK — ${res.data.emailAddress} (${res.data.messagesTotal} messages)`);
  } catch (e) {
    console.warn('⚠️  Gmail check failed:', e.message);
  }

  console.log('\n🎉  OAuth setup complete! You can now run:\n');
  console.log('   npm run sync:sheets     — push budget data to Google Sheets');
  console.log('   npm run budget:pull     — pull latest sheet data locally');
  console.log('   npm run check:auth      — verify tokens are still valid\n');
}

main().catch(err => { console.error(err); process.exit(1); });
