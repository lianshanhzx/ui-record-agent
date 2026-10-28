// probe_13_rowdel.js - 行删除确认框（组件 11 的测试要素）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_13_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], msgs: [] };
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
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300), buttons: Array.from(e.querySelectorAll('button')).map((b) => (b.innerText || '').replace(/\\s+/g, '')) }));
  })()`);

  await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, '').replace(/-+$/, '').trim();
    const hit = Array.from(document.querySelectorAll('.el-tree-node__content')).find((c) => norm(c.innerText) === '产品公共要素');
    const ic = hit && hit.querySelector('.el-tree-node__expand-icon'); if (ic) ic.click();
  });
  await sleep(2500);
  log('click 11=', await clickTree('11'));
  await page.click('#tab-second');
  await sleep(3000);
  out.tab = await page.evaluate(() => Array.from(document.querySelectorAll('.el-tabs__item')).map((e) => ({ t: (e.innerText || '').trim(), act: e.className.includes('is-active') })));
  out.rows = await page.evaluate(() => Array.from(document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim())));
  save(); log('TAB=', JSON.stringify(out.tab), 'ROWS=', JSON.stringify(out.rows));

  const n = await page.locator('#pane-second .el-table__body-wrapper tbody tr').count();
  for (let i = 0; i < Math.min(n, 3); i++) {
    const clicked = await page.evaluate((i) => {
      const tr = document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr')[i];
      if (!tr) return false;
      const radio = tr.querySelector('.el-radio'); (radio || tr.querySelector('td')).click(); return true;
    }, i);
    await sleep(1000);
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#pane-second button')).find((x) => (x.innerText || '').replace(/\s+/g, '') === '删除');
      if (b) b.click();
    });
    await sleep(2500);
    const msgs = await dumpMsgs();
    out['row' + i] = { clicked, msgs }; save();
    log('ROW' + i + '=', JSON.stringify(msgs));
    // 取消确认
    const cancel = page.locator('.el-message-box:visible button').filter({ hasText: /取\s*消|Cancel/ });
    if (await cancel.count()) { await cancel.first().evaluate((el) => el.click()).catch(() => {}); await sleep(800); break; }
    await sleep(500);
  }

  // 基本信息：编辑后“保存”是否可用 + 必填校验（不真正保存：清空组件名称后点保存看提示，再还原）
  await clickTree('产品相关标志');
  await sleep(2500);
  out.basicBefore = await page.evaluate(() => {
    const fs_ = Array.from(document.querySelectorAll('.el-form-item')).filter((f) => f.getBoundingClientRect().height > 0);
    return fs_.map((f) => { const lb = f.querySelector('label'); const i = f.querySelector('input'); return { label: lb ? (lb.innerText || '').trim() : '', val: i ? i.value : null, dis: i ? i.disabled : null }; });
  });
  save(); log('BASIC_BEFORE=', JSON.stringify(out.basicBefore));
  const nm = page.locator('.el-form-item').filter({ hasText: '组件名称' }).locator('input').first();
  const orig = await nm.inputValue();
  await nm.fill('');
  await page.locator('button:visible').filter({ hasText: /^保\s*存$/ }).first().click({ force: true });
  await sleep(2200);
  out.saveEmptyMsg = await dumpMsgs(); save(); log('SAVE_EMPTY=', JSON.stringify(out.saveEmptyMsg));
  await nm.fill(orig);

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
