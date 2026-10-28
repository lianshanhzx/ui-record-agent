// probe82 - 用户 selector 全量翻页，统计机构(instName)分布，找非「9881**银行」机构的用户
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const CUST_NO = '260924144929974126';
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = { apiPages: [] };
  page.on('response', async (resp) => {
    const u = resp.url();
    if (resp.request().method() !== 'POST' || !u.includes('selector')) return;
    try {
      const j = await resp.json();
      const list = (j.data && j.data.list) || [];
      result.apiPages.push({ total: j.data && j.data.total, n: list.length, items: list.map((x) => ({ usrNo: x.usrNo, name: x.usrName || x.userName || x.name, instNo: x.instNo, inst: x.instName || x.orgName || '' })) });
    } catch (_) {}
  });

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  log('S1 query');
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  log('S2 radio');
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  log('S3 modify');
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(5000);
  log('S4 tab');
  await page.locator('.el-tabs__item').filter({ hasText: '其他信息' }).first().click();
  await sleep(6000);
  const teamPane = page.locator('.el-collapse-item').filter({ has: page.locator('text=维护客户管理团队') }).first();
  log('S5 add');
  await teamPane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  log('S6 magnifier');
  const addDlg = page.locator('.el-dialog:visible').last();
  await addDlg.getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);
  const selDlg = page.locator('.el-dialog:visible').last();
  log('S7 selquery');
  const sP = page.waitForResponse((r) => r.url().includes('selector') && r.request().method() === 'POST', { timeout: 30_000 });
  await selDlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sP;
  await sleep(2000);

  // 翻页收集
  for (let p = 0; p < 12; p++) {
    const pagerNext = selDlg.locator('.el-pagination .btn-next');
    if (!(await pagerNext.count()) || (await pagerNext.getAttribute('class') || '').includes('is-disabled')) break;
    await pagerNext.click();
    await sleep(1500);
  }

  // 汇总机构分布
  const all = result.apiPages.flatMap((p) => p.items);
  const byInst = {};
  for (const it of all) {
    const k = (it.inst || it.instNo || '?').slice(0, 30);
    (byInst[k] = byInst[k] || []).push(it.usrNo + '/' + it.name);
  }
  result.instDist = {};
  for (const [k, v] of Object.entries(byInst)) result.instDist[k] = { n: v.length, sample: v.slice(0, 5) };
  log('P82_PAGES=' + result.apiPages.length + ' ALL=' + all.length);
  log('P82_INST=' + JSON.stringify(result.instDist, null, 1).slice(0, 1500));
  fs.writeFileSync(path.join(__dirname, 'probe82.out.json'), JSON.stringify(result, null, 1));

  // 关闭
  const subCancel = selDlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
  if (await subCancel.isVisible().catch(() => false)) { await subCancel.click(); await sleep(1200); }
  const cancel = addDlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
  if (await cancel.isVisible().catch(() => false)) { await cancel.click(); await sleep(1200); }
  const back = page.getByRole('button').filter({ hasText: /返\s*回/ }).first();
  if (await back.isVisible().catch(() => false)) { await back.click(); await sleep(1200); }
  log('P82_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P82_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
