const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vueDate = (page) =>
  page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    if (!inp) return 'NO_INPUT';
    const v = inp.__vue__;
    if (!v) return 'NO_VUE input=' + inp.value;
    return JSON.stringify({
      input: inp.value,
      value: v.value ? v.value.toISOString ? v.value.toISOString().slice(0, 10) : String(v.value) : v.value,
      parsed: v.parsedValue ? (v.parsedValue.toISOString ? v.parsedValue.toISOString().slice(0, 10) : String(v.parsedValue)) : v.parsedValue,
      display: v.displayValue,
      pickerVisible: v.pickerVisible,
    });
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
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(3000);
  await page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);

  const FI = (lb) => page.locator('.el-dialog:visible .el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  const dateInp = () => FI('出资时间').locator('input').first();

  // 策略A: click + fill + Enter
  await dateInp().click();
  await dateInp().fill('2026-09-28');
  await page.keyboard.press('Enter');
  await sleep(1000);
  console.log('A_after_enter=', await vueDate(page));
  await FI('认缴出资额(元)').locator('label').click().catch(() => {});
  await sleep(800);
  console.log('A_after_blur=', await vueDate(page));

  // 策略B: click + triple-click + keyboard.type + Enter
  await dateInp().click();
  await dateInp().click({ clickCount: 3 });
  await page.keyboard.type('2026-10-15', { delay: 60 });
  await sleep(500);
  console.log('B_before_enter=', await vueDate(page));
  await page.keyboard.press('Enter');
  await sleep(1000);
  console.log('B_after_enter=', await vueDate(page));
  await dateInp().click({ clickCount: 3 });
  await page.keyboard.press('Backspace');
  await sleep(800);
  console.log('B_cleared=', await vueDate(page));

  // 策略C: 点面板日期格子
  await dateInp().click();
  await page.waitForTimeout(1000);
  const panelVisible = await page.locator('.el-picker-panel:visible').count();
  console.log('C_panel_visible=', panelVisible);
  if (panelVisible) {
    // 翻到 2026-10 (默认当前月 2026-09)
    const nextBtn = page.locator('.el-picker-panel:visible .el-date-picker__header-label').filter({ hasText: /箭头_right|next/ }).first();
    // 更稳: 直接点 9 月 28 格 (今天, 可用)
    const cell = page.locator('.el-picker-panel:visible .el-date-table td.available').filter({ hasText: '28' }).first();
    await cell.click();
    await sleep(1000);
    console.log('C_after_cell=', await vueDate(page));
    await page.keyboard.press('Escape');
    await sleep(500);
  }

  // 策略D: fill + dispatch change
  const dState = await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  });
  await sleep(500);
  await dateInp().click();
  await dateInp().fill('2026-11-01');
  await page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.keyboard.press('Enter');
  await sleep(1000);
  console.log('D_after=', await vueDate(page));

  // 最终: 点确定看校验
  const state = await page.evaluate(() => ({
    errors: Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => e.innerText.trim()),
    dlgOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
  }));
  console.log('FINAL(仅填了出资时间)=', JSON.stringify(state));

  await page.screenshot({ path: path.join(DIR, 's3_32_date.png') });
  await ctx.close();
  await browser.close();
  console.log('DONE');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
