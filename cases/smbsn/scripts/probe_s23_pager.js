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
    if (!pag) return { noPager:true };
    const sizes = pag.querySelector('.el-pagination__sizes');
    const sizesSel = sizes ? sizes.querySelector('.el-select, .el-input') : null;
    const pager = pag.querySelector('.el-pagination__pager');
    const pagers = pager ? [...pager.querySelectorAll('li')].map(li=>({t:txt(li),cls:li.className,rect:P(li)})) : [];
    const prev = pag.querySelector('.btn-prev');
    const next = pag.querySelector('.btn-next');
    const jump = pag.querySelector('.el-pagination__jump');
    const jumpInput = jump ? jump.querySelector('input') : null;
    const total = pag.querySelector('.el-pagination__total');
    return {
      sizesText: sizes?txt(sizes):null,
      sizesSelRect: sizesSel?P(sizesSel):null,
      pagers, prevRect: prev?P(prev):null, nextRect: next?P(next):null,
      jumpText: jump?txt(jump):null, jumpInputRect: jumpInput?P(jumpInput):null,
      pagerRect: P(pag), totalText: total?txt(total):null
    };
  });
  console.log(JSON.stringify(info,null,1));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
