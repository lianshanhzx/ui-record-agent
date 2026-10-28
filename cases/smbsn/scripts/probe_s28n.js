const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260924144929974126'; // R0 base (jc 现为 AT_SMB简称改改改改改M)
const X_JC="//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户简称']]//input";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
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
  // 完全替换为不同定值（spec 的做法），但等 2500ms
  const target = 'AT_S28暂存';
  await jc.click(); await jc.fill(target); await page.waitForTimeout(2500);
  const valAfter = await jc.inputValue();
  const saveP = page.waitForResponse(r=>r.url().includes('saveCustTrade')&&r.request().method()==='POST',{timeout:30000}).catch(()=>null);
  await page.getByRole('button').filter({hasText:/^暂\s*存$/}).first().click({timeout:8000});
  await page.waitForTimeout(3000);
  console.log('jc v0='+v0+' -> filled='+valAfter+' (target='+target+')');
  console.log('TOAST='+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean)).catch(()=>'GONE')));
  const sR=await saveP; console.log('SAVECUST_TRADE='+(sR?sR.status()+' '+(await sR.text()).slice(0,100):'NONE'));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
