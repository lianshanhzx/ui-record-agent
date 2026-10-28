// 通用页面探针: node page_probe.js <hashRoute> <outdir> <label>
// 导航 → 截图 → 全量交互元素枚举 → elements.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const [, , route, outdirArg, label] = process.argv;
const OUT = path.resolve(__dirname, '..', outdirArg || 'modules/x');
(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ storageState: 'auth.json', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', async r => { if (r.request().resourceType() === 'xhr' || r.request().resourceType() === 'fetch') { apis.push(r.request().method() + ' ' + r.url().replace(BASE, '')); } });
  await page.goto(BASE + '/#' + route, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => !document.body.innerText.includes('加载中'), { timeout: 90000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const safe = (label || 'page').replace(/[^\w\u4e00-\u9fa5-]/g, '');
  await page.screenshot({ path: path.join(OUT, 'shots', `01-${safe}.png`) });
  const els = await page.evaluate(() => {
    const pick = (e, extra) => {
      const r = e.getBoundingClientRect();
      const fi = e.closest('.el-form-item');
      const lab = (fi && fi.querySelector('label') ? fi.querySelector('label').textContent.trim() : '') || e.getAttribute('aria-label') || '';
      return Object.assign({
        tag: e.tagName.toLowerCase(), cls: String(e.className).split(' ').filter(c => c && c !== 'el-tooltip').slice(0, 4).join('.'),
        text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), lab, ph: e.placeholder || '',
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        vis: r.width > 0 && r.height > 0 && e.offsetParent !== null,
        dis: !!(e.disabled || e.classList.contains('is-disabled') || e.getAttribute('aria-disabled') === 'true'),
        ro: !!e.readOnly
      }, extra || {});
    };
    const out = { inputs: [], buttons: [], selects: [], checks: [], tabs: [], treeNodes: [], tableActs: [], links: [], dates: [], switches: [] };
    document.querySelectorAll('input,textarea').forEach(e => { if (e.type !== 'hidden' && e.offsetParent !== null) out.inputs.push(pick(e)); });
    document.querySelectorAll('button,.el-button,[role=button],.el-pagination button,.el-pager li').forEach(e => { if (e.offsetParent !== null) out.buttons.push(pick(e)); });
    document.querySelectorAll('.el-select,.el-cascader,.el-autocomplete').forEach(e => { if (e.offsetParent !== null) out.selects.push(pick(e)); });
    document.querySelectorAll('.el-checkbox,.el-radio').forEach(e => { if (e.offsetParent !== null) out.checks.push(pick(e)); });
    document.querySelectorAll('.el-tabs__item,[role=tab]').forEach(e => { if (e.offsetParent !== null) out.tabs.push(pick(e)); });
    document.querySelectorAll('.el-tree-node__content').forEach(e => { if (e.offsetParent !== null) out.treeNodes.push(pick(e)); });
    document.querySelectorAll('.el-table__body button,.el-table__body a,.el-table__fixed button,.el-table__fixed a,td .el-button').forEach(e => { if (e.offsetParent !== null) out.tableActs.push(pick(e)); });
    document.querySelectorAll('.el-date-editor').forEach(e => { if (e.offsetParent !== null) out.dates.push(pick(e)); });
    document.querySelectorAll('.el-switch').forEach(e => { if (e.offsetParent !== null) out.switches.push(pick(e)); });
    document.querySelectorAll('a[href],.el-link').forEach(e => { const t = (e.textContent || '').trim(); if (t && e.offsetParent !== null && t.length < 30) out.links.push(pick(e)); });
    out.title = document.title;
    out.url = location.href;
    out.tabs2 = Array.from(document.querySelectorAll('.el-menu--horizontal .el-menu-item, .el-menu--horizontal .el-submenu__title')).filter(e => e.offsetParent !== null).map(e => e.textContent.trim());
    return out;
  });
  fs.writeFileSync(path.join(OUT, `elements-${safe}.json`), JSON.stringify(els, null, 1));
  console.log('URL =', els.url);
  console.log('TITLE =', els.title);
  for (const k of Object.keys(els)) {
    if (!Array.isArray(els[k])) continue;
    console.log(`[${k}] ${els[k].length}`);
    els[k].slice(0, 60).forEach(e => console.log(`  ${e.tag}.${e.cls.slice(0, 25)} ${JSON.stringify(e.text || e.ph || e.lab)} @${e.x},${e.y} ${e.w}x${e.h} vis=${e.vis} dis=${e.dis} ro=${e.ro}`));
    if (els[k].length > 60) console.log('  ...+' + (els[k].length - 60));
  }
  console.log('APIS:');
  [...new Set(apis)].slice(0, 40).forEach(a => console.log('  ' + a.slice(0, 150)));
  await b.close();
})().catch(e => { console.error('ERR', e); process.exit(1); });
