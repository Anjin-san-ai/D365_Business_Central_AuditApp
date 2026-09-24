# Aurelius Agentic Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the single-file `reach-d365-agents.html` mockup into a superset that reproduces every Aurelius page/feature (Orchestrator, agent tools, BC Explorer, Audit Log, orchestration KPIs, theme toggle) as a D365-styled demo, with Azure Static Web Apps deployment scaffolding the user can push.

**Architecture:** One static HTML file with an in-file vanilla-JS hash router that activates one of several pre-rendered view containers inside a persistent D365 shell. A single `DATA` object supplies all mock data; shared component helpers (`toast`, `dataTable`, `donut`, `lineChart`, `kpiCard`) guarantee consistent styling. A deterministic orchestrator engine maps example prompts to classification/confidence/routed-agent/BC-action results and appends to the audit + agent logs. No build step.

**Tech Stack:** HTML5, CSS (existing D365 custom-property design tokens), vanilla JavaScript (ES2019, no frameworks/libraries), inline SVG charts, Azure Static Web Apps + GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-24-aurelius-agentic-layer-design.md`

## Global Constraints

- Single deliverable file: `index.html` (renamed from `reach-d365-agents.html`); assets `reach-logo.svg`, `Cognizantlogo.png` served alongside.
- No external JS/CSS libraries, no build tooling, no `api/` function app. Pure static.
- All new UI MUST reuse existing CSS custom properties / component classes — no new fonts, color values, or spacing scales. D365 Business Central look-and-feel is preserved verbatim.
- JavaScript targets ES2019 (broad browser support); no modules — one `<script>` with commented section banners.
- Roster is **additive** (superset): keep Royalty & Creator + Controls & Access AND add Master Orchestrator, AP Exception, Vendor Query. Nothing existing is removed.
- Reference IDs reused verbatim: INV-77120/77133/77140/77155, SI-90233…90295, PO-44810…44840, VAT-3391…3395, V-1042…1177, AUD-8836…8841; env `PROD-EMEA-01`.
- Theme persisted to `localStorage` key `aurelius-theme` (values `light` / `dark`).
- SWA config uses secret name `AZURE_STATIC_WEB_APPS_API_TOKEN`; `app_location: "/"`, no build command (skip Oryx), SPA fallback rewrite to `/index.html`.

## Review Focus

- **Hard refresh on a deep route** (e.g. open `/index.html#/audit`, reload): must land on the same view, not a blank page — router must run on `DOMContentLoaded` and on `hashchange`. (Task 2)
- **Unknown / malformed hash** (`#/nonsense`, `#/agent/does-not-exist`): must fall back to dashboard, not throw or render an empty shell. (Task 2)
- **Theme toggle affects every view**: switching to dark then navigating to a later-rendered view (ERP/Audit) must render correctly because views read CSS variables, not hard-coded colors. (Task 3)
- **Orchestrator free-typed input** (a prompt matching no example): must still route to a sensible agent with a generic result and still append a valid audit row — no `undefined` in the audit table. (Task 6)
- **Client-side table filter with no matches** (ERP filter / Audit search): must show an empty-state row, not a broken/blank table body. (Tasks 7, 8)

---

## File Structure

- **Modify/rename:** `reach-d365-agents.html` → `index.html` — the entire app (markup, `<style>`, `<script>`). Sections added via clearly-banner-commented blocks.
- **Create:** `staticwebapp.config.json` — SWA routing/SPA fallback.
- **Create:** `.github/workflows/azure-static-web-apps.yml` — deploy workflow.
- **Create:** `DEPLOY.md` — the two manual steps for the user.
- **Modify:** `USAGE.txt` — click-map updated for the new views.
- **Already present:** `.gitignore`, spec doc (committed).

Because it is one HTML file, "files touched" is mostly the same file; tasks are bounded by **feature section** and each ends with a committed, independently viewable deliverable. Verification is **manual/visual** (open in a browser and confirm), which is the correct test cycle for a no-runtime static mockup — each task states the exact click-path and expected result.

---

### Task 1: Rename to index.html and establish the view-container skeleton

**Files:**
- Rename: `reach-d365-agents.html` → `index.html`
- Modify: `index.html` (add `#view-root` structure + empty view containers)

