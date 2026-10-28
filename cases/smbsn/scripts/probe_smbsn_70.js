// probe70 - 影像资料：属性面板图标按钮(标题) / 选中文件后状态 / 视图预览真实入口 / 目录搜索框过滤
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

  // 1) 工具栏按钮清单
  const toolbarBtns = await pane.evaluate((p) => {
    const out = [];
    p.querySelectorAll('button').forEach((b) => {
      const t = (b.innerText || '').replace(/\s+/g, '');
      if (t) out.push(t + (b.disabled ? '(dis)' : ''));
    });
    return out;
  });
  log('P70_TOOLBAR=' + JSON.stringify(toolbarBtns));

  // 2) 属性面板图标按钮
  const attrPanel = pane.locator('div').filter({ has: pane.locator('text=属性') }).last();
  const attrIcons = await pane.evaluate((p) => {
    // 找含「属性」文本的容器内的 i/svg/icon 按钮
    const all = [...p.querySelectorAll('button, i, span[class*="icon"], [class*="icon-btn"]')];
    const out = [];
    all.forEach((el) => {
      const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : (el.className || '');
      const title = el.getAttribute('title') || el.getAttribute('data-v-03346693') && '' || '';
      const txt = (el.innerText || '').trim();
      if (txt === '属性' || /icon/i.test(String(cls))) out.push({ tag: el.tagName, cls: String(cls).slice(0, 80), title, txt: txt.slice(0, 20) });
    });
    return out.slice(0, 40);
  });
  log('P70_ATTR_ICONS=' + JSON.stringify(attrIcons).slice(0, 2000));
  // 属性区域截图放大：取右侧容器
  const attrBox = await pane.locator('.el-row, [class*="prop"], [class*="attr"]').first().boundingBox().catch(() => null);
  log('P70_ATTR_BOX=' + JSON.stringify(attrBox));

  // 3) 选中第一个文件（点 el-checkbox__inner）
  const firstRow = pane.locator(ROWS).first();
  const beforeSel = await pane.locator(ROWS).first().getAttribute('class');
  await firstRow.locator('.el-checkbox__inner').first().evaluate((el) => el.click());
  await sleep(1500);
  const afterSel = await pane.locator(ROWS).first().getAttribute('class');
  log('P70_ROWCLS_BEFORE=' + beforeSel);
  log('P70_ROWCLS_AFTER=' + afterSel);
  const checkedState = await firstRow.locator('input[type="checkbox"]').first().evaluate((el) => el.checked);
  log('P70_CB_CHECKED=' + checkedState);
  await page.screenshot({ path: path.join(DIR, 'p70_selected.png') });

  // 选中后属性面板内容
  const attrBody = await pane.evaluate((p) => {
    // 找「属性」标题之后的兄弟容器
    const els = [...p.querySelectorAll('*')].filter((e) => (e.innerText || '').trim() === '属性' && e.children.length === 0);
    if (!els.length) return 'NO_ATTR_TITLE';
    let box = els[0];
    for (let i = 0; i < 4 && box.parentElement; i++) box = box.parentElement;
    return box.innerText.slice(0, 600);
  });
  log('P70_ATTR_BODY=' + JSON.stringify(attrBody));

  // 4) 视图预览按钮在哪（选中后）
  const previewBtn = pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first();
  log('P70_PREVIEW_BTN_COUNT=' + await pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).count());
  if (await previewBtn.count()) {
    const pRect = await previewBtn.boundingBox();
    const pTitle = await previewBtn.getAttribute('title').catch(() => null);
    log('P70_PREVIEW_BTN rect=' + JSON.stringify(pRect) + ' title=' + pTitle);
    // 点它看反应（先挂 dialog/newpage 监听）
    const beforePages = ctx.pages().length;
    await previewBtn.click();
    await sleep(6000);
    log('P70_PREVIEW_AFTER_PAGES=' + ctx.pages().length + ' DLG=' + await page.locator('.el-dialog:visible, .el-drawer:visible').count());
    await page.screenshot({ path: path.join(DIR, 'p70_preview.png') });
    if (ctx.pages().length > beforePages) {
      log('P70_PREVIEW_NEWPAGE=' + ctx.pages()[ctx.pages().length - 1].url());
      await ctx.pages()[ctx.pages().length - 1].close();
    } else {
      const closeBtn = page.locator('.el-dialog:visible .el-dialog__headerbtn').first();
      if (await closeBtn.count()) await closeBtn.click();
      else await page.keyboard.press('Escape');
      await sleep(1500);
    }
  }

  // 5) 目录搜索（pane 内第一个「请输入」）
  const in0 = pane.locator('input[placeholder="请输入"]').first();
  log('P70_IN0_PARENT=' + await in0.evaluate((el) => { let p = el; for (let i = 0; i < 6 && p.parentElement; i++) p = p.parentElement; return p.className && String(p.className).slice(0, 100); }).catch(() => 'N/A'));
  await in0.fill('营业执照');
  await sleep(2500);
  const visNodes = pane.locator('.el-tree [role="treeitem"]:visible');
  const treeTexts = [];
  for (let i = 0; i < await visNodes.count(); i++) treeTexts.push((await visNodes.nth(i).innerText()).replace(/\s+/g, ' '));
  log('P70_TREE_AFTER_SEARCH=' + JSON.stringify(treeTexts));
  await page.screenshot({ path: path.join(DIR, 'p70_search.png') });
  await in0.fill('');
  await sleep(1500);
  const visNodes2 = pane.locator('.el-tree [role="treeitem"]:visible');
  const n2 = await visNodes2.count();
  log('P70_TREE_AFTER_CLEAR=' + n2);

  // 6) 返回
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(2000);
  log('P70_DONE');
  await browser.close();
})().catch((e) => { console.error('P70_FATAL', e); process.exit(1); });
