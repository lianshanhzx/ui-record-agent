import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S12 同业客户-影像资料上传（列表查询→修改→影像资料tab→目录树选「客户管理」→上传(filechooser 系统文件框, 选完即自动上传)→断言文件列表+1→返回重进验证持久化）
// probe68：上传=filesFileManage/upload(multipart) 200 返回 fileNo；自动回查 filesFileManage/pageFileInf total+1；行列：文件名/类型/上传人/上传时间
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's12-values.json');
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const FILE_NAME = path.basename(FILE_PATH);
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const PAGE_FILE_API = (r: any) => r.url().includes('filesFileManage/pageFileInf') && r.request().method() === 'POST';
const UPLOAD_API = (r: any) => r.url().includes('filesFileManage/upload') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

test('S12 同业客户-影像资料上传（选目录→filechooser 上传→列表+1→返回重进验证）', async ({ page }) => {
  test.setTimeout(300_000);
  expect(fs.existsSync(FILE_PATH), '测试文件存在').toBeTruthy();
  const V: Record<string, any> = { custNo: CUST_NO, filePath: FILE_PATH, fileName: FILE_NAME };

  // 列表查询→选行→修改→影像资料tab→选目录「客户管理」→返回 {pane, total}
  const enterScene = async () => {
    const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const j = JSON.parse(await (await qP).text());
    expect(j.data.total).toBe(1);
    await page.waitForTimeout(1500);
    const row = page.locator(ROWS).first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await page.waitForTimeout(4000);
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /影像资料/ }).first();
    if (!V.imgTabRect) V.imgTabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(6000);
    const pane = page.locator('.el-tab-pane:visible').last();
    const node = pane.locator('.el-tree [role="treeitem"]').filter({ hasText: '客户管理' }).first();
    if (!V.treeNodeRect) V.treeNodeRect = await node.locator('.el-tree-node__content').first().evaluate(rectEval);
    const pfP = page.waitForResponse(PAGE_FILE_API, { timeout: 30_000 });
    await node.locator('.el-tree-node__content').first().click();
    const pfJ = JSON.parse(await (await pfP).text());
    await page.waitForTimeout(1500);
    return { pane, total: pfJ.data.total };
  };

  await test.step('1 列表页：客户编号搜索→查询 total=1', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ROWS, { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const noInput = formItem(page, '客户编号').locator('input').first();
    V.listNoRect = await noInput.evaluate(rectEval);
  });

  await test.step('2 选行→修改→影像资料tab→选目录「客户管理」→读上传前行数', async () => {
    const { total } = await enterScene();
    V.preTotal = total;
    console.log('S12_PRE_TOTAL=' + total);
  });

  await test.step('3 点【上传】→ filechooser 选测试文件 → 断言 upload 200 + 列表 +1 + 行含文件名', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const upBtn = pane.getByRole('button').filter({ hasText: /上\s*传/ }).first();
    await expect(upBtn).toBeEnabled({ timeout: 10_000 });
    V.uploadBtnRect = await upBtn.evaluate(rectEval);
    const upRespP = page.waitForResponse(UPLOAD_API, { timeout: 60_000 });
    const pfP = page.waitForResponse(PAGE_FILE_API, { timeout: 60_000 });
    await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15_000 }).then((fc) => fc.setFiles(FILE_PATH)),
      upBtn.click(),
    ]);
    const upResp = await upRespP;
    expect(upResp.status(), 'upload 200').toBe(200);
    const upJ = await upResp.json().catch(() => null);
    V.fileNo = upJ?.data?.fileNo || '';
    console.log('S12_UPLOAD_RESP=' + JSON.stringify(upJ).slice(0, 200));
    const pfJ = JSON.parse(await (await pfP).text());
    V.postTotal = pfJ.data.total;
    expect(pfJ.data.total, '列表 +1').toBe(V.preTotal + 1);
    const rows = pane.locator(ROWS);
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const rowTexts: string[] = [];
    for (let i = 0; i < await rows.count(); i++) rowTexts.push((await rows.nth(i).innerText()).replace(/\s+/g, ' '));
    console.log('S12_ROWS=' + JSON.stringify(rowTexts));
    expect(rowTexts.some((t) => t.includes(FILE_NAME)), '文件列表出现 ' + FILE_NAME).toBeTruthy();
  });

  await test.step('4 返回→重进场景→影像资料tab→「客户管理」→断言文件仍在（持久化）', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const { pane, total } = await enterScene();
    expect(total, '重进后 total 仍含该文件').toBe(V.postTotal);
    const rows = pane.locator(ROWS);
    const rowTexts: string[] = [];
    for (let i = 0; i < await rows.count(); i++) rowTexts.push((await rows.nth(i).innerText()).replace(/\s+/g, ' '));
    console.log('S12_REENTER_ROWS=' + JSON.stringify(rowTexts));
    expect(rowTexts.some((t) => t.includes(FILE_NAME)), '重进后文件仍存在').toBeTruthy();
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S12_VALUES_SAVED pre=' + V.preTotal + ' post=' + V.postTotal + ' fileNo=' + V.fileNo);
});
