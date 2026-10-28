// probe_18_tree_record.js - 左侧动态树录制（结构锚定 + 数量/可见断言 + 点击后业务校验）
// 产物：record_tree_out.json（每一步的 xpath/value/rect + 每笔交易的断言结论）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'record_tree_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ts: new Date().toISOString(), txs: {}, treeApi: null, log: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.log.push(a.join(' ')); save(); };

// ---------- 定位常量（不含任何动态名称/数量文本） ----------
const XP = {
  searchInput: `//div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']`,
  searchIcon: `//div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]`,
  // 树容器 + 节点角色 + 内容节点；count 守卫要求整树可见节点数为 1（不满足则无匹配）
  // 过滤节点用 v-show（inline display:none），XPath 以 not(contains(@style,'display: none')) 只统计可见路径
  node: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]`,
  // 叶子结构消歧：搜索会保留命中节点的祖先链，按“叶子节点”过滤后要求恰好 1 个（不含任何名称文本）
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  // 顶层作用域（用于同名重复节点消歧：只取 el-tree 直接子 treeitem，仍带 count=1 守卫）
  nodeTopLevel: `//div[contains(@class,'el-tree')][count(./div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')])=1]/div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]`,
  expandIcon: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]//span[contains(@class,'el-tree-node__expand-icon')]`,
  addType: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-folder-add')]`,
  addComp: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-document-add')]`,
  delNode: `//div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-delete')]`,
  dlgName: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件名称']]//input`,
  dlgSeq: `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='序号']]//input`,
  dlgSave: `//div[contains(@class,'el-dialog')]//button[translate(normalize-space(.),' ','')='保存']`,
  dlgCancel: `//div[contains(@class,'el-dialog')]//button[translate(normalize-space(.),' ','')='取消']`,
  mbOk: `//div[contains(@class,'el-message-box')]//button[translate(normalize-space(.),' ','')='确定' or translate(normalize-space(.),' ','')='OK']`,
  tabElmt: `//div[contains(@class,'el-tabs__item')][normalize-space()='产品要素']`,
  basicNo: `//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件编号']]//input`,
};

