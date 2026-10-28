// probe_11_tabdiag.js - 产品要素页签 DOM 诊断
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
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
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
    const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === '年龄限制');
    hit.click();
  });
  await page.waitForTimeout(3000);
  console.log('TABS_BEFORE', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).map((e) => ({ id: e.id, t: (e.innerText || '').trim(), act: e.className.includes('is-active') })))));
  await page.click('#tab-second').catch((e) => console.log('CLICK_ERR', e.message));
  await sleep(2500);
  console.log('TABS_AFTER', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).map((e) => ({ id: e.id, t: (e.innerText || '').trim(), act: e.className.includes('is-active') })))));
  console.log('PANES', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.el-tab-pane')).map((p) => ({ id: p.id, vis: p.getBoundingClientRect().height > 0, ins: Array.from(p.querySelectorAll('input')).slice(0, 6).map((i) => ({ ph: i.placeholder, r: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })) })))));
  await browser.close();
})();
