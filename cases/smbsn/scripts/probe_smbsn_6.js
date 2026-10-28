// probe_smbsn_6.js - 诊断引入弹窗 Radio 选择机制 + 确认行为
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
  const toasts = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.el-message, .el-notification__content'))
        .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()).filter(Boolean));

  // 直接进入已存在的场景页(探路期草稿客户)
  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  // 选中首行(草稿 AT_SMB) 修改? 不 — 直接新增一个新抽屉保存更干净
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

  // ---- 调查机构引入弹窗 ----
  const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '调查机构' }) }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('button', { hasText: /引\s*入/ }).first().click();
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 });
  await page.waitForTimeout(2000);
  const dlg = page.locator('.el-dialog:visible').last();

  const rowHtml = await dlg.evaluate((d) => {
    const tr = d.querySelector('.el-table__body-wrapper .el-table__body tbody tr');
    return tr ? tr.outerHTML.slice(0, 1200) : 'NO_ROW';
  });
  console.log('ROW_HTML=', rowHtml);

  const radioSel = await dlg.evaluate((d) => {
    const tr = d.querySelector('.el-table__body-wrapper .el-table__body tbody tr');
    if (!tr) return 'NO_ROW';
    return Array.from(tr.querySelectorAll('*')).slice(0, 14).map((e) => e.tagName + '.' + e.className).join(' | ');
  });
  console.log('ROW_NODES=', radioSel);

  // 尝试点击第一行第一个 radio 候选
  const cell = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('td').first();
  await cell.click({ timeout: 5000 }).catch((e) => console.log('CELL_CLICK_ERR', e.message.slice(0, 80)));
  await page.waitForTimeout(800);
  const selState1 = await dlg.evaluate((d) => {
    const trs = d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
    const tr = trs[0];
    return {
      rowCls: tr.className,
      checked: !!d.querySelector('.el-radio__original:checked, input[type=radio]:checked'),
      isDot: !!tr.querySelector('.is-checked, .el-radio__original:checked'),
    };
  });
  console.log('SEL_AFTER_CELL=', JSON.stringify(selState1));
  // 点第二行单元格看看互斥
  await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(1).locator('td').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const selState2 = await dlg.evaluate((d) => {
    const trs = d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
    return Array.from(trs).slice(0, 3).map((tr, i) => i + ':' + tr.className);
  });
  console.log('SEL_AFTER_ROW2=', JSON.stringify(selState2));

  // 确认
  const rOk = dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first();
  const okDisabled = await rOk.isDisabled().catch(() => 'n/a');
  console.log('CONFIRM_DISABLED=', okDisabled);
  await rOk.click({ timeout: 5000 }).catch((e) => console.log('CONFIRM_ERR', e.message.slice(0, 80)));
  await page.waitForTimeout(2500);
  const open = await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  console.log('DLG_OPEN_AFTER_CONFIRM=', open);
  console.log('TOASTS=', JSON.stringify(await toasts()));
  if (open) {
    await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(1000);
  }
  const val = await item.locator('input').first().inputValue().catch(() => '');
  console.log('SURVY_VAL=', val);
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
