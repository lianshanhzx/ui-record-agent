const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
const CUST='260924144929974126';
(async () => {
  const browser = await chromium.launch({ headless: true, acceptDownloads: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900}, acceptDownloads:true });
  const page = await ctx.newPage();
  const dlgs=[]; page.on('download', d=>dlgs.push({name:d.suggestedFilename(), url:d.url()}));
  const apis=[]; page.on('response', r=>{ if(r.request().method()==='POST' && /FileInf|fileInf|ownload|ownload|zip|Zip|batch|Batch/.test(r.url())) apis.push(r.url().split('/').pop()); });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(1500);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill(CUST);
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio]').first().evaluate(el=>el.click());
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(4000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const ROWS='.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
  const del = () => pane.locator('span').filter({hasText:/^\s*删除\s*$/}).filter({visible:true}).first();
  await pane.locator('.el-tree [role="treeitem"]').filter({hasText:'客户管理'}).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2000);
  for (let i=0;i<6 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForTimeout(1500);}
  console.log('AFTER_CLEAN='+await page.locator(ROWS).count());
  // 上传 2 个文件
  for (let n=0;n<2;n++){
    const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
    await Promise.all([ page.waitForEvent('filechooser',{timeout:20000}).then(fc=>fc.setFiles(FILE)), upBtn.click() ]);
    await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
    await page.waitForTimeout(2500);
  }
  console.log('AFTER_2UP='+await page.locator(ROWS).count());
  // 表格 checkbox 结构
  const struct = await page.evaluate(()=>{
    const tbl=document.querySelector('.el-tab-pane .el-table__body-wrapper .el-table');
    const headerCbs=[...document.querySelectorAll('.el-tab-pane .el-table__header-wrapper input[type=checkbox]')].map(c=>({cls:c.className,checked:c.checked}));
    const bodyCbs=[...document.querySelectorAll('.el-tab-pane .el-table__body-wrapper input[type=checkbox]')].map(c=>({checked:c.checked,vis:(c.getBoundingClientRect().width>0)}));
    // 表格类型列
    const types=[...document.querySelectorAll('.el-tab-pane .el-table__header-wrapper .cell')].map(c=>c.textContent.trim()).filter(Boolean);
    return {headerCbs, bodyCbs, headerTypes:types};
  });
  console.log('HEADER_CBS='+JSON.stringify(struct.headerCbs));
  console.log('BODY_CBS='+JSON.stringify(struct.bodyCbs));
  console.log('HEADER_TYPES='+JSON.stringify(struct.headerTypes));
  // 工具栏 批量操作 按钮
  const batchBtn = pane.getByRole('button').filter({hasText:/批量操作/}).first();
  console.log('BATCH_BTN count='+(await batchBtn.count())+' visible='+(await batchBtn.isVisible().catch(()=>false)));
  // 选 header select-all
  const hcb = page.locator('.el-tab-pane .el-table__header-wrapper input[type=checkbox]').first();
  if (await hcb.count()){ await hcb.evaluate(el=>el.click()); await page.waitForTimeout(1000); }
  const afterSel = await page.evaluate(()=>[...document.querySelectorAll('.el-tab-pane .el-table__body-wrapper input[type=checkbox]')].map(c=>c.checked));
  console.log('AFTER_SELECTALL bodyChecked='+JSON.stringify(afterSel));
  // 点批量操作
  dlgs.length=0; apis.length=0;
  const bp = page.waitForResponse(r=>r.request().method()==='POST'&&/FileInf|fileInf|ownload|ownload|zip|Zip|batch|Batch|download|Download/.test(r.url()),{timeout:30000}).catch(()=>null);
  await batchBtn.click({timeout:8000});
  await page.waitForTimeout(5000);
  if (bp){ console.log('BATCH_API='+(await bp).url().split('/').pop()+' resp='+(await (await bp).text()).slice(0,150)); }
  console.log('DOWNLOADS='+dlgs.length+' '+JSON.stringify(dlgs.slice(0,5)));
  const toast = await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean));
  console.log('TOAST='+JSON.stringify(toast));
  const dlgOpen = await page.evaluate(()=>{ const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.getBoundingClientRect().width>0); return d.map(x=>x.querySelector('.el-dialog__title')?.textContent.trim()); });
  console.log('OPEN_DIALOG='+JSON.stringify(dlgOpen));
  console.log('APIS='+JSON.stringify(apis));
  // cleanup
  for (let i=0;i<6 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForTimeout(1500);}
  console.log('CLEANED='+await page.locator(ROWS).count());
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
