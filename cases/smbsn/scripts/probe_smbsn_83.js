// probe83 - 枚举 701994 管理下的同业客户，逐个查「其他信息-维护客户管理团队」表格（只读）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = { customers: [] };

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);

  // 清空客户编号，全量查询
  const qBtn = page.getByRole('button').filter({ hasText: /查\s*询/ }).first();
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await qP.catch(() => {});
  await qBtn.click();
  await sleep(3000);
  const listInfo = await page.evaluate(() => {
    const trs = [...document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')];
    const rows = trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()).join('|')).filter(Boolean);
    const pg = document.querySelector('.el-pagination__total');
    return { rows, total: pg ? pg.innerText.trim() : null };
  });
  result.list = listInfo;
  log('P83_LIST total=' + listInfo.total + ' rows=' + listInfo.rows.length);
  log('P83_ROWS=' + JSON.stringify(listInfo.rows, null, 1).slice(0, 2000));

  // 最多看 4 个客户（除基线）的团队表
  const MAX = 4;
  for (let i = 0; i < Math.min(listInfo.rows.length, 8) && result.customers.length < MAX; i++) {
    const rowTxt = listInfo.rows[i];
    if (rowTxt.includes('260924144929974126')) { log('skip baseline row ' + i); continue; }
    // 选行
    await page.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(i).locator('input[type="radio"]').first().evaluate((el) => el.click());
    await sleep(800);
    const mP = page.waitForResponse((r) => r.url().includes('getCustTrade') && r.request().method() === 'POST', { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
    await mP.catch(() => {});
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await sleep(5000);
    await page.locator('.el-tabs__item').filter({ hasText: '其他信息' }).first().click();
    await sleep(6000);
    const info = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.el-collapse-item')].filter((c) => c.innerText.includes('维护客户管理团队'));
      if (!items.length) return { team: null };
      const trs = items[0].querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
      const team = [...trs].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()).join('|')).filter(Boolean);
      const noData = !!items[0].querySelector('.el-table__empty-block');
      const custNoInp = document.querySelector('input[readonly]');
      return { team, noData };
    });
    const custNo = (await page.evaluate(() => {
      const el = [...document.querySelectorAll('.el-form-item')].find((i) => (i.querySelector('label') || {}).innerText?.includes('客户编号'));
      return el ? (el.querySelector('input') || {}).value : null;
    })) || rowTxt.slice(0, 40);
    result.customers.push({ i, row: rowTxt.slice(0, 80), custNo, team: info.team, noData: info.noData });
    log('P83_C' + i + '=' + JSON.stringify({ custNo, team: info.team, noData: info.noData }));
    const back = page.getByRole('button').filter({ hasText: /返\s*回/ }).first();
    if (await back.isVisible().catch(() => false)) { await back.click(); await sleep(2500); }
  }

  fs.writeFileSync(path.join(__dirname, 'probe83.out.json'), JSON.stringify(result, null, 1));
  log('P83_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P83_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
