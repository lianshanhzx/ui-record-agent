import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S14 同业客户-影像资料删除（行【删除】→ .el-message-box「是否删除该档案」取消/确定 → filesFileManage/deleteFileInf 200 → 文件数-1 → 返回重进验证已删）
// probe71b：删除确认框=「提示 是否删除该档案 取消 确定」（中文按钮，确定=el-button--primary）；API=filesFileManage/deleteFileInf
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's14-values.json');
const FILE_NAME = 'AT_test_image_upload.png';
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const PAGE_FILE_API = (r: any) => r.url().includes('filesFileManage/pageFileInf') && r.request().method() === 'POST';
const DELETE_API = (r: any) => r.url().includes('filesFileManage/deleteFileInf') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

test('S14 同业客户-影像资料删除（行删除→确认→文件-1→重进验证）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO, fileName: FILE_NAME };

  const enterScene = async () => {
    const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const j = JSON.parse(await (await qP).text());
    expect(j.data.total).toBe(1);
    await page.waitForTimeout(1500);
    await page.locator(ROWS).first().locator('input[type="radio"]').first().evaluate((el) => el.click());
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

  await test.step('1 列表页：量客户编号 rect', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ROWS, { timeout: 120_000 });
    await page.waitForTimeout(2000);
    V.listNoRect = await formItem(page, '客户编号').locator('input').first().evaluate(rectEval);
  });

  await test.step('2 选行→修改→影像资料tab→「客户管理」→断言有文件可删', async () => {
    const { total } = await enterScene();
    expect(total, '客户管理目录至少 1 个文件（数据依赖：清零后须先 S12 补文件）').toBeGreaterThanOrEqual(1);
    V.preTotal = total;
    console.log('S14_PRE_TOTAL=' + total);
  });

  await test.step('3 模式守卫：卡片模式则点【返回列表】切回表格', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const backBtn = pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(2500);
    }
    await expect(pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  await test.step('4 首行【删除】→ message-box「是否删除该档案」→【确定】→ 断言 deleteFileInf 200 + 文件数-1', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const span = pane.locator('span').filter({ hasText: /^\s*删除\s*$/ }).filter({ visible: true }).first();
    await expect(span).toBeVisible({ timeout: 10_000 });
    V.deleteSpanRect = await span.evaluate(rectEval);
    const delP = page.waitForResponse(DELETE_API, { timeout: 30_000 });
    const pfP = page.waitForResponse(PAGE_FILE_API, { timeout: 30_000 });
    await span.click();
    const mb = page.locator('.el-message-box:visible');
    await expect(mb).toBeVisible({ timeout: 10_000 });
    const mbText = await mb.innerText();
    console.log('S14_MB=' + JSON.stringify(mbText.replace(/\s+/g, ' ')));
    expect(mbText, '确认框措辞').toContain('是否删除该档案');
    await mb.locator('button.el-button--primary').click();
    const delResp = await delP;
    expect(delResp.status(), 'deleteFileInf 200').toBe(200);
    const pfJ = JSON.parse(await (await pfP).text());
    V.postTotal = pfJ.data.total;
    expect(pfJ.data.total, '文件数 -1').toBe(V.preTotal - 1);
  });

  await test.step('5 返回→重进场景→断言文件数持久为 postTotal', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const { total } = await enterScene();
    expect(total, '重进后文件数不变（删除持久化）').toBe(V.postTotal);
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S14_VALUES_SAVED pre=' + V.preTotal + ' post=' + V.postTotal);
});
