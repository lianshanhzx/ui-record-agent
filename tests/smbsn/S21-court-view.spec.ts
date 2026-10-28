import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S21 同业客户-法院信息-查看（列表查询→选行→【法院信息】dialog→7列表格断言→法院信息类型筛选查询→重置→取消）
// probe87b/88：API custCourtInfApi/page {cstNo,cstNm,crdtNo,pageNum,pageSize,courtInfTp,vldInd}；法院信息类型[涉诉/失信被执行/限制消费被执行]；是否有效=tssc-multi-select；基线 1 行 涉诉/是/701994/2026-09-24；footer 仅【取消】
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's21-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const C_API = (r: any) => r.url().includes('/tansun-tcp-cst/custCourtInfApi/page') && r.request().method() === 'POST';
const D = `//div[@role='dialog'][.//label[normalize-space()='法院信息类型']]`;
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const COLS7 = ['法院信息类型', '客户编号', '客户名称', '证件号码', '是否存在法院信息', '登记人', '登记日期'];

test('S21 同业客户-法院信息-查看（dialog 表格断言+法院信息类型筛选查询+重置+取消）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号查询 total=1 → 选行 → 开法院信息 dialog', async () => {
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
    const cRespP = page.waitForResponse(C_API, { timeout: 30_000 });
    const btn = page.getByRole('button').filter({ hasText: /法院信息/ }).first();
    V.courtBtnRect = await btn.evaluate(rectEval);
    await btn.click();
    const dlg = page.locator(`xpath=${D}`);
    await expect(dlg, '法院信息 dialog').toBeVisible({ timeout: 15_000 });
    await cRespP;
    await dlg.locator('.el-table__body-wrapper tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });
  });

  await test.step('2 表格断言：7 列 + 基线行（涉诉/是/701994/2026-09-24）', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const ths = await dlg.locator('.el-table__header-wrapper th').allInnerTexts();
    expect(ths.map((t) => t.trim()).filter(Boolean), '7 列').toEqual(COLS7);
    const rows = dlg.locator('.el-table__body-wrapper tbody tr');
    expect(await rows.count(), '法院记录 ≥1 行').toBeGreaterThanOrEqual(1);
    V.rowsTotal = await rows.count();
    const rowTxt = (await rows.first().innerText()).replace(/\s+/g, ' ').trim();
    V.firstRow = rowTxt;
    console.log('S21_ROW0=' + rowTxt);
    for (const k of ['涉诉', '是', '701994', CUST_NO]) {
      expect(rowTxt, '首行含 ' + k).toContain(k);
    }
    // 查询表单：法院信息类型 select + 是否有效 tssc-multi-select
    const tpItem = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '法院信息类型' }) }).first();
    const vldItem = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '是否有效' }) }).first();
    expect(await tpItem.count(), '法院信息类型项').toBe(1);
    expect(await vldItem.count(), '是否有效项').toBe(1);
    expect(await vldItem.locator('.tssc-multi-select').count(), '是否有效=tssc-multi-select').toBe(1);
  });

  await test.step('3 法院信息类型=涉诉 → 查询（courtInfTp 生效）', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const tpItem = dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '法院信息类型' }) }).first();
    const sel = tpItem.locator('.el-select, .tssc-multi-select .el-select').first();
    V.courtTpRect = await sel.evaluate(rectEval);
    await sel.click();
    const dropdown = page.locator('.el-select-dropdown').filter({ hasText: '涉诉' }).last();
    await dropdown.waitFor({ state: 'visible', timeout: 10_000 });
    V.tpOptions = (await dropdown.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim());
    console.log('S21_TP_OPTIONS=' + JSON.stringify(V.tpOptions));
    expect(V.tpOptions, '选项含 涉诉/失信被执行/限制消费被执行').toEqual(expect.arrayContaining(['涉诉', '失信被执行', '限制消费被执行']));
    await dropdown.locator('.el-select-dropdown__item').filter({ hasText: /^涉诉$/ }).first().click();
    await page.waitForTimeout(600);
    const qBtn = dlg.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    V.courtQueryRect = await qBtn.evaluate(rectEval);
    const respP = page.waitForResponse(C_API, { timeout: 30_000 });
    await qBtn.click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    V.queryReqBody = body;
    console.log('S21_QUERY_BODY=' + JSON.stringify(body));
    expect(body.cstNo, '请求带 cstNo').toBe(CUST_NO);
    expect(String(body.courtInfTp || ''), 'courtInfTp 生效').not.toBe('');
    await page.waitForTimeout(2000);
    const rows = dlg.locator('.el-table__body-wrapper tbody tr');
    expect(await rows.count(), '筛选后 ≥1 行').toBeGreaterThanOrEqual(1);
    const all = await rows.allInnerTexts();
    expect(all.every((t) => t.includes('涉诉')), '筛选后全部涉诉').toBeTruthy();
  });

  await test.step('4 重置 → 表单清空', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const rBtn = dlg.getByRole('button').filter({ hasText: /重\s*置/ }).first();
    V.courtResetRect = await rBtn.evaluate(rectEval);
    await rBtn.click();
    await page.waitForTimeout(1500);
    const tpVal = await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '法院信息类型' }) }).first().locator('input').first().inputValue().catch(() => '');
    expect(tpVal, '重置后法院信息类型清空').toBe('');
    console.log('S21_RESET_OK');
  });

  await test.step('5 取消关闭 dialog（footer 仅取消，无确认）', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const allBtns = (await dlg.locator('button').allInnerTexts()).map((s) => s.trim());
    expect(allBtns.filter((b) => b === '确认').length, '法院 dialog 无 确认 按钮').toBe(0);
    expect(allBtns, '法院 dialog 有 取消 按钮').toContain('取消');
    const cBtn = dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
    V.courtCancelRect = await cBtn.evaluate(rectEval);
    await cBtn.click();
    await expect(dlg).toBeHidden({ timeout: 10_000 });
    console.log('S21_CLOSED');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S21_VALUES_SAVED');
});
