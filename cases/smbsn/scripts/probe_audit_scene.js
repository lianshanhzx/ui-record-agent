const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
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
  await page.waitForTimeout(600);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  console.log('SCENE_URL='+page.url().slice(0,120));
  const dump = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    // 页面级按钮（顶部工具条：引入/保存/暂存/返回）
    const pageBtns = [...document.querySelectorAll('button')].filter(vis).map(b=>({t:txt(b),dis:b.disabled})).filter(x=>x.t);
    // tabs
    const tabs = [...document.querySelectorAll('.el-tabs__item, [role=tab]')].filter(vis).map(t=>txt(t)).filter(Boolean);
    return { pageBtns, tabs };
  });
  console.log('PAGE_BTNS='+JSON.stringify(dump.pageBtns));
  console.log('TABS='+JSON.stringify(dump.tabs));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
