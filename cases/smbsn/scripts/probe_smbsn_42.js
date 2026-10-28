// probe42: S4 修改弹窗「出资时间」日期行为实证
// 预填=2026-09-01。测试：A) fill同值+Enter B) fill异值+Enter C) fill异值+失焦(点标签)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readModel = (page) =>
  page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    if (!el) return { input: 'NO_INPUT' };
    const fmt = (d) => (d && d.getFullYear ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : String(d));
    let v = el.__vue__;
    for (let i = 0; i < 10 && v; i++) {
      if (v.parsedValue !== undefined || v.valueFormat !== undefined || (v.value && v.value instanceof Date)) {
        return { input: el.value, value: fmt(v.value), parsed: fmt(v.parsedValue), pickerVisible: v.pickerVisible };
      }
      v = v.$parent;
    }
    return { input: el.value, noVue: true };
  });
const FI = (page, lb) => page.locator('.el-dialog:visible .el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
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
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await sleep(2500);

  const dateInp = FI(page, '出资时间').locator('input').first();
  console.log('INITIAL=', JSON.stringify(await readModel(page)));

  // A) fill 同值 2026-09-01 + Enter
  await dateInp.click();
  await dateInp.fill('2026-09-01');
  await dateInp.press('Enter');
  await sleep(800);
  console.log('A_SAME+ENTER=', JSON.stringify(await readModel(page)));

  // 关面板
  const closePanel = async () => {
    if (await page.locator('.el-picker-panel:visible').count()) {
      await FI(page, '股东名称').locator('label').first().click({ timeout: 5000 }).catch(() => {});
      await sleep(400);
    }
  };
  await closePanel();

  // B) fill 异值 2026-08-15 + Enter
  await dateInp.click();
  await dateInp.fill('2026-08-15');
  await dateInp.press('Enter');
  await sleep(800);
  console.log('B_DIFF+ENTER=', JSON.stringify(await readModel(page)));
  await closePanel();

  // C) fill 异值 2026-08-20 + 失焦(点股东名称标签)
  await dateInp.click();
  await dateInp.fill('2026-08-20');
  await sleep(300);
  await FI(page, '股东名称').locator('label').first().click({ timeout: 5000 }).catch(() => {});
  await sleep(800);
  console.log('C_DIFF+BLUR=', JSON.stringify(await readModel(page)));

  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click().catch(() => {});
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
