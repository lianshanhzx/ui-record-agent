// probe_21_dup_nodes.js - 重名节点结构（叶子/子节点数）用于结构消歧
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_21_out.json');
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
  const dump = async (q) => {
    await page.locator('input.search-input').fill(q);
    await page.locator('.shrink-search-input .input-icon i').first().click({ force: true });
    await sleep(2200);
    return page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('.el-tree [role="treeitem"]'));
      const vis = all.filter((x) => !String(x.getAttribute('style') || '').includes('display: none'));
      return vis.map((n) => {
        const c = n.querySelector(':scope > .el-tree-node__content');
        const kids = n.querySelectorAll(':scope > .el-tree-node__children > .el-tree-node').length;
        return {
          text: (c.innerText || '').replace(/\s+/g, ' ').trim(),
          isLeaf: !!c.querySelector('.el-tree-node__expand-icon.is-leaf'),
          expanded: n.className.includes('is-expanded'),
          kids,
          topLevel: n.parentElement && n.parentElement.className === 'el-tree el-tree--highlight-current',
          indent: c.style.paddingLeft,
        };
      });
    });
  };
  const out = { prsnRoot: await dump('产品个性化要素'), kbType: await dump('KB测要素类型-20261023-elem'), kbElem: await dump('KB测要素类型-20260908-elem') };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
