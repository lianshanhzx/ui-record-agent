// probe73 - 列表页 JS 上下文死亡诊断：crash 事件/console/DOM 内容
const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);
  page.on('crash', () => log('PAGE_CRASHED'));
  page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE_ERR ' + m.text().slice(0, 150)); });
  page.on('pageerror', (e) => log('PAGEERROR ' + String(e).slice(0, 200)));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) log('NAV ' + f.url().slice(0, 90)); });

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  log('GOTO_OK');
  await sleep(15_000);
  await page.screenshot({ path: path.join(__dirname, 'p73_diag.png') }).catch((e) => log('SHOT_ERR ' + e.message.split('\n')[0]));
  const html = await page.content().catch((e) => 'CONTENT_ERR ' + e.message.split('\n')[0]);
  log('HTML_LEN=' + html.length + ' head=' + html.slice(0, 300).replace(/\s+/g, ' '));
  const rows = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count().catch(() => -1);
  log('ROWS=' + rows);
  const alive = await page.evaluate(() => 'ALIVE').catch((e) => 'DEAD: ' + e.message.split('\n')[0]);
  log('JS_CTX=' + alive);
  log('P73_DONE');
})().catch(async (e) => {
  console.error('P73_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
