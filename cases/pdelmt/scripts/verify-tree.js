// verify-tree.js - 回放后置校验：结构锚定选中 + 业务编号比对 + AT_ 残留清理确认
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
  nodeLeaf: `//div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]`,
  basicNo: `//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件编号']]//input`,
  tabElmt: `//div[contains(@class,'el-tabs__item')][normalize-space()='产品要素']`,
};
const single = async (page, xpath, label) => {
  const loc = page.locator(`xpath=${xpath}`);
  const all = await loc.count();
  const vis = await loc.filter({ visible: true }).count();
  if (all !== 1 || vis !== 1) throw new Error(`${label}: total=${all} visible=${vis}（要求恰好 1）`);
  return loc.first();
};

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let tree = null;
  let lastQuery = null;
  page.on('response', async (r) => {
    const u = r.url();
    try {
      if (u.includes('prodElmtGrpgInf/list')) tree = JSON.parse(await r.text());
      if (u.includes('prodElmtInf/query')) lastQuery = JSON.parse(await r.text());
    } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3500);

  const results = [];
  const check = (name, cond, detail) => { results.push({ name, ok: !!cond, detail }); if (!cond) throw new Error(`${name} 失败: ${detail}`); };

  // 1. AT_ 残留清理确认（回放 T6/T8 已删）
  const at = (tree.data || []).filter((g) => /^AT_(TREE|TYPE)_/.test(g.elmtGrpgNm));
  check('AT_ 测试节点净零', at.length === 0, JSON.stringify(at.map((x) => x.elmtGrpgNm)));

  // 2. 固定业务标识存在
  const byNo = new Map((tree.data || []).map((g) => [g.elmtGrpgNo, g]));
  check('公共要素根 root1 存在', byNo.has('root1'), 'root1');
  check('组件 ZJLX2066（渠道）存在', byNo.get('ZJLX2066') && byNo.get('ZJLX2066').elmtGrpgNm === '渠道', JSON.stringify(byNo.get('ZJLX2066')));
  check('个性化类型 ZJLX6083 存在', byNo.get('ZJLX6083') && byNo.get('ZJLX6083').elmtGrpgTp === '0', JSON.stringify(byNo.get('ZJLX6083')));

  const search = async (q) => {
    const inp = await single(page, XP.searchInput, '搜索框');
    await inp.fill(q);
    const icon = await single(page, XP.searchIcon, '搜索图标');
    await icon.click();
    await sleep(2200);
  };

  // 3. 类型节点选中 → 组件编号 root1，且无产品要素页签
  await search('产品公共要素');
  let node = await single(page, XP.node, '根节点');
  await node.click();
  await sleep(2400);
  let no = await (await single(page, XP.basicNo, '组件编号')).inputValue();
  check('选中根节点编号', no === 'root1', no);
  check('类型节点无产品要素页签', (await page.locator(`xpath=${XP.tabElmt}`).filter({ visible: true }).count()) === 0, 'tabs');

  // 4. 组件节点选中 → 编号 + 产品要素页签 + 列表接口 elmtGrpgNo 一致
  await search('渠道');
  node = await single(page, XP.nodeLeaf, '组件节点');
  await node.click();
  await sleep(2600);
  no = await (await single(page, XP.basicNo, '组件编号')).inputValue();
  check('选中组件编号', no === 'ZJLX2066', no);
  check('组件节点有产品要素页签', (await page.locator(`xpath=${XP.tabElmt}`).filter({ visible: true }).count()) === 1, 'tabs');
  check('选中后列表接口 elmtGrpgNo 一致', lastQuery && lastQuery.data && lastQuery.data.list && lastQuery.data.list.every((r) => r.elmtGrpgNo === 'ZJLX2066'), JSON.stringify(lastQuery && lastQuery.data && lastQuery.data.list && lastQuery.data.list[0]));

  console.log(JSON.stringify(results, null, 2));
  console.log('VERIFY_OK');
  await browser.close();
})().catch((e) => { console.error('VERIFY_FAIL', e.message); process.exit(1); });
