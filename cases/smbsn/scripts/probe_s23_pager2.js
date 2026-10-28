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
    const P = el => { const r=el.getBoundingClientRect(); return {x1:+(r.x/1440).toFixed(4),y1:+(r.y/900).toFixed(4),x2:+((r.x+r.width)/1440).toFixed(4),y2:+((r.y+r.height)/900).toFixed(4)}; };
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const pag = document.querySelector('.el-pagination');
    // 所有 button/li 在分页内
    const items = [...pag.querySelectorAll('button, li, .el-select, .el-input')].map(el=>({ tag:el.tagName, cls:(el.className||'').toString().slice(0,45), t:txt(el).slice(0,20), rect:P(el) }));
    // total 文本
    const allText = txt(pag);
    return { allText, items };
  });
  console.log('PAGER_TEXT='+info.allText);
  console.log(JSON.stringify(info.items,null,1));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
