// probe71b - 先【删除】(确认框+API+行数) 后【预览】(全屏加载轮询+关闭)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const DIR = __dirname;
const CUST_NO = '260924144929974126';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ storageState: path.resolve(DIR, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const apis = [];
  page.on('response', (r) => {
    const u = r.url();
    if (/filesFileManage|filesCtlgManage/i.test(u) && r.request().method() !== 'GET') {
      apis.push(u.split('/').filter(Boolean).slice(-2).join('/') + ' ' + r.status());
    }
  });
  page.on('request', (r) => {
    if (/filesFileManage/i.test(r.url()) && r.method() === 'GET') apis.push('GET ' + r.url().split('/').filter(Boolean).slice(-2).join('/'));
  });

  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      break;
    } catch (e) { if (attempt >= 2) throw e; log('GOTO_RETRY ' + attempt); await sleep(5000); }
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
  const backToList = pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
  if (await backToList.isVisible().catch(() => false)) { log('MODE=CARD 切回表格'); await backToList.click(); await sleep(2500); }
  log('TABLE_MODE=' + await pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first().isVisible().catch(() => false));

  const clickVisible = async (label) => {
    const ok = await pane.evaluate((p, lb) => {
      const spans = [...p.querySelectorAll('span')].filter((s) => (s.textContent || '').trim() === lb && s.offsetParent !== null);
      if (!spans.length) return false;
      spans[0].click();
      return true;
    }, label);
    if (!ok) throw new Error('no visible span: ' + label);
  };

  // 1) 删除（首行）
  const preCount = await pane.locator(ROWS).count();
  log('P71B_PRE_COUNT=' + preCount);
  await clickVisible('删除');
  await sleep(2500);
  const mb = page.locator('.el-message-box:visible');
  log('P71B_MB=' + await mb.count());
  if (await mb.count()) {
    log('P71B_MB_TEXT=' + (await mb.innerText()).replace(/\s+/g, ' '));
    await page.screenshot({ path: path.join(DIR, 'p71b_del_confirm.png') });
    await mb.locator('button.el-button--primary').click();
  }
  await sleep(5000);
  const postCount = await pane.locator(ROWS).count();
  log('P71B_POST_COUNT=' + postCount);
  log('P71B_APIS_DEL=' + JSON.stringify(apis));

  // 2) 预览（首行行内 viewer：卡片模式+属性面板+查看器工具条）
  await clickVisible('预览');
  await sleep(8000);
  const backVisible = await pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first().isVisible().catch(() => false);
  log('P71B_PREVIEW_MODE backToListVisible=' + backVisible);
  const loading = await pane.getByText('加载中', { exact: false }).first().isVisible().catch(() => false);
  log('P71B_LOADING_TEXT=' + loading);
  const propText = await pane.evaluate((p) => {
    const els = [...p.querySelectorAll('*')].filter((e) => (e.innerText || '').trim() === '属性' && e.children.length === 0);
    if (!els.length) return 'NO_ATTR';
    let box = els[0];
    for (let i = 0; i < 5 && box.parentElement; i++) box = box.parentElement;
    return box.innerText.replace(/\s+/g, ' ').slice(0, 300);
  });
  log('P71B_PROP=' + JSON.stringify(propText));
  await page.screenshot({ path: path.join(DIR, 'p71b_preview.png') });
  // 返回列表（退回表格模式）
  if (backVisible) {
    await pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first().click();
    await sleep(2500);
    log('P71B_BACK_TO_TABLE viewPreviewVisible=' + await pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first().isVisible().catch(() => false));
  }
  log('P71B_APIS_ALL=' + JSON.stringify(apis));

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(2000);
  fs.writeFileSync(path.join(DIR, 'probe71b-apis.txt'), apis.join('\n'), 'utf8');
  log('P71B_DONE');
})().catch(async (e) => {
  console.error('P71B_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
