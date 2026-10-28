// probe_template.js - 探路脚本模板（阶段 2 用）
// 用法: 复制为 work/<task>/probe_xxx.js，改 BASE / ROUTE / 关注点，node 运行
// 职责: 确认字段控件类型 / 下拉选项 / API 参数与响应 / 表头与首行 / 弹窗浮层 DOM 结构
// 规则: headless + auth 登录态 + 视口 1440x900（与 spec/回放一致）；结论写进 plan.md
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg'; // 目标页 hash 路由
const LIST_API = 'findCustCorporatList'; // 要抓的 API 关键字

(async () => {
  const auth = JSON.parse(fs.readFileSync('auth.json', 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ---- 抓 API（请求体 + 响应结构）----
  const apiSeen = [];
  page.on('response', async (r) => {
    if (!r.url().includes(LIST_API) || r.request().method() !== 'POST') return;
    try {
      const j = JSON.parse(await r.text());
      apiSeen.push({
        url: r.url(),
        body: r.request().postDataJSON(),
        total: j && j.data ? j.data.total : null,
        listKeys: j && j.data && j.data.list && j.data.list[0] ? Object.keys(j.data.list[0]) : null,
        firstRow: j && j.data && j.data.list ? j.data.list[0] : null,
      });
    } catch {}
  });

  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(20000);

  // ---- 展开全部折叠节 + 「更多」----
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('[aria-expanded="false"]')).forEach((e) => e.click());
  });
  await page.locator('button i.el-icon-caret-bottom').first().click().catch(() => {});
  await page.waitForTimeout(1500);

  // ---- 字段盘点：标签 / 控件类型 / 只读 / rect ----
  const fields = await page.evaluate(() => {
    const out = [];
    for (const f of Array.from(document.querySelectorAll('.el-form-item'))) {
      if (f.offsetParent === null) continue;
      const l = f.querySelector('label');
      if (!l) continue;
      const lb = (l.innerText || '').trim();
      const inp = f.querySelector('input, textarea');
      const r = inp ? inp.getBoundingClientRect() : null;
      out.push({
        label: lb,
        type: f.querySelector('.el-select') ? 'select'
             : f.querySelector('.el-date-editor') ? 'date'
             : f.querySelector('.el-switch') ? 'switch'
             : f.querySelector('textarea') ? 'textarea'
             : f.querySelector('button') ? 'btn'
             : inp ? 'input' : 'skip',
        inputPlaceholder: inp ? inp.placeholder || '' : '',
        inputDisabled: inp ? inp.disabled : null,
        req: !!f.querySelector('.el-form-item__label > .el-icon-asterisk, label.required, .is-required'),
        btns: Array.from(f.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean),
        rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      });
    }
    return out.sort((a, b) => (a.rect.y - b.rect.y) || (a.rect.x - b.rect.x)); // 视觉顺序
  });
  console.log('FIELDS=', JSON.stringify(fields, null, 1));

  // ---- 表头 + 首行值（修改/查看/查询类交易的数据来源）----
  const row = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map((h) => (h.innerText || '').trim());
    const tr = document.querySelector('.el-table__body-wrapper .el-table__body tbody tr');
    const cells = tr ? Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()) : null;
    return { heads, cells };
  });
  console.log('HEADS=', JSON.stringify(row.heads));
  console.log('CELLS=', JSON.stringify(row.cells));

  // ---- 逐个 select 打开枚举选项 ----
  for (const f of fields.filter((x) => x.type === 'select')) {
    const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: f.label }) }).first();
    await item.locator('.el-select').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const opts = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null)
        .flatMap((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim()))
    );
    console.log('OPTS[' + f.label + ']=', JSON.stringify(opts));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }

  // ---- 弹窗/浮层 DOM 结构普查（同名浮层有几个、哪些可见）----
  const overlays = await page.evaluate(() => {
    const scan = (sel, name) => Array.from(document.querySelectorAll(sel)).map((d, i) => ({
      i, visible: d.offsetParent !== null,
      title: ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim(),
      hasTree: !!d.querySelector('.el-tree'),
      hasForm: !!d.querySelector('.el-form-item'),
    }));
    return { dialogs: scan('.el-dialog', 'dialog'), drawers: scan('.el-drawer', 'drawer'), popovers: scan('.el-popover', 'popover') };
  });
  console.log('OVERLAYS=', JSON.stringify(overlays, null, 1));

  // ---- API 结论（验证筛选参数是否真的生效：发两次请求对比 total）----
  console.log('API=', JSON.stringify(apiSeen, null, 1));

  await browser.close();
})();
