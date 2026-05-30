# DEPLOY / DRIVE MANIFEST
## Bharadwaj &amp; Catherina · Wedding Source of Truth · June 16 – 23, 2026

**Bundle root:** `_DRIVE_READY/`  
**Prepared:** May 26, 2026 · Single source of truth for couple + parents + planners + travel ops.  
**Last validated:** QA v6 13/13 passed · Gmail ingest 92 new · WhatsApp 6,372 · Sheets sync OK

> This bundle is **dual-purpose**: it can be (A) deployed live to Netlify as a website with password-gated restricted sections, OR (B) dragged into Google Drive as a shared folder. All HTML files are self-contained — they open in any browser without a server. PDFs and spreadsheets are originals.

> **🔒 Password gating is documented in `../ADMIN_PASSWORDS.md` (kept OUTSIDE this folder — do NOT upload it).**

---

## 📁 Folder Map

| Folder | Audience | Purpose |
|---|---|---|
| `00_START_HERE_index.html` | Everyone | Single landing page linking to all assets below. Open this first. |
| `01_Command_Center/` | Couple + Baji + Catherina | Live ops console (12 tabs, channel ledger, budget, vendor matrix). |
| `02_Guest_Facing/` | Wedding party + extended family + Raj | Wedding-week itinerary + full guest packet. |
| `03_Vendor_Source_Docs/` | Couple + planners | All vendor PDFs, invoices, quotes, rooming lists, flight files. |
| `04_Master_Contracts/` | Couple + parents | Signed master contracts (Palladium 207718, Beloved, deposit). |
| `05_Communications/` | Couple + Baji | Communications package + companion command center. |
| `06_Agent_Skills/` | Couple + core team | Composio Gmail runbook, PM validation, UI review, Canvas readme, refresh pipeline. |
| `netlify.toml` | Deploy config | Netlify publish settings, redirects, security headers. |
| `robots.txt` | Crawlers | Blocks search-engine indexing site-wide. |

---

## 📄 File Inventory

### 01_Command_Center/
- `CB_WeddingOS_v6.html` — Live wedding operations command center (15 tabs · Beloved + AbsoluteWed hubs · AV matrix · 28 budget lines · dual-sync JSON).
- `CB_WeddingOps_v6.html` — Mirror copy of v6 OS.
- `qa_v6.ps1` — PowerShell QA validator (13 checks).

### 02_Guest_Facing/
- `CB_Wedding_Itinerary_for_Raj.html` — Visually engaging Wedding Week Itinerary extract (cover + day-by-day Jun 16–22 + contacts). **Send this to Raj.**
- `guest_packet_v19.html` — Full guest packet (cover · itinerary · ceremony guide · FAQ · dress code · welcome bag · contacts).

### 03_Vendor_Source_Docs/
42 vendor PDFs/XLSX/JPG (synced from workspace `Vendors/` May 26): Patravali S01545 ($20,608.33), **GAMA C4179** (preferred), Zuñiga ref ($43,940.80 expired), Majestic order/invoice, Mills James 279122/279827, AV del Caribe, Drums PCM DH, DJ Jethu email, Something Borrowed contract, Palladium SAW/ROMANZA, flight packs TR37596–59, rooming lists, 3D MOU reference.

### 04_Master_Contracts/
Synced from workspace `MASTER CONTRACTS/` May 26:
- `207718_20250611162618_SIGNED (2).pdf` — Palladium wedding master contract.
- `BP-WEDDING PLANNING AGREEMENT, BELOVED PLANNERS (2).pdf` — Beloved Planners agreement.
- `Venue Deposit_06172025 (2).pdf` — Venue deposit receipt.
- `Catherina_Baji_Final_Roster_v2.xlsx` — Final guest roster.
- `Catherina & Baji_wedding planning kit.xlsx` — Master planning workbook.

### 05_Communications/
- `CB_Rooming_Dashboard_Hub.html` — **Stakeholder hub:** links to all rooming dashboards below.
- `CB_Natasha_Guest_Rooming_Dashboard.html` — **Natasha/Palladium:** 137 pax · SAME Building / NEARBY / TBD / TBC / B16 · arrivals · RM# · May 26.
- `CB_Raj_Rooming_Dashboard.html` — **Raj/AbsoluteWed:** supplier rollups · deviation bookings · validation gaps.
- `CB_Beloved_Rooming_Dashboard.html` — **Jennyfer/Beloved:** PAX 100–103 · handoff before Natasha email.
- `CB_Couple_Rooming_Summary.html` — **Couple:** family block + vendor summary counts.
- `CB_AccountabilityComms_May26.md` / `.html` — P0/P1 copy-paste WhatsApp + email templates (AV revisions, Natasha pending, resort vendors).
- `index.html` — **Communications hub** linking all dashboards + accountability + transfer studio.
- `CB_Communications_Package.html` · `CB_Wedding_Command_Center.html` — Companion comms files.

