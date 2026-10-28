// probe_smbsn_28.js - 最终探路: 选项枚举(Playwright :visible) + 引入弹窗 + 日期格式 + 确定校验
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: false });
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
  const FI = (lb) => page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first();

  const openSel = async (lb) => {
    await FI(lb).locator('.el-select').first().click({ timeout: 5000 });
    const dd = page.locator('.el-select-dropdown:visible').last();
    await dd.waitFor({ state: 'visible', timeout: 5000 });
    const opts = await dd.locator('.el-select-dropdown__item').allInnerTexts();
    return opts.map((s) => s.trim()).filter(Boolean);
  };
  const pickOpt = async (lb, txt) => {
    const dd = page.locator('.el-select-dropdown:visible').last();
    if (!(await dd.count())) {
      await FI(lb).locator('.el-select').first().click({ timeout: 5000 });
      await dd.waitFor({ state: 'visible', timeout: 5000 });
    }
    await dd.locator('.el-select-dropdown__item').filter({ hasText: txt }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
  };

  // ---- 1) 选项枚举 ----
  console.log('OPTS[股东类型]=', JSON.stringify(await openSel('股东类型')));
  await pickOpt('股东类型', '法人或其他组织');
  const val1 = await FI('股东类型').locator('.el-input__inner').inputValue();
  console.log('股东类型 value=', JSON.stringify(val1));
  console.log('OPTS[证件类型]=', JSON.stringify(await openSel('证件类型')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log('OPTS[币种]=', JSON.stringify(await openSel('币种')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log('OPTS[出资方式]=', JSON.stringify(await openSel('出资方式')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ---- 2) 出资时间 date picker ----
  const dateInp = FI('出资时间').locator('input').first();
  await dateInp.click({ timeout: 5000 }).catch((e) => console.log('DATE_CLICK_FAIL', e.message.split('\n')[0]));
  await page.waitForTimeout(1500);
  const dateInfo = await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('.el-date-editor, .el-picker-panel, .el-date-picker, .el-month-table, .el-year-table')).filter((d) => d.offsetParent !== null);
    return p.map((d) => d.className).slice(0, 5);
  });
  console.log('DATE_PANEL=', JSON.stringify(dateInfo));
  await page.screenshot({ path: path.join(DIR, 's3_13_date.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ---- 3) 引入弹窗（股东类型已选）----
  await FI('股东名称').getByRole('button').filter({ hasText: /引\s*入/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(3500);
  const impDump = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog, .el-drawer')).filter((d) => d.offsetParent !== null);
    if (!ds.length) return null;
    const d = ds[ds.length - 1];
    const title = ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim();
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
  console.log('IMP_DLG=', JSON.stringify(impDump, null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_14_import.png') });

  if (impDump) {
    const LAST = () => page.locator('.el-dialog:visible, .el-drawer:visible').last();
    // 引入弹窗 select 选项
    for (const f of impDump.fields.filter((x) => x.type === 'select')) {
      try {
        const sloc = LAST().locator('.el-form-item').filter({ has: page.locator('label', { hasText: f.label }) }).first().locator('.el-select').first();
        await sloc.click({ timeout: 4000 });
        const dd = page.locator('.el-select-dropdown:visible').last();
        await dd.waitFor({ state: 'visible', timeout: 4000 });
        const opts = (await dd.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
        console.log(`IMP_OPTS[${f.label}]=`, JSON.stringify(opts));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      } catch (e) { console.log(`IMP_OPTS[${f.label}]= FAIL ${e.message.split('\n')[0]}`); }
    }
    // 查询按钮 → API
    const qBtn = LAST().getByRole('button').filter({ hasText: /查\s*询/ });
    if (await qBtn.count()) {
      const respP = page.waitForResponse((r) => r.request().method() === 'POST' && /cst|Cst|Personal|Org|customer|trade|Trade/i.test(r.url()), { timeout: 20000 }).catch(() => null);
      await qBtn.first().click();
      const resp = await respP;
      await page.waitForTimeout(3000);
      console.log('IMP_QUERY_API=', resp ? resp.url().replace(BASE, '') : 'none');
      const rows = await page.evaluate(() => {
        const d = Array.from(document.querySelectorAll('.el-dialog, .el-drawer')).filter((x) => x.offsetParent !== null).pop();
        if (!d) return null;
        return Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).slice(0, 3).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 25)));
      });
      console.log('IMP_ROWS=', JSON.stringify(rows));
    }
    // 关闭引入弹窗
    await LAST().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  // ---- 4) 只选了股东类型 → 点确定看校验 ----
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await page.waitForTimeout(3500);
  const vld = await page.evaluate(() => ({
    messages: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
    msgbox: Array.from(document.querySelectorAll('.el-message-box')).filter((d) => d.offsetParent !== null).map((d) => (d.innerText || '').trim().slice(0, 300)),
    formErrors: Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
    dlgOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
  }));
  console.log('VALIDATION=', JSON.stringify(vld, null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_15_validation.png') });

  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
