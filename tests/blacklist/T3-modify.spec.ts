import { test, expect, Locator } from '@playwright/test';

const btn = (page: any, text: string): Locator =>
  page.getByRole('button').filter({ hasText: text });
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const selItem = (page: any, label: string): Locator =>
  page.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: label }) }).first();

const CUSTOMER = { name: '杭州云测九一五科技有限公司', short: '杭州云测九一五', no: '26091515250444076' };
const NEW_BLIST_TYPE = '已核销贷款户';
const NEW_REASON = '黑名单自动化录制测试T3修改';

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

// T3 修改黑名单（原子交易）
// 对象：T2b 新增的对公记录（杭州云测九一五），修改黑名单类型 + 加入原因，不动客户要素（修改页锁定）
// 注意：修改对象不能选王静平，否则会破坏 T4 查看的断言值
test.describe('T3 修改黑名单', () => {
      test(`修改 ${CUSTOMER.name} 的黑名单类型与加入原因`, async ({ page }) => {
    await test.step('打开黑名单管理页并检索目标客户', async () => {
      await openList(page);
      await searchByNm(page, CUSTOMER.short);
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no });
      await expect(row, '目标对公记录不存在，请先运行 T2b 新增').toHaveCount(1);
    });

    await test.step('选中目标行并点修改', async () => {
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no }).first();
      await row.waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      await row.locator('td').first().click({ force: true });
      await expect(row.locator('input[type="radio"]').first()).toBeChecked({ timeout: 5_000 });
      await btn(page, '修改').click();
      await page.waitForURL(/modBlist/, { timeout: 20_000 });
      await expect(selItem(page, '黑名单类型')).toBeVisible({ timeout: 15_000 });
    });

    await test.step('断言客户要素被锁定（不可编辑）', async () => {
      await expect(selItem(page, '客户名称').locator('input')).toBeDisabled();
      await expect(selItem(page, '客户编号').locator('input')).toBeDisabled();
      await expect(selItem(page, '证件号码').locator('input')).toBeDisabled();
    });

    await test.step('修改黑名单类型与加入原因', async () => {
      await selItem(page, '黑名单类型').locator('.el-select').click();
      await page.locator('.el-select-dropdown__item:visible', { hasText: NEW_BLIST_TYPE }).first().click();
      await expect(selItem(page, '黑名单类型').locator('input')).toHaveValue(NEW_BLIST_TYPE);
      await selItem(page, '加入原因').locator('textarea').fill(NEW_REASON);
      await expect(selItem(page, '加入原因').locator('textarea')).toHaveValue(NEW_REASON);
    });

    await test.step('保存', async () => {
      const saved = page.waitForResponse(
        (r) => r.url().includes('/tansun-tcp-cst/custBlack/saveOrUpdate'),
        { timeout: 20_000 },
      );
      await btn(page, '保存').click();
      const res = await saved;
      expect(res.status()).toBe(200);
    });

    await test.step('返回列表并验证修改生效', async () => {
      await btn(page, '返回').click();
      await page.waitForURL(/blistMgtPg/, { timeout: 20_000 });
      await expect(selItem(page, '客户名称')).toBeVisible({ timeout: 15_000 });
      await searchByNm(page, CUSTOMER.short);
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row.first()).toContainText(NEW_BLIST_TYPE);
      await expect(row.first()).toContainText(NEW_REASON);
    });
  });
});
