// probe77 - 探场景页「其他信息」tab（+顺带「业务信息」）：API/按钮/表单/表格/弹窗结构
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const CUST_NO = '260924144929974126';
const OUT = path.join(__dirname, 'probe77.out.json');
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = { apis: [] };
  page.on('response', async (resp) => {
    const u = resp.url();
    const m = resp.request().method();
    if (m === 'GET' || !u.includes('/tansun')) return;
    let body = '';
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 400); } catch (_) {}
    let req = '';
    try { req = (resp.request().postData() || '').slice(0, 300); } catch (_) {}
    result.apis.push({ m, u: u.replace('http://test.creditv5p2.tansun.com.cn', ''), req, resp: body });
  });

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(5000);

  const dumpPane = async (tabName) => {
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: tabName }).first();
    await tabEl.click();
    await sleep(8000);
    const d = await page.evaluate((tn) => {
      const panes = [...document.querySelectorAll('.el-tab-pane')].filter((p) => p.offsetParent !== null);
      const pane = panes[panes.length - 1];
      if (!pane) return { err: 'NO_PANE' };
      const btns = [...pane.querySelectorAll('button')].filter((b) => b.offsetParent !== null && (b.innerText || '').trim()).map((b) => ({ t: b.innerText.trim(), dis: b.disabled }));
      const items = [...pane.querySelectorAll('.el-form-item')].filter((i) => i.offsetParent !== null).map((i) => {
        const lb = i.querySelector('label');
        const ta = i.querySelector('textarea');
        const sel = i.querySelector('.tssc-multi-select, .el-select, .el-cascader');
        const dt = i.querySelector('.el-date-editor');
        const ck = i.querySelectorAll('.el-checkbox').length;
        const rd = i.querySelectorAll('.el-radio').length;
        const inp = ta ? null : (sel ? null : i.querySelector('input'));
        let type, val = '';
        if (ta) { type = 'textarea'; val = ta.value; }
        else if (sel) {
          const dis = sel.querySelector('input[disabled]') || sel.querySelector('.is-disabled');
          const selTxt = sel.querySelector('.el-select__tags, .el-input__inner');
          type = (dis ? 'dis-select' : 'select');
          val = selTxt ? (selTxt.value || selTxt.innerText || '').trim().slice(0, 60) : '';
        }
        else if (dt) { type = 'date'; val = (dt.querySelector('input') || {}).value || ''; }
        else if (ck) type = 'x' + ck + '-checkbox';
        else if (rd) type = 'x' + rd + '-radio';
        else if (inp) { type = inp.disabled ? 'dis-input' : (inp.readOnly ? 'ro-input' : 'input'); val = inp.value; if (inp.placeholder) type += '[' + inp.placeholder + ']'; }
        else type = 'other';
        return { lb: lb ? lb.innerText.trim() : '', type, val: String(val).slice(0, 60) };
      });
      const tables = [...pane.querySelectorAll('.el-table')].filter((t) => t.offsetParent !== null).map((t) => ({
        headers: [...t.querySelectorAll('.el-table__header-wrapper th')].map((h) => h.innerText.trim()).filter(Boolean),
        rows: t.querySelectorAll('.el-table__body-wrapper tbody tr').length,
        btns: [...t.parentElement.querySelectorAll('button')].filter((b) => b.offsetParent !== null && (b.innerText || '').trim()).map((b) => b.innerText.trim()),
      }));
      const tabs = [...document.querySelectorAll('.el-tabs__item')].map((t) => t.innerText.trim());
      return { tabs, btns, items, tables, textLen: pane.innerText.length, textHead: pane.innerText.slice(0, 600) };
    }, tabName);
    result['tab_' + tabName] = d;
    await page.screenshot({ path: path.join(__dirname, 'p77_' + tabName + '.png'), fullPage: false });
    // 该 tab 打开后新到的 API
    result['apis_' + tabName] = result.apis.filter((a) => !a._seen);
    result.apis.forEach((a) => (a._seen = 1));
    log('P77_TAB[' + tabName + '] items=' + (d.items ? d.items.length : 'ERR') + ' btns=' + (d.btns ? d.btns.length : 'ERR') + ' tables=' + (d.tables ? d.tables.length : 'ERR'));
  };

  result.apis.forEach((a) => (a._seen = 1)); // 场景页加载 API 不算 tab 增量
  await dumpPane('其他信息');
  await dumpPane('业务信息');

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  log('P77_DONE out=' + OUT);
  await browser.close();
})().catch(async (e) => {
  console.error('P77_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
