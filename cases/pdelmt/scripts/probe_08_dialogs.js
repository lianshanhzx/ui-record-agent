// probe_08_dialogs.js - 新增/修改 向导两步 + 删除确认 + 树弹窗/删除校验（只读，全部取消）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_08_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], apis: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };

const VIS_FN = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try {
      const txt = await r.text();
      const j = JSON.parse(txt);
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

  // 可见提示/弹窗（fixed 元素 offsetParent 为 null，必须用 rect 判定）
  const dumpMsgs = () => page.evaluate(`(() => { const vis = ${VIS_FN};
    const els = Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box, .el-dialog')).filter(vis);
    return els.map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400), buttons: Array.from(e.querySelectorAll('button')).map((b) => (b.innerText || '').replace(/\\s+/g, '')) }));
  })()`);

  const dumpDialog = () => page.evaluate(`(() => { const vis = ${VIS_FN};
    const d = Array.from(document.querySelectorAll('.el-dialog')).filter(vis)[0];
    if (!d) return null;
    const items = Array.from(d.querySelectorAll('.el-form-item')).map((f) => {
      const lb = f.querySelector('.el-form-item__label, label');
      const inp = f.querySelector('input,textarea');
      return { label: lb ? (lb.innerText || '').trim() : '', ph: inp ? inp.placeholder : null, val: inp ? inp.value : null, ro: inp ? inp.readOnly : null, dis: inp ? inp.disabled : null, req: (f.className + ' ' + (lb ? lb.className : '')).includes('is-required'), select: !!f.querySelector('.el-select') };
    });
    return { header: (d.querySelector('.el-dialog__header') || {}).innerText ? d.querySelector('.el-dialog__header').innerText.replace(/\\s+/g, ' ').trim() : null,
      items, buttons: Array.from(d.querySelectorAll('button')).filter(vis).map((b) => ({ t: (b.innerText || '').replace(/\\s+/g, ''), dis: b.disabled })),
      text: (d.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 800), html: d.outerHTML.slice(0, 20000) };
  })()`);

  const closeAll = async () => {
    // 关闭可见 message-box 取消 / dialog 取消或右上角 x
    for (let i = 0; i < 3; i++) {
      const mb = page.locator('.el-message-box:visible button', { hasText: /取\s*消/ });
      if (await mb.count()) { await mb.first().click().catch(() => {}); await sleep(700); continue; }
      const dg = page.locator('.el-dialog:visible button', { hasText: /取\s*消/ });
      if (await dg.count()) { await dg.first().click().catch(() => {}); await sleep(700); continue; }
      const x = page.locator('.el-dialog:visible .el-dialog__headerbtn');
      if (await x.count()) { await x.first().click().catch(() => {}); await sleep(700); continue; }
      break;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(800);
  };

  const clickBtn = async (t) => {
    await page.locator('button:visible').filter({ hasText: new RegExp('^' + t.split('').join('\\s*') + '$') }).first().click({ force: true });
    await sleep(2000);
  };

  log('click 年龄限制=', await clickTree('年龄限制'));
  await page.locator('.el-tabs__item', { hasText: /产品要素/ }).first().click();
  await sleep(3000);

  // 1) 未选行：修改
  await clickBtn('修改');
  out.noRowModify = await dumpMsgs(); save(); log('NOROW_MODIFY=', JSON.stringify(out.noRowModify));
  await closeAll();
  // 未选行：删除
  await clickBtn('删除');
  out.noRowDelete = await dumpMsgs(); save(); log('NOROW_DELETE=', JSON.stringify(out.noRowDelete));
  await closeAll();

  // 2) 选第一行
  const row = page.locator('.el-table__body-wrapper tbody tr').first();
  await row.locator('td').first().click({ force: true });
  await sleep(1200);
  out.rowChecked = await page.evaluate(() => {
    const tr = document.querySelector('.el-table__body-wrapper tbody tr');
    const r = tr && tr.querySelector('.el-radio');
    return { cls: r ? r.className : null, checked: r ? r.classList.contains('is-checked') || !!tr.querySelector('.el-radio__input.is-checked') : null };
  }); save(); log('ROW_CHECKED=', JSON.stringify(out.rowChecked));

  // 3) 修改 → 弹窗 step1
  await clickBtn('修改');
  out.dlgModify1 = await dumpDialog(); save();
  log('MODIFY1=', JSON.stringify(out.dlgModify1 && { header: out.dlgModify1.header, items: out.dlgModify1.items, buttons: out.dlgModify1.buttons, text: out.dlgModify1.text }));
  fs.writeFileSync(path.join(DIR, 'dlg_modify1.html'), out.dlgModify1 ? out.dlgModify1.html : '');

  // 点“下一页”（wizard 下一步）
  const next = page.locator('.el-dialog:visible button:visible').filter({ hasText: /下\s*一\s*页/ });
  if (await next.count()) {
    await next.first().click({ force: true });
    await sleep(2500);
    out.dlgModify2 = await dumpDialog(); save();
    log('MODIFY2=', JSON.stringify(out.dlgModify2 && { header: out.dlgModify2.header, items: out.dlgModify2.items, buttons: out.dlgModify2.buttons, text: out.dlgModify2.text }));
    fs.writeFileSync(path.join(DIR, 'dlg_modify2.html'), out.dlgModify2 ? out.dlgModify2.html : '');
  }
  await closeAll();

  // 4) 新增 → step1，打开要素名称下拉搜索
  await clickBtn('新增');
  out.dlgAdd1 = await dumpDialog(); save();
  log('ADD1=', JSON.stringify(out.dlgAdd1 && { header: out.dlgAdd1.header, items: out.dlgAdd1.items, buttons: out.dlgAdd1.buttons, text: out.dlgAdd1.text }));
  fs.writeFileSync(path.join(DIR, 'dlg_add1.html'), out.dlgAdd1 ? out.dlgAdd1.html : '');

  const nmInp = page.locator('.el-dialog:visible .el-form-item').filter({ hasText: '要素名称' }).locator('input').first();
  if (await nmInp.count()) {
    await nmInp.click({ force: true });
    await sleep(1200);
    await nmInp.fill('年龄');
    await page.keyboard.press('Enter');
    await sleep(2500);
    out.addNmDropdown = await page.evaluate(`(() => { const vis = ${VIS_FN};
      return Array.from(document.querySelectorAll('.el-select-dropdown, .el-autocomplete-suggestion, .el-popper')).filter(vis).map((d) => ({
        cls: String(d.className).slice(0, 120),
        heads: Array.from(d.querySelectorAll('th .cell, .el-table__header .cell')).map((h) => (h.innerText || '').trim()),
        items: Array.from(d.querySelectorAll('.el-select-dropdown__item, .el-table__body tr')).slice(0, 12).map((i) => (i.innerText || '').replace(/\\s+/g, ' ').trim()),
        text: (d.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400),
      }));
    })()`);
    save(); log('ADD_NM_DROPDOWN=', JSON.stringify(out.addNmDropdown));

    // 选第一个候选项
    const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item, .el-table__body-wrapper tbody tr').first();
    if (await opt.count()) {
      await opt.click({ force: true }).catch(() => {});
      await sleep(2500);
      out.dlgAddAfterPick = await dumpDialog(); save();
      log('ADD_AFTER_PICK=', JSON.stringify(out.dlgAddAfterPick && { items: out.dlgAddAfterPick.items, buttons: out.dlgAddAfterPick.buttons }));
      fs.writeFileSync(path.join(DIR, 'dlg_add_afterpick.html'), out.dlgAddAfterPick ? out.dlgAddAfterPick.html : '');
    }
  }

  // 要素类型 select 选项
  const tpInp = page.locator('.el-dialog:visible .el-form-item').filter({ hasText: '要素类型' }).locator('input').first();
  if (await tpInp.count()) {
    await tpInp.click({ force: true });
    await sleep(1500);
    out.elmtTpOptions = await page.evaluate(`(() => { const vis = ${VIS_FN};
      return Array.from(document.querySelectorAll('.el-select-dropdown')).filter(vis).map((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((i) => (i.innerText || '').replace(/\\s+/g, ' ').trim()));
    })()`);
    save(); log('TP_OPTIONS=', JSON.stringify(out.elmtTpOptions));
    await page.keyboard.press('Escape');
  }
  await closeAll();

  // 5) 删除（已选行）→ 确认框
  await page.locator('.el-table__body-wrapper tbody tr').first().locator('td').first().click({ force: true });
  await sleep(1000);
  await clickBtn('删除');
  out.dlgDelete = await dumpMsgs(); save(); log('DELETE_MSGS=', JSON.stringify(out.dlgDelete));
  await closeAll();

  // 6) 树：产品个性化要素 → 工具栏 tips + 新增类型 弹窗
  log('click 产品个性化要素=', await clickTree('产品个性化要素'));
  out.toolbarPrsn = await (async () => {
    const items = await page.evaluate(() => Array.from(document.querySelectorAll('.shrink-button-group a, .shrink-button-group button')).map((a) => String(a.className)));
    const res = [];
    for (let i = 0; i < items.length; i++) {
      await page.locator('.shrink-button-group a, .shrink-button-group button').nth(i).hover({ timeout: 4000 }).catch(() => {});
      await sleep(800);
      res.push({ cls: items[i], tip: await page.evaluate(`(() => { const vis = ${VIS_FN}; const ps = Array.from(document.querySelectorAll('.el-tooltip__popper')).filter(vis); return ps.length ? (ps[ps.length - 1].innerText || '').trim() : null; })()`) });
    }
    return res;
  })(); save(); log('TOOLBAR_PRSN=', JSON.stringify(out.toolbarPrsn));

  const addTypeIdx = out.toolbarPrsn.findIndex((t) => (t.tip || '').includes('新增类型'));
  if (addTypeIdx >= 0) {
    await page.locator('.shrink-button-group a, .shrink-button-group button').nth(addTypeIdx).click({ force: true });
    await sleep(2500);
    out.dlgAddType = await dumpDialog(); save();
    log('ADD_TYPE=', JSON.stringify(out.dlgAddType && { header: out.dlgAddType.header, items: out.dlgAddType.items, buttons: out.dlgAddType.buttons, text: out.dlgAddType.text }));
    fs.writeFileSync(path.join(DIR, 'dlg_addtype.html'), out.dlgAddType ? out.dlgAddType.html : '');
    await closeAll();
  }

  // 7) 树删除：选中组件节点（11）后点删除图标 → 看校验提示/确认
  log('click 11=', await clickTree('11'));
  const delIdx = out.toolbarPrsn.findIndex((t) => (t.tip || '').includes('删除'));
  out.toolbarComp = await (async () => {
    const items = await page.evaluate(() => Array.from(document.querySelectorAll('.shrink-button-group a, .shrink-button-group button')).map((a) => String(a.className)));
    return items;
  })(); save();
  if (delIdx >= 0) {
    await page.locator('.shrink-button-group a, .shrink-button-group button').nth(delIdx).click({ force: true }).catch(() => {});
    await sleep(2500);
    out.dlgTreeDelete = await dumpMsgs(); save(); log('TREE_DELETE=', JSON.stringify(out.dlgTreeDelete));
    await closeAll();
  }

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
