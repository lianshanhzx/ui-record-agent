import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S27 同业客户-影像资料批量下载（上传 2 文件→header 全选 checkbox→【批量操作】→download×2→前端合成 zip blob 下载 → 断言 zip 落盘 → 清理）
// 探路：表格含 header 全选 + 行 checkbox（原生 input 隐藏，可见=label.el-checkbox/.el-checkbox__inner）；【批量操作】=批量下载（未选 toast「请选择要下载的数据」）；批量操作→后端 download/文件→前端 zip(blob,时间戳名)
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's27-values.json');
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const UPLOAD_API = (r: any) => r.url().includes('filesFileManage/upload') && r.request().method() === 'POST';
const DEL_API = (r: any) => r.url().includes('deleteFileInf') && r.request().method() === 'POST';
const ROWS = '.el-tab-pane .el-table__body-wrapper .el-table__body tbody tr';
const X_HCB = "//div[contains(@class,'el-tab-pane')]//div[contains(@class,'el-table__header-wrapper')]//label[contains(@class,'el-checkbox')]";
const X_BATCH = "//button[normalize-space()='批量操作']";
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const normBox = (b: any) => (b ? { x1: +(b.x / 1440).toFixed(4), y1: +(b.y / 900).toFixed(4), x2: +((b.x + b.width) / 1440).toFixed(4), y2: +((b.y + b.height) / 900).toFixed(4) } : null);

test('S27 同业客户-影像资料批量下载（全选→批量操作→zip）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

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

  // 前置清理 客户管理
  await pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first().locator('.el-tree-node__content').first().click();
  await page.waitForTimeout(2000);
  for (let i = 0; i < 6 && (await rowCount()) > 0; i++) { if (!(await delFirst())) break; }
  expect(await rowCount()).toBe(0);

  // 上传 2 个文件
  for (let n = 0; n < 2; n++) {
    const upBtn = pane.getByRole('button').filter({ hasText: /上\s*传/ }).first();
    const upP = page.waitForResponse(UPLOAD_API, { timeout: 60_000 });
    await Promise.all([page.waitForEvent('filechooser', { timeout: 20_000 }).then((fc: any) => fc.setFiles(FILE_PATH)), upBtn.click()]);
    await upP;
    await page.waitForTimeout(2500);
  }
  expect(await rowCount()).toBe(2);

  // header 全选 checkbox
  const hcb = page.locator('xpath=' + X_HCB).first();
  V.hcbRect = normBox(await hcb.boundingBox());
  await hcb.click({ timeout: 8_000 });
  await page.waitForTimeout(1000);
  const checked = await page.evaluate(() => [...document.querySelectorAll('.el-tab-pane .el-table__body-wrapper input[type=checkbox]')].map((c: any) => c.checked));
  expect(checked).toEqual([true, true]);

  // 批量操作 → 捕获 zip 下载
  const batch = page.locator('xpath=' + X_BATCH).first();
  V.batchRect = normBox(await batch.boundingBox());
  const dlP = page.waitForEvent('download', { timeout: 20_000 });
  await batch.click({ timeout: 8_000 });
  const dl = await dlP;
  expect(dl.suggestedFilename()).toMatch(/\.zip$/i);
  const zipPath = path.join(DIR, 's27-probe.zip');
  await dl.saveAs(zipPath);
  const size = fs.statSync(zipPath).size;
  expect(size).toBeGreaterThan(0);
  console.log('S27_ZIP ' + dl.suggestedFilename() + ' size=' + size);

  // 清理 2 文件
  for (let i = 0; i < 6 && (await rowCount()) > 0; i++) { if (!(await delFirst())) break; }
  expect(await rowCount()).toBe(0);

  V.steps = '清理→上传×2→全选(2行)→批量操作(zip 落盘)→清理×2';
  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2));
  console.log('S27_VALUES ' + VALUES_FILE);
});
