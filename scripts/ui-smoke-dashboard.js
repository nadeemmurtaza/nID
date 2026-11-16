// Browser smoke for the dashboard UX patterns: tabs in the URL (Back works),
// command palette, shared data table (select, bulk bar, filter), app 404,
// mobile layout. Needs a running stack and `next start -p 3200`.
//   API=http://localhost:4000 DASH=http://localhost:3200 ADMIN_SECRET=... NODE_PATH=$(npm root -g) node scripts/ui-smoke-dashboard.js
const { chromium } = require('playwright');
const API = process.env.API || 'http://localhost:4000';
const DASH = process.env.DASH || 'http://localhost:3200';
let fails = 0;
const ck = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${extra}`); };
(async () => {
  const t = await (await fetch(`${API}/v1/tenants`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.ADMIN_SECRET}` }, body: JSON.stringify({ name: 'ui-smoke', slug: `ui-smoke-${Date.now()}` }) })).json();
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(([k, id]) => { localStorage.setItem('nid_dashboard_credential', k); localStorage.setItem('nid_dashboard_tenant', JSON.stringify({ id })); }, [t.apiKey, t.id]);
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(DASH); await p.waitForSelector('.dashboard-layout');

  await p.getByRole('button', { name: 'Staff', exact: true }).click();
  ck('tab goes in the URL', p.url().endsWith('#staff'), p.url());
  await p.getByRole('button', { name: 'API keys', exact: true }).click();
  ck('second tab in URL', p.url().endsWith('#api-keys'));
  await p.goBack(); await p.waitForTimeout(200);
  ck('Back returns to the previous tab', (await p.locator('h1').first().textContent()) === 'Staff');
  await p.goto(`${DASH}/#roles`); await p.waitForSelector('.dashboard-layout');
  ck('deep link opens the tab', (await p.locator('h1').first().textContent()).startsWith('Role'));

  await p.keyboard.press('g'); await p.keyboard.press('k');
  await p.waitForTimeout(300);
  ck('g then k jumps to API keys', p.url().endsWith('#api-keys'));
  await p.waitForSelector('table.data-table');
  ck('table has sortable headers', (await p.locator('th[aria-sort]').count()) > 0);
  await p.locator('tbody input[type=checkbox]').first().check();
  ck('selecting a row shows the bulk bar', await p.getByText('1 selected').isVisible());
  await p.getByLabel('Filter keys').fill('zzzz-nothing'); await p.waitForTimeout(400);
  ck('filter narrows the list', (await p.getByText('No rows match').count()) === 1);

  await p.getByLabel('Filter keys').blur();
  await p.keyboard.press('Control+k');
  ck('Ctrl+K opens the palette', await p.locator('.nid-palette-input').isVisible());
  await p.keyboard.type('brand'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ck('palette runs a command', p.url().endsWith('#brands'), p.url());

  await p.goto(`${DASH}/definitely-missing`);
  ck('app-level 404 page', (await p.locator('h1').textContent()).includes('does not exist'));

  await p.setViewportSize({ width: 375, height: 700 });
  await p.goto(`${DASH}/#overview`); await p.waitForSelector('.dashboard-layout');
  ck('mobile: no horizontal page scroll', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const small = await p.locator('.nav-item').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
  ck('mobile: nav hit areas >= 44px', small === 0);
  ck('no page errors', errs.length === 0, errs.join(' | ').slice(0, 200));
  await b.close(); process.exit(fails ? 1 : 0);
})();
