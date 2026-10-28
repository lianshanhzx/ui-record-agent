// probe82b - 用户 selector 直查全量(pageSize=200)，统计机构分布，找跨机构用户
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
  const result = { selUrl: null };
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('userAndOrgRel/selector')) result.selUrl = req.url();
  });

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  log('S1');
  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(5000);
  await page.locator('.el-tabs__item').filter({ hasText: '其他信息' }).first().click();
  await sleep(6000);
  const teamPane = page.locator('.el-collapse-item').filter({ hasText: '维护客户管理团队' }).first();
  log('S2');
  await teamPane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  const addDlg = page.locator('.el-dialog:visible').last();
  log('S3');
  await addDlg.getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);
  const selDlg = page.locator('.el-dialog:visible').last();
  log('S4');
  const sP = page.waitForResponse((r) => r.url().includes('userAndOrgRel/selector'), { timeout: 30_000 });
  await selDlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sP;
  await sleep(2000);
  log('S5 url=' + result.selUrl);

  // 直查全量
  const all = await page.evaluate(async (u) => {
    const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageNum: 1, pageSize: 300, usrNm: '', usrNo: '' }) });
    const j = await r.json();
    return j;
  }, result.selUrl);
  const list = (all.data && all.data.list) || all.list || [];
  result.total = (all.data && all.data.total) || all.total;
  result.firstItemRaw = list[0] ? JSON.stringify(list[0]).slice(0, 400) : null;
  log('P82 total=' + result.total + ' got=' + list.length);
  const byInst = {};
  for (const it of list) {
    const k = JSON.stringify({ instNo: it.instNo, inst: it.instName || it.orgName || it.instNm || '' }).slice(0, 80);
    (byInst[k] = byInst[k] || []).push((it.usrNo || '') + '/' + (it.usrNm || it.userName || it.usrName || ''));
  }
  result.instDist = {};
  for (const [k, v] of Object.entries(byInst)) result.instDist[k] = { n: v.length, sample: v.slice(0, 8) };
  log('P82_INST=' + JSON.stringify(result.instDist, null, 1).slice(0, 2500));
  fs.writeFileSync(path.join(__dirname, 'probe82b.out.json'), JSON.stringify(result, null, 1));

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
