// probe_25_list_record.js - 产品要素列表 L1~L8 录制（查询/重置/新增/修改/删除/负向）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'record_list_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ts: new Date().toISOString(), txs: {}, log: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.log.push(a.join(' ')); save(); };
const VIS = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;

const XP = {
  searchInput: `//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']`,
  searchIcon: `//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]`,
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  tabElmt: `//div[contains(@class,'el-tabs__item')][normalize-space()='产品要素']`,
  codeInput: `//div[@id='pane-second']//div[contains(@class,'el-form-item')][.//label[contains(normalize-space(.),'组件要素编码')]]//input`,
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
  mbOk: `//div[contains(@class,'el-message-box')]//button[translate(normalize-space(.),' ','')='确定' or translate(normalize-space(.),' ','')='OK']`,
  rowRadio1: `//div[@id='pane-second'][count(.//div[contains(@class,'el-table__body-wrapper')]//tbody/tr)=1]//div[contains(@class,'el-table__body-wrapper')]//tbody/tr/td[1]`,
  dropdownRow: (code) => `//div[contains(@class,'el-select-dropdown')]//table//tbody//tr[contains(normalize-space(.),'${code}')]`,
};

const rectNorm = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('no bbox'); return { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) }; };
const single = async (page, xp, label, allowHidden = false) => {
  const loc = page.locator(`xpath=${xp}`); const all = await loc.count(); const vis = await loc.filter({ visible: true }).count();
  if (vis !== 1 || (!allowHidden && all !== 1)) throw new Error(`${label}: total=${all} visible=${vis}（要求 ${allowHidden ? '可见 1' : '1'}）`);
  return loc.filter({ visible: true }).first();
};
const rowsOf = (page) => page.evaluate(() => Array.from(document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim())));
const msgs = (page) => page.evaluate(`(() => { const vis = ${VIS};
  return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim() })); })()`);
