import { test, expect, Locator } from '@playwright/test';

const btn = (page: any, text: string): Locator =>
  page.getByRole('button').filter({ hasText: text });
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const selItem = (page: any, label: string): Locator =>
  page.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: label }) }).first();

const CUSTOMER = {
  name: '交通银行股份有限公司厦门分行',
  short: '交通银行',
  no: '26051920431217102',
  certType: '营业执照',
  certNo: '91350200855005712X',
};
const BLIST_TYPE = '五级分类为次级/可疑/损失';
const INTERCEPT = '仅预警不阻断';
const REASON = '黑名单自动化录制测试T2c';

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

// T2c 新增黑名单（原子交易，同业客户）
// 与 T2a(对私)/T2b(对公) 的差异：客户放大镜切"同业客户" tab（API custTrade/queryTradeMagnifierList）
test.describe('T2c 新增黑名单-同业客户', () => {
  test(`同业客户 ${CUSTOMER.name} 加入黑名单`, async ({ page }) => {
    await test.step('打开黑名单管理页', async () => {
      await openList(page);
    });

    await test.step('前置清理：若客户已在黑名单则先删除（保证可重复回放）', async () => {
      await searchByNm(page, CUSTOMER.short);
      const exist = page.locator(ROWS).filter({ hasText: CUSTOMER.no });
      if (await exist.count()) {
        await exist.first().waitFor({ state: 'visible' });
        await page.waitForTimeout(500);
        await exist.first().locator('td').first().click({ force: true });
        await expect(exist.first().locator('input[type="radio"]').first()).toBeChecked({ timeout: 5_000 });
        await btn(page, '删除').click();
        const box = page.locator('.el-message-box:visible');
        await expect(box).toBeVisible();
        await expect(box).toContainText('您确定删除这条记录吗');
        const refreshed = page.waitForResponse(
          (r) => r.url().includes('/tansun-tcp-cst/custBlack/') && r.request().method() === 'POST',
          { timeout: 15_000 },
        );
        await box.locator('.el-message-box__btns .el-button--primary').click();
        await refreshed;
        await expect(page.locator(ROWS).filter({ hasText: CUSTOMER.no })).toHaveCount(0);
      }
    });

    await test.step('进入新增页', async () => {
      await btn(page, '新增').click();
      await page.waitForURL(/crtBlist/, { timeout: 20_000 });
      await expect(selItem(page, '黑名单类型')).toBeVisible();
    });

    await test.step('引入：客户放大镜切同业客户 tab 并选择客户', async () => {
      await btn(page, '引入').click();
      const dlg = page.locator('.el-dialog:visible');
      await expect(dlg).toBeVisible();
      await expect(dlg).toContainText('客户放大镜');
      await dlg.getByRole('button').filter({ hasText: '同业客户' }).first().click();
      await page.waitForTimeout(1500);
      await dlg.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label', { hasText: '客户名称' }) }).locator('input').fill(CUSTOMER.short);
      const searched = page.waitForResponse(
        (r) => r.url().includes('queryTradeMagnifierList') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await dlg.getByRole('button').filter({ hasText: '查询' }).click();
      await searched;
      await page.waitForTimeout(1000);
      const row = dlg.locator(ROWS).filter({ hasText: CUSTOMER.no });
      await expect(row.first(), '同业放大镜应找到目标客户').toBeVisible({ timeout: 10_000 });
      await page.waitForTimeout(500);
      await row.first().locator('td').first().click({ force: true });
      await expect(row.first().locator('input[type="radio"]').first()).toBeChecked({ timeout: 5_000 });
      await dlg.getByRole('button').filter({ hasText: '确认' }).click();
      await expect(dlg).toBeHidden();
    });

    await test.step('断言客户信息自动回填', async () => {
      await expect(selItem(page, '客户名称').locator('input')).toHaveValue(CUSTOMER.name);
      await expect(selItem(page, '客户编号').locator('input')).toHaveValue(CUSTOMER.no);
      await expect(selItem(page, '证件类型').locator('input')).toHaveValue(CUSTOMER.certType);
      await expect(selItem(page, '证件号码').locator('input')).toHaveValue(CUSTOMER.certNo);
    });

    await test.step('选择黑名单类型与拦截等级', async () => {
      await selItem(page, '黑名单类型').locator('.el-select').click();
      await page.locator('.el-select-dropdown__item:visible', { hasText: BLIST_TYPE }).first().click();
      await expect(selItem(page, '黑名单类型').locator('input')).toHaveValue(BLIST_TYPE);
      await selItem(page, '拦截等级标识').locator('.el-select').click();
      await page.locator('.el-select-dropdown__item:visible', { hasText: INTERCEPT }).first().click();
      await expect(selItem(page, '拦截等级标识').locator('input')).toHaveValue(INTERCEPT);
    });

    await test.step('填写加入原因（其余字段保持默认值）', async () => {
      await selItem(page, '加入原因').locator('textarea').fill(REASON);
      await expect(selItem(page, '认定类型').locator('input')).toHaveValue('人工');
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

    await test.step('返回列表并验证新记录', async () => {
      await btn(page, '返回').click();
      await page.waitForURL(/blistMgtPg/, { timeout: 20_000 });
      await expect(selItem(page, '客户名称')).toBeVisible({ timeout: 15_000 });
      await searchByNm(page, CUSTOMER.short);
      const row = page.locator(ROWS).filter({ hasText: CUSTOMER.no });
      await expect(row, '新同业记录应出现在黑名单列表').toHaveCount(1, { timeout: 15_000 });
      await expect(row.first()).toContainText(BLIST_TYPE);
      await expect(row.first()).toContainText(REASON);
    });
  });
});