**Interfaces:**
- Produces: DOM containers `<section class="view" id="view-dashboard">` … `id="view-orchestrator"`, `id="view-erp"`, `id="view-audit"`, `id="view-agent"`, each with class `view` and a `hidden` attribute by default except dashboard. Existing dashboard markup is moved inside `#view-dashboard` unchanged.

- [ ] **Step 1: Rename the file**

```bash
git mv reach-d365-agents.html index.html
```

- [ ] **Step 2: Wrap existing body content into the dashboard view**

Wrap the current main content (everything below the persistent shell: hero, KPI cards, agent tiles, E2E cards, charts, footer stays outside) in:

```html
<section class="view" id="view-dashboard"><!-- existing dashboard markup, unchanged --></section>
<section class="view" id="view-orchestrator" hidden></section>
<section class="view" id="view-erp" hidden></section>
<section class="view" id="view-audit" hidden></section>
<section class="view" id="view-agent" hidden></section>
```

Add minimal CSS reusing existing tokens: `.view[hidden]{display:none}` `.view{...}` (no new colors).

- [ ] **Step 3: Verify the app still looks identical**

Open `index.html` in a browser. Expected: the dashboard renders exactly as before (no visual change); the four new empty sections are not visible.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "refactor: rename to index.html and add view containers"
```

---

### Task 2: Hash router + functional nav

**Files:**
- Modify: `index.html` (`<script>` — add `router` section banner)

**Interfaces:**
- Produces: `function navigate(hash)` and `function currentRoute()`; a `ROUTES` map `{ '#/dashboard':'view-dashboard', '#/orchestrator':'view-orchestrator', '#/erp':'view-erp', '#/audit':'view-audit' }` plus agent-route parsing `#/agent/<id>` → `view-agent`; `function renderView(routeName, params)` dispatch (view render functions registered in later tasks via `VIEW_RENDERERS[name] = fn`). Nav tab + quick-link click handlers call `navigate(...)`.

- [ ] **Step 1: Add the router**

```js
/* ===== ROUTER ===== */
const VIEW_RENDERERS = {}; // populated by view tasks
const ROUTES = {
  '#/dashboard':'view-dashboard', '#/orchestrator':'view-orchestrator',
  '#/erp':'view-erp', '#/audit':'view-audit'
};
function parseHash(h){
  h = h || location.hash || '#/dashboard';
  const m = h.match(/^#\/agent\/([\w-]+)$/);
  if (m) return { view:'view-agent', name:'agent', param:m[1] };
  const view = ROUTES[h];
  if (view) return { view, name:h.replace('#/',''), param:null };
  return { view:'view-dashboard', name:'dashboard', param:null }; // fallback
}
function navigate(h){ if (location.hash !== h) location.hash = h; else renderRoute(); }
function renderRoute(){
  const r = parseHash(location.hash);
  document.querySelectorAll('.view').forEach(v => v.hidden = (v.id !== r.view));
  document.querySelectorAll('[data-route]').forEach(el =>
    el.classList.toggle('is-active', el.getAttribute('data-route') === (r.param?('#/agent/'+r.param):('#/'+r.name))));
  const fn = VIEW_RENDERERS[r.name] || VIEW_RENDERERS[r.param?'agent':r.name];
  if (fn) fn(r.param);
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', renderRoute);
```

- [ ] **Step 2: Wire nav tabs & quick-links**

Give each existing nav tab and quick-link a `data-route="#/..."` attribute and change their click handlers from "toast only" to `navigate(el.getAttribute('data-route'))`. Map: Royalties/Collections/Billing & Rebate/Tax & Compliance/Controls → their agent routes (`#/agent/royalty` etc.); quick-links All Agents→`#/dashboard`, Reports→`#/dashboard`, Audit Trail→`#/audit`, Agent Config→`#/orchestrator`. Add an active-tab style reusing the existing highlight color token.

- [ ] **Step 3: Verify routing**

