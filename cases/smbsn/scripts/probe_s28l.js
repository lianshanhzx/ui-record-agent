const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const CUST='260930092649839164';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill(CUST);
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForResponse(r=>r.url().includes('findCustTradeList')&&r.request().method()==='POST',{timeout:30000});
  await page.waitForTimeout(2000);
  // 工具栏按钮
  const toolbar = await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return b.textContent.trim()&&r.width>0&&r.y<300;}).map(b=>b.textContent.trim()));
  console.log('TOOLBAR='+JSON.stringify([...new Set(toolbar)]));
  // hover 首行 → 行操作
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.evaluate(r=>{r.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));r.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));});
  await page.waitForTimeout(1000);
  const rowActs = await page.evaluate(()=>[...document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr:first-child button, .el-table__body-wrapper .el-table__body tbody tr:first-child .el-button, .el-table__fixed button')].map(b=>b.textContent.trim()).filter(Boolean));
  console.log('ROW_ACTIONS='+JSON.stringify([...new Set(rowActs)]));
  // 全页所有含「保存/提交/正式/生效/审核」的按钮
  const kw = await page.evaluate(()=>[...document.querySelectorAll('button,a,[role=button]')].filter(b=>/保存|提交|正式|生效|审核|放款/.test(b.textContent||'')&&(b.textContent||'').trim()).map(b=>b.textContent.trim()).filter(t=>t.length<8));
  console.log('KW_BTNS='+JSON.stringify([...new Set(kw)]));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
