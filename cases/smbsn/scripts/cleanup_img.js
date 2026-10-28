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
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(4000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const node = pane.locator('.el-tree [role="treeitem"]').filter({hasText:'客户管理'}).first();
  await node.locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);
  const del = pane.locator('span').filter({hasText:/^\s*删除\s*$/}).filter({visible:true}).first();
  if (await del.count()) {
    await del.click({timeout:8000});
    await page.waitForTimeout(1500);
    const mb = page.locator('.el-message-box:visible');
    await mb.locator('button.el-button--primary').click({timeout:8000});
    await page.waitForResponse(r=>r.url().includes('deleteFileInf')&&r.request().method()==='POST',{timeout:30000}).catch(()=>{});
    await page.waitForTimeout(2000);
    console.log('DELETED');
  } else console.log('NO_DEL_ROW (already clean)');
  // 确认 0 文件
  const t = await page.evaluate(()=>{ const el=[...document.querySelectorAll('.el-tab-pane')].map(p=>p.innerText).join(' '); return /No data|暂无数据/.test(el); });
  console.log('EMPTY_NOW='+t);
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,200));process.exit(1);});
