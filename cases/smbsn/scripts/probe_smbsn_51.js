// probe51: 股东信息【获取股东信息】探路——按钮状态/弹窗/API/表格变化
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
  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (r.request().method() !== 'POST') return;
    if (!/tansun|\/api\//.test(u)) return;
    let body = '';
    try { body = (r.request().postData() || '').slice(0, 300); } catch {}
    const last = u.split('/').filter(Boolean).slice(-2).join('/');
    apis.push('POST ' + last + ' body=' + body);
  });
  const toasts = [];
  page.on('console', (m) => { if (/error|fail/i.test(m.text())) toasts.push(m.text().slice(0, 150)); });

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
  const before = await shRows().count();
  console.log('P51_ROWS_BEFORE=' + before);

  // 不选行时按钮状态
  const fetchBtn0 = pane.getByRole('button').filter({ hasText: /获取股东信息/ }).first();
  console.log('P51_FETCH_ENABLED_NO_SEL=' + (await fetchBtn0.isEnabled().catch(() => 'n/a')));

  // 选首行
  await shRows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(1000);
  const fetchBtn = pane.getByRole('button').filter({ hasText: /获取股东信息/ }).first();
  console.log('P51_FETCH_ENABLED=' + (await fetchBtn.isEnabled()));

  // 点【获取股东信息】
  await fetchBtn.click();
  await sleep(4000);

  // 枚举弹层
  const ov = await page.evaluate(() => {
    const out = [];
    const scan = (sel, tag) => Array.from(document.querySelectorAll(sel)).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && el.offsetParent !== null) {
        const title = ((el.querySelector('.el-dialog__title, .el-drawer__title, .el-message-box__title') || {}).innerText || '').trim();
        const items = Array.from(el.querySelectorAll('.el-form-item')).map((f) => {
          const lb = ((f.querySelector('label') || {}).innerText || '').trim();
          const inp = f.querySelector('input, textarea, .el-select');
          let val = '';
          if (inp) val = (inp.value !== undefined ? inp.value : (inp.innerText || '')).trim();
          return lb + '=' + val;
        });
        const btns = Array.from(el.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
        out.push({ tag, cls: el.className, title, items: items.slice(0, 15), btns });
      }
    });
    scan('.el-dialog', 'dialog');
    scan('.el-drawer', 'drawer');
    scan('.el-message-box', 'msgbox');
    // toast/notification
    Array.from(document.querySelectorAll('.el-message, .el-notification')).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) out.push({ tag: 'toast', cls: el.className, text: (el.innerText || '').trim().slice(0, 200) });
    });
    return out;
  });
  console.log('P51_OVERLAYS=' + JSON.stringify(ov, null, 1));
  console.log('P51_APIS=' + JSON.stringify(apis, null, 1));

  // 等更久看是否异步拉数据改表
  await sleep(8000);
  const after = await shRows().count();
  console.log('P51_ROWS_AFTER=' + after);
  if (after > before) {
    const names = [];
    for (let i = 0; i < after; i++) names.push((await shRows().nth(i).innerText()).split('\n').filter(Boolean).slice(0, 5).join('|'));
    console.log('P51_ROWS_NOW=' + JSON.stringify(names, null, 1));
  }
  await browser.close();
})().catch((e) => { console.error('P51_ERROR', e.message); process.exit(1); });
