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
  const del = () => pane.locator('span').filter({hasText:/^\s*删除\s*$/}).filter({visible:true}).first();
  for (let i=0;i<3 && (await page.locator('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr').count());i++){
    if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200);
    await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000});
    await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(1500);
  }
  const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FILE)), upBtn.click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  const info = await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll("span").forEach((s,i)=>{
      if (s.textContent.trim()==='下载'){
        const cs=getComputedStyle(s);
        let anc=[], el=s;
        for(let k=0;k<6 && el;k++){ el=el.parentElement; if(el) anc.push(el.className?String(el.className).slice(0,40):''); }
        const r=s.getBoundingClientRect();
        out.push({ vis: cs.visibility!=='hidden' && cs.display!=='none', x:+r.x.toFixed(0), y:+r.y.toFixed(0), w:+r.width.toFixed(0), anc });
      }
    });
    return out;
  });
  console.log('DL_SPANS='+JSON.stringify(info,null,0));
  for (let i=0;i<3 && (await page.locator('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr').count());i++){
    if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200);
    await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000});
    await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(1500);
  }
  console.log('LEFT='+await page.locator('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr').count());
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