Open `index.html`. Expected:
- Default (`#` empty) shows dashboard.
- Clicking a nav tab updates the hash and hides dashboard / shows the (currently empty) target view; the tab shows the active highlight.
- Manually set `location.hash = '#/audit'` in console then reload → still audit view (not blank).
- Set `#/nonsense` and `#/agent/zzz` → falls back to dashboard, no console error.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add hash router and make nav/quick-links functional"
```

---

### Task 3: Shared components, DATA module, theme toggle & BC indicator

**Files:**
- Modify: `index.html` (`<script>` — `DATA`, `components`, `chrome` banners; `<style>` — theme variables)

**Interfaces:**
- Produces:
  - `const DATA = { companies:[…], invoices:[…], vatEntries:[…], ledger:[…], holdQueue:[…], audit:[…], agents:{…}, kpis:{…} }` (see spec §5). Each collection is an array of plain objects with the reference IDs.
  - `function toast(msg)` (reuse existing if present; else add).
  - `function el(tag, attrs, ...children)` tiny DOM helper.
  - `function dataTable(columns, rows, opts)` → returns a `<table>` element styled with existing table classes; `opts.emptyText` renders one full-width empty-state row when `rows.length===0`.
  - `function kpiCard(label, value, sub)` → styled KPI card element (reuse existing KPI card markup/classes).
  - `function donut(segments)` and `function lineChart(seriesA, seriesB, labels)` → inline `<svg>` in the existing chart style.
  - `function setTheme(mode)` toggles `document.documentElement.dataset.theme` and persists to `localStorage['aurelius-theme']`; `function initTheme()` reads it (default `light`).
  - BC indicator: `function setBcStatus(state)` where state ∈ `{live,synced,authenticating}` updates the indicator label/dot; `function bcSyncNow()` → sets `authenticating` then `synced` after ~800ms + `toast('Synced from Business Central')`.

- [ ] **Step 1: Add DATA**

Add `const DATA = {…}` populated with the spec's reference IDs — at minimum: 6+ invoices (INV-77120/77133/77140/77155 + 2), 5 VAT entries (VAT-3391…3395), 8+ ledger rows (V-1042…1177, mix of Net 15/30/45, statuses Overdue/Paid/Open), 4 hold-queue rows (exception types Quantity mismatch/Price variance/Missing GRN/Duplicate suspected), 6 audit rows (AUD-8836…8841 with Action/Classification/Routed Agent/Confidence/Human Override/BC action/Approved-by/timestamp), the 7 agents (id, name, tagline, bcEndpoint, kpis[], log[]), and dashboard orchestration KPIs.

- [ ] **Step 2: Add component helpers**

Implement `el`, `toast` (reuse if present), `dataTable` (with empty-state handling), `kpiCard`, `donut`, `lineChart` using existing CSS classes/variables only.

- [ ] **Step 3: Add theme variables and toggle**

Move existing color values into `:root` custom properties if not already, and add `:root[data-theme="dark"]{…}` overrides using the D365 dark palette (dark chrome already present in the top bar — extend consistently). Add a theme-toggle button (Moon/Sun) to the top bar next to existing icons; wire to `setTheme`. Call `initTheme()` at load. Add the BC connection indicator + "Sync Now" button to the top bar; wire `bcSyncNow`.

- [ ] **Step 4: Verify**

Open `index.html`. Expected:
- App looks unchanged in light mode; theme toggle flips to a coherent dark mode across the shell and dashboard; reload preserves the chosen theme.
- BC indicator shows "Live from Business Central"; clicking Sync Now briefly shows "Authenticating…" then "Synced" + toast.
- In console: `dataTable([{key:'a',label:'A'}], [], {emptyText:'None'})` returns a table showing the empty-state row.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add DATA, shared components, theme toggle, BC indicator"
```

---

### Task 4: Dashboard orchestration KPIs + throughput/load-split charts

**Files:**
- Modify: `index.html` (`#view-dashboard` markup + `views` banner: `VIEW_RENDERERS.dashboard`)

**Interfaces:**
- Consumes: `DATA.kpis`, `kpiCard`, `donut`, `lineChart`.
- Produces: `VIEW_RENDERERS.dashboard = function(){…}` (idempotent render into placeholder nodes).

- [ ] **Step 1: Add orchestration KPI row**

In `#view-dashboard`, add a KPI row rendered via `kpiCard` for: Transactions Orchestrated, Value Under Automation, Straight-Through Rate, Avg. Routing Confidence (values from `DATA.kpis`). Place it near the existing KPI cards using the same grid/spacing.

- [ ] **Step 2: Add Throughput + Load Split charts**

Add an "Orchestration Throughput" panel rendering `lineChart(...)` and an "Agent Load Split" panel rendering `donut(...)` across the agents, styled like the existing business-assistance charts.

