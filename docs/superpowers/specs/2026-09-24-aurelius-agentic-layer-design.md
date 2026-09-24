# REACH × D365 Business Central — Aurelius Agentic Layer

**Date:** 2026-09-24
**Status:** Approved for planning
**Author:** Imran Khan (with Claude Code)

## 1. Purpose & Intent

Extend the existing single-file mockup `reach-d365-agents.html` into a **superset**
that reproduces every page and feature of the reference SPA
"Aurelius · D365 Business Central Agentic Layer"
(https://finance-agents-hub.preview.emergentagent.com/) **as a demo mockup**, while
**preserving the Dynamics 365 Business Central look-and-feel** already established in
the mockup. The result is deployable to **Azure Static Web Apps** via a GitHub Actions
workflow, targeting the repo
`https://github.com/Anjin-san-ai/D365_Business_Central_AuditApp.git`.

**Success criteria**
- Every Aurelius page/feature (see §4) has a visual + interactive equivalent.
- No regression to existing mockup content; the app is a strict superset (additive roster).
- Nothing changes the D365 BC visual language — all new UI reuses existing CSS tokens/components.
- App runs as one static HTML file with no build step; hash routes and refresh work on Azure SWA.
- Deployment scaffolding is in place; the user performs the git push and Azure linking.

**Decisions locked (from brainstorming)**
- Architecture: **single static HTML file**, extend existing, JS hash-routing. No build tooling.
- Fidelity: **demo mockup** — mock data, drawers, toast confirmations; no real backend.
- Deployment: **I add SWA config + GitHub Actions workflow; user pushes** and links Azure.
- Roster: **additive** — keep mockup's Royalty & Creator and Controls & Access agents AND add
  Aurelius's Master Orchestrator, AP Exception, and Vendor Query.
- Navigation: **make nav functional** via hash-based view switching.

## 2. Non-Goals (out of scope)
- Real backend, live Business Central / OData / REST / SOAP calls, real authentication.
- Build tooling (React/Vite/webpack). The deliverable stays a hand-authored static file.
- Server-side APIs on Azure SWA (no `api/` function app).

## 3. Architecture

- **One HTML file** (`reach-d365-agents.html`) containing all markup, `<style>`, and `<script>`.
  Supporting assets (`reach-logo.svg`, `Cognizantlogo.png`) served alongside.
- **Hash router**: a small vanilla-JS router mapping `location.hash` → a view render.
  Routes: `#/dashboard` (default), `#/orchestrator`, `#/erp`, `#/audit`, `#/agent/<id>`.
  Router shows/hides pre-rendered view containers (or renders into a `#view-root`), updates
  active nav highlighting, and scrolls to top on change. Unknown hash → dashboard.
- **View-switching, not multi-page**: existing top black bar, company/nav bar, and quick-links
  remain in the persistent shell. Nav tabs + quick-links call the router instead of only toasting.
- **Mock-data module**: a single in-file JS object `DATA` holding companies, invoices, VAT
  entries, ledger rows, hold queue, audit records — reusing Aurelius reference IDs so views
  cross-reference consistently.
- **State**: in-memory JS for the session; `localStorage` only for the theme preference.
  Orchestrator runs append to the in-session audit log and agent activity logs.

### Module boundaries (within the single file, as clearly-commented sections)
1. `DATA` — mock data (pure data, no DOM).
2. `router` — hash parsing, view activation, nav highlight. Depends on: view registry.
3. `views/*` — one render function per view (dashboard, orchestrator, erp, audit, agent).
   Each takes `DATA` + state, returns/updates DOM. Independent of each other.
4. `orchestrator` — deterministic NL-request → classification/confidence/routed-agent/BC-action
   engine keyed to example prompts. Feeds audit + agent logs.
5. `components` — shared helpers: `toast()`, `kpiCard()`, `dataTable()`, `donut()`, `lineChart()`,
   `drawer()`. Reused across views to guarantee consistent D365 styling.
6. `chrome` — existing top-bar/panels behavior (unchanged) + new theme toggle & BC indicator.

## 4. Views & Features

### 4.1 Executive Dashboard (extend existing)
- Retain existing KPI cards, agent tiles, E2E process cards, business-assistance charts, hero.
- Add orchestration KPIs: **Transactions Orchestrated, Value Under Automation, Straight-Through
  Rate, Avg. Routing Confidence** (+ per-domain roll-ups where space allows).
- Add **Orchestration Throughput** line chart and **Agent Load Split** donut, drawn as inline
  SVG in the existing chart style (not a charting library).

### 4.2 Master Orchestrator (new centerpiece — `#/orchestrator`)
- NL **chat input** + **Send** button; **example-prompt chips**:
  "Resolve the 3-way match exception on INV-77120", "Recompute the Q2 volume rebate for Publicis",
  "Post the German reverse-charge VAT on SI-90233", "Why is Meridian Broadcasting overdue?",
  "When will Spark Foundry be paid?".
- **Animated routing pipeline** with stages: Intent Parsing → "Scoring against agent registry"
  (confidence badge) → Routed Agent → Running domain workflow → BC API Call / BC Record Update →
  Persisting result to ledger.
- **Result block**: markdown-ish result + metadata (Classification / Confidence / Routed Agent) +
  resulting **BC action** (e.g. "VAT Journal posted · VAT entries updated").
- Responses are **deterministic**, keyed by matching the example prompts (fallback generic route
  for free-typed input). Each run appends a row to the Audit Log and the routed agent's activity log.

### 4.3 Agent Workspaces (`#/agent/<id>`) — additive roster of 7
Kept: **Royalty & Creator**, **Collections/Credit**, **Billing & Rebate**, **Tax & Compliance**,
**Controls & Access**. Added: **AP Exception Processing**, **Vendor Query Assistant**.

Each workspace has: a header (name, tagline, BC endpoint), a **per-agent KPI strip**, an
interactive **tool** (input selector → **Run** → result panel → **Related BC Invoices**), and an
**activity log**. Tools to reproduce:
- **AP Exception**: *3-Way Match Exception Resolver* + *AP Hold Queue* table. Exception types:
  Quantity mismatch, Price variance, Missing GRN, Duplicate suspected. KPIs: Open Exceptions,
  On Hold, Auto-cleared, Auto-recovery Rate.
- **Collections/Credit**: *Dunning & Promise-to-Pay Generator* over ledger aging. KPIs: Open
  Dunning Cases, Overdue Recovered (QTD), Avg. DSO.
- **Billing & Rebate**: *Rebate Reconciliation Tool* (volume-tier recompute → credit memo). KPIs:
  Rebate Programs, Rebates Reconciled (QTD), Invoices Generated, Reconciliation Match.
- **Tax & Compliance**: *VAT / Nexus Cross-Check & Journal Post* + exemption-certificate check.
  KPIs: VAT Entries, Jurisdictions, Certificates Valid, Filings Verified.
- **Vendor Query**: *Vendor Query Simulator* (payment status, W-9 validation). KPIs: Queries (30d),
  Auto-Resolved, Avg. Response, Escalations.
- **Royalty & Creator** and **Controls & Access**: keep existing drawer content, upgraded to the
  same workspace layout (KPI strip + activity log; a light tool where one fits, else activity-only).
- Status vocabulary: Matched / On Hold / Escalated / Disputed / Overdue / Paid / Posted / Rejected.

### 4.4 Business Central Explorer (new — `#/erp`)
- Tabbed D365-styled tables: **Vendor Ledger, Sales Invoices, VAT Entries, AP Hold Queue**.
- **Filter** input (client-side), **Sync** (toast + BC indicator pulse), **Export** (toast
  "CSV extract will be emailed").
- Columns per Aurelius: Customer/Vendor, Amount, Balance, Due, Terms (Net 15/30/45), Status,
  Jurisdiction, Rate, Type, Variance (as applicable per table).
- Integration **protocol chips**: OData v4, REST Automation, SOAP (Legacy Pages), Webhooks / Bus. Events.

### 4.5 Audit & Compliance Log (new — `#/audit`)
- **Immutable / WORM** ledger table. Columns: Action Taken, Classification, Routed Agent,
  Confidence, Human Override, BC action, Timestamp, Approved-by. Seed records AUD-8836…8841.
- **Search box** filtering rows client-side. New orchestrator runs append rows in-session.

### 4.6 Global chrome additions
- **Theme toggle** (dark/light), persisted to `localStorage` key `aurelius-theme`; D365-styled,
  added to the top bar without disturbing existing icons. Views must read from CSS variables so
  both themes render correctly.
- **BC connection indicator** + **Sync Now** button ("Live from Business Central" / "Synced" /
  "Authenticating"), styled to D365.
- Existing app launcher, search, settings, notifications, help, user menu, entity switcher: behavior
  unchanged (notifications' deep-links now navigate to the relevant agent workspace via the router).

## 5. Data Model (mock)
Single `DATA` object. Reference IDs reused from Aurelius for cross-view consistency:
- Companies: Aurelius Media Group, The Trade Desk, Publicis Media, Spark Foundry, Zenith Optimedia,
  Meridian Broadcasting, Horizon Digital, Vortex Studios, Spotify AB, plus existing REACH entities.
- Invoices INV-77120/77133/77140/77155; SI-90233…90295; POs PO-44810…44840; VAT-3391…3395;
  vendors V-1042…1177; audit AUD-8836…8841. Env label PROD-EMEA-01.

## 6. Deployment (Azure Static Web Apps)
Repo layout serves the app at root. Files added:
- `index.html` — the app. (Decision at plan time: rename `reach-d365-agents.html` → `index.html`,
  or add a redirecting `index.html`. Prefer rename so SWA serves it by default; keep a note in
  USAGE.txt.)
- `staticwebapp.config.json` — SPA fallback: rewrite navigation routes to `/index.html` so hash
  routing and hard refresh work; set default document; no `api`.
- `.github/workflows/azure-static-web-apps.yml` — SWA deploy action, `app_location: "/"`,
  `api_location: ""`, `output_location: ""`, Oryx build skipped (static content, no build command).
  Uses secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
- `DEPLOY.md` — the two manual steps for the user: (1) create the Azure Static Web App resource and
  copy its deployment token into the GitHub repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN`;
  (2) `git remote add origin <repo>` and `git push`. The workflow then builds/deploys on push.
- `.gitignore` — exclude scratch/OS files (`.playwright-mcp/`, `.DS_Store`, `/tmp` artifacts).

## 7. Verification
Static mockup → verification is manual + config validation:
- Open the file; visit every route (`#/dashboard`, `#/orchestrator`, `#/erp`, `#/audit`, each
  `#/agent/<id>`); confirm each renders, nav highlights correctly, and hard-refresh on a route works.
- Run each agent tool at least once; confirm result panel + Related BC Invoices populate; confirm an
  orchestrator run appends to Audit Log and the agent activity log.
- Toggle theme; confirm all views render in both themes.
- Confirm no dead-clicks on newly-interactive nav/quick-links.
- Validate `staticwebapp.config.json` parses and serve locally (e.g. `npx serve` / SWA CLI) to
  confirm SPA fallback.
- Update `USAGE.txt` click-map to cover all new views and mark clickable vs decorative.

## 8. Risks / Notes
- **Look-and-feel drift** is the main risk: enforce reuse of existing CSS variables/components for
  every new view; no new fonts/colors/spacing scales.
- **File size**: single file grows large. Keep sections clearly delimited with comment banners so it
  stays navigable and editable in chunks.
- **Roster mismatch** with Aurelius is intentional (superset); document the difference in USAGE.txt.
