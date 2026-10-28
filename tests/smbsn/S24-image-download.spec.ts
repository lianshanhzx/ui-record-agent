import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S24 同业客户-影像资料下载（前置清理→上传造文件→断言首行=本次文件→hover 行【下载】→断言 download 事件+文件名 → 清理）
// 探路：影像目录「客户管理」行操作(预览/下载/删除/移动/打印)随 hover 显示；最新上传=首行；下载=浏览器 download 事件（同 S13 预览/S14 删除的全局首 span 模式）
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's24-values.json');
const FILE_NAME = 'AT_test_image_upload.png';
const FILE_PATH = path.join(DIR, FILE_NAME);
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const UPLOAD_API = (r: any) => r.url().includes('filesFileManage/upload') && r.request().method() === 'POST';
const DEL_API = (r: any) => r.url().includes('deleteFileInf') && r.request().method() === 'POST';
const ROWS = '.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

test('S24 同业客户-影像资料下载（上传造文件→行下载→断言 download）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO, fileName: FILE_NAME };
  if (!fs.existsSync(FILE_PATH)) fs.copyFileSync(path.join(DIR, 'AT_test_image_upload.png'), FILE_PATH);

  // 列表查询→选行→修改→影像资料tab→目录「客户管理」
  await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
  await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const j = JSON.parse(await (await qP).text());
  expect(j.data.total).toBe(1);
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

  // 前置清理：删除已有文件（幂等）
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
  for (let i = 0; i < 5 && (await rowCount()) > 0; i++) {
    const ok = await delFirst();
    if (!ok) break;
  }
  expect(await rowCount()).toBe(0);

  // 上传造文件（file:choose）→ 断言首行=本次文件
  const upBtn = pane.getByRole('button').filter({ hasText: /上\s*传/ }).first();
  const upP = page.waitForResponse(UPLOAD_API, { timeout: 60_000 });
  await Promise.all([page.waitForEvent('filechooser', { timeout: 15_000 }).then((fc: any) => fc.setFiles(FILE_PATH)), upBtn.click()]);
  await upP;
  await page.waitForTimeout(3000);
  expect(await rowCount()).toBe(1);
  const firstRowText = (await page.locator(ROWS).first().innerText()).replace(/\s+/g, ' ');
  expect(firstRowText).toContain(FILE_NAME);
  console.log('S24_UPLOADED firstRow=' + firstRowText);

  // hover 首行 → 捕获 download 事件 + 点【下载】
  const firstRow = page.locator(ROWS).first();
  await firstRow.evaluate((r: any) => { r.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); r.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
  await page.waitForTimeout(800);
  const dlSpan = pane.locator('span').filter({ hasText: /^\s*下载\s*$/ }).filter({ visible: true }).first();
  expect(await dlSpan.count()).toBe(1);
  const dlBox = await dlSpan.boundingBox();
  if (dlBox) V.downloadRect = { x1: +(dlBox.x / 1440).toFixed(4), y1: +(dlBox.y / 900).toFixed(4), x2: +((dlBox.x + dlBox.width) / 1440).toFixed(4), y2: +((dlBox.y + dlBox.height) / 900).toFixed(4) };

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    dlSpan.click({ timeout: 10_000 }),
  ]);
  const savedTo = path.join(DIR, 's24-download-' + Date.now() + path.extname(download.suggestedFilename() || '.png'));
  await download.saveAs(savedTo);
  expect(fs.existsSync(savedTo)).toBe(true);
  V.downloadFileName = download.suggestedFilename();
  V.downloadBytes = fs.statSync(savedTo).size;
  console.log('S24_DOWNLOAD file=' + download.suggestedFilename() + ' bytes=' + V.downloadBytes);
  fs.unlinkSync(savedTo);

  // 清理：删除文件
  for (let i = 0; i < 3 && (await rowCount()) > 0; i++) {
    const ok = await delFirst();
    if (!ok) break;
  }
  expect(await rowCount()).toBe(0);

  V.steps = '清理→上传→断言首行→hover→下载(断言download+文件名)→清理';
  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2));
  console.log('S24_VALUES ' + VALUES_FILE);
});
