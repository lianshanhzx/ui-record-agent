// probe50: 股东信息【查看】入口探路——弹窗类型/字段/按钮/API
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
    if (!u.includes('tansun-tcp-cst') && !u.includes('/api/')) return;
    const m = r.request().method();
    let body = '';
    try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    if (/save|delete|query|get|find|detail|look/i.test(u) && m === 'POST') apis.push(m + ' ' + u.split('/').slice(-2).join('/') + ' body=' + body);
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
  console.log('P50_ROWS=' + (await shRows().count()));
  // 选首行 radio
  await shRows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(1000);
  // 点【查看】
  const viewBtn = pane.getByRole('button').filter({ hasText: /查\s*看/ }).first();
  console.log('P50_VIEW_ENABLED=' + (await viewBtn.isEnabled()));
  await viewBtn.click();
  await sleep(3000);
  // 枚举新出现的弹层
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
          const dis = f.querySelector('input[disabled]');
          return lb + '=' + val + (dis ? '(dis)' : '');
        });
        const btns = Array.from(el.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
        const tbl = Array.from(el.querySelectorAll('.el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').trim()).join('|'));
        out.push({ tag, cls: el.className, title, items, btns, tblRows: tbl.slice(0, 3) });
      }
    });
    scan('.el-dialog', 'dialog');
    scan('.el-drawer', 'drawer');
    scan('.el-message-box', 'msgbox');
    return out;
  });
  console.log('P50_OVERLAYS=' + JSON.stringify(ov, null, 1));
  console.log('P50_APIS=' + JSON.stringify(apis, null, 1));
  // 不关闭，直接结束（浏览器关掉即失效）
  await browser.close();
})().catch((e) => { console.error('P50_ERROR', e.message); process.exit(1); });
