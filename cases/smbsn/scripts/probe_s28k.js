const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164';
const X_JC="//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户简称']]//input";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const reqs=[]; page.on('request', r=>{ if(r.method()==='POST') reqs.push(r.url().split('/').pop()); });
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
  // dump 所有含「保存」的按钮
  const saveBtns = await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>/保存/.test(b.textContent)&&b.getBoundingClientRect().width>0).map(b=>({t:b.textContent.trim(), y:Math.round(b.getBoundingClientRect().y), x:Math.round(b.getBoundingClientRect().x), cls:b.className})));
  console.log('SAVE_BTNS='+JSON.stringify(saveBtns));
  const jc = page.locator('xpath='+X_JC).first();
  const v0 = await jc.inputValue();
  await jc.click(); await jc.fill(v0+'K'); await page.waitForTimeout(1500);
  // 先 暂存
  reqs.length=0;
  const tP = page.waitForResponse(r=>r.url().includes('saveCustTrade')&&r.request().method()==='POST',{timeout:30000}).catch(()=>null);
  await page.getByRole('button').filter({hasText:/暂\s*存/}).first().click({timeout:8000});
  await page.waitForTimeout(3000);
  const tR=await tP; console.log('TEMP_SAVE='+(tR?tR.status()+' '+(await tR.text()).slice(0,80):'NONE')+' POSTS='+JSON.stringify([...new Set(reqs)]));
  await page.waitForTimeout(1500);
  // 再 保存（正式）
  reqs.length=0;
  const sP = page.waitForResponse(r=>r.request().method()==='POST'&&/save|Save|submit|prsv|formal|Formal|CustTrade/.test(r.url()),{timeout:30000}).catch(()=>null);
  await page.getByRole('button').filter({hasText:/^保\s*存$/}).first().click({timeout:8000});
  await page.waitForTimeout(5000);
  console.log('FORMAL_TOAST='+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean)).catch(()=>'GONE')));
  console.log('FORMAL_URL='+page.url().slice(0,70));
  console.log('FORMAL_POSTS='+JSON.stringify([...new Set(reqs)]));
  const sR=await sP; if(sR)console.log('FORMAL_API='+sR.url().split('/').pop()+' status='+sR.status()+' resp='+(await sR.text()).slice(0,150));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
