const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260924144929974126';
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
  const res = await page.evaluate(()=>{
    const q=(xp)=>{const r=document.evaluate(xp,document,null,XPathResult.ORDERED_NODE_SNAPSHOT_TYPE);const out=[];for(let i=0;i<r.snapshotLength;i++){const n=r.snapshotItem(i);const b=n.getBoundingClientRect();out.push({vis:b.width>0&&b.height>0,html:(n.outerHTML||'').slice(0,100)});}return {count:r.snapshotLength,items:out};};
    return {
      batch_norm: q("//button[normalize-space()='批量操作']"),
      batch_any: q("//button[contains(normalize-space(.),'批量操作')]"),
      hcb_pane: q("//div[contains(@class,'el-tab-pane')]//div[contains(@class,'el-table__header-wrapper')]//input[@type='checkbox']"),
      hcb_all: q("//input[@type='checkbox']")
    };
  });
  console.log('BATCH_NORM count='+res.batch_norm.count+' vis='+res.batch_norm.items.filter(i=>i.vis).length+' html='+(res.batch_norm.items[0]||{}).html);
  console.log('BATCH_ANY count='+res.batch_any.count+' vis='+res.batch_any.items.filter(i=>i.vis).length);
  console.log('HCB_PANE count='+res.hcb_pane.count+' vis='+res.hcb_pane.items.filter(i=>i.vis).length);
  console.log('HCB_ALL count='+res.hcb_all.count+' vis='+res.hcb_all.items.filter(i=>i.vis).length);
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
