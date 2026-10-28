import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S26 同业客户-影像资料移动（上传造文件→行【移动】→「移动目录」dialog 选「贷后管理」→【确认选择】→moveCtlg 200 → 断言客户管理空+贷后管理有文件 → 清理）
// 探路：移动=行操作 fixed-right span；移动目录 dialog 树=顶级目录平铺；确认选择→moveCtlg API(200 操作成功)；文件从客户管理移至贷后管理
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's26-values.json');
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const FILE_NAME = 'AT_test_image_upload.png';
const CUST_NO = '260924144929974126';
const TARGET_NODE = '贷后管理';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const UPLOAD_API = (r: any) => r.url().includes('filesFileManage/upload') && r.request().method() === 'POST';
const DEL_API = (r: any) => r.url().includes('deleteFileInf') && r.request().method() === 'POST';
const MOVE_API = (r: any) => r.url().includes('moveCtlg') && r.request().method() === 'POST';
const ROWS = '.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const normBox = (b: any) => (b ? { x1: +(b.x / 1440).toFixed(4), y1: +(b.y / 900).toFixed(4), x2: +((b.x + b.width) / 1440).toFixed(4), y2: +((b.y + b.height) / 900).toFixed(4) } : null);

test('S26 同业客户-影像资料移动（移动目录→贷后管理→确认选择）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO, target: TARGET_NODE };

  // 列表→选行→修改→影像资料tab
  await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
  await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  expect(JSON.parse(await (await qP).text()).data.total).toBe(1);
  await page.waitForTimeout(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el: any) => el.click());
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(4000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const rowCount = () => page.locator(ROWS).count();
  const delFirst = async () => {
    const row = page.locator(ROWS).first();
    await row.evaluate((r: any) => { r.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); r.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    await page.waitForTimeout(500);
    const del = pane.locator('span').filter({ hasText: /^\s*删除\s*$/ }).filter({ visible: true }).first();
    if (!(await del.count())) return false;
    const dP = page.waitForResponse(DEL_API, { timeout: 30_000 }).catch(() => null);
    await del.click({ timeout: 8_000 });
    await page.waitForTimeout(1200);
    await page.locator('.el-message-box:visible').locator('button.el-button--primary').click({ timeout: 8_000 });
    if (dP) await dP;
    await page.waitForTimeout(1500);
    return true;
  };
  const cleanNode = async (node: string) => {
    await pane.locator('.el-tree [role="treeitem"]').filter({ hasText: node }).first().locator('.el-tree-node__content').first().click();
    await page.waitForTimeout(2000);
    for (let i = 0; i < 5 && (await rowCount()) > 0; i++) { if (!(await delFirst())) break; }
    expect(await rowCount()).toBe(0);
  };

  // 前置清理 客户管理 + 贷后管理
  await cleanNode('客户管理');
  await cleanNode(TARGET_NODE);

  // 回客户管理 + 上传造文件
  await pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2000);
  const upBtn = pane.getByRole('button').filter({ hasText: /上\s*传/ }).first();
  const upP = page.waitForResponse(UPLOAD_API, { timeout: 60_000 });
  await Promise.all([page.waitForEvent('filechooser', { timeout: 15_000 }).then((fc: any) => fc.setFiles(FILE_PATH)), upBtn.click()]);
  await upP;
  await page.waitForTimeout(3000);
  expect(await rowCount()).toBe(1);

  // 行【移动】→ 移动目录 dialog 选「贷后管理」→ 确认选择
  const move = page.locator("xpath=//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='移动']").filter({ visible: true }).first();
  V.moveRect = normBox(await move.boundingBox());
  await move.click({ timeout: 8_000 });
  await page.waitForTimeout(2500);
  const nodeX = "//div[contains(@class,'el-dialog')][.//span[contains(@class,'el-dialog__title')][normalize-space(.)='移动目录']]//div[contains(@class,'el-tree-node__content')][normalize-space(.)='" + TARGET_NODE + "']";
  const node = page.locator('xpath=' + nodeX).first();
  V.moveNodeRect = normBox(await node.boundingBox());
  await node.click({ timeout: 8_000 });
  await page.waitForTimeout(1000);
  const confirm = page.locator('.el-dialog:visible button').filter({ hasText: /确认选择/ }).first();
  V.confirmRect = normBox(await confirm.boundingBox());
  const mvP = page.waitForResponse(MOVE_API, { timeout: 30_000 });
  await confirm.click({ timeout: 8_000 });
  const mvJ = JSON.parse(await (await mvP).text());
  expect(mvJ.status).toBe(200);
  await page.waitForTimeout(2500);

  // 断言：客户管理空 + 贷后管理有文件
  expect(await rowCount()).toBe(0);
  await pane.locator('.el-tree [role="treeitem"]').filter({ hasText: TARGET_NODE }).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);
  expect(await rowCount()).toBe(1);
  const rowText = (await page.locator(ROWS).first().innerText()).replace(/\s+/g, ' ');
  expect(rowText).toContain(FILE_NAME);
  console.log('S26_MOVED ' + rowText);

  // 清理贷后管理
  for (let i = 0; i < 3 && (await rowCount()) > 0; i++) { if (!(await delFirst())) break; }
  expect(await rowCount()).toBe(0);

  V.steps = '清理×2→上传→移动→选贷后管理→确认选择(moveCtlg 200)→断言客户管理空+贷后管理有文件→清理';
  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2));
  console.log('S26_VALUES ' + VALUES_FILE);
});
