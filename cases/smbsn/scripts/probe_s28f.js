const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const reqs=[]; page.on('request', r=>{ if(r.method()==='POST') reqs.push(r.url().split('/').pop()); });
  const resps=[]; page.on('response', async r=>{ if(r.request().method()==='POST'){ try{resps.push({api:r.url().split('/').pop(), st:r.status(), body:(await r.text()).slice(0,200)});}catch(e){} } });
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
  // dump 可编辑文本字段（非 disabled 的 input，带 label）
  const fields = await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('.el-form-item').forEach(fi=>{
      const lb=fi.querySelector('label')?.textContent.trim();
      const inp=fi.querySelector('input:not([disabled]),textarea:not([disabled])');
      if(lb&&inp){ const r=inp.getBoundingClientRect(); if(r.width>0) out.push({lb, tag:inp.tagName, val:(inp.value||'').slice(0,20)}); }
    });
    return out.slice(0,40);
  });
  console.log('EDITABLE_FIELDS='+JSON.stringify(fields));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
