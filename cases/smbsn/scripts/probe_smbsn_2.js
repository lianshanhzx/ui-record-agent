// probe_smbsn_2.js - 新增抽屉填数保存 → 场景页结构探路
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';

const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const CH = '0123456789ABCDEFGHJKLMNPQRTUWXY';
let uscc = '';
for (let i = 0; i < 18; i++) uscc += CH[Math.floor(Math.random() * CH.length)];
uscc = (uscc[0] === '0' ? '1' : uscc[0]) + uscc.slice(1);
const name = 'AT_SMB_' + ts;
console.log('DATA:', name, uscc);

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
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch {}
      apis.push({ url: u.replace(BASE, ''), body: r.request().postDataJSON() || null,
        code: j ? j.code : null, msg: j ? j.msg || j.message : null,
        total: j && j.data ? j.data.total ?? null : null,
        dataKeys: j && j.data && typeof j.data === 'object' ? Object.keys(j.data).slice(0, 12) : null });
    } catch {}
  });

  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);

  await page.locator('button', { hasText: /新\s*增/ }).first().click();
  await page.waitForSelector('.el-drawer:visible', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // 证件类型选项枚举
  const selItem = page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '证件类型' }) }).first();
  await selItem.locator('.el-select').first().click();
  await page.waitForTimeout(1500);
  const opts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-select-dropdown')).filter(d => d.offsetParent !== null)
      .flatMap(d => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map(o => (o.innerText || '').trim())));
  console.log('OPTS[证件类型]=', JSON.stringify(opts));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  await page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '证件号码' }) }).first().locator('input').fill(uscc);
  await page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).first().locator('input').fill(name);
  await page.screenshot({ path: path.join(DIR, 's2_01_drawer_filled.png') });

  const beforeSave = apis.length;
  await page.locator('.el-drawer:visible button', { hasText: /保\s*存/ }).first().click();
  console.log('SAVE_CLICKED');
  await page.waitForTimeout(12000);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log('AFTER_SAVE_APIS=', JSON.stringify(apis.slice(beforeSave), null, 1));
  console.log('FINAL_URL:', page.url());
  await page.screenshot({ path: path.join(DIR, 's2_02_scene_page.png') });

  // 场景页结构盘点
  const scene = await page.evaluate(() => {
    const secs = [];
    document.querySelectorAll('[aria-expanded]').forEach(el => {
      const t = (el.innerText || '').trim().split('\n')[0].trim();
      if (t) secs.push({ name: t, expanded: el.getAttribute('aria-expanded'), top: Math.round(el.getBoundingClientRect().top) });
    });
    const items = [];
    document.querySelectorAll('.el-form-item').forEach(f => {
      if (f.offsetParent === null) return;
      const l = f.querySelector('label');
      if (!l) return;
      const lb = (l.innerText || '').trim();
      const inp = f.querySelector('input, textarea');
      const r = inp ? inp.getBoundingClientRect() : null;
      items.push({
        label: lb,
        type: f.querySelector('.el-select') ? 'select' : f.querySelector('.el-date-editor') ? 'date'
          : f.querySelector('.el-switch') ? 'switch' : f.querySelector('textarea') ? 'textarea'
          : inp ? 'input' : 'skip',
        ph: inp ? inp.placeholder || '' : '', dis: inp ? inp.disabled : null, ro: inp ? inp.readOnly : null,
        val: inp ? (inp.value || '').slice(0, 40) : null,
        req: !!l.classList.contains('is-required'),
        btns: Array.from(f.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean),
        rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      });
    });
    const tabs = Array.from(document.querySelectorAll('.el-tabs__item')).map(t => (t.innerText || '').trim());
    const pageBtns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null)
      .map(b => (b.innerText || '').trim()).filter(Boolean);
    return { secs, items: items.sort((a, b) => (a.rect ? a.rect.y : 9999) - (b.rect ? b.rect.y : 9999) || (a.rect ? a.rect.x : 0) - (b.rect ? b.rect.x : 0)), tabs, pageBtns: [...new Set(pageBtns)] };
  });
  console.log('SCENE=', JSON.stringify(scene, null, 1));
  fs.writeFileSync(path.join(DIR, 'scene_dump.json'), JSON.stringify(scene, null, 1));
  await browser.close();
  console.log('PROBE_DONE');
})().catch(e => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
