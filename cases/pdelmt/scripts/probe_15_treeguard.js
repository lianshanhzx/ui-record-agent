// probe_15_treeguard.js - 删除含下级节点校验 + 组件类型弹层
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_15_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };
const VIS = `(e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.height > 0 && r.width > 0; }`;

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await page.waitForTimeout(3000);
  const clickTree = async (label) => page.evaluate((label) => {
    const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
    const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === label.replace(/\s+/g, ''));
    if (!hit) return false; hit.scrollIntoView({ block: 'center' }); hit.click(); return true;
  }, label);
  const dumpMsgs = () => page.evaluate(`(() => { const vis = ${VIS};
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300) }));
  })()`);
  const tips = async () => {
    const n = await page.locator('.shrink-button-group a').count();
    const r = [];
    for (let i = 0; i < n; i++) {
      await page.locator('.shrink-button-group a').nth(i).hover({ timeout: 3000 }).catch(() => {});
      await sleep(700);
      r.push(await page.evaluate(`(() => { const vis = ${VIS}; const ps = Array.from(document.querySelectorAll('.el-tooltip__popper')).filter(vis); return ps.length ? (ps[ps.length - 1].innerText || '').trim() : null; })()`));
    }
    return r;
  };

  // A) 删除含子节点（年龄限制 kids=1）
  log('click 年龄限制=', await clickTree('年龄限制'));
  out.tipsAge = await tips(); save(); log('TIPS_AGE=', JSON.stringify(out.tipsAge));
  const di = out.tipsAge.findIndex((t) => (t || '').includes('删除'));
  if (di >= 0) {
    await page.locator('.shrink-button-group a').nth(di).click({ force: true });
    await sleep(2500);
    out.delAge = await dumpMsgs(); save(); log('DEL_AGE=', JSON.stringify(out.delAge));
    const c = page.locator('.el-message-box:visible button').filter({ hasText: /取\s*消/ });
    if (await c.count()) await c.first().evaluate((el) => el.click()).catch(() => {});
  }

  // B) 组件类型 树弹层（基本信息）
  await page.click('#tab-first').catch(() => {});
  await sleep(1200);
  const prnItem = page.locator('#pane-first .el-form-item').filter({ hasText: '组件类型' });
  out.prnHtml = await prnItem.evaluate((el) => el.outerHTML.slice(0, 1500)).catch(() => null);
  const span = prnItem.locator('.my-popover.item, .item').first();
  if (await span.count()) {
    await span.hover().catch(() => {});
    await span.evaluate((el) => el.click()).catch(() => {});
    await sleep(2000);
    out.prnPopover = await page.evaluate(`(() => { const vis = ${VIS};
      const ps = Array.from(document.querySelectorAll('.el-popover.tree-popover')).filter(vis);
      return ps.map((p) => ({ text: (p.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400), nodes: Array.from(p.querySelectorAll('.el-tree-node__content')).slice(0, 12).map((c) => (c.innerText || '').replace(/\\s+/g, ' ').trim()), hasSearch: !!p.querySelector('input') }));
    })()`);
    save(); log('PRN_POPOVER=', JSON.stringify(out.prnPopover));
    await page.keyboard.press('Escape');
  }
  // C) 上级有效节点：KB测要素类型-20260910
  log('click KB类型=', await clickTree('KB测要素类型-20260910'));
  await sleep(1500);
  out.basicKB = await page.evaluate(() => Array.from(document.querySelectorAll('.el-form-item')).filter((f) => f.getBoundingClientRect().height > 0).map((f) => { const lb = f.querySelector('label'); const i = f.querySelector('input'); return { label: lb ? (lb.innerText || '').trim() : '', val: i ? i.value : null, dis: i ? i.disabled : null }; }));
  save(); log('BASIC_KB=', JSON.stringify(out.basicKB));

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
