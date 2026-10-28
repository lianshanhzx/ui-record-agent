// probe56: 关联人新增弹窗——枚举各下拉选项 + 引入按钮位置
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q;
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);

  const D = page.locator('.el-dialog:visible').last();
  // 引入按钮所在字段
  const importLoc = await D.evaluate((el) =>
    Array.from(el.querySelectorAll('.el-form-item')).map((f) => ({
      label: ((f.querySelector('label') || {}).innerText || '').trim(),
      hasImport: !!Array.from(f.querySelectorAll('button')).find((b) => (b.innerText || '').includes('引入')),
    }))
  );
  console.log('P56_IMPORT_LOC=' + JSON.stringify(importLoc.filter((x) => x.hasImport)));

  // 逐个 select 枚举选项
  const labels = ['高管类别', '证件类型', '性别', '职业', '职务名称', '职称', '最高学历', '最高学位'];
  const options = {};
  for (const lb of labels) {
    const item = D.locator('.el-form-item').filter({ has: D.locator('label', { hasText: lb }) }).first();
    const sel = item.locator('.el-select').first();
    if (!(await sel.count())) { options[lb] = 'NO_SELECT'; continue; }
    await sel.click({ timeout: 8000 });
    await sleep(900);
    const dd = page.locator('.el-select-dropdown:visible').last();
    const opts = await dd.locator('.el-select-dropdown__item').allInnerTexts().catch(() => []);
    options[lb] = opts.map((s) => s.trim()).filter(Boolean);
    await page.keyboard.press('Escape');
    await sleep(500);
  }
  console.log('P56_OPTIONS=' + JSON.stringify(options, null, 1));
  fs.writeFileSync(path.join(__dirname, 'p56-options.json'), JSON.stringify(options, null, 2), 'utf8');
  await browser.close();
})().catch((e) => { console.error('P56_ERROR', e.message); process.exit(1); });
