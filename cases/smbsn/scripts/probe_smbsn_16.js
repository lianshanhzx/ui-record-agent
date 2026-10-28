// probe_smbsn_16.js - S2 复现：前序填充后小数格式字段 fill 追加；验证修复方案
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';

async function loadScene(page) {
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
  return (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
}

async function readVal(it) {
  return it.evaluate((x) => (x.querySelector('input,textarea') || {}).value || '');
}

async function applyPrefix(page, formItem) {
  // 模拟 spec 前序: 金融许可证号(文本+改) / 地税(纯数字+1) / 国税 / 营业执照
  await formItem('金融许可证号').locator('input:visible').first().fill('B0001H450000001234改');
  await page.waitForTimeout(300);
  await formItem('地税登记证号码').locator('input:visible').first().fill('4501001234567891');
  await page.waitForTimeout(300);
  await formItem('国税登记证号码').locator('input:visible').first().fill('4501001234567891');
  await page.waitForTimeout(300);
  await formItem('营业执照').locator('input:visible').first().fill('914501005GN30BN2BJ');
  await page.waitForTimeout(300);
}

const TARGET = '注册资本金额';
const NEWV = '1000000001';

async function runCase(browser, name, variant) {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const formItem = await loadScene(page);
  const it = formItem(TARGET);
  const before = await readVal(it);
  if (variant.prefix) await applyPrefix(page, formItem);
  const inp = it.locator('input:visible').first();
  let how = '';
  if (variant.kind === 'fill') {
    await inp.fill(NEWV); how = 'fill';
  } else if (variant.kind === 'typeChar') {
    await inp.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(NEWV, { delay: 40 }); how = 'ctrlA+type';
  } else if (variant.kind === 'emptyFill') {
    await inp.fill('');
    await page.waitForTimeout(300);
    await inp.fill(NEWV); how = 'fill("")+fill';
  } else if (variant.kind === 'native') {
    await it.evaluate((x, v) => {
      const i = x.querySelector('input,textarea');
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(i, v);
      i.dispatchEvent(new Event('input', { bubbles: true }));
    }, NEWV); how = 'native+input';
  }
  await page.waitForTimeout(500);
  const after = await readVal(it);
  console.log(`CASE ${name}: before=${JSON.stringify(before)} after=${JSON.stringify(after)} how=${how} ${after === NEWV ? 'OK' : 'BAD'}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  await runCase(browser, '2_prefix_fill', { prefix: true, kind: 'fill' });
  await runCase(browser, '3_prefix_typeChar', { prefix: true, kind: 'typeChar' });
  await runCase(browser, '4_prefix_emptyFill', { prefix: true, kind: 'emptyFill' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
