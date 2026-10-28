// probe_28_norow.js - 未选行时 修改/删除 的真实行为（选中态/按钮禁用/提示）
const { chromium } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIS = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);
  await page.locator("xpath=//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']").fill('渠道');
  await page.locator("xpath=//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]").click({ force: true });
  await sleep(2000);
  await page.locator("xpath=//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]").first().click();
  await sleep(2400);
  await page.click('#tab-second'); await sleep(2400);
  const state = () => page.evaluate(() => ({
    rows: document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr').length,
    checked: document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr .el-radio.is-checked').length,
    delBtn: (() => { const b = Array.from(document.querySelectorAll('#pane-second button')).find((x) => (x.innerText || '').replace(/\s+/g, '') === '删除'); return b ? { cls: b.className, dis: b.disabled } : null; })(),
    modBtn: (() => { const b = Array.from(document.querySelectorAll('#pane-second button')).find((x) => (x.innerText || '').replace(/\s+/g, '') === '修改'); return b ? { cls: b.className, dis: b.disabled } : null; })(),
  }));
  const out = { initial: await state() };
  const clickBtn = async (t) => page.evaluate((t) => { const b = Array.from(document.querySelectorAll('#pane-second button')).find((x) => (x.innerText || '').replace(/\s+/g, '') === t); if (b) b.click(); }, t);
  const msgs = () => page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box')).filter(vis).map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim()); })()`);
  await clickBtn('修改'); await sleep(2200); out.modify = { state: await state(), msgs: await msgs() };
  await page.keyboard.press('Escape').catch(() => {});
  await clickBtn('删除'); await sleep(2200); out.delete = { state: await state(), msgs: await msgs() };
  await page.keyboard.press('Escape').catch(() => {});
  // 重置后再试
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pane-second button')).find((x) => (x.innerText || '').replace(/\s+/g, '') === '重置'); if (b) b.click(); });
  await sleep(2500);
  out.afterReset = await state();
  await clickBtn('删除'); await sleep(2500); out.delete2 = { state: await state(), msgs: await msgs() };
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
