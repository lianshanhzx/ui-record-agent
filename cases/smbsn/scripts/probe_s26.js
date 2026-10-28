const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(1500);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type=radio]').first().evaluate(el=>el.click());
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(4000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-tree [role="treeitem"]').filter({hasText:'客户管理'}).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);
  const ROWS='.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
  const del = () => pane.locator('span').filter({hasText:/^\s*删除\s*$/}).filter({visible:true}).first();
  for (let i=0;i<5 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{}); await page.waitForTimeout(1500);}
  console.log('CLEANED='+await page.locator(ROWS).count());
  const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FILE)), upBtn.click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  console.log('ROWS='+await page.locator(ROWS).count());
  // hover 首行 + 点「移动」(fixed-right)
  const moveX = "//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='移动']";
  const lm = page.locator('xpath='+moveX).filter({visible:true}).first();
  console.log('MOVE_XPATH count='+(await page.locator('xpath='+moveX).count())+' vis='+(await lm.count()));
  await lm.click({timeout:8000});
  await page.waitForTimeout(2500);
  // 捕获「移动目录」dialog
  const dlg = await page.evaluate(()=>{
    const d=[...document.querySelectorAll('.el-dialog')].find(x=>getComputedStyle(x).display!=='none' && x.innerText.includes('移动'));
    if(!d) return { noDialog:true };
    const title=(d.querySelector('.el-dialog__title')||{}).textContent||'';
    const treeNodes=[...d.querySelectorAll('.el-tree-node__content, [role=treeitem] .el-tree-node__label, .el-tree-node span')].map(n=>n.textContent.trim()).filter(Boolean);
    const uniqueNodes=[...new Set(treeNodes)];
    const btns=[...d.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(Boolean);
    const hasTree=!!d.querySelector('.el-tree');
    return { title, hasTree, uniqueNodes, btns };
  });
  console.log('MOVE_DLG='+JSON.stringify(dlg));
  await page.screenshot({path:'work/smbsn/s26-move-dialog.png'});
  // 取消关闭
  const cancel = page.locator('.el-dialog:visible button').filter({hasText:/取\s*消/}).first();
  if (await cancel.count()) { await cancel.click({timeout:8000}); await page.waitForTimeout(1500); }
  console.log('AFTER_CANCEL_ROWS='+await page.locator(ROWS).count());
  // 清理文件
  for (let i=0;i<3 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{}); await page.waitForTimeout(1500);}
  console.log('LEFT='+await page.locator(ROWS).count());
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
