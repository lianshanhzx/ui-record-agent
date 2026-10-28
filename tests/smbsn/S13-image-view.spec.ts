import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S13 同业客户-影像资料查看（行【预览】→ 行内 viewer：卡片模式+属性面板+filesFileManage/preview →【返回列表】退回 → 返回重进验证文件仍在）
// probe71b：预览=行内 viewer（列表切卡片模式，中栏图片查看器缩放/旋转工具条，右栏属性=文件名/大小/作者/类型/更新时间）；无 dialog 无新页
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's13-values.json');
const FILE_NAME = 'AT_test_image_upload.png';
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const PAGE_FILE_API = (r: any) => r.url().includes('filesFileManage/pageFileInf') && r.request().method() === 'POST';
const PREVIEW_API = (r: any) => r.url().includes('filesFileManage/preview') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

test('S13 同业客户-影像资料查看（行预览→viewer→返回列表→重进验证）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO, fileName: FILE_NAME };

  // 列表查询→选行→修改→影像资料tab→选目录「客户管理」→返回 {pane, total}
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

  const visibleSpan = (pane: any, txt: string) =>
    pane.locator('span').filter({ hasText: new RegExp(`^\\s*${txt}\\s*$`) }).filter({ visible: true }).first();

  await test.step('1 列表页：量客户编号 rect', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ROWS, { timeout: 120_000 });
    await page.waitForTimeout(2000);
    V.listNoRect = await formItem(page, '客户编号').locator('input').first().evaluate(rectEval);
  });

  await test.step('2 选行→修改→影像资料tab→「客户管理」→断言有文件', async () => {
    const { total } = await enterScene();
    expect(total, '客户管理目录至少 1 个文件').toBeGreaterThanOrEqual(1);
    V.preTotal = total;
    console.log('S13_PRE_TOTAL=' + total);
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

  await test.step('4 首行【预览】→ 断言 viewer 形态（返回列表可见+属性含文件名+preview API 200）', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const span = visibleSpan(pane, '预览');
    await expect(span).toBeVisible({ timeout: 10_000 });
    V.previewSpanRect = await span.evaluate(rectEval);
    const pvP = page.waitForResponse(PREVIEW_API, { timeout: 30_000 });
    await span.click();
    const pvResp = await pvP;
    expect(pvResp.status(), 'preview 200').toBe(200);
    await page.waitForTimeout(8000);
    const backBtn = pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first();
    await expect(backBtn, '预览模式（返回列表按钮）').toBeVisible({ timeout: 10_000 });
    V.backToListRect = await backBtn.evaluate(rectEval);
    const propText = await pane.evaluate((p: any) => {
      const els = [...p.querySelectorAll('*')].filter((e: any) => (e.innerText || '').trim() === '属性' && e.children.length === 0);
      if (!els.length) return '';
      let box: any = els[0];
      for (let i = 0; i < 5 && box.parentElement; i++) box = box.parentElement;
      return box.innerText;
    });
    console.log('S13_PROP=' + JSON.stringify(propText.replace(/\s+/g, ' ').slice(0, 300)));
    expect(propText, '属性面板含文件名').toContain(FILE_NAME);
  });

  await test.step('5 【返回列表】→ 断言退回表格模式（视图预览可见）', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    await pane.getByRole('button').filter({ hasText: /返\s*回\s*列\s*表/ }).first().click();
    await page.waitForTimeout(2500);
    await expect(pane.getByRole('button').filter({ hasText: /视\s*图\s*预\s*览/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  await test.step('6 返回→重进场景→断言文件仍在（只读交易，行数不变）', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const { pane, total } = await enterScene();
    expect(total, '文件数不变').toBe(V.preTotal);
    const rows = pane.locator(ROWS);
    const texts: string[] = [];
    for (let i = 0; i < await rows.count(); i++) texts.push(await rows.nth(i).innerText());
    expect(texts.some((t) => t.includes(FILE_NAME)), '文件仍在').toBeTruthy();
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S13_VALUES_SAVED pre=' + V.preTotal);
});
