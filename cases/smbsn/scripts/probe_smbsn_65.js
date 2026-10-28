// probe65: 影像资料tab 内容深挖（pane innerHTML / 加载态 / 是否有懒加载）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const allApis = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST') return;
    let resp = ''; try { resp = (await r.text()).slice(0, 120); } catch {}
    allApis.push(r.url().split('/').filter(Boolean).slice(-2).join('/') + ' :: ' + resp);
  });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  const imgTab = page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first();
  await imgTab.click();
  await sleep(6000);
  const info = await page.evaluate(() => {
    const panes = Array.from(document.querySelectorAll('.el-tab-pane')).filter((p) => p.offsetParent !== null);
    const p = panes[panes.length - 1];
    return {
      paneCount: panes.length,
      htmlLen: p ? p.innerHTML.length : -1,
      html: p ? p.innerHTML.slice(0, 1500) : '',
      tabActive: Array.from(document.querySelectorAll('.el-tabs__item')).map((t) => t.className.includes('is-active') + ':' + t.innerText.trim()),
    };
  });
  console.log('P65_TABS=', JSON.stringify(info.tabActive));
  console.log('P65_PANE_HTML_LEN=', info.htmlLen);
  console.log('P65_PANE_HTML=', info.html);
  console.log('P65_POST_TAB_APIS=', JSON.stringify(allApis.slice(-6), null, 1));
  await page.screenshot({ path: path.join(__dirname, 'p65_image_tab.png') });
  await browser.close();
})().catch((e) => { console.error('P65_ERROR', e.message); process.exit(1); });
