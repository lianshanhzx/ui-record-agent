// probe_smbsn_14.js - 银行行号弹窗：条件查询 API 探测
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';
const J = (o) => JSON.stringify(o);
const N = (b) => (b ? { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) } : null);

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const posts = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') {
      const u = new URL(r.url());
      if (u.pathname !== '/' && u.pathname.length > 15) posts.push(u.pathname);
    }
  });

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2500);
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(3000);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el) => el.click());
  await page.waitForTimeout(500);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(5000);

  const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '银行行号' }) }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('button', { hasText: /引\s*入/ }).first().click();
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 });
  await page.waitForTimeout(2000);
  const dlg = page.locator('.el-dialog:visible').last();

  const tryQuery = async (field, val) => {
    posts.length = 0;
    await dlg.getByRole('button').filter({ hasText: /重\s*置/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: field }) }).first().locator('input').first().fill(val);
    await dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click().catch(() => {});
    await page.waitForTimeout(3000);
    const rows = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count().catch(() => 0);
    console.log(`QUERY ${field}='${val}' posts=${JSON.stringify([...new Set(posts)])} rows=${rows}`);
    return rows;
  };

  let rows = await tryQuery('银行名称', '银行');
  if (!rows) rows = await tryQuery('银行名称', '中国');
  if (!rows) rows = await tryQuery('银行行号', '102');
  if (!rows) rows = await tryQuery('银行行号', '105');
  if (rows) {
    const r0 = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    console.log('ROW0=', J(await r0.evaluate((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => c.innerText.trim().slice(0, 40)))));
    console.log('ROW0_RADIO_RECT=', J(N(await r0.locator('input[type="radio"]').first().boundingBox().catch(() => null))));
  }
  await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
