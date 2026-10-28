// probe64: 影像资料tab 结构探路（工具栏/表格/新增弹窗dump+取消不落数据/API监听）
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
    if (r.request().method() !== 'POST') return;
    const u = r.url();
    if (!/cust|corporate|impact|effect/i.test(u)) return;
    let body = ''; try { body = (r.request().postData() || '').slice(0, 250); } catch {}
    let resp = ''; try { resp = (await r.text()).slice(0, 200); } catch {}
    apis.push({ api: u.split('/').filter(Boolean).slice(-2).join('/'), body, resp });
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
  // 所有 tab 名称
  const tabs = await page.locator('.el-tabs__item').allInnerTexts();
  console.log('P64_TABS=', JSON.stringify(tabs.map(t => t.trim())));
  const impTab = page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first();
  await impTab.click();
  await sleep(3500);
  const pane = page.locator('.el-tab-pane:visible').last();
  // 工具栏按钮
  const btnsBefore = await pane.locator('.el-button').allInnerTexts();
  console.log('P64_BTNS=', JSON.stringify(btnsBefore.map(b => b.trim()).filter(Boolean)));
  // 表格头 + 行
  const headers = await pane.locator('.el-table__header-wrapper th .cell').allInnerTexts();
  console.log('P64_HEADERS=', JSON.stringify(headers.map(h => h.trim())));
  const rows = pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
  const rowCount = await rows.count();
  console.log('P64_ROWS=', rowCount);
  if (rowCount > 0) {
    const cells = await rows.first().locator('td .cell').allInnerTexts();
    console.log('P64_ROW0=', JSON.stringify(cells.map(c => c.trim())));
  }
  // 其他表单区（tab pane 内可能非表格而是 form）
  const fiCount = await pane.locator('.el-form-item').count();
  console.log('P64_PANE_FORMITEMS=', fiCount);
  // 点【新增】（若有）→ dump 弹窗 → 取消
  const addBtn = pane.getByRole('button').filter({ hasText: /新\s*增/ }).first();
  if (await addBtn.count() > 0) {
    await addBtn.click();
    await sleep(3000);
    const dump = await page.evaluate(() => {
      const ds = Array.from(document.querySelectorAll('.el-dialog, .el-drawer')).filter((d) => d.offsetParent !== null);
      const d = ds[ds.length - 1];
      if (!d) return { err: 'NO_DIALOG' };
      const out = { cls: (d.className || '').toString().slice(0, 60), kind: d.classList.contains('el-drawer') ? 'drawer' : 'dialog', fields: [], btns: [] };
      for (const f of d.querySelectorAll('.el-form-item')) {
        const lb = ((f.querySelector('label') || {}).innerText || '').trim();
        const inp = f.querySelector('input');
        const ta = f.querySelector('textarea');
        const sel = f.querySelector('.el-select');
        const btns = Array.from(f.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
        out.fields.push({ lb, type: ta ? 'textarea' : inp ? 'input' : sel ? 'select' : '??', val: (inp ? inp.value : (ta ? ta.value : '')).trim().slice(0, 40), dis: inp ? inp.disabled : (ta ? ta.disabled : null), btns });
      }
      out.btns = Array.from(d.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), dis: b.disabled }));
      return out;
    });
    console.log('P64_ADD_DLG=', JSON.stringify(dump, null, 1));
    // 取消关闭
    const dlg = page.locator('.el-dialog:visible, .el-drawer:visible').last();
    const cancel = dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
    if (await cancel.count() > 0) { await cancel.click(); await sleep(1500); }
  }
  console.log('P64_APIS=', JSON.stringify(apis.slice(-8), null, 1));
  await page.screenshot({ path: path.join(__dirname, 'p64_impact_tab.png') });
  await browser.close();
})().catch((e) => { console.error('P64_ERROR', e.message); process.exit(1); });
