const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (r.request().method() !== 'POST' || !/tansun|cust/.test(u)) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    apis.push('POST ' + u.split('/').filter(Boolean).slice(-2).join('/') + ' body=' + body);
  });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);

  const dlg = () => page.locator('.el-dialog:visible').last();
  const fi = (lb) => dlg().locator('.el-form-item').filter({ hasText: lb }).first();

  // 1) 各 select 选项（点击 .el-select 触发下拉，枚举可见 dropdown 项）
  const labels = ['高管类别', '证件类型', '性别', '职业', '职务名称', '职称', '最高学历', '最高学位'];
  const options = {};
  for (const lb of labels) {
    const item = fi(lb);
    const sel = item.locator('.el-select').first();
    const n = await sel.count();
    if (!n) { options[lb] = 'NO_SELECT'; continue; }
    await sel.locator('input, .el-select__caret').first().click({ timeout: 8000 }).catch(async () => sel.click({ timeout: 8000 }));
    await sleep(1000);
    const dd = page.locator('.el-select-dropdown:visible').last();
    const hasDd = await dd.count().catch(() => 0);
    if (hasDd) {
      const opts = await dd.locator('.el-select-dropdown__item').allInnerTexts().catch(() => []);
      options[lb] = opts.map((s) => s.trim()).filter(Boolean).slice(0, 30);
    } else {
      // 自定义 multi-select：dump 可见弹层
      options[lb] = await page.evaluate(() => {
        const dds = Array.from(document.querySelectorAll('.el-select-dropdown, .tssc-multi-select-dropdown, .el-popover')).filter((x) => x.offsetParent !== null);
        return dds.map((d) => Array.from(d.querySelectorAll('li, .el-select-dropdown__item, [class*="option"], [class*="item"]')).map((i) => (i.innerText || '').trim()).filter(Boolean).slice(0, 30));
      });
    }
    await page.keyboard.press('Escape');
    await sleep(600);
  }
  console.log('P56C_OPTIONS=' + JSON.stringify(options, null, 1));

  // 2) 引入弹窗（关联客户名称旁的 引入）
  const impBtn = fi('关联客户名称').locator('button').filter({ hasText: /引\s*入/ }).first();
  await impBtn.click({ timeout: 8000 });
  await sleep(3000);
  const impOv = await page.evaluate(() => {
    const out = [];
    Array.from(document.querySelectorAll('.el-dialog, .el-drawer')).forEach((el) => {
      if (el.offsetParent === null) return;
      const title = ((el.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim();
      const items = Array.from(el.querySelectorAll('.el-form-item')).map((f) => {
        const l2 = ((f.querySelector('label') || {}).innerText || '').trim();
        const inp = f.querySelector('input, .el-select');
        return l2 + ':' + (inp ? (inp.tagName === 'SELECT' ? 'select' : 'input') : '?');
      });
      const heads = Array.from(el.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()).filter(Boolean);
      const btns = Array.from(el.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
      out.push({ cls: (el.className || '').toString().slice(0, 60), title, items: items.slice(0, 10), heads, btns });
    });
    return out;
  });
  console.log('P56C_IMPORT_OV=' + JSON.stringify(impOv, null, 1));
  console.log('P56C_APIS=' + JSON.stringify(apis.slice(-8), null, 1));
  fs.writeFileSync(path.join(__dirname, 'p56-options.json'), JSON.stringify(options, null, 2), 'utf8');
  await browser.close();
})().catch((e) => { console.error('P56C_ERROR', e.message); process.exit(1); });
