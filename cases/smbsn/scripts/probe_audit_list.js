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

  const dump = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    // 工具栏按钮（表格上方/查询区外）
    const allBtns = [...document.querySelectorAll('button')].map(b=>({t:txt(b), dis:b.disabled})).filter(x=>x.t);
    // 表格列头
    const headers = [...document.querySelectorAll('.el-table__header-wrapper th')].map(h=>txt(h)).filter(Boolean);
    // 是否 checkbox 列 / radio 列
    const hasCheckbox = !!document.querySelector('.el-table__body-wrapper input[type=checkbox], .el-table__header-wrapper input[type=checkbox]');
    const hasRadio = !!document.querySelector('.el-table__body-wrapper input[type=radio]');
    // 分页
    const pager = document.querySelector('.el-pagination, [class*="pagination"]');
    const pagerTxt = pager ? txt(pager) : null;
    const pagerItems = pager ? [...pager.querySelectorAll('li,button')].map(x=>txt(x)).filter(Boolean) : [];
    // 总行数
    const rowCount = document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr').length;
    // 可排序列
    const sortable = [...document.querySelectorAll('.el-table__header-wrapper th .caret-wrapper, .el-table__header-wrapper th.sortable')].length;
    return { allBtns, headers, hasCheckbox, hasRadio, pagerTxt, pagerItems, rowCount, sortable };
  });
  console.log('BTN_COUNT='+dump.allBtns.length);
  console.log('BTNS='+JSON.stringify(dump.allBtns));
  console.log('HEADERS='+JSON.stringify(dump.headers));
  console.log('CHECKBOX='+dump.hasCheckbox+' RADIO='+dump.hasRadio+' ROWS='+dump.rowCount+' SORTABLE='+dump.sortable);
  console.log('PAGER='+dump.pagerTxt+' ITEMS='+JSON.stringify(dump.pagerItems));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