const waitToastsGone = async (page) => {
  for (let i = 0; i < 20; i++) {
    const n = await page.evaluate(`(() => { const vis = ${VIS};
      return Array.from(document.querySelectorAll('.el-message, .el-notification')).filter(vis).length; })()`);
    if (n === 0) return;
    await sleep(400);
  }
};

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let lastQuery = null;
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try { const j = JSON.parse(await r.text()); if (u.includes('prodElmtInf/query')) lastQuery = j; } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);

  const click = async (xp) => { await page.locator(`xpath=${xp}`).first().click({ force: true }); await sleep(1600); };
  const jsClickPaneBtn = async (text) => page.evaluate((text) => {
    const b = Array.from(document.querySelectorAll("#pane-second button")).find((x) => (x.innerText || '').replace(/\s+/g, '') === text);
    if (b) b.click();
  }, text);
  const freshPage = async () => {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.el-tree', { timeout: 90000 });
    await sleep(2500);
  };
  const treeSteps = async (name) => {
    const rInp = await rectNorm(await single(page, XP.searchInput, '搜索框'));
    await page.locator(`xpath=${XP.searchInput}`).fill(name);
    const rIcon = await rectNorm(await single(page, XP.searchIcon, '搜索图标'));
    await click(XP.searchIcon);
    await sleep(600);
    const node = await single(page, XP.nodeLeaf, '节点 ' + name);
    const rNode = await rectNorm(node);
    await node.click(); await sleep(2400);
    const rTab = await rectNorm(await single(page, XP.tabElmt, '产品要素页签'));
    await click(XP.tabElmt);
    await sleep(1200);
    return [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: name, rect: rInp },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: rIcon },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: rNode },
      { name: '切换产品要素页签', action: 'click', xpath: XP.tabElmt, value: '', rect: rTab },
    ];
  };

  // L1 查询
  out.txs.L1 = { name: '产品要素查询', steps: [], checks: {} };
  {
    const steps = await treeSteps('渠道');
    const rCode = await rectNorm(await single(page, XP.codeInput, '要素编码'));
    await page.locator(`xpath=${XP.codeInput}`).fill('intgStm');
    const rQ = await rectNorm(await single(page, XP.queryBtn, '查询'));
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rows = await rowsOf(page);
    out.txs.L1.checks = { rows, total: lastQuery && lastQuery.data && lastQuery.data.total };
    if (!(rows.length === 1 && rows[0].includes('intgStm'))) throw new Error('查询结果不符: ' + JSON.stringify(rows));
    out.txs.L1.steps = [...steps, { name: '输入组件要素编码', action: 'input', xpath: XP.codeInput, value: 'intgStm', rect: rCode }, { name: '点击查询', action: 'click', xpath: XP.queryBtn, value: '', rect: rQ }];
    out.txs.L1.checks.passed = true; log('L1 ok', JSON.stringify(out.txs.L1.checks));
  }

  // L2 重置
  out.txs.L2 = { name: '产品要素重置查询', steps: [], checks: {} };
  {
    const steps = await treeSteps('渠道');
    const rQ = await rectNorm(await single(page, XP.queryBtn, '查询'));
    const rCode = await rectNorm(await single(page, XP.codeInput, '要素编码'));
    await page.locator(`xpath=${XP.codeInput}`).fill('intgStm');
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true }); await sleep(2400);
    const rR = await rectNorm(await single(page, XP.resetBtn, '重置'));
    await page.locator(`xpath=${XP.resetBtn}`).click({ force: true });
    await sleep(2200);
    const codeVal = await page.locator(`xpath=${XP.codeInput}`).first().inputValue();
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rows = await rowsOf(page);
    out.txs.L2.checks = { codeVal, rows: rows.length, total: lastQuery && lastQuery.data && lastQuery.data.total };
    if (codeVal !== '' || rows.length < 2) throw new Error('重置未生效: ' + JSON.stringify(out.txs.L2.checks));
    out.txs.L2.steps = [...steps, { name: '输入组件要素编码', action: 'input', xpath: XP.codeInput, value: 'intgStm', rect: rCode }, { name: '点击查询', action: 'click', xpath: XP.queryBtn, value: '', rect: rQ }, { name: '点击重置', action: 'click', xpath: XP.resetBtn, value: '', rect: rR }, { name: '点击查询', action: 'click', xpath: XP.queryBtn, value: '', rect: rQ }];
    out.txs.L2.checks.passed = true; log('L2 ok', JSON.stringify(out.txs.L2.checks));
  }

  // L3 新增
  out.txs.L3 = { name: '产品要素新增', steps: [], checks: {} };
  {
    const steps = await treeSteps('渠道');
    const rAdd = await rectNorm(await single(page, XP.addBtn, '新增'));
    await page.locator(`xpath=${XP.addBtn}`).click({ force: true });
    await sleep(2200);
    const rNm = await rectNorm(await single(page, XP.dlgNm, '要素名称', true));
    const nmEl = await single(page, XP.dlgNm, '要素名称', true);
    await nmEl.click({ force: true });
    await sleep(1800);
    const rRow = await rectNorm(await single(page, XP.dropdownRow('lendRepyCardno'), '数据项行', true));
    const rowEl = await single(page, XP.dropdownRow('lendRepyCardno'), '数据项行', true);
    await rowEl.click({ force: true });
    await sleep(2000);
    const code = await page.locator(`xpath=${XP.dlgCode}`).filter({ visible: true }).first().inputValue();
    if (code !== 'lendRepyCardno') throw new Error('要素编码未回填: ' + code);
    const rType = await rectNorm(await single(page, XP.dlgType, '要素类型', true));
    const typeEl = await single(page, XP.dlgType, '要素类型', true);
    await typeEl.click({ force: true });
    await sleep(1200);
    await page.evaluate(() => {
      const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => { const s = getComputedStyle(d); return s.display !== 'none' && d.getBoundingClientRect().height > 0; });
      const d = ds[ds.length - 1]; if (!d) return;
      const li = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => (x.innerText || '').trim() === '文本'); if (li) li.click();
    });
    await sleep(1400);
    const rOk = await rectNorm(await single(page, XP.dlgOk, '确定', true));
    const okEl = await single(page, XP.dlgOk, '确定', true);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtInf/save') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
      okEl.click({ force: true }),
    ]);
    const body = resp ? await resp.json().catch(() => null) : null;
    await sleep(2800);
    await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rows = await rowsOf(page);
    out.txs.L3.checks = { code, saveUrl: resp ? resp.url().replace(BASE, '') : null, saveCode: body && (body.code ?? body.status), rows };
    if (!rows.some((r) => r.includes('lendRepyCardno'))) throw new Error('新增后未出现记录: ' + JSON.stringify(rows));
    out.txs.L3.steps = [...steps, { name: '点击新增', action: 'click', xpath: XP.addBtn, value: '', rect: rAdd },
      { name: '点击要素名称', action: 'click', xpath: XP.dlgNm, value: '', rect: rNm, popup: true },
      { name: '选择数据项', action: 'click', xpath: XP.dropdownRow('lendRepyCardno'), value: '', rect: rRow, popup: true },
      { name: '选择要素类型', action: 'select:click', xpath: XP.dlgType, value: '文本', rect: rType, popup: true },
      { name: '点击确定', action: 'click', xpath: XP.dlgOk, value: '', rect: rOk, popup: true }];
    out.txs.L3.checks.passed = true; log('L3 ok', JSON.stringify(out.txs.L3.checks));
  }

  // L4 修改
  out.txs.L4 = { name: '产品要素修改', steps: [], checks: {} };
  {
    const steps = await treeSteps('渠道');
    const rCode = await rectNorm(await single(page, XP.codeInput, '要素编码'));
    await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
    const rQ = await rectNorm(await single(page, XP.queryBtn, '查询'));
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rRadio = await rectNorm(await single(page, XP.rowRadio1, '行单选'));
    await page.locator(`xpath=${XP.rowRadio1}`).click({ force: true });
    await sleep(1000);
    const rMod = await rectNorm(await single(page, XP.modifyBtn, '修改'));
    await page.locator(`xpath=${XP.modifyBtn}`).click({ force: true });
    await sleep(2200);
    const rType = await rectNorm(await single(page, XP.dlgType, '要素类型', true));
    const typeEl = await single(page, XP.dlgType, '要素类型', true);
    await typeEl.click({ force: true });
    await sleep(1200);
    await page.evaluate(() => {
      const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => { const s = getComputedStyle(d); return s.display !== 'none' && d.getBoundingClientRect().height > 0; });
      const d = ds[ds.length - 1]; if (!d) return;
      const li = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => (x.innerText || '').trim() === '区间'); if (li) li.click();
    });
    await sleep(1400);
    const rOk = await rectNorm(await single(page, XP.dlgOk, '确定', true));
    const okEl = await single(page, XP.dlgOk, '确定', true);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtInf/save') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
      okEl.click({ force: true }),
    ]);
    const body = resp ? await resp.json().catch(() => null) : null;
    await sleep(2800);
    await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rows = await rowsOf(page);
    out.txs.L4.checks = { saveUrl: resp ? resp.url().replace(BASE, '') : null, saveCode: body && (body.code ?? body.status), rows };
    if (!rows.some((r) => r.includes('区间'))) throw new Error('修改后类型未变更: ' + JSON.stringify(rows));
    out.txs.L4.steps = [...steps, { name: '输入组件要素编码', action: 'input', xpath: XP.codeInput, value: 'lendRepyCardno', rect: rCode },
      { name: '点击查询', action: 'click', xpath: XP.queryBtn, value: '', rect: rQ },
      { name: '选择行', action: 'click', xpath: XP.rowRadio1, value: '', rect: rRadio },
      { name: '点击修改', action: 'click', xpath: XP.modifyBtn, value: '', rect: rMod },
      { name: '选择要素类型', action: 'select:click', xpath: XP.dlgType, value: '区间', rect: rType, popup: true },
      { name: '点击确定', action: 'click', xpath: XP.dlgOk, value: '', rect: rOk, popup: true }];
    out.txs.L4.checks.passed = true; log('L4 ok', JSON.stringify(out.txs.L4.checks));
  }

  // L5 删除
  out.txs.L5 = { name: '产品要素删除', steps: [], checks: {} };
  {
    const steps = await treeSteps('渠道');
    const rCode = await rectNorm(await single(page, XP.codeInput, '要素编码'));
    await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
    const rQ = await rectNorm(await single(page, XP.queryBtn, '查询'));
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rRadio = await rectNorm(await single(page, XP.rowRadio1, '行单选'));
    await page.locator(`xpath=${XP.rowRadio1}`).click({ force: true });
    await sleep(1000);
    const rDel = await rectNorm(await single(page, XP.delBtn, '删除'));
    await page.locator(`xpath=${XP.delBtn}`).click({ force: true });
    await sleep(2000);
    const mb = await msgs(page);
    const rOk = await rectNorm(await single(page, XP.mbOk, '确认删除', true));
    const okEl = await single(page, XP.mbOk, '确认删除', true);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtInf/delete') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null),
      okEl.click({ force: true }),
    ]);
    const body = resp ? await resp.json().catch(() => null) : null;
    await sleep(2500);
    await page.locator(`xpath=${XP.codeInput}`).fill('lendRepyCardno');
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rows = await rowsOf(page);
    out.txs.L5.checks = { confirmText: mb.map((m) => m.text), delUrl: resp ? resp.url().replace(BASE, '') : null, delCode: body && (body.code ?? body.status), rows };
    if (rows.length !== 0) throw new Error('删除后仍有记录: ' + JSON.stringify(rows));
    out.txs.L5.steps = [...steps, { name: '输入组件要素编码', action: 'input', xpath: XP.codeInput, value: 'lendRepyCardno', rect: rCode },
      { name: '点击查询', action: 'click', xpath: XP.queryBtn, value: '', rect: rQ },
      { name: '选择行', action: 'click', xpath: XP.rowRadio1, value: '', rect: rRadio },
      { name: '点击删除', action: 'click', xpath: XP.delBtn, value: '', rect: rDel },
      { name: '确认删除', action: 'click', xpath: XP.mbOk, value: '', rect: rOk, popup: true }];
    out.txs.L5.checks.passed = true; log('L5 ok', JSON.stringify(out.txs.L5.checks));
  }

  // L6 删除引用拦截（渠道 / intgStm，被产品引用的存量要素）
  out.txs.L6 = { name: '产品要素删除引用拦截', steps: [], checks: {} };
  {
    const steps = await treeSteps('渠道');
    const rCode = await rectNorm(await single(page, XP.codeInput, '要素编码'));
    await page.locator(`xpath=${XP.codeInput}`).fill('intgStm');
    const rQ = await rectNorm(await single(page, XP.queryBtn, '查询'));
    await page.locator(`xpath=${XP.queryBtn}`).click({ force: true });
    await sleep(2600);
    const rRadio = await rectNorm(await single(page, XP.rowRadio1, '行单选'));
    await page.locator(`xpath=${XP.rowRadio1}`).click({ force: true });
    await sleep(1000);
    const rDel = await rectNorm(await single(page, XP.delBtn, '删除'));
    await page.locator(`xpath=${XP.delBtn}`).click({ force: true });
    await sleep(2200);
    const ms = await msgs(page);
    // 若误弹确认框，取消并判为“非引用数据”
    const cancel = page.locator('.el-message-box:visible button').filter({ hasText: /取消|Cancel/ });
    if (await cancel.count()) { await cancel.first().click({ force: true }).catch(() => {}); throw new Error('该要素未被引用，出现确认框: ' + JSON.stringify(ms)); }
    out.txs.L6.checks = { msgs: ms };
    if (!ms.some((m) => m.text.includes('引用'))) throw new Error('未出现引用拦截: ' + JSON.stringify(ms));
    out.txs.L6.steps = [...steps, { name: '输入组件要素编码', action: 'input', xpath: XP.codeInput, value: 'intgStm', rect: rCode },
      { name: '点击查询', action: 'click', xpath: XP.queryBtn, value: '', rect: rQ },
      { name: '选择行', action: 'click', xpath: XP.rowRadio1, value: '', rect: rRadio },
      { name: '点击删除', action: 'click', xpath: XP.delBtn, value: '', rect: rDel }];
    out.txs.L6.checks.passed = true; log('L6 ok', JSON.stringify(out.txs.L6.checks));
  }

  // L7 删除未选行
  out.txs.L7 = { name: '产品要素删除未选行', steps: [], checks: {} };
  {
    await freshPage();
    const steps = await treeSteps('渠道');
    const rDel = await rectNorm(await single(page, XP.delBtn, '删除'));
    await jsClickPaneBtn('删除');
    let ms = [];
    for (let i = 0; i < 12; i++) { await sleep(300); ms = await msgs(page); if (ms.some((m) => m.text.includes('请选择有效数据'))) break; }
    out.txs.L7.checks = { msgs: ms };
    if (!ms.some((m) => m.text.includes('请选择有效数据'))) throw new Error('未出现未选行提示: ' + JSON.stringify(ms));
    out.txs.L7.steps = [...steps, { name: '点击删除', action: 'click', xpath: XP.delBtn, value: '', rect: rDel }];
    out.txs.L7.checks.passed = true; log('L7 ok', JSON.stringify(out.txs.L7.checks));
  }

  // L8 修改未选行
  out.txs.L8 = { name: '产品要素修改未选行', steps: [], checks: {} };
  {
    await freshPage();
    const steps = await treeSteps('渠道');
    const rMod = await rectNorm(await single(page, XP.modifyBtn, '修改'));
    await jsClickPaneBtn('修改');
    let ms = [];
    for (let i = 0; i < 12; i++) { await sleep(300); ms = await msgs(page); if (ms.some((m) => m.text.includes('请选择一条数据'))) break; }
    out.txs.L8.checks = { msgs: ms };
    if (!ms.some((m) => m.text.includes('请选择一条数据'))) throw new Error('未出现未选行提示: ' + JSON.stringify(ms));
    out.txs.L8.steps = [...steps, { name: '点击修改', action: 'click', xpath: XP.modifyBtn, value: '', rect: rMod }];
    out.txs.L8.checks.passed = true; log('L8 ok', JSON.stringify(out.txs.L8.checks));
  }

  out.ok = true; save(); console.log('ALL_OK');
  await browser.close();
})().catch((e) => { console.error('ERR', e); out.error = e.message; save(); process.exit(1); });
