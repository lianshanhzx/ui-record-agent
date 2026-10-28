// capture-atp-shots.js - 为 ATP 推送准备页面/弹窗整屏截图 + 弹窗归一化 rect
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
  node: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]`,
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  addType: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-folder-add')]`,
  addComp: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-document-add')]`,
  delNode: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-delete')]`,
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

  const shot = async (file) => page.screenshot({ path: path.join(SHOTS, file), fullPage: false });
  const rectOf = async (sel) => {
    const b = await page.locator(sel).filter({ visible: true }).first().boundingBox();
    if (!b) throw new Error('no bbox ' + sel);
    return { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) };
  };
  const search = async (q) => {
    await page.locator(`xpath=${XP.searchInput}`).fill(q);
    await page.locator(`xpath=${XP.searchIcon}`).click({ force: true });
    await sleep(2200);
  };
  const clickNode = async (xp) => { await page.locator(`xpath=${xp}`).first().click(); await sleep(2500); };

  // 页面整屏截图（作为全部交易的 page 步截图）
  await shot('page.png');

  const closeDlg = async () => {
    const x = page.locator('.el-dialog').filter({ visible: true }).locator('.el-dialog__headerbtn');
    if (await x.count()) await x.first().click({ force: true });
    await sleep(900);
  };
  const closeMb = async () => {
    const c = page.locator('.el-message-box').filter({ visible: true }).locator('button').filter({ hasText: /取消|Cancel/ });
    if (await c.count()) await c.first().click({ force: true });
    await sleep(900);
  };

  const out = { popupRects: {}, shots: {} };

  // T5 新增组件弹窗
  await search('产品公共要素');
  await clickNode(XP.node);
  await page.locator(`xpath=${XP.addComp}`).click({ force: true });
  await sleep(2200);
  await shot('T5-popup.png');
  out.popupRects['T5 树新增组件#6'] = await rectOf('.el-dialog');
  out.shots.T5 = path.join('work', 'pdelmt', 'atp', 'shots', 'T5-popup.png').replace(/\\/g, '/');
  await closeDlg();

  // T6 删除确认弹窗
  await search('渠道');
  await clickNode(XP.nodeLeaf);
  await page.locator(`xpath=${XP.delNode}`).click({ force: true });
  await sleep(1800);
  await shot('T6-popup.png');
  out.popupRects['T6 树删除组件#6'] = await rectOf('.el-message-box');
  out.shots.T6 = path.join('work', 'pdelmt', 'atp', 'shots', 'T6-popup.png').replace(/\\/g, '/');
  await closeMb();

  // T7 新增类型弹窗
  await search('KB测要素类型-20261023-elem');
  await clickNode(XP.nodeLeaf);
  await page.locator(`xpath=${XP.addType}`).click({ force: true });
  await sleep(2200);
  await shot('T7-popup.png');
  out.popupRects['T7 树新增类型#6'] = await rectOf('.el-dialog');
  out.shots.T7 = path.join('work', 'pdelmt', 'atp', 'shots', 'T7-popup.png').replace(/\\/g, '/');
  await closeDlg();

  // T8 删除确认弹窗
  await search('渠道');
  await clickNode(XP.nodeLeaf);
  await page.locator(`xpath=${XP.delNode}`).click({ force: true });
  await sleep(1800);
  await shot('T8-popup.png');
  out.popupRects['T8 树删除类型#6'] = await rectOf('.el-message-box');
  out.shots.T8 = path.join('work', 'pdelmt', 'atp', 'shots', 'T8-popup.png').replace(/\\/g, '/');
  await closeMb();

  out.shots.page = path.join('work', 'pdelmt', 'atp', 'shots', 'page.png').replace(/\\/g, '/');
  fs.writeFileSync(path.join(DIR, 'atp', 'shots.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
