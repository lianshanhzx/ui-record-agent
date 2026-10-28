// probe_smbsn_15.js - S2 调试：编辑场景财务数字字段 fill 追加问题复现 + 修复验证
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = {};

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

  const LV = '成本（元）';
  const it = formItem(LV);
  out.dom = await it.evaluate((x) => {
    const inp = x.querySelector('input,textarea');
    return {
      tag: inp.tagName,
      cls: inp.className,
      readonly: inp.readOnly,
      disabled: inp.disabled,
      type: inp.type,
      maxLen: inp.maxLength,
      val: inp.value,
      parentCls: x.querySelector('.el-form-item__content, .el-input, .el-input-number') ? Array.from(x.querySelectorAll('.el-input, .el-input-number, .el-textarea, .el-select')).map((e) => e.className) : [],
      inputs: Array.from(x.querySelectorAll('input,textarea')).map((i) => ({ cls: i.className, type: i.type, visible: i.offsetParent !== null, val: i.value })),
    };
  });
  console.log('DOM=', JSON.stringify(out.dom, null, 1));

  const inp = it.locator('input:visible, textarea:visible').first();
  const val = async () => (await it.evaluate((x) => (x.querySelector('input,textarea') || {}).value || ''));
  out.before = await val();

  // A: 直接 fill(Playwright 默认: select-all + insert)
  await inp.click();
  await inp.fill('1000001');
  await page.waitForTimeout(500);
  out.afterFill = await val();

  // B: click + Ctrl+A + Delete 再 fill
  await inp.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  out.afterSelectAllDelete = await val();
  await inp.fill('1000002');
  await page.waitForTimeout(500);
  out.afterFill2 = await val();

  // C: fill('') 先清空再 fill
  await inp.fill('');
  await page.waitForTimeout(300);
  out.afterEmptyFill = await val();
  await inp.fill('1000003');
  await page.waitForTimeout(500);
  out.afterEmptyThenFill = await val();

  // D: 事件级: native setter + input 事件
  out.afterNativeSetter = await it.evaluate((x, v) => {
    const inp = x.querySelector('input,textarea');
    const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    set.call(inp, v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return inp.value;
  }, '1000004');
  await page.waitForTimeout(500);

  fs.writeFileSync(path.join(DIR, 'probe15_out.json'), JSON.stringify(out, null, 2));
  console.log('RESULT=', JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
