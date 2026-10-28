// probe66: 影像资料tab 深挖：树节点列表 + 右侧文件区结构 + 上传控件 + 按钮
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
    if (r.request().method() !== 'POST' || !/filesCtlg|file/i.test(r.url())) return;
    let resp = ''; try { resp = (await r.text()).slice(0, 300); } catch {}
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
  // 树节点（全部）
  const treeNodes = await pane.locator('.el-tree-node__label, .t-tree-node__label, [role="treeitem"] .el-tree-node__content').allInnerTexts().catch(() => []);
  const treeLabels = await pane.locator('.el-tree').locator('[role="treeitem"]').evaluateAll((els) => els.map((e) => e.innerText.trim().replace(/\s+/g, ' ')));
  console.log('P66_TREE=', JSON.stringify(treeLabels));
  // 展开所有树节点（点 caret）
  const carets = pane.locator('.el-tree-node__expand-icon:not(.is-leaf)');
  const cc = await carets.count();
  for (let i = 0; i < cc; i++) { try { await carets.nth(i).click({ timeout: 2000 }); } catch {} await sleep(300); }
  await sleep(1000);
  const treeAfter = await pane.locator('.el-tree').locator('[role="treeitem"]').evaluateAll((els) => els.map((e) => e.innerText.trim().replace(/\s+/g, ' ')));
  console.log('P66_TREE_EXPANDED=', JSON.stringify(treeAfter));
  // 右侧内容：按钮/表格/上传控件
  const right = await pane.evaluate((p) => {
    const out = { btns: [], inputs: [], tableHeaders: [], files: [] };
    out.btns = Array.from(p.querySelectorAll('button')).map((b) => ({ t: (b.innerText || '').trim(), dis: b.disabled })).filter((b) => b.t);
    out.inputs = Array.from(p.querySelectorAll('input')).map((i) => ({ type: i.type, ph: i.placeholder || '' }));
    out.tableHeaders = Array.from(p.querySelectorAll('.el-table__header-wrapper th .cell')).map((h) => h.innerText.trim());
    return out;
  });
  console.log('P66_RIGHT=', JSON.stringify(right, null, 1));
  // 点第一个叶子节点（目录）看右侧文件列表 + API
  const leaves = pane.locator('.el-tree-node.is-leaf > .el-tree-node__content, .el-tree [role="treeitem"]:has(.is-leaf)');
  const firstLeaf = pane.locator('.el-tree [role="treeitem"]').last();
  await firstLeaf.locator('.el-tree-node__content').first().click().catch(async () => { await firstLeaf.click(); });
  await sleep(3000);
  const filesAfter = await pane.evaluate((p) => {
    const out = { rows: [], btns: [], text: '' };
    out.rows = Array.from(p.querySelectorAll('.el-table__body-wrapper tbody tr')).map((r) => r.innerText.trim().replace(/\s+/g, ' '));
    out.btns = Array.from(p.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
    const main = p.querySelector('.rightContent, .mainContent, [class*="right"]');
    out.text = main ? main.innerText.trim().slice(0, 500) : p.innerText.trim().slice(0, 500);
    return out;
  });
  console.log('P66_AFTER_SELECT=', JSON.stringify(filesAfter, null, 1));
  console.log('P66_APIS=', JSON.stringify(apis, null, 1));
  await page.screenshot({ path: path.join(__dirname, 'p66_image_tab_full.png') });
  await browser.close();
})().catch((e) => { console.error('P66_ERROR', e.message); process.exit(1); });
