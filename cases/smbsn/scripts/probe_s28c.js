const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const reqs=[]; page.on('request', r=>{ if(r.method()==='POST') reqs.push(r.url().split('/').pop()); });
  const resps=[]; page.on('response', async r=>{ if(r.request().method()==='POST'){ try{resps.push({api:r.url().split('/').pop(), st:r.status(), body:(await r.text()).slice(0,180)});}catch(e){resps.push({api:r.url().split('/').pop(),st:r.status(),body:'<err>'});} } });
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
  // 点 保存
  reqs.length=0; resps.length=0;
  await page.locator("//button[normalize-space()='保存']").filter({visible:true}).first().click({timeout:8000});
  await page.waitForTimeout(6000);
  const toast = await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean));
  const dlg = await page.evaluate(()=>[...document.querySelectorAll('.el-message-box,.el-dialog')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({cls:x.className.slice(0,30),title:(x.querySelector('.el-dialog__title,.el-message-box__title')?.textContent||'').trim().slice(0,40)})));
  console.log('TOAST='+JSON.stringify(toast));
  console.log('DLG='+JSON.stringify(dlg));
  console.log('REQS_AFTER_SAVE='+JSON.stringify([...new Set(reqs)]));
  console.log('RESPS='+JSON.stringify(resps.filter(r=>!/findCustTradeList|getCustTrade|hit|getRatingResult/.test(r.api)), null, 1));
  // 若弹了确认框，点确定再看
  const ok = page.locator('.el-message-box:visible button.el-button--primary, .el-dialog:visible button.el-button--primary').first();
  if (await ok.count()){ console.log('HAS_CONFIRM_BTN, clicking...'); await ok.click({timeout:5000}); await page.waitForTimeout(4000); const t2=await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean)); console.log('TOAST2='+JSON.stringify(t2)); console.log('REQS2='+JSON.stringify([...new Set(reqs)])); }
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
