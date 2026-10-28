const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const out = [];
    for (const b of document.querySelectorAll('button')) {
      const t = txt(b);
      if (!t) continue;
      if (!['身份识别','确 定','取 消'].includes(t)) continue;
      const r = b.getBoundingClientRect();
      const vis = r.width>0 && r.height>0 && r.top>=0 && r.left>=0 && r.top < innerHeight && r.left < innerWidth;
      // 祖先链找容器线索
      let anc = b, chain=[];
      for (let i=0;i<6 && anc;i++){ anc=anc.parentElement; if(anc) chain.push((anc.className||'').toString().slice(0,40)+(anc.id?('#'+anc.id):'')); }
      out.push({ t, vis, x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), dis:b.disabled, chain:chain.join(' < ') });
    }
    return out;
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
