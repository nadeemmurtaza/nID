// Browser smoke test for login-ui against a running stack: the consent banner,
// system font, flat cards, the delete-account confirmation and the erasure.
//   API=http://localhost:4000 LOGIN_UI=http://localhost:3300 ACCOUNTS_LOG=... \
//   NODE_PATH=$(npm root -g) node scripts/ui-smoke.js
const { chromium } = require('playwright');
const API = process.env.API || 'http://localhost:4000';
const UI = process.env.LOGIN_UI || 'http://localhost:3300';
const SHOTS = process.env.SHOTS || '/tmp';
if (!process.env.ACCOUNTS_LOG) { console.error('set ACCOUNTS_LOG'); process.exit(2); }
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = []; p.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.request().method(), r.url().slice(0,120)); }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const out = (k, v) => console.log(`${k}: ${v}`);

  await p.goto(`${UI}/signin`); await p.waitForTimeout(800);
  out('banner visible first visit', await p.locator('.nid-consent').isVisible());
  await p.screenshot({ path: ''+SHOTS+'/signin-banner.png' });
  const fonts = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  out('body font-family', fonts); out('mentions Inter', /inter/i.test(fonts));
  const btns = await p.locator('.nid-consent button').allTextContents(); out('banner buttons', btns.join(' | '));
  const sizes = await p.locator('.nid-consent button').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }));
  out('banner button sizes', sizes.join(' '));
  await p.locator('.nid-consent button', { hasText: 'Decline' }).click();
  out('stored choice', await p.evaluate(() => localStorage.getItem('nid-consent')));
  await p.reload(); await p.waitForTimeout(500);
  out('banner after choosing', await p.locator('.nid-consent').count());

  // sign in with a dev OTP
  const phone = '+1555' + Math.floor(1e6 + Math.random() * 9e6) + Math.floor(100 + Math.random() * 900);
  const r1 = await fetch(`${API}/v1/accounts/otp/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
  await new Promise(r => setTimeout(r, 1500));
  const log = fs.readFileSync(process.env.ACCOUNTS_LOG, 'utf8').split('\n').filter(l => l.includes('would send login code')).pop();
  const code = log.match(/login code (\d+)/)[1];
  const v = await (await fetch(`${API}/v1/accounts/otp/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code }) })).json();
  await p.evaluate(t => localStorage.setItem('nid_account_session', t), v.sessionToken);
  await p.goto(`${UI}/account`); await p.waitForSelector('text=Delete account', { timeout: 8000 });
  await p.screenshot({ path: ''+SHOTS+'/account.png', fullPage: true });
  const card = await p.locator('.card').first().evaluate(e => getComputedStyle(e).boxShadow); out('card box-shadow', card);

  await p.click('text=Delete my account'); await p.waitForSelector('dialog[open]');
  out('dialog title', await p.locator('dialog h2').textContent());
  out('focus starts on', await p.evaluate(() => document.activeElement && document.activeElement.textContent));
  await p.screenshot({ path: ''+SHOTS+'/confirm.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  out('dialog open after Escape', await p.locator('dialog[open]').count());
  const stillThere = await fetch(`${API}/v1/accounts/me`, { headers: { authorization: 'Bearer ' + v.sessionToken } });
  out('account still exists after cancel (200)', stillThere.status);

  await p.click('text=Delete my account'); await p.waitForSelector('dialog[open]');
  await p.click('dialog button.nid-dialog-danger'); await p.waitForURL(`${UI}/`, { timeout: 8000 });
  const gone = await fetch(`${API}/v1/accounts/me`, { headers: { authorization: 'Bearer ' + v.sessionToken } });
  out('account after confirm (401 = erased)', gone.status);
  out('stored session cleared', await p.evaluate(() => localStorage.getItem('nid_account_session')));
  out('page errors', errs.length ? errs.join(' || ').slice(0, 300) : 'none');
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
