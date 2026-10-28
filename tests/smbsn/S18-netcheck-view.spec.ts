import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S18 同业客户-联网核查信息-查看（列表查询→选行→【联网核查信息】dialog→7列表格断言→核查结果筛选查询→重置→取消关闭）
// probe87b/88/89：无标题 .el-dialog(dialog512 动态)；API custCorporatNetworkCheckBasic/page {cstNo,pageNum,pageSize,createTime,inspRsltId}；基线 7 行「核查通过/要素核查匹配正确」
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's18-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const PAGE_API = (r: any) => r.url().includes('/tansun-tcp-cst/custCorporatNetworkCheckBasic/page') && r.request().method() === 'POST';
const DlgX = `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`;
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const COLS7 = ['核查时间', '客户编号', '客户名称', '证件类型', '证件号码', '核查结果', '核查结果信息'];

test('S18 同业客户-联网核查信息-查看（dialog 表格断言+核查结果筛选查询+重置+取消）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号查询 total=1 → 选行', async () => {
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
  });

  await test.step('2 点【联网核查信息】→ dialog 出现 + 7 列表格断言', async () => {
    const btn = page.getByRole('button').filter({ hasText: /联网核查信息/ }).first();
    V.netcheckBtnRect = await btn.evaluate(rectEval);
    const pageRespP = page.waitForResponse(PAGE_API, { timeout: 30_000 });
    await btn.click();
    const dlg = page.locator(`xpath=${DlgX}`);
    await expect(dlg, '联网核查 dialog').toBeVisible({ timeout: 15_000 });
    await pageRespP;
    await dlg.locator('.el-table__body-wrapper tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });
    const ths = await dlg.locator('.el-table__header-wrapper th').allInnerTexts();
    expect(ths.map((t) => t.trim()).filter(Boolean), '7 列').toEqual(COLS7);
    const rows = dlg.locator('.el-table__body-wrapper tbody tr');
    expect(await rows.count(), '核查记录 ≥1 行').toBeGreaterThanOrEqual(1);
    const rowTxt = (await rows.first().innerText()).replace(/\s+/g, ' ');
    expect(rowTxt, '首行含客户编号').toContain(CUST_NO);
    expect(rowTxt, '首行核查通过').toContain('核查通过');
    console.log('S18_ROW0=' + rowTxt.slice(0, 120));
    // 查询表单：核查时间 input + 核查结果 select
    const timeItem = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '核查时间' }) }).first();
    expect(await timeItem.locator('input').count(), '核查时间输入框').toBeGreaterThanOrEqual(1);
    const rsltItem = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '核查结果' }) }).first();
    expect(await rsltItem.count(), '核查结果项存在').toBe(1);
    V.rsltSelectEnabled = await rsltItem.evaluate((el) => {
      const inp = el.querySelector('input');
      return inp ? !inp.readOnly || el.querySelector('.el-select') !== null : false;
    });
    console.log('S18_RSLT_SELECT_ENABLED=' + V.rsltSelectEnabled);
  });

  await test.step('3 核查结果=核查通过 → 查询（inspRsltId 生效）', async () => {
    const dlg = page.locator(`xpath=${DlgX}`);
    const rsltItem = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '核查结果' }) }).first();
    const sel = rsltItem.locator('.tssc-multi-select .el-select').first();
    V.netRsltRect = await sel.evaluate(rectEval);
    await sel.click();
    const dropdown = page.locator('.el-select-dropdown').filter({ hasText: '核查通过' }).last();
    await dropdown.waitFor({ state: 'visible', timeout: 10_000 });
    V.rsltOptions = await dropdown.locator('.el-select-dropdown__item').allInnerTexts();
    console.log('S18_RSLT_OPTIONS=' + JSON.stringify(V.rsltOptions.map((s) => s.trim())));
    expect(V.rsltOptions.map((s) => s.trim()), '选项 = 核查通过/核查不通过').toEqual(['核查通过', '核查不通过']);
    await dropdown.locator('.el-select-dropdown__item').filter({ hasText: '核查通过' }).first().click();
    await page.waitForTimeout(600);
    const qBtn = dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    V.netDlgQueryRect = await qBtn.evaluate(rectEval);
    const respP = page.waitForResponse(PAGE_API, { timeout: 30_000 });
    await qBtn.click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    V.queryReqBody = body;
    console.log('S18_QUERY_BODY=' + JSON.stringify(body));
    expect(body.cstNo, '请求带 cstNo').toBe(CUST_NO);
    expect(body.inspRsltId, '核查通过 → inspRsltId=1').toBe('1');
    await page.waitForTimeout(2000);
    const rows = dlg.locator('.el-table__body-wrapper tbody tr');
    expect(await rows.count(), '筛选后 ≥1 行').toBeGreaterThanOrEqual(1);
    const allPass = await rows.allInnerTexts();
    expect(allPass.every((t) => t.includes('核查通过')), '筛选后全部核查通过').toBeTruthy();
  });

  await test.step('4 重置 → 表单清空', async () => {
    const dlg = page.locator(`xpath=${DlgX}`);
    const rBtn = dlg.getByRole('button').filter({ hasText: /重\s*置/ }).first();
    V.netDlgResetRect = await rBtn.evaluate(rectEval);
    await rBtn.click();
    await page.waitForTimeout(1500);
    const rsltVal = await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '核查结果' }) }).first().locator('input').first().inputValue().catch(() => '');
    expect(rsltVal, '重置后核查结果清空').toBe('');
    console.log('S18_RESET_OK');
  });

  await test.step('5 取消关闭 dialog', async () => {
    const dlg = page.locator(`xpath=${DlgX}`);
    const cBtn = dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
    V.netDlgCancelRect = await cBtn.evaluate(rectEval);
    await cBtn.click();
    await expect(dlg, 'dialog 关闭').toBeHidden({ timeout: 10_000 });
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 10_000 });
    console.log('S18_CLOSED');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S18_VALUES_SAVED');
});
