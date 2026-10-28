const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164';
const X_JC="//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户简称']]//input";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const reqs=[]; const urlLog=[];
  page.on('request', r=>{ if(r.method()==='POST') reqs.push(r.url().split('/').pop()); });
  page.on('framenavigated', f=>{ if(f===page.mainFrame()) urlLog.push(f.url().slice(0,80)); });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill(CUST);
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
  await page.waitForTimeout(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio]').first().evaluate(el=>el.click());
  const gcP = page.waitForResponse(r=>r.url().includes('getCustTrade')&&r.request().method()==='POST',{timeout:60000}).catch(()=>null);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForURL(/mdfSmbsnCst/,{timeout:30000});
  await page.waitForSelector('.el-form-item:visible',{timeout:60000});
  if(gcP) await gcP.catch(()=>{});
  await page.waitForTimeout(5000);
  const jc = page.locator('xpath='+X_JC).first();
  const v0 = await jc.inputValue();
  await jc.click(); await jc.fill(v0+'F'); await page.waitForTimeout(1500);
  // 点 保存（正式保存，脏表单）
  reqs.length=0; urlLog.length=0;
  await page.getByRole('button').filter({hasText:/保\s*存/}).first().click({timeout:8000});
  // 轮询 URL 10s
  for (let i=0;i<20;i++){ await page.waitForTimeout(500); try{ urlLog.push('poll'+i+':'+page.url().slice(0,70)); }catch(e){ urlLog.push('poll'+i+':PAGE_GONE'); break; } }
  console.log('URLS='+JSON.stringify(urlLog));
  console.log('POSTS='+JSON.stringify([...new Set(reqs)]));
  // 最终状态：确保在列表页，查 R1 状态
  try {
    if(!/smbsnCstMgtPg/.test(page.url())){ await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'}); }
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
    await page.waitForTimeout(2000);
    await page.locator(".el-form-item:has(label:has-text('客户编号')) input").fill(CUST);
    const qP=page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
    await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
    const j=JSON.parse(await (await qP).text());
    console.log('FINAL_STATUS total='+j.data.total+' cstSt='+j.data.list[0].cstSt+' cstNm='+j.data.list[0].cstNm+' jc='+(j.data.list[0].cstShrtnm||''));
  } catch(e){ console.log('FINAL_CHECK_ERR '+e.message.slice(0,150)); }
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
