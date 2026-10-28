const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  for (const CUST of ['260924144929974126','260930092649839164']){
    await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
    await page.waitForTimeout(2000);
    await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill(CUST);
    await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
    await page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
    await page.waitForTimeout(1500);
    await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio]').first().evaluate(el=>el.click());
    await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
    await page.waitForURL(/mdfSmbsnCst/,{timeout:30000});
    await page.waitForSelector('.el-form-item:visible',{timeout:60000});
    await page.waitForTimeout(5000);
    const btns = await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>{const t=b.textContent.trim();const r=b.getBoundingClientRect();return t&&r.width>0&&r.y>800;}).map(b=>({t:b.textContent.trim(), disableBtn:/disableBtn/.test(b.className), disabled:b.disabled})));
    console.log('CUST='+CUST+' BOTTOM_BTNS='+JSON.stringify(btns));
  }
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
