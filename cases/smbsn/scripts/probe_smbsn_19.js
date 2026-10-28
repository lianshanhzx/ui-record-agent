// probe_smbsn_19.js - S2 调试：法代引入后静置轮询, 找延迟回滚 + 对应 API
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
          apiLog.push({ t: Date.now(), u: r.url().split('/prod-api/')[1], status: r.status(), desc: j && j.description,
            data: j && j.data && typeof j.data === 'object' ? JSON.stringify(j.data).slice(0, 300) : (j && j.data ? String(j.data).slice(0, 120) : null) });
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
  console.log('T0 legal=', await readLegal());

  await formItem('法定代表人/负责人姓名').locator('button').filter({ hasText: /引\s*入/ }).first().click();
  const dlg = page.locator('.el-dialog:visible').first();
  await dlg.waitFor({ state: 'visible', timeout: 15000 });
  await sleep(1500);
  await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).locator('input').first().fill('黄');
  await dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sleep(2500);
  await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(1).locator('td').first().click({ force: true });
  await sleep(800);
  apiLog.length = 0;
  const tConfirm = Date.now();
  await dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  console.log('confirm at t=0');
  for (let i = 1; i <= 9; i++) {
    await sleep(5000);
    const v = await readLegal();
    console.log(`t=${i * 5}s legal=${v}`);
    if (v !== '黄飞鸿') break;
  }
  console.log('API_AFTER_CONFIRM=', JSON.stringify(apiLog.map((a) => ({ t: a.t - tConfirm, u: a.u, desc: a.desc, data: a.data })), null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
