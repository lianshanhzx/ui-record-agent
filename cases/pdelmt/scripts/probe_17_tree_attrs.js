// probe_17_tree_attrs.js - 树节点稳定属性 + 搜索触发方式
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_17_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await page.waitForTimeout(3000);

  // 树节点属性全量（前 8 个）
  out.nodeAttrs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-tree [role="treeitem"]')).slice(0, 8).map((n) => {
      const c = n.querySelector(':scope > .el-tree-node__content');
      return {
        nodeCls: n.className,
        attrs: Array.from(n.attributes).map((a) => a.name + '=' + a.value).filter((a) => !a.startsWith('class=')),
        contentAttrs: c ? Array.from(c.attributes).map((a) => a.name + '=' + a.value).filter((a) => !a.startsWith('class=')) : [],
        contentCls: c ? c.className : null,
        indent: c ? c.style.paddingLeft : null,
        textLen: c ? (c.innerText || '').trim().length : null,
        expandCls: c ? (c.querySelector('.el-tree-node__expand-icon') || {}).className : null,
        parentIsTree: n.parentElement ? n.parentElement.className : null,
      };
    }));
  save();

  // 搜索：只 fill 是否过滤
  const s = page.locator('input.search-input');
  const count = () => page.evaluate(() => Array.from(document.querySelectorAll('.el-tree [role="treeitem"] > .el-tree-node__content')).filter((c) => { const r = c.getBoundingClientRect(); return r.height > 0 && getComputedStyle(c).display !== 'none'; }).length);
  out.before = await count();
  await s.fill('产品公共要素');
  await sleep(2000);
  out.afterFill = await count();
  await page.locator('.shrink-search-input .input-icon a, .shrink-search-input .input-icon i').first().click({ force: true });
  await sleep(2000);
  out.afterIconClick = await count();
  // 回车再试
  await page.keyboard.press('Enter');
  await sleep(1500);
  out.afterEnter = await count();
  out.visibleTexts = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tree [role="treeitem"] > .el-tree-node__content')).filter((c) => c.getBoundingClientRect().height > 0).map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim()));
  save();
  console.log(JSON.stringify(out, null, 1).slice(0, 3000));
  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
