// probe71 - 影像资料：行【预览】真实形态（新页/dialog/全屏?）+ 行【删除】确认框措辞+API（会实际删 1 个文件）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = __dirname;
let browser;
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: path.resolve(DIR, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);

  // 抓删除/预览相关 API
  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/filesFileManage|filesCtlgManage/.test(u) && r.request().method() === 'POST') {
      const body = r.request().postData() || '';
      apis.push(u.split('/').filter(Boolean).slice(-2).join('/') + ' ' + r.status() + ' body=' + body.slice(0, 120));
    }
  });

  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      break;
    } catch (e) {
      log('P71_GOTO_RETRY ' + attempt + ' ' + e.message.split('\n')[0]);
      if (attempt >= 2) throw e;
      await sleep(5000);
    }
  }
  await page.waitForSelector(ROWS, { timeout: 120_000 });
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

  // 0) 若卡片模式（「返回列表」可见），切回表格模式
  const backToList = pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
  if (await backToList.count() && await backToList.isVisible().catch(() => false)) {
    log('P71_MODE=CARD 切回表格');
    await backToList.click();
    await sleep(2500);
  }
  log('P71_MODE_NOW viewPreviewVisible=' + await pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first().isVisible().catch(() => false));

  // 1) 行【预览】（操作列=固定列，可见副本在 fixed 层，用 evaluate 点可见 span）
  const diag = await pane.evaluate((p) => {
    const spans = [...p.querySelectorAll('span')].filter((s) => (s.textContent || '').trim() === '预览');
    return { fixedRight: p.querySelectorAll('.el-table__fixed-right').length, total: spans.length, visible: spans.filter((s) => s.offsetParent !== null).length };
  });
  log('P71_LINK_DIAG=' + JSON.stringify(diag));
  const clickVisible = async (label) => {
    const ok = await pane.evaluate((p, lb) => {
      const spans = [...p.querySelectorAll('span')].filter((s) => (s.textContent || '').trim() === lb && s.offsetParent !== null);
      if (!spans.length) return false;
      spans[0].click();
      return true;
    }, label);
    if (!ok) throw new Error('no visible span: ' + label);
  };
  const beforePages = ctx.pages().length;
  await clickVisible('预览');
  await sleep(6000);
  const afterPages = ctx.pages().length;
  const dlgCount = await page.locator('.el-dialog:visible, .el-drawer:visible').count();
  log('P71_PREVIEW pages before=' + beforePages + ' after=' + afterPages + ' dlg=' + dlgCount);
  if (afterPages > beforePages) {
    const np = ctx.pages()[ctx.pages().length - 1];
    log('P71_PREVIEW_NEWPAGE=' + np.url());
    await np.screenshot({ path: path.join(DIR, 'p71_preview_newpage.png') });
  }
  await page.screenshot({ path: path.join(DIR, 'p71_preview.png') });
  // 全屏覆盖层？
  const overlayCls = await page.evaluate(() => {
    const els = [...document.querySelectorAll('body > div')].filter((e) => {
      const s = getComputedStyle(e);
      return (s.position === 'fixed' || s.position === 'absolute') && e.offsetHeight > 400;
    });
    return els.map((e) => e.className && String(e.className).slice(0, 80)).slice(0, 5);
  });
  log('P71_OVERLAY=' + JSON.stringify(overlayCls));
  // 关闭：试 headerbtn / ESC
  const closeBtn = page.locator('.el-dialog:visible .el-dialog__headerbtn, .el-image-viewer__close, [class*="viewer"] [class*="close"]:visible').first();
  if (await closeBtn.count()) { log('P71_CLOSE_VIA=headerbtn/viewer'); await closeBtn.click(); }
  else { log('P71_CLOSE_VIA=ESC'); await page.keyboard.press('Escape'); }
  await sleep(2000);
  log('P71_AFTER_CLOSE pages=' + ctx.pages().length + ' dlg=' + await page.locator('.el-dialog:visible').count());

  // 2) 行【删除】（实际删 1 个）
  const preCount = await pane.locator(ROWS).count();
  const preTotal = await pane.locator(ROWS).first().innerText();
  log('P71_PRE_COUNT=' + preCount + ' firstRow=' + preTotal.replace(/\s+/g, ' '));
  await clickVisible('删除');
  await sleep(2500);
  const mb = page.locator('.el-message-box:visible');
  log('P71_DELETE_MB=' + await mb.count());
  if (await mb.count()) {
    log('P71_DELETE_MB_TEXT=' + (await mb.innerText()).replace(/\s+/g, ' '));
    await page.screenshot({ path: path.join(DIR, 'p71_delete_confirm.png') });
    await mb.locator('button.el-button--primary').click();
  } else {
    const dlg = page.locator('.el-dialog:visible');
    if (await dlg.count()) {
      log('P71_DELETE_DLG_TEXT=' + (await dlg.first().innerText()).replace(/\s+/g, ' ').slice(0, 200));
      await page.screenshot({ path: path.join(DIR, 'p71_delete_confirm.png') });
      await dlg.locator('button.el-button--primary').first().click();
    }
  }
  await sleep(4000);
  const postCount = await pane.locator(ROWS).count();
  log('P71_POST_COUNT=' + postCount);
  log('P71_APIS=' + JSON.stringify(apis, null, 1));
  await page.screenshot({ path: path.join(DIR, 'p71_after_delete.png') });

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(2000);
  fs.writeFileSync(path.join(DIR, 'probe71-apis.txt'), apis.join('\n'), 'utf8');
  log('P71_DONE');
  await browser.close();
})().catch(async (e) => { console.error('P71_FATAL', e.message.split('\n')[0]); try { if (browser) await browser.close(); } catch (_) {} process.exit(1); });
