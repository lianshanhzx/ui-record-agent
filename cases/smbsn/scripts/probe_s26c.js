const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
const CUST='260924144929974126';
const DLG="//div[contains(@class,'el-dialog')][.//span[contains(@class,'el-dialog__title')][normalize-space(.)='移动目录']]";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
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
  for (let i=0;i<5 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForTimeout(1500);}
  const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FILE)), upBtn.click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  await page.locator("xpath=//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='移动']").filter({visible:true}).first().click({timeout:8000});
  await page.waitForTimeout(2500);
  // evaluate the 3 pure xpaths
  const res = await page.evaluate((args)=>{
    const q=(xp)=>{const r=document.evaluate(xp,document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);const out=[];for(let i=0;i<r.snapshotLength;i++){const n=r.snapshotItem(i);const b=n.getBoundingClientRect();out.push({vis:b.width>0&&b.height>0,w:Math.round(b.width),h:Math.round(b.height),html:(n.outerHTML||'').slice(0,120)});}return {count:r.snapshotLength,items:out};};
    return { move:q(args.move), node:q(args.node), confirm:q(args.confirm) };
  }, { move:"//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='移动']",
       node:DLG+"//div[contains(@class,'el-tree-node__content')][normalize-space(.)='贷后管理']",
       confirm:DLG+"//button[normalize-space()='确认选择']" });
  console.log('MOVE count='+res.move.count+' vis='+res.move.items.filter(i=>i.vis).length);
  console.log('NODE count='+res.node.count+' vis='+res.node.items.filter(i=>i.vis).length);
  console.log('CONFIRM count='+res.confirm.count+' vis='+res.confirm.items.filter(i=>i.vis).length);
  if(res.confirm.items[0]) console.log('CONFIRM_HTML='+res.confirm.items[0].html);
  // cleanup: 取消
  await page.locator('.el-dialog:visible button').filter({hasText:/取\s*消/}).first().click({timeout:8000}).catch(()=>{});
  await page.waitForTimeout(1500);
  for (let i=0;i<5 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForTimeout(1500);}
  console.log('CLEANED='+await page.locator(ROWS).count());
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
