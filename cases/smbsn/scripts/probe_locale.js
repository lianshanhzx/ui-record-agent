const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  for (const headless of [false, true]) {
    const browser = await chromium.launch({ headless });
    const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
    const page = await ctx.newPage();
    const navLang = await page.evaluate(() => navigator.language);
    const langs = await page.evaluate(() => navigator.languages);
    await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
    await page.waitForTimeout(2000);
    const pagText = (await page.locator('.el-pagination').innerText()).replace(/\s+/g,' ').slice(0,60);
    console.log(`headless=${headless} navigator.language=${navLang} languages=${JSON.stringify(langs)} PAGER="${pagText}"`);
    await browser.close();
  }
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
