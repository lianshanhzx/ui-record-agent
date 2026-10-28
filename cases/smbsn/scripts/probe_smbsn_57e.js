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
  const events = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/tansun/i.test(r.url())) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 250); } catch {}
    events.push(r.url().split('/').filter(Boolean).slice(-2).join('/') + ' ' + body);
  });
  page.on('console', (m) => { if (/valid|error|必填|请输入/i.test(m.text())) events.push('CONSOLE ' + m.text().slice(0, 150)); });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  const dlg = page.locator('.el-dialog:visible').last();
  await dlg.locator('.el-form-item').filter({ hasText: '关联客户名称' }).first().locator('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);
  const imp = page.locator('.el-dialog:visible').last();

  // 空条件点查询 → 抓 toast
  const ev0 = events.length;
  await imp.getByRole('button').filter({ hasText: /查\s*询/ }).first().click({ timeout: 10000 });
  await sleep(1200);
  const toast1 = await page.evaluate(() => ({
    msgs: Array.from(document.querySelectorAll('.el-message, .el-notification')).map((m) => (m.innerText || '').trim()).filter(Boolean),
    errs: Array.from(document.querySelectorAll('.el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
  }));
  console.log('P57E_TOAST_EMPTY=' + JSON.stringify(toast1));

  // 填 客户名称=AT 再查询
  await imp.locator('.el-form-item').filter({ hasText: '客户名称' }).first().locator('input').first().fill('AT');
  await sleep(500);
  const ev1 = events.length;
  await imp.getByRole('button').filter({ hasText: /查\s*询/ }).first().click({ timeout: 10000 });
  await sleep(4000);
  const st = await imp.evaluate((el) => {
    const rows = el.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
    return { n: rows.length, rows: Array.from(rows).slice(0, 8).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()).join('|').slice(0, 150)) };
  });
  console.log('P57E_TABLE=' + JSON.stringify(st, null, 1));
  console.log('P57E_EVENTS=' + JSON.stringify(events.slice(ev0), null, 1));
  await browser.close();
})().catch((e) => { console.error('P57E_ERROR', e.message); process.exit(1); });
