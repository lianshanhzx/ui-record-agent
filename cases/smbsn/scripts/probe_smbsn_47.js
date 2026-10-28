// probe47: 实锤——股东客户编号+证件号码设主客户值, 回读确认, 抓 save postData+响应
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PARENT = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let saveReq = null, saveResp = null;
  page.on('request', (req) => {
    if (req.url().includes('custCorporatRelatedParty/save') && req.method() === 'POST') saveReq = req.postData();
  });
  page.on('response', async (resp) => {
    if (resp.url().includes('custCorporatRelatedParty/save') && resp.status() === 200) {
      try { saveResp = await resp.json(); } catch {}
    }
  });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(PARENT);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  const parentUscc = await page.evaluate(() => {
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && (l.innerText || '').trim().replace(/[*\s]/g, '') === '营业执照' && x.offsetParent !== null;
    });
    const inp = it?.querySelector('input');
    return inp ? inp.value : '';
  });
  console.log('PARENT_USCC=', parentUscc);

  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await sleep(2500);

  const D = '.el-dialog:visible';
  const FI = (lb) => page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first();
  const rd = async (lb) => (await FI(lb).locator('input').first().inputValue()).trim();

  console.log('PRE_SET 股东客户编号=', await rd('股东客户编号'), '证件号码=', await rd('证件号码'));
  await FI('股东客户编号').locator('input').first().click();
  await FI('股东客户编号').locator('input').first().fill(PARENT);
  await sleep(300);
  await FI('证件号码').locator('input').first().click();
  await FI('证件号码').locator('input').first().fill(parentUscc);
  await sleep(500);
  console.log('POST_SET 股东客户编号=', await rd('股东客户编号'), '证件号码=', await rd('证件号码'));

  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(4500);
  console.log('SAVE_REQ=', saveReq);
  console.log('SAVE_CODE=', saveResp ? saveResp.code : 'none', 'DESC=', saveResp ? String(saveResp.description || '').slice(0, 150) : '');
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
