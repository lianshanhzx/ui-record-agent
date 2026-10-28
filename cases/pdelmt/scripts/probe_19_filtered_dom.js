// probe_19_filtered_dom.js - 搜索后树 DOM（总数/可见数/隐藏方式）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_19_out.json');
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
  const dump = () => page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.el-tree [role="treeitem"]'));
    return nodes.map((n) => {
      const c = n.querySelector(':scope > .el-tree-node__content');
      const r = c && c.getBoundingClientRect();
      return { text: c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : '', nodeStyle: n.getAttribute('style') || '', contentStyle: c ? c.getAttribute('style') : '', h: r ? Math.round(r.height) : 0, vis: c ? c.offsetParent !== null : false };
    });
  });
  const out = { before: await dump() };
  await page.locator('input.search-input').fill('产品公共要素');
  await page.locator('.shrink-search-input .input-icon i').first().click({ force: true });
  await sleep(2500);
  out.after = await dump();
  out.afterTotals = await page.evaluate(() => ({ all: document.querySelectorAll('.el-tree [role="treeitem"]').length, contents: document.querySelectorAll('.el-tree [role="treeitem"] > .el-tree-node__content').length }));
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('BEFORE all=', out.before.length, 'AFTER all=', out.afterTotals.all, 'contents=', out.afterTotals.contents);
  console.log(JSON.stringify(out.after.filter((x) => x.vis).map((x) => x.text)));
  console.log('hiddenStyles=', JSON.stringify(out.after.filter((x) => !x.vis).slice(0, 3)));
  await browser.close();
})();
