const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const DLG = `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', r=>{ if(r.request().method()==='POST'){ const u=r.url(); if(/tansun-tcp|custCorporatNetwork|networkCheck/i.test(u)) apis.push(u.split('?')[0].split('/').slice(-2).join('/')+' -> '+r.status()); } });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button').filter({hasText:/联网核查信息/}).first().click();
  await page.waitForTimeout(4000);
  const dlg = page.locator(DLG).first();
  const btns = await dlg.evaluate(d => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    return [...d.querySelectorAll('button')].filter(vis).map(b=>({t:txt(b),dis:b.disabled}));
  });
  console.log('DIALOG_BTNS='+JSON.stringify(btns));
  apis.length=0;
  const confirmBtn = dlg.getByRole('button').filter({hasText:/确\s*认/}).first();
  if (await confirmBtn.count()) {
    console.log('CONFIRM_DISABLED='+await confirmBtn.isDisabled().catch(()=>null));
    await confirmBtn.click({timeout:8000}).catch(e=>console.log('confirm err '+(e.message||'').slice(0,80)));
    await page.waitForTimeout(3000);
    console.log('APIS='+JSON.stringify(apis));
    const after = await page.evaluate(() => {
      const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
      const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const stillOpen = !![...document.querySelectorAll("div[role='dialog']")].filter(vis).find(d=>d.querySelector("button")&&[...d.querySelectorAll('button')].some(b=>txt(b)==='发起实时核查'));
      const msg = [...document.querySelectorAll('.el-message, .el-notification, .el-message-box')].filter(vis).map(m=>txt(m)).filter(Boolean);
      return { stillOpen, msg };
    });
    console.log('AFTER='+JSON.stringify(after));
  } else console.log('NO_CONFIRM_BTN');
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
