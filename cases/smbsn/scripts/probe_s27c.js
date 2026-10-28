const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
const CUST='260924144929974126';
const X_BATCH="//button[normalize-space()='批量操作']";
const X_HCB="//div[contains(@class,'el-tab-pane')]//div[contains(@class,'el-table__header-wrapper')]//input[@type='checkbox']";
(async () => {
  const browser = await chromium.launch({ headless: true, acceptDownloads: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900}, acceptDownloads:true });
  const page = await ctx.newPage();
  const dlgs=[]; page.on('download', d=>dlgs.push(d.suggestedFilename()));
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
  for (let n=0;n<2;n++){ const upBtn=pane.getByRole('button').filter({hasText:/上\s*传/}).first(); await Promise.all([page.waitForEvent('filechooser',{timeout:20000}).then(fc=>fc.setFiles(FILE)), upBtn.click()]); await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(2500); }
  console.log('ROWS='+await page.locator(ROWS).count());
  const res = await page.evaluate((xp)=>{
    const q=(x)=>{const r=document.evaluate(x,document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);const out=[];for(let i=0;i<r.snapshotLength;i++){const n=r.snapshotItem(i);const b=n.getBoundingClientRect();out.push({vis:b.width>0&&b.height>0,html:(n.outerHTML||'').slice(0,120)});}return {count:r.snapshotLength,items:out};};
    return { batch:q(xp.batch), hcb:q(xp.hcb) };
  }, {batch:X_BATCH, hcb:X_HCB});
  console.log('BATCH count='+res.batch.count+' vis='+res.batch.items.filter(i=>i.vis).length+' html='+(res.batch.items[0]||{}).html);
  console.log('HCB count='+res.hcb.count+' vis='+res.hcb.items.filter(i=>i.vis).length);
  // xpath 点全选
  await page.locator('xpath='+X_HCB).first().click({timeout:8000});
  await page.waitForTimeout(1000);
  const checked = await page.evaluate(()=>[...document.querySelectorAll('.el-tab-pane .el-table__body-wrapper input[type=checkbox]')].map(c=>c.checked));
  console.log('AFTER_XPATH_SELECTALL='+JSON.stringify(checked));
  // xpath 点批量操作 → 捕获 zip
  dlgs.length=0;
  const dlp = page.waitForEvent('download',{timeout:20000});
  await page.locator('xpath='+X_BATCH).first().click({timeout:8000});
  const dl = await dlp;
  const zp = path.join(__dirname,'s27-probe.zip');
  await dl.saveAs(zp);
  console.log('ZIP='+dl.suggestedFilename()+' size='+require('fs').statSync(zp).size);
  // cleanup
  for (let i=0;i<6 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForTimeout(1500);}
  console.log('CLEANED='+await page.locator(ROWS).count());
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