**Netlify short links:** `/comms` · `/rooming` · `/rooming/natasha` · `/accountability` · `/transfer`

**Raj rooming sheet (FINAL ROOMING MASTER — new schema):** https://docs.google.com/spreadsheets/d/1WMg74RDdaP1FUZPxfqM6keLy42xDeCWDWp54uzCDzHQ/edit · tabs: `FINAL ROOMING MASTER`, `Reconciled Summary`, `By Supplier`, `Arrivals by Date`

### 07_Entertainment/
- `index.html` — **Dual landing:** Entertainment Command vs Vendor Ops Hub.
- `CB_Entertainment_Hub.html` — DJ cue sheets · dances · Spotify · video edits · ENT_* sheet link. Build: `npm run build:entertainment`.
- `CB_Vendors_Ops_Hub.html` — Vendor-only ops: DJ Jethu · Majestic · Something Borrowed · coordination · resort stack. Build: `npm run build:vendors-ops`.
- SSOT: `data/entertainment-master.json` · `data/vendors-ops-master.json` · `npm run build:ops-hubs` rebuilds all three.

**Netlify short links (07):** `/07` · `/entertainment` · `/vendors`

### 06_Agent_Skills/
- `index.html` — Hub linking all agent skill pages.
- `composio-gmail-runbook.html` — Gmail ingest (Google API primary; Composio optional).
- `pm-validation-may26.html` — Vendor/cost matrix + May 26 action items.
- `ui-review-v6.html` — Web Interface Guidelines findings.
- `canvas-readme.html` — Pointer to Cursor canvas dashboard.
- `CB_Comms_Transfer_Studio.html` — Comms transfer studio.
- `CB_Raj_eDoc_Splitter_Guide.html` — Full 5-method guide for splitting Air Transat eDoc PDFs (Jean/Raj). Short link: `/edoc`.
- `CB_Raj_eDoc_Desk_Card.html` — Single-page laminated desk reference for Raj (method 1 & 2 only). Short link: `/edoc/desk`.
- `CB_Raj_eDoc_Splitter_Cheat_Sheet.html` — Quick-reference cheat sheet. Short link: `/edoc/cheatsheet`.
- `CB_Raj_eDoc_Process_Guide.html` — Full SOP process document (RACI, flowchart, 7 steps, 9 exceptions, metrics). Short link: `/edoc/process`.

**Netlify short links (eDoc kit):** `/edoc` · `/edoc/desk` · `/edoc/process` · `/edoc/cheatsheet`

### Data layer (repo root, not in Netlify bundle)
- `data/wedding-master.json` — canonical SSoT
- `data/audit-trail.json` — 6,467 entries (WhatsApp + Gmail)
- Google Sheets: **primary planner kit** `1lwmu8dTuz4KtyX_lwsdGMzqJ6BM9mINafDmzdQd2t3w` · rooming `1WZbTwbJA36cdCqZmFrcaEYSdGyfCl1rPS7Vh8qa-nKs` · budget mirror `1xyroYy830Kcc6yNWutqap2AkOWuH7t8OWcMwPqhj2EI`

> **Note:** WhatsApp transcripts are intentionally **excluded** from this deliverable.

---

## 🔒 Password-Gated Sections

The landing page (`00_START_HERE_index.html`) gates the following cards with separate
passwords. The four passwords and their SHA-256 hashes are documented in
`../ADMIN_PASSWORDS.md` (kept outside this folder).

| Card | Group ID | Audience |
|---|---|---|
| 01 Command Center | `cmd` | Couple · Baji · Catherina · core team |
| 03 Vendor & Source Docs | `vendor` | Couple · Beloved Planners · Raj |
| 04 Master Contracts | `contracts` | Couple · Parents |
| 05 Communications | `comms` | Couple · Baji |
| 06 Agent Skills | `cmd` | Couple · core team (same as Command Center) |

