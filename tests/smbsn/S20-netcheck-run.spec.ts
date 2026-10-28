import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S20 同业客户-联网核查-发起实时核查（列表查询→选行→【联网核查信息】dialog→【发起实时核查】→message-box OK→networkCheck API 200→重查断言行数+1 且首行为今日）
// probe89：确认框文案「您确定发起[实时]联网核查吗?」按钮 Cancel/OK（英文 locale）；API custCorporat/networkCheck ~7.5s 返回 {rslt:'1',inspRstinf:'要素核查匹配正确'}；无 toast，重查后 +1 行
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's20-values.json');
const CUST_NO = '260924144929974126';
const CRDT_NO = '914501005QBUAEFCJ8';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const PAGE_API = (r: any) => r.url().includes('/tansun-tcp-cst/custCorporatNetworkCheckBasic/page') && r.request().method() === 'POST';
const NC_API = (r: any) => r.url().includes('/tansun-tcp-cst/custCorporat/networkCheck') && r.request().method() === 'POST';
const D = `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`;
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S20 同业客户-联网核查-发起实时核查（确认框OK→API 200→重查行数+1）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号查询 total=1 → 选行 → 开联网核查 dialog', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    await noInput.fill(CUST_NO);
    const q = page.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    const listRespP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await q.click();
    const lr = JSON.parse(await (await listRespP).text());
    expect(lr.data.total, '查询 total=1').toBe(1);
    const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    const pageRespP = page.waitForResponse(PAGE_API, { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /联网核查信息/ }).first().click();
    const dlg = page.locator(`xpath=${D}`);
    await expect(dlg, '联网核查 dialog').toBeVisible({ timeout: 15_000 });
    await pageRespP;
    await dlg.locator('.el-table__body-wrapper tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });
    V.rowsBefore = await dlg.locator('.el-table__body-wrapper tbody tr').count();
    console.log('S20_ROWS_BEFORE=' + V.rowsBefore);
  });

  await test.step('2 点【发起实时核查】→ 确认框（您确定发起[实时]联网核查吗?）', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const btn = dlg.getByRole('button').filter({ hasText: /发起实时核查/ }).first();
    V.ncBtnRect = await btn.evaluate(rectEval);
    await btn.click();
    const mb = page.locator('.el-message-box:visible').last();
    await expect(mb, '确认 message-box').toBeVisible({ timeout: 10_000 });
    const msgTxt = await mb.innerText();
    expect(msgTxt, '确认框文案').toContain('您确定发起[实时]联网核查吗');
    V.confirmText = msgTxt.replace(/\s+/g, ' ').trim();
    console.log('S20_CONFIRM=' + V.confirmText);
  });

  await test.step('3 点 OK → networkCheck API 200 + rslt=1', async () => {
    const mb = page.locator('.el-message-box:visible').last();
    const okBtn = mb.locator("xpath=.//button[normalize-space()='OK']");
    await expect(okBtn, 'OK 按钮').toBeVisible({ timeout: 5_000 });
    V.okRect = await okBtn.evaluate(rectEval);
    const t0 = Date.now();
    const ncP = page.waitForResponse(NC_API, { timeout: 60_000 });
    await okBtn.click();
    const ncResp = await ncP;
    V.elapsedMs = Date.now() - t0;
    const ncBody = JSON.parse(ncResp.request().postData() || '{}');
    V.ncReqBody = ncBody;
    expect(ncBody.cstNo, '请求 cstNo').toBe(CUST_NO);
    expect(ncBody.ntwrkgInsp, 'ntwrkgInsp=1(实时)').toBe('1');
    const j = await ncResp.json();
    expect(ncResp.status(), 'API 200').toBe(200);
    expect(j.data.rslt, 'rslt=1 成功').toBe('1');
    expect(j.data.inspRstinf, 'inspRstinf').toContain('要素核查匹配正确');
    V.ncResp = j;
    console.log('S20_NC rslt=' + j.data.rslt + ' inspRstinf=' + j.data.inspRstinf + ' elapsed=' + V.elapsedMs + 'ms');
    await page.waitForTimeout(1500);
    const errToast = page.locator('.el-message--error:visible, .el-notification--error:visible');
    expect(await errToast.count(), '无错误 toast').toBe(0);
  });

  await test.step('4 重查 → 行数 +1 且首行为今日新记录', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const q2 = page.waitForResponse(PAGE_API, { timeout: 30_000 });
    await dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    await q2;
    await page.waitForTimeout(2000);
    const rows = dlg.locator('.el-table__body-wrapper tbody tr');
    V.rowsAfter = await rows.count();
    expect(V.rowsAfter, '行数 +1').toBe(V.rowsBefore + 1);
    const newRow = (await rows.first().innerText()).replace(/\s+/g, ' ').trim();
    V.newRow = newRow;
    const today = new Date().toISOString().slice(0, 10);
    expect(newRow, '首行=今日').toContain(today);
    expect(newRow, '首行含证件号').toContain(CRDT_NO);
    expect(newRow, '首行核查通过').toContain('核查通过');
    console.log('S20_NEW_ROW=' + newRow.slice(0, 100));
  });

  await test.step('5 取消关闭 dialog', async () => {
    const dlg = page.locator(`xpath=${D}`);
    await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click();
    await expect(dlg).toBeHidden({ timeout: 10_000 });
    console.log('S20_CLOSED');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S20_VALUES_SAVED');
});
