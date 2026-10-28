// probe_smbsn_11.js - 测量 wire 所需 rect: 列表按钮/抽屉字段/暂存返回/引入弹窗 radio 行
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';

const N = (b) => ({ x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) });
const J = (o) => JSON.stringify(o);

(async () => {
  const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's1-values.json'), 'utf8'));
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = {};

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2500);

  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  const bb = async (loc) => N(await loc.boundingBox());

  out.listNm = await bb(formItem('客户名称').locator('input').first());
  out.listQuery = await bb(page.getByRole('button').filter({ hasText: /查\s*询/ }).first());
  out.listNew = await bb(page.getByRole('button').filter({ hasText: /新\s*增/ }).first());
  out.listModify = await bb(page.getByRole('button').filter({ hasText: /修\s*改/ }).first());

  // 抽屉
  await out.listNew && (await page.getByRole('button').filter({ hasText: /新\s*增/ }).first().click());
  await page.waitForSelector('.el-drawer:visible', { timeout: 15000 });
  await page.waitForTimeout(1500);
  const dIt = (lb) => page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  out.drawerRect = J(await bb(page.locator('.el-drawer:visible').last()));
  out.drawerType = await bb(dIt('证件类型').locator('.el-select, input').first());
  out.drawerNo = await bb(dIt('证件号码').locator('input').first());
  out.drawerNm = await bb(dIt('客户名称').locator('input').first());
  out.drawerSave = await bb(page.locator('.el-drawer:visible').getByRole('button').filter({ hasText: /保\s*存/ }).first());
  out.drawerCancel = await bb(page.locator('.el-drawer:visible').getByRole('button').filter({ hasText: /取\s*消/ }).first());
  await page.locator('.el-drawer:visible').getByRole('button').filter({ hasText: /取\s*消/ }).first().click();
  await page.waitForTimeout(1500);

  // 查询目标客户 → 修改 → 场景页
  await formItem('客户名称').locator('input').first().fill(vals.name);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(2000);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  const rowHtml = await row.evaluate((tr) => tr.outerHTML.slice(0, 600)).catch(() => 'NO_ROW');
  console.log('ROW_HTML=', rowHtml);
  out.listRadio = await (async () => {
    const inp = row.locator('input[type="radio"]').first();
    if (await inp.count().catch(() => 0)) return J(await bb(inp));
    return J(await bb(row.locator('td').first()));
  })();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el) => el.click()).catch(() => {});
  else await row.locator('td').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(5000);
  out.sceneSave = await bb(page.getByRole('button').filter({ hasText: /^保\s*存$/ }).first()).catch(() => null);
  out.sceneTempSave = await bb(page.getByRole('button').filter({ hasText: /暂\s*存/ }).first());
  out.sceneBack = await bb(page.getByRole('button').filter({ hasText: /返\s*回/ }).first());

  // 折叠段状态
  out.sections = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-expanded]'))
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ name: (e.innerText || '').trim().split('\n')[0].slice(0, 20), expanded: e.getAttribute('aria-expanded') }))
  );

  // 调查机构弹窗 radio
  const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '调查机构' }) }).first();
  await item.scrollIntoViewIfNeeded();
  await item.locator('button', { hasText: /引\s*入/ }).first().click();
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 });
  await page.waitForTimeout(2500);
  let dlg = page.locator('.el-dialog:visible').last();
  const orgRadio = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first();
  out.orgRadio = (await orgRadio.count().catch(() => 0)) ? J(await bb(orgRadio)) : 'NO_RADIO';
  await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click();
  await page.waitForTimeout(1200);

  // 法代弹窗 radio (需先查询)
  const item2 = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '法定代表人/负责人姓名' }) }).first();
  await item2.scrollIntoViewIfNeeded();
  await item2.locator('button', { hasText: /引\s*入/ }).first().click();
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 });
  await page.waitForTimeout(2000);
  dlg = page.locator('.el-dialog:visible').last();
  await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).locator('input').first().fill('黄');
  await dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(2500);
  const pRadio = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first();
  out.persRadio = (await pRadio.count().catch(() => 0)) ? J(await bb(pRadio)) : 'NO_RADIO';
  await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click();
  await page.waitForTimeout(1200);

  console.log('MEASURED=', J(out, null, 1));
  fs.writeFileSync(path.join(DIR, 'rects-wire.json'), J(out, null, 1));
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
