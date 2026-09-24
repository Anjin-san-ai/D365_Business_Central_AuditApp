const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/Users/541388/Library/CloudStorage/OneDrive-Cognizant/Documents/Projects/Reach/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.com/index.html' });
const { window } = dom;
const doc = window.document;
window.scrollTo = () => {};
const wait = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, fail = 0;
function check(name, cond) { if (cond) { ok++; console.log('ok  -', name); } else { fail++; console.log('FAIL-', name); } }
function go(hash) { window.location.hash = hash; window.dispatchEvent(new window.Event('hashchange')); }
function visible(id) { const e = doc.getElementById(id); return e && !e.hidden; }

(async () => {
  window.dispatchEvent(new window.Event('DOMContentLoaded'));

  check('dashboard default visible', visible('view-dashboard'));
  check('dashboard orchestration KPIs', doc.getElementById('au-dash-extra') && doc.getElementById('au-dash-extra').textContent.includes('Transactions Orchestrated'));
  check('dashboard donut svg', doc.querySelectorAll('#au-dash-extra svg').length >= 2);

  // baseline audit row count via DOM
  go('#/audit');
  const auditBaseline = doc.querySelectorAll('#audit-table-host tbody tr').length;

  go('#/orchestrator');
  check('orchestrator visible', visible('view-orchestrator'));
  check('orchestrator input', !!doc.getElementById('orchestrator-chat-input'));
  check('5 prompt chips', doc.querySelectorAll('#root-orchestrator .au-chip.clickable').length === 5);
  window.runOrchestrator('Resolve the 3-way match exception on INV-77120');
  await wait(3000);
  const res = doc.getElementById('orchestrator-result').textContent;
  check('orchestrator result classification', res.includes('AP Exception'));
  check('orchestrator result confidence', res.includes('0.97'));
  go('#/audit');
  const afterRun1 = doc.querySelectorAll('#audit-table-host tbody tr');
  check('orchestrator appended audit row', afterRun1.length === auditBaseline + 1);
  const firstRowCells = Array.from(afterRun1[0].querySelectorAll('td')).map(td => td.textContent);
  check('appended audit row has no empty/undefined cell', firstRowCells.length === 9 && firstRowCells.every(t => t && t !== 'undefined'));

  // free-typed prompt
  go('#/orchestrator');
  window.runOrchestrator('please help with something vague');
  await wait(3000);
  check('free-typed routes General', doc.getElementById('orchestrator-result').textContent.includes('General'));
  go('#/audit');
  check('free-typed appends audit', doc.querySelectorAll('#audit-table-host tbody tr').length === auditBaseline + 2);

  go('#/erp');
  check('erp visible', visible('view-erp'));
  check('erp default ledger table rows', doc.querySelectorAll('#erp-table-host tbody tr').length === 6);
  window.renderErpTab('ledger', 'zzzznomatch');
  const emptyRow = doc.querySelector('#erp-table-host tbody tr.au-empty');
  check('erp empty-state on no match', !!emptyRow && /no records match/i.test(emptyRow.textContent));
  window.renderErpTab('ledger', 'meridian');
  check('erp filter narrows', doc.querySelectorAll('#erp-table-host tbody tr:not(.au-empty)').length === 1);

  go('#/audit');
  check('audit visible', visible('view-audit'));
  check('audit seed rows >=6', doc.querySelectorAll('#audit-table-host tbody tr').length >= 6);
  window.renderAuditTable('zzznomatch');
  check('audit empty-state', !!doc.querySelector('#audit-table-host tbody tr.au-empty'));

  go('#/agent/ap');
  check('agent workspace visible', visible('view-agent'));
  check('agent KPI strip', doc.querySelectorAll('#root-agent .au-kpi').length === 4);
  check('agent tool run button', !!doc.getElementById('tool-run-button'));
  const logBefore = doc.querySelectorAll('#au-agent-log .au-log-item').length;
  doc.getElementById('tool-run-button').click();
  check('agent tool result populated', /3-way match/i.test(doc.getElementById('tool-result').textContent));
  check('agent related invoices', /INV-/.test(doc.getElementById('tool-related').textContent));
  check('agent log grew', doc.querySelectorAll('#au-agent-log .au-log-item').length === logBefore + 1);

  // fallback routes
  go('#/agent/zzz');
  check('unknown agent falls back to dashboard', visible('view-dashboard'));
  go('#/nonsense');
  check('unknown hash falls back to dashboard', visible('view-dashboard'));

  // theme
  window.toggleTheme();
  check('theme dark set', doc.documentElement.dataset.theme === 'dark');
  check('theme persisted', window.localStorage.getItem('aurelius-theme') === 'dark');
  window.toggleTheme();
  check('theme back to light', doc.documentElement.dataset.theme === 'light');

  // --- review fixes ---
  // Fix A: empty Send must not append a junk audit row
  go('#/audit');
  const baseAudit = doc.querySelectorAll('#audit-table-host tbody tr').length;
  go('#/orchestrator');
  doc.getElementById('orchestrator-chat-input').value = '';
  doc.getElementById('orchestrator-send-button').click();
  await wait(3000);
  go('#/audit');
  check('empty Send appends no audit row', doc.querySelectorAll('#audit-table-host tbody tr').length === baseAudit);

  // Fix B: free-typed vague query routes coherently (agent matches classification, log lands on that agent)
  go('#/orchestrator');
  window.runOrchestrator('please help with something vague and unmatched xyz');
  await wait(3000);
  const rtxt = doc.getElementById('orchestrator-result').textContent;
  check('vague query routes to Vendor Query Assistant', rtxt.includes('Vendor Query Assistant'));
  check('vague query classified General Inquiry', rtxt.includes('General Inquiry'));
  go('#/agent/vendor');
  check('vague query logged on the routed (vendor) agent', doc.getElementById('au-agent-log').textContent.includes('vague and unmatched xyz'));
  go('#/agent/ap');
  check('vague query NOT logged on AP agent', !doc.getElementById('au-agent-log').textContent.includes('vague and unmatched xyz'));

  console.log('\n=== ' + ok + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
