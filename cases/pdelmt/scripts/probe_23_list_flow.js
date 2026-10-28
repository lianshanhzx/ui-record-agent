// probe_23_list_flow.js - 产品要素列表：新增→查询→修改→删除 全链路（AT 数据，自清理）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_23_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], apis: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };
const VIS = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;

const XP = {
  searchInput: `//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']`,
  searchIcon: `//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]`,
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  tabElmt: `//div[contains(@class,'el-tabs__item')][normalize-space()='产品要素']`,
  codeInput: `//div[@id='pane-second']//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.),'组件要素编码')]]//input`,
  nameInput: `//div[@id='pane-second']//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.),'组件要素名称')]]//input`,
  queryBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='查询']`,
  resetBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='重置']`,
  addBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='新增']`,
  modifyBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='修改']`,
  delBtn: `//div[@id='pane-second']//button[translate(normalize-space(.),' ','')='删除']`,
  dlg: `//div[contains(@class,'el-dialog') and contains(@class,'elmt-add-dialog')]`,
  dlgNm: `//div[contains(@class,'el-dialog') and contains(@class,'elmt-add-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素名称']]//input`,
  dlgCode: `//div[contains(@class,'el-dialog') and contains(@class,'elmt-add-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素编码']]//input`,
  dlgType: `//div[contains(@class,'el-dialog') and contains(@class,'elmt-add-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='要素类型']]//input`,
  dlgOk: `//div[contains(@class,'el-dialog') and contains(@class,'elmt-add-dialog')]//button[translate(normalize-space(.),' ','')='确定']`,
  dlgCancel: `//div[contains(@class,'el-dialog') and contains(@class,'elmt-add-dialog')]//button[translate(normalize-space(.),' ','')='取消']`,
  mbOk: `//div[contains(@class,'el-message-box')]//button[translate(normalize-space(.),' ','')='确定' or translate(normalize-space(.),' ','')='OK']`,
  // 查询后仅 1 行时的行单选（count 守卫）
  rowRadio1: `//div[@id='pane-second'][count(.//div[contains(@class,'el-table__body-wrapper')]//tbody/tr)=1]//div[contains(@class,'el-table__body-wrapper')]//tbody/tr//label[contains(@class,'el-radio')]`,
};

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try { const t = await r.text(); const j = JSON.parse(t); out.apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 800), code: j && j.code, body: t.length < 150000 ? j : null }); save(); } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);

  const click = async (xp) => { await page.locator(`xpath=${xp}`).first().click({ force: true }); await sleep(1600); };
  const searchTree = async (q) => { await page.locator(`xpath=${XP.searchInput}`).fill(q); await click(XP.searchIcon); };
  const selectChannel = async () => { await searchTree('渠道'); await click(XP.nodeLeaf); await click(XP.tabElmt); };
  const rows = () => page.evaluate(() => Array.from(document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim())));
  const dialogOpen = () => page.evaluate(`(() => { const vis = ${VIS}; return Array.from(document.querySelectorAll('.elmt-add-dialog')).filter(vis).length; })()`);
  const msgs = () => page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim() })); })()`);

  // 0. 选中 渠道 → 产品要素
  await selectChannel();
  out.initialRows = await rows(); save();
  log('INIT_ROWS', JSON.stringify(out.initialRows));

  // 1. 新增
  await click(XP.addBtn);
  out.dlgOpen = await dialogOpen(); save(); log('DLG_OPEN', out.dlgOpen);
  await click(XP.dlgNm);
  await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => { const s = getComputedStyle(d); return s.display !== 'none' && d.getBoundingClientRect().height > 0; });
    const d = ds[ds.length - 1]; if (!d) return;
    const tr = Array.from(d.querySelectorAll('tbody tr')).find((x) => (x.innerText || '').includes('lendRepyCardno'));
    if (tr) tr.click();
  });
  await sleep(1800);
  out.picked = { nm: await page.locator(`xpath=${XP.dlgNm}`).first().inputValue().catch(() => null), code: await page.locator(`xpath=${XP.dlgCode}`).first().inputValue().catch(() => null) };
  save(); log('PICKED', JSON.stringify(out.picked));
  await click(XP.dlgType);
  await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => { const s = getComputedStyle(d); return s.display !== 'none' && d.getBoundingClientRect().height > 0; });
    const d = ds[ds.length - 1]; if (!d) return;
    const li = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => (x.innerText || '').trim() === '文本'); if (li) li.click();
  });
  await sleep(1400);
  out.typePicked = await page.locator(`xpath=${XP.dlgType}`).first().inputValue().catch(() => null);
  save(); log('TYPE_PICKED', out.typePicked);
  const [addResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/prodElmtInf/') && r.request().method() === 'POST' && !r.url().includes('query') && !r.url().includes('list'), { timeout: 30000 }).catch(() => null),
    page.locator(`xpath=${XP.dlgOk}`).first().click({ force: true }),
  ]);
  await sleep(3000);
  out.addResult = { url: addResp ? addResp.url().replace(BASE, '') : null, code: addResp ? (await addResp.json().catch(() => ({}))).code : null, dialogOpen: await dialogOpen(), msgs: await msgs() };
  save(); log('ADD_RESULT', JSON.stringify(out.addResult));

  // 2. 查询
  await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
  await click(XP.queryBtn);
  out.queryRows = await rows(); save(); log('QUERY_ROWS', JSON.stringify(out.queryRows));

  // 3. 修改（选行 → 修改 → 类型改区间）
  await click(XP.rowRadio1);
  out.rowChecked = await page.evaluate(() => { const r = document.querySelector("#pane-second tbody tr .el-radio"); return r ? r.className : null; });
  save(); log('ROW_CHECKED', out.rowChecked);
  await click(XP.modifyBtn);
  out.modDlg = { open: await dialogOpen(), code: await page.locator(`xpath=${XP.dlgCode}`).first().inputValue().catch(() => null), type: await page.locator(`xpath=${XP.dlgType}`).first().inputValue().catch(() => null) };
  save(); log('MOD_DLG', JSON.stringify(out.modDlg));
  await click(XP.dlgType);
  await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => { const s = getComputedStyle(d); return s.display !== 'none' && d.getBoundingClientRect().height > 0; });
    const d = ds[ds.length - 1]; if (!d) return;
    const li = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => (x.innerText || '').trim() === '区间'); if (li) li.click();
  });
  await sleep(1400);
  out.newType = await page.locator(`xpath=${XP.dlgType}`).first().inputValue().catch(() => null);
  save(); log('NEW_TYPE', out.newType);
  const [modResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/prodElmtInf/') && r.request().method() === 'POST' && !r.url().includes('query') && !r.url().includes('list'), { timeout: 30000 }).catch(() => null),
    page.locator(`xpath=${XP.dlgOk}`).first().click({ force: true }),
  ]);
  await sleep(3000);
  out.modResult = { url: modResp ? modResp.url().replace(BASE, '') : null, code: modResp ? (await modResp.json().catch(() => ({}))).code : null, dialogOpen: await dialogOpen(), msgs: await msgs() };
  save(); log('MOD_RESULT', JSON.stringify(out.modResult));
  await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
  await click(XP.queryBtn);
  out.afterModRows = await rows(); save(); log('AFTER_MOD_ROWS', JSON.stringify(out.afterModRows));

  // 4. 删除
  await click(XP.rowRadio1);
  await click(XP.delBtn);
  out.delMsgs = await msgs(); save(); log('DEL_MSGS', JSON.stringify(out.delMsgs));
  const [delResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/prodElmtInf/') && r.request().method() === 'POST' && r.url().includes('delete'), { timeout: 30000 }).catch(() => null),
    page.locator(`xpath=${XP.mbOk}`).first().click({ force: true }),
  ]);
  await sleep(3000);
  out.delResult = { url: delResp ? delResp.url().replace(BASE, '') : null, code: delResp ? (await delResp.json().catch(() => ({}))).code : null };
  save(); log('DEL_RESULT', JSON.stringify(out.delResult));
  await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
  await click(XP.queryBtn);
  out.afterDelRows = await rows(); save(); log('AFTER_DEL_ROWS', JSON.stringify(out.afterDelRows));

  // 5. 负向：未选行修改 / 未选行删除
  await page.locator(`xpath=${XP.resetBtn}`).click({ force: true });
  await sleep(2000);
  await click(XP.modifyBtn);
  out.noRowModify = await msgs(); save(); log('NOROW_MODIFY', JSON.stringify(out.noRowModify));
  await click(XP.delBtn);
  out.noRowDelete = await msgs(); save(); log('NOROW_DELETE', JSON.stringify(out.noRowDelete));

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
