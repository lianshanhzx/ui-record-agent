// probe72 - 诊断：列表页到底渲染成什么（登录页? 空白? 接口挂?）
const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser2 = await chromium.launch({ headless: false }); const browser = browser2;
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url().slice(0, 120) + ' :: ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { if (r.status() >= 400) failed.push('HTTP' + r.status() + ' ' + r.url().slice(0, 120)); });
  const t0 = Date.now();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  log('GOTO_OK ' + (Date.now() - t0) + 'ms');
  for (let i = 0; i < 6; i++) {
    await sleep(10_000);
    const url = page.url();
    const title = await page.title().catch(() => '?');
    const bodyLen = await page.evaluate(() => document.body ? document.body.innerText.length : 0).catch(() => -1);
    const rows = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count().catch(() => -1);
    const loginInput = await page.locator('input[type="password"]').count().catch(() => -1);
    log('T+' + (i + 1) + '0s url=' + url.slice(0, 80) + ' title=' + title + ' bodyLen=' + bodyLen + ' rows=' + rows + ' pwdInput=' + loginInput);
    if (rows > 0) break;
  }
  await page.screenshot({ path: path.join(__dirname, 'p72_diag.png'), fullPage: false });
  log('FAILED_REQS=' + JSON.stringify(failed.slice(0, 15), null, 1));
  log('P72_DONE');
  await browser.close();
let browser2;
// probe72 - 诊断：列表页到底渲染成什么（登录页? 空白? 接口挂?）
const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser2 = await chromium.launch({ headless: false }); const browser = browser2;
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url().slice(0, 120) + ' :: ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { if (r.status() >= 400) failed.push('HTTP' + r.status() + ' ' + r.url().slice(0, 120)); });
  const t0 = Date.now();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  log('GOTO_OK ' + (Date.now() - t0) + 'ms');
  for (let i = 0; i < 6; i++) {
    await sleep(10_000);
    const url = page.url();
    const title = await page.title().catch(() => '?');
    const bodyLen = await page.evaluate(() => document.body ? document.body.innerText.length : 0).catch(() => -1);
    const rows = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count().catch(() => -1);
    const loginInput = await page.locator('input[type="password"]').count().catch(() => -1);
    log('T+' + (i + 1) + '0s url=' + url.slice(0, 80) + ' title=' + title + ' bodyLen=' + bodyLen + ' rows=' + rows + ' pwdInput=' + loginInput);
    if (rows > 0) break;
  }
  await page.screenshot({ path: path.join(__dirname, 'p72_diag.png'), fullPage: false });
  log('FAILED_REQS=' + JSON.stringify(failed.slice(0, 15), null, 1));
  log('P72_DONE');
  await browser.close();
})().catch(async (e) => { console.error('P72_FATAL', e.message.split('\n')[0]); try { await browser2.close(); } catch (_) {} process.exit(1); });

