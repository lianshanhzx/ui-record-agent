import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S15 同业客户-影像目录检索（影像资料tab 左侧目录搜索框 输入「营业执照」→ 目录树过滤 → 清空 → 恢复全树；只读幂等）
// probe70：搜索框=pane 内第一个 input[placeholder=请输入]；过滤后树仅含命中路径（客户管理→营业执照）；清空恢复 17 可见节点
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's15-values.json');
const CUST_NO = '260924144929974126';
const SEARCH_KEYWORD = '营业执照';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

// 目录树懒渲染：轮询直到可见节点数连续两次相同才视为稳定
const stableTreeCount = async (page: any, pane: any) => {
  let last = -1, stable = 0;
  for (let i = 0; i < 20; i++) {
    const c = await pane.locator('.el-tree [role="treeitem"]:visible').count();
    if (c === last) stable++; else stable = 0;
    if (stable >= 2) return c;
    last = c;
    await page.waitForTimeout(500);
  }
  return last;
};

test('S15 同业客户-影像目录检索（搜索过滤目录树→清空恢复）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO, keyword: SEARCH_KEYWORD };

  await test.step('1 列表页：量客户编号 rect', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ROWS, { timeout: 120_000 });
    await page.waitForTimeout(2000);
    V.listNoRect = await formItem(page, '客户编号').locator('input').first().evaluate(rectEval);
  });

  await test.step('2 选行→修改→影像资料tab→量目录搜索框 rect', async () => {
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
    await expect(pane.locator('.el-tree [role="treeitem"]').first()).toBeVisible({ timeout: 15_000 });
    V.searchInput = '//div[contains(@class,"leftContent")]//input[@placeholder="请输入"]';
    const searchInput = pane.locator('.leftContent input[placeholder="请输入"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    V.searchInputRect = await searchInput.evaluate(rectEval);
    V.fullTreeCount = await stableTreeCount(page, pane);
    console.log('S15_FULL_TREE=' + V.fullTreeCount);
  });

  await test.step('3 输入「营业执照」→ 断言目录树过滤（仅命中路径，含关键词）', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const searchInput = pane.locator('.leftContent input[placeholder="请输入"]').first();
    await searchInput.fill(SEARCH_KEYWORD);
    await page.waitForTimeout(2500);
    const visNodes = pane.locator('.el-tree [role="treeitem"]:visible');
    const texts: string[] = [];
    for (let i = 0; i < await visNodes.count(); i++) texts.push((await visNodes.nth(i).innerText()).replace(/\s+/g, ' '));
    console.log('S15_FILTERED_TREE=' + JSON.stringify(texts));
    const filtered = await visNodes.count();
    expect(filtered, '过滤后节点数 < 全树').toBeLessThan(V.fullTreeCount);
    expect(texts.some((t) => t.includes(SEARCH_KEYWORD)), '过滤后含关键词节点').toBeTruthy();
    expect(texts.some((t) => t.includes('客户管理')), '过滤后含父路径').toBeTruthy();
    V.filteredTreeCount = filtered;
  });

  await test.step('4 清空搜索 → 断言目录树恢复全量', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const searchInput = pane.locator('.leftContent input[placeholder="请输入"]').first();
    await searchInput.fill('');
    await page.waitForTimeout(2500);
    const restored = await stableTreeCount(page, pane);
    console.log('S15_RESTORED_TREE=' + restored);
    // 树懒渲染：搜索周期后全量节点(17)≥初始渲染数(15)，断言过滤已解除且不少于进入时
    expect(restored, '清空后树恢复（≥进入时）').toBeGreaterThanOrEqual(V.fullTreeCount);
    expect(restored, '清空后 > 过滤后').toBeGreaterThan(V.filteredTreeCount);
  });

  await test.step('5 返回', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S15_VALUES_SAVED full=' + V.fullTreeCount + ' filtered=' + V.filteredTreeCount);
});
