// probe_26_dlg_scope.js - 新增/修改弹窗隐藏实例结构（用于 XPath 作用域）
const { chromium } = require('@playwright/test');
const fs = require('fs'); const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
  await page.click('#tab-second'); await sleep(2000);
  await page.locator("xpath=//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='新增']").click({ force: true });
  await sleep(2500);
  const dlg = await page.evaluate(() => Array.from(document.querySelectorAll('.elmt-add-dialog')).map((d) => {
    const wrap = d.closest('.el-dialog__wrapper');
    return { dlgStyle: d.getAttribute('style'), wrapStyle: wrap ? wrap.getAttribute('style') : null, wrapCls: wrap ? wrap.className : null, aria: d.getAttribute('aria-hidden'), rect: (() => { const r = d.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() };
  }));
  console.log(JSON.stringify(dlg, null, 1));
  await browser.close();
})();
