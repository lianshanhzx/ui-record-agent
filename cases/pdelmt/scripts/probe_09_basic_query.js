// probe_09_basic_query.js - 基本信息字段细节 / 要素类型联动 / 查询重置 / 树删除确认 / 树搜索（只读）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_09_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], apis: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };
const VIS = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try {
      const txt = await r.text(); const j = JSON.parse(txt);
      out.apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 400), code: j && j.code, body: txt.length < 150000 ? j : null });
      save();
    } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await page.waitForTimeout(3000);

  const clickTree = async (label) => {
    const r = await page.evaluate((label) => {
      const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
      const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === label.replace(/\s+/g, ''));
      if (!hit) return false;
      hit.scrollIntoView({ block: 'center' }); hit.click(); return true;
    }, label);
    await sleep(2600); return r;
  };
  const expandTree = async (label) => {
    const r = await page.evaluate((label) => {
      const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
      const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === label.replace(/\s+/g, ''));
      if (!hit) return false;
      const ic = hit.querySelector('.el-tree-node__expand-icon'); if (!ic) return false; ic.click(); return true;
    }, label);
    await sleep(2200); return r;
  };
  const dumpBasic = () => page.evaluate(`(() => { const vis = ${VIS};
    const fs_ = Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => {
      const lb = f.querySelector('.el-form-item__label, label');
      const inp = f.querySelector('input,textarea');
      return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, ro: inp ? inp.readOnly : null, dis: inp ? inp.disabled : null,
        ctrl: (() => { const s = f.querySelector('.el-select'); const d = f.querySelector('.el-date-editor'); const t = f.querySelector('.el-input'); return s ? 'select' : d ? 'date' : t ? 'input' : 'other'; })(),
        html: f.outerHTML.slice(0, 900) };
    });
    const btns = Array.from(document.querySelectorAll('button')).filter(vis).map((b) => ({ t: (b.innerText || '').replace(/\\s+/g, ''), dis: b.disabled, cls: String(b.className).slice(0, 80) }));
    const tabs = Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => (e.innerText || '').trim());
    return { tabs, fs: fs_, btns };
  })()`);
  const dumpMsgs = () => page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box, .el-dialog')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300), buttons: Array.from(e.querySelectorAll('button')).map((b) => (b.innerText || '').replace(/\\s+/g, '')) }));
  })()`);
  const closeAll = async () => {
    for (let i = 0; i < 3; i++) {
      const mb = page.locator('.el-message-box:visible button', { hasText: /取\s*消/ });
      if (await mb.count()) { await mb.first().click().catch(() => {}); await sleep(700); continue; }
      const dg = page.locator('.el-dialog:visible button', { hasText: /取\s*消/ });
      if (await dg.count()) { await dg.first().click().catch(() => {}); await sleep(700); continue; }
      break;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(600);
  };

  // A. 类型节点基本信息
  log('click 产品个性化要素=', await clickTree('产品个性化要素'));
  out.basicType = await dumpBasic(); save();
  log('BASIC_TYPE=', JSON.stringify({ tabs: out.basicType.tabs, fs: out.basicType.fs.map((f) => f.label + '=' + f.val + '|' + f.ctrl + '|dis' + f.dis), btns: out.basicType.btns }));

  // B. 组件节点基本信息
  log('click 年龄限制=', await clickTree('年龄限制'));
  out.basicComp = await dumpBasic(); save();
  log('BASIC_COMP=', JSON.stringify({ tabs: out.basicComp.tabs, fs: out.basicComp.fs.map((f) => f.label + '=' + f.val + '|' + f.ctrl + '|dis' + f.dis), btns: out.basicComp.btns }));

  // C. 产品要素 → 新增 → 要素类型联动
  await page.locator('.el-tabs__item', { hasText: /产品要素/ }).first().click();
  await sleep(3000);
  await page.locator('button:visible').filter({ hasText: /^新\s*增$/ }).first().click({ force: true });
  await sleep(2500);
  const pickType = async (label) => {
    const tp = page.locator('.el-dialog:visible .el-form-item').filter({ hasText: '要素类型' }).locator('input').first();
    await tp.click({ force: true });
    await sleep(1200);
    const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: new RegExp('^' + label + '$') }).first();
    await opt.click({ force: true });
    await sleep(2200);
    const d = await page.evaluate(`(() => { const vis = ${VIS}; const dg = Array.from(document.querySelectorAll('.el-dialog')).filter(vis)[0];
      return dg ? { items: Array.from(dg.querySelectorAll('.el-form-item')).map((f) => { const lb = f.querySelector('.el-form-item__label, label'); const inp = f.querySelector('input,textarea'); return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, dis: inp ? inp.disabled : null, req: (f.className + ' ' + (lb ? lb.className : '')).includes('is-required') }; }), text: (dg.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400) } : null;
    })()`);
    return d;
  };
  out.typeDct = await pickType('下拉数据字典'); save();
  log('TYPE_DCT=', JSON.stringify(out.typeDct));
  out.typeList = await pickType('列表'); save();
  log('TYPE_LIST=', JSON.stringify(out.typeList));
  await closeAll();

  // D. 查询/重置
  const qInputs = page.locator('.el-form input, .search input').filter({ hasNot: page.locator('.el-pagination input') });
  const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__content input, .el-form--inline input')).filter((i) => i.getBoundingClientRect().height > 0 && !i.readOnly).map((i) => ({ ph: i.placeholder, rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })));
  out.queryInputs = inputs; save(); log('QUERY_INPUTS=', JSON.stringify(inputs));
  const codeInp = page.locator('input[placeholder="请输入"]').first();
  await codeInp.fill('age');
  await sleep(500);
  await page.locator('button:visible').filter({ hasText: /^查\s*询$/ }).first().click({ force: true });
  await sleep(2500);
  out.afterQuery = await page.evaluate(() => Array.from(document.querySelectorAll('.el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim())));
  save(); log('AFTER_QUERY_ROWS=', JSON.stringify(out.afterQuery));
  await page.locator('button:visible').filter({ hasText: /^重\s*置$/ }).first().click({ force: true });
  await sleep(2200);
  out.afterReset = await page.evaluate(() => ({ codeVal: document.querySelector('input[placeholder="请输入"]') ? document.querySelector('input[placeholder="请输入"]').value : null, rows: document.querySelectorAll('.el-table__body-wrapper tbody tr').length }));
  save(); log('AFTER_RESET=', JSON.stringify(out.afterReset));

  // E. 树删除（叶子组件 产品相关标志）→ 确认框
  log('click 产品相关标志=', await clickTree('产品相关标志'));
  const tips = [];
  for (let i = 0; i < await page.locator('.shrink-button-group a').count(); i++) {
    await page.locator('.shrink-button-group a').nth(i).hover({ timeout: 4000 }).catch(() => {});
    await sleep(800);
    tips.push(await page.evaluate(`(() => { const vis = ${VIS}; const ps = Array.from(document.querySelectorAll('.el-tooltip__popper')).filter(vis); return ps.length ? (ps[ps.length - 1].innerText || '').trim() : null; })()`));
  }
  out.toolbarLeaf = tips; save(); log('TOOLBAR_LEAF=', JSON.stringify(tips));
  const delIdx = tips.findIndex((t) => (t || '').includes('删除'));
  if (delIdx >= 0) {
    await page.locator('.shrink-button-group a').nth(delIdx).click({ force: true });
    await sleep(2500);
    out.treeDelLeaf = await dumpMsgs(); save(); log('TREE_DEL_LEAF=', JSON.stringify(out.treeDelLeaf));
    await closeAll();
  }

  // F. 树搜索过滤
  const s = page.locator('input.search-input');
  await s.fill('利率');
  await page.keyboard.press('Enter');
  await sleep(2500);
  out.searchFilter = await page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-tree-node__content')).filter(vis).map((c) => (c.innerText || '').replace(/\\s+/g, ' ').trim());
  })()`);
  save(); log('SEARCH_FILTER=', JSON.stringify(out.searchFilter));
  await s.fill('');
  await page.keyboard.press('Enter');
  await sleep(1500);

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
