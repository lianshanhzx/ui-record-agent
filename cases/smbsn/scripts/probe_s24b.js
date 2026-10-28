const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const FA = path.join(__dirname,'AT_img_s24a.png'), FB = path.join(__dirname,'AT_img_s24b.png');
[FA,FB].forEach(f=>{ if(!fs.existsSync(f)) fs.copyFileSync(path.join(__dirname,'AT_test_image_upload.png'), f); });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click();
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(4000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-tree [role="treeitem"]').filter({hasText:'客户管理'}).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);
  const upBtn = () => pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FA)), upBtn().click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(2500);
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FB)), upBtn().click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(2500);
  const rows = await page.evaluate(()=>[...document.querySelectorAll('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr')].map(r=>r.innerText.replace(/\s+/g,' ').trim()));
  console.log('ROWS_ORDER='+JSON.stringify(rows));
  // hover 首行 → 下载 span rect + 行内 span
  const first = page.locator('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr').first();
  await first.dispatchEvent('mouseenter');
  await page.waitForTimeout(800);
  const info = await page.evaluate(()=>{
    const P = el => { const r=el.getBoundingClientRect(); return {x1:+(r.x/1440).toFixed(4),y1:+(r.y/900).toFixed(4),x2:+((r.x+r.width)/1440).toFixed(4),y2:+((r.y+r.height)/900).toFixed(4)}; };
    const row = document.querySelector('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr');
    const spans=[...row.querySelectorAll('span')].map(s=>s.innerText.trim()).filter(Boolean);
    const dl=[...row.querySelectorAll('span')].find(s=>s.innerText.trim()==='下载');
    const cb = row.querySelector('input[type=checkbox], .el-checkbox__original');
    return { rowSpans:spans, dlRect: dl?P(dl):null, hasCheckbox: !!cb };
  });
  console.log('ROW0='+JSON.stringify(info));
  // 清理两行
  for (let i=0;i<2;i++){
    const del = pane.locator('span').filter({hasText:/^\s*删除\s*$/}).filter({visible:true}).first();
    if (!(await del.count())) break;
    await del.click({timeout:8000});
    await page.waitForTimeout(1500);
    await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000});
    await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(2000);
  }
  const left = await page.evaluate(()=>document.querySelectorAll('.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr').length);
  console.log('CLEANED_LEFT='+left);
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
