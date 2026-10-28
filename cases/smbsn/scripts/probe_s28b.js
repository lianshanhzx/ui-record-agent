const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164'; // R1 一次性 S1 测试客户
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const posts=[]; page.on('request', r=>{ if(r.method()==='POST') posts.push(r.url().split('/').pop()); });
  const resps=[]; page.on('response', async r=>{ if(r.request().method()==='POST' && /save|Save|submit|Submit|formal|Formal|prsv/.test(r.url())){ try{resps.push({api:r.url().split('/').pop(), status:r.status(), body:(await r.text()).slice(0,200)});}catch(e){} } });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  // 查询 R1
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill(CUST);
  const qP = page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  const qj=JSON.parse(await (await qP).text());
  const st0 = qj.data.list[0].cstSt;
  console.log('BEFORE total='+qj.data.total+' cstSt='+st0+' cstNm='+qj.data.list[0].cstNm);
  await page.waitForTimeout(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio]').first().evaluate(el=>el.click());
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForURL(/mdfSmbsnCst/,{timeout:30000});
  await page.waitForSelector('.el-form-item:visible',{timeout:60000});
  await page.waitForTimeout(5000);
  // dump 场景页按钮
  const btns = await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>{const t=b.textContent.trim();const r=b.getBoundingClientRect();return t&&r.width>0;}).map(b=>({t:b.textContent.trim(),y:Math.round(b.getBoundingClientRect().y/900*100)/100})).filter(x=>/保存|暂存|返回|引入/.test(x.t)));
  console.log('SCENE_BTNS='+JSON.stringify(btns));
  // 点 保存（正式保存）
  const saveBtn = page.locator("//button[normalize-space()='保存']").filter({visible:true});
  console.log('SAVE_BTN count='+(await saveBtn.count()));
  posts.length=0; resps.length=0;
  const saveP = page.waitForResponse(r=>r.request().method()==='POST'&&/save|Save|submit|Submit|prsv|Formal|formal/.test(r.url()),{timeout:30000}).catch(()=>null);
  await saveBtn.first().click({timeout:8000});
  await page.waitForTimeout(3000);
  const toast0 = await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean));
  const dlg0 = await page.evaluate(()=>[...document.querySelectorAll('.el-message-box,.el-dialog')].filter(x=>x.getBoundingClientRect().width>0).map(x=>(x.querySelector('.el-dialog__title,.el-message-box__title')?.textContent||x.className).trim().slice(0,40)));
  if (saveP){ const sr=await saveP; console.log('SAVE_API='+sr.url().split('/').pop()+' status='+sr.status()+' resp='+(await sr.text()).slice(0,200)); }
  console.log('TOAST='+JSON.stringify(toast0));
  console.log('DLG='+JSON.stringify(dlg0));
  console.log('POSTS='+JSON.stringify([...new Set(posts)]));
  // 反查状态
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").fill(CUST);
  const qP2 = page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  const qj2=JSON.parse(await (await qP2).text());
  console.log('AFTER_SAVE total='+qj2.data.total+' cstSt='+qj2.data.list[0].cstSt+' cstNm='+qj2.data.list[0].cstNm);
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
