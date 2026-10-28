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
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);

  console.log('LS_businessDate=', await page.evaluate(() => JSON.stringify(localStorage.getItem('businessDate'))));
  console.log('LS_all_date_keys=', await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => /date|time|day/i.test(k)).map((k) => k + '=' + JSON.stringify(localStorage.getItem(k))).join('; ')
  ));

  // 进修改场景
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(3000);
  await page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);

  // dialog model 的 rgsRgstDt
  console.log('MODEL_dates=', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    for (let i = 0; i < 20 && v; i++) {
      for (const scope of [v._data, v.$props]) {
        if (!scope) continue;
        for (const k of Object.keys(scope)) {
          const val = scope[k];
          if (val && typeof val === 'object' && 'rgsRgstDt' in val) {
            const d = new Date(localStorage.getItem('businessDate'));
            return 'rgsRgstDt=' + JSON.stringify(val.rgsRgstDt) + ' bizRaw=' + JSON.stringify(localStorage.getItem('businessDate')) +
              ' bizLocal=' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() +
              ' bizUTC=' + d.toISOString();
          }
        }
      }
      v = v.$parent;
    }
    return 'NOT_FOUND';
  }));

  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
  await sleep(600);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
