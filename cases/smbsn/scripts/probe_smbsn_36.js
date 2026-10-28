const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dateFieldState = (page) =>
  page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    const item = Array.from(d.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && (l.innerText || '').replace(/[*\s]/g, '').includes('出资时间');
    });
    if (!item) return 'NO_ITEM';
    const v = item.__vue__;
    if (!v) return 'NO_VUE';
    return JSON.stringify({
      prop: v.prop,
      fieldValue: v.fieldValue === undefined ? 'undef' : JSON.stringify(v.fieldValue),
      validateState: v.validateState,
      validateMessage: v.validateMessage,
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
  };
  const inp = async (lb, v) => {
    const ctl = FI(lb).locator('input').first();
    await ctl.click();
    await ctl.fill(v);
    await ctl.press('Enter');
    await sleep(500);
  };
  const tag = async (t) => console.log(t, '=>', await dateFieldState(page));

  console.log('初始 =>', await dateFieldState(page));
  await sel('股东类型', '法人或其他组织'); await tag('1 股东类型');
  await inp('股东名称', 'AT_SEQ_001'); await tag('2 股东名称');
  await inp('股东客户编号', '66493363834749490001'); await tag('3 股东客户编号');
  await sel('证件类型', '营业执照'); await tag('4 证件类型');
  await inp('证件号码', '91450100N584FQ5GMP'); await tag('5 证件号码');
  await sel('币种', '人民币'); await tag('6 币种');
  await inp('持股比例', '10'); await tag('7 持股比例');
  await sel('出资方式', '货币'); await tag('8 出资方式');

  const dateInp = FI('出资时间').locator('input').first();
  await dateInp.click();
  await dateInp.fill('2026-09-28');
  await dateInp.press('Enter');
  await sleep(800);
  await tag('9 日期fill+Enter');
  await FI('认缴出资额(元)').locator('label').first().click().catch(() => {});
  await sleep(500);
  await tag('9b blur');

  await inp('认缴出资额(元)', '1000000'); await tag('10 认缴');
  await inp('实缴出资额（元）', '1000000'); await tag('11 实缴');
  const ta = FI('备注').locator('textarea').first();
  await ta.click(); await ta.fill('SEQ备注'); await sleep(400);
  await tag('12 备注');

  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(3000);
  console.log('确定后 errors=', JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => e.innerText.trim())
  )));
  await tag('确定后 dateState');

  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
  await sleep(800);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
