// probe48: 股东信息 tab 删除入口探路
// 1) 进场景页→股东信息tab 2) 枚举 pane 内全部按钮(toolbar+行级) 3) 选首行radio 4) 点删除→抓确认弹窗结构+API→点取消(不真删)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apiLog = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/RelatedParty|shareholder|shrh/i.test(u) && req.method() === 'POST') {
      apiLog.push({ REQ: u.split('/').slice(-2).join('/'), postData: (req.postData() || '').slice(0, 500) });
    }
  });
  page.on('response', async (resp) => {
    const u = resp.url();
    if (/RelatedParty|shareholder|shrh/i.test(u) && resp.request().method() === 'POST') {
      let body = '';
      try { body = JSON.stringify(await resp.json()).slice(0, 300); } catch {}
      apiLog.push({ RESP: u.split('/').slice(-2).join('/'), status: resp.status(), body });
    }
  });

  // 列表→查询→选行→修改
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

  // 股东信息 tab
  await page.locator('.el-tabs__item').filter({ hasText: /股东/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();

  // 1) 枚举按钮
  const btns = await page.evaluate(() => {
    const pane = document.querySelectorAll('.el-tab-pane');
    const vis = Array.from(pane).find((p) => p.offsetParent !== null) || pane[pane.length - 1];
    const out = [];
    vis.querySelectorAll('button').forEach((b) => {
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      out.push({ text: (b.innerText || '').trim().replace(/\s+/g, ' '), disabled: b.disabled, x: (r.x / 1440).toFixed(3), y: (r.y / 900).toFixed(3) });
    });
    return out;
  });
  console.log('P48_BUTTONS=' + JSON.stringify(btns, null, 1));

  // 2) 表格行数 + 首行 radio 选中
  const shRows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
  const before = await shRows().count();
  console.log('P48_SH_ROWS_BEFORE=' + before);
  const names = [];
  for (let i = 0; i < before; i++) names.push((await shRows().nth(i).locator('td .cell').nth(3).innerText().catch(() => '')).trim());
  console.log('P48_NAMES=' + JSON.stringify(names));
  await shRows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(1000);

  // 3) 找删除按钮(选行后)
  const delBtns = await page.evaluate(() => {
    const pane = document.querySelectorAll('.el-tab-pane');
    const vis = Array.from(pane).find((p) => p.offsetParent !== null) || pane[pane.length - 1];
    const out = [];
    vis.querySelectorAll('button').forEach((b) => {
      const t = (b.innerText || '').trim().replace(/\s+/g, ' ');
      if (/删/.test(t)) {
        const r = b.getBoundingClientRect();
        out.push({ text: t, disabled: b.disabled, rect: JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) }) });
      }
    });
    return out;
  });
  console.log('P48_DEL_BTNS=' + JSON.stringify(delBtns, null, 1));

  if (delBtns.length) {
    // 4) 点删除 → 抓确认弹窗 → 取消
    await page.getByRole('button').filter({ hasText: /删\s*除/ }).first().click();
    await sleep(2500);
    const dlg = await page.evaluate(() => {
      const out = {};
      const mb = Array.from(document.querySelectorAll('.el-message-box')).filter((m) => m.offsetParent !== null);
      if (mb.length) {
        const m = mb[mb.length - 1];
        out.type = 'message-box';
        out.title = (m.querySelector('.el-message-box__title') || {}).innerText || '';
        out.msg = (m.querySelector('.el-message-box__message') || {}).innerText || '';
        out.buttons = Array.from(m.querySelectorAll('button')).map((b) => (b.innerText || '').trim());
      }
      const dg = Array.from(document.querySelectorAll('.el-dialog')).filter((m) => m.offsetParent !== null);
      if (dg.length && !out.type) {
        const m = dg[dg.length - 1];
        out.type = 'dialog';
        out.title = (m.querySelector('.el-dialog__title') || {}).innerText || '';
        out.buttons = Array.from(m.querySelectorAll('.el-dialog__footer button')).map((b) => (b.innerText || '').trim());
      }
      return out;
    });
    console.log('P48_CONFIRM=' + JSON.stringify(dlg, null, 1));
    // 取消
    const cancel = page.getByRole('button').filter({ hasText: /^(取\s*消|取 消)$/ }).last();
    if (await cancel.count()) { await cancel.click(); console.log('P48_CANCELED'); }
    else {
      const c = page.locator('.el-message-box:visible button, .el-dialog:visible .el-dialog__footer button').filter({ hasText: /取\s*消/ }).first();
      if (await c.count()) { await c.click(); console.log('P48_CANCELED_FALLBACK'); }
      else console.log('P48_NO_CANCEL_FOUND');
    }
    await sleep(2000);
  }
  const after = await shRows().count();
  console.log('P48_SH_ROWS_AFTER=' + after);
  console.log('P48_API=' + JSON.stringify(apiLog, null, 1));
  await browser.close();
})().catch((e) => { console.error('P48_ERROR', e.message); process.exit(1); });
