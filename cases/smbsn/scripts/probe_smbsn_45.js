// probe45: 编辑末行股东(S3 建的 111735) 预填直接确定，验证是否可保存
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let saveResp = null;
  page.on('response', async (resp) => {
    if (resp.url().includes('custCorporatRelatedParty/save') && resp.status() === 200) {
      try { saveResp = await resp.json(); } catch {}
    }
  });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const rows = pane.locator('.el-table__body tbody tr');
  const n = await rows.count();
  // 末行 = S3 新建的 111735
  await rows.nth(n - 1).locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  const lastName = (await rows.nth(n - 1).innerText()).match(/AT_SMB股东_\d+/)?.[0];
  console.log('EDIT_ROW=', lastName, '(rows=', n, ')');
  await pane.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await sleep(2500);
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(4000);
  const dlgOpen = await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length);
  const exc = await page.evaluate(() => (Array.from(document.querySelectorAll('.el-message-box, [class*="exception"]')).filter((d) => d.offsetParent !== null).map((d) => (d.innerText || '').trim()).join(' || ')).slice(0, 300));
  console.log('DLG_OPEN=', dlgOpen, 'SAVE_CODE=', saveResp ? saveResp.code : 'none', 'DESC=', saveResp ? String(saveResp.description || '').slice(0, 120) : '');
  if (exc) console.log('EXC=', exc);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
