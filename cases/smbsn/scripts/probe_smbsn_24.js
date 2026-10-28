// probe_smbsn_24.js - 股东信息新增弹窗 DOM 诊断: select 打开机制 + 引入真实载体 + 确定校验
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

  // ---- 1) 股东类型 form-item DOM ----
  const html = await page.evaluate(() => {
    const f = Array.from(document.querySelectorAll('.el-dialog .el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes('股东类型'));
    return f ? f.outerHTML.slice(0, 2500) : 'NOT_FOUND';
  });
  console.log('ITEM_HTML=', html);

  // ---- 2) 多种打开方式 ----
  const fi = page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '股东类型' }) }).first();
  const tryOpen = async (name, loc) => {
    await loc.click({ timeout: 3000 }).catch(async () => {
      await loc.dispatchEvent('mousedown').catch(() => {});
      await loc.dispatchEvent('mouseup').catch(() => {});
      await loc.dispatchEvent('click').catch(() => {});
    });
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => {
      const dds = Array.from(document.querySelectorAll('.el-select-dropdown'));
      return { n: dds.length, visible: dds.filter((d) => d.offsetParent !== null).length,
        opts: dds.filter((d) => d.offsetParent !== null).flatMap((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim())) };
    });
    console.log(`OPEN[${name}]=`, JSON.stringify(st));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    return st.visible > 0;
  };
  let opened = false;
  if (!(opened = await tryOpen('selDiv', fi.locator('.el-select').first())))
    if (!(opened = await tryOpen('inputWrap', fi.locator('.el-input').first())))
      if (!(opened = await tryOpen('arrow', fi.locator('.el-input__suffix').first())))
        console.log('SELECT 全部打开方式失败');

  // ---- 3) 引入按钮: 点击后监测新增 dialog/drawer ----
  const before = await page.evaluate(() => ({
    dlg: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
    drawer: Array.from(document.querySelectorAll('.el-drawer')).filter((d) => d.offsetParent !== null).length,
  }));
  const impBtn = page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '股东名称' }) }).first().getByRole('button');
  console.log('IMP_BTN_COUNT=', await impBtn.count(), 'texts=', JSON.stringify(await impBtn.allInnerTexts()));
  await impBtn.filter({ hasText: /引\s*入/ }).first().click({ timeout: 5000 }).catch((e) => console.log('IMP_CLICK_FAIL:', e.message.split('\n')[0]));
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({
    dlg: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
    drawer: Array.from(document.querySelectorAll('.el-drawer')).filter((d) => d.offsetParent !== null).length,
    msg: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
  }));
  console.log('BEFORE=', JSON.stringify(before), 'AFTER=', JSON.stringify(after));
  await page.screenshot({ path: path.join(DIR, 's3_05_after_import_click.png') });

  // 若打开了 drawer，dump
  const drawerDump = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-drawer')).filter((d) => d.offsetParent !== null);
    if (!ds.length) return null;
    const d = ds[ds.length - 1];
    const title = ((d.querySelector('.el-drawer__title') || {}).innerText || '').trim();
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
  console.log('DRAWER_DUMP=', JSON.stringify(drawerDump, null, 1));

  // 若打开了新 dialog（最后一个），dump
  const dlgDump = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    if (ds.length < 2) return null;
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
  console.log('NEW_DLG_DUMP=', JSON.stringify(dlgDump, null, 1));

  // 关闭可能打开的浮层
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.locator('.el-drawer:visible button, .el-dialog:visible button').filter({ hasText: /取\s*消/ }).last().click().catch(() => {});
  await page.waitForTimeout(1500);

  // ---- 4) 空表单点确定 → 校验行为 ----
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await page.waitForTimeout(4000);
  const vld = await page.evaluate(() => ({
    messages: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
    msgbox: Array.from(document.querySelectorAll('.el-message-box')).filter((d) => d.offsetParent !== null).map((d) => (d.innerText || '').trim().slice(0, 300)),
    formErrors: Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
    dlgStillOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
  }));
  console.log('VALIDATION=', JSON.stringify(vld, null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_06_after_confirm.png') });

  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
