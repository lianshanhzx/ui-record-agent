// probe_16_prn.js - 组件 11 的组件类型字段（上级有效）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_16_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const VIS = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
    const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === '产品公共要素');
    const ic = hit && hit.querySelector('.el-tree-node__expand-icon'); if (ic) ic.click();
  });
  await sleep(2500);
  out.click = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
    const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === '11');
    if (!hit) return false; hit.click(); return true;
  });
  await sleep(2500);
  out.tabs = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.innerText || '').trim()));
  out.fields = await page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => { const lb = f.querySelector('.el-form-item__label, label'); const i = f.querySelector('input'); return { label: lb ? (lb.innerText || '').trim() : '', val: i ? i.value : null, dis: i ? i.disabled : null, html: f.outerHTML.slice(0, 700) }; });
  })()`);
  save();
  // 打开组件类型弹层
  const span = page.locator('.el-form-item').filter({ hasText: '组件类型' }).locator('span.my-popover.item, .my-popover').first();
  out.spanCount = await span.count();
  if (await span.count()) {
    await span.hover().catch(() => {});
    await sleep(1200);
    out.popAfterHover = await page.evaluate(`(() => { const vis = ${VIS};
      return Array.from(document.querySelectorAll('.el-popover')).filter(vis).map((p) => ({ cls: String(p.className), text: (p.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300), nodes: Array.from(p.querySelectorAll('.el-tree-node__content')).slice(0, 10).map((c) => (c.innerText || '').replace(/\\s+/g, ' ').trim()) }));
    })()`);
    save();
  }
  console.log(JSON.stringify({ tabs: out.tabs, fields: out.fields.map((f) => [f.label, f.val, f.dis]), pop: out.popAfterHover }));
  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
