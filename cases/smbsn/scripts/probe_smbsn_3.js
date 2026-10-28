// probe_smbsn_3.js - 场景页深挖：可编辑 select 选项 + 暂存空表校验 + 联动
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const SCENE = process.env.SCENE_URL; // 上一步保存后拿到的完整 hash URL
const OUT = {};

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
        code: j ? j.code : null, msg: j ? (j.msg || j.message || '') : null,
        dataKeys: j && j.data && typeof j.data === 'object' ? Object.keys(j.data).slice(0, 10) : null });
    } catch {}
  });

  await page.goto(SCENE.startsWith('http') ? SCENE : BASE + SCENE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(25000); // 微前端冷启动
  await page.waitForSelector('.el-form-item', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  // ---- 逐个可编辑 select 枚举选项 ----
  const selInfo = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.el-form-item').forEach(f => {
      if (f.offsetParent === null) return;
      const l = f.querySelector('label');
      if (!l || !f.querySelector('.el-select')) return;
      const lb = (l.innerText || '').trim();
      const inp = f.querySelector('.el-select input');
      out.push({ label: lb, dis: inp ? inp.disabled : null, val: inp ? inp.value : '' });
    });
    return out;
  });
  for (const s of selInfo) {
    if (s.dis) continue;
    const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: s.label }) }).first();
    await item.scrollIntoViewIfNeeded().catch(() => {});
    await item.locator('.el-select input').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const opts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.el-select-dropdown')).filter(d => d.offsetParent !== null)
        .flatMap(d => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map(o => (o.innerText || '').trim())));
    console.log('OPTS[' + s.label + ']=', JSON.stringify(opts.slice(0, 30)));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // ---- 空表直接点【暂存】看校验 ----
  const saveApisBefore = apis.length;
  await page.locator('button', { hasText: /暂\s*存/ }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('button', { hasText: /暂\s*存/ }).first().click();
  await page.waitForTimeout(5000);
  const errs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-form-item__error, .el-message, .el-notification__content'))
      .filter(e => e.offsetParent !== null).map(e => (e.innerText || '').trim()).filter(Boolean));
  console.log('EMPTY_SAVE_ERRS=', JSON.stringify(errs, null, 1));
  console.log('EMPTY_SAVE_APIS=', JSON.stringify(apis.slice(saveApisBefore), null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_01_empty_save.png') });

  await browser.close();
  console.log('PROBE_DONE');
})().catch(e => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