- [ ] **Step 3: Register renderer**

`VIEW_RENDERERS.dashboard = renderDashboard;` where `renderDashboard()` injects the KPI values and charts (safe to call repeatedly).

- [ ] **Step 4: Verify**

Open `index.html` on dashboard. Expected: existing content intact; new orchestration KPI row + throughput line chart + load-split donut appear, in both light and dark themes.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add orchestration KPIs and dashboard charts"
```

---

### Task 5: Agent workspace view (7 agents, tool shell)

**Files:**
- Modify: `index.html` (`#view-agent` + `VIEW_RENDERERS.agent`)

**Interfaces:**
- Consumes: `DATA.agents`, `DATA.invoices`, `dataTable`, `toast`.
- Produces: `VIEW_RENDERERS.agent = function(agentId){…}`; `function runAgentTool(agentId, inputValue)` → returns a result object `{summary, bcAction, related:[invoiceIds]}` and renders it; `function appendAgentLog(agentId, entry)`.

- [ ] **Step 1: Render workspace chrome**

`renderAgentWorkspace(agentId)`: look up `DATA.agents[agentId]` (fallback to dashboard via `navigate('#/dashboard')` if missing). Render header (name, tagline, BC endpoint), a **KPI strip** from `agent.kpis`, the agent-specific **tool** (input selector + Run button + empty result panel + "Related BC Invoices" panel), and the **activity log** from `agent.log`. A `workspace-back-button` calls `navigate('#/dashboard')`.

- [ ] **Step 2: Implement per-agent tools**

`runAgentTool` switches on `agentId`, each producing deterministic output using DATA:
- `ap` → 3-Way Match Resolver over a selected hold-queue invoice + AP Hold Queue table.
- `collections` → Dunning & Promise-to-Pay over selected ledger customer (shows aging).
- `billing` → Rebate Reconciliation (tier recompute → credit memo amount).
- `tax` → VAT/Nexus cross-check for a selected jurisdiction/entry → "VAT journal posted".
- `vendor` → Vendor Query Simulator (payment status / W-9 valid).
- `royalty` → statement reconciliation for Creator #4471 (keep existing content).
- `controls` → access-review result (keep existing content).
Each result renders into the result panel + Related BC Invoices, appends to the activity log, and toasts.

- [ ] **Step 3: Register renderer**

`VIEW_RENDERERS.agent = renderAgentWorkspace;`

- [ ] **Step 4: Verify**

Open `#/agent/ap` (and each other id). Expected: header/KPI strip/tool/log render; selecting an input and clicking Run populates the result + Related BC Invoices and adds a log entry; back button returns to dashboard; `#/agent/zzz` falls back to dashboard.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add agent workspaces with interactive tools for all 7 agents"
```

---

### Task 6: Master Orchestrator view

**Files:**
- Modify: `index.html` (`#view-orchestrator` + `VIEW_RENDERERS.orchestrator`)

**Interfaces:**
- Consumes: `DATA.agents`, `appendAuditRow` (Task 8 — define a stub `window.appendAuditRow` here that pushes to `DATA.audit`; Task 8 renders from `DATA.audit`), `appendAgentLog`, `toast`.
- Produces: `VIEW_RENDERERS.orchestrator = function(){…}`; `function classifyPrompt(text)` → `{classification, confidence, agentId, bcAction, result}`; `function runOrchestrator(text)` animates the pipeline then renders the result block and appends audit + agent log rows.

- [ ] **Step 1: Render orchestrator UI**

Chat input + Send button + example-prompt chips (the 5 spec prompts). A pipeline element with stages: Intent Parsing → Scoring (confidence badge) → Routed Agent → Domain Workflow → BC API Call → Persist to Ledger. An empty result-block container.

- [ ] **Step 2: Implement classifier + run**