const visCount = async (page, xpath) => page.locator(`xpath=${xpath}`).filter({ visible: true }).count();
const rectNorm = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error('no boundingBox');
  return { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) };
};
// 断言：匹配数量 == 1 且可见；多于 1 直接失败（禁止 .first() 掩盖）
const single = async (page, xpath, label) => {
  const loc = page.locator(`xpath=${xpath}`);
  const all = await loc.count();
  const vis = await loc.filter({ visible: true }).count();
  if (all !== 1 || vis !== 1) throw new Error(`${label}: 期望恰好 1 个匹配且可见，实际 total=${all} visible=${vis}`);
  const el = loc.first();
  if (!(await el.isVisible())) throw new Error(`${label}: 不可见`);
  return el;
};

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  out.names = { comp: `AT_TREE_${ts}`, type: `AT_TYPE_${ts}` };

  let treeListBody = null;
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('prodElmtGrpgInf/list')) return;
    try { treeListBody = JSON.parse(await r.text()); out.treeApi = treeListBody; save(); } catch {}
  });

  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3500);

  const doSearch = async (name) => {
    const inp = await single(page, XP.searchInput, '搜索框');
    await inp.fill(name);
    const icon = await single(page, XP.searchIcon, '搜索图标');
    await icon.click();
    await sleep(2200);
    return { rectInput: await rectNorm(await single(page, XP.searchInput, '搜索框')), rectIcon: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) };
  };
  const basicNoValue = async () => {
    const el = await single(page, XP.basicNo, '基本信息-组件编号');
    return el.inputValue();
  };
  // 点击节点并校验：基本信息编号 == 期望
  const clickNode = async (name, { topLevel = false, leaf = false, expectNo }) => {
    const xp = topLevel ? XP.nodeTopLevel : (leaf ? XP.nodeLeaf : XP.node);
    const node = await single(page, xp, `树节点(${name})`);
    const rect = await rectNorm(node);
    await node.click();
    await sleep(2600);
    const got = await basicNoValue();
    if (expectNo && got !== expectNo) throw new Error(`选中对象校验失败: 期望组件编号 ${expectNo}, 实际 ${got}`);
    return { rect, got };
  };

  // ---------- T1 搜索收窄 ----------
  out.txs.T1 = { name: '树关键字搜索', steps: [], checks: {} };
  {
    const r = await doSearch('产品公共要素');
    const n = await visCount(page, `//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]`);
    out.txs.T1.checks.visibleNodes = n;
    if (n !== 1) throw new Error('搜索后节点数≠1');
    out.txs.T1.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: '产品公共要素', rect: r.rectInput },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: r.rectIcon },
    ];
    out.txs.T1.checks.passed = true;
    log('T1 ok, nodes=', n);
  }

  // ---------- T2 折叠/展开（搜索后命中节点默认 is-expanded=true） ----------
  out.txs.T2 = { name: '树节点折叠与展开', steps: [], checks: {} };
  {
    await doSearch('产品公共要素');
    const readState = () => page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('.el-tree [role="treeitem"]'));
      const n = all.find((x) => !String(x.getAttribute('style') || '').includes('display: none'));
      return { expanded: !!n && n.className.includes('is-expanded'), aria: n && n.getAttribute('aria-expanded') };
    });
    const before = await readState();
    if (!before.expanded) throw new Error('搜索后命中节点未处于展开态');
    const icon = await single(page, XP.expandIcon, '展开箭头');
    const rect = await rectNorm(icon);
    await icon.click();
    await sleep(1500);
    const collapsed = await readState();
    if (collapsed.expanded) throw new Error('折叠失败');
    await icon.click();
    await sleep(1500);
    const reExpanded = await readState();
    if (!reExpanded.expanded) throw new Error('展开失败');
    out.txs.T2.checks = { before, collapsed, reExpanded };
    out.txs.T2.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: '产品公共要素', rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '折叠树节点', action: 'click', xpath: XP.expandIcon, value: '', rect },
      { name: '展开树节点', action: 'click', xpath: XP.expandIcon, value: '', rect },
    ];
    out.txs.T2.checks.passed = true;
    log('T2 ok', JSON.stringify(out.txs.T2.checks));
  }

  // ---------- T3 选中类型节点（公共要素根，业务编号 root1） ----------
  out.txs.T3 = { name: '树选中类型节点', steps: [], checks: {} };
  {
    await doSearch('产品公共要素');
    const r = await clickNode('产品公共要素', { expectNo: 'root1' });
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.innerText || '').trim()));
    out.txs.T3.checks = { gotNo: r.got, tabs };
    if (tabs.includes('产品要素')) throw new Error('类型节点不应出现产品要素页签');
    out.txs.T3.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: '产品公共要素', rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '选中树节点', action: 'click', xpath: XP.node, value: '', rect: r.rect },
    ];
    out.txs.T3.checks.passed = true;
    log('T3 ok', JSON.stringify(out.txs.T3.checks));
  }

  // ---------- T4 选中组件节点（渠道，业务编号取自树接口且名称唯一） ----------
  out.txs.T4 = { name: '树选中组件节点', steps: [], checks: {} };
  {
    const compName = '渠道';
    const hits = treeListBody.data.filter((g) => g.elmtGrpgNm === compName);
    out.txs.T4.checks.nameHits = hits.length;
    if (hits.length !== 1) throw new Error(`组件名称「${compName}」在树数据中不唯一: ${hits.length}`);
    const expectNo = hits[0].elmtGrpgNo;
    await doSearch(compName);
    const r = await clickNode(compName, { leaf: true, expectNo });
    const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.innerText || '').trim()));
    out.txs.T4.checks = { ...out.txs.T4.checks, expectNo, gotNo: r.got, tabs };
    if (!tabs.includes('产品要素')) throw new Error('组件节点应出现产品要素页签');
    out.txs.T4.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: compName, rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: r.rect },
      { name: '切换产品要素页签', action: 'click', xpath: XP.tabElmt, value: '', rect: await rectNorm(await single(page, XP.tabElmt, '产品要素页签')) },
    ];
    out.txs.T4.checks.passed = true;
    log('T4 ok', JSON.stringify(out.txs.T4.checks));
  }

  // ---------- T5 新增组件（父=公要素根；AT_ 数据；保存） ----------
  out.txs.T5 = { name: '树新增组件', steps: [], checks: {} };
  {
    await doSearch('产品公共要素');
    const parent = await clickNode('产品公共要素', { expectNo: 'root1' });
    const addBtn = await single(page, XP.addComp, '新增组件图标');
    const rectAdd = await rectNorm(addBtn);
    await addBtn.click();
    await sleep(2200);
    const nameInp = await single(page, XP.dlgName, '组件名称');
    const seqInp = await single(page, XP.dlgSeq, '序号');
    const rectName = await rectNorm(nameInp);
    const rectSeq = await rectNorm(seqInp);
    const autoNo = await nameInp.evaluate((el) => {
      const dlg = el.closest('.el-dialog');
      const f = dlg && Array.from(dlg.querySelectorAll('.el-form-item')).find((x) => (x.innerText || '').includes('组件编号'));
      return f ? f.querySelector('input').value : null;
    });
    await nameInp.fill(out.names.comp);
    await seqInp.fill('99');
    const saveBtn = await single(page, XP.dlgSave, '保存');
    const rectSave = await rectNorm(saveBtn);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtGrpgInf') && r.request().method() === 'POST' && !r.url().includes('/list'), { timeout: 30000 }).catch(() => null),
      saveBtn.click(),
    ]);
    const respBody = resp ? await resp.json().catch(() => null) : null;
    await sleep(3000);
    // 校验：树 API 出现该名称
    const listed = treeListBody && Array.isArray(treeListBody.data) ? treeListBody.data.find((g) => g.elmtGrpgNm === out.names.comp) : null;
    out.txs.T5.checks = { autoNo, saveUrl: resp ? resp.url().replace(BASE, '') : null, saveCode: respBody && respBody.code, listedId: listed ? listed.elmtGrpgNo : null, listedPrn: listed ? listed.prnNo : null, listedTp: listed ? listed.elmtGrpgTp : null, listedDataTp: listed ? listed.dataTp : null };
    if (!listed) throw new Error('新增组件后树数据未出现该名称');
    out.txs.T5.newNo = listed.elmtGrpgNo;
    out.txs.T5.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: '产品公共要素', rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '选中树节点', action: 'click', xpath: XP.node, value: '', rect: parent.rect },
      { name: '打开新增组件', action: 'click', xpath: XP.addComp, value: '', rect: rectAdd },
      { name: '输入组件名称', action: 'input', xpath: XP.dlgName, value: out.names.comp, rect: rectName, popup: true },
      { name: '输入序号', action: 'input', xpath: XP.dlgSeq, value: '99', rect: rectSeq, popup: true },
      { name: '保存组件', action: 'click', xpath: XP.dlgSave, value: '', rect: rectSave, popup: true },
    ];
    out.txs.T5.checks.passed = true;
    log('T5 ok', JSON.stringify(out.txs.T5.checks));
  }

  // ---------- T6 删除组件（自清理，确认框） ----------
  out.txs.T6 = { name: '树删除组件', steps: [], checks: {} };
  {
    await doSearch(out.names.comp);
    const r = await clickNode(out.names.comp, { leaf: true, expectNo: out.txs.T5.newNo });
    const delBtn = await single(page, XP.delNode, '删除图标');
    const rectDel = await rectNorm(delBtn);
    await delBtn.click();
    await sleep(2000);
    const mbText = await page.locator(`xpath=//div[contains(@class,'el-message-box')]`).filter({ visible: true }).first().innerText().catch(() => '');
    const ok = await single(page, XP.mbOk, '确认删除按钮');
    const rectOk = await rectNorm(ok);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtGrpgInf') && r.request().method() === 'POST' && !r.url().includes('/list'), { timeout: 30000 }).catch(() => null),
      ok.click(),
    ]);
    const respBody = resp ? await resp.json().catch(() => null) : null;
    await sleep(3000);
    const still = treeListBody && Array.isArray(treeListBody.data) ? treeListBody.data.find((g) => g.elmtGrpgNm === out.names.comp) : null;
    out.txs.T6.checks = { gotNo: r.got, confirmText: (mbText || '').replace(/\s+/g, ' ').trim().slice(0, 100), delUrl: resp ? resp.url().replace(BASE, '') : null, delCode: respBody && respBody.code, stillExists: !!still };
    if (still) throw new Error('删除后树数据仍存在该名称');
    out.txs.T6.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: out.names.comp, rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: r.rect },
      { name: '打开删除确认', action: 'click', xpath: XP.delNode, value: '', rect: rectDel },
      { name: '确认删除', action: 'click', xpath: XP.mbOk, value: '', rect: rectOk, popup: true },
    ];
    out.txs.T6.checks.passed = true;
    log('T6 ok', JSON.stringify(out.txs.T6.checks));
  }

  // ---------- T7 新增类型（父=唯一命名的个性化要素类型；搜索保留祖先链→叶子结构消歧） ----------
  out.txs.T7 = { name: '树新增类型', steps: [], checks: {} };
  {
    const parentName = 'KB测要素类型-20261023-elem';
    const hits = treeListBody.data.filter((g) => g.elmtGrpgNm === parentName && g.elmtGrpgTp === '0' && g.dataTp === '0');
    out.txs.T7.checks.nameHits = hits.length;
    if (hits.length !== 1) throw new Error(`个性化类型「${parentName}」不唯一: ${hits.length}`);
    const parentNo = hits[0].elmtGrpgNo;
    await doSearch(parentName);
    const all = await visCount(page, `//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]`);
    const leaf = await visCount(page, `//div[contains(@class,'el-tree')]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`);
    out.txs.T7.checks = { ...out.txs.T7.checks, allVisible: all, leafVisible: leaf };
    if (!(all > 1 && leaf === 1)) throw new Error(`叶子结构消歧失败 all=${all} leaf=${leaf}`);
    const parent = await clickNode(parentName, { leaf: true, expectNo: parentNo });
    const addBtn = await single(page, XP.addType, '新增类型图标');
    const rectAdd = await rectNorm(addBtn);
    await addBtn.click();
    await sleep(2200);
    const nameInp = await single(page, XP.dlgName, '组件名称');
    const seqInp = await single(page, XP.dlgSeq, '序号');
    const rectName = await rectNorm(nameInp);
    const rectSeq = await rectNorm(seqInp);
    await nameInp.fill(out.names.type);
    await seqInp.fill('98');
    const saveBtn = await single(page, XP.dlgSave, '保存');
    const rectSave = await rectNorm(saveBtn);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtGrpgInf') && r.request().method() === 'POST' && !r.url().includes('/list'), { timeout: 30000 }).catch(() => null),
      saveBtn.click(),
    ]);
    const respBody = resp ? await resp.json().catch(() => null) : null;
    await sleep(3000);
    const listed = treeListBody && Array.isArray(treeListBody.data) ? treeListBody.data.find((g) => g.elmtGrpgNm === out.names.type) : null;
    out.txs.T7.checks = { ...out.txs.T7.checks, parentNo, gotParentNo: parent.got, saveUrl: resp ? resp.url().replace(BASE, '') : null, saveCode: respBody && respBody.code, listedId: listed ? listed.elmtGrpgNo : null, listedTp: listed ? listed.elmtGrpgTp : null, listedDataTp: listed ? listed.dataTp : null, listedPrn: listed ? listed.prnNo : null };
    if (!listed) throw new Error('新增类型后树数据未出现该名称');
    out.txs.T7.newNo = listed.elmtGrpgNo;
    out.txs.T7.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: parentName, rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: parent.rect },
      { name: '打开新增类型', action: 'click', xpath: XP.addType, value: '', rect: rectAdd },
      { name: '输入分类名称', action: 'input', xpath: XP.dlgName, value: out.names.type, rect: rectName, popup: true },
      { name: '输入序号', action: 'input', xpath: XP.dlgSeq, value: '98', rect: rectSeq, popup: true },
      { name: '保存类型', action: 'click', xpath: XP.dlgSave, value: '', rect: rectSave, popup: true },
    ];
    out.txs.T7.checks.passed = true;
    log('T7 ok', JSON.stringify(out.txs.T7.checks));
  }

  // ---------- T8 删除类型（自清理） ----------
  out.txs.T8 = { name: '树删除类型', steps: [], checks: {} };
  {
    await doSearch(out.names.type);
    const r = await clickNode(out.names.type, { leaf: true, expectNo: out.txs.T7.newNo });
    const delBtn = await single(page, XP.delNode, '删除图标');
    const rectDel = await rectNorm(delBtn);
    await delBtn.click();
    await sleep(2000);
    const ok = await single(page, XP.mbOk, '确认删除按钮');
    const rectOk = await rectNorm(ok);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtGrpgInf') && r.request().method() === 'POST' && !r.url().includes('/list'), { timeout: 30000 }).catch(() => null),
      ok.click(),
    ]);
    const respBody = resp ? await resp.json().catch(() => null) : null;
    await sleep(3000);
    const still = treeListBody && Array.isArray(treeListBody.data) ? treeListBody.data.find((g) => g.elmtGrpgNm === out.names.type) : null;
    out.txs.T8.checks = { gotNo: r.got, delUrl: resp ? resp.url().replace(BASE, '') : null, delCode: respBody && respBody.code, stillExists: !!still };
    if (still) throw new Error('删除后树数据仍存在该类型');
    out.txs.T8.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: out.names.type, rect: await rectNorm(await single(page, XP.searchInput, '搜索框')) },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: await rectNorm(await single(page, XP.searchIcon, '搜索图标')) },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: r.rect },
      { name: '打开删除确认', action: 'click', xpath: XP.delNode, value: '', rect: rectDel },
      { name: '确认删除', action: 'click', xpath: XP.mbOk, value: '', rect: rectOk, popup: true },
    ];
    out.txs.T8.checks.passed = true;
    log('T8 ok', JSON.stringify(out.txs.T8.checks));
  }

  out.ok = true;
  save();
  console.log('ALL_OK');
  await browser.close();
})().catch((e) => {
  console.error('ERR', e);
  out.error = e.message;
  save();
  process.exit(1);
});
