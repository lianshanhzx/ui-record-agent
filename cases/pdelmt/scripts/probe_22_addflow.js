// probe_22_addflow.js - 产品要素列表：新增弹窗选择要素→保存 全链路探路（会落一条 AT 数据并清理）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_22_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], apis: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };
const XP = {
  searchInput: `//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']`,
  searchIcon: `//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]`,
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  tabElmt: `//div[contains(@class,'el-tabs__item')][normalize-space()='产品要素']`,
  codeInput: `//div[contains(@class,'el-tab-pane')]//input[@placeholder='请输入'][1]`,
  nameInput: `//div[contains(@class,'el-tab-pane')]//input[@placeholder='请输入'][2]`,
  queryBtn: `//div[contains(@class,'el-tab-pane')]//button[translate(normalize-space(.),' ','')='查询']`,
  resetBtn: `//div[contains(@class,'el-tab-pane')]//button[translate(normalize-space(.),' ','')='重置']`,
  addBtn: `//div[contains(@class,'el-tab-pane')]//button[translate(normalize-space(.),' ','')='新增']`,
  modifyBtn: `//div[contains(@class,'el-tab-pane')]//button[translate(normalize-space(.),' ','')='修改']`,
  delBtn: `//div[contains(@class,'el-tab-pane')]//button[translate(normalize-space(.),' ','')='删除']`,
  dlgNm: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素名称']]//input`,
  dlgCode: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素编码']]//input`,
  dlgType: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素类型']]//input`,
  dlgOk: `//div[contains(@class,'el-dialog')]//button[translate(normalize-space(.),' ','')='确定']`,
};

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try { const t = await r.text(); const j = JSON.parse(t); out.apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 500), code: j && j.code, body: t.length < 120000 ? j : null }); save(); } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);

  const click = async (xp) => { await page.locator(`xpath=${xp}`).first().click({ force: true }); await sleep(1800); };

  await page.locator(`xpath=${XP.searchInput}`).fill('渠道');
  await click(XP.searchIcon);
  await click(XP.nodeLeaf);
  await click(XP.tabElmt);
  out.before = await page.evaluate(() => ({ rows: document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr').length, pag: (document.querySelector('#pane-second .el-pagination') || {}).innerText }));
  save(); log('BEFORE', JSON.stringify(out.before));

  await click(XP.addBtn);
  await click(XP.dlgNm);
  const nm = page.locator(`xpath=${XP.dlgNm}`).first();
  await nm.fill('lendRepyCardno');
  await sleep(2800);
  out.dropdown = await page.evaluate(() => Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().height > 0).map((d) => ({ text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500), rows: Array.from(d.querySelectorAll('tbody tr')).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()) })));
  save(); log('DROPDOWN', JSON.stringify(out.dropdown));

  // 点匹配编码的行（数据项编码作为业务锚点）
  await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().height > 0);
    const d = ds[ds.length - 1]; if (!d) return;
    const tr = Array.from(d.querySelectorAll('tbody tr')).find((x) => (x.innerText || '').includes('lendRepyCardno'));
    if (tr) tr.click();
  });
  await sleep(2000);
  out.afterPick = {
    nm: await page.locator(`xpath=${XP.dlgNm}`).first().inputValue().catch(() => null),
    code: await page.locator(`xpath=${XP.dlgCode}`).first().inputValue().catch(() => null),
    type: await page.locator(`xpath=${XP.dlgType}`).first().inputValue().catch(() => null),
  };
  save(); log('AFTER_PICK', JSON.stringify(out.afterPick));

  // 选要素类型=文本
  await click(XP.dlgType);
  await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => getComputedStyle(d).display !== 'none' && d.getBoundingClientRect().height > 0);
    const d = ds[ds.length - 1]; if (!d) return;
    const li = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => (x.innerText || '').trim() === '文本'); if (li) li.click();
  });
  await sleep(1500);
  out.afterType = { type: await page.locator(`xpath=${XP.dlgType}`).first().inputValue().catch(() => null) };
  save(); log('AFTER_TYPE', JSON.stringify(out.afterType));

  // 确定
  await page.locator(`xpath=${XP.dlgOk}`).first().click({ force: true });
  await sleep(3500);
  out.afterSave = await page.evaluate(() => ({ dialogOpen: Array.from(document.querySelectorAll('.el-dialog')).some((d) => d.getBoundingClientRect().height > 0 && getComputedStyle(d).display !== 'none'), msg: Array.from(document.querySelectorAll('.el-notification, .el-message')).filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()) }));
  save(); log('AFTER_SAVE', JSON.stringify(out.afterSave));

  // 查询该编码
  await page.locator(`xpath=${XP.codeInput}`).fill(out.afterPick.code || 'lendRepyCardno');
  await click(XP.queryBtn);
  out.rowsAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim())));
  save(); log('ROWS_AFTER', JSON.stringify(out.rowsAfter.slice(0, 3)));

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
