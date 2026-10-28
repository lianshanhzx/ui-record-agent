// probe91: message-box 按钮结构调试（点 Cancel 退出，不产生数据）
const { chromium } = require('playwright');
const path = require('path');
const CST_NO = '260924144929974126';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /联网核查信息/ }).first().click();
  await page.waitForSelector('//div[@role="dialog"][.//button[normalize-space()="发起实时核查"]]', { state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(2500);
  await page.locator('//div[@role="dialog"][.//button[normalize-space()="发起实时核查"]]//button[normalize-space()="发起实时核查"]').click();
  const mb = page.locator('.el-message-box:visible').last();
  await mb.waitFor({ state: 'visible', timeout: 10_000 });
  const info = await mb.evaluate((m) => {
    const out = { cls: m.className, btns: [] };
    m.querySelectorAll('button').forEach((b) => out.btns.push({ tc: JSON.stringify(b.textContent), cls: b.className, role: b.getAttribute('type') }));
    return out;
  });
  console.log('MB_INFO=' + JSON.stringify(info, null, 1));
  const cnt = await page.locator('.el-message-box:visible').count();
  console.log('VISIBLE_MB_COUNT=' + cnt);
  await page.locator('//div[contains(@class,"el-message-box")]//button[normalize-space()="Cancel"]').click();
  await page.waitForTimeout(800);
  console.log('AFTER_CANCEL_MB=' + await page.locator('.el-message-box:visible').count());
  await browser.close();
})().catch((e) => { console.error('P91_ERR ' + (e.message || e).toString().slice(0, 300)); process.exit(1); });
