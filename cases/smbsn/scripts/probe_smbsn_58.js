// probe58: 删除已存在的关联人行（回基线），并确认删除确认框形态
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
  const apis = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/custCorporatRelatedParty/i.test(r.url())) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    apis.push('POST ' + r.url().split('/').filter(Boolean).slice(-1)[0] + ' body=' + body);
  });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const rows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
  const before = await rows().count();
  console.log('P58_ROWS_BEFORE=' + before);
  if (before === 0) { console.log('P58_ALREADY_CLEAN'); await browser.close(); return; }

  await rows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /删\s*除/ }).first().click();
  await sleep(2000);
  // 枚举确认框
  const ov = await page.evaluate(() => {
    const out = [];
    Array.from(document.querySelectorAll('.el-message-box, .el-dialog')).forEach((el) => {
      if (el.offsetParent === null) return;
      const title = ((el.querySelector('.el-message-box__title, .el-dialog__title') || {}).innerText || '').trim();
      const msg = ((el.querySelector('.el-message-box__message, .el-dialog__body') || {}).innerText || '').trim().slice(0, 120);
      const btns = Array.from(el.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), cls: b.className }));
      out.push({ cls: (el.className || '').toString().slice(0, 40), title, msg, btns });
    });
    return out;
  });
  console.log('P58_CONFIRM=' + JSON.stringify(ov, null, 1));
  // 点 OK/确定
  const okBtn = page.locator('.el-message-box:visible button.el-button--primary').first();
  const useMsgbox = await okBtn.count();
  if (useMsgbox) await okBtn.click();
  else await page.getByRole('button').filter({ hasText: /确\s*定|OK/ }).last().click();
  await sleep(3000);
  const after = await rows().count();
  console.log('P58_ROWS_AFTER=' + after);
  console.log('P58_APIS=' + JSON.stringify(apis, null, 1));
  await browser.close();
})().catch((e) => { console.error('P58_ERROR', e.message); process.exit(1); });
