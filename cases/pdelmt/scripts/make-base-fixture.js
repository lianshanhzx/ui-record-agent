// make-base-fixture.js - 创建基本信息录制的固定测试组件 AT_BASE_LIST（保留不删）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const XP = {
  searchInput: `//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']`,
  searchIcon: `//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]`,
  node: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]`,
  addComp: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-document-add')]`,
  dlgName: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件名称']]//input`,
  dlgSeq: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='序号']]//input`,
  dlgSave: `//div[contains(@class,'el-dialog')]//button[translate(normalize-space(.),' ','')='保存']`,
};
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let tree = null;
  page.on('response', async (r) => { if (r.url().includes('prodElmtGrpgInf/list')) { try { tree = JSON.parse(await r.text()); } catch {} } });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);
  const exists = (tree.data || []).find((g) => g.elmtGrpgNm === 'AT_BASE_LIST');
  if (exists) { console.log('ALREADY_EXISTS', JSON.stringify({ id: exists.elmtGrpgNo, name: exists.elmtGrpgNm })); await browser.close(); return; }
  await page.locator(`xpath=${XP.searchInput}`).fill('产品公共要素');
  await page.locator(`xpath=${XP.searchIcon}`).click({ force: true });
  await sleep(2000);
  await page.locator(`xpath=${XP.node}`).click();
  await sleep(2200);
  await page.locator(`xpath=${XP.addComp}`).click({ force: true });
  await sleep(2000);
  await page.locator(`xpath=${XP.dlgName}`).fill('AT_BASE_LIST');
  await page.locator(`xpath=${XP.dlgSeq}`).fill('66');
  await page.locator(`xpath=${XP.dlgSave}`).click({ force: true });
  await sleep(3500);
  const g = (tree.data || []).find((x) => x.elmtGrpgNm === 'AT_BASE_LIST');
  console.log('CREATED', JSON.stringify(g ? { id: g.elmtGrpgNo, name: g.elmtGrpgNm, prn: g.prnNo, tp: g.elmtGrpgTp, dataTp: g.dataTp } : null));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
