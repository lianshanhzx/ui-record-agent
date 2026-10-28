// probe53: 对公客户列表——找有注册资本的真实法人客户，供 S4 股东指向（后端修改路径反查关联客户注册资本）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let listJson = null;
  const p = page.waitForResponse((r) => r.url().includes('findCustCorporatList') && r.request().method() === 'POST', { timeout: 90000 });
  await page.goto(BASE + '/#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  const resp = await p;
  listJson = await resp.json().catch(() => null);
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 60000 }).catch(() => {});
  await sleep(2000);

  const d = (listJson || {}).data || {};
  const rows = d.list || d.records || d.rows || (Array.isArray(d) ? d : null);
  console.log('P53_TOP_KEYS=' + Object.keys(listJson || {}).join(','));
  console.log('P53_DATA_KEYS=' + Object.keys(d).join(','));
  console.log('P53_TOTAL=' + (d.total ?? d.totalCount ?? '?') + ' rows=' + (rows ? rows.length : 0));
  if (rows && rows[0]) {
    console.log('P53_ROW_KEYS=' + Object.keys(rows[0]).join(','));
    const pick = (r) => ({
      cstNo: r.cstNo, cstNm: r.cstNm, crdtTp: r.crdtTp, crdtNo: r.crdtNo,
      rgstCaptlfundAmt: r.rgstCaptlfundAmt, cstCgy: r.cstCgy, cstSt: r.cstSt,
      lglRprsNm: r.lglRprsNm, uscc: r.uscc,
    });
    const all = rows.map(pick);
    fs.writeFileSync(path.join(__dirname, 'corp-candidates.json'), JSON.stringify(all, null, 2), 'utf8');
    console.log('P53_SAVED corp-candidates.json n=' + all.length);
    console.log('P53_FIRST10=' + JSON.stringify(all.slice(0, 10), null, 1));
  }

  // 表格表头（确认页面可见列）
  const heads = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => (h.innerText || '').trim()).filter(Boolean)
  );
  console.log('P53_HEADS=' + JSON.stringify(heads));
  await browser.close();
})().catch((e) => { console.error('P53_ERROR', e.message); process.exit(1); });
