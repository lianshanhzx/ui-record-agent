// probe_smbsn_31.js - 查看当前客户股东信息 tab 现有记录
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

  let shResp = null;
  page.on('response', async (r) => {
    const u = r.url();
    if (u.includes('queryCustCorporatRelatedParty') && r.request().method() === 'POST') {
      try { shResp = JSON.parse(await r.text()); } catch {}
    }
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
  await page.waitForTimeout(4000);

  const table = await page.evaluate(() => {
    const panes = Array.from(document.querySelectorAll('.el-tab-pane')).filter((p) => p.offsetParent !== null);
    const pane = panes[panes.length - 1];
    const heads = Array.from(pane.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map((h) => (h.innerText || '').trim()).filter(Boolean);
    const rows = Array.from(pane.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 40)));
    return { heads, rows };
  });
  console.log('TABLE=', JSON.stringify(table, null, 1));
  console.log('SH_RESP=', JSON.stringify(shResp && shResp.data, null, 1).slice(0, 2500));
  await page.screenshot({ path: path.join(DIR, 's3_18_sh_tab.png') });
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
