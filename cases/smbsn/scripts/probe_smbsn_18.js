// probe_smbsn_18.js - S2 调试：地址引入确认时的 API 与法代回滚机制
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apiLog = [];
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/prod-api/')) {
      try {
        const ct = (r.headers()['content-type'] || '');
        if (ct.includes('json')) {
          const j = await r.json();
          apiLog.push({ u: r.url().split('/prod-api/')[1], status: r.status(), desc: j && j.description, dataKeys: j && j.data ? Object.keys(j.data).slice(0, 12) : null });
        }
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
  const readLegalNo = async () => formItem('法定代表人客户编号').evaluate((x) => (x.querySelector('input,textarea') || {}).value || '');
  console.log('T0 legal=', await readLegal(), 'legalNo=', await readLegalNo());

  // 法代引入 row2
  await formItem('法定代表人/负责人姓名').locator('button').filter({ hasText: /引\s*入/ }).first().click();
  let dlg = page.locator('.el-dialog:visible').first();
  await dlg.waitFor({ state: 'visible', timeout: 15000 });
  await sleep(1500);
  await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).locator('input').first().fill('黄');
  await dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sleep(2500);
  await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(1).locator('td').first().click({ force: true });
  await sleep(800);
  await dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await sleep(1500);
  console.log('T1 after 法代 confirm: legal=', await readLegal(), 'legalNo=', await readLegalNo());

  // 地址引入(澳门)
  apiLog.length = 0;
  await formItem('登记注册地址').locator('button').filter({ hasText: /引\s*入/ }).first().click();
  dlg = page.locator('.el-dialog:visible').first();
  await dlg.waitFor({ state: 'visible', timeout: 15000 });
  await sleep(1500);
  const dIt = (lb) => dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  const pick = async (field) => {
    await dIt(field).locator('.el-select, input').first().click();
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await sleep(500);
    const opts = page.locator('.el-select-dropdown:visible .el-select-dropdown__item');
    const n = await opts.count();
    let idx = -1;
    for (let i = 0; i < n; i++) {
      const t = ((await opts.nth(i).innerText().catch(() => '')) || '').trim();
      if (field === '省份') { if (t && !t.includes('广西')) { idx = i; break; } }
      else if (t && t !== '其他') { idx = i; break; }
    }
    if (idx < 0 && n > 0) idx = 0;
    if (idx < 0) { console.log('PICK', field, 'NO_OPTIONS n=', n); return; }
    await opts.nth(idx).click();
    await sleep(1200);
  };
  await pick('省份');
  await pick('城市');
  await pick('区/县');
  await dIt('详细地址').locator('input').first().fill('AT改测试路99号');
  await sleep(300);
  console.log('T2 before 地址 confirm: legal=', await readLegal());
  await dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await sleep(2000);
  console.log('T3 after 地址 confirm: legal=', await readLegal(), 'legalNo=', await readLegalNo());
  console.log('API_ON_ADDR_CONFIRM=', JSON.stringify(apiLog, null, 1));
  await sleep(5000);
  console.log('T4 +5s: legal=', await readLegal());
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
