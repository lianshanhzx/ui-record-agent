// probe_smbsn_7.js - 诊断：调查机构弹窗 确认 不关闭的网络/控制台/选中态
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || r.request().method() !== 'POST') return;
    let code = null, msg = null;
    try { const t = await r.text(); const j = JSON.parse(t); code = j && j.code; msg = j && (j.msg || j.message); } catch {}
    apis.push({ url: u.replace(BASE, ''), code, msg });
  });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE_ERR=', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('PAGE_ERR=', e.message.slice(0, 200)));

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  const CH = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  let uscc = ''; for (let i = 0; i < 18; i++) uscc += CH[Math.floor(Math.random() * CH.length)];
  uscc = (uscc[0] === '0' ? '1' : uscc[0]) + uscc.slice(1);
  const name = 'AT_RAD_' + Date.now();
  await page.locator('button', { hasText: /新\s*增/ }).first().click();
  await page.waitForSelector('.el-drawer:visible', { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '证件号码' }) }).first().locator('input').fill(uscc);
  await page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).first().locator('input').fill(name);
  await page.waitForTimeout(800);
  await page.locator('.el-drawer:visible button', { hasText: /保\s*存/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(6000);

  const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '调查机构' }) }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('button', { hasText: /引\s*入/ }).first().click();
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const dlgState = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((x) => x.offsetParent !== null);
    const d = ds[ds.length - 1];
    const trs = Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr'));
    return {
      nDialogs: ds.length,
      nRows: trs.length,
      rows: trs.slice(0, 3).map((tr) => {
        const td0 = tr.querySelector('td');
        const inp = td0 ? td0.querySelector('input[type=radio]') : null;
        return { tdCls: td0 ? td0.className : '', hidden: td0 ? td0.classList.contains('is-hidden') : null, checked: inp ? inp.checked : null, tdVisible: td0 ? td0.offsetParent !== null : null };
      }),
    };
  });
  console.log('DLG_STATE=', JSON.stringify(dlgState, null, 1));

  apis.length = 0;
  const dlg = page.locator('.el-dialog:visible').last();
  await dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(4000);
  console.log('APIS_ON_CONFIRM=', JSON.stringify(apis, null, 1));
  const open = await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  console.log('DLG_OPEN_AFTER_CONFIRM=', open);
  const val = await item.locator('input').first().inputValue().catch(() => '');
  console.log('SURVY_VAL=', val);
  await page.screenshot({ path: path.join(DIR, 's7_01_after_confirm.png') });
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
