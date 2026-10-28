// probe_smbsn_13.js - 探路 银行行号 引入弹窗（编辑模式）
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';

const N = (b) => (b ? { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) } : null);
const J = (o) => JSON.stringify(o);

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = {};

  let qResp = null;
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && !r.url().includes('findCustTradeList') && !r.url().includes('ipcFcnScnInf') && !r.url().includes('getCustTrade') && !r.url().includes('getRatingResult') && !r.url().includes('hit')) {
      try {
        const u = new URL(r.url());
        if (u.pathname.length > 20 && u.pathname !== '/') qResp = { url: u.pathname, body: await r.json().catch(() => null) };
      } catch {}
    }
  });

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2500);
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(3000);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el) => el.click());
  await page.waitForTimeout(500);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(5000);

  // 打开 银行行号 引入
  const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '银行行号' }) }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('button', { hasText: /引\s*入/ }).first().click();
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 });
  await page.waitForTimeout(2500);
  const dlg = page.locator('.el-dialog:visible').last();
  out.title = (await dlg.locator('.el-dialog__title').innerText().catch(() => '')).trim();
  out.formItems = await dlg.evaluate((d) =>
    Array.from(d.querySelectorAll('.el-form-item'))
      .filter((x) => x.offsetParent !== null)
      .map((x) => ({ label: (x.querySelector('label') || {}).innerText?.trim() || '?', hasInput: !!x.querySelector('input'), hasSelect: !!x.querySelector('.el-select'), ph: (x.querySelector('input') || {}).placeholder || '' }))
  );
  out.tableHeaders = await dlg.evaluate((d) =>
    Array.from(d.querySelectorAll('.el-table__header-wrapper th .cell'))
      .map((c) => c.innerText.trim())
      .filter(Boolean)
  );
  out.buttons = await dlg.evaluate((d) =>
    Array.from(d.querySelectorAll('button')).filter((b) => b.offsetParent !== null).map((b) => b.innerText.trim()).filter(Boolean)
  );
  out.rows = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count().catch(() => 0);
  if (out.rows > 0) {
    const r0 = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    out.row0Cells = await r0.evaluate((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => c.innerText.trim().slice(0, 30)));
    out.row0RadioRect = J(N(await r0.locator('input[type="radio"]').first().boundingBox().catch(() => null)));
  }
  // 查询按钮先点一次(看是否需要条件)
  const qBtn = dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first();
  if (await qBtn.count().catch(() => 0)) {
    out.queryApi = null;
    const qp = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('Page'), { timeout: 20000 }).catch(() => null);
    await qBtn.click().catch(() => {});
    const qr = await qp;
    out.queryApi = qr ? new URL(qr.url()).pathname : null;
    out.rowsAfterQuery = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count().catch(() => 0);
    if (out.rowsAfterQuery > 0) {
      const r0 = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
      out.rowAfterCells = await r0.evaluate((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => c.innerText.trim().slice(0, 30)));
      out.rowAfterRadioRect = J(N(await r0.locator('input[type="radio"]').first().boundingBox().catch(() => null)));
    }
  }
  // rect: 确认/取消
  const bb = async (btn) => { const b = await dlg.getByRole('button').filter({ hasText: btn }).first().boundingBox().catch(() => null); return J(N(b)); };
  out.okBtn = await bb(/确\s*认/);
  out.cancelBtn = await bb(/取\s*消/);
  await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  console.log('BANKNO_DLG=', J(out, null, 1));
  fs.writeFileSync(path.join(DIR, 'bankno_dlg.json'), J(out, null, 1));
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
