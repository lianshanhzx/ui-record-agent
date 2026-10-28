// probe63: 查看弹窗 DOM 结构诊断（可见 .el-dialog 层级 / form-item 位置）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  await pane.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /查\s*看/ }).first().click();
  await sleep(3000);
  const dump = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.el-dialog'));
    return all.map((d, i) => ({
      i, cls: (d.className || '').toString().slice(0, 50),
      vis: d.offsetParent !== null,
      rect: JSON.stringify(d.getBoundingClientRect()),
      fi: d.querySelectorAll('.el-form-item').length,
      fiVis: Array.from(d.querySelectorAll('.el-form-item')).filter((f) => f.offsetParent !== null).length,
      parent: d.parentElement ? (d.parentElement.className || '').toString().slice(0, 60) : '',
    }));
  });
  console.log('P63_DIALOGS=', JSON.stringify(dump, null, 1));
  // 同时 dump 遮罩内 dialog-wrap 的祖先链
  const chain = await page.evaluate(() => {
    const wraps = Array.from(document.querySelectorAll('.el-dialog__wrapper')).filter((w) => w.offsetParent !== null && w.querySelector('.el-form-item'));
    return wraps.map((w) => {
      let el = w.querySelector('.el-form-item'), chain = [];
      while (el && chain.length < 8) { chain.push(el.tagName + '.' + (el.className || '').toString().split(' ').slice(0, 2).join('.')); el = el.parentElement; }
      return chain;
    });
  });
  console.log('P63_CHAIN=', JSON.stringify(chain, null, 1));
  await browser.close();
})().catch((e) => { console.error('P63_ERROR', e.message); process.exit(1); });
