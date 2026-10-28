// probe90: 联网核查 dialog「核查结果」控件结构 + 交互 + 查询 body
const { chromium } = require('playwright');
const path = require('path');
const CST_NO = '260924144929974126';
const DlgX = `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apiLog = [];
  page.on('response', (r) => {
    if (r.url().includes('/tansun-tcp-cst/')) apiLog.push({ url: r.url().split('/').slice(-2).join('/'), status: r.status(), body: r.request().postData() || '' });
  });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const pageP = page.waitForResponse((r) => r.url().includes('custCorporatNetworkCheckBasic/page'), { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /联网核查信息/ }).first().click();
  const dlg = page.locator(`xpath=${DlgX}`);
  await dlg.waitFor({ state: 'visible', timeout: 15_000 });
  await pageP;
  await page.waitForTimeout(1500);

  const html = await dlg.evaluate((d) => {
    const item = [...d.querySelectorAll('.el-form-item')].find((i) => i.querySelector('label') && i.querySelector('label').innerText.trim() === '核查结果');
    return item ? item.outerHTML.slice(0, 2500) : 'NOT_FOUND';
  });
  console.log('=== 核查结果 form-item HTML ===\n' + html + '\n');

  // 点开控件
  const ctrl = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '核查结果' }) }).first().locator('.el-select, .el-input, input, .tssc-select').first();
  await ctrl.click();
  await page.waitForTimeout(1200);
  const ddInfo = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.el-select-dropdown, .tssc-select-dropdown, [class*=dropdown], [class*=popper]').forEach((el) => {
      if (el.offsetParent !== null || getComputedStyle(el).display !== 'none') {
        out.push({ cls: el.className.toString().slice(0, 80), vis: el.offsetParent !== null, items: [...el.querySelectorAll('li, .el-select-dropdown__item, [class*=item], label')].slice(0, 8).map((i) => i.innerText.trim()).filter(Boolean) });
      }
    });
    return out;
  });
  console.log('=== 点击后下拉候选 ===\n' + JSON.stringify(ddInfo, null, 1) + '\n');

  // 截图
  await page.screenshot({ path: path.join(__dirname, 'p90-rslt.png') });

  // 尝试选「核查通过」：li/label/input[value] 多策略
  const picked = await page.evaluate(() => {
    const cands = [...document.querySelectorAll('li, label.el-radio, .el-select-dropdown__item, span')].filter((e) => e.offsetParent !== null && e.innerText && e.innerText.trim() === '核查通过');
    if (!cands.length) return 'NO_CANDIDATE';
    cands[cands.length - 1].click();
    return 'CLICKED:' + cands[cands.length - 1].className.toString().slice(0, 60);
  });
  console.log('=== 选择 核查通过 === ' + picked);
  await page.waitForTimeout(1000);

  // 查询
  const q2 = page.waitForResponse((r) => r.url().includes('custCorporatNetworkCheckBasic/page'), { timeout: 30_000 });
  await page.locator(`xpath=${DlgX}`).getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const r2 = await q2;
  console.log('=== 查询 body === ' + r2.request().postData());
  await page.waitForTimeout(2000);
  const rows = await dlg.locator('.el-table__body-wrapper tbody tr').count();
  console.log('=== 筛选后行数 ' + rows + ' ===');
  await page.screenshot({ path: path.join(__dirname, 'p90-rslt2.png') });
  console.log('P90_DONE');
  await browser.close();
})().catch((e) => { console.error('P90_ERR ' + (e.message || e).toString().slice(0, 400)); process.exit(1); });
