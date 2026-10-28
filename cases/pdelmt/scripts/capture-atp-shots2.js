// capture-atp-shots2.js - 基本信息/列表 wire 的页面与弹窗截图 + 弹窗 rect
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const SHOTS = path.join(DIR, 'atp', 'shots');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const XP = {
  searchInput: `//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']`,
  searchIcon: `//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]`,
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  tabElmt: `//div[contains(@class,'el-tabs__item')][normalize-space()='产品要素']`,
  codeInput: `//div[@id='pane-second']//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.),'组件要素编码')]]//input`,
  queryBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='查询']`,
  addBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='新增']`,
  modifyBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='修改']`,
  delBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='删除']`,
  rowFirstCell: `//div[@id='pane-second'][count(.//div[contains(@class,'el-table__body-wrapper')]//tbody/tr)=1]//div[contains(@class,'el-table__body-wrapper')]//tbody/tr/td[1]`,
  dlgNm: `//div[contains(@class,'elmt-add-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素名称']]//input`,
  dlgType: `//div[contains(@class,'elmt-add-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素类型']]//input`,
  dlgOk: `//div[contains(@class,'elmt-add-dialog')]//button[translate(normalize-space(.),' ','')='确定']`,
  mbOk: `//div[contains(@class,'el-message-box')]//button[translate(normalize-space(.),' ','')='确定' or translate(normalize-space(.),' ','')='OK']`,
  dropdownRow: `//div[contains(@class,'el-select-dropdown')]//table//tbody//tr[contains(normalize-space(.),'lendRepyCardno')]`,
};
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);
  const shot = (f) => page.screenshot({ path: path.join(SHOTS, f), fullPage: false });
  const rectOf = async (sel) => { const b = await page.locator(sel).filter({ visible: true }).first().boundingBox(); if (!b) throw new Error('no bbox ' + sel); return { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) }; };
  const click = async (xp, ms = 1600) => { await page.locator(`xpath=${xp}`).filter({ visible: true }).first().click({ force: true }); await sleep(ms); };
  const out = { popupRects: {}, shots: { page: 'work/pdelmt/atp/shots/page.png' } };

  // 渠道 → 产品要素
  await page.locator(`xpath=${XP.searchInput}`).fill('渠道');
  await click(XP.searchIcon, 2000);
  await click(XP.nodeLeaf, 2400);
  await click(XP.tabElmt, 2000);

  // L3 新增弹窗（空）
  await click(XP.addBtn, 2200);
  await shot('L3-dialog.png');
  out.popupRects['L3 产品要素新增#7'] = await rectOf('.elmt-add-dialog');
  out.shots.L3 = 'work/pdelmt/atp/shots/L3-dialog.png';
  await page.locator('.elmt-add-dialog .el-dialog__headerbtn').filter({ visible: true }).first().click({ force: true });
  await sleep(1200);

  // 造一条要素用于 L4/L5 弹窗截图
  await click(XP.addBtn, 2200);
  await page.locator(`xpath=${XP.dlgNm}`).filter({ visible: true }).first().click({ force: true });
  await sleep(1600);
  await page.locator(`xpath=${XP.dropdownRow}`).filter({ visible: true }).first().click({ force: true });
  await sleep(1800);
  await page.locator(`xpath=${XP.dlgType}`).filter({ visible: true }).first().click({ force: true });
  await sleep(1200);
  await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => { const s = getComputedStyle(d); return s.display !== 'none' && d.getBoundingClientRect().height > 0; });
    const d = ds[ds.length - 1]; if (!d) return;
    const li = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => (x.innerText || '').trim() === '文本'); if (li) li.click();
  });
  await sleep(1200);
  await page.locator(`xpath=${XP.dlgOk}`).filter({ visible: true }).first().click({ force: true });
  await sleep(2800);

  // L4 修改弹窗（回填）
  await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
  await click(XP.queryBtn, 2400);
  await click(XP.rowFirstCell, 900);
  await click(XP.modifyBtn, 2400);
  await shot('L4-dialog.png');
  out.popupRects['L4 产品要素修改#10'] = await rectOf('.elmt-add-dialog');
  out.shots.L4 = 'work/pdelmt/atp/shots/L4-dialog.png';
  await page.locator('.elmt-add-dialog .el-dialog__headerbtn').filter({ visible: true }).first().click({ force: true });
  await sleep(1200);

  // L5 删除确认弹窗
  await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
  await click(XP.queryBtn, 2400);
  await click(XP.rowFirstCell, 900);
  await click(XP.delBtn, 2000);
  await shot('L5-confirm.png');
  out.popupRects['L5 产品要素删除#10'] = await rectOf('.el-message-box');
  out.shots.L5 = 'work/pdelmt/atp/shots/L5-confirm.png';
  // 真实删除，保证净零
  await page.locator(`xpath=${XP.mbOk}`).filter({ visible: true }).first().click({ force: true });
  await sleep(2600);
  await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
  await click(XP.queryBtn, 2400);
  const left = await page.evaluate(() => document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr').length);
  out.cleanupRows = left;

  fs.writeFileSync(path.join(DIR, 'atp', 'shots2.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
