import { test, expect, Locator } from '@playwright/test';

const btn = (page: any, text: string): Locator =>
  page.getByRole('button').filter({ hasText: text });

const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';

// T1 黑名单查询（原子交易）
// 需求 §3.2.1：进入黑名单管理 → 输入查询条件 → 查询 → 列表返回匹配结果 → 重置恢复全量
test.describe('T1 黑名单查询', () => {
  test('按客户名称查询并重置', async ({ page }) => {
    await test.step('打开黑名单管理页', async () => {
      const listReady = page.waitForResponse(
        (r) => r.url().includes('/tansun-tcp-cst/custBlack/page') && r.request().method() === 'POST',
        { timeout: 30_000 },
      );
      await page.goto('/#/cstMgt/nmlstMgt/blistMgt/blistMgtPg');
      await listReady;
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 15_000 });
    });

    const cstNmInput = page
      .locator('.el-form-item')
      .filter({ hasText: '客户名称' })
      .locator('input');

    await test.step('输入客户名称=厦门 并查询', async () => {
      await cstNmInput.fill('厦门');
      await btn(page, '查询').click();
      // 行数随环境数据浮动（含"厦门"字样的客户可能增加），用下界断言+轮询等表格渲染完成；具体行在下一步断言
      await expect(async () => page.locator(ROWS).count()).resolves.toBeGreaterThanOrEqual(2);
    });

    await test.step('断言查询结果', async () => {
      const rows = page.locator(ROWS);
      await expect(rows.filter({ hasText: '元初' }).first()).toBeVisible();
      await expect(rows.filter({ hasText: '钨业' }).first()).toBeVisible();
    });

    await test.step('重置清空条件并重新查询恢复全量列表', async () => {
      await btn(page, '重置').click();
      await expect(cstNmInput).toHaveValue('');
      // 组件表单状态重置是异步的，需等其完成再查询，否则查询会带旧条件（cstNm=厦门）
      await page.waitForTimeout(1000);
      const refreshed = page.waitForResponse(
        (r) => r.url().includes('/tansun-tcp-cst/custBlack/page') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      await btn(page, '查询').click();
      const res = await refreshed;
      const body = JSON.parse(res.request().postData() || '{}');
      expect(body.cstNm ?? '', '重置后查询条件应为空').toBe('');
      // 全量行数随测试数据增长（T2a/T2b 新增后为 8 行），用下界断言+轮询等表格渲染完成
      await expect(async () => page.locator(ROWS).count()).resolves.toBeGreaterThanOrEqual(6);
    });
  });
});
