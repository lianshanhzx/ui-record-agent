// probe_04_nodes.js - 按节点类型（类型/组件）分别看右侧页签与按钮（只读）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const OUT = path.join(DIR, 'probe_04_out.json');
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
      out.apis.push({ url: u.replace(BASE, ''), post: (r.request().postData() || '').slice(0, 400), code: j && j.code, body: txt.length < 120000 ? j : null });
      save();
    } catch {}
  });
  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  // 扁平化 Vue 树（含层级与关键字段）
  const flat = () => page.evaluate(() => {
    const vm = document.querySelector('.el-tree').__vue__;
    const arr = [];
    const walk = (ns, lv) => (ns || []).forEach((n) => {
      arr.push({
        lv, label: n.label,
        no: n.data && n.data.elmtGrpgNo, tp: n.data && n.data.elmtGrpgTp, dataTp: n.data && n.data.dataTp,
        prn: n.data && n.data.prnNo, seq: n.data && n.data.seqNo, id: n.data && n.data.id,
        kids: (n.childNodes || []).length,
      });
      walk(n.childNodes, lv + 1);
    });
    walk(vm.store.root.childNodes, 0);
    return arr;
  });

  // 全部“按钮类”元素（含隐藏），用于确认工具栏按钮真实位置/文本
  const dumpBtnsEverywhere = () => page.evaluate(() => Array.from(document.querySelectorAll('button, .el-button, [class*=btn], i[title], span[title]')).map((b) => {
    const r = b.getBoundingClientRect();
    return {
      tag: b.tagName, text: (b.innerText || '').replace(/\s+/g, '').slice(0, 20), title: b.getAttribute('title'),
      cls: String(b.className).slice(0, 120), vis: b.offsetParent !== null, dis: b.disabled,
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    };
  }).filter((x) => x.text || x.title));

  const dumpRight = () => page.evaluate(() => {
    const vis = (e) => e.offsetParent !== null;
    return {
      tabs: Array.from(document.querySelectorAll('.el-tabs__item')).filter(vis).map((e) => ({ t: (e.innerText || '').trim(), active: e.className.includes('is-active') })),
      forms: Array.from(document.querySelectorAll('.el-form-item')).filter(vis).map((f) => {
        const lb = f.querySelector('.el-form-item__label, label');
        const inp = f.querySelector('input,textarea');
        return { label: lb ? (lb.innerText || '').trim() : '', val: inp ? inp.value : null, ro: inp ? inp.readOnly : null, dis: inp ? inp.disabled : null, req: (lb ? lb.className : '').includes('is-required') };
      }),
      btns: Array.from(document.querySelectorAll('button')).filter(vis).map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), dis: b.disabled, cls: b.className, rect: (() => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })),
      tables: Array.from(document.querySelectorAll('.el-table')).filter(vis).map((t) => ({
        heads: Array.from(t.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()),
        rows: t.querySelectorAll('.el-table__body-wrapper tbody tr').length,
        row1: (() => { const tr = t.querySelector('.el-table__body-wrapper tbody tr'); return tr ? Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()) : null; })(),
      })),
      inputs: Array.from(document.querySelectorAll('input,textarea')).filter(vis).map((i) => ({ ph: i.placeholder || '', val: i.value, ro: i.readOnly, cls: i.className, rect: (() => { const r = i.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() })),
      leftHtml: (() => { const t = document.querySelector('.el-tree'); let b = t; for (let i = 0; i < 7 && b.parentElement; i++) { b = b.parentElement; if (b.querySelector('button,.el-button')) break; } return b ? b.outerHTML.slice(0, 15000) : null; })(),
    };
  });

  // 点击 dom 节点（按 label + 需要的缩进层级）
  const clickDomNode = async (label, indent) => {
    const ok = await page.evaluate(({ label, indent }) => {
      const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
      const hit = cs.find((c) => (c.innerText || '').replace(/\s+/g, '').replace(/-$/, '').trim() === label.replace(/\s+/g, '') && (!indent || c.style.paddingLeft === indent));
      if (!hit) return false;
      hit.scrollIntoView({ block: 'center' });
      hit.click();
      return true;
    }, { label, indent });
    await sleep(2500);
    return ok;
  };

  const expandNode = async (label, indent) => {
    const ok = await page.evaluate(({ label, indent }) => {
      const cs = Array.from(document.querySelectorAll('.el-tree-node__content'));
      const hit = cs.find((c) => (c.innerText || '').replace(/\s+/g, '').replace(/-$/, '').trim() === label.replace(/\s+/g, '') && (!indent || c.style.paddingLeft === indent));
      if (!hit) return false;
      const icon = hit.querySelector('.el-tree-node__expand-icon');
      if (icon) { icon.click(); return true; }
      return false;
    }, { label, indent });
    await sleep(2500);
    return ok;
  };

  out.flat0 = await flat(); save();
  log('FLAT0', JSON.stringify(out.flat0.slice(0, 25).map((x) => x.lv + '|' + x.label + '|tp' + x.tp + '|dt' + x.dataTp + '|kids' + x.kids)));

  out.right0 = await dumpRight(); save();
  out.btns0 = await dumpBtnsEverywhere(); save();
  log('BTNS0', JSON.stringify(out.btns0.map((b) => b.tag + ':' + b.text + ':' + (b.vis ? 'V' : 'h') + ':' + b.rect.join(','))));

  // 1) 顶层产品个性化要素
  log('click 产品个性化要素(0px)=', await clickDomNode('产品个性化要素', '0px'));
  out.rightPrsn = await dumpRight(); save();
  out.btnsPrsn = await dumpBtnsEverywhere(); save();
  log('PRSN tabs=', JSON.stringify(out.rightPrsn.tabs), 'btns=', JSON.stringify(out.rightPrsn.btns.map((b) => b.t)));

  // 2) 展开它
  log('expand 产品个性化要素=', await expandNode('产品个性化要素', '0px'));
  out.flat1 = await flat(); save();
  log('FLAT1', JSON.stringify(out.flat1.slice(0, 30).map((x) => x.lv + '|' + x.label + '|tp' + x.tp + '|dt' + x.dataTp)));

  // 3) 找一个“类型”子节点（tp=0）和一个“组件”子节点（tp=1）
  const typeNode = out.flat1.find((x) => x.lv >= 1 && x.tp === '0');
  const compNode = out.flat1.find((x) => x.lv >= 1 && x.tp === '1');
  out.picked = { typeNode, compNode }; save();
  log('PICKED', JSON.stringify({ typeNode, compNode }));

  if (typeNode) {
    log('click type=', typeNode.label, await clickDomNode(typeNode.label, null));
    out.rightType = await dumpRight(); save();
    out.btnsType = await dumpBtnsEverywhere(); save();
    log('TYPE tabs=', JSON.stringify(out.rightType.tabs), 'btns=', JSON.stringify(out.rightType.btns.map((b) => b.t)), 'allbtn=', JSON.stringify(out.btnsType.filter((b) => b.vis).map((b) => b.tag + ':' + b.text)));
  }
  if (compNode) {
    log('click comp=', compNode.label, await clickDomNode(compNode.label, null));
    out.rightComp = await dumpRight(); save();
    out.btnsComp = await dumpBtnsEverywhere(); save();
    log('COMP tabs=', JSON.stringify(out.rightComp.tabs), 'btns=', JSON.stringify(out.rightComp.btns.map((b) => b.t)), 'allbtn=', JSON.stringify(out.btnsComp.filter((b) => b.vis).map((b) => b.tag + ':' + b.text)));
  }

  await browser.close();
})().catch((e) => { console.error('ERR', e); save(); process.exit(1); });
