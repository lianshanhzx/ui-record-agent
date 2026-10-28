// probe52: 【获取股东信息】点击后 15s 细粒度监控（toast 全捕获/新 tab/全 API/弹层）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const newPages = [];
  ctx.on('page', (p) => newPages.push('NEW_TAB:' + p.url()));
  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/^http(s)?:\/\//.test(u) === false) return;
    if (!/tansun|creditv5|\/api\//.test(u)) return;
    let body = '';
    try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    let resp = '';
    try { resp = (await r.text()).slice(0, 300); } catch {}
    apis.push({ t: Date.now(), m: r.request().method(), u: u.split('/').filter(Boolean).slice(-2).join('/'), status: r.status(), body, resp });
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sleep(3000);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(1000);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /股东/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const shRows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');

  // toast 监听：点击前挂 MutationObserver
  await page.evaluate(() => {
    window.__toasts = [];
    const mo = new MutationObserver(() => {
      document.querySelectorAll('.el-message, .el-notification, .el-message-box, .v-modal').forEach((el) => {
        const t = (el.innerText || '').trim().slice(0, 300);
        if (t && !window.__toasts.includes(t + '|' + el.className)) window.__toasts.push(t + '|' + el.className);
      });
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  const fetchBtn = pane.getByRole('button').filter({ hasText: /获取股东信息/ }).first();
  const bb = await fetchBtn.boundingBox();
  console.log('P52_BTN=' + JSON.stringify({ bb, txt: (await fetchBtn.innerText()).trim(), enabled: await fetchBtn.isEnabled() }));
  const t0 = Date.now();
  await fetchBtn.click();
  console.log('P52_CLICKED at t=0');
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const toasts = await page.evaluate(() => window.__toasts);
    const overlays = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.el-dialog, .el-drawer, .el-message-box').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && el.offsetParent !== null) out.push(el.className + ':' + ((el.querySelector('.el-dialog__title, .el-drawer__title, .el-message-box__title') || {}).innerText || '').trim() + ':' + (el.innerText || '').trim().slice(0, 100));
      });
      return out;
    });
    const rows = await shRows().count();
    if (toasts.length || overlays.length || i % 5 === 4) {
      console.log('P52_t' + (i + 1) + ' rows=' + rows + ' toasts=' + JSON.stringify(toasts) + ' overlays=' + JSON.stringify(overlays));
    }
  }
  console.log('P52_NEWPAGES=' + JSON.stringify(newPages));
  const postApis = apis.filter((a) => a.t >= t0 - 2000);
  console.log('P52_POST_APIS=' + JSON.stringify(postApis, null, 1));
  console.log('P52_ROWS_FINAL=' + (await shRows().count()));
  await browser.close();
})().catch((e) => { console.error('P52_ERROR', e.message); process.exit(1); });
