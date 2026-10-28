// probe_smbsn_8.js - 调查机构弹窗: 行数据/选择机制/确认
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
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('有效')) console.log('CONSOLE=', m.type(), m.text().slice(0, 150)); });

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
  const dlg = page.locator('.el-dialog:visible').last();

  const rowsDump = await dlg.evaluate((d) => {
    const trs = Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).slice(0, 5);
    return trs.map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 24)));
  });
  console.log('ROWS=', JSON.stringify(rowsDump, null, 1));
  const headers = await dlg.evaluate((d) => Array.from(d.querySelectorAll('.el-dialog__header, .el-dialog .el-table th, .el-dialog thead th')).map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 20));
  console.log('HEADERS=', JSON.stringify(headers));

  // 尝试1: 直接点 radio label
  const r0 = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('label.el-radio').first();
  await r0.click({ timeout: 5000 }).catch((e) => console.log('CLICK_LABEL_ERR', e.message.slice(0, 60)));
  await page.waitForTimeout(600);
  let st = await dlg.evaluate((d) => {
    const inp = d.querySelector('.el-table__body-wrapper .el-table__body tbody tr input[type=radio]');
    return { checked: inp ? inp.checked : null };
  });
  console.log('AFTER_LABEL_CLICK=', JSON.stringify(st));

  // 尝试2: dispatch click 到 input
  await dlg.evaluate((d) => {
    const inp = d.querySelector('.el-table__body-wrapper .el-table__body tbody tr input[type=radio]');
    if (inp) { inp.click(); }
  });
  await page.waitForTimeout(600);
  st = await dlg.evaluate((d) => {
    const trs = d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
    const inp = trs[0] && trs[0].querySelector('input[type=radio]');
    return { checked: inp ? inp.checked : null, rowCls: trs[0] ? trs[0].className : '' };
  });
  console.log('AFTER_INP_CLICK=', JSON.stringify(st));

  // 尝试3: 点行(非radio区)
  await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('td').nth(3).click({ timeout: 5000 }).catch((e) => console.log('ROW_CLICK_ERR', e.message.slice(0, 60)));
  await page.waitForTimeout(600);
  st = await dlg.evaluate((d) => {
    const trs = d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
    return Array.from(trs).slice(0, 3).map((t) => t.className + ' :: ' + (t.querySelector('input[type=radio]') ? t.querySelector('input[type=radio]').checked : '?'));
  });
  console.log('AFTER_ROW_CLICK=', JSON.stringify(st));

  await dlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const open = await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  const val = await item.locator('input').first().inputValue().catch(() => '');
  console.log('DLG_OPEN=', open, 'SURVY_VAL=', val);
  if (open) await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(1000);
  // 返回列表
  await page.locator('button', { hasText: /返\s*回/ }).first().click().catch(() => {});
  await page.waitForTimeout(3000);
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
