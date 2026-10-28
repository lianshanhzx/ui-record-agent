// probe_smbsn_23.js - 股东信息新增弹窗: select 选项 / 股东名称引入弹窗 / 确定校验行为
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('tansun') || r.request().method() !== 'POST') return;
    try {
      const j = JSON.parse(await r.text());
      const d = j && j.data;
      apis.push({ url: u.replace(BASE, ''), code: j && j.code, msg: j && j.message, total: (d && d.total) ?? null });
    } catch {}
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);

  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(1500);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('getCustTrade') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await getCustP;
  await page.waitForTimeout(4000);

  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-tab-pane:visible button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);
  const D = '.el-dialog:visible';

  // ---- 1) select 选项（逐个打开枚举）----
  for (const lb of ['股东类型', '证件类型', '币种', '出资方式']) {
    const selInput = page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first().locator('.el-select .el-input input, .el-select input').first();
    try {
      await selInput.click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      const opts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null)
          .flatMap((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim())));
      console.log(`OPTS[${lb}]=`, JSON.stringify(opts));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
    } catch (e) {
      console.log(`OPTS[${lb}]= FAIL ${e.message.split('\n')[0]}`);
    }
  }

  // ---- 2) 股东名称-引入 弹窗 ----
  await page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '股东名称' }) }).first().getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(DIR, 's3_03_import_dlg.png') });
  const impDlg = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    if (!ds.length) return null;
    const d = ds[ds.length - 1];
    const title = ((d.querySelector('.el-dialog__title') || {}).innerText || '').trim();
    const fields = [];
    d.querySelectorAll('.el-form-item').forEach((f) => {
      const l = f.querySelector('label');
      if (!l) return;
      fields.push({ label: (l.innerText || '').trim(), type: f.querySelector('.el-select') ? 'select' : f.querySelector('input') ? 'input' : '?' });
    });
    const heads = Array.from(d.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map((h) => (h.innerText || '').trim()).filter(Boolean);
    const btns = Array.from(d.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
    return { title, fields, heads, btns };
  });
  console.log('IMP_DLG=', JSON.stringify(impDlg, null, 1));

  // 引入弹窗内若有 select 也枚举
  if (impDlg) {
    for (const f of impDlg.fields.filter((x) => x.type === 'select')) {
      const selInput = page.locator('.el-dialog:visible').last().locator('.el-form-item').filter({ has: page.locator('label', { hasText: f.label }) }).first().locator('.el-select input').first();
      try {
        await selInput.click({ timeout: 4000 });
        await page.waitForTimeout(2000);
        const opts = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null)
            .flatMap((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim())));
        console.log(`IMP_OPTS[${f.label}]=`, JSON.stringify(opts));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (e) { console.log(`IMP_OPTS[${f.label}]= FAIL ${e.message.split('\n')[0]}`); }
    }
  }
  // 引入弹窗取消
  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  // ---- 3) 空表单点【确定】看校验行为 ----
  const msgs = [];
  page.on('console', (m) => { if (m.type() === 'error') msgs.push(m.text().slice(0, 150)); });
  const saveClick = page.getByRole('button').filter({ hasText: /确\s*定/ }).last();
  await saveClick.click();
  await page.waitForTimeout(4000);
  const vld = await page.evaluate(() => ({
    messages: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
    msgbox: Array.from(document.querySelectorAll('.el-message-box')).filter((d) => d.offsetParent !== null).map((d) => (d.innerText || '').trim().slice(0, 300)),
    formErrors: Array.from(document.querySelectorAll('.el-dialog:visible .el-form-item__error, .el-dialog .el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
    dlgStillOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
  }));
  console.log('VALIDATION=', JSON.stringify(vld, null, 1));
  console.log('APIS_AFTER_CONFIRM=', JSON.stringify(apis.slice(-8), null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_04_after_confirm.png') });

  // 取消关闭
  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
