// probe_24_basic.js - 基本信息 B1 查看 / B2 改名称保存 / B3 改序号保存 / B4 保存校验（固定 fixture AT_BASE_LIST）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'record_basic_out.json');
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
  basicNo: `//div[@id='pane-first']//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件编号']]//input`,
  basicName: `//div[@id='pane-first']//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件名称']]//input`,
  basicSeq: `//div[@id='pane-first']//div[contains(@class,'el-form-item')][.//label[normalize-space()='序号']]//input`,
  saveBtn: `//div[@id='pane-first']//button[translate(normalize-space(.),' ','')='保存']`,
};
const rectNorm = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('no bbox'); return { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) }; };
const single = async (page, xp, label) => {
  const loc = page.locator(`xpath=${xp}`); const all = await loc.count(); const vis = await loc.filter({ visible: true }).count();
  if (all !== 1 || vis !== 1) throw new Error(`${label}: total=${all} visible=${vis}（要求 1）`);
  return loc.first();
};
const msgs = (page) => page.evaluate(`(() => { const vis = ${VIS};
  return Array.from(document.querySelectorAll('.el-message, .el-notification')).filter(vis).map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim()); })()`);

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    if (!r.url().includes('prodElmtGrpgInf')) return;
    try { out.lastApi = { url: r.url().replace(BASE, ''), code: (await r.json()).code }; save(); } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await sleep(3000);

  const selectFixture = async () => {
    const rInp = await rectNorm(await single(page, XP.searchInput, '搜索框'));
    await page.locator(`xpath=${XP.searchInput}`).fill('AT_BASE_LIST');
    const rIcon = await rectNorm(await single(page, XP.searchIcon, '搜索图标'));
    await page.locator(`xpath=${XP.searchIcon}`).click({ force: true });
    await sleep(2200);
    const node = await single(page, XP.nodeLeaf, 'fixture 节点');
    const rNode = await rectNorm(node);
    await node.click();
    await sleep(2600);
    return { rInp, rIcon, rNode };
  };
  const read = async () => ({ no: await page.locator(`xpath=${XP.basicNo}`).first().inputValue(), nm: await page.locator(`xpath=${XP.basicName}`).first().inputValue(), seq: await page.locator(`xpath=${XP.basicSeq}`).first().inputValue() });

  // B1 查看
  out.txs.B1 = { name: '基本信息查看', steps: [], checks: {} };
  const s1 = await selectFixture();
  {
    const before = await read();
    out.txs.B1.checks = before;
    if (before.no !== 'ZJLX6132') throw new Error('组件编号不符: ' + JSON.stringify(before));
    out.txs.B1.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: 'AT_BASE_LIST', rect: s1.rInp },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: s1.rIcon },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: s1.rNode },
    ];
    out.txs.B1.checks.passed = true; log('B1 ok', JSON.stringify(before));
  }

  // B2 修改组件名称 → 保存
  out.txs.B2 = { name: '基本信息修改名称', steps: [], checks: {} };
  {
    const s2 = await selectFixture();
    const nmInp = await single(page, XP.basicName, '组件名称');
    const rectNm = await rectNorm(nmInp);
    const cur = await nmInp.inputValue();
    const target = 'AT_BASE_LIST_N';
    await nmInp.fill(target);
    const saveBtn = await single(page, XP.saveBtn, '保存');
    const rectSave = await rectNorm(saveBtn);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtGrpgInf') && r.request().method() === 'POST' && !r.url().includes('/list'), { timeout: 30000 }).catch(() => null),
      saveBtn.click(),
    ]);
    const body = resp ? await resp.json().catch(() => null) : null;
    await sleep(2500);
    const after = await read();
    const ms = await msgs(page);
    out.txs.B2.checks = { before: cur, target, after, saveUrl: resp ? resp.url().replace(BASE, '') : null, saveCode: body && (body.code ?? body.status), msgs: ms };
    if (after.nm !== target) throw new Error('名称保存后未生效: ' + JSON.stringify(after));
    out.txs.B2.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: 'AT_BASE_LIST', rect: s2.rInp },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: s2.rIcon },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: s2.rNode },
      { name: '输入组件名称', action: 'input', xpath: XP.basicName, value: target, rect: rectNm },
      { name: '保存基本信息', action: 'click', xpath: XP.saveBtn, value: '', rect: rectSave },
    ];
    out.txs.B2.checks.passed = true; log('B2 ok', JSON.stringify(out.txs.B2.checks));
  }

  // B3 修改序号 → 保存
  out.txs.B3 = { name: '基本信息修改序号', steps: [], checks: {} };
  {
    const s3 = await selectFixture();
    const seqInp = await single(page, XP.basicSeq, '序号');
    const rectSeq = await rectNorm(seqInp);
    const cur = await seqInp.inputValue();
    await seqInp.fill('88');
    const saveBtn = await single(page, XP.saveBtn, '保存');
    const rectSave = await rectNorm(saveBtn);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('prodElmtGrpgInf') && r.request().method() === 'POST' && !r.url().includes('/list'), { timeout: 30000 }).catch(() => null),
      saveBtn.click(),
    ]);
    const body = resp ? await resp.json().catch(() => null) : null;
    await sleep(2500);
    const after = await read();
    out.txs.B3.checks = { before: cur, target: '88', after, saveUrl: resp ? resp.url().replace(BASE, '') : null, saveCode: body && (body.code ?? body.status) };
    if (String(after.seq) !== '88') throw new Error('序号保存后未生效: ' + JSON.stringify(after));
    out.txs.B3.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: 'AT_BASE_LIST', rect: s3.rInp },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: s3.rIcon },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: s3.rNode },
      { name: '输入序号', action: 'input', xpath: XP.basicSeq, value: '88', rect: rectSeq },
      { name: '保存基本信息', action: 'click', xpath: XP.saveBtn, value: '', rect: rectSave },
    ];
    out.txs.B3.checks.passed = true; log('B3 ok', JSON.stringify(out.txs.B3.checks));
  }

  // B4 保存校验（名称空 / 序号空 / 序号非数字），全部被拦截，不改数据
  out.txs.B4 = { name: '基本信息保存校验', steps: [], checks: {} };
  {
    const s4 = await selectFixture();
    const nmInp = await single(page, XP.basicName, '组件名称');
    const seqInp = await single(page, XP.basicSeq, '序号');
    const curNm = await nmInp.inputValue();
    const curSeq = await seqInp.inputValue();
    const saveBtn = await single(page, XP.saveBtn, '保存');
    const rectNm = await rectNorm(nmInp); const rectSeq = await rectNorm(seqInp); const rectSave = await rectNorm(saveBtn);
    await nmInp.fill('');
    await saveBtn.click();
    await sleep(1600);
    const msgEmptyNm = await msgs(page);
    await nmInp.fill(curNm);
    await seqInp.fill('');
    await saveBtn.click();
    await sleep(1600);
    const msgEmptySeq = await msgs(page);
    await seqInp.fill('abc');
    await saveBtn.click();
    await sleep(1600);
    const msgBadSeq = await msgs(page);
    await seqInp.fill(curSeq);
    await sleep(600);
    out.txs.B4.checks = { curNm, curSeq, msgEmptyNm, msgEmptySeq, msgBadSeq };
    if (!msgEmptyNm.some((t) => t.includes('必填'))) throw new Error('名称空未提示');
    if (!msgBadSeq.some((t) => t.includes('数字'))) throw new Error('序号非数字未提示');
    out.txs.B4.steps = [
      { name: '输入树搜索关键字', action: 'input', xpath: XP.searchInput, value: 'AT_BASE_LIST', rect: s4.rInp },
      { name: '点击树搜索', action: 'click', xpath: XP.searchIcon, value: '', rect: s4.rIcon },
      { name: '选中树节点', action: 'click', xpath: XP.nodeLeaf, value: '', rect: s4.rNode },
      { name: '清空组件名称', action: 'input', xpath: XP.basicName, value: '', rect: rectNm },
      { name: '保存基本信息', action: 'click', xpath: XP.saveBtn, value: '', rect: rectSave },
      { name: '输入序号非法值', action: 'input', xpath: XP.basicSeq, value: 'abc', rect: rectSeq },
      { name: '保存基本信息', action: 'click', xpath: XP.saveBtn, value: '', rect: rectSave },
    ];
    out.txs.B4.checks.passed = true; log('B4 ok', JSON.stringify(out.txs.B4.checks));
  }

  out.ok = true; save(); console.log('ALL_OK');
  await browser.close();
})().catch((e) => { console.error('ERR', e); out.error = e.message; save(); process.exit(1); });
