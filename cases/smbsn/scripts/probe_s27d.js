const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
const CUST='260924144929974126';
(async () => {
  const browser = await chromium.launch({ headless: true, acceptDownloads: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900}, acceptDownloads:true });
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
  for (let i=0;i<6 && (await page.locator(ROWS).count());i++){ if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200); await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000}); await page.waitForTimeout(1500);}
  for (let n=0;n<2;n++){ const upBtn=pane.getByRole('button').filter({hasText:/上\s*传/}).first(); await Promise.all([page.waitForEvent('filechooser',{timeout:20000}).then(fc=>fc.setFiles(FILE)), upBtn.click()]); await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{}); await page.waitForTimeout(2500); }
  const res = await page.evaluate(()=>{
    const info=(sel)=>[...document.querySelectorAll(sel)].map(e=>{const b=e.getBoundingClientRect();return {vis:b.width>0&&b.height>0,w:Math.round(b.width),h:Math.round(b.height),cls:e.className,html:(e.outerHTML||'').slice(0,90)};});
    return {
      hcb_label: info(".el-tab-pane .el-table__header-wrapper label.el-checkbox"),
      hcb_inner: info(".el-tab-pane .el-table__header-wrapper .el-checkbox__inner"),
      bcb_label: info(".el-tab-pane .el-table__body-wrapper label.el-checkbox"),
      bcb_inner: info(".el-tab-pane .el-table__body-wrapper .el-checkbox__inner")
    };
  });
  const show=(k,v)=>console.log(k+' = '+JSON.stringify(v.map(x=>({vis:x.vis,w:x.w,h:x.h,cls:x.cls}))));
  show('HCB_LABEL',res.hcb_label); show('HCB_INNER',res.hcb_inner); show('BCB_LABEL',res.bcb_label); show('BCB_INNER',res.bcb_inner);
  if(res.hcb_inner[0]) console.log('HCB_INNER_HTML='+res.hcb_inner[0].html);
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,400));process.exit(1);});
