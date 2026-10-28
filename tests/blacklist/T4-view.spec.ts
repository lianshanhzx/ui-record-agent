import { test, expect, Locator } from '@playwright/test';

const btn = (page: any, text: string): Locator =>
  page.getByRole('button').filter({ hasText: text });
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const selItem = (page: any, label: string): Locator =>
  page.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: label }) }).first();

const CUSTOMER = { name: '王静平', no: '26080517362620420', certType: '居民身份证', certNo: '620100198509067169' };
const BLIST_TYPE = '五级分类为次级/可疑/损失';
const INTERCEPT = '仅预警不阻断';
const REASON = '黑名单自动化录制测试T2';

async function openList(page: any) {
  const ready = page.waitForResponse(
    (r) => r.url().includes('/tansun-tcp-cst/custBlack/page') && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await page.goto('/#/cstMgt/nmlstMgt/blistMgt/blistMgtPg');
  await ready;
  await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 15_000 });
}

async function searchByNm(page: any, nm: string) {
  await selItem(page, '客户名称').locator('input').fill(nm);
  const refreshed = page.waitForResponse(
    (r) => r.url().includes('/tansun-tcp-cst/custBlack/page') && r.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await btn(page, '查询').first().click();
  await refreshed;
}

// T4 查看黑名单（原子交易，只读）
// 需求 §3.2 查看：列表选中行 → 查看 → 只读详情（viewType=look）→ 字段与列表一致 → 返回
test.describe('T4 查看黑名单', () => {
  test(`查看 ${CUSTOMER.name} 的黑名单详情`, async ({ page }) => {
    await test.step('打开黑名单管理页并检索目标客户', async () => {
      await openList(page);
      await searchByNm(page, CUSTOMER.name);
      await expect(page.locator(ROWS).filter({ hasText: CUSTOMER.no })).toHaveCount(1);
    });

    await test.step('选中目标行（radio）', async () => {
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no }).first();
      await row.waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      await row.locator('td').first().click({ force: true });
      await expect(row.locator('input[type="radio"]').first()).toBeChecked({ timeout: 5_000 });
    });

    await test.step('点击查看进入只读详情', async () => {
      await btn(page, '查看').click();
      await page.waitForURL(/blistInf|hpermUsrEnqrBlistInf/, { timeout: 20_000 });
      await expect(selItem(page, '客户名称').locator('input')).toBeVisible({ timeout: 15_000 });
    });

    await test.step('断言只读字段与列表数据一致', async () => {
      await expect(selItem(page, '客户编号').locator('input')).toHaveValue(CUSTOMER.no);
      await expect(selItem(page, '客户名称').locator('input')).toHaveValue(CUSTOMER.name);
      await expect(selItem(page, '证件类型').locator('input')).toHaveValue(CUSTOMER.certType);
      await expect(selItem(page, '证件号码').locator('input')).toHaveValue(CUSTOMER.certNo);
      await expect(selItem(page, '黑名单类型').locator('input')).toHaveValue(BLIST_TYPE);
      await expect(selItem(page, '拦截等级').locator('input')).toHaveValue(INTERCEPT);
      await expect(selItem(page, '加入理由').locator('input, textarea').first()).toHaveValue(REASON);
    });

    await test.step('返回黑名单列表', async () => {
      await btn(page, '返回').click();
      await page.waitForURL(/blistMgtPg/, { timeout: 20_000 });
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 15_000 });
    });
  });
});
