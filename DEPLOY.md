# Deploying to Azure Static Web Apps

This app is a **static site** (a single `index.html` plus image/SVG assets) — no build
step, no backend. It ships to Azure Static Web Apps (SWA) via the GitHub Actions workflow
in `.github/workflows/azure-static-web-apps.yml`.

Target repo: `https://github.com/Anjin-san-ai/D365_Business_Central_AuditApp.git`

## What's already in place

| File | Purpose |
|------|---------|
| `index.html` | The whole app (markup + CSS + JS). Served at `/`. |
| `reach-logo.svg`, `Cognizantlogo.png`, `Picture1.png` | Brand/reference assets. |
| `staticwebapp.config.json` | SPA fallback so hash routes (`#/orchestrator`, `#/erp`, `#/audit`, `#/agent/<id>`) and hard refresh resolve to `index.html`. |
| `.github/workflows/azure-static-web-apps-*.yml` | Azure-generated deploy workflow (created when the SWA resource was linked to this repo). Deploys on push to `main`; wired to its own token secret. |

> **Status:** the Static Web App resource has already been linked to this repo, so Azure
> committed its own workflow (`azure-static-web-apps-<name>.yml`) with the deployment-token
> secret already configured. The manual steps below are only needed if you re-create the
> resource from scratch.

## Two manual steps (only if re-creating the SWA resource)

### 1. Create the Static Web App and copy its deployment token

1. In the [Azure Portal](https://portal.azure.com), **Create a resource → Static Web App**.
2. Plan type: **Free** is fine for this demo.
3. Deployment source: **GitHub** → authorize and pick
   `Anjin-san-ai/D365_Business_Central_AuditApp`, branch `main`.
   - Build presets: **Custom**. App location: `/`. Api location: *(blank)*. Output location: *(blank)*.
   - (If Azure auto-creates a workflow file, delete Azure's and keep the one in this repo — it already has `skip_app_build: true`.)
4. After creation, open the resource → **Manage deployment token** → copy the token.
5. In GitHub: repo **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: the token from step 4.

### 2. Push the code

```bash
git remote add origin https://github.com/Anjin-san-ai/D365_Business_Central_AuditApp.git
git push -u origin main
```

The push triggers the workflow, which uploads the static content to Azure. The app is then
live at the SWA default hostname shown in the Azure Portal
(`https://<name>.azurestaticapps.net`). Every later push to `main` redeploys automatically,
and pull requests get preview environments.

> **Note:** the work is currently on branch `feat/aurelius-agentic-layer`. Merge it to `main`
> (or push it as `main`) before the workflow will run, since the workflow triggers on `main`.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080/  and click through every route
```
(The `python3 -m http.server` fallback does not apply `staticwebapp.config.json`, so a hard
refresh on a deep hash route relies on the in-page router — which handles it. The SWA
`navigationFallback` matters for non-hash paths.)
