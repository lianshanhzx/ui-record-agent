// probe57: 关联人新增全流程 dry-run——引入真实客户→按格式填值→确定保存→验证落表
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
    if (r.request().method() !== 'POST' || !/tansun|cust/i.test(u)) return;
    if (/dict|menu|session|theme|param|holiday|link|permission|portal|microDef|WrkDay|databaseTime|checkInit/i.test(u)) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 400); } catch {}
    let resp = '';
    try { resp = (JSON.stringify(await r.json()) || '').slice(0, 400); } catch {}
    apis.push({ api: u.split('/').filter(Boolean).slice(-2).join('/'), body, resp });
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

  // 1) 引入关联客户
  await fi('关联客户名称').locator('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);
  const imp = page.locator('.el-dialog:visible').last();
  const impQ = page.waitForResponse((r) => r.request().method() === 'POST' && /cust/i.test(r.url()) && !/findCustTradeList|queryCustCorporatRelatedParty|getCustTrade/i.test(r.url()), { timeout: 30000 }).catch(() => null);
  await imp.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const impResp = await impQ;
  await sleep(2000);
  const impRows = await imp.evaluate((el) => {
    const heads = Array.from(el.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim());
    return Array.from(el.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).slice(0, 10).map((tr) => {
      const cells = Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim());
      const o = {}; heads.forEach((h, i) => { if (h) o[h] = cells[i] || ''; });
      return o;
    });
  });
  console.log('P57_IMPORT_ROWS=' + JSON.stringify(impRows, null, 1));
  if (impResp) { try { const j = await impResp.json(); console.log('P57_IMPORT_API=' + impResp.url().split('/').filter(Boolean).slice(-2).join('/') + ' total=' + (j?.data?.total)); } catch {} }

  // 选首行（有 客户状态 可用的）
  const rowLoc = imp.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await rowLoc.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await imp.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await sleep(2500);

  // 读自动回填
  const auto = await page.evaluate(() => {
    const d = Array.from(document.querySelectorAll('.el-dialog')).find((x) => x.offsetParent !== null && (x.className || '').includes('dialog467'));
    if (!d) return null;
    const o = {};
    for (const f of d.querySelectorAll('.el-form-item')) {
      const lb = ((f.querySelector('label') || {}).innerText || '').trim();
      if (!/关联客户|证件类型|证件号码/.test(lb)) continue;
      const inp = f.querySelector('input, textarea');
      o[lb] = inp ? (inp.value || '').trim() : '';
    }
    return o;
  });
  console.log('P57_AUTO_FILL=' + JSON.stringify(auto));

  // 2) 证件类型选项
  await fi('证件类型').locator('.el-select').first().click({ timeout: 8000 });
  await sleep(1200);
  const crdtOpts = await page.evaluate(() => {
    const dds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((x) => x.offsetParent !== null || x.style.display !== 'none');
    return dds.map((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((i) => (i.innerText || '').trim()).filter(Boolean));
  });
  console.log('P57_CREDIT_OPTS=' + JSON.stringify(crdtOpts));

  console.log('P57_APIS_SO_FAR=' + JSON.stringify(apis.slice(-6), null, 1));
  await browser.close();
})().catch((e) => { console.error('P57_ERROR', e.message); process.exit(1); });
