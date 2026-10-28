// probe_27_dlg_inputs.js - 新增弹窗内 要素名称 匹配为何有多个
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
  const info = await page.evaluate(() => {
    const d = document.querySelector('.elmt-add-dialog');
    const items = Array.from(d.querySelectorAll('.el-form-item')).map((f) => {
      const lb = f.querySelector('label');
      const ins = Array.from(f.querySelectorAll('input'));
      return { label: lb ? (lb.innerText || '').trim() : '', inputs: ins.length, vis: ins.filter((i) => i.getBoundingClientRect().height > 0).length, cls: f.className };
    });
    return { items, html: d.querySelector('.el-form-item').outerHTML.slice(0, 1200) };
  });
  console.log(JSON.stringify(info, null, 1).slice(0, 4000));
  await browser.close();
})();
