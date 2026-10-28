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
  const events = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/tansun/i.test(r.url())) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    events.push('RESP ' + r.url().split('/').filter(Boolean).slice(-2).join('/') + ' ' + body);
  });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  const dlg = page.locator('.el-dialog:visible').last();
  await dlg.locator('.el-form-item').filter({ hasText: '关联客户名称' }).first().locator('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);

  const dump = await page.evaluate(() => {
    const out = [];
    Array.from(document.querySelectorAll('.el-dialog')).forEach((el) => {
      const vis = el.offsetParent !== null;
      const btns = Array.from(el.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim().replace(/\s+/g, ''), dis: b.disabled }));
      const formVals = Array.from(el.querySelectorAll('.el-form-item')).map((f) => {
        const lb = ((f.querySelector('label') || {}).innerText || '').trim();
        const inp = f.querySelector('input, .el-select');
        let v = '';
        if (inp) v = inp.value !== undefined ? String(inp.value).trim() : (inp.innerText || '').trim();
        return lb + '=' + v;
      });
      if (vis || /dialog5/.test(el.className || '')) out.push({ cls: (el.className || '').toString(), vis, formVals, btns });
    });
    return out;
  });
  console.log('P57C_DIALOGS=' + JSON.stringify(dump, null, 1));

  // JS 点击引入弹窗的【查询】
  const ev0 = events.length;
  const clickRes = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((x) => x.offsetParent !== null);
    const imp = ds.find((d) => Array.from(d.querySelectorAll('button')).some((b) => (b.innerText || '').includes('查询') && (b.innerText || '').includes('重置')));
    if (!imp) return 'NO_IMPORT_DLG';
    const btn = Array.from(imp.querySelectorAll('button')).find((b) => (b.innerText || '').trim() === '查询');
    if (!btn) return 'NO_BTN';
    btn.click();
    return 'CLICKED disabled=' + btn.disabled;
  });
  console.log('P57C_CLICK=' + clickRes);
  await sleep(5000);
  console.log('P57C_EVENTS=' + JSON.stringify(events.slice(ev0), null, 1));
  const st = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((x) => x.offsetParent !== null);
    const imp = ds.find((d) => Array.from(d.querySelectorAll('button')).some((b) => (b.innerText || '').includes('确认')));
    if (!imp) return 'NO_IMP';
    const rows = imp.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
    return { rowCount: rows.length, first: rows[0] ? Array.from(rows[0].querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim()).join('|') : '', empty: (imp.querySelector('.el-table__empty-block') || {}).innerText || '' };
  });
  console.log('P57C_TABLE=' + JSON.stringify(st));
  await browser.close();
})().catch((e) => { console.error('P57C_ERROR', e.message); process.exit(1); });
