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
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  // 业务信息 tab
  await page.locator(".el-tabs__item:has-text('业务信息'), [role=tab]:has-text('业务信息')").first().click();
  await page.waitForTimeout(3000);
  const biz = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const btns = [...document.querySelectorAll('button')].filter(vis).map(b=>({t:txt(b),dis:b.disabled})).filter(x=>x.t);
    const tables = [...document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')].length;
    const secText = txt(document.querySelector('.el-collapse, [class*="tab-pane"], .el-tabs__content') || document).slice(0,300);
    return { btns, tables, secText };
  });
  console.log('BIZ_BTNS='+JSON.stringify(biz.btns));
  console.log('BIZ_TABLE_ROWS='+biz.tables);
  console.log('BIZ_TEXT='+biz.secText.slice(0,200));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
