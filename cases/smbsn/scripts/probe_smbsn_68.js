// probe68: 影像资料上传全链路（filechooser setFiles → 观察自动上传/确认/列表回显/API）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const FILE = path.join(__dirname, 'AT_test_image_upload.png');
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
    if (!/file|upload|ctlg|aahr/i.test(u)) return;
    let resp = ''; try { resp = (await r.text()).slice(0, 250); } catch {}
    let body = ''; try { body = (r.request().postData() || '').slice(0, 200); } catch {}
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
  await page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first().click();
  await sleep(6000);
  const pane = page.locator('.el-tab-pane:visible').last();
  // 选中一级目录「客户管理」
  const node = pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first();
  await node.locator('.el-tree-node__content').first().click();
  await sleep(3000);
  // 点上传 → filechooser 选文件
  await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15000 }).then((fc) => {
      console.log('P68_FILECHOOSER triggered');
      return fc.setFiles(FILE);
    }),
    pane.getByRole('button').filter({ hasText: /上\s*传/ }).first().click(),
  ]);
  await sleep(8000);
  // 上传后状态：弹窗/对话框/文件列表/toast
  const state = await page.evaluate(() => {
    const out = { toasts: [], dialogs: [], rows: [] };
    out.toasts = Array.from(document.querySelectorAll('.el-message, .el-message-box')).map((m) => m.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean);
    const ds = Array.from(document.querySelectorAll('.el-dialog, .el-drawer, .el-popover')).filter((d) => d.offsetParent !== null);
    out.dialogs = ds.map((d) => ({ cls: (d.className || '').toString().slice(0, 50), text: d.innerText.trim().replace(/\s+/g, ' ').slice(0, 300) }));
    out.rows = Array.from(document.querySelectorAll('.el-tab-pane .el-table__body-wrapper tbody tr')).map((r) => r.innerText.trim().replace(/\s+/g, ' ')).filter(Boolean);
    return out;
  });
  console.log('P68_STATE=', JSON.stringify(state, null, 1));
  console.log('P68_APIS=', JSON.stringify(apis.slice(-6), null, 1));
  await page.screenshot({ path: path.join(__dirname, 'p68_after_upload.png') });
  await browser.close();
})().catch((e) => { console.error('P68_ERROR', e.message); process.exit(1); });
