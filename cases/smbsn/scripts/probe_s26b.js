const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
const CUST='260924144929974126';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const apis=[]; page.on('response', r=>{ if(r.request().method()==='POST' && /FileInf|fileInf|move|Move/.test(r.url())) apis.push(r.url().split('/').pop()); });
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
  // 清理 客户管理 + 贷后管理
  for (const node of ['客户管理','贷后管理']){
    await pane.locator('.el-tree [role="treeitem"]').filter({hasText:node}).first().locator('.el-tree-node__content').first().click();
    await page.waitForTimeout(2000);
    for (let i=0;i<5 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{}); await page.waitForTimeout(1500);}
  }
  // 回客户管理 + 上传
  await pane.locator('.el-tree [role="treeitem"]').filter({hasText:'客户管理'}).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2000);
  console.log('CUST_BEFORE='+await page.locator(ROWS).count());
  const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FILE)), upBtn.click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  console.log('CUST_AFTER_UP='+await page.locator(ROWS).count());
  // 点「移动」
  await page.locator("xpath=//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='移动']").filter({visible:true}).first().click({timeout:8000});
  await page.waitForTimeout(2500);
  // 移动 dialog 里点「贷后管理」
  const DLG="//div[contains(@class,'el-dialog')][.//span[contains(@class,'el-dialog__title')][normalize-space(.)='移动目录']]";
  const nodeX = DLG+"//div[contains(@class,'el-tree-node__content')][normalize-space(.)='贷后管理']";
  const ln = page.locator('xpath='+nodeX);
  console.log('NODE_XPATH count='+(await ln.count()));
  await ln.first().click({timeout:8000});
  await page.waitForTimeout(1000);
  const selected = await page.evaluate((dx)=>{ const d=document.evaluate(dx,document,null,XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue; if(!d)return'NO_DLG'; const cur=d.querySelector('.el-tree-node.is-current, .el-tree-node__content.is-current'); return cur?cur.textContent.trim().slice(0,20):'NO_CURRENT'; }, DLG);
  console.log('SELECTED='+selected);
  // 确认选择
  const confirm = page.locator('.el-dialog:visible button').filter({hasText:/确认选择/}).first();
  const cp = page.waitForResponse(r=>r.request().method()==='POST'&&/FileInf|fileInf|move|Move|catalog|Catalog/.test(r.url()),{timeout:30000}).catch(()=>null);
  await confirm.click({timeout:8000});
  await page.waitForTimeout(3000);
  if (cp){ const cj=await (await cp).text().catch(()=>''); console.log('CONFIRM_API='+(await cp).url().split('/').pop()+' resp='+cj.slice(0,120)); }
  console.log('CUST_AFTER_MOVE='+await page.locator(ROWS).count());
  // 看 toast
  const toast = await page.evaluate(()=>[...document.querySelectorAll('.el-message')].map(m=>m.textContent.trim()).filter(Boolean));
  console.log('TOAST='+JSON.stringify(toast));
  // 切到贷后管理看文件
  await pane.locator('.el-tree [role="treeitem"]').filter({hasText:'贷后管理'}).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);
  const dh = await page.locator(ROWS).first().innerText().catch(()=>'');
  console.log('LOAN_AFTER_ROW='+(dh.replace(/\s+/g,' ').slice(0,60)));
  // 清理贷后管理
  for (let i=0;i<5 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{}); await page.waitForTimeout(1500);}
  console.log('LOAN_CLEANED='+await page.locator(ROWS).count());
  console.log('APIS='+JSON.stringify(apis));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
