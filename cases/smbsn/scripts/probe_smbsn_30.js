// probe_smbsn_30.js - 引入弹窗【同业客户】tab: 行数据 + 选中确认回写联动
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
      apis.push({ url: u.replace(BASE, ''), code: j && j.code, total: (d && d.total) ?? null });
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

  await FI('股东类型').locator('.el-select').first().click();
  const dd = page.locator('.el-select-dropdown:visible').last();
  await dd.waitFor({ state: 'visible', timeout: 5000 });
  await dd.locator('.el-select-dropdown__item').filter({ hasText: '法人或其他组织' }).first().click();
  await page.waitForTimeout(1500);

  await FI('股东名称').getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await page.waitForTimeout(4000);
  const LAST = () => page.locator('.el-dialog:visible').last();

  // 切【同业客户】tab
  await LAST().getByRole('button').filter({ hasText: /同业客户/ }).first().click();
  await page.waitForTimeout(3000);
  let st = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    const rs = Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr'));
    return { n: rs.length, rows: rs.slice(0, 5).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 30))) };
  });
  console.log('ROWS_SMBSN_TAB=', JSON.stringify(st, null, 1));

  // 空查
  const qBtn = LAST().getByRole('button').filter({ hasText: /查\s*询/ }).first();
  const respP = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('tansun'), { timeout: 20000 }).catch(() => null);
  await qBtn.click().catch((e) => console.log('Q_FAIL', e.message.split('\n')[0]));
  const resp = await respP;
  await page.waitForTimeout(3000);
  console.log('QUERY_API=', resp ? resp.url().replace(BASE, '') : 'none');
  st = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    const rs = Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr'));
    return { n: rs.length, rows: rs.slice(0, 5).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 30))) };
  });
  console.log('ROWS_AFTER_QUERY=', JSON.stringify(st, null, 1));
  console.log('APIS=', JSON.stringify(apis.slice(-3), null, 1));

  if (st.n > 0) {
    // 首行 radio + 确认 → 看回写
    const firstRow = LAST().locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    await firstRow.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(1000);
    await LAST().getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
    await page.waitForTimeout(3000);
    const back = await page.evaluate(() => {
      const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
      const d = ds[ds.length - 1];
      if (!d) return null;
      const get = (label) => {
        const f = Array.from(d.querySelectorAll('.el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes(label));
        if (!f) return null;
        const inp = f.querySelector('input, textarea');
        return inp ? inp.value : null;
      };
      return {
        股东名称: get('股东名称'), 股东客户编号: get('股东客户编号'),
        证件类型: get('证件类型'), 证件号码: get('证件号码'),
        币种: get('币种'),
      };
    });
    console.log('WRITEBACK=', JSON.stringify(back, null, 1));
    await page.screenshot({ path: path.join(DIR, 's3_17_writeback.png') });
  }

  // 取消新增弹窗
  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
