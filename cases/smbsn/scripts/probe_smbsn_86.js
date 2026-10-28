// probe86 - 列表页全量盘点：查询表单/工具栏按钮(选前行后)/表格列/行内元素/dropdown（找未录交易入口）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = {};

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(2000);

  const inventory = () => page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map((b) => ({
      text: b.innerText.trim().replace(/\s+/g, ' '),
      cls: b.className,
      disabled: b.disabled || b.classList.contains('is-disabled'),
      inTable: !!b.closest('.el-table'),
      visible: b.offsetParent !== null,
      rect: (() => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; })(),
    }));
    const labels = [...document.querySelectorAll('.el-form-item__label, label')].map((l) => l.innerText.trim()).filter(Boolean);
    const ths = [...document.querySelectorAll('.el-table__header-wrapper th')].map((th) => th.innerText.trim().replace(/\s+/g, ' '));
    const trs = [...document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')];
    const rowCells = trs.length ? [...trs[0].querySelectorAll('td')].map((td) => ({
      txt: td.innerText.trim().replace(/\s+/g, ' ').slice(0, 60),
      hasBtn: td.querySelectorAll('button').length,
      hasLink: td.querySelectorAll('a').length,
    })) : [];
    const dropdowns = [...document.querySelectorAll('.el-dropdown, [class*=dropdown]')].map((d) => d.innerText.trim().replace(/\s+/g, ' ').slice(0, 80));
    const pg = document.querySelector('.el-pagination__total');
    const inputs = [...document.querySelectorAll('.el-form input, .el-form select')].map((i) => ({
      ph: i.getAttribute('placeholder') || '',
      cls: (i.className || '').slice(0, 60),
      readOnly: i.readOnly || null,
    }));
    return { btns, labels, ths, rowCount: trs.length, rowCells, dropdowns, total: pg ? pg.innerText.trim() : null, inputs };
  });

  result.beforeSelect = await inventory();
  log('P86_BEFORE btns=' + result.beforeSelect.btns.length + ' total=' + result.beforeSelect.total);
  log('P86_BEFORE_BTNS=' + JSON.stringify(result.beforeSelect.btns.filter((b) => !b.inTable), null, 1));
  log('P86_THS=' + JSON.stringify(result.beforeSelect.ths));
  log('P86_LABELS=' + JSON.stringify(result.beforeSelect.labels));
  log('P86_INPUTS=' + JSON.stringify(result.beforeSelect.inputs));
  log('P86_ROWCELLS=' + JSON.stringify(result.beforeSelect.rowCells));
  log('P86_DROPDOWNS=' + JSON.stringify(result.beforeSelect.dropdowns));

  // 选中首行后
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('label.el-radio').first().evaluate((el) => el.click());
  await sleep(1500);
  result.afterSelect = await inventory();
  const enBefore = new Map(result.beforeSelect.btns.map((b) => [b.text + '|' + b.inTable, b.disabled]));
  const changed = result.afterSelect.btns.filter((b) => {
    const k = b.text + '|' + b.inTable;
    return enBefore.has(k) && enBefore.get(k) !== b.disabled;
  });
  log('P86_AFTER_CHANGED=' + JSON.stringify(changed, null, 1));
  log('P86_AFTER_BTNS=' + JSON.stringify(result.afterSelect.btns.filter((b) => !b.inTable), null, 1));

  fs.writeFileSync(path.join(__dirname, 'probe86.out.json'), JSON.stringify(result, null, 2), 'utf8');
  log('P86_SAVED');
  await browser.close();
})().catch((e) => { console.error('P86_ERR', e.message); process.exit(1); });
