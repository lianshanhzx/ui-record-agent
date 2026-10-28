// probe40: S4 股东信息-修改 探路
// 目标：1) 股东表行选中方式(radio/checkbox/行内按钮) 2) 修改按钮位置 3) 修改弹窗结构/预填/保存按钮文案
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(3000);

  const pane = page.locator('.el-tab-pane:visible').last();

  // 1) 工具栏按钮
  const toolbarBtns = await pane.locator('.el-button, button').allInnerTexts();
  console.log('TOOLBAR_BTNS=', JSON.stringify(toolbarBtns.map((s) => s.trim()).filter(Boolean)));

  // 2) 表头
  const headers = await pane.locator('.el-table__header-wrapper th .cell').allInnerTexts();
  console.log('HEADERS=', JSON.stringify(headers.map((s) => s.trim())));

  // 3) 行 radio/checkbox
  const rowRadios = await pane.locator('.el-table__body tbody tr input[type="radio"]').count();
  const rowChecks = await pane.locator('.el-table__body tbody tr input[type="checkbox"]').count();
  console.log('ROW_RADIO=', rowRadios, 'ROW_CHECK=', rowChecks);

  // 4) 首行单元格 + 行内按钮
  const firstRow = pane.locator('.el-table__body tbody tr').first();
  const firstRowTexts = await firstRow.locator('td .cell').allInnerTexts();
  console.log('FIRST_ROW=', JSON.stringify(firstRowTexts.map((s) => s.trim().slice(0, 30))));
  const firstRowBtns = await firstRow.locator('button, .el-button, a').allInnerTexts();
  console.log('FIRST_ROW_BTNS=', JSON.stringify(firstRowBtns.map((s) => s.trim()).filter(Boolean)));

  // 5) 试点行内「修改」(若有) 或工具栏「修改」
  let modifyClicked = false;
  const rowModify = firstRow.getByRole('button').filter({ hasText: /修\s*改/ }).first();
  if (await rowModify.count()) {
    console.log('CLICK row-modify');
    await rowModify.click();
    modifyClicked = true;
  } else {
    // 先选中首行 radio(若存在)
    if (rowRadios) await firstRow.locator('input[type="radio"]').first().evaluate((el) => el.click());
    if (rowChecks) await firstRow.locator('input[type="checkbox"]').first().evaluate((el) => el.click());
    await sleep(500);
    const tbModify = pane.getByRole('button').filter({ hasText: /修\s*改/ }).first();
    if (await tbModify.count()) {
      console.log('CLICK toolbar-modify');
      await tbModify.click();
      modifyClicked = true;
    }
  }
  await sleep(2500);

  // 6) 弹窗结构
  const D = '.el-dialog:visible';
  const dlgTitle = await page.locator(`${D} .el-dialog__title`).allInnerTexts().catch(() => []);
  console.log('DLG_TITLE=', JSON.stringify(dlgTitle.map((s) => s.trim())));
  const labels = await page.locator(`${D} .el-form-item label`).allInnerTexts().catch(() => []);
  console.log('DLG_LABELS=', JSON.stringify(labels.map((s) => s.trim()).filter(Boolean)));

  // 7) 预填值
  const prefilled = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.el-dialog .el-form-item').forEach((fi) => {
      const lb = (fi.querySelector('label') || {}).innerText?.trim();
      if (!lb) return;
      const inp = fi.querySelector('input') || fi.querySelector('textarea');
      const sel = fi.querySelector('.el-input__inner');
      const val = (inp && inp.value) || (sel && sel.value) || '';
      if (val) out[lb] = String(val).slice(0, 40);
    });
    return out;
  });
  console.log('PREFILLED=', JSON.stringify(prefilled));

  // 8) 弹窗按钮
  const dlgBtns = await page.locator(`${D} .el-dialog__footer button, ${D} button`).allInnerTexts().catch(() => []);
  console.log('DLG_BTNS=', JSON.stringify(dlgBtns.map((s) => s.trim()).filter(Boolean)));

  await page.screenshot({ path: path.join(DIR, 'probe40_modify_dialog.png') });
  console.log('DONE modifyClicked=', modifyClicked);
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