```js
const PROMPT_MAP = [
  {re:/3-way match|INV-77120/i, agentId:'ap', classification:'AP Exception', confidence:0.97, bcAction:'GET /purchaseInvoices · match cleared'},
  {re:/rebate|Publicis/i, agentId:'billing', classification:'Billing & Rebate', confidence:0.95, bcAction:'POST /salesCreditMemos · draft credit memo'},
  {re:/VAT|reverse-charge|SI-90233/i, agentId:'tax', classification:'Tax & Compliance', confidence:0.96, bcAction:'POST /journals · VAT journal posted'},
  {re:/overdue|Meridian/i, agentId:'collections', classification:'Collections', confidence:0.93, bcAction:'GET /customerLedgerEntries · Dunning L2'},
  {re:/paid|Spark Foundry/i, agentId:'vendor', classification:'Vendor Query', confidence:0.9, bcAction:'GET /vendorPayments · payment ETA'}
];
function classifyPrompt(t){
  const hit = PROMPT_MAP.find(p=>p.re.test(t)) ||
    {agentId:'ap', classification:'General', confidence:0.72, bcAction:'GET /purchaseInvoices'};
  return {...hit, result: `Routed to ${DATA.agents[hit.agentId].name}. ${hit.bcAction}.`};
}
```
`runOrchestrator(text)` steps the pipeline stages with `setTimeout`, renders the result block (Classification / Confidence / Routed Agent / BC action / result text), then `appendAuditRow({...})` and `appendAgentLog(hit.agentId, ...)`.

- [ ] **Step 3: Register renderer**

`VIEW_RENDERERS.orchestrator = renderOrchestrator;`

- [ ] **Step 4: Verify**

Open `#/orchestrator`. Expected: clicking each example chip fills the input and running animates the pipeline and shows a result with a confidence badge and BC action; a **free-typed** prompt with no keyword still routes (General, 0.72) and produces a valid result; each run adds a row visible later at `#/audit` (no `undefined` fields).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Master Orchestrator with routing pipeline and audit persistence"
```

---

### Task 7: Business Central Explorer view

**Files:**
- Modify: `index.html` (`#view-erp` + `VIEW_RENDERERS.erp`)

**Interfaces:**
- Consumes: `DATA.ledger`, `DATA.invoices`, `DATA.vatEntries`, `DATA.holdQueue`, `dataTable`, `setBcStatus`, `bcSyncNow`, `toast`.
- Produces: `VIEW_RENDERERS.erp = function(){…}`; `function renderErpTab(tabKey, filterText)`.

- [ ] **Step 1: Render explorer UI**

Tabs: Vendor Ledger, Sales Invoices, VAT Entries, AP Hold Queue. A filter input, Sync button (→`bcSyncNow`), Export button (→`toast('CSV extract will be emailed')`), and protocol chips (OData v4, REST Automation, SOAP (Legacy Pages), Webhooks / Bus. Events). Table body rendered by `renderErpTab` via `dataTable` with the correct columns per the spec.

- [ ] **Step 2: Client-side filter**

`renderErpTab(tabKey, filterText)` filters the active collection case-insensitively across all cell values; passes `{emptyText:'No records match the filter.'}` to `dataTable` so no-match shows an empty-state row.

- [ ] **Step 3: Register renderer**

`VIEW_RENDERERS.erp = renderErp;`

- [ ] **Step 4: Verify**

Open `#/erp`. Expected: each tab shows its table with correct columns; typing in the filter narrows rows live; a no-match filter shows the empty-state row (not a blank table); Sync pulses the BC indicator; Export toasts; protocol chips render.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Business Central Explorer with filterable ledger/invoice/VAT/hold tables"
```

---

### Task 8: Audit & Compliance Log view

**Files:**
- Modify: `index.html` (`#view-audit` + `VIEW_RENDERERS.audit`)

**Interfaces:**
- Consumes: `DATA.audit`, `dataTable`.
- Produces: `VIEW_RENDERERS.audit = function(){…}`; `function appendAuditRow(row)` (replaces the Task 6 stub — pushes to `DATA.audit` then re-renders if audit view is active); `function renderAudit(searchText)`.

- [ ] **Step 1: Render audit UI**

Header noting "Immutable · WORM ledger". A search input. Table via `dataTable` with columns: Record ID, Action Taken, Classification, Routed Agent, Confidence, Human Override, BC action, Approved-by, Timestamp. Seed from `DATA.audit` (AUD-8836…8841).

- [ ] **Step 2: Search + append**

`renderAudit(searchText)` filters rows case-insensitively (empty-state row on no match). Finalize `appendAuditRow(row)` to push and, if `#/audit` is active, re-render — so orchestrator runs show up.

- [ ] **Step 3: Register renderer**

