const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  const SIZE = "//span[contains(@class,'el-pagination__sizes')]//div[contains(@class,'el-select--mini')]";
  const sel = page.locator(SIZE).first();
  console.log('SEL_COUNT='+await page.locator(SIZE).count());
  await sel.click();
  await page.waitForTimeout(1500);
  const dds = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const out = [];
    for (const d of document.querySelectorAll('.el-select-dropdown')) {
      const r = d.getBoundingClientRect();
      const vis = r.width>0&&r.height>0 && getComputedStyle(d).display!=='none';
      out.push({ vis, items:[...d.querySelectorAll('.el-select-dropdown__item')].map(i=>txt(i)).filter(Boolean) });
    }
    return out;
  });
  console.log('DROPDOWNS='+JSON.stringify(dds));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