The Wedding Week Itinerary and full Guest Packet (v19) remain **open** (no password) so
they can be sent to any guest.

**Important:** Netlify free tier has no built-in per-folder password. The gate is
client-side (SHA-256 in `crypto.subtle`) and prevents casual discovery only — direct
URLs to PDFs/HTML in restricted folders still resolve. For real protection upgrade to
Netlify Pro and enable site-wide password protection.

---

## 🚀 Netlify Deployment

**Project dashboard:** https://app.netlify.com/teams/baji-621/projects

### Option 1 — Netlify Drop (no install required)
1. Open https://app.netlify.com/drop
2. Drag the entire `_DRIVE_READY/` folder onto the page.
3. Netlify will assign a random subdomain (e.g. `random-name-12345.netlify.app`).
4. Optional: in Site settings → Domain management, rename the subdomain (e.g. `bc-wedding-ops`).

### Option 2 — Netlify CLI (recommended for re-deploys)
```powershell
cd "C:\Users\bmadd\OneDrive\Documents\Desktop\B&C_Cancun"
npm install -g netlify-cli       # one-time
netlify login                    # opens browser
netlify deploy --dir=_DRIVE_READY            # preview URL
netlify deploy --dir=_DRIVE_READY --prod     # promote to production
```

### Option 3 — Git-linked continuous deploy
1. Push the workspace to a private GitHub repo.
2. In Netlify dashboard → Add new site → Import from Git.
3. Set **Publish directory** to `_DRIVE_READY` and leave Build command empty.
4. Every push to main will auto-deploy.

---

## 📁 Google Drive Upload (alternative to Netlify)

### Option A — Drag-and-drop (recommended)
1. Open https://drive.google.com in your browser, signed in as Catherina or Baji.
2. Create a new folder: `B&C_Wedding_June_2026` (or open existing).
3. From Windows File Explorer, drag the entire `_DRIVE_READY` folder into the Drive folder.
4. Drive will preserve the subfolder structure and upload all files.
5. Right-click the root folder in Drive → **Share** → add: parents · Raj (raj@absolutewedsite.com) · Beloved Planners (jennyfer@belovedplanners.com) → set "Viewer" (or "Editor" for ops team).
6. Copy the shareable link and circulate.

### Option B — Selective sharing
- Share **only `02_Guest_Facing/`** with Raj and extended family.
- Share **`01_Command_Center/` + `03_…` + `04_…` + `05_…`** with parents + planners only.

### Option C — Google Drive desktop sync (offline-ready)
1. Install Google Drive for desktop (https://www.google.com/drive/download/).
2. Configure to sync your Drive root.
3. Move `_DRIVE_READY/` into the synced folder. Files appear in Drive automatically.

---

## ✅ Single Source of Truth (SSoT)

- Canonical data: `data/wedding-master.json` (v6.1)
- Live console: `_DRIVE_READY/01_Command_Center/CB_WeddingOS_v6.html`
- Refresh: `npm run parse:whatsapp && npm run seed:gmail && npm run ingest:gmail && npm run sync:sheets && npm run build:os`
- QA: `powershell -File _DRIVE_READY/01_Command_Center/qa_v6.ps1`
- Deploy: `netlify deploy --dir=_DRIVE_READY --prod`

---

## 🎨 Itinerary File (for Raj)
File: `02_Guest_Facing/CB_Wedding_Itinerary_for_Raj.html`

- **Design language:** Chromatic Ritual (Cormorant Garamond + Lora + Dancing Script · per-event color theming · fairy-light animation · gold-line dividers).
- **Content:** Cover page + 7-day itinerary (Jun 16 arrival → Jun 22 departure) + on-site coordination contacts.
- **Email-ready:** Self-contained HTML, no external dependencies beyond Google Fonts. Send as attachment or as a Drive share link.

---

## 📋 Suggested Email to Raj
> Subject: Wedding Week Itinerary — Bharadwaj &amp; Catherina · June 16 – 23, 2026
>
> Hi Raj,
>
> Per your request, attached/linked is the visual Wedding Week Itinerary for our June 2026 ceremony at Grand Palladium Costa Mujeres. It covers arrival (Jun 16) through departure (Jun 22), with all ceremonies, venues, dress codes, and on-site coordination contacts (Beloved Planners + couple direct).
>
> Please use this as the canonical itinerary for any guest-facing communications from your side. Happy to make refinements — let us know.
>
> Warmly,
> Catherina &amp; Baji
