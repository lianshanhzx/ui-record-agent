// probe_smbsn_26.js - tssc-multi-select Vue 实例内省: 找打开下拉的事件绑定
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

  // ---- Vue 实例内省 ----
  const info = await page.evaluate(() => {
    const wrap = document.querySelector('.el-dialog .tssc-multi-select');
    if (!wrap) return null;
    const out = { wraps: 0 };
    const dump = (v, tag) => {
      if (!v) { out[tag] = 'NO_VUE'; return; }
      out[tag] = {
        name: v.$options.name || v.$options._componentTag,
        listeners: Object.keys(v.$listeners || {}),
        props: v.$props ? Object.keys(v.$props) : null,
        dataKeys: v.$data ? Object.keys(v.$data) : null,
        computedKeys: Object.keys(v.$options.computed || {}),
        methodKeys: Object.keys(v.$options.methods || {}),
        propsData: v.$options.propsData || null,
      };
    };
    // 外层 tssc-multi-select 组件实例
    let v = wrap.__vue__;
    while (v && !(v.$options.name || '').includes('multi') && v.$parent) v = v.$parent;
    dump(wrap.__vue__, 'wrap');
    const sel = wrap.querySelector('.el-select');
    if (sel && sel.__vue__) dump(sel.__vue__, 'innerElSelect');
    // 场景页基本信息 tab 里的普通 select 作对照
    const sceneSel = document.querySelector('.el-form-item .el-select');
    if (sceneSel && sceneSel.__vue__) dump(sceneSel.__vue__, 'sceneCompare');
    // 事件: 检查 input 上的 vue 事件绑定
    const input = wrap.querySelector('.el-input__inner');
    if (input && input.__vue__) out['inputVue'] = input.__vue__.$listeners ? Object.keys(input.__vue__.$listeners) : null;
    return out;
  });
  console.log('VUE_INFO=', JSON.stringify(info, null, 1));

  // ---- 尝试: 点 .tssc-multi-select 包装层 / hover ----
  const ddVis = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-dialog .el-select-dropdown')).filter((d) => d.offsetParent !== null).length);
  const ms = page.locator('.el-dialog:visible .tssc-multi-select').first();
  await ms.hover().catch(() => {});
  await page.waitForTimeout(1500);
  console.log('AFTER_HOVER ddVis=', await ddVis());
  await ms.click({ position: { x: 20, y: 10 }, timeout: 3000 }).catch((e) => console.log('wrapClick fail', e.message.split('\n')[0]));
  await page.waitForTimeout(1500);
  console.log('AFTER_WRAP_CLICK ddVis=', await ddVis());

  // page.mouse 精确点击 input 中心
  const box = await page.locator('.el-dialog:visible .el-form-item').filter({ has: page.locator('label', { hasText: '股东类型' }) }).first().locator('.el-input__inner').boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    console.log('AFTER_MOUSE ddVis=', await ddVis());
  }
  // 若打开则选 法人或其他组织
  if (await ddVis()) {
    await page.locator('.el-dialog:visible .el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '法人或其他组织' }).first().click();
    await page.waitForTimeout(1500);
    const disp = await page.evaluate(() => {
      const f = Array.from(document.querySelectorAll('.el-dialog .el-form-item')).find((x) => (x.querySelector('label') || {}).innerText.includes('股东类型'));
      return f ? (f.querySelector('.el-input__inner') || {}).value : null;
    });
    console.log('股东类型 VALUE=', JSON.stringify(disp));
    // 引入
    await page.locator('.el-dialog:visible .el-form-item').filter({ has: page.locator('label', { hasText: '股东名称' }) }).first().getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
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
    await page.screenshot({ path: path.join(DIR, 's3_10_import.png') });
    // 引入弹窗内证件类型/其他 select 选项（tssc-multi-select 同机制）
    if (impDump) {
      for (const f of impDump.fields.filter((x) => x.type === 'select')) {
        const sel = page.locator('.el-dialog:visible, .el-drawer:visible').last().locator('.el-form-item').filter({ has: page.locator('label', { hasText: f.label }) }).first();
        const w = sel.locator('.tssc-multi-select').first();
        if (!(await w.count())) continue;
        const b2 = await w.locator('.el-input__inner').boundingBox();
        if (!b2) continue;
        await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
        await page.mouse.down(); await page.mouse.up();
        await page.waitForTimeout(1500);
        const opts = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null)
            .flatMap((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim())));
        console.log(`IMP_OPTS[${f.label}]=`, JSON.stringify(opts));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
      // 查询按钮 + API
      const qBtn = page.locator('.el-dialog:visible, .el-drawer:visible').last().getByRole('button').filter({ hasText: /查\s*询/ });
      if (await qBtn.count()) {
        const respP = page.waitForResponse((r) => r.request().method() === 'POST' && /cst|Cst|Personal|Org|customer/i.test(r.url()), { timeout: 20000 }).catch(() => null);
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
      await page.locator('.el-dialog:visible, .el-drawer:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    // 只选股东类型 → 点确定看校验
    await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
    await page.waitForTimeout(3500);
    const vld = await page.evaluate(() => ({
      messages: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
      formErrors: Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
      dlgOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
    }));
    console.log('VALIDATION=', JSON.stringify(vld, null, 1));
    await page.screenshot({ path: path.join(DIR, 's3_11_validation.png') });
  }
  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
