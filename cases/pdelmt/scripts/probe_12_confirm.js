// probe_12_confirm.js - 数据字典联动/选项范围、树删除确认、树搜索、行删除确认
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_12_out.json');
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
    try { const txt = await r.text(); const j = JSON.parse(txt); out.apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 400), code: j && j.code, body: txt.length < 150000 ? j : null }); save(); } catch {}
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
  const dumpMsgs = () => page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box, .el-dialog')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300), buttons: Array.from(e.querySelectorAll('button')).map((b) => (b.innerText || '').replace(/\\s+/g, '')) }));
  })()`);
  const closeAll = async () => {
    for (let i = 0; i < 4; i++) {
      const mb = page.locator('.el-message-box:visible button').filter({ hasText: /取\s*消|Cancel/ });
      if (await mb.count()) { await mb.first().click({ force: true }).catch(() => {}); await sleep(700); continue; }
      const dg = page.locator('.el-dialog:visible button').filter({ hasText: /取\s*消/ });
      if (await dg.count()) { await dg.first().click({ force: true }).catch(() => {}); await sleep(700); continue; }
      break;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(600);
  };
  const tabElmt = async () => { await page.click('#tab-second'); await sleep(2800); };

  // 1) 新增 → 下拉数据字典 → 选数据字典（force）→ 看选项范围
  log('click 年龄限制=', await clickTree('年龄限制'));
  await tabElmt();
  await page.locator('button:visible').filter({ hasText: /^新\s*增$/ }).first().click({ force: true });
  await sleep(2500);
  const tp = page.locator('.el-dialog:visible .el-form-item').filter({ hasText: '要素类型' }).locator('input').first();
  await tp.click({ force: true }); await sleep(1200);
  await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: /^下拉数据字典$/ }).first().click({ force: true });
  await sleep(2200);
  const dctInp = page.locator('.el-dialog:visible .el-form-item').filter({ hasText: '数据字典' }).locator('input').first();
  await dctInp.click({ force: true }); await sleep(2200);
  const firstOpt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first();
  out.pickDct = await firstOpt.innerText().catch(() => null);
  await firstOpt.evaluate((el) => el.click()).catch(async () => { await firstOpt.click({ force: true }); });
  await sleep(2800);
  out.afterDct = await page.evaluate(`(() => { const vis = ${VIS}; const dg = Array.from(document.querySelectorAll('.el-dialog')).filter(vis)[0];
    return dg ? { items: Array.from(dg.querySelectorAll('.el-form-item')).map((f) => { const lb = f.querySelector('.el-form-item__label, label'); const inp = f.querySelector('input,textarea'); return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, dis: inp ? inp.disabled : null, ctrl: f.querySelector('.el-select') ? 'select' : inp ? 'input' : 'other' }; }), tables: Array.from(dg.querySelectorAll('.el-table')).map((t) => ({ heads: Array.from(t.querySelectorAll('th .cell')).map((h) => (h.innerText || '').trim()), rows: t.querySelectorAll('tbody tr').length })), text: (dg.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 600), html: dg.outerHTML.slice(0, 20000) } : null;
  })()`);
  save(); log('AFTER_DCT=', JSON.stringify(out.afterDct && { items: out.afterDct.items, tables: out.afterDct.tables, text: out.afterDct.text }));
  if (out.afterDct) fs.writeFileSync(path.join(DIR, 'dlg_after_dct.html'), out.afterDct.html);
  await closeAll();

  // 2) 树删除：叶子 产品相关标志
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

  // 3) 树搜索
  const s = page.locator('input.search-input');
  await s.fill('利率'); await page.keyboard.press('Enter'); await sleep(2800);
  out.searchFilter = await page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-tree-node__content')).filter(vis).map((c) => (c.innerText || '').replace(/\\s+/g, ' ').trim());
  })()`);
  save(); log('SEARCH=', JSON.stringify(out.searchFilter));
  await s.fill(''); await page.keyboard.press('Enter'); await sleep(1500);

  // 4) 行删除确认（组件 11）
  log('expand 产品公共要素=', await expandTree('产品公共要素'));
  log('click 11=', await clickTree('11'));
  out.tabs11 = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()));
  save(); log('TABS_11=', JSON.stringify(out.tabs11));
  if (out.tabs11.includes('产品要素')) {
    await tabElmt();
    out.rows11 = await page.evaluate(() => Array.from(document.querySelectorAll('.el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim())));
    save(); log('ROWS_11=', JSON.stringify(out.rows11.slice(0, 6)));
    const n = await page.locator('.el-table__body-wrapper tbody tr').count();
    for (let i = 0; i < Math.min(n, 4); i++) {
      await page.locator('.el-table__body-wrapper tbody tr').nth(i).locator('td').first().click({ force: true });
      await sleep(800);
      await page.locator('button:visible').filter({ hasText: /^删\s*除$/ }).first().click({ force: true });
      await sleep(2400);
      const msgs = await dumpMsgs();
      out['delRow' + i] = msgs; save();
      log('DEL_ROW' + i + '=', JSON.stringify(msgs));
      await closeAll();
      if (msgs.some((m) => m.cls.includes('el-message-box'))) break;
    }
  }

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
