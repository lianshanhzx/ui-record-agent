import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S16 同业客户-其他信息-查看历史修改记录（列表→修改→其他信息tab→断言三段加载：团队1行/历史total=297/登记信息7项→历史分页 2→1 往返→返回→重进验证 297 不变；只读幂等）
// probe77/85：其他信息=3折叠段（维护客户管理团队/查看历史修改记录/查看登记信息）；历史 API ICstTradeMdfHistApi/page 基线 total=297 10/页
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's16-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const TEAM_API = (r: any) => r.url().includes('custPermision/findCustTeam') && r.request().method() === 'POST';
const HIST_API = (r: any) => r.url().includes('ICstTradeMdfHistApi/page') && r.request().method() === 'POST';
const REG_API = (r: any) => r.url().includes('custPersonal/getRegistInfo') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

// 历史修改记录段（查看历史修改记录折叠项）内的分页页码 li
const HIST_PAGER_X = (n: string) =>
  `//div[contains(@class,'el-collapse-item')][.//div[contains(@class,'el-collapse-item__header')][contains(.,'查看历史修改记录')]]//li[contains(@class,'number') and normalize-space(.)='${n}']`;

test('S16 同业客户-其他信息-查看历史修改记录（三段加载断言+历史分页2→1往返+重进验证）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  // 进场景→其他信息 tab；opts.captureApis=true 时返回 tab 打开期间抓到的 API
  const enterScene = async (captureApis: boolean) => {
    const seen: { hist?: any; team?: any; reg?: any } = {};
    const hP = captureApis ? page.waitForResponse(HIST_API, { timeout: 30_000 }) : null;
    const tP = captureApis ? page.waitForResponse(TEAM_API, { timeout: 30_000 }) : null;
    const rP = captureApis ? page.waitForResponse(REG_API, { timeout: 30_000 }) : null;
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
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /其他信息/ }).first();
    if (!V.otherTabRect) V.otherTabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(6000);
    const pane = page.locator('.el-tab-pane:visible').last();
    if (captureApis) {
      const [hj, tj, rj] = await Promise.all([
        (async () => { const r = await hP!; return JSON.parse(await r.text()); })(),
        (async () => { const r = await tP!; return JSON.parse(await r.text()); })(),
        (async () => { const r = await rP!; return JSON.parse(await r.text()); })(),
      ]);
      seen.hist = hj; seen.team = tj; seen.reg = rj;
    }
    return { pane, ...seen };
  };

  await test.step('1 列表页：量客户编号 rect', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(ROWS, { timeout: 120_000 });
    await page.waitForTimeout(2000);
    V.listNoRect = await formItem(page, '客户编号').locator('input').first().evaluate(rectEval);
  });

  await test.step('2 选行→修改→其他信息tab→断言三段加载（团队1行/历史total=297/登记信息7项）', async () => {
    const { pane, hist, team, reg } = await enterScene(true);
    expect(team.data.total, '团队表 1 行').toBe(1);
    console.log('S16_TEAM_ROW=' + JSON.stringify(team.data.list[0]).slice(0, 120));
    expect(hist.data.total, '历史修改记录 total').toBe(297);
    V.histTotal = hist.data.total;
    expect(reg.status, '登记信息 API').toBe(200);
    // 登记信息 7 项只读字段
    const regItems = pane.locator('.el-collapse-item').filter({ hasText: '查看登记信息' }).locator('.el-form-item');
    expect(await regItems.count(), '登记信息 7 项').toBe(7);
    // 历史表当前 10 行
    const histPane = pane.locator('.el-collapse-item').filter({ hasText: '查看历史修改记录' });
    const rows = histPane.locator(ROWS);
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    V.histRowsPerPage = await rows.count();
    expect(V.histRowsPerPage, '历史表 10 行/页').toBe(10);
    V.page1First = (await rows.first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 80);
    console.log('S16_PAGE1_FIRST=' + V.page1First);
  });

  await test.step('3 历史分页点第 2 页→断言 pageNum=2 且首行变化', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const x2 = HIST_PAGER_X('2');
    V.histPagerX2 = x2;
    const li2 = pane.locator(`xpath=${x2}`);
    expect(await li2.count(), '第2页页码存在').toBe(1);
    await li2.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    V.page2Rect = await li2.first().evaluate(rectEval);
    const p2 = page.waitForResponse(HIST_API, { timeout: 30_000 });
    await li2.first().click();
    const r2 = await p2;
    const body2 = JSON.parse(r2.request().postData() || '{}');
    expect(body2.pageNum, '翻到第 2 页').toBe(2);
    const j2 = JSON.parse(await r2.text());
    expect(j2.data.total, 'total 不变').toBe(297);
    await page.waitForTimeout(2000);
    const histPane = pane.locator('.el-collapse-item').filter({ hasText: '查看历史修改记录' });
    const rows2 = histPane.locator(ROWS);
    expect(await rows2.count(), '第 2 页仍 10 行').toBe(10);
    const page2First = (await rows2.first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 80);
    console.log('S16_PAGE2_FIRST=' + page2First);
    expect(page2First, '第 2 页首行 ≠ 第 1 页首行').not.toBe(V.page1First);
  });

  await test.step('4 历史分页回第 1 页→断言 pageNum=1 且首行恢复', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const x1 = HIST_PAGER_X('1');
    V.histPagerX1 = x1;
    const li1 = pane.locator(`xpath=${x1}`);
    expect(await li1.count(), '第1页页码存在').toBe(1);
    await li1.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    V.page1Rect = await li1.first().evaluate(rectEval);
    const p1 = page.waitForResponse(HIST_API, { timeout: 30_000 });
    await li1.first().click();
    const r1 = await p1;
    const body1 = JSON.parse(r1.request().postData() || '{}');
    expect(body1.pageNum, '回到第 1 页').toBe(1);
    await page.waitForTimeout(2000);
    const histPane = pane.locator('.el-collapse-item').filter({ hasText: '查看历史修改记录' });
    const page1FirstAgain = (await histPane.locator(ROWS).first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 80);
    expect(page1FirstAgain, '首行恢复').toBe(V.page1First);
  });

  await test.step('5 返回→重进场景→断言历史 total 仍 297（只读幂等）', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    const { hist, team } = await enterScene(true);
    expect(hist.data.total, '历史 total 不变').toBe(V.histTotal);
    expect(team.data.total, '团队 1 行不变').toBe(1);
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S16_VALUES_SAVED histTotal=' + V.histTotal + ' rowsPerPage=' + V.histRowsPerPage);
});
