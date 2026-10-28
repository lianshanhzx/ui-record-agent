// probe62: S10 关联人信息-查看弹窗结构探路（选行→查看→dump 字段/disabled/按钮 + get API）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apis = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/custCorporatRelatedParty/i.test(r.url())) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 200); } catch {}
    let resp = ''; try { resp = (await r.text()).slice(0, 400); } catch {}
    apis.push({ api: r.url().split('/').filter(Boolean).slice(-1)[0], body, resp });
  });
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const q = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await q; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);
  await page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const rows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
  const rowVals = await rows().first().locator('td .cell').allInnerTexts();
  console.log('P62_ROW0=', JSON.stringify(rowVals.map((s) => s.trim())));
  await rows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /查\s*看/ }).first().click();
  await sleep(3000);
  const dump = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    if (!d) return { err: 'NO_DIALOG' };
    const out = { cls: (d.className || '').toString().slice(0, 60), fields: [], btns: [] };
    for (const f of d.querySelectorAll('.el-form-item')) {
      const lb = ((f.querySelector('label') || {}).innerText || '').trim();
      const inp = f.querySelector('input');
      const ta = f.querySelector('textarea');
      const btns = Array.from(f.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
      out.fields.push({ lb, type: ta ? 'textarea' : inp ? 'input' : '??', val: (inp ? inp.value : (ta ? ta.value : '')).trim().slice(0, 50), dis: inp ? inp.disabled : (ta ? ta.disabled : null), btns });
    }
    out.btns = Array.from(d.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), dis: b.disabled }));
    return out;
  });
  console.log('P62_DLG=', JSON.stringify(dump, null, 1));
  console.log('P62_APIS=', JSON.stringify(apis.filter((a) => a.api === 'get'), null, 1));
  await page.screenshot({ path: path.join(__dirname, 's10_view_dialog.png') });
  await browser.close();
})().catch((e) => { console.error('P62_ERROR', e.message); process.exit(1); });
