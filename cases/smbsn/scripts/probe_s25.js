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
  // 清理
  const del = () => pane.locator('span').filter({hasText:/^\s*删除\s*$/}).filter({visible:true}).first();
  const ROWS = '.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
  for (let i=0;i<3 && (await page.locator(ROWS).count());i++){
    if(!(await del().count()))break; await del().click({timeout:8000}); await page.waitForTimeout(1200);
    await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({timeout:8000});
    await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(1500);
  }
  // 上传
  const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([ page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FILE)), upBtn.click() ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  console.log('ROWS_AFTER_UP='+await page.locator(ROWS).count());
  // 找「图册查看」按钮
  const albumBtnInfo = await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('button, span, a, div').forEach(el=>{
      if (el.textContent.trim()==='图册查看' && el.children.length===0){
        const r=el.getBoundingClientRect();
        out.push({ tag:el.tagName, cls:String(el.className).slice(0,50), x:+r.x.toFixed(0), y:+r.y.toFixed(0), w:+r.width.toFixed(0) });
      }
    });
    return out;
  });
  console.log('ALBUM_BTN='+JSON.stringify(albumBtnInfo));
  // 点「图册查看」
  const album = pane.locator('button, span').filter({ hasText: /^\s*图册查看\s*$/ }).first();
  await album.click({ timeout: 8000 });
  await page.waitForTimeout(3000);
  // 捕获全屏 dialog（档案书册）
  const dlg = await page.evaluate(()=>{
    const out=[];
    document.querySelectorAll('.el-dialog, .el-drawer, [class*=booklet], [class*=album], [class*=catalog-view], [class*=fullscreen]').forEach(d=>{
      const cs=getComputedStyle(d); const r=d.getBoundingClientRect();
      if (cs.display!=='none' && r.width>100){
        out.push({ cls:String(d.className).slice(0,60), w:+r.width.toFixed(0), h:+r.height.toFixed(0), title:(d.querySelector('.el-dialog__title, .el-drawer__title,[class*=title]')||{}).innerText||'' });
      }
    });
    // 关闭按钮
    const closes=[];
    document.querySelectorAll('.el-dialog__headerbtn, button:has(.el-icon-close), [class*=close]').forEach(c=>{
      const cs=getComputedStyle(c); const r=c.getBoundingClientRect();
      if(cs.display!=='none'&&r.width>0) closes.push({ cls:String(c.className).slice(0,40), x:+r.x.toFixed(0), y:+r.y.toFixed(0) });
    });
    return { dialogs: out, closes: closes.slice(0,5) };
  });
  console.log('DIALOG='+JSON.stringify(dlg));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
