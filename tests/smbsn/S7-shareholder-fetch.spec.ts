import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S7 同业客户-获取股东信息（列表查询→修改→股东信息tab→点【获取股东信息】→networkCheck+成功通知+表不变→返回反查）
// probe51/52：按钮不依赖选行(enabled)；点击→POST custCorporat/networkCheck{cstNo,cstNm,uscc,lglRprsNm,lglRprsCrdtNo,chkTp:'0',type:'1'} 200
//            →重查 queryCustCorporatRelatedParty(total 不变)→.el-notification「操作成功」(~4s 自动消失)；本测试客户无外部股东数据，行数不变
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's7-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const NETCHK_API = (r: any) => r.url().includes('custCorporat/networkCheck') && r.request().method() === 'POST';
const SH_QUERY_API = (r: any) => r.url().includes('queryCustCorporatRelatedParty') && r.request().method() === 'POST';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S7 同业客户-获取股东信息（点按钮→networkCheck 200→成功通知→表不变）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号搜索→查询 total=1', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    V.listNoRect = await noInput.evaluate(rectEval);
    await noInput.fill(CUST_NO);
    const q = page.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    const listRespP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await q.click();
    const lr = JSON.parse(await (await listRespP).text());
    expect(lr.data.total).toBe(1);
  });

  await test.step('2 选行→修改→场景页', async () => {
    const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await page.waitForTimeout(3000);
  });

  await test.step('3 股东信息tab→读行数(点前)', async () => {
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /股东/ }).first();
    V.tabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(2500);
    const pane = page.locator('.el-tab-pane:visible').last();
    V.beforeCount = await pane.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
    console.log('S7_SH_ROWS_BEFORE=' + V.beforeCount);
  });

  await test.step('4 点【获取股东信息】→ networkCheck 200 + 成功通知 + 表不变', async () => {
    const fetchBtn = page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /获取股东信息/ }).first();
    await expect(fetchBtn).toBeEnabled({ timeout: 10_000 });
    V.fetchRect = await fetchBtn.evaluate(rectEval);
    const netP = page.waitForResponse(NETCHK_API, { timeout: 30_000 });
    const requeryP = page.waitForResponse(SH_QUERY_API, { timeout: 30_000 });
    await fetchBtn.click();
    const netRespRaw = await netP;
    const netBody = JSON.parse(netRespRaw.request().postData() || '{}');
    expect(netBody.cstNo, 'networkCheck body.cstNo').toBe(CUST_NO);
    const net = JSON.parse(await netRespRaw.text());
    expect(net.status, 'networkCheck 200').toBe(200);
    console.log('S7_NETCHK rslt=' + net.data.rslt + ' ' + net.data.inspRstinf);
    const notP = page.waitForSelector('.el-notification', { state: 'visible', timeout: 15_000 });
    const notEl = await notP;
    const notText = (await notEl.innerText()).trim();
    expect(notText, '成功通知').toContain('操作成功');
    console.log('S7_NOTIFICATION=' + notText);
    const rq = JSON.parse(await (await requeryP).text());
    expect(rq.data.total, '重查 total 不变').toBe(V.beforeCount);
    await page.waitForTimeout(2000);
    const after = await page.locator('.el-tab-pane:visible').last().locator('.el-table__body-wrapper .el-table__body tbody tr').count();
    expect(after, '表格行数不变').toBe(V.beforeCount);
    V.afterCount = after;
  });

  await test.step('5 返回列表→反查 total=1', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForTimeout(2500);
    const requeryP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    await noInput.fill(CUST_NO);
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const lr = JSON.parse(await (await requeryP).text());
    expect(lr.data.total).toBe(1);
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S7_VALUES_SAVED ' + VALUES_FILE);
});
