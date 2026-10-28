// probe74 - 影像资料 tab 左侧目录搜索框 DOM 结构
const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill('260924144929974126');
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first().click();
  await sleep(6000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const info = await pane.evaluate((p) => {
    const inputs = [...p.querySelectorAll('input')];
    return inputs.slice(0, 6).map((inp, i) => {
      let chain = [];
      let e = inp;
      for (let k = 0; k < 5 && e.parentElement; k++) { e = e.parentElement; chain.push(e.tagName + '.' + String(e.className).replace(/\s+/g, '.').slice(0, 60)); }
      return { i, ph: inp.placeholder, type: inp.type, chain };
    });
  });
  log('P74_INPUTS=' + JSON.stringify(info, null, 1));
  const leftBox = await pane.evaluate((p) => {
    const title = [...p.querySelectorAll('*')].find((e) => (e.innerText || '').trim() === '影像资料列表' && e.children.length === 0);
    if (!title) return 'NO_TITLE';
    let box = title;
    for (let i = 0; i < 3 && box.parentElement; i++) box = box.parentElement;
    return box.outerHTML.slice(0, 1200);
  });
  log('P74_LEFTBOX=' + leftBox);
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  log('P74_DONE');
})().catch(async (e) => {
  console.error('P74_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
