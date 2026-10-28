import { test, expect } from '@playwright/test';
import { openList, ROWS, pickRow, rowByIndex } from './privateListFields';

const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && r.request().method() === 'POST';
const FORBIDDEN_ST = ['合并注销', '合并中', '注销'];
const listItem = (page: any, label: string) => page.locator('.el-form-item').filter({ hasText: label }).first();

test.describe('P7 对私客户管理-查看（详情只读页）', () => {
  test('选AT_潜客行→查看→详情页只读断言→返回反查', async ({ page }) => {
    test.setTimeout(300_000);

    await test.step('打开对私客户管理页，按客户名称 AT_潜客 查询', async () => {
      await openList(page);
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
      await listItem(page, '客户名称').locator('input').first().fill('AT_潜客');
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    });

    let rowNm = '';
    await test.step('选中首条可用记录（客户状态非合并注销/合并中/注销）', async () => {
      const chosen = await pickRow(page, 'AT_潜客', FORBIDDEN_ST);
      expect(chosen, 'AT_潜客 结果中无可用行').toBeGreaterThanOrEqual(0);
      const m = await rowByIndex(page, chosen);
      rowNm = m['客户名称'] || '';
      expect(rowNm).toContain('AT_潜客');
      await page.locator('.el-radio:visible').nth(chosen).click();
      await page.waitForTimeout(1000);
    });

    await test.step('点【查看】进入客户详情只读页（viewType=look）', async () => {
      await page.getByRole('button').filter({ hasText: '查看' }).first().click();
      await page.waitForFunction(() => !location.hash.includes('idcstMgtPg'), { timeout: 60_000 });
      await expect(page).toHaveURL(/viewType=look/, { timeout: 15_000 });
      await expect(listItem(page, '客户名称').locator('input').first()).toHaveValue(rowNm, { timeout: 30_000 });
    });

    await test.step('验证只读：客户名称输入框disabled，无【保存】【暂存】按钮', async () => {
      await expect(listItem(page, '客户名称').locator('input').first()).toBeDisabled();
      const saveCnt = await page.locator('button:visible').filter({ hasText: '保存' }).count();
      const tmpCnt = await page.locator('button:visible').filter({ hasText: '暂存' }).count();
      expect(saveCnt).toBe(0);
      expect(tmpCnt).toBe(0);
      await expect(page.locator('button:visible').filter({ hasText: '返回' }).first()).toBeVisible();
      console.log('P7_VIEW_OK row=', rowNm);
    });

    await test.step('【返回】列表按客户名称反查，记录仍在', async () => {
      await page.getByRole('button').filter({ hasText: '返回' }).first().click({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      if (!page.url().includes('idcstMgtPg')) {
        const listReady = page.waitForResponse(LIST_API, { timeout: 240_000 });
        await page.goto('/#/cstMgt/csinfMnt/prvtCstMgt/idcstMgtPg', { waitUntil: 'domcontentloaded' });
        await listReady;
        await page.waitForTimeout(3000);
      } else {
        await page.waitForResponse(LIST_API, { timeout: 60_000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
      await listItem(page, '客户名称').locator('input').first().fill(rowNm);
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      await expect(page.locator(ROWS).filter({ hasText: rowNm }).first()).toBeVisible({ timeout: 30_000 });
      console.log('P7_VIEW_ROW=', rowNm);
    });
  });
});
