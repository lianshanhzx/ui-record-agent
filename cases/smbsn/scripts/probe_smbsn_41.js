// probe41: 实测 S4 所需 rect —— 股东行 radio + 股东工具栏「修改」按钮；并确认场景页可见「修改」按钮唯一
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normRect = (r) => JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });

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

  // 1) 股东行 radio rect（首行 radio label）
  const radioRect = await pane.locator('.el-table__body tbody tr').first().locator('label.el-radio').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) };
  });
  console.log('SH_RADIO_RECT=', JSON.stringify(radioRect));

  // 2) 股东工具栏「修改」按钮 rect
  const modBtn = pane.getByRole('button').filter({ hasText: /修\s*改/ }).first();
  const modRect = await modBtn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) };
  });
  console.log('SH_MODIFY_RECT=', JSON.stringify(modRect));
  console.log('SH_MODIFY_TEXT=', await modBtn.innerText());

  // 3) 场景页可见「修改」按钮数量（确认唯一）
  const visibleModify = await page.locator("button", { hasText: /修\s*改/ }).evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()));
  console.log('VISIBLE_MODIFY_BTNS=', JSON.stringify(visibleModify));

  // 4) 首行股东名称（记录修改对象）
  const firstName = await pane.locator('.el-table__body tbody tr').first().locator('td .cell').nth(3).innerText();
  console.log('FIRST_SH_NAME=', (firstName || '').trim());

  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
