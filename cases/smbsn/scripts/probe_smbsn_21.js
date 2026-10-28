// probe_smbsn_21.js - S2 二分：法代引入(row2) 后逐个填 金融许可证号/地税/国税/营业执照/注册资本, 定位法代回滚触发字段
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
          apiLog.push({ t: Date.now(), u: r.url().split('/prod-api/')[1], desc: j && j.description, data: j && j.data ? JSON.stringify(j.data).slice(0, 150) : null });
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

  const read = (lb) => formItem(lb).evaluate((x) => { const i = x.querySelector('input,textarea'); return i ? i.value : ''; }).catch(() => 'READ_ERR');

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
  console.log('T0 法代=', await read('法定代表人/负责人姓名'));

  const fills = [
    ['金融许可证号', 'B0001H450000001234改', false],
    ['地税登记证号码', '4501001234567891', false],
    ['国税登记证号码', '4501001234567891', false],
    ['营业执照', '91450100ZZTEST0001', false],
    ['注册资本金额', '1000000001', true],
  ];
  for (const [lb, v, isNum] of fills) {
    const inp = formItem(lb).locator('input:visible').first();
    if (isNum) { await inp.fill('').catch(() => {}); await sleep(150); }
    await inp.fill(v);
    await sleep(300);
    console.log(`FILL ${lb} -> 法代=${await read('法定代表人/负责人姓名')} (${lb}=${await read(lb)})`);
    for (let i = 1; i <= 4; i++) {
      await sleep(5000);
      const lv = await read('法定代表人/负责人姓名');
      console.log(`  +${i * 5}s 法代=${lv}`);
      if (lv !== '黄飞鸿') { console.log('ROLLED_BACK_AFTER=' + lb); process.exit(0); }
    }
  }
  console.log('NO_ROLLBACK after all 5 fills');
  console.log('API_LOG=', JSON.stringify(apiLog.filter((a) => !a.u.includes('address')), null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
