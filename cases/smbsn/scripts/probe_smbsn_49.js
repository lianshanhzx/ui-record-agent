// probe49: message-box 实例实况
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
  console.log('P49_ROWS=' + (await shRows().count()));
  await shRows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(1000);
  await page.getByRole('button').filter({ hasText: /删\s*除/ }).first().click();
  await sleep(2500);
  const info = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.el-message-box'));
    return all.map((m, i) => {
      const r = m.getBoundingClientRect();
      return {
        i,
        visible: m.offsetParent !== null && r.width > 0,
        classes: m.className,
        msg: ((m.querySelector('.el-message-box__message') || {}).innerText || '').trim(),
        btns: Array.from(m.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), cls: b.className })),
      };
    });
  });
  console.log('P49_MB=' + JSON.stringify(info, null, 1));
  // 点 Cancel 取消(不真删, 留给 spec)
  await page.locator('.el-message-box').last().locator('button').filter({ hasText: /Cancel|取消/ }).first().click();
  await sleep(2000);
  console.log('P49_AFTER_CANCEL=' + (await shRows().count()));
  await browser.close();
})().catch((e) => { console.error('P49_ERROR', e.message); process.exit(1); });
