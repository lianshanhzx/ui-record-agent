// probe76 - 表格模式点首行「预览」→ dump 预览模式按钮精确文本 → 点「返回列表」恢复表格模式
const { chromium } = require('playwright');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill('260924144929974126');
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first().click();
  await page.waitForSelector('.file-catalog-container', { timeout: 90_000 });
  await sleep(5000);
  const pfP = page.waitForResponse((r) => r.url().includes('filesFileManage/pageFileInf') && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => null);
  await page.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first().locator('.el-tree-node__content').first().click();
  await pfP;
  await sleep(3000);
  const backBtn0 = page.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
  if (await backBtn0.isVisible().catch(() => false)) { await backBtn0.click(); await sleep(2500); }

  const dumpBtns = () => page.evaluate(() => {
    const scope = document.querySelector('.file-catalog-container') || document.body;
    return [...scope.querySelectorAll('button')].filter((b) => b.offsetParent !== null && (b.innerText || '').trim()).map((b) => (b.innerText || '').trim());
  });

  // 点首行「预览」进预览模式
  const pvP = page.waitForResponse((r) => r.url().includes('filesFileManage/preview'), { timeout: 30_000 }).catch(() => null);
  await page.locator('span').filter({ hasText: /^\s*预览\s*$/ }).filter({ visible: true }).first().click();
  await pvP;
  await sleep(6000);
  log('P76_PREVIEW_MODE_BTN=' + JSON.stringify(await dumpBtns()));

  // 点「返回列表」恢复
  const back = page.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
  log('P76_BACK_VISIBLE=' + (await back.isVisible().catch(() => false)));
  if (await back.isVisible().catch(() => false)) {
    log('P76_BACK_TEXT=' + JSON.stringify((await back.innerText()).trim()));
    await back.click();
    await sleep(3000);
  }
  log('P76_TABLE_MODE_BTN=' + JSON.stringify(await dumpBtns()));
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  log('P76_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P76_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
