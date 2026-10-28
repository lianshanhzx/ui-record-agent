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
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').fill(CUST_NO);
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
  await page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);

  // 找持有 subscFnddDt 的组件（沿日期输入框向上）
  const owner = () =>
    page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
      let v = el && el.__vue__;
      for (let i = 0; i < 20 && v; i++) {
        const hits = [];
        for (const scope of [v._data, v.$props]) {
          if (!scope) continue;
          for (const k of Object.keys(scope)) {
            const val = scope[k];
            if (val && typeof val === 'object' && 'subscFnddDt' in val) hits.push((scope === v._data ? 'data' : 'props') + '.' + k);
          }
        }
        if (hits.length) return JSON.stringify({ L: i, name: (v.$options && (v.$options.name || v.$options._componentTag)) || '?', scopes: hits });
        v = v.$parent;
      }
      return 'NOT_FOUND';
    });
  console.log('OWNER=', await owner());

  const dtVal = (tag) =>
    page.evaluate((t) => {
      const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
      let v = el && el.__vue__;
      for (let i = 0; i < 20 && v; i++) {
        for (const scope of [v._data, v.$props]) {
          if (!scope) continue;
          for (const k of Object.keys(scope)) {
            const val = scope[k];
            if (val && typeof val === 'object' && 'subscFnddDt' in val) {
              console.log && 0;
              return t + ' L' + i + '.' + k + ' subscFnddDt=' + JSON.stringify(val.subscFnddDt) + ' 全部键=' + Object.keys(val).join(',').slice(0, 300);
            }
          }
        }
        v = v.$parent;
      }
      return t + ' NOT_FOUND';
    }, tag);

  // 填日期
  const D = '.el-dialog:visible';
  const dateInp = page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '出资时间' }) }).first().locator('input').first();
  await dateInp.click();
  await dateInp.fill('2026-09-28');
  await dateInp.press('Enter');
  await sleep(800);
  console.log('填后 =>', await dtVal('填后'));

  // 找确定按钮的处理函数源码
  console.log('METHODS=', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    const out = [];
    for (let i = 0; i < 20 && v; i++) {
      const ms = (v.$options && v.$options.methods) || {};
      for (const name of Object.keys(ms)) {
        const src = ms[name].toString();
        if (/subscFnddDt|FnddDt/i.test(src)) out.push({ L: i, comp: (v.$options.name || v.$options._componentTag || '?'), name, len: src.length });
      }
      v = v.$parent;
    }
    return JSON.stringify(out);
  }));

  // 抓含 subscFnddDt 的函数源码
  fs.writeFileSync(path.join(DIR, 's3_methods.txt'), await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    let out = '';
    for (let i = 0; i < 20 && v; i++) {
      const ms = (v.$options && v.$options.methods) || {};
      for (const name of Object.keys(ms)) {
        const src = ms[name].toString();
        if (/subscFnddDt/i.test(src)) out += '===== L' + i + ' ' + (v.$options.name || '?') + '.' + name + ' =====\n' + src + '\n\n';
      }
      v = v.$parent;
    }
    return out || 'NONE';
  }));
  console.log('METHOD_SRC saved, size=', fs.readFileSync(path.join(DIR, 's3_methods.txt'), 'utf8').length);

  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(2500);
  console.log('确定后 =>', await dtVal('确定后'));

  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
  await sleep(600);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
