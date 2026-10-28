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
  const html = await page.evaluate(() => {
    const sizes = document.querySelector('.el-pagination__sizes');
    if (!sizes) return { noSizes:true, pagHtml: document.querySelector('.el-pagination')?.outerHTML?.slice(0,600) };
    return { sizesClass: sizes.className, sizesHtml: sizes.outerHTML.slice(0,500) };
  });
  console.log(JSON.stringify(html,null,1));
  // 测试各 XPath
  const tests = [
    "//div[contains(@class,'el-pagination__sizes')]//div[contains(@class,'el-select')]",
    "//div[contains(@class,'el-pagination')]//div[contains(@class,'el-select')]",
    "//div[contains(@class,'el-pagination__sizes')]",
  ];
  for (const x of tests) {
    const c = await page.locator(x).count();
    console.log('XPATH count='+c+' :: '+x);
  }
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
