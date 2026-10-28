// probe_01_page.js - 产品要素库（/#/pdMgt/pdElmtMgt/elmtgroupOfIndex）首屏结构探路（只读）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_01_out.json');

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/')) return;
    try {
      const req = r.request();
      const post = req.postData();
      const j = JSON.parse(await r.text());
      apis.push({
        method: req.method(),
        url: u.replace(BASE, ''),
        post: post ? post.slice(0, 600) : null,
        code: j && j.code,
        total: j && j.data && j.data.total,
        keys: j && j.data && typeof j.data === 'object' ? Object.keys(j.data).slice(0, 20) : null,
      });
    } catch {}
  });

  const result = { url: '', title: '', apis, states: {}, notes: [] };
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  result.url = page.url();
  result.title = await page.title();
  result.states.loggedOut = /\/login/.test(result.url);

  if (result.states.loggedOut) {
    fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log('LOGGED_OUT');
    await browser.close();
    return;
  }

  const treeReady = await page.locator('.el-tree').count();
  result.states.treeCount = treeReady;
  await page.waitForTimeout(2000);

  // 顶部/全局按钮
  result.buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({
        text: (b.innerText || '').replace(/\s+/g, ''),
        cls: b.className,
        dis: b.disabled,
        rect: (() => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })(),
      })));

  // 搜索框
  result.inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input,textarea'))
      .filter((i) => i.offsetParent !== null)
      .map((i) => ({
        ph: i.placeholder || '',
        val: i.value,
        readonly: i.readOnly,
        dis: i.disabled,
        cls: i.className,
        rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })(),
      })));

  // 树结构
  result.tree = await page.evaluate(() => {
    const t = document.querySelector('.el-tree');
    if (!t) return null;
    const nodes = Array.from(t.querySelectorAll('.el-tree-node')).map((n) => {
      const lbl = n.querySelector(':scope > .el-tree-node__content .el-tree-node__label, :scope > .el-tree-node__content span');
      const content = n.querySelector(':scope > .el-tree-node__content');
      let level = 0, p = n;
      while ((p = p.parentElement) && p !== t) if (p.classList && p.classList.contains('el-tree-node__children')) level++;
      return {
        level,
        text: content ? (content.innerText || '').replace(/\s+/g, ' ').trim() : '',
        cls: content ? content.className : '',
        expanded: n.classList.contains('is-expanded'),
        leaf: n.classList.contains('is-leaf'),
        current: n.classList.contains('is-current'),
        hasChildren: !!n.querySelector(':scope > .el-tree-node__children > .el-tree-node'),
      };
    });
    const html = t.outerHTML.slice(0, 4000);
    return { count: nodes.length, nodes, html };
  });

  // 右侧区域结构：tab / 表单 / 表格 / 页签
  result.right = await page.evaluate(() => {
    const pick = (el) => (el ? (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200) : null);
    const tabs = Array.from(document.querySelectorAll('.el-tabs__item')).filter((e) => e.offsetParent !== null).map((e) => ({ text: pick(e), cls: e.className }));
    const forms = Array.from(document.querySelectorAll('.el-form-item')).filter((e) => e.offsetParent !== null).map((f) => {
      const lb = f.querySelector('.el-form-item__label, label');
      const inp = f.querySelector('input,textarea');
      const isDis = inp ? (inp.disabled || inp.readOnly) : null;
      return { label: lb ? (lb.innerText || '').replace(/\s+/g, ' ').trim() : '', value: inp ? inp.value : null, dis: isDis, cls: f.className };
    });
    const tables = Array.from(document.querySelectorAll('.el-table')).filter((e) => e.offsetParent !== null).map((t) => ({
      heads: Array.from(t.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()),
      rows: t.querySelectorAll('.el-table__body-wrapper tbody tr').length,
      firstRow: (() => { const tr = t.querySelector('.el-table__body-wrapper tbody tr'); return tr ? Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()) : null; })(),
    }));
    return { tabs, forms, tables };
  });

  // 右侧面板标题/面包屑
  result.crumbs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-breadcrumb__item, .breadcrumb, .page-title, .el-card__header, .title'))
      .filter((e) => e.offsetParent !== null)
      .map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 20));

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log('URL=', result.url, 'treeCount=', result.states.treeCount, 'nodes=', result.tree ? result.tree.count : null);
  console.log('TABS=', JSON.stringify(result.right.tabs.map((t) => t.text)));
  console.log('BTNS=', JSON.stringify(result.buttons.map((b) => b.text)));
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
