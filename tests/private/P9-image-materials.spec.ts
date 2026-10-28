import { test, expect } from '@playwright/test';
import { openList, ROWS, pickRow, rowByIndex, reqMethod } from './privateListFields';

const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && r.request().method() === 'POST';
const FILE_API = (r: any) => r.url().includes('pageFileInf') && reqMethod(r) === 'POST';
const FORBIDDEN_ST = ['合并注销', '合并中', '注销'];
const listItem = (page: any, label: string) => page.locator('.el-form-item').filter({ hasText: label }).first();

test.describe('P9 对私客户管理-影像资料（查看权限）', () => {
  test('选AT_潜客行→影像资料全屏浮层→目录树加载文件→取消返回反查', async ({ page }) => {
    test.setTimeout(300_000);
    const fileReqs: string[] = [];
    page.on('request', (r) => {
      if (FILE_API(r)) fileReqs.push(r.postData() || '');
    });

    let rowNo = '';
    let rowNm = '';
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
      expect(rowNm).toContain('AT_潜客');
      expect(rowNo).not.toBe('');
      await page.locator('.el-radio:visible').nth(chosen).click();
      await page.waitForTimeout(1000);
    });

    const overlay = page.locator('.el-dialog__wrapper').filter({ hasText: '影像资料' });
    await test.step('点【影像资料】以查看权限打开全屏浮层，左侧目录树加载', async () => {
      await page.getByRole('button').filter({ hasText: '影像资料' }).first().click();
      await expect(overlay).toBeVisible({ timeout: 60_000 });
      await expect(overlay.locator('.el-tree-node__content:visible').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(2000);
      const nodeTexts = (
        await overlay.locator('.el-tree-node__content:visible').allInnerTexts()
      ).map((s) => s.trim().replace(/\s+/g, ''));
      console.log('TREE_NODES=', JSON.stringify(nodeTexts.slice(0, 20)));
      expect(nodeTexts.length).toBeGreaterThan(0);
      expect(nodeTexts).toContain('客户管理');
      // 实测：浮层关闭按钮为底部右侧【返回】+右上角×（无【取消】，步骤表措辞以实测为准）
      await expect(overlay.getByRole('button').filter({ hasText: '返回' }).first()).toBeVisible();
    });

    await test.step('点击目录树「客户管理」节点，按客户编号加载文件列表', async () => {
      const kmNode = overlay.locator('.el-tree-node__content:visible').filter({ hasText: '客户管理' }).first();
      const nodeText = ((await kmNode.innerText()) || '').trim();
      console.log('KM_NODE=', nodeText);
      await kmNode.click();
      let waited = 0;
      while (fileReqs.length === 0 && waited < 30_000) {
        await page.waitForTimeout(500);
        waited += 500;
      }
      expect(fileReqs.length).toBeGreaterThan(0);
      const body = JSON.parse(fileReqs[fileReqs.length - 1]);
      console.log('FILE_REQ=', JSON.stringify(body));
      expect(body.cstNo).toBe(rowNo);
      expect(body.ctlgNo).toBe('clientMtrl');
      const ths = (await overlay.locator('th .cell:visible').allInnerTexts()).map((s) => s.trim().replace(/\s+/g, '')).join('|');
      console.log('FILE_THS=', ths);
      for (const col of ['文件名称', '文件类型', '上传人', '上传时间', '操作']) {
        expect(ths).toContain(col);
      }
      const rowCnt = await overlay.locator(ROWS).count();
      console.log('FILE_ROWS=', rowCnt);
      if (rowCnt === 0) {
        await expect(overlay.locator('.el-table__empty-text:visible').first()).toBeVisible({ timeout: 10_000 });
      }
    });

    await test.step('【返回】关闭浮层回到列表，按客户名称反查记录仍在', async () => {
      await overlay.getByRole('button').filter({ hasText: '返回' }).first().click();
      await expect(overlay).toBeHidden({ timeout: 30_000 });
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
      await listItem(page, '客户名称').locator('input').first().fill(rowNm);
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      await expect(page.locator(ROWS).filter({ hasText: rowNm }).first()).toBeVisible({ timeout: 30_000 });
      console.log('P9_IMAGE_ROW=', rowNm);
    });
  });
});
