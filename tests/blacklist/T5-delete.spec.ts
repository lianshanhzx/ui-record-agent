import { test, expect, Locator } from '@playwright/test';

const btn = (page: any, text: string): Locator =>
  page.getByRole('button').filter({ hasText: text });
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const selItem = (page: any, label: string): Locator =>
  page.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: label }) }).first();

const CUSTOMER = { name: '交通银行股份有限公司厦门分行', short: '交通银行', no: '26051920431217102' };

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

// T5 删除黑名单（原子交易）
// 对象：T2c 新增的同业记录（交通银行股份有限公司厦门分行）
test.describe('T5 删除黑名单', () => {
  test(`删除 ${CUSTOMER.name} 的黑名单记录`, async ({ page }) => {
    await test.step('打开黑名单管理页并检索目标客户', async () => {
      await openList(page);
      await searchByNm(page, CUSTOMER.short);
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no });
      await expect(row, '目标同业记录不存在，请先运行 T2c 新增').toHaveCount(1);
    });

    await test.step('选中目标行并点删除', async () => {
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no }).first();
      await row.waitFor({ state: 'visible' });
      await page.waitForTimeout(500);
      await row.locator('td').first().click({ force: true });
      await expect(row.locator('input[type="radio"]').first()).toBeChecked({ timeout: 5_000 });
      await btn(page, '删除').click();
    });

    await test.step('确认删除（消息框）', async () => {
      const box = page.locator('.el-message-box:visible');
      await expect(box).toBeVisible();
      await expect(box).toContainText('您确定删除这条记录吗');
      const deleted = page.waitForResponse(
        (r) => r.url().includes('/tansun-tcp-cst/custBlack/') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await box.locator('.el-message-box__btns .el-button--primary').click();
      const res = await deleted;
      expect(res.status()).toBe(200);
      await expect(box).toBeHidden();
    });

    await test.step('验证记录已删除', async () => {
      await searchByNm(page, CUSTOMER.short);
      await expect(page.locator(ROWS).filter({ hasText: CUSTOMER.no })).toHaveCount(0, { timeout: 10_000 });
    });
  });
});
