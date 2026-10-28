// probe_smbsn_27.js - 事件间谍 + ElSelect.visible 状态 + 场景表单 select 对照
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

  // ---- 对照: 基本信息 tab 的场景 select 能否点开 ----
  await page.locator('.el-tabs__item').filter({ hasText: '基本信息' }).first().click();
  await page.waitForTimeout(1500);
  const cmpSel = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '同业客户类型' }) }).first().locator('.el-select').first();
  await cmpSel.click({ timeout: 5000 }).catch((e) => console.log('CMP_CLICK_FAIL', e.message.split('\n')[0]));
  await page.waitForTimeout(2000);
  const cmp = await page.evaluate(() => {
    const f = Array.from(document.querySelectorAll('.el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes('同业客户类型'));
    const sel = f ? f.querySelector('.el-select') : null;
    const v = sel && sel.__vue__;
    const dds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null);
    const dd = dds[dds.length - 1] || null;
    return { vueVisible: v ? v.visible : null, ddVisibleInDoc: !!dd, ddOpts: dd ? Array.from(dd.querySelectorAll('.el-select-dropdown__item')).slice(0, 8).map((o) => o.innerText.trim()) : [] };
  });
  console.log('SCENE_CMP=', JSON.stringify(cmp));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // ---- 股东信息 tab → 新增 → 事件间谍 ----
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(2000);
  await page.locator('.el-tab-pane:visible button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    window.__spy = [];
    const log = (type) => (e) => window.__spy.push(`${type}:${(e.target.tagName || '')}.${(e.target.className || '').toString().slice(0, 40)}`);
    document.addEventListener('mousedown', log('down'), true);
    document.addEventListener('mouseup', log('up'), true);
    document.addEventListener('click', log('click'), true);
  });

  const D = '.el-dialog:visible';
  const fi = page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '股东类型' }) }).first();

  const st = async (tag) => {
    const r = await page.evaluate(() => {
      const f = Array.from(document.querySelectorAll('.el-dialog .el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes('股东类型'));
      const sel = f ? f.querySelector('.el-select') : null;
      const v = sel && sel.__vue__;
      const dd = Array.from(document.querySelectorAll('.el-dialog .el-select-dropdown'));
      return { vueVisible: v ? v.visible : 'NOVUE', ddDisp: dd.map((d) => d.style.display), spy: window.__spy ? window.__spy.slice(-6) : null };
    });
    console.log(tag, JSON.stringify(r));
    return r;
  };

  await st('BEFORE ');
  await fi.locator('.el-select').first().click({ timeout: 5000 }).catch((e) => console.log('CLICK_FAIL', e.message.split('\n')[0]));
  await page.waitForTimeout(1000);
  await st('AFTER1S');
  await page.waitForTimeout(2000);
  await st('AFTER3S');

  // 若仍未开, 直接调 toggleMenu 诊断
  const direct = await page.evaluate(() => {
    const f = Array.from(document.querySelectorAll('.el-dialog .el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes('股东类型'));
    const sel = f ? f.querySelector('.el-select') : null;
    const v = sel && sel.__vue__;
    if (!v) return 'NOVUE';
    try { v.toggleMenu(); } catch (e) { return 'TOGGLE_ERR ' + e.message; }
    return 'toggled, visible=' + v.visible;
  });
  await page.waitForTimeout(1000);
  console.log('DIRECT_TOGGLE=', direct, JSON.stringify(await st('AFTERTGL').then((r) => ({ ddDisp: r.ddDisp, vueVisible: r.vueVisible }))));

  // 若 toggleMenu 能让下拉出现, 选 法人或其他组织 并验证引入
  const openNow = await page.evaluate(() => Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null).length);
  if (openNow) {
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '法人或其他组织' }).first().click().catch((e) => console.log('OPT_FAIL', e.message.split('\n')[0]));
    await page.waitForTimeout(1500);
    const val = await page.evaluate(() => {
      const f = Array.from(document.querySelectorAll('.el-dialog .el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes('股东类型'));
      return f ? (f.querySelector('.el-input__inner') || {}).value : null;
    });
    console.log('股东类型 value=', JSON.stringify(val));
    if (val) {
      await page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '股东名称' }) }).first().getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
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
      await page.screenshot({ path: path.join(DIR, 's3_12_import.png') });
      // 引入弹窗取消
      await page.locator('.el-dialog:visible, .el-drawer:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
