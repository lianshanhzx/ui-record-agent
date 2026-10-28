// probe_smbsn_10.js - 抓取列表请求头 + 扫描 JS bundle 找 custTrade 删除接口
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  let listHeaders = null;
  page.on('request', (r) => {
    if (r.url().includes('findCustTradeList') && !listHeaders) listHeaders = r.headers();
  });

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(3000);
  console.log('LIST_HEADERS=', JSON.stringify(listHeaders || null, null, 1));

  // 收集所有已加载 js
  const jsUrls = await page.evaluate(async () => {
    const set = new Set();
    document.querySelectorAll('script[src]').forEach((s) => set.add(s.src));
    performance.getEntriesByType('resource').forEach((e) => { if (e.name.endsWith('.js') || e.name.includes('.js?')) set.add(e.name); });
    return Array.from(set);
  });
  console.log('JS_COUNT=', jsUrls.length);
  const found = new Set();
  for (const u of jsUrls) {
    try {
      const res = await page.evaluate(async (url) => {
        const r = await fetch(url, { credentials: 'include' });
        return r.ok ? r.text() : '';
      }, u);
      const re = /["'`]([A-Za-z0-9_\/.-]*[Dd]el[A-Za-z0-9_\/.-]*[Cc]ust[A-Za-z0-9_\/.-]*|custTrade\/[A-Za-z0-9_]+)["'`]/g;
      let m;
      while ((m = re.exec(res))) found.add(m[1]);
      const re2 = /["'`]([A-Za-z0-9_\/-]*(?:Cust|cust)[A-Za-z0-9_\/-]*(?:del|Del|delete|Delete|remove|Remove|cancel|Cancel|invalid|Invalid)[A-Za-z0-9_\/-]*)["'`]/g;
      while ((m = re2.exec(res))) found.add(m[1]);
    } catch {}
  }
  console.log('DEL_CANDIDATES=', JSON.stringify([...found].slice(0, 60), null, 1));
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
