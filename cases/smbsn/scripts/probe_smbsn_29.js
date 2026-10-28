// probe_smbsn_29.js - 引入弹窗默认数据 + 查询行为 + 保存 API
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('tansun') || r.request().method() !== 'POST') return;
    try {
      const j = JSON.parse(await r.text());
      const d = j && j.data;
      apis.push({ url: u.replace(BASE, ''), code: j && j.code, msg: j && j.message, total: (d && d.total) ?? null });
    } catch {}
  });

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
  const FI = (lb) => page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first();

  // 选 股东类型=法人或其他组织
  await FI('股东类型').locator('.el-select').first().click();
  const dd = page.locator('.el-select-dropdown:visible').last();
  await dd.waitFor({ state: 'visible', timeout: 5000 });
  await dd.locator('.el-select-dropdown__item').filter({ hasText: '法人或其他组织' }).first().click();
  await page.waitForTimeout(1500);

  // 点引入
  await FI('股东名称').getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await page.waitForTimeout(4000);
  const LAST = () => page.locator('.el-dialog:visible').last();

  const readRows = async () => page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    if (!d) return { n: -1, rows: [] };
    const rs = Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr'));
    return { n: rs.length, rows: rs.slice(0, 3).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 30))) };
  });

  console.log('ROWS_ON_OPEN=', JSON.stringify(await readRows()));
  console.log('APIS_ON_OPEN=', JSON.stringify(apis.slice(-4), null, 1));

  // 若空: 点【对公客户】tab
  const tabCorp = LAST().getByRole('button').filter({ hasText: /对公客户/ });
  if (await tabCorp.count()) {
    await tabCorp.first().click().catch(() => {});
    await page.waitForTimeout(2500);
    console.log('ROWS_AFTER_CORP_TAB=', JSON.stringify(await readRows()));
  }

  // 空查: 直接点查询
  const qBtn = LAST().getByRole('button').filter({ hasText: /查\s*询/ }).first();
  const respP = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('tansun'), { timeout: 20000 }).catch(() => null);
  await qBtn.click().catch((e) => console.log('Q_FAIL', e.message.split('\n')[0]));
  const resp = await respP;
  await page.waitForTimeout(3000);
  console.log('QUERY_RESP=', resp ? resp.url().replace(BASE, '') : 'none');
  console.log('ROWS_AFTER_QUERY=', JSON.stringify(await readRows()));
  console.log('APIS_QUERY=', JSON.stringify(apis.slice(-3), null, 1));

  // 若有行: 选中首行 radio, 看联动
  const st = await readRows();
  if (st.n > 0) {
    const rInp = LAST().locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first();
    if (await rInp.count()) await rInp.evaluate((el) => el.click());
    await page.waitForTimeout(1000);
    console.log('FIRST_ROW_RADIO_CLICKED');
  }
  await page.screenshot({ path: path.join(DIR, 's3_16_import_rows.png') });

  // 取消
  await LAST().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
