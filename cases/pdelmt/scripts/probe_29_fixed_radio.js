// probe_29_fixed_radio.js - 固定列单选的可点击锚点
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
  await page.click('#tab-second'); await sleep(2400);
  await page.locator("xpath=//div[@id='pane-second']//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.),'组件要素编码')]]//input").fill('intgStm');
  await page.locator("xpath=//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='查询']").click({ force: true });
  await sleep(2600);
  const stats = await page.evaluate(() => {
    const pane = document.querySelector('#pane-second');
    const fixed = Array.from(pane.querySelectorAll('.el-table__fixed'));
    return fixed.map((f) => ({ rows: f.querySelectorAll('tbody tr').length, labels: f.querySelectorAll('tbody tr label.el-radio').length, visLabels: Array.from(f.querySelectorAll('tbody tr label.el-radio')).filter((l) => l.getBoundingClientRect().height > 0).length }));
  });
  const xp = "//div[@id='pane-second'][count(.//div[contains(@class,'el-table__fixed')]//tbody/tr//label[contains(@class,'el-radio')])=1]//div[contains(@class,'el-table__fixed')]//tbody/tr//label[contains(@class,'el-radio')]";
  const loc = page.locator(`xpath=${xp}`);
  const all = await loc.count(); const vis = await loc.filter({ visible: true }).count();
  console.log('STATS', JSON.stringify(stats), 'all', all, 'vis', vis);
  await loc.first().click({ timeout: 10000 }).catch((e) => console.log('CLICK_ERR', e.message.slice(0, 200)));
  await sleep(1200);
  const checked = await page.evaluate(() => document.querySelectorAll('#pane-second .el-table__fixed tbody tr .el-radio.is-checked').length);
  console.log('CHECKED', checked);
  await browser.close();
})();
