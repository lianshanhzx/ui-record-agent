// probe_14_delete_confirm.js - 找一个未引用要素看删除确认框 + 基本信息保存必填校验
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_14_out.json');
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
    return Array.from(document.querySelectorAll('.el-message, .el-notification, .el-message-box')).filter(vis).map((e) => ({ cls: String(e.className), text: (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 300), buttons: Array.from(e.querySelectorAll('button')).map((b) => (b.innerText || '').replace(/\\s+/g, '')) }));
  })()`);
  const cancelMb = async () => {
    const c = page.locator('.el-message-box:visible button').filter({ hasText: /取\s*消|Cancel/ });
    if (await c.count()) { await c.first().evaluate((el) => el.click()).catch(() => {}); await sleep(900); return true; }
    return false;
  };

  // A) 基本信息保存必填校验
  log('click 产品相关标志=', await clickTree('产品相关标志'));
  await page.click('#tab-first').catch(() => {});
  await sleep(2000);
  out.basicFields = await page.evaluate(() => Array.from(document.querySelectorAll('#pane-first .el-form-item')).map((f) => { const lb = f.querySelector('label'); const i = f.querySelector('input'); return { label: lb ? (lb.innerText || '').trim() : '', val: i ? i.value : null, dis: i ? i.disabled : null }; }));
  save(); log('BASIC_FIELDS=', JSON.stringify(out.basicFields));

  const nm = page.locator('#pane-first .el-form-item').filter({ hasText: '组件名称' }).locator('input').first();
  const orig = await nm.inputValue();
  await nm.fill('');
  await page.locator('#pane-first button:visible').filter({ hasText: /^保\s*存$/ }).first().click({ force: true });
  await sleep(2200);
  out.saveEmptyMsg = await dumpMsgs(); save(); log('SAVE_EMPTY=', JSON.stringify(out.saveEmptyMsg));
  await nm.fill(orig);
  await sleep(500);

  // 序号为空
  const seq = page.locator('#pane-first .el-form-item').filter({ hasText: '序号' }).locator('input').first();
  const origSeq = await seq.inputValue();
  await seq.fill('');
  await page.locator('#pane-first button:visible').filter({ hasText: /^保\s*存$/ }).first().click({ force: true });
  await sleep(2200);
  out.saveEmptySeq = await dumpMsgs(); save(); log('SAVE_EMPTY_SEQ=', JSON.stringify(out.saveEmptySeq));
  await seq.fill(origSeq);

  // 序号非法（abc）
  await seq.fill('abc');
  await page.locator('#pane-first button:visible').filter({ hasText: /^保\s*存$/ }).first().click({ force: true });
  await sleep(2200);
  out.saveBadSeq = await dumpMsgs(); save(); log('SAVE_BAD_SEQ=', JSON.stringify(out.saveBadSeq));
  await seq.fill(origSeq);

  // B) 未引用要素删除确认：年龄限制 第 2/3/4 页逐行尝试
  await clickTree('年龄限制');
  await page.click('#tab-second');
  await sleep(3000);
  out.pageInfo = await page.evaluate(() => { const p = document.querySelector('#pane-second .el-pagination'); return p ? p.innerText.replace(/\s+/g, ' ').trim() : null; });
  save(); log('PAGE=', out.pageInfo);

  const findConfirm = async (tag) => {
    const n = await page.locator('#pane-second .el-table__body-wrapper tbody tr').count();
    for (let i = 0; i < n; i++) {
      await page.evaluate((i) => {
        const tr = document.querySelectorAll('#pane-second .el-table__body-wrapper tbody tr')[i];
        if (!tr) return; const r = tr.querySelector('.el-radio'); (r || tr.querySelector('td')).click();
      }, i);
      await sleep(700);
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pane-second button')).find((x) => (x.innerText || '').replace(/\s+/g, '') === '删除'); if (b) b.click(); });
      await sleep(2300);
      const msgs = await dumpMsgs();
      if (msgs.some((m) => m.cls.includes('el-message-box'))) { out['confirm_' + tag] = { row: i, msgs }; save(); log('CONFIRM_' + tag + '=', JSON.stringify(msgs)); await cancelMb(); return true; }
      await cancelMb().catch(() => {});
      if (msgs.length) { out['nomatch_' + tag] = out['nomatch_' + tag] || []; out['nomatch_' + tag].push({ row: i, msgs }); save(); }
    }
    return false;
  };

  const got1 = await findConfirm('p1');
  if (!got1) {
    // 翻到第 2 页
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pane-second .el-pager li')).find((x) => (x.innerText || '').trim() === '2'); if (b) b.click(); });
    await sleep(2500);
    const got2 = await findConfirm('p2');
    if (!got2) {
      await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#pane-second .el-pager li')).find((x) => (x.innerText || '').trim() === '4'); if (b) b.click(); });
      await sleep(2500);
      await findConfirm('p4');
    }
  }

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
