// probe_smbsn_17.js - S2 调试：法代引入选第2行后是否被异步回滚
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apiLog = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/custTrade|Cst|pers|Pers|person|Person/.test(u) && r.request().method() === 'POST' && !u.includes('findCustTradeList')) {
      try {
        const j = await r.json();
        apiLog.push({ u: u.split('/prod-api/')[1], status: r.status(), desc: j && j.description });
      } catch {}
    }
  });

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector(ROWS, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(2000);
  const row = page.locator(ROWS).first();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('/custTrade/getCustTrade') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await getCustP;
  await page.waitForTimeout(4000);

  const readLegal = async () => formItem('法定代表人/负责人姓名').evaluate((x) => (x.querySelector('input,textarea') || {}).value || '');
  console.log('BEFORE=', await readLegal());
  apiLog.length = 0;

  // 打开法代引入弹窗
  await formItem('法定代表人/负责人姓名').locator('button').filter({ hasText: /引\s*入/ }).first().click();
  const dlg = page.locator('.el-dialog:visible').first();
  await dlg.waitFor({ state: 'visible', timeout: 15000 });
  await sleep2(1500);
  // 查询 黄
  await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).locator('input').first().fill('黄');
  await dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sleep2(2500);
  const dRows = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr');
  const n = await dRows.count();
  const rowsText = [];
  for (let i = 0; i < Math.min(n, 3); i++) rowsText.push(((await dRows.nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 40));
  console.log('DLG rows=', n, rowsText);
  // 检查默认选中行
  const defaultChecked = await dlg.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('.el-dialog .el-table__body tbody tr'));
    return trs.findIndex((tr) => tr.querySelector('input[type="radio"]:checked'));
  });
  console.log('DEFAULT_CHECKED_IDX=', defaultChecked);
  // 点第2行 radio
  const row2 = dRows.nth(1);
  await row2.locator('td').first().click({ force: true });
  await sleep2(800);
  const checkedAfter = await dlg.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('.el-dialog .el-table__body tbody tr'));
    return trs.findIndex((tr) => tr.querySelector('input[type="radio"]:checked'));
  });
  console.log('CHECKED_AFTER=', checkedAfter);
  await dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await sleep2(1500);
  console.log('AFTER_CONFIRM_1.5s=', await readLegal());
  await sleep2(8000);
  console.log('AFTER_CONFIRM_9.5s=', await readLegal());
  console.log('API_LOG=', JSON.stringify(apiLog, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
function sleep2(ms) { return new Promise((r) => setTimeout(r, ms)); }
