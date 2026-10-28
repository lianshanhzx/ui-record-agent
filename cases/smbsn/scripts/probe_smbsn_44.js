// probe44: 查股东关联客户 28188358582770300000 的注册资本（验证 edit 路径校验对象）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '28188358582770300000';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 抓客户详情 API
  let detailResp = null;
  page.on('response', async (resp) => {
    const u = resp.url();
    if (/corporate|corporat|cstDetail|customerDetail|queryDetail|\/detail|custInfo/i.test(u) && resp.status() === 200) {
      try {
        const j = await resp.json();
        const s = JSON.stringify(j);
        if (/注册资本|regCap|registCap|regCapital|regCapAmt|capital/i.test(s)) {
          detailResp = { url: u.split('/').slice(-2).join('/'), data: s.slice(0, 3000) };
        }
      } catch {}
    }
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4500);

  const rowCount = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  console.log('RELATED_CUST_ROWS=', rowCount);
  if (rowCount === 0) { console.log('NO_SUCH_CUSTOMER', CUST_NO); }
  else {
    const rowText = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().innerText();
    console.log('ROW=', JSON.stringify(rowText.replace(/\n/g, ' | ').slice(0, 400)));
    // 进入修改页读注册资本
    await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
    await sleep(800);
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector('.el-form-item:visible', { timeout: 60000 }).catch(() => {});
    await sleep(4000);
    const regCap = await page.evaluate(() => {
      const out = {};
      for (const it of Array.from(document.querySelectorAll('.el-form-item'))) {
        const l = it.querySelector('label');
        if (!l) continue;
        const t = (l.innerText || '').trim().replace(/[*\s]/g, '');
        if (/注册资本|实收资本/.test(t)) {
          const inp = it.querySelector('input, textarea');
          out[t] = inp ? inp.value : 'no-input';
        }
      }
      return out;
    });
    console.log('RELATED_REG_CAPITAL=', JSON.stringify(regCap));
  }
  if (detailResp) console.log('DETAIL_API=', JSON.stringify(detailResp).slice(0, 2500));
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
