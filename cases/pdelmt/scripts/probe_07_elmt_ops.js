// probe_07_elmt_ops.js - 产品要素页签：查询/新增/修改/删除（只读，弹窗全部取消）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_07_out.json');
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
      hit.scrollIntoView({ block: 'center' }); hit.click(); return true;
    }, label);
    await sleep(2600); return r;
  };

  const dumpRight = () => page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    return {
      tabs: Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => ({ t: (e.innerText || '').trim(), active: e.className.includes('is-active') })),
      forms: Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => { const lb = f.querySelector('.el-form-item__label, label'); const inp = f.querySelector('input,textarea'); return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, ro: inp ? inp.readOnly : null, dis: inp ? inp.disabled : null }; }),
      btns: Array.from(document.querySelectorAll('button')).filter(vis).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), dis: b.disabled, cls: String(b.className).slice(0, 90) })),
      tables: Array.from(document.querySelectorAll('.el-table')).filter(vis).map((t) => ({
        heads: Array.from(t.querySelectorAll('.el-table__header-wrapper th')).map((h) => ({ txt: (h.innerText || '').trim(), cls: h.className, w: h.getAttribute('width') || (h.querySelector('.cell') ? h.querySelector('.cell').style.width : '') })),
        rows: Array.from(t.querySelectorAll('.el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())),
        bodyHtmlHead: t.querySelector('.el-table__body-wrapper tbody tr') ? t.querySelector('.el-table__body-wrapper tbody tr').outerHTML.slice(0, 2500) : null,
      })),
      inputs: Array.from(document.querySelectorAll('input,textarea')).filter(vis).map((i) => ({ ph: i.placeholder || '', val: i.value, ro: i.readOnly, dis: i.disabled, cls: i.className, rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })),
      pagination: (() => { const p = document.querySelector('.el-pagination'); return p && p.offsetParent ? p.innerText.replace(/\s+/g, ' ').trim() : null; })(),
    };
  });

  const dumpDialog = () => page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    return Array.from(document.querySelectorAll('.el-dialog, .el-message-box')).filter(vis).map((d) => {
      const hd = d.querySelector('.el-dialog__header, .el-message-box__header');
      return {
        cls: String(d.className),
        header: hd ? (hd.innerText || '').replace(/\s+/g, ' ').trim() : null,
        items: Array.from(d.querySelectorAll('.el-form-item')).map((f) => {
          const lb = f.querySelector('.el-form-item__label, label');
          const inp = f.querySelector('input,textarea');
          return {
            label: lb ? (lb.innerText || '').trim() : '',
            ph: inp ? inp.placeholder : null,
            val: inp ? inp.value : null,
            ro: inp ? inp.readOnly : null,
            dis: inp ? inp.disabled : null,
            req: (f.className + ' ' + (lb ? lb.className : '')).includes('is-required'),
            select: !!f.querySelector('.el-select'), date: !!f.querySelector('.el-date-editor'),
            readonlyField: !!f.querySelector('.el-input.is-disabled'),
          };
        }),
        buttons: Array.from(d.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), cls: String(b.className).slice(0, 70) })),
        text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600),
      };
    });
  });

  const closeDlg = async () => {
    const btn = page.locator('.el-dialog:visible button', { hasText: /取\s*消/ });
    if (await btn.count()) await btn.first().click().catch(() => {});
    else {
      const mb = page.locator('.el-message-box:visible button', { hasText: /取\s*消/ });
      if (await mb.count()) await mb.first().click().catch(() => {});
      else await page.keyboard.press('Escape').catch(() => {});
    }
    await sleep(1000);
  };

  log('click 年龄限制=', await clickTree('年龄限制'));
  await page.locator('.el-tabs__item', { hasText: /产品要素/ }).first().click();
  await sleep(3000);
  out.tabElmt = await dumpRight(); save();
  log('ELMT heads=', JSON.stringify(out.tabElmt.tables[0] && out.tabElmt.tables[0].heads.map((h) => h.txt)));
  log('ELMT rows=', JSON.stringify(out.tabElmt.tables[0] && out.tabElmt.tables[0].rows.slice(0, 3)));
  log('ELMT inputs=', JSON.stringify(out.tabElmt.inputs.filter((i) => i.rect[2] > 0).map((i) => i.ph + '|' + i.val + '|' + i.rect.join(','))));
  log('ELMT pagination=', out.tabElmt.pagination);

  // 未选行时点修改/删除
  const clickBtn = async (t) => { await page.locator('.el-tabs__item').first().waitFor({ state: 'attached' }).catch(() => {}); const b = page.locator('button:visible').filter({ hasText: new RegExp(t.split('').join('\\s*')) }).first(); await b.click({ force: true }); await sleep(2200); };
  await clickBtn('修改');
  out.noRowModify = await page.evaluate(() => Array.from(document.querySelectorAll('.el-message, .el-message-box, .el-notification')).filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()));
  save(); log('NOROW_MODIFY_MSG=', JSON.stringify(out.noRowModify));
  await closeDlg();

  await clickBtn('删除');
  out.noRowDelete = await page.evaluate(() => Array.from(document.querySelectorAll('.el-message, .el-message-box, .el-notification')).filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()));
  save(); log('NOROW_DELETE_MSG=', JSON.stringify(out.noRowDelete));
  await closeDlg();

  // 选第一行 radio
  await page.locator('.el-table__body-wrapper tbody tr').first().locator('.el-radio__input, .el-radio').first().click({ force: true }).catch(async () => {
    await page.locator('.el-table__body-wrapper tbody tr').first().locator('td').first().click({ force: true });
  });
  await sleep(1200);
  out.afterPickRow = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => b.offsetParent !== null).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), dis: b.disabled })).filter((b) => b.t));
  save(); log('AFTER_PICK btns=', JSON.stringify(out.afterPickRow));

  // 修改
  await clickBtn('修改');
  out.dlgModify = await dumpDialog(); save(); log('DLG_MODIFY=', JSON.stringify(out.dlgModify));
  await closeDlg();

  // 新增
  await clickBtn('新增');
  out.dlgAdd = await dumpDialog(); save(); log('DLG_ADD=', JSON.stringify(out.dlgAdd));

  // 新增弹窗：展开“要素名称”下拉看远程搜索选项
  const sel = page.locator('.el-dialog:visible .el-form-item').filter({ hasText: '要素名称' }).locator('.el-select, .el-input__inner').first();
  if (await sel.count()) {
    await sel.click({ force: true });
    await sleep(2500);
    out.addElmtNmOptions = await page.evaluate(() => {
      const ds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null || getComputedStyle(d).display !== 'none');
      return ds.map((d) => ({ text: (d.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 800), items: Array.from(d.querySelectorAll('.el-select-dropdown__item')).slice(0, 30).map((i) => (i.innerText || '').replace(/\s+/g, ' ').trim()) }));
    });
    save(); log('ADD_ELMTNM_OPTIONS=', JSON.stringify(out.addElmtNmOptions));
    await page.keyboard.press('Escape').catch(() => {});
  }
  await closeDlg();

  // 删除（选行后）→ 确认框
  await page.locator('.el-table__body-wrapper tbody tr').first().locator('.el-radio__input, .el-radio').first().click({ force: true }).catch(() => {});
  await sleep(1000);
  await clickBtn('删除');
  out.dlgDelete = await dumpDialog(); save(); log('DLG_DELETE=', JSON.stringify(out.dlgDelete));
  await closeDlg();

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
