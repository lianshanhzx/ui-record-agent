const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260924144929974126';
const X_NO="//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//input";
const X_TAB="//div[contains(@class,'el-tabs__item')][normalize-space(.)='影像资料']";
const X_TREE="//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']";
const X_UPLOAD="//button[normalize-space()='上传']";
const X_BIND="//button[normalize-space()='装订成册']";
const FILE=path.join(__dirname,'AT_test_image_upload.png');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900}, acceptDownloads:true });
  const page = await ctx.newPage();
  const posts=[]; page.on('request', r=>{ if(r.method()==='POST') posts.push(r.url().split('/').pop()); });
  let dl=null; page.on('download', d=>{ dl=d.suggestedFilename(); });
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
  await page.locator('xpath='+X_TAB).first().click();
  await page.waitForTimeout(2500);
  await page.locator('xpath='+X_TREE).first().click();
  const pfP = page.waitForResponse(r=>r.url().includes('pageFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>null);
  await page.waitForTimeout(2000);
  if(pfP) await pfP.catch(()=>{});
  // 文件数
  const rows = page.locator('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr');
  let n = await rows.count();
  console.log('FILES_BEFORE='+n);
  // 工具栏按钮
  const tb = await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>{const t=b.textContent.trim();const r=b.getBoundingClientRect();return t&&r.width>0&&/刷新|批量操作|装订成册|扫描仪|上传|图册查看|视图预览/.test(t);}).map(b=>({t:b.textContent.trim(), dis:b.disabled, cls:b.className.includes('disableBtn')?'disBtn':''})));
  console.log('TOOLBAR='+JSON.stringify(tb));
  // 若 0 文件则上传 1 个
  if(n===0){
    const [fc] = await Promise.all([page.waitForEvent('filechooser',{timeout:15000}), page.locator('xpath='+X_UPLOAD).first().click()]);
    await fc.setFiles(FILE);
    await page.waitForResponse(r=>r.url().includes('upload')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(2500);
    n = await rows.count();
    console.log('FILES_AFTER_UPLOAD='+n);
  }
  // 点 装订成册
  const bind = page.locator('xpath='+X_BIND).first();
  const bindDis = await bind.evaluate(b=>b.disabled).catch(()=>null);
  const bindCls = await bind.evaluate(b=>b.className).catch(()=>'GONE');
  console.log('BIND_DISABLED='+bindDis+' cls='+bindCls);
  posts.length=0;
  const rP = page.waitForResponse(r=>r.request().method()==='POST',{timeout:25000}).catch(()=>null);
  await bind.click({timeout:8000});
  await page.waitForTimeout(4000);
  // 是否有 dialog / message-box
  const dialogs = await page.evaluate(()=>[...document.querySelectorAll('.el-dialog, .el-message-box, .el-drawer')].filter(d=>d.getBoundingClientRect().width>0).map(d=>({cls:d.className, title:(d.querySelector('.el-dialog__title,.el-message-box__title')||{}).textContent||'', body:(d.querySelector('.el-dialog__body,.el-message-box__content')||{}).textContent||''})).map(d=>({cls:d.cls.slice(0,60), title:d.title.trim().slice(0,30), body:d.body.trim().slice(0,120)})));
  console.log('DIALOGS='+JSON.stringify(dialogs));
  console.log('TOAST='+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('.el-message,.el-notification')].map(m=>m.textContent.trim()).filter(Boolean)).catch(()=>'GONE')));
  console.log('POSTS='+JSON.stringify([...new Set(posts)]));
  const rR=await rP; if(rR) console.log('FIRST_POST='+rR.url().split('/').pop()+' status='+rR.status()+' resp='+(await rR.text()).slice(0,150));
  console.log('DOWNLOAD='+dl);
  await page.screenshot({path:path.join(__dirname,'probe_s29_after_bind.png')});
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,500));process.exit(1);});
