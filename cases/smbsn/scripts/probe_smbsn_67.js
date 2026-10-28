// probe67: 影像资料【上传】交互方式 + 【批量操作】菜单 + 空列表下各按钮 disabled 状态
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
  let filechooser = null;
  page.on('filechooser', (fc) => { filechooser = { triggered: true }; });
  const apis = [];
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/filesCtlg|file|upload/i.test(r.url())) return;
    let resp = ''; try { resp = (await r.text()).slice(0, 200); } catch {}
    let body = ''; try { body = (r.request().postData() || '').slice(0, 200); } catch {}
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
  await page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first().click();
  await sleep(6000);
  const pane = page.locator('.el-tab-pane:visible').last();
  // 选中叶子目录「营业执照」
  const node = pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first();
  await node.locator('.el-tree-node__content').first().click();
  await sleep(3000);
  // 按钮 disabled 状态（空文件列表）
  const btnStates = await pane.evaluate((p) => Array.from(p.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), dis: b.disabled })).filter((b) => b.t));
  console.log('P67_BTN_STATES=', JSON.stringify(btnStates));
  // 点【上传】
  filechooser = null;
  await pane.getByRole('button').filter({ hasText: /上\s*传/ }).first().click();
  await sleep(3000);
  console.log('P67_FILECHOOSER=', JSON.stringify(filechooser));
  const dlg = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog, .el-drawer, .el-popover')).filter((d) => d.offsetParent !== null);
    const d = ds[ds.length - 1];
    if (!d) return null;
    return { cls: (d.className || '').toString().slice(0, 60), text: d.innerText.trim().slice(0, 400), btns: Array.from(d.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), dis: b.disabled })).filter((b) => b.t) };
  });
  console.log('P67_UPLOAD_DLG=', JSON.stringify(dlg, null, 1));
  // 隐藏 input[type=file]？
  const fileInputs = await pane.locator('input[type="file"]').count();
  console.log('P67_FILE_INPUTS=', fileInputs);
  // 点【批量操作】看菜单
  const batch = pane.getByRole('button').filter({ hasText: /批量操作/ }).first();
  if (await batch.count() > 0) {
    await batch.click().catch(() => {});
    await sleep(1500);
    const menu = await page.evaluate(() => {
      const ms = Array.from(document.querySelectorAll('.el-dropdown-menu, .el-dropdown__popper, .el-menu')).filter((m) => m.offsetParent !== null);
      return ms.map((m) => Array.from(m.querySelectorAll('.el-dropdown-menu__item, li, .el-menu-item')).map((i) => i.innerText.trim()).filter(Boolean));
    });
    console.log('P67_BATCH_MENU=', JSON.stringify(menu));
    await page.keyboard.press('Escape');
  }
  console.log('P67_APIS=', JSON.stringify(apis.slice(-4), null, 1));
  await page.screenshot({ path: path.join(__dirname, 'p67_upload_click.png') });
  await browser.close();
})().catch((e) => { console.error('P67_ERROR', e.message); process.exit(1); });
