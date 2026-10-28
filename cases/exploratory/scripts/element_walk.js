// 元素遍历器: node element_walk.js <route> <outdir> <label> <actions.json>
// actions.json: [{name, act: click|input|select, sel(文本或xpath=开头), value?, close?: auto|none, note?}]
// 每动作: 前截图 → 执行 → 观察(弹窗/抽屉/route变化/toast) → 后截图 → 弹窗元素dump → 自动关闭(取消/返回/×/Esc) → 验证
// 输出: walk-results.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const [, , route, outdirArg, label, actionsFile] = process.argv;
const OUT = path.resolve(__dirname, '..', outdirArg || 'modules/x');
const ACTIONS = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', actionsFile), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const safe = (s) => String(s || 'x').replace(/[^\w\u4e00-\u9fa5-]/g, '').slice(0, 30);
(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ storageState: 'auth.json', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let apiSeq = [];
  page.on('response', r => { if (r.request().resourceType() === 'xhr' || r.request().resourceType() === 'fetch') apiSeq.push(r.request().method() + ' ' + r.url().replace(BASE, '')); });
  await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !document.body.innerText.includes('加载中'), { timeout: 90000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const locate = (sel) => {
    if (sel.startsWith('xpath=')) return page.locator('xpath=' + sel.slice(6)).filter({ visible: true }).first();
    if (sel.startsWith('t=')) return page.getByText(sel.slice(2), { exact: true }).filter({ visible: true }).first();
    return page.locator(`text=${sel}`).filter({ visible: true }).first();
  };
  const popState = async () => page.evaluate(() => {
    const vis = e => e && e.offsetParent !== null && e.getBoundingClientRect().width > 0;
    const dlg = Array.from(document.querySelectorAll('.el-dialog')).find(vis);
    const drw = Array.from(document.querySelectorAll('.el-drawer')).find(vis);
    const mb = Array.from(document.querySelectorAll('.el-message-box')).find(vis);
    const msg = Array.from(document.querySelectorAll('.el-message')).map(e => e.textContent.trim()).join(' | ');
    const pop = dlg || drw || mb;
    if (!pop) return { pop: false, msg };
    const title = (pop.querySelector('.el-dialog__title')?.textContent || pop.querySelector('h1,h2,h3,.dialog-header')?.textContent || pop.getAttribute('aria-label') || '').trim();
    const btns = Array.from(pop.querySelectorAll('button,.el-button')).filter(vis).map(x => x.textContent.trim()).filter(Boolean);
    const inputs = Array.from(pop.querySelectorAll('input,textarea')).filter(vis).map(x => ({ ph: x.placeholder, type: x.type, ro: x.readOnly }));
    const sels = Array.from(pop.querySelectorAll('.el-select,.el-cascader,.el-date-editor')).filter(vis).map(x => x.className.split(' ').slice(0, 2).join('.'));
    const radios = Array.from(pop.querySelectorAll('.el-radio')).filter(vis).map(x => x.textContent.trim());
    const checks = Array.from(pop.querySelectorAll('.el-checkbox')).filter(vis).map(x => x.textContent.trim());
    const rows = pop.querySelectorAll('.el-table__body tr, .el-table__fixed tr').length;
    const r = pop.getBoundingClientRect();
    return { pop: true, kind: dlg ? 'dialog' : drw ? 'drawer' : 'msgbox', title, aria: pop.getAttribute('aria-label'), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, btns, inputs, sels, radios, checks, rows, msg };
  });
  const closePop = async () => {
    const st = await popState();
    if (!st.pop) return 'none';
    for (const t of ['取消', '返回', '关闭', '取 消']) {
      const btn = page.locator('.el-dialog:visible button, .el-drawer:visible button, .el-message-box:visible button', { hasText: t }).first();
      if (await btn.count()) { await btn.click().catch(() => {}); await sleep(800); if (!(await popState()).pop) return 'btn:' + t; }
    }
    const x = page.locator('.el-dialog:visible .el-dialog__headerbtn, .el-drawer:visible .el-drawer__close-btn, .el-message-box:visible .el-message-box__headerbtn').first();
    if (await x.count()) { await x.click().catch(() => {}); await sleep(800); if (!(await popState()).pop) return 'btn:x'; }
    await page.keyboard.press('Escape'); await sleep(800);
    return (await popState()).pop ? 'STILL_OPEN' : 'esc';
  };

  const anchorSel = process.argv[7] || '';
  const anchor = anchorSel ? locate(anchorSel) : null;
  let lastGoto = 0;
  const ensureHome = async () => {
    if (!anchor) return;
    if (await anchor.isVisible().catch(() => false)) return;
    const now = Date.now();
    if (now - lastGoto > 60000) {
      console.log('  [anchor-lost] 回导航...');
      lastGoto = now;
      await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    }
    await anchor.waitFor({ state: 'visible', timeout: 120000 }).catch(() => {});
    await sleep(1500);
  };

  const runAction = async (a) => {
    if (a.act === 'esc') { await page.keyboard.press('Escape'); return; }
    const loc = locate(a.sel);
    if (a.act !== 'input' && a.act !== 'select') await loc.waitFor({ state: 'visible', timeout: 15000 });
    if (a.act === 'input') await loc.fill(a.value);
    else if (a.act === 'select') { await loc.click(); await sleep(1500); }
    else await loc.click();
  };

  const results = [];
  for (let i = 0; i < ACTIONS.length; i++) {
    const a = ACTIONS[i];
    const rec = { i: i + 1, name: a.name, act: a.act, sel: a.sel, value: a.value, note: a.note || '', apis: [], ok: false, error: '' };
    apiSeq = [];
    const before = `walk-${String(i + 1).padStart(2, '0')}-${safe(a.name)}-before`;
    await ensureHome();
    let tried = 0;
    while (true) {
      tried++;
      try {
      if (a.act !== 'esc') {
        const loc = locate(a.sel);
        const bb = await loc.boundingBox();
        rec.rect = bb ? { x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height) } : null;
      }
      await page.screenshot({ path: path.join(OUT, 'shots', before + '.png') });
      const urlBefore = page.url();
      await runAction(a);
      await sleep(2500);
      rec.urlAfter = page.url();
      rec.routeChanged = page.url() !== urlBefore;
      const st = await popState();
      rec.pop = st;
      await page.screenshot({ path: path.join(OUT, 'shots', `walk-${String(i + 1).padStart(2, '0')}-${safe(a.name)}-after.png`) });
      if (a.act === 'select' && a.noesc !== true) { await page.keyboard.press('Escape'); await sleep(600); }
      if (st.pop) {
        if (a.close !== 'none') rec.closedBy = await closePop();
        else { rec.closedBy = 'left-open'; }
      }
      rec.ok = true;
      break;
    } catch (e) {
      rec.error = e.message.split('\n')[0].slice(0, 200);
      if (tried === 1 && anchor) {
        console.log('  [retry] 回导航后重试...');
        await ensureHome();
        continue;
      }
      break;
    }
    }
    rec.apis = [...new Set(apiSeq)].slice(0, 10);
    results.push(rec);
    console.log(`(${i + 1}/${ACTIONS.length}) ${a.name} [${a.act}] ok=${rec.ok} pop=${rec.pop && rec.pop.pop ? rec.pop.kind + ':' + (rec.pop.title || rec.pop.aria) : '-'} route=${rec.routeChanged ? 'Y' : 'n'} ${rec.error}`);
    if (rec.routeChanged) { // 回导航（预热加载，去重交给 ensureHome）
      lastGoto = Date.now();
      await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(4000);
    }
  }
  fs.writeFileSync(path.join(OUT, 'walk-results.json'), JSON.stringify(results, null, 1));
  await b.close();
  console.log('WALK_DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
