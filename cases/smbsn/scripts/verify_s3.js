const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const TARGET = 'AT_SMB股东_20260930094145';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  let cap=null;
  page.on('response', async r=>{ if(r.url().includes('queryCustCorporatRelatedParty')&&r.request().method()==='POST'){ try{cap=await r.json();}catch(e){} } });
  // 进场景页触发股东表加载
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(1500);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  // 选中行→修改进场景
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio], .el-radio').first().check().catch(async()=>{ await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click(); });
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(5000);
  // 点股东信息 tab
  await page.locator(".el-tabs__item:has-text('股东信息'), [role=tab]:has-text('股东信息')").first().click().catch(()=>{});
  await page.waitForTimeout(4000);
  if(cap){ const d=cap.data||{}; const list=d.list||[];
    const hit=list.find(x=>String(x.shNm||x.cstNm||'').includes(TARGET)||JSON.stringify(x).includes(TARGET));
    console.log('SH_TOTAL='+d.total+' HIT='+(!!hit));
    if(hit) console.log('ROW='+JSON.stringify(hit).slice(0,200));
  } else console.log('NOT_CAPTURED');
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,200));process.exit(1);});
