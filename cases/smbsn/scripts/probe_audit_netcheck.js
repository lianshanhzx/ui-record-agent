const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', r=>{ if(r.request().method()==='POST'){ const u=r.url(); if(/tansun-tcp/i.test(u)) apis.push(u.split('/').pop()+' -> '+r.status()); } });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click();
  await page.waitForTimeout(600);
  // 开联网核查 dialog
  await page.getByRole('button').filter({hasText:/联网核查信息/}).first().click();
  await page.waitForTimeout(4000);
  const state = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).find(d=>/联网核查/.test(txt(d)));
    if (!dlg) return { no:true };
    const btns = [...dlg.querySelectorAll('button')].filter(vis).map(b=>({t:txt(b),dis:b.disabled}));
    return { title:txt(dlg.querySelector('.el-dialog__title')||dlg), btns };
  });
  console.log('DIALOG='+JSON.stringify(state));
  apis.length=0;
  // 点【确认】
  const confirmBtn = page.locator('.el-dialog').filter({hasText:/联网核查/}).getByRole('button').filter({hasText:/确\s*认/}).last();
  if (await confirmBtn.count()) {
    const disabled = await confirmBtn.isDisabled().catch(()=>null);
    console.log('CONFIRM_DISABLED='+disabled);
    await confirmBtn.click({timeout:8000}).catch(e=>console.log('confirm err '+(e.message||'').slice(0,90)));
    await page.waitForTimeout(3000);
    console.log('APIS_AFTER_CONFIRM='+JSON.stringify(apis));
    const after = await page.evaluate(() => {
      const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const stillOpen = [...document.querySelectorAll('.el-dialog')].filter(vis).some(d=>/联网核查/.test(txt(d)));
      const msg = [...document.querySelectorAll('.el-message, .el-notification')].filter(vis).map(m=>txt(m)).filter(Boolean);
      return { stillOpen, msg };
    });
    console.log('AFTER='+JSON.stringify(after));
  } else console.log('CONFIRM_NONE');
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
