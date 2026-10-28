// probe69 - 影像资料：文件行结构（checkbox?）/ 视图预览交互 / 图册查看交互 / 批量操作菜单（有文件）/ 左侧目录搜索
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = __dirname;
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: path.resolve(DIR, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(ROWS, { timeout: 90_000 });
  await sleep(1500);

  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await sleep(1500);
  await page.locator(ROWS).first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first().click();
  await sleep(6000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first().locator('.el-tree-node__content').first().click();
  await sleep(2500);

  // 1) 文件行结构
  const rowInfo = await pane.locator(ROWS).first().evaluate((tr) => ({
    html: tr.outerHTML.slice(0, 800),
    checkboxes: tr.querySelectorAll('input[type="checkbox"]').length,
    radios: tr.querySelectorAll('input[type="radio"]').length,
  }));
  log('P69_ROW_HTML=' + rowInfo.html);
  log('P69_ROW_CB=' + rowInfo.checkboxes + ' RADIO=' + rowInfo.radios);
  const rowCount = await pane.locator(ROWS).count();
  log('P69_FILE_COUNT=' + rowCount);

  // 2) 视图预览
  const beforePages = ctx.pages().length;
  await pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first().click();
  await sleep(6000);
  const afterPages = ctx.pages().length;
  log('P69_PREVIEW_PAGES before=' + beforePages + ' after=' + afterPages);
  if (afterPages > beforePages) {
    const np = ctx.pages()[ctx.pages().length - 1];
    log('P69_PREVIEW_NEWPAGE_URL=' + np.url());
    await np.screenshot({ path: path.join(DIR, 'p69_preview_newpage.png') });
  }
  const dlgVisible = await page.locator('.el-dialog:visible, .el-drawer:visible').count();
  const iframes = await page.locator('iframe').count();
  log('P69_PREVIEW_DLG=' + dlgVisible + ' IFRAMES=' + iframes);
  await page.screenshot({ path: path.join(DIR, 'p69_preview.png') });
  if (afterPages > beforePages) { await ctx.pages()[ctx.pages().length - 1].close(); }
  else {
    const closeBtn = page.locator('.el-dialog:visible .el-dialog__headerbtn, .el-dialog:visible button:has-text("关 闭"), .el-dialog:visible button:has-text("关闭")').first();
    if (await closeBtn.count()) { log('P69_PREVIEW_CLOSE_BTN=1'); await closeBtn.click(); await sleep(1500); }
    else { log('P69_PREVIEW_CLOSE_BTN=0 试ESC'); await page.keyboard.press('Escape'); await sleep(1500); }
  }

  // 3) 图册查看
  await sleep(1000);
  const beforePages2 = ctx.pages().length;
  await pane.getByRole('button').filter({ hasText: /图\s*册\s*查\s*看/ }).first().click();
  await sleep(6000);
  const afterPages2 = ctx.pages().length;
  log('P69_ALBUM_PAGES before=' + beforePages2 + ' after=' + afterPages2);
  if (afterPages2 > beforePages2) {
    const np = ctx.pages()[ctx.pages().length - 1];
    log('P69_ALBUM_NEWPAGE_URL=' + np.url());
    await np.screenshot({ path: path.join(DIR, 'p69_album_newpage.png') });
  }
  const dlg2 = await page.locator('.el-dialog:visible, .el-drawer:visible').count();
  log('P69_ALBUM_DLG=' + dlg2);
  await page.screenshot({ path: path.join(DIR, 'p69_album.png') });
  if (afterPages2 > beforePages2) { await ctx.pages()[ctx.pages().length - 1].close(); }
  else {
    const closeBtn2 = page.locator('.el-dialog:visible .el-dialog__headerbtn, .el-dialog:visible button:has-text("关 闭"), .el-dialog:visible button:has-text("关闭")').first();
    if (await closeBtn2.count()) { await closeBtn2.click(); }
    else { await page.keyboard.press('Escape'); }
  }
  await sleep(1500);

  // 4) 批量操作菜单（有文件时）
  await pane.getByRole('button').filter({ hasText: /批\s*量\s*操\s*作/ }).first().click();
  await sleep(2000);
  await page.screenshot({ path: path.join(DIR, 'p69_batch_menu.png') });
  const menuItems = [];
  const items = page.locator('.el-dropdown-menu__item:visible, li[role="menuitem"]:visible, .el-menu-item:visible');
  for (let i = 0; i < await items.count(); i++) menuItems.push(await items.nth(i).innerText());
  log('P69_BATCH_MENU=' + JSON.stringify(menuItems));
  await page.keyboard.press('Escape');
  await sleep(800);

  // 5) 文件行选中方式
  if (rowInfo.checkboxes > 0) {
    const cb = pane.locator(ROWS).first().locator('input[type="checkbox"]').first();
    await cb.check({ force: true }).catch((e) => log('P69_CB_CHECK_ERR=' + e.message));
    await sleep(800);
    log('P69_FILE_ROW_SELECTED=1');
  }
  await page.screenshot({ path: path.join(DIR, 'p69_selected.png') });

  // 6) 左侧目录搜索
  const inputs = pane.locator('.el-input__inner');
  const inCount = await inputs.count();
  log('P69_PANE_INPUTS=' + inCount);
  for (let i = 0; i < inCount; i++) {
    const ph = await inputs.nth(i).getAttribute('placeholder').catch(() => null);
    log('P69_INPUT_' + i + '_PH=' + ph);
  }
  const searchBox = pane.locator('input[placeholder*="目录"], input[placeholder*="查询"], input[placeholder*="搜索"]').first();
  if (await searchBox.count()) {
    await searchBox.fill('营业执照');
    await sleep(2500);
    const treeTexts = [];
    const visNodes = pane.locator('.el-tree [role="treeitem"]:visible');
    for (let i = 0; i < await visNodes.count(); i++) treeTexts.push((await visNodes.nth(i).innerText()).replace(/\s+/g, ' '));
    log('P69_TREE_AFTER_SEARCH=' + JSON.stringify(treeTexts));
    await page.screenshot({ path: path.join(DIR, 'p69_catalog_search.png') });
    await searchBox.fill('');
    await sleep(1500);
  } else {
    log('P69_NO_CATALOG_SEARCH_INPUT');
  }

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(2000);
  fs.writeFileSync(path.join(DIR, 'probe69-result.txt'), 'DONE\n' + JSON.stringify({ rowInfo, rowCount, menuItems }, null, 2), 'utf8');
  log('P69_DONE');
  await browser.close();
})().catch((e) => { console.error('P69_FATAL', e); process.exit(1); });
