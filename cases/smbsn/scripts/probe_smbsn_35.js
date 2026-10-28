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

  // 1) 列出 dialog 内所有 .el-form 的 fields
  console.log('FORMS=', await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    return Array.from(d.querySelectorAll('.el-form')).map((f) => {
      const v = f.__vue__;
      return { cls: (f.className || '').slice(0, 60), fields: v && v.fields ? v.fields.length : 'noVue', props: v && v.fields ? v.fields.map((x) => x.prop).join(',') : '' };
    });
  }));

  // 2) picker 的 $parent 链
  console.log('PICKER_CHAIN=', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    const out = [];
    for (let i = 0; i < 10 && v; i++) {
      let dataKeys = '';
      try {
        const d = v.$options && v.$options._base ? null : null;
        dataKeys = v._data ? Object.keys(v._data).slice(0, 12).join(',') : '';
      } catch {}
      out.push({ L: i, name: v.$options && v.$options.name || v.$options && v.$options._componentTag || '?', data: dataKeys });
      v = v.$parent;
    }
    return JSON.stringify(out);
  }));

  // 3) 找 dialog 拥有者组件的 model（含日期字段的对象）
  console.log('MODEL_HUNT=', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    for (let i = 0; i < 12 && v; i++) {
      const dump = (obj, tag) => {
        try {
          const keys = Object.keys(obj);
          const dateKeys = keys.filter((k) => /dt|date|time/i.test(k));
          if (dateKeys.length) return tag + ':' + keys.map((k) => k + '=' + JSON.stringify(obj[k])).slice(0, 500);
        } catch {}
        return null;
      };
      // $data
      let r = v._data ? dump(v._data, 'data' + i) : null;
      if (r) return r;
      // props 里的对象
      try {
        for (const pk of Object.keys(v.$props || {})) {
          const pv = v.$props[pk];
          if (pv && typeof pv === 'object' && !Array.isArray(pv)) {
            const rr = dump(pv, 'prop' + i + '.' + pk);
            if (rr) return rr;
          }
        }
      } catch {}
      v = v.$parent;
    }
    return 'NOT_FOUND';
  }));

  // 4) 填日期
  const D = '.el-dialog:visible';
  const dateInp = page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: '出资时间' }) }).first().locator('input').first();
  await dateInp.click();
  await dateInp.fill('2026-09-28');
  await dateInp.press('Enter');
  await sleep(1000);
  console.log('AFTER_FILL MODEL_HUNT=', await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => i.offsetParent !== null);
    let v = el && el.__vue__;
    for (let i = 0; i < 12 && v; i++) {
      const dump = (obj, tag) => {
        try {
          const keys = Object.keys(obj);
          const dateKeys = keys.filter((k) => /dt|date|time/i.test(k));
          if (dateKeys.length) return tag + ':' + keys.map((k) => k + '=' + JSON.stringify(obj[k])).slice(0, 500);
        } catch {}
        return null;
      };
      let r = v._data ? dump(v._data, 'data' + i) : null;
      if (r) return r;
      try {
        for (const pk of Object.keys(v.$props || {})) {
          const pv = v.$props[pk];
          if (pv && typeof pv === 'object' && !Array.isArray(pv)) {
            const rr = dump(pv, 'prop' + i + '.' + pk);
            if (rr) return rr;
          }
        }
      } catch {}
      v = v.$parent;
    }
    return 'NOT_FOUND';
  }));

  // 5) 确定 + 看错误 + 再看 model
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(3000);
  console.log('AFTER_CONFIRM errors=', JSON.stringify(await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => e.innerText.trim())
  )));
  console.log('AFTER_CONFIRM dlgOpen=', await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length));

  await page.screenshot({ path: path.join(DIR, 's3_35_confirm.png') });
  // 取消
  await page.getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
  await sleep(800);
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
