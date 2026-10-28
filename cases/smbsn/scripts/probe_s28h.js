const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164';
const X=(lb)=>"//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='"+lb+"']]//input";
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
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForURL(/mdfSmbsnCst/,{timeout:30000});
  await page.waitForSelector('.el-form-item:visible',{timeout:60000});
  await page.waitForResponse(r=>r.url().includes('getCustTrade')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(5000);
  // openAllSections: 展开所有 aria-expanded=false 的折叠段
  const opened = await page.evaluate(()=>{ let n=0; document.querySelectorAll('[aria-expanded="false"]').forEach(e=>{ if(e.click){e.click();n++;} }); return n; });
  await page.waitForTimeout(2000);
  console.log('OPENED_SECTIONS='+opened);
  const st = async ()=>JSON.stringify(await page.evaluate(()=>{ const b=t=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t&&x.getBoundingClientRect().width>0); return ['保存','暂存','返回'].map(t=>({t, db:b(t)?/disableBtn/.test(b(t).className):null})); }));
  console.log('BTNS_BEFORE_EDIT='+await st());
  // 编辑 3 个文本字段
  for (const lb of ['客户简称','联系人姓名','联系电话']){
    const el = page.locator('xpath='+X(lb)).first();
    if (await el.count()){ const v=await el.inputValue().catch(()=>''); await el.click(); await el.fill((v||'')+'X'); await page.waitForTimeout(500); }
  }
  await page.waitForTimeout(2000);
  console.log('BTNS_AFTER_EDIT='+await st());
  // 若 保存 enabled，点它
  const saveDb = await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='保存'&&x.getBoundingClientRect().width>0); return b?/disableBtn/.test(b.className):null; });
  console.log('SAVE_DISABLED='+saveDb);
  if (!saveDb){
    const reqs=[]; page.on('request', r=>{ if(r.method()==='POST') reqs.push(r.url().split('/').pop()); });
    const saveP = page.waitForResponse(r=>r.request().method()==='POST'&&/save|Save|submit|prsv|formal|Formal/.test(r.url()),{timeout:30000}).catch(()=>null);
    await page.locator("//button[normalize-space()='保存']").filter({visible:true}).first().click({timeout:8000});
    await page.waitForTimeout(4000);
    console.log('TOAST='+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean))));
    console.log('REQS='+JSON.stringify([...new Set(reqs)]));
    if(saveP){const sr=await saveP; if(sr)console.log('SAVE_API='+sr.url().split('/').pop()+' resp='+(await sr.text()).slice(0,200));}
  }
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
