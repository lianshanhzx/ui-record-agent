const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900}, acceptDownloads:true });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(4000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const node = pane.locator('.el-tree [role="treeitem"]').filter({hasText:'客户管理'}).first();
  await node.locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);

  // 上传文件
  const upBtn = pane.getByRole('button').filter({hasText:/上\s*传/}).first();
  await Promise.all([
    page.waitForEvent('filechooser',{timeout:15000}).then(fc=>fc.setFiles(FILE)),
    upBtn.click(),
  ]);
  await page.waitForResponse(r=>r.url().includes('filesFileManage/upload')&&r.request().method()==='POST',{timeout:60000}).catch(()=>{});
  await page.waitForTimeout(3000);
  const rowActions = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const cont = document.querySelector('.file-catalog-container') || document;
    // 文件行内的操作按钮/span
    const rowBtns = [...cont.querySelectorAll('tbody button, tbody span, tbody a')].filter(vis).map(s=>txt(s)).filter(Boolean);
    const uniq = [...new Set(rowBtns)];
    const rowCount = document.querySelectorAll('.file-catalog-container .el-table__body-wrapper .el-table__body tbody tr, .el-tab-pane .el-table__body-wrapper .el-table__body tbody tr').length;
    return { rowCount, uniq };
  });
  console.log('ROW_COUNT='+rowActions.rowCount);
  console.log('ROW_ACTIONS='+JSON.stringify(rowActions.uniq));

  // 探「移动」：点行内 移动，dump dialog，然后取消
  const moveEl = page.locator('.el-tab-pane:visible').getByText('移动',{exact:true}).first();
  if (await moveEl.count()) {
    await moveEl.click().catch(e=>console.log('move click err '+(e.message||'').slice(0,80)));
    await page.waitForTimeout(2000);
    const mv = await page.evaluate(() => {
      const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const dlg = [...document.querySelectorAll('.el-dialog, [role=dialog]')].filter(vis);
      return dlg.map(d=>({ title:txt(d.querySelector('.el-dialog__title,[aria-label]')||d).slice(0,40), body:txt(d).slice(0,120), btns:[...d.querySelectorAll('button')].filter(vis).map(b=>txt(b)).filter(Boolean) }));
    });
    console.log('MOVE_DIALOGS='+JSON.stringify(mv));
    // 取消
    await page.getByRole('button').filter({hasText:/取\s*消/}).last().click().catch(()=>{});
    await page.waitForTimeout(1200);
  } else console.log('MOVE_NOT_FOUND');

  // 探「图册查看」：点工具栏 图册查看，dump 全屏 dialog，关闭
  const albumBtn = pane.getByRole('button').filter({hasText:/图册查看/}).first();
  if (await albumBtn.count()) {
    await albumBtn.click().catch(e=>console.log('album click err '+(e.message||'').slice(0,80)));
    await page.waitForTimeout(3000);
    const alb = await page.evaluate(() => {
      const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const dlg = [...document.querySelectorAll('.el-dialog, [role=dialog], .el-drawer, [class*="fullscreen"]')].filter(vis);
      return dlg.map(d=>({ cls:(d.className||'').toString().slice(0,50), title:txt(d.querySelector('.el-dialog__title,[aria-label],h1,h2,h3')||d).slice(0,40), bodyLen:txt(d).length, btns:[...d.querySelectorAll('button')].filter(vis).map(b=>txt(b)).filter(Boolean).slice(0,15) }));
    });
    console.log('ALBUM_DIALOGS='+JSON.stringify(alb));
    await page.keyboard.press('Escape').catch(()=>{});
    await page.getByRole('button').filter({hasText:/关闭|取\s*消/}).last().click().catch(()=>{});
    await page.waitForTimeout(1500);
  } else console.log('ALBUM_NOT_FOUND');

  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
