const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const apis=[]; page.on('response', r=>{ if(r.request().method()==='POST' && /findCustTradeList|getCustTrade/.test(r.url())) apis.push(r.url().split('/').pop()); });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2500);
  // 默认列表第一页 dump 行 (客户名称/客户编号/客户状态)
  const rows = await page.evaluate(()=>{
    const trs=[...document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')];
    return trs.map(tr=>[...tr.querySelectorAll('td .cell')].map(c=>c.textContent.trim()).join(' | '));
  });
  console.log('ROWCOUNT='+rows.length);
  rows.forEach((r,i)=>console.log('R'+i+': '+r.slice(0,160)));
  // 表头
  const head = await page.evaluate(()=>[...document.querySelectorAll('.el-table__header-wrapper th .cell')].map(c=>c.textContent.trim()));
  console.log('HEAD='+JSON.stringify(head));
  console.log('APIS='+JSON.stringify([...new Set(apis)]));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
