// probe_smbsn_22.js - 同业客户编辑场景 股东信息 tab + 新增弹窗 结构探路
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('tansun') || r.request().method() !== 'POST') return;
    try {
      const j = JSON.parse(await r.text());
      const d = j && j.data;
      apis.push({ url: u.replace(BASE, ''), code: j && j.code, total: (d && d.total) ?? null });
    } catch {}
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);

  // 客户编号查询
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(1500);

  // 行 radio + 修改
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count()) await rInp.evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('getCustTrade') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await getCustP;
  await page.waitForTimeout(4000);

  // ---- 枚举所有 tab ----
  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-tabs__item')).map((t) => ({
      text: (t.innerText || '').trim(),
      active: t.classList.contains('is-active'),
      rect: (() => { const r = t.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    })));
  console.log('TABS=', JSON.stringify(tabs, null, 1));

  // ---- 点【股东信息】tab ----
  const tab = page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first();
  if (!(await tab.count())) { console.log('NO_TAB 股东信息'); await browser.close(); return; }
  await tab.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(DIR, 's3_01_tab_sh.png') });

  // tab 内容: 表格 + 按钮
  const tabContent = await page.evaluate(() => {
    const panes = Array.from(document.querySelectorAll('.el-tab-pane')).filter((p) => p.offsetParent !== null);
    const pane = panes[panes.length - 1];
    if (!pane) return null;
    const heads = Array.from(pane.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map((h) => (h.innerText || '').trim());
    const rows = Array.from(pane.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 30)));
    const btns = Array.from(pane.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
    return { heads, rowCount: rows.length, rows, btns };
  });
  console.log('TAB_CONTENT=', JSON.stringify(tabContent, null, 1));

  // ---- 点【新增】----
  const paneBtn = page.locator('.el-tab-pane:visible button').filter({ hasText: /新\s*增/ }).first();
  await paneBtn.click({ timeout: 10000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(DIR, 's3_02_add_dlg.png') });

  // ---- 弹窗结构 ----
  const dlg = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog, .el-drawer')).filter((d) => d.offsetParent !== null);
    if (!ds.length) return null;
    const d = ds[ds.length - 1];
    const title = ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim();
    const items = [];
    d.querySelectorAll('.el-form-item').forEach((f) => {
      const l = f.querySelector('label');
      if (!l) return;
      const lb = (l.innerText || '').trim();
      const inp = f.querySelector('input, textarea');
      const r = inp ? inp.getBoundingClientRect() : null;
      items.push({
        label: lb,
        type: f.querySelector('.el-select') ? 'select' : f.querySelector('.el-date-editor') ? 'date'
          : f.querySelector('.el-switch') ? 'switch' : f.querySelector('textarea') ? 'textarea'
          : f.querySelector('.el-radio') ? 'radio' : f.querySelector('button') ? 'btn' : inp ? 'input' : 'skip',
        ph: inp ? inp.placeholder || '' : '', dis: inp ? inp.disabled : null,
        val: inp ? (inp.value || '').slice(0, 40) : null,
        req: !!l.classList.contains('is-required'),
        btns: Array.from(f.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean),
        rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      });
    });
    const footBtns = Array.from(d.querySelectorAll('.el-dialog__footer button, .el-drawer__footer button, .el-dialog__body button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
    return { title, count: ds.length, items, footBtns };
  });
  console.log('DLG=', JSON.stringify(dlg, null, 1));

  // ---- 弹窗内 select 枚举选项 ----
  if (dlg) {
    for (const f of dlg.items.filter((x) => x.type === 'select')) {
      const sel = page.locator('.el-dialog:visible .el-form-item, .el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: f.label }) }).first().locator('.el-select').first();
      await sel.click().catch(() => {});
      await page.waitForTimeout(1200);
      const opts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null)
          .flatMap((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim())));
      console.log('OPTS[' + f.label + ']=', JSON.stringify(opts.slice(0, 25)));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  console.log('APIS=', JSON.stringify(apis, null, 1));
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
