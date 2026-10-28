import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S25 同业客户-影像资料图册查看（上传造文件→工具栏【图册查看】→全屏「档案书册」dialog → 关闭 → 清理）
// 探路：图册查看=toolbar span；点击开全屏 el-dialog(1440x725) 标题「档案书册」；关闭=.el-dialog__headerbtn
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's25-values.json');
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const UPLOAD_API = (r: any) => r.url().includes('filesFileManage/upload') && r.request().method() === 'POST';
const DEL_API = (r: any) => r.url().includes('deleteFileInf') && r.request().method() === 'POST';
const ROWS = '.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const normBox = (b: any) => (b ? { x1: +(b.x / 1440).toFixed(4), y1: +(b.y / 900).toFixed(4), x2: +((b.x + b.width) / 1440).toFixed(4), y2: +((b.y + b.height) / 900).toFixed(4) } : null);

test('S25 同业客户-影像资料图册查看（图册查看→档案书册dialog→关闭）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  // 列表→选行→修改→影像资料tab→客户管理
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
  await pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2500);

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
  for (let i = 0; i < 5 && (await rowCount()) > 0; i++) { if (!(await delFirst())) break; }
  expect(await rowCount()).toBe(0);

  // 上传造文件
  const upBtn = pane.getByRole('button').filter({ hasText: /上\s*传/ }).first();
  const upP = page.waitForResponse(UPLOAD_API, { timeout: 60_000 });
  await Promise.all([page.waitForEvent('filechooser', { timeout: 15_000 }).then((fc: any) => fc.setFiles(FILE_PATH)), upBtn.click()]);
  await upP;
  await page.waitForTimeout(3000);
  expect(await rowCount()).toBe(1);

  // 点【图册查看】→ 断言全屏「档案书册」dialog
  const album = pane.locator('button, span').filter({ hasText: /^\s*图册查看\s*$/ }).first();
  V.albumRect = normBox(await album.boundingBox());
  await album.click({ timeout: 8_000 });
  await page.waitForTimeout(2500);
  const dlg = page.locator('.el-dialog:visible').filter({ has: page.locator('.el-dialog__title', { hasText: '档案书册' }) }).first();
  expect(await dlg.count()).toBe(1);
  await expect(dlg).toBeVisible();
  V.albumTitle = (await dlg.locator('.el-dialog__title').innerText()).trim();
  expect(V.albumTitle).toBe('档案书册');
  const dlgBox = await dlg.boundingBox();
  V.albumDialog = { w: +((dlgBox?.width || 0) / 1440).toFixed(3), h: +((dlgBox?.height || 0) / 900).toFixed(3) };
  console.log('S25_ALBUM title=' + V.albumTitle + ' dialog=' + JSON.stringify(V.albumDialog));

  // 关闭 dialog
  const closeBtn = dlg.locator('.el-dialog__headerbtn').first();
  V.closeRect = normBox(await closeBtn.boundingBox());
  await closeBtn.click({ timeout: 8_000 });
  await page.waitForTimeout(1500);
  expect(await page.locator('.el-dialog:visible').filter({ has: page.locator('.el-dialog__title', { hasText: '档案书册' }) }).count()).toBe(0);
  console.log('S25_CLOSED 档案书册 dialog 已关闭');

  // 清理
  for (let i = 0; i < 3 && (await rowCount()) > 0; i++) { if (!(await delFirst())) break; }
  expect(await rowCount()).toBe(0);

  V.steps = '清理→上传→图册查看(断言档案书册dialog)→关闭→清理';
  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2));
  console.log('S25_VALUES ' + VALUES_FILE);
});
