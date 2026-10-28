// cleanup-elmt.js - 清理 渠道 下 lendRepyCardno 残留要素（API 直删，复用页面请求头）
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
  let headers = null;
  page.on('request', (r) => {
    if (!headers && r.url().includes('prodElmtInf/query')) headers = r.headers();
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);
  await page.locator("xpath=//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']").fill('渠道');
  await page.locator("xpath=//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]").click({ force: true });
  await sleep(2000);
  await page.locator("xpath=//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]").first().click();
  await sleep(2500);
  await page.click('#tab-second');
  await sleep(2500);
  if (!headers) throw new Error('未捕获 query 请求头');
  const q = await page.request.post(BASE + '/prod-api/tansun-tcp-app-pc/tansun-tcp-prod/prodElmtInf/query', {
    headers,
    data: { elmtGrpgNo: 'ZJLX2066', pageNum: 1, pageSize: 100, elmtNm: '', elmtNo: 'lendRepyCardno' },
  });
  const qj = await q.json();
  const list = (qj.data && qj.data.list) || [];
  console.log('FOUND', list.length, JSON.stringify(list.map((x) => ({ id: x.id, elmtNo: x.elmtNo, elmtTp: x.elmtTp }))));
  for (const row of list) {
    const d = await page.request.post(BASE + '/prod-api/tansun-tcp-app-pc/tansun-tcp-prod/prodElmtInf/delete', { headers, data: { id: row.id } });
    console.log('DELETE', row.id, d.status(), JSON.stringify(await d.json()).slice(0, 120));
  }
  const q2 = await page.request.post(BASE + '/prod-api/tansun-tcp-app-pc/tansun-tcp-prod/prodElmtInf/query', {
    headers,
    data: { elmtGrpgNo: 'ZJLX2066', pageNum: 1, pageSize: 100, elmtNm: '', elmtNo: 'lendRepyCardno' },
  });
  const q2j = await q2.json();
  console.log('AFTER', (q2j.data && q2j.data.list || []).length);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
