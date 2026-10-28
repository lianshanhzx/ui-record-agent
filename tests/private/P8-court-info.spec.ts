import { test, expect } from '@playwright/test';
import { openList, ROWS, pickRow, rowByIndex, reqMethod } from './privateListFields';

const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && r.request().method() === 'POST';
const COURT_API = (r: any) => /custCourtInf/i.test(r.url()) && reqMethod(r) === 'POST';
const FORBIDDEN_ST = ['合并注销', '合并中', '注销'];
const listItem = (page: any, label: string) => page.locator('.el-form-item').filter({ hasText: label }).first();

test.describe('P8 对私客户管理-法院信息', () => {
  test('选AT_潜客行→法院信息弹窗→自动带出查询→类型过滤查询→重置→返回反查', async ({ page }) => {
    test.setTimeout(300_000);
    const courtReqs: string[] = [];
    page.on('request', (r) => {
      if (COURT_API(r)) courtReqs.push(r.postData() || '');
    });

    let rowNo = '';
    let rowNm = '';
    let rowCr = '';
    await test.step('打开对私客户管理页，按客户名称 AT_潜客 查询并选中可用行', async () => {
      await openList(page);
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
      await listItem(page, '客户名称').locator('input').first().fill('AT_潜客');
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      const chosen = await pickRow(page, 'AT_潜客', FORBIDDEN_ST);
      expect(chosen, 'AT_潜客 结果中无可用行').toBeGreaterThanOrEqual(0);
      const m = await rowByIndex(page, chosen);
      rowNo = m['客户编号'] || '';
      rowNm = m['客户名称'] || '';
      rowCr = m['证件号码'] || '';
      expect(rowNm).toContain('AT_潜客');
      expect(rowNo).not.toBe('');
      expect(rowCr).not.toBe('');
      await page.locator('.el-radio:visible').nth(chosen).click();
      await page.waitForTimeout(1000);
    });

    const dlg = page.locator('.el-dialog:visible').filter({ hasText: '法院' }).first();
    await test.step('点【法院信息】打开弹窗，系统带出客户编号/名称/证件号码并自动查询', async () => {
      await page.getByRole('button').filter({ hasText: '法院信息' }).first().click();
      await expect(dlg).toBeVisible({ timeout: 30_000 });
      let waited = 0;
      while (courtReqs.length === 0 && waited < 20_000) {
        await page.waitForTimeout(500);
        waited += 500;
      }
      expect(courtReqs.length).toBeGreaterThan(0);
      const body = JSON.parse(courtReqs[courtReqs.length - 1]);
      console.log('COURT_AUTO_REQ=', JSON.stringify(body));
      expect(body.cstNo).toBe(rowNo);
      expect(body.cstNm).toBe(rowNm);
      expect(body.crdtNo).toBe(rowCr);
      const rows = dlg.locator(ROWS);
      const cnt = await rows.count();
      console.log('COURT_ROWS=', cnt);
      if (cnt > 0) {
        await expect(rows.first()).toBeVisible({ timeout: 10_000 });
      } else {
        await expect(dlg.locator('.el-table__empty-text').first()).toBeVisible({ timeout: 10_000 });
      }
    });

    await test.step('打开「法院信息类型」下拉框，取首项「涉诉」', async () => {
      const tpSelect = dlg
        .locator('.el-form-item')
        .filter({ hasText: '法院信息类型' })
        .first()
        .locator('.el-select');
      await tpSelect.click();
      const dd = page.locator('.el-select-dropdown:visible').last();
      await expect(dd).toBeVisible({ timeout: 10_000 });
      const opts = (await dd.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim());
      console.log('COURT_TP_OPTS=', JSON.stringify(opts));
      expect(opts.length).toBeGreaterThan(0);
      expect(opts[0]).toBe('涉诉');
      await dd.locator('.el-select-dropdown__item').filter({ hasText: '涉诉' }).first().click();
      await expect(
        dlg.locator('.el-form-item').filter({ hasText: '法院信息类型' }).first().locator('input')
      ).toHaveValue('涉诉');
    });

    await test.step('【查询】按 法院信息类型=涉诉 过滤，请求带条件且列表刷新', async () => {
      const before = courtReqs.length;
      await dlg.getByRole('button').filter({ hasText: '查询' }).click();
      let waited = 0;
      while (courtReqs.length < before + 1 && waited < 30_000) {
        await page.waitForTimeout(500);
        waited += 500;
      }
      expect(courtReqs.length).toBeGreaterThan(before);
      const body = JSON.parse(courtReqs[courtReqs.length - 1]);
      console.log('COURT_FILTER_REQ=', JSON.stringify(body));
      expect(String(body.courtInfTp || body.tp || '')).not.toBe('');
      await expect(dlg).toBeVisible();
      const cnt = await dlg.locator(ROWS).count();
      console.log('COURT_FILTER_ROWS=', cnt);
    });

    await test.step('【重置】清空对话框内可编辑查询字段', async () => {
      await dlg.getByRole('button').filter({ hasText: '重置' }).click();
      await page.waitForTimeout(1000);
      await expect(
        dlg.locator('.el-form-item').filter({ hasText: '法院信息类型' }).first().locator('input')
      ).toHaveValue('');
      const vldCnt = await dlg.locator('.el-form-item').filter({ hasText: '是否有效' }).count();
      if (vldCnt > 0) {
        await expect(
          dlg.locator('.el-form-item').filter({ hasText: '是否有效' }).first().locator('input')
        ).toHaveValue('');
      }
      console.log('P8_COURT_OK row=', rowNm);
    });

    await test.step('【返回】关闭弹窗回到列表，按客户名称反查记录仍在', async () => {
      await dlg.getByRole('button').filter({ hasText: '返回' }).click();
      await expect(dlg).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
      await listItem(page, '客户名称').locator('input').first().fill(rowNm);
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      await expect(page.locator(ROWS).filter({ hasText: rowNm }).first()).toBeVisible({ timeout: 30_000 });
      console.log('P8_COURT_ROW=', rowNm);
    });
  });
});
