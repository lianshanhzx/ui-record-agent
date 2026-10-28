// probe39: 复刻引擎行为——fill(无Enter) → 点顶部标签(股东名称)失焦 → 读 model + 面板是否关闭
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const model = (page) =>
  page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    if (!el) return { input: 'NO_INPUT' };
    let v = el.__vue__;
    for (let i = 0; i < 10 && v; i++) {
      if (v && v.parsedValue !== undefined) {
        const f = (d) => (d && d.getFullYear ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : String(d));
        return { input: el.value, value: f(v.value), parsed: f(v.parsedValue), pickerVisible: v.pickerVisible };
      }
      v = v.$parent;
    }
    return { input: el.value, noVue: true };
  });
const panelOpen = (page) => page.locator('.el-picker-panel:visible').count();
const FI = (page, lb) => page.locator('.el-dialog:visible .el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
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
  await page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);

  const dateInp = FI(page, '出资时间').locator('input').first();

  // 1) 纯 fill（引擎 InputAction 行为：仅 fill，无 Enter）
  await dateInp.click();
  await dateInp.fill('2026-09-01');
  await sleep(800);
  console.log('AFTER_FILL model=', JSON.stringify(await model(page)), 'panel=', await panelOpen(page));

  // 2) 点顶部「股东名称」标签（未被面板遮挡）→ 失焦
  const nmLabel = FI(page, '股东名称').locator('label').first();
  await nmLabel.click({ timeout: 8000 });
  await sleep(800);
  console.log('AFTER_BLUR_NM model=', JSON.stringify(await model(page)), 'panel=', await panelOpen(page));

  // 3) 若面板仍开，再点「股东类型」标签试试
  if (await panelOpen(page)) {
    await FI(page, '股东类型').locator('label').first().click({ timeout: 8000 }).catch((e) => console.log('股东类型 click err', e.message));
    await sleep(800);
    console.log('AFTER_BLUR_TP model=', JSON.stringify(await model(page)), 'panel=', await panelOpen(page));
  }

  // 4) 读 model 在 form model(subscFnddDt) 层的值
  console.log('FORM_model=', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    for (let i = 0; i < 20 && v; i++) {
      for (const scope of [v._data, v.$props]) {
        if (!scope) continue;
        for (const k of Object.keys(scope)) {
          const val = scope[k];
          if (val && typeof val === 'object' && 'subscFnddDt' in val) return 'subscFnddDt=' + JSON.stringify(val.subscFnddDt);
        }
      }
      v = v.$parent;
    }
    return 'NOT_FOUND';
  }));

  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click().catch(() => {});
  await sleep(600);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
