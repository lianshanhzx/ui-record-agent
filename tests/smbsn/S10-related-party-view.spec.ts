import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S10 同业客户-关联人信息查看（列表查询→修改→关联人信息tab→选行→查看→只读弹窗断言 17 项→取消关闭→返回反查）
// probe62：查看=.el-dialog(dialog312) 17 项全 disabled 纯 input（select 也渲染为禁用 input）+[引入×2/取消]，无 get API（数据来自列表行）
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's10-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const LABELS17 = '高管类别/关联客户名称/关联客户编号/证件类型/证件号码/联系电话/性别/出生日期/职业/职务名称/职称/最高学历/最高学位/居住地址/单位电话/工作单位/工作简历描述';

test('S10 同业客户-关联人信息查看（选行→查看→只读弹窗 17 项断言→取消关闭）', async ({ page }) => {
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
    await page.waitForTimeout(4000);
  });

  await test.step('3 关联人信息tab→读首行→选首行radio', async () => {
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first();
    V.tabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(3000);
    const pane = page.locator('.el-tab-pane:visible').last();
    const rpRows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
    const before = await rpRows().count();
    expect(before, '关联人表至少 1 行').toBeGreaterThanOrEqual(1);
    // 首行各列（列序：单选/关联客户编号/关联客户名称/关联人类型/证件类型/证件号码/职务名称）
    const cells = await rpRows().first().locator('td .cell').allInnerTexts();
    V.rowCells = cells.map((c) => c.trim());
    console.log('S10_ROW0=' + JSON.stringify(V.rowCells));
    const first = rpRows().first();
    await first.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    V.rpRadioRect = await first.locator('label.el-radio').first().evaluate(rectEval);
  });

  await test.step('4 点【查看】→ 只读弹窗断言 17 项全 dis + 值 == 行值', async () => {
    const viewBtn = page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /查\s*看/ }).first();
    await expect(viewBtn).toBeEnabled({ timeout: 10_000 });
    V.viewBtnRect = await viewBtn.evaluate(rectEval);
    await viewBtn.click();
    const dlg = page.locator('.el-dialog:visible').last();
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    await expect(dlg.locator('.el-form-item').first(), '弹窗字段异步渲染').toBeVisible({ timeout: 10_000 });
    const items = dlg.locator('.el-form-item:visible');
    expect(await items.count(), '弹窗 17 项').toBe(17);
    const labels: string[] = [];
    for (let i = 0; i < 17; i++) {
      const it = items.nth(i);
      const lb = (await it.locator('label').first().innerText()).trim();
      labels.push(lb);
      const disInp = it.locator('input:visible, textarea:visible');
      const n = await disInp.count();
      expect(n, lb + ' 可见控件').toBeGreaterThanOrEqual(1);
      for (let k = 0; k < n; k++) {
        await expect(disInp.nth(k), lb + ' input/textarea disabled').toBeDisabled();
      }
    }
    expect(labels.join('/'), '17 项 label 顺序').toBe(LABELS17);
    // 值 == 行值（弹窗 5 个可映射列：关联客户编号/关联客户名称/证件类型/证件号码/职务名称）
    const val = async (lb: string) => (await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first().locator('input:visible, textarea:visible').first().inputValue()).trim();
    const row = V.rowCells;
    expect(await val('关联客户编号'), '关联客户编号').toBe(row[1]);
    expect(await val('关联客户名称'), '关联客户名称').toBe(row[2]);
    expect(await val('证件类型'), '证件类型').toBe(row[4]);
    expect(await val('证件号码'), '证件号码').toBe(row[5]);
    expect(await val('职务名称'), '职务名称').toBe(row[6]);
    expect((await val('高管类别')).length, '高管类别非空').toBeGreaterThan(0);
    console.log('S10_VIEW_LABELS=' + labels.join('/'));
    console.log('S10_VIEW_VALS name=' + row[2] + ' no=' + row[1] + ' exec=' + (await val('高管类别')));
  });

  await test.step('5 点【取消】关闭弹窗', async () => {
    const dlg = page.locator('.el-dialog:visible').last();
    const cancelBtn = dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
    V.cancelRect = await cancelBtn.evaluate(rectEval);
    await cancelBtn.click();
    await expect(page.locator('.el-dialog:visible')).toHaveCount(0, { timeout: 10_000 });
  });

  await test.step('6 返回列表→反查 total=1', async () => {
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
  console.log('S10_VALUES_SAVED ' + VALUES_FILE);
});
