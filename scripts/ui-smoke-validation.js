// Browser proof that invalid input never leaves the page: the form guard blocks
// submit, shows the reason next to the field, and no request is sent.
//   API=... LOGIN_UI=http://localhost:3300 DASH=http://localhost:3200 ADMIN_SECRET=... NODE_PATH=$(npm root -g) node scripts/ui-smoke-validation.js
const { chromium } = require('playwright');
const API = process.env.API || 'http://localhost:4000';
const LOGIN = process.env.LOGIN_UI || 'http://localhost:3300';
const DASH = process.env.DASH || 'http://localhost:3200';
let fails = 0;
const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n} ${x}`); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1100, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem('nid_consent', JSON.stringify({ version: 1, decided: true, categories: { analytics: false, marketing: false } })));
  const p = await ctx.newPage();
  const sent = []; p.on('request', (r) => { if (r.method() === 'POST' && r.url().startsWith(API)) sent.push(r.url()); });

  await p.goto(`${LOGIN}/signin`); await p.waitForSelector('#phone');
  await p.fill('#phone', 'not a phone');
  await p.locator('form button[type=submit], form button:not([type])').first().click(); await p.waitForTimeout(400);
  ck('bad phone: error shown beside the field', await p.getByText('international format').isVisible());
  ck('bad phone: nothing was sent', sent.length === 0, `(${sent.length} requests)`);
  ck('bad phone: field is marked invalid', (await p.locator('#phone').getAttribute('aria-invalid')) === 'true');
  await p.fill('#phone', '+1 415 555 0123'); await p.waitForTimeout(200);
  ck('fixing the field clears the error', (await p.getByText('international format').count()) === 0);
  await p.locator('form button[type=submit], form button:not([type])').first().click(); await p.waitForTimeout(800);
  ck('valid phone: the request is sent', sent.some((u) => u.includes('/otp/start')));

  // Dashboard: organization form
  const t = await (await fetch(`${API}/v1/tenants`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.ADMIN_SECRET}` }, body: JSON.stringify({ name: 'val-smoke', slug: `val-smoke-${Date.now()}` }) })).json();
  await ctx.addInitScript(([k, id]) => { localStorage.setItem('nid_dashboard_credential', k); localStorage.setItem('nid_dashboard_tenant', JSON.stringify({ id })); }, [t.apiKey, t.id]);
  sent.length = 0;
  await p.goto(`${DASH}/#organizations`); await p.waitForSelector('.dashboard-layout');
  await p.getByRole('button', { name: /create organization/i }).first().click();
  await p.getByLabel('Legal name').fill('<b>Acme</b>');
  await p.getByLabel('Country code').fill('usa');
  await p.getByRole('button', { name: /create organization/i }).last().click(); await p.waitForTimeout(400);
  ck('dashboard: HTML tag in a name is blocked', await p.getByText('Remove HTML tags').isVisible());
  ck('dashboard: bad country code is blocked', (await p.getByText(/two letters|two-letter/i).count()) > 0);
  ck('dashboard: nothing was sent', sent.length === 0, `(${sent.length})`);
  await p.getByLabel('Legal name').fill('Acme‮ Ltd');
  await p.getByLabel('Country code').fill('US');
  await p.getByRole('button', { name: /create organization/i }).last().click(); await p.waitForTimeout(400);
  ck('dashboard: direction-override character is blocked', await p.getByText(/not allowed/).first().isVisible());
  ck('dashboard: still nothing sent', sent.length === 0);
  await b.close(); process.exit(fails ? 1 : 0);
})();
