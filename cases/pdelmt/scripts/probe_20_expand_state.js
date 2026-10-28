// probe_20_expand_state.js - 搜索后节点展开状态 + 箭头点击效果
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_20_out.json');
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
  const state = () => page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.el-tree [role="treeitem"]'));
    const vis = all.filter((x) => !String(x.getAttribute('style') || '').includes('display: none'));
    return vis.map((n) => ({ cls: n.className, aria: n.getAttribute('aria-expanded'), kids: n.querySelectorAll(':scope > .el-tree-node__children > .el-tree-node').length, expandCls: (n.querySelector(':scope > .el-tree-node__content .el-tree-node__expand-icon') || {}).className }));
  });
  const out = { before: await state() };
  await page.locator('input.search-input').fill('产品公共要素');
  await page.locator('.shrink-search-input .input-icon i').first().click({ force: true });
  await sleep(2200);
  out.afterSearch = await state();
  const icon = page.locator("xpath=//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]//span[contains(@class,'el-tree-node__expand-icon')]");
  out.iconCount = await icon.count();
  await icon.click({ force: true });
  await sleep(1500);
  out.afterIconClick = await state();
  await icon.click({ force: true });
  await sleep(1500);
  out.afterSecondClick = await state();
  // 点内容
  await page.locator("xpath=//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]").click();
  await sleep(1800);
  out.afterContentClick = await state();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1).slice(0, 2500));
  await browser.close();
})();
