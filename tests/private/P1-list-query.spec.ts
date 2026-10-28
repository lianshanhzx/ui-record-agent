import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { reqMethod, openList, ROWS, inputListField, expandMore, pickListSelect, pickUserSelect, readFirstRow, switchQuerySort, normRect, fieldRect, btnRect, moreRect, switchRect, dumpSelectOptions } from './privateListFields';

const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && reqMethod(r) === 'POST';
const VALUES_FILE = path.join(__dirname, '..', '..', 'work', 'a02-corp', 'p1-values.json');

test.describe('P1 对私客户管理-列表查询', () => {
  test('展开次级条件后8项组合查询，请求全参数命中唯一记录', async ({ page }) => {
    test.setTimeout(300_000);
    const rects: Record<string, string> = {};
    const reqs: string[] = [];
    page.on('request', (r) => {
      if (LIST_API(r)) reqs.push(r.postData() || '');
    });

    await test.step('打开对私客户管理页', async () => {
      await openList(page);
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    });

    let first: Record<string, string> = {};
    await test.step('取列表首行（表头：客户编号/客户名称/证件类型/证件号码/客户类型细分/管户客户经理/管户机构/客户状态）', async () => {
      first = await readFirstRow(page);
      console.log('FIRST_ROW=', JSON.stringify(first));
      expect(first['客户编号']).toBeTruthy();
      expect(first['客户名称']).toBeTruthy();
      expect(first['客户类型细分']).toBeTruthy();
      expect(first['证件类型']).toBeTruthy();
      expect(first['证件号码']).toBeTruthy();
      expect(first['客户状态']).toBeTruthy();
      expect(first['管户客户经理']).toBeTruthy();
    });

    await test.step('点击 ▼ 展开按钮展开次级查询条件（默认仅3项，展开后8项）', async () => {
      await expandMore(page);
      await expect(inputListField(page, '证件类型')).toBeVisible();
      await expect(inputListField(page, '管户客户经理名称')).toBeVisible();
      await expect(page.locator('.el-form-item').filter({ hasText: '创建时间排序' }).first()).toBeVisible();
    });

    await test.step('录入8项查询条件（取首行值；创建时间排序开关切选中）', async () => {
      await inputListField(page, '客户编号').fill(first['客户编号']);
      await inputListField(page, '客户名称').fill(first['客户名称']);
      await pickListSelect(page, '对私客户细分类型', first['客户类型细分']);
      await pickListSelect(page, '证件类型', first['证件类型']);
      await inputListField(page, '证件号码').fill(first['证件号码']);
      await pickListSelect(page, '客户状态', first['客户状态']);
      await pickUserSelect(page, '管户客户经理名称', first['管户客户经理'], async (search, row) => {
        rects['管户客户经理名称-搜索'] = normRect(await search.boundingBox());
        rects['管户客户经理名称-选择'] = normRect(await row.boundingBox());
      });
      await switchQuerySort(page, true);
    });

    await test.step('点击【查询】：请求8参数全非空且命中唯一一条记录', async () => {
      const before = reqs.length;
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      expect(reqs.length).toBeGreaterThan(before);
      const body = JSON.parse(reqs[reqs.length - 1]);
      console.log('QUERY_REQ=', JSON.stringify(body));
      expect(body.cstNo).toBe(first['客户编号']);
      expect(body.cstNmLike).toBe(first['客户名称']);
      expect(body.prvtCstSbdvsnTp).toBeTruthy();
      expect(body.crdtTp).toBeTruthy();
      expect(body.crdtNo).toBe(first['证件号码']);
      expect(body.cstSt).toBeTruthy();
      expect(String(body.usrNo)).toBeTruthy();
      expect(['1', 1]).toContain(body.orderBy);
      const rows = page.locator(ROWS);
      await expect(rows.first()).toBeVisible({ timeout: 30_000 });
      expect(await rows.count()).toBe(1);
      expect(await rows.first().innerText()).toContain(first['客户名称']);
      console.log('P1_QUERY_OK cstNo=' + first['客户编号']);
    });

    await test.step('落盘本运行录入值（供 wire 生成）', async () => {
      for (const lb of ['客户编号', '客户名称', '对私客户细分类型', '证件类型', '证件号码', '客户状态', '管户客户经理名称']) {
        rects[lb] = await fieldRect(page, lb);
      }
      rects['更多'] = await moreRect(page);
      rects['创建时间排序'] = await switchRect(page);
      rects['查询'] = await btnRect(page, '查询');
      const opts: Record<string, string[]> = {};
      opts['对私客户细分类型'] = await dumpSelectOptions(page, '对私客户细分类型', first['客户类型细分'], rects);
      opts['证件类型'] = await dumpSelectOptions(page, '证件类型', first['证件类型'], rects);
      opts['客户状态'] = await dumpSelectOptions(page, '客户状态', first['客户状态'], rects);
      fs.writeFileSync(VALUES_FILE, JSON.stringify({ row: first, manager: first['管户客户经理'], switchOn: true, rects, opts }, null, 2));
      console.log('P1_VALUES_SAVED');
    });
  });
});
