// probe_smbsn_1.js - 同业客户列表 API + 新增抽屉结构探路
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || r.request().method() !== 'POST') return;
    try {
      const j = JSON.parse(await r.text());
      const d = j && j.data;
      apis.push({ url: u.replace(BASE, ''), code: j && j.code, total: (d && d.total) ?? null,
        listKeys: d && d.list && d.list[0] ? Object.keys(d.list[0]) : null });
      if (d && d.list && d.list.length) apis[apis.length - 1].firstRow = d.list[0];
    } catch {}
  });

  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 等列表渲染（表格行出现）
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const heads = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map(h => (h.innerText || '').trim()));
  const row1 = await page.evaluate(() => {
    const tr = document.querySelector('.el-table__body-wrapper .el-table__body tbody tr');
    return tr ? Array.from(tr.querySelectorAll('td .cell')).map(c => (c.innerText || '').trim()) : null;
  });
  console.log('HEADS=', JSON.stringify(heads));
  console.log('ROW1=', JSON.stringify(row1));
  console.log('APIS=', JSON.stringify(apis, null, 1));

  // ---- 点【新增】----
  await page.locator('button', { hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(DIR, 's1_01_add_drawer.png') });

  const drawer = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-drawer')).filter(d => d.offsetParent !== null);
    if (!ds.length) return null;
    const d = ds[0];
    const title = ((d.querySelector('.el-drawer__title') || {}).innerText || '').trim();
    const items = [];
    d.querySelectorAll('.el-form-item').forEach(f => {
      const l = f.querySelector('label');
      if (!l) return;
      const lb = (l.innerText || '').trim();
      const inp = f.querySelector('input, textarea');
      const r = inp ? inp.getBoundingClientRect() : null;
      items.push({
        label: lb,
        type: f.querySelector('.el-select') ? 'select' : f.querySelector('.el-date-editor') ? 'date'
          : f.querySelector('.el-switch') ? 'switch' : f.querySelector('textarea') ? 'textarea'
          : f.querySelector('button') ? 'btn' : inp ? 'input' : 'skip',
        ph: inp ? inp.placeholder || '' : '', dis: inp ? inp.disabled : null,
        val: inp ? (inp.value || '').slice(0, 30) : null,
        req: !!l.classList.contains('is-required'),
        btns: Array.from(f.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean),
        rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      });
    });
    const footBtns = Array.from(d.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean);
    return { title, items, footBtns };
  });
  console.log('DRAWER=', JSON.stringify(drawer, null, 1));

  // ---- 抽屉内 select 枚举选项 ----
  if (drawer) {
    for (const f of drawer.items.filter(x => x.type === 'select')) {
      const sel = page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: f.label }) }).first().locator('.el-select').first();
      await sel.click().catch(() => {});
      await page.waitForTimeout(1200);
      const opts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.el-select-dropdown')).filter(d => d.offsetParent !== null)
          .flatMap(d => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map(o => (o.innerText || '').trim())));
      console.log('OPTS[' + f.label + ']=', JSON.stringify(opts));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
  }
  await browser.close();
  console.log('PROBE_DONE');
})().catch(e => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
