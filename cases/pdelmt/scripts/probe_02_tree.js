// probe_02_tree.js - 左侧树展开/选中 + 右侧页签结构（只读）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_02_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try {
      const txt = await r.text();
      const j = JSON.parse(txt);
      apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 500), code: j && j.code, total: j && j.data && j.data.total, body: txt.length < 60000 ? j : null });
    } catch {}
  });
  const out = { apis, dumps: {} };
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  // 树全部节点（DOM 顺序，包含隐藏），带层级/可见性
  const dumpTree = () => page.evaluate(() => {
    const out = [];
    const t = document.querySelector('.el-tree');
    if (!t) return out;
    t.querySelectorAll('.el-tree-node').forEach((n) => {
      const c = n.querySelector(':scope > .el-tree-node__content');
      const r = c ? c.getBoundingClientRect() : null;
      out.push({
        text: c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : '',
        indent: c ? c.style.paddingLeft : '',
        visible: c ? c.offsetParent !== null : false,
        expanded: n.classList.contains('is-expanded'),
        leaf: n.classList.contains('is-leaf'),
        current: n.classList.contains('is-current'),
        y: r ? Math.round(r.y) : null,
      });
    });
    return out;
  });

  const dumpRight = () => page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    const txt = (e) => (e.innerText || '').replace(/\s+/g, ' ').trim();
    const tabs = Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => ({ text: txt(e), active: e.className.includes('is-active') }));
    const forms = Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => {
      const lb = f.querySelector('.el-form-item__label, label');
      const inp = f.querySelector('input,textarea');
      const lbl = lb ? (lb.innerText || '').replace(/\s+/g, ' ').trim() : '';
      const fc = f.className;
      const req = lb ? lb.className.includes('is-required') || fc.includes('is-required') : false;
      return { label: lbl, value: inp ? inp.value : null, readonly: inp ? inp.readOnly : null, disabled: inp ? inp.disabled : null, required: req };
    });
    const tables = Array.from(document.querySelectorAll('.el-table')).filter(vis).map((t) => ({
      heads: Array.from(t.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()),
      rows: t.querySelectorAll('.el-table__body-wrapper tbody tr').length,
      firstRow: (() => { const tr = t.querySelector('.el-table__body-wrapper tbody tr'); return tr ? Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()) : null; })(),
    }));
    const btns = Array.from(document.querySelectorAll('button')).filter(vis).map((b) => ({ text: txt(b), cls: b.className, dis: b.disabled, rect: (() => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() }));
    const inputs = Array.from(document.querySelectorAll('input,textarea')).filter(vis).map((i) => ({ ph: i.placeholder || '', val: i.value, ro: i.readOnly, dis: i.disabled, cls: i.className, rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() }));
    return { tabs, forms, tables, btns, inputs };
  });

  out.dumps.tree0 = await dumpTree();
  out.dumps.initial = await dumpRight();

  // 展开两个根节点（点展开箭头）
  const expandSvg = page.locator('.el-tree-node__expand-icon:not(.is-leaf)');
  const n = await expandSvg.count();
  for (let i = 0; i < n; i++) {
    await expandSvg.nth(i).click({ force: true }).catch(() => {});
    await sleep(400);
  }
  await sleep(2000);
  out.dumps.treeExpanded = await dumpTree();
  out.dumps.afterExpand = await dumpRight();

  // 逐个点击可见节点，记录右侧
  const clickByIndex = async (idx) => {
    const rows = page.locator('.el-tree-node__content');
    await rows.nth(idx).click({ timeout: 8000 });
    await sleep(2500);
    out.dumps['click_' + idx] = { tree: await dumpTree(), right: await dumpRight() };
  };

  const visibles = (out.dumps.treeExpanded || []).map((x, i) => ({ ...x, i })).filter((x) => x.visible);
  // 公共要素根 / 其第一个子 / 个性化要素根
  for (const node of visibles.slice(0, 6)) {
    await clickByIndex(node.i);
    await sleep(300);
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log('TREE_EXP=', JSON.stringify(out.dumps.treeExpanded.map((x) => x.indent + '|' + x.text + (x.visible ? '' : '(hidden)') + (x.expanded ? '+' : ''))));
  console.log('AFTER tabs=', JSON.stringify(out.dumps.afterExpand.tabs), 'btns=', JSON.stringify(out.dumps.afterExpand.btns.map((b) => b.text)));
  console.log('AFTER forms=', JSON.stringify(out.dumps.afterExpand.forms));
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
