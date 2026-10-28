const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260924144929974126';
const X_NO="//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//input";
const TAB = (t)=>"//div[contains(@class,'el-tabs__item')][normalize-space(.)='"+t+"']";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator('xpath='+X_NO).first().fill(CUST);
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
  await page.waitForTimeout(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio]').first().evaluate(el=>el.click());
  const gcP = page.waitForResponse(r=>r.url().includes('getCustTrade')&&r.request().method()==='POST',{timeout:60000}).catch(()=>null);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForURL(/mdfSmbsnCst/,{timeout:30000});
  await page.waitForSelector('.el-form-item:visible',{timeout:60000});
  if(gcP) await gcP.catch(()=>{});
  await page.waitForTimeout(4000);
  // 股东信息 tab → 行数
  await page.locator('xpath='+TAB('股东信息')).first().click();
  await page.waitForTimeout(3000);
  const shRows = await page.evaluate(()=>{
    const panes=[...document.querySelectorAll('.el-tab-pane')].filter(p=>p.getBoundingClientRect().width>0);
    let max=0; for(const p of panes){ const tr=p.querySelectorAll('.el-table__body tbody tr'); if(tr.length>max) max=tr.length; }
    return max;
  });
  console.log('SHAREHOLDER_ROWS='+shRows);
  // 关联人信息 tab → 行数
  await page.locator('xpath='+TAB('关联人信息')).first().click();
  await page.waitForTimeout(3000);
  const relRows = await page.evaluate(()=>{
    const panes=[...document.querySelectorAll('.el-tab-pane')].filter(p=>p.getBoundingClientRect().width>0);
    let max=0; for(const p of panes){ const tr=p.querySelectorAll('.el-table__body tbody tr'); if(tr.length>max) max=tr.length; }
    return max;
  });
  console.log('RELATED_ROWS='+relRows);
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