`VIEW_RENDERERS.audit = renderAudit;`

- [ ] **Step 4: Verify**

Open `#/audit`. Expected: seed records show with all columns populated; search filters live; no-match shows empty-state; running a prompt in `#/orchestrator` then returning to `#/audit` shows the new row with no `undefined` fields.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add Audit & Compliance Log with search and live orchestrator persistence"
```

---

### Task 9: Azure Static Web Apps deployment scaffolding

**Files:**
- Create: `staticwebapp.config.json`
- Create: `.github/workflows/azure-static-web-apps.yml`
- Create: `DEPLOY.md`
- Modify: `USAGE.txt`

**Interfaces:** none (config + docs).

- [ ] **Step 1: staticwebapp.config.json**

```json
{
  "navigationFallback": { "rewrite": "/index.html", "exclude": ["/*.{png,jpg,svg,css,js,json,ico}"] },
  "defaultHeaders": { "cache-control": "no-cache" },
  "routes": [ { "route": "/", "rewrite": "/index.html" } ]
}
```

- [ ] **Step 2: GitHub Actions workflow**

```yaml
name: Azure Static Web Apps CI/CD
on:
  push:
    branches: [ main ]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [ main ]
jobs:
  build_and_deploy:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy
    steps:
      - uses: actions/checkout@v4
        with: { submodules: true }
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/"
          api_location: ""
          output_location: ""
          skip_app_build: true
  close_pr:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request
    steps:
      - name: Close Pull Request
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: "close"
```

- [ ] **Step 3: DEPLOY.md**

Write the two manual steps: (1) In the Azure Portal, create a Static Web App (plan: Free), source **Other**/GitHub, copy the **deployment token**, and add it as GitHub repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (Settings → Secrets and variables → Actions). (2) `git remote add origin https://github.com/Anjin-san-ai/D365_Business_Central_AuditApp.git` then `git push -u origin main`; the workflow deploys on push. Note the app is served at the SWA default hostname; hash routes work via `navigationFallback`.

- [ ] **Step 4: Update USAGE.txt click-map**

Append a section documenting the new routes (`#/orchestrator`, `#/erp`, `#/audit`, `#/agent/<id>`), what is clickable vs decorative on each, the theme toggle and BC Sync Now, and note the additive-roster difference vs Aurelius.

- [ ] **Step 5: Validate config + serve locally**

```bash
python3 -c "import json;json.load(open('staticwebapp.config.json'));print('config ok')"
python3 -m http.server 8080 >/dev/null 2>&1 &  # then open http://localhost:8080/ and click through every route; Ctrl-refresh on #/audit
```
Expected: JSON parses; every route renders; hard refresh works.

- [ ] **Step 6: Commit**

```bash
git add staticwebapp.config.json .github/workflows/azure-static-web-apps.yml DEPLOY.md USAGE.txt
git commit -m "chore: add Azure Static Web Apps deployment scaffolding and docs"
```

---

## Self-Review

**1. Spec coverage:** Dashboard KPIs/charts→T4; Orchestrator→T6; Agent workspaces/tools (all 7)→T5; BC Explorer→T7; Audit Log→T8; theme toggle + BC indicator→T3; router/functional nav→T2; DATA model→T3; deployment (config/workflow/DEPLOY.md/USAGE)→T9; rename to index.html→T1. All spec sections mapped.

**2. Placeholder scan:** No TBD/TODO; each code step carries real code or exact click-paths. Verification steps are manual by design (no test runner exists for a static mockup) and each names the exact expected result.

**3. Type consistency:** `VIEW_RENDERERS[name]` registration and `navigate`/`renderRoute` names consistent across T2–T8; `appendAuditRow` defined as stub in T6 and finalized in T8 (noted explicitly); `runAgentTool`/`appendAgentLog` defined T5, consumed T6; `dataTable(columns, rows, opts)`, `donut`, `lineChart`, `kpiCard`, `setBcStatus`/`bcSyncNow`, `setTheme`/`initTheme` all defined T3 before use.

**4. Review Focus:** Five listed — hard-refresh deep route (T2 v-step), unknown/malformed hash (T2 v-step), theme across late views (T3/T5/T7/T8 v-steps), orchestrator free-typed input (T6 v-step), empty filter result (T7/T8 v-steps). Each pinned to its owning task's verification.
