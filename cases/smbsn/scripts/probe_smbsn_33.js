const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dateVue = (page) =>
  page.evaluate(() => {
    const inp = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    if (!inp) return 'NO_INPUT';
    const v = inp.__vue__;
    if (!v) return 'NO_VUE input=' + JSON.stringify(inp.value);
    return 'input=' + JSON.stringify(inp.value) + ' model=' + JSON.stringify(v.value ? (v.value.toISOString ? v.value.toISOString().slice(0, 10) : String(v.value)) : v.value) + ' display=' + JSON.stringify(v.displayValue);
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

  const sel = async (lb, opt) => {
    const loc = FI(lb);
    const dd = page.locator('.el-select-dropdown:visible').last();
    if (!(await dd.count())) {
      await loc.locator('.el-select').first().click();
      await dd.waitFor({ state: 'visible', timeout: 8000 });
    }
    await dd.locator('.el-select-dropdown__item').filter({ hasText: opt }).first().click();
    await sleep(900);
    console.log(`SEL ${lb}=${opt} got=${JSON.stringify((await loc.locator('.el-input__inner').first().inputValue()).trim())}`);
  };
  const inp = async (lb, v) => {
    const ctl = FI(lb).locator('input').first();
    await ctl.click();
    await ctl.fill(v);
    await page.keyboard.press('Enter');
    await sleep(500);
    console.log(`INP ${lb}=${v} got=${JSON.stringify(await ctl.inputValue())}`);
  };

  // === 复刻 spec 顺序 1-8 ===
  await sel('股东类型', '法人或其他组织');
  await inp('股东名称', 'AT_DIAG_001');
  await inp('股东客户编号', '29272845486478172001');
  await sel('证件类型', '营业执照');
  await inp('证件号码', '91450100N584FQ5GMP');
  await sel('币种', '人民币');
  await inp('持股比例', '10');
  await sleep(500);
  console.log('DIAG 持股比例 blur后=', JSON.stringify(await FI('持股比例').locator('input').first().inputValue()));
  await sel('出资方式', '货币');
  await sleep(300);
  console.log('DIAG 8项后 dd:visible=', await page.locator('.el-select-dropdown:visible').count(), ' panel:visible=', await page.locator('.el-picker-panel:visible').count(), ' 聚焦=', await page.evaluate(() => (document.activeElement && document.activeElement.tagName) + '.' + (document.activeElement.className || '').slice(0, 40)));

  // === 9 日期 ===
  const dateInp = FI('出资时间').locator('input').first();
  await dateInp.click();
  await sleep(300);
  console.log('D1 点击后 panel=', await page.locator('.el-picker-panel:visible').count(), ' 聚焦=', await page.evaluate(() => (document.activeElement && document.activeElement.className || '').slice(0, 50)));
  await dateInp.fill('2026-09-28');
  await sleep(300);
  console.log('D2 fill后=', await dateVue(page));
  await page.keyboard.press('Enter');
  await sleep(800);
  console.log('D3 Enter后=', await dateVue(page), ' panel=', await page.locator('.el-picker-panel:visible').count());
  await FI('认缴出资额(元)').locator('label').first().click().catch(() => {});
  await sleep(600);
  console.log('D4 blur后=', await dateVue(page));

  // === 10-12 ===
  await inp('认缴出资额(元)', '1000000');
  console.log('D5 认缴后=', await dateVue(page));
  await inp('实缴出资额（元）', '1000000');
  console.log('D6 实缴后=', await dateVue(page));
  const ta = FI('备注').locator('textarea').first();
  await ta.click();
  await ta.fill('DIAG备注');
  await sleep(400);
  console.log('D7 备注后=', await dateVue(page));

  // === 确定前 ===
  console.log('D8 确定前=', await dateVue(page));
  await page.screenshot({ path: path.join(DIR, 's3_33_before_confirm.png') });

  // 关弹窗（取消，不保存）
  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
  await sleep(1500);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
