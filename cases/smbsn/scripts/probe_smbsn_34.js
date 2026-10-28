const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 读真正的日期 model（向上找 picker 组件的 value/parsedValue）
const dateModel = (page) =>
  page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    if (!el) return 'NO_INPUT';
    let v = el.__vue__;
    for (let i = 0; i < 8 && v; i++) {
      if (v.parsedValue !== undefined || v.valueFormat !== undefined || (v.value && v.value instanceof Date)) {
        const m = v.value;
        return (
          'L' + i + ' model=' + (m ? (m.toISOString ? m.toISOString().slice(0, 10) : String(m)) : String(m)) +
          ' parsed=' + (v.parsedValue ? (v.parsedValue.toISOString ? v.parsedValue.toISOString().slice(0, 10) : String(v.parsedValue)) : 'none')
        );
      }
      v = v.$parent;
    }
    return 'NO_PICKER_VUE inputText=' + JSON.stringify(el.value);
  });

// 表单校验 出资时间 字段
const validateDate = (page) =>
  page.evaluate(() => {
    const form = Array.from(document.querySelectorAll('.el-dialog .el-form')).find((f) => f.offsetParent !== null);
    if (!form || !form.__vue__) return 'NO_FORM';
    const f = form.__vue__;
    const field = f.fields && f.fields.find((x) => (x.prop || '').includes('FnddDt') || (x.prop || '').includes('Date') || (x.prop || '').includes('date'));
    if (!field) return 'NO_FIELD props=' + (f.fields || []).map((x) => x.prop).join(',');
    const out = { prop: field.prop, value: field.value };
    return JSON.stringify(out).slice(0, 200);
  });

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
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

  const D = '.el-dialog:visible';
  const FI = (lb) => page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first();
  const dateInp = () => FI('出资时间').locator('input').first();
  console.log('FIELDS=', await validateDate(page));

  // A: fill + Enter
  await dateInp().click();
  await dateInp().fill('2026-09-28');
  await page.keyboard.press('Enter');
  await sleep(800);
  console.log('A fill+Enter model=', await dateModel(page));

  // 清空
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(500);
  console.log('cleared model=', await dateModel(page));

  // B: keyboard.type + Enter
  await dateInp().click();
  await dateInp().click({ clickCount: 3 });
  await page.keyboard.type('2026-09-28', { delay: 50 });
  await sleep(400);
  console.log('B typed model=', await dateModel(page));
  await page.keyboard.press('Enter');
  await sleep(800);
  console.log('B typed+Enter model=', await dateModel(page));

  // 清空
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    el.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(400);

  // C: 面板点格子（今天 28）
  await dateInp().click();
  const panel = page.locator('.el-picker-panel:visible').first();
  await panel.waitFor({ state: 'visible', timeout: 8000 });
  const cells = await panel.locator('.el-date-table td').allInnerTexts();
  console.log('C cells=', JSON.stringify(cells));
  const cell = panel.locator('.el-date-table td').filter({ hasText: /^\s*28\s*$/ }).first();
  await cell.click();
  await sleep(800);
  console.log('C cell28 model=', await dateModel(page), ' input=', JSON.stringify(await dateInp().inputValue()));

  await page.screenshot({ path: path.join(DIR, 's3_34_date.png') });
  // 取消关闭（不保存）
  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
  await sleep(1000);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
