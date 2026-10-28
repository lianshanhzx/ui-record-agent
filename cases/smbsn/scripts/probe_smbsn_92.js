const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let captured = null;
  page.on('response', async (r) => {
    if (r.url().includes('findCustTradeList') && r.request().method() === 'POST') {
      try { const j = await r.json(); captured = { dataKeys: Object.keys(j.data || {}), data: j.data }; } catch (e) {}
    }
  });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await page.waitForTimeout(2500);
  if (captured) {
    console.log('DATA_KEYS=' + JSON.stringify(captured.dataKeys));
    const d = captured.data;
    const arrKey = captured.dataKeys.find((k) => Array.isArray(d[k]));
    console.log('ARR_KEY=' + arrKey);
    if (arrKey) console.log('FIRST=' + JSON.stringify(d[arrKey][0] || {}).slice(0, 300));
  } else console.log('NOT_CAPTURED');
  await browser.close();
})().catch((e) => { console.error('P92_ERR ' + (e.message || e).toString().slice(0, 200)); process.exit(1); });
