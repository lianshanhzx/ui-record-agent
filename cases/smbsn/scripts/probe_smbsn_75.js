// probe75 - 只读：dump 影像资料tab(表格模式) 工具栏按钮 + 行操作span 的精确 innerText
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

  // 点「客户管理」目录节点 → 文件列表渲染
  const pfP = page.waitForResponse((r) => r.url().includes('filesFileManage/pageFileInf') && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => null);
  await page.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first().locator('.el-tree-node__content').first().click();
  await pfP;
  await sleep(3000);

  // 模式守卫：若在卡片模式(返回列表可见)则切回表格
  const backBtn = page.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
  if (await backBtn.isVisible().catch(() => false)) { await backBtn.click(); await sleep(2500); }

  const diag = await page.evaluate(() => {
    const panes = [...document.querySelectorAll('.el-tab-pane')].filter((p) => p.offsetParent !== null).length;
    const scope = document.querySelector('.file-catalog-container') || document.body;
    const btns = [...scope.querySelectorAll('button')].filter((b) => b.offsetParent !== null && (b.innerText || '').trim()).map((b) => (b.innerText || '').trim());
    const spans = [...scope.querySelectorAll('span')].filter((s) => {
      const t = (s.innerText || '').trim();
      return ['预览', '下载', '删除', '移动', '打印'].includes(t) && s.offsetParent !== null;
    }).map((s) => ({ t: s.innerText.trim(), cls: s.className, par: s.parentElement && s.parentElement.tagName + '.' + String(s.parentElement.className).slice(0, 30) }));
    return { panes, btns, spans: spans.slice(0, 12) };
  });
  log('P75_DIAG panes=' + diag.panes);
  log('P75_BTN=' + JSON.stringify(diag.btns));
  log('P75_SPAN=' + JSON.stringify(diag.spans));
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  log('P75_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P75_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
