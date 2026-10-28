import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S23 同业客户-列表分页（默认 10/页 15 条 2 页 → 点页码2 → 点页码1 → 每页条数=20/页(1页15行) → 每页条数=10/页 → 跳页输入2回车 → 上一页）
// 探路：自定义分页 .el-pagination；每页条数=el-pagination__sizes 内 el-select(5/10/20/30)；页码=li.number(1 active/2)；btn-prev/btn-next；跳页=el-pagination__jump 内 input(回车提交)
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's23-values.json');
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S23 同业客户-列表分页（页码翻页+每页条数+跳页）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = {};

  await test.step('1 列表页加载 → 断默认 10/页 + 2 页 + 10 行可见', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ROWS, { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const rowCount = await page.locator(ROWS).count();
    expect(rowCount, '默认 10/页 → 10 行').toBe(10);
    const pagerTxt = (await page.locator('.el-pagination').innerText()).replace(/\s+/g, ' ');
    console.log('S23_PAGER_INIT=' + pagerTxt);
    expect(pagerTxt, '默认 page 1 of 2').toContain('page 1 of 2');
    V.initRowCount = rowCount;
    V.initPagerText = pagerTxt;
    // 页码 2 的 li
    const p2 = page.locator("//div[contains(@class,'el-pagination')]//li[contains(@class,'number')][normalize-space(.)='2']");
    expect(await p2.count(), '页码 2 存在').toBe(1);
    V.page2Rect = await p2.evaluate(rectEval);
    const p1 = page.locator("//div[contains(@class,'el-pagination')]//li[contains(@class,'number')][normalize-space(.)='1']");
    V.page1Rect = await p1.evaluate(rectEval);
    // 每页条数 select
    const sizeSel = page.locator("//span[contains(@class,'el-pagination__sizes')]//div[contains(@class,'el-select--mini')]");
    expect(await sizeSel.count(), '每页条数 select 存在').toBeGreaterThanOrEqual(1);
    V.sizeRect = await sizeSel.first().evaluate(rectEval);
    // prev/next
    V.prevRect = await page.locator("//div[contains(@class,'el-pagination')]//button[contains(@class,'btn-prev')]").first().evaluate(rectEval);
    V.nextRect = await page.locator("//div[contains(@class,'el-pagination')]//button[contains(@class,'btn-next')]").first().evaluate(rectEval);
    // 跳页 input
    const jumpInput = page.locator("//div[contains(@class,'el-pagination__editor')]//input").first();
    expect(await jumpInput.count(), '跳页 input 存在').toBe(1);
    V.jumpRect = await jumpInput.evaluate(rectEval);
  });

  await test.step('2 点页码 2 → page 2 of 2 + 5 行 + API pageNum=2', async () => {
    const p2 = page.locator("//div[contains(@class,'el-pagination')]//li[contains(@class,'number')][normalize-space(.)='2']");
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await p2.click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    const j = await resp.json();
    expect(body.pageNum, 'API pageNum=2').toBe(2);
    expect(j.data.list.length, '第 2 页 5 行').toBe(5);
    await expect.poll(async () => page.locator(ROWS).count(), { timeout: 15_000 }, '表格 5 行').toBe(5);
    const rowCount = await page.locator(ROWS).count();
    const pagerTxt = (await page.locator('.el-pagination').innerText()).replace(/\s+/g, ' ');
    expect(pagerTxt, 'page 2 of 2').toContain('page 2 of 2');
    console.log('S23_PAGE2 total=' + j.data.total + ' rows=' + rowCount);
    V.page2Total = j.data.total;
  });

  await test.step('3 点页码 1 → 回 page 1 of 2 + 10 行 + API pageNum=1', async () => {
    const p1 = page.locator("//div[contains(@class,'el-pagination')]//li[contains(@class,'number')][normalize-space(.)='1']");
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await p1.click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    expect(body.pageNum, 'API pageNum=1').toBe(1);
    await expect.poll(async () => page.locator(ROWS).count(), { timeout: 15_000 }, '回 10 行').toBe(10);
    const rowCount = await page.locator(ROWS).count();
    console.log('S23_PAGE1 rows=' + rowCount);
  });

  await test.step('4 每页条数=20/页 → 1 页 15 行 + API pageSize=20', async () => {
    const sizeSel = page.locator("//span[contains(@class,'el-pagination__sizes')]//div[contains(@class,'el-select--mini')]").first();
    await sizeSel.click();
    const dd = page.locator('.el-select-dropdown').filter({ hasText: '20/page' }).last();
    await dd.waitFor({ state: 'visible', timeout: 10_000 });
    V.sizeOptions = (await dd.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim());
    console.log('S23_SIZE_OPTS=' + V.sizeOptions.join(','));
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await dd.locator('.el-select-dropdown__item').filter({ hasText: '20/page' }).first().click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    const j = await resp.json();
    expect(body.pageSize, 'API pageSize=20').toBe(20);
    await expect.poll(async () => page.locator(ROWS).count(), { timeout: 15_000 }, '20/页 15 行全显').toBe(j.data.total);
    const rowCount = await page.locator(ROWS).count();
    const pagerTxt = (await page.locator('.el-pagination').innerText()).replace(/\s+/g, ' ');
    expect(pagerTxt, 'page 1 of 1').toContain('page 1 of 1');
    console.log('S23_SIZE20 rows=' + rowCount + ' total=' + j.data.total);
    V.size20Rows = rowCount;
  });

  await test.step('5 每页条数=10/页（恢复）→ 2 页', async () => {
    const sizeSel = page.locator("//span[contains(@class,'el-pagination__sizes')]//div[contains(@class,'el-select--mini')]").first();
    await sizeSel.click();
    const dd = page.locator('.el-select-dropdown').filter({ hasText: '10/page' }).last();
    await dd.waitFor({ state: 'visible', timeout: 10_000 });
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await dd.locator('.el-select-dropdown__item').filter({ hasText: '10/page' }).first().click();
    await respP;
    await page.waitForTimeout(1000);
    const pagerTxt = (await page.locator('.el-pagination').innerText()).replace(/\s+/g, ' ');
    expect(pagerTxt, '恢复 page 1 of 2').toContain('page 1 of 2');
    console.log('S23_SIZE10 restored');
  });

  await test.step('6 跳页 input=2 + 回车 → page 2 of 2 + API pageNum=2', async () => {
    const jumpInput = page.locator("//div[contains(@class,'el-pagination__editor')]//input").first();
    await jumpInput.fill('2');
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await jumpInput.press('Enter');
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    expect(body.pageNum, '跳页 API pageNum=2').toBe(2);
    await expect.poll(async () => page.locator(ROWS).count(), { timeout: 15_000 }, '跳页后 5 行').toBe(5);
    const rowCount = await page.locator(ROWS).count();
    const pagerTxt = (await page.locator('.el-pagination').innerText()).replace(/\s+/g, ' ');
    expect(pagerTxt, 'page 2 of 2').toContain('page 2 of 2');
    console.log('S23_JUMP2 rows=' + rowCount);
  });

  await test.step('7 上一页按钮 → 回 page 1', async () => {
    const prev = page.locator("//div[contains(@class,'el-pagination')]//button[contains(@class,'btn-prev')]").first();
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await prev.click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    expect(body.pageNum, '上一页 API pageNum=1').toBe(1);
    console.log('S23_PREV ok');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S23_VALUES_SAVED');
});
