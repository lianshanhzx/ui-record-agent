// probe_05_findtoolbar.js - 找工具栏按钮（新增类型/新增组件/删除）真实 DOM（只读）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_05_out.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/pdMgt/pdElmtMgt/elmtgroupOfIndex';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-tree', { timeout: 90000 });
  await page.waitForSelector('input.search-input', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  out.hasTexts = await page.evaluate(() => {
    const wanted = ['新增类型', '新增组件', '删除', '新增', '搜索关键字', '保存'];
    const res = {};
    wanted.forEach((w) => {
      const hits = [];
      document.querySelectorAll('*').forEach((el) => {
        if (el.children.length) return;
        const t = (el.textContent || '').replace(/\s+/g, '');
        if (t !== w) return;
        const r = el.getBoundingClientRect();
        hits.push({ tag: el.tagName, cls: String(el.className).slice(0, 100), vis: el.offsetParent !== null, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], parentCls: String(el.parentElement && el.parentElement.className).slice(0, 100) });
      });
      res[w] = hits;
    });
    return res;
  });
  save();

  // 左侧容器 HTML（找带“搜索关键字”的最小外层）
  out.leftHtml = await page.evaluate(() => {
    const inp = document.querySelector('input.search-input') || Array.from(document.querySelectorAll('input')).find((i) => (i.placeholder || '').includes('搜索'));
    if (!inp) return null;
    let b = inp;
    for (let i = 0; i < 8 && b.parentElement; i++) {
      b = b.parentElement;
      if (b.querySelector('.el-tree')) break;
    }
    return { cls: String(b.className), html: b.outerHTML.slice(0, 30000) };
  });
  save();

  // 选中一个个性化 类型 节点（先展开 root0 的子节点），看按钮
  const clickByLabelAt = async (label, indent) => page.evaluate(({ label, indent }) => {
    const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
    const hit = cs.find((c) => (c.innerText || '').replace(/\s+/g, '').replace(/-$/, '').trim() === label.replace(/\s+/g, '') && (!indent || c.style.paddingLeft === indent));
    if (!hit) return false;
    hit.scrollIntoView({ block: 'center' });
    hit.click();
    return true;
  }, { label, indent });

  out.expandRoot0 = await page.evaluate(() => {
    // 顶层 产品个性化要素 的展开箭头
    const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
    const hit = cs.find((c) => (c.innerText || '').replace(/\s+/g, '').includes('产品个性化要素') && c.style.paddingLeft === '0px');
    if (!hit) return 'no-node';
    const icon = hit.querySelector('.el-tree-node__expand-icon');
    if (!icon) return 'no-icon';
    icon.click();
    return 'ok';
  });
  await sleep(3000);
  save();

  out.afterExpandBtns = await page.evaluate(() => Array.from(document.querySelectorAll('button,.el-button,[class*=tssc],[class*=btn]')).map((b) => {
    const r = b.getBoundingClientRect();
    return { tag: b.tagName, text: (b.innerText || '').replace(/\s+/g, '').slice(0, 20), cls: String(b.className).slice(0, 120), vis: b.offsetParent !== null, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
  }).filter((x) => x.text && x.rect[2] > 0));
  save();

  // 点第一个子组件节点（缩进 18px）
  const firstChild = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
    const c = cs.find((x) => x.style.paddingLeft === '18px');
    if (!c) return null;
    const t = (c.innerText || '').replace(/\s+/g, ' ').trim();
    c.scrollIntoView({ block: 'center' });
    c.click();
    return t;
  });
  await sleep(3000);
  out.clickedChild = firstChild;
  out.rightAfterChild = await page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    return {
      tabs: Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => ({ t: (e.innerText || '').trim(), active: e.className.includes('is-active') })),
      btns: Array.from(document.querySelectorAll('button')).filter(vis).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), dis: b.disabled, rect: (() => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })),
      forms: Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => { const lb = f.querySelector('.el-form-item__label, label'); const inp = f.querySelector('input,textarea'); return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, ro: inp ? inp.readOnly : null, dis: inp ? inp.disabled : null }; }),
      tables: Array.from(document.querySelectorAll('.el-table')).filter(vis).map((t) => ({ heads: Array.from(t.querySelectorAll('th .cell')).map((h) => (h.innerText || '').trim()), rows: t.querySelectorAll('tbody tr').length })),
    };
  });
  save();
  console.log('HAS=', JSON.stringify(out.hasTexts));
  console.log('AFTER_EXPAND_BTNS=', JSON.stringify(out.afterExpandBtns.map((b) => b.tag + ':' + b.text)));
  console.log('CLICKED_CHILD=', out.clickedChild);
  console.log('RIGHT=', JSON.stringify(out.rightAfterChild));
  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
