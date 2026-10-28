// probe_03_diag.js - 树展开/选中诊断（逐步落盘）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_03_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { steps: [], apis: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
const log = (...a) => { console.log(...a); out.steps.push(a.join(' ')); save(); };

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || !u.includes('prod')) return;
    try {
      const txt = await r.text();
      const j = JSON.parse(txt);
      out.apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 300), code: j && j.code, body: txt.length < 120000 ? j : null });
      save();
    } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  const dumpTree = () => page.evaluate(() => {
    const arr = [];
    document.querySelectorAll('.el-tree-node').forEach((n) => {
      const c = n.querySelector(':scope > .el-tree-node__content');
      const r = c ? c.getBoundingClientRect() : null;
      arr.push({
        text: c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : '',
        indent: c ? c.style.paddingLeft : '',
        vis: c ? c.offsetParent !== null : false,
        exp: n.classList.contains('is-expanded'),
        leaf: n.classList.contains('is-leaf'),
        cur: n.classList.contains('is-current'),
        y: r ? Math.round(r.y) : null,
        h: r ? Math.round(r.height) : null,
      });
    });
    return arr;
  });

  out.tree0 = await dumpTree(); save();
  log('TREE0', JSON.stringify(out.tree0.map((x) => x.indent + '|' + x.text + '|' + (x.vis ? 'V' : 'h') + (x.exp ? '+' : '') + (x.leaf ? 'L' : ''))));

  // 点第一个根节点
  await page.locator('.el-tree-node__content').nth(0).click({ force: true });
  await sleep(2500);
  out.tree1 = await dumpTree(); save();
  log('TREE1', JSON.stringify(out.tree1.map((x) => x.indent + '|' + x.text + '|' + (x.vis ? 'V' : 'h') + (x.exp ? '+' : '') + (x.leaf ? 'L' : ''))));
  out.right1 = await page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    return {
      tabs: Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => (e.innerText || '').trim()),
      forms: Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => {
        const lb = f.querySelector('.el-form-item__label, label');
        const inp = f.querySelector('input,textarea');
        return { label: lb ? (lb.innerText || '').trim() : '', value: inp ? inp.value : null, ro: inp ? inp.readOnly : null };
      }),
      btns: Array.from(document.querySelectorAll('button')).filter(vis).map((b) => (b.innerText || '').replace(/\s+/g, '')),
      tables: Array.from(document.querySelectorAll('.el-table')).filter(vis).map((t) => ({ heads: Array.from(t.querySelectorAll('th .cell')).map((h) => (h.innerText || '').trim()), rows: t.querySelectorAll('tbody tr').length })),
    };
  }); save();
  log('RIGHT1', JSON.stringify(out.right1));

  // 树组件数据（Vue）
  out.vueTree = await page.evaluate(() => {
    const el = document.querySelector('.el-tree');
    const vm = el && el.__vue__;
    if (!vm) return null;
    const st = vm.store;
    const nodes = st && st.root ? st.root.childNodes || [] : [];
    const walk = (ns, lv) => ns.map((n) => ({ level: lv, label: n.label, key: n.key, data: n.data, childCount: (n.childNodes || []).length, children: walk(n.childNodes || [], lv + 1) }));
    return { count: nodes.length, nodes: walk(nodes, 0) };
  }); save();
  log('VUE_TREE_COUNT', out.vueTree ? out.vueTree.count : 'null');
  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
