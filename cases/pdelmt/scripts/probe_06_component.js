// probe_06_component.js - 组件节点：基本信息 + 产品要素页签 + 三个弹窗（只读，全部取消）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_06_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], apis: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };

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
      const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
      const hit = cs.find((c) => norm(c.innerText) === label.replace(/\s+/g, ''));
      if (!hit) return false;
      hit.scrollIntoView({ block: 'center' });
      hit.click();
      return true;
    }, label);
    await sleep(2600);
    return r;
  };
  const expandTree = async (label) => {
    const r = await page.evaluate((label) => {
      const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
      const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
      const hit = cs.find((c) => norm(c.innerText) === label.replace(/\s+/g, ''));
      if (!hit) return false;
      const ic = hit.querySelector('.el-tree-node__expand-icon');
      if (ic) { ic.click(); return true; }
      return false;
    }, label);
    await sleep(2200);
    return r;
  };

  const dumpRight = () => page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    return {
      tabs: Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => ({ t: (e.innerText || '').trim(), active: e.className.includes('is-active'), id: e.id })),
      forms: Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => {
        const lb = f.querySelector('.el-form-item__label, label');
        const inp = f.querySelector('input,textarea');
        return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, ro: inp ? inp.readOnly : null, dis: inp ? inp.disabled : null, req: (lb ? lb.className : '').includes('is-required') };
      }),
      btns: Array.from(document.querySelectorAll('button')).filter(vis).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), dis: b.disabled, cls: String(b.className).slice(0, 80), rect: (() => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })),
      tables: Array.from(document.querySelectorAll('.el-table')).filter(vis).map((t) => ({
        heads: Array.from(t.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()),
        rows: t.querySelectorAll('.el-table__body-wrapper tbody tr').length,
        row1: (() => { const tr = t.querySelector('.el-table__body-wrapper tbody tr'); return tr ? Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()) : null; })(),
        hasRadio: !!t.querySelector('tbody tr .el-radio, tbody tr .el-radio__input'),
        hasCheckbox: !!t.querySelector('tbody tr .el-checkbox'),
        fixedRight: !!t.parentElement.querySelector('.el-table__fixed-right'),
      })),
      inputs: Array.from(document.querySelectorAll('input,textarea')).filter(vis).map((i) => ({ ph: i.placeholder || '', val: i.value, ro: i.readOnly, dis: i.disabled, rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })),
      pagination: (() => { const p = document.querySelector('.el-pagination'); return p && p.offsetParent ? (p.innerText || '').replace(/\s+/g, ' ').trim() : null; })(),
    };
  });

  // 左侧工具栏图标 + tooltip 文本
  const dumpToolbar = async () => {
    const items = await page.evaluate(() => Array.from(document.querySelectorAll('.shrink-button-group a, .shrink-button-group button')).map((a) => ({ cls: String(a.className), id: a.getAttribute('aria-describedby'), rect: (() => { const r = a.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })));
    for (let i = 0; i < items.length; i++) {
      try {
        await page.locator('.shrink-button-group a, .shrink-button-group button').nth(i).hover({ timeout: 4000 });
        await sleep(900);
        items[i].tip = await page.evaluate(() => {
          const p = Array.from(document.querySelectorAll('.el-tooltip__popper')).filter((e) => e.offsetParent !== null);
          return p.length ? (p[p.length - 1].innerText || '').trim() : null;
        });
      } catch { items[i].tip = 'hover-fail'; }
    }
    return items;
  };

  const dumpDialog = () => page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    const dlgs = Array.from(document.querySelectorAll('.el-dialog, .el-drawer, .el-message-box')).filter(vis);
    return dlgs.map((d) => {
      const title = d.querySelector('.el-dialog__title, .el-drawer__title, .el-message-box__title');
      const items = Array.from(d.querySelectorAll('.el-form-item')).map((f) => {
        const lb = f.querySelector('.el-form-item__label, label');
        const inp = f.querySelector('input,textarea');
        const txt = f.querySelector('.el-select .el-input input, .el-input input');
        return {
          label: lb ? (lb.innerText || '').trim() : '',
          ph: inp ? inp.placeholder : null,
          val: inp ? inp.value : null,
          ro: inp ? inp.readOnly : null,
          dis: inp ? inp.disabled : null,
          req: (f.className + ' ' + (lb ? lb.className : '')).includes('is-required'),
          hasSelect: !!f.querySelector('.el-select'),
          hasDate: !!f.querySelector('.el-date-editor'),
        };
      });
      const labels = Array.from(d.querySelectorAll('.el-form-item__label, label')).map((l) => (l.innerText || '').trim());
      return {
        cls: String(d.className),
        title: title ? (title.innerText || '').trim() : null,
        items,
        labels,
        buttons: Array.from(d.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), cls: String(b.className).slice(0, 60) })),
        text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 500),
      };
    });
  });

  const cancelDialogs = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(600);
    const c = page.locator('.el-dialog:visible button', { hasText: /取\s*消/ });
    if (await c.count()) await c.first().click().catch(() => {});
    await sleep(800);
  };

  // A. 选中一个组件节点（顶层 年龄限制，tp=1）
  log('click 年龄限制=', await clickTree('年龄限制'));
  out.rightAge = await dumpRight(); save();
  out.toolbarAge = await dumpToolbar(); save();
  log('AGE tabs=', JSON.stringify(out.rightAge.tabs), 'btns=', JSON.stringify(out.rightAge.btns.map((b) => b.t)), 'forms=', JSON.stringify(out.rightAge.forms), 'toolbar=', JSON.stringify(out.toolbarAge.map((t) => t.cls + '|' + t.tip)));

  // 点产品要素页签
  if (out.rightAge.tabs.some((t) => t.t === '产品要素')) {
    await page.locator('.el-tabs__item', { hasText: /产品要素/ }).first().click();
    await sleep(2500);
    out.rightAgeElmt = await dumpRight(); save();
    log('ELMT_TAB tabs=', JSON.stringify(out.rightAgeElmt.tabs), 'btns=', JSON.stringify(out.rightAgeElmt.btns.map((b) => b.t)), 'tables=', JSON.stringify(out.rightAgeElmt.tables), 'inputs=', JSON.stringify(out.rightAgeElmt.inputs.map((i) => i.ph + '=' + i.val)));
  }

  // B. 新增类型/新增组件 弹窗
  for (const tipKey of ['新增类型', '新增组件']) {
    const idx = out.toolbarAge.findIndex((t) => (t.tip || '').includes(tipKey));
    if (idx < 0) { log('NO_TOOLBAR', tipKey); continue; }
    await page.locator('.shrink-button-group a, .shrink-button-group button').nth(idx).click({ force: true }).catch((e) => log('click-fail', tipKey, e.message));
    await sleep(2500);
    out['dlg_' + tipKey] = await dumpDialog(); save();
    log('DLG', tipKey, JSON.stringify(out['dlg_' + tipKey]));
    await cancelDialogs();
  }

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
