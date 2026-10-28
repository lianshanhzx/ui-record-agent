const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900}, acceptDownloads:true });
  const page = await ctx.newPage();
  const downloads = [];
  page.on('download', d=>downloads.push(d.suggestedFilename()));
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

  // 行操作 span 列表 + 是否有 checkbox
  const rowInfo = await pane.evaluate(p => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const row = p.querySelector('.el-table__body-wrapper .el-table__body tbody tr');
    if (!row) return { none:true };
    const spans = [...row.querySelectorAll('span')].map(s=>txt(s)).filter(Boolean);
    const hasCb = !!row.querySelector('input[type=checkbox]');
    const hasRadio = !!row.querySelector('input[type=radio]');
    return { spans, hasCb, hasRadio };
  });
  console.log('ROW_INFO='+JSON.stringify(rowInfo));

  // 点「移动」
  const mv = pane.locator('span').filter({hasText:/^\s*移动\s*$/}).filter({visible:true}).first();
  if (await mv.count()) {
    await mv.click({timeout:10000}).catch(e=>console.log('mv err '+(e.message||'').slice(0,100)));
    await page.waitForTimeout(2500);
    const mvDlg = await page.evaluate(() => {
      const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const dlg = [...document.querySelectorAll('.el-dialog:visible, [role=dialog]:visible, .el-message-box:visible')];
      return dlg.map(d=>({ cls:(d.className||'').toString().slice(0,40), title:txt(d.querySelector('.el-dialog__title')||d).slice(0,50), btns:[...d.querySelectorAll('button')].filter(vis).map(b=>txt(b)).filter(Boolean) }));
    });
    console.log('MOVE_DLG='+JSON.stringify(mvDlg));
    // 若有目录树/选择，dump 后取消
    const mvTree = await page.evaluate(() => {
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const trees = [...document.querySelectorAll('.el-dialog .el-tree, [role=dialog] .el-tree')].filter(vis);
      return trees.map(t=>[...t.querySelectorAll('.el-tree-node__content')].map(n=>(n.innerText||'').trim()).filter(Boolean));
    });
    console.log('MOVE_TREE='+JSON.stringify(mvTree));
    await page.getByRole('button').filter({hasText:/取\s*消/}).last().click().catch(()=>{});
    await page.waitForTimeout(1500);
  } else console.log('MOVE_SPAN_NONE');

  // 选行 checkbox（若有）→ 点「装订成册」
  const cb = pane.locator('.el-table__body-wrapper tbody tr input[type=checkbox]').first();
  if (await cb.count()) { await cb.check().catch(e=>console.log('cb err '+(e.message||'').slice(0,60))); await page.waitForTimeout(1000); }
  const bind = pane.getByRole('button').filter({hasText:/装订成册/}).first();
  if (await bind.count()) {
    await bind.click({timeout:8000}).catch(e=>console.log('bind err '+(e.message||'').slice(0,100)));
    await page.waitForTimeout(2500);
    const bindMsg = await page.evaluate(() => {
      const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const msg = [...document.querySelectorAll('.el-message:visible, .el-message-box:visible, .el-notification:visible')].map(m=>txt(m)).filter(Boolean);
      const dlg = [...document.querySelectorAll('.el-dialog:visible')].map(d=>txt(d.querySelector('.el-dialog__title')||d).slice(0,40));
      return { msg, dlg };
    });
    console.log('BIND_RESULT='+JSON.stringify(bindMsg));
    await page.getByRole('button').filter({hasText:/取\s*消|关\s*闭/}).last().click().catch(()=>{});
    await page.waitForTimeout(1200);
  } else console.log('BIND_NONE');

  // 点「下载」→ 观察 download 事件
  const dl = pane.locator('span').filter({hasText:/^\s*下载\s*$/}).filter({visible:true}).first();
  if (await dl.count()) {
    const dlP = page.waitForEvent('download',{timeout:15000}).catch(()=>null);
    await dl.click({timeout:8000}).catch(e=>console.log('dl err '+(e.message||'').slice(0,80)));
    const d = await dlP;
    console.log('DOWNLOAD='+(d?('file='+d.suggestedFilename()):'NO_EVENT'));
  } else console.log('DL_NONE');
  console.log('ALL_DOWNLOADS='+JSON.stringify(downloads));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
