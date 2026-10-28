// probe55: 同业客户场景页【关联人信息】tab 探路——tab 清单/表格列/工具栏/新增弹窗字段
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (r.request().method() !== 'POST' || !/tansun/.test(u)) return;
    let body = '';
    try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    apis.push('POST ' + u.split('/').filter(Boolean).slice(-2).join('/') + ' body=' + body);
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q;
  await sleep(1500);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);

  // 全 tab 清单
  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-tabs__item')).map((t) => ({
      text: (t.innerText || '').trim(),
      cls: t.className,
    }))
  );
  console.log('P55_TABS=' + JSON.stringify(tabs));

  const relTab = tabs.find((t) => /关联人/.test(t.text));
  if (!relTab) { console.log('P55_NO_REL_TAB'); await browser.close(); return; }
  console.log('P55_REL_TAB=' + relTab.text);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3500);

  const pane = page.locator('.el-tab-pane:visible').last();
  const paneInfo = await pane.evaluate((el) => {
    const heads = Array.from(el.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()).filter(Boolean);
    const rows = Array.from(el.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()).join('|')
    );
    const btns = Array.from(el.querySelectorAll('button')).map((b) => (b.innerText || '').trim().replace(/\s+/g, ''));
    return { heads, rowCount: rows.length, rows: rows.slice(0, 5), btns };
  });
  console.log('P55_PANE=' + JSON.stringify(paneInfo, null, 1));

  // 点【新增】
  const addBtn = pane.getByRole('button').filter({ hasText: /新\s*增/ }).first();
  console.log('P55_ADD_ENABLED=' + (await addBtn.isEnabled().catch(() => 'n/a')));
  if (await addBtn.isEnabled().catch(() => false)) {
    const addP = page.waitForResponse((r) => r.request().method() === 'POST' && /tansun/.test(r.url()) && !/findCustTrade|query|List|dict|menu/i.test(r.url()), { timeout: 30000 }).catch(() => null);
    await addBtn.click();
    await sleep(3000);
    const ov = await page.evaluate(() => {
      const out = [];
      const scan = (sel, tag) => Array.from(document.querySelectorAll(sel)).forEach((el) => {
        if (el.offsetParent === null) return;
        const title = ((el.querySelector('.el-dialog__title, .el-drawer__title, .el-message-box__title') || {}).innerText || '').trim();
        const items = Array.from(el.querySelectorAll('.el-form-item')).map((f) => {
          const lb = ((f.querySelector('label') || {}).innerText || '').trim();
          const inp = f.querySelector('input, textarea, .el-select, .el-date-editor');
          let type = 'none';
          if (inp) {
            if (inp.tagName === 'TEXTAREA') type = 'textarea';
            else if (inp.classList.contains('el-date-editor')) type = 'date';
            else if (f.querySelector('.el-select')) type = 'select';
            else type = 'input';
          }
          const req = !!f.querySelector('.el-form-item.is-required label') || /[*]/.test(((f.querySelector('label') || {}).innerText || ''));
          let val = '';
          if (inp && inp.value !== undefined) val = String(inp.value).trim();
          return { label: lb, type, req, val };
        });
        const btns = Array.from(el.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
        out.push({ tag, cls: (el.className || '').toString().slice(0, 80), title, items, btns });
      });
      scan('.el-dialog', 'dialog');
      scan('.el-drawer', 'drawer');
      scan('.el-message-box', 'msgbox');
      return out;
    });
    console.log('P55_OVERLAYS=' + JSON.stringify(ov, null, 1));
    const resp = await addP;
    console.log('P55_ADD_API=' + (resp ? resp.url().split('/').filter(Boolean).slice(-2).join('/') : 'none'));
  }
  console.log('P55_APIS=' + JSON.stringify(apis, null, 1));
  await browser.close();
})().catch((e) => { console.error('P55_ERROR', e.message); process.exit(1); });
