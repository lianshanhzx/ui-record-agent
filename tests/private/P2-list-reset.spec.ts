import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { LIST_API, openList, ROWS, inputListField, expandMore, pickListSelect, pickUserSelect, readFirstRow, switchQuerySort, normRect, fieldRect, btnRect, moreRect, switchRect, dumpSelectOptions } from './privateListFields';

const VALUES_FILE = path.join(__dirname, '..', '..', 'work', 'a02-corp', 'p2-values.json');

test.describe('P2 对私客户管理-列表重置', () => {
  test('录入8项条件后点重置，7输入项清空+开关恢复未选中', async ({ page }) => {
    test.setTimeout(300_000);
    const rects: Record<string, string> = {};

    await test.step('打开对私客户管理页', async () => {
      await openList(page);
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    });

    let first: Record<string, string> = {};
    await test.step('取列表首行并展开次级查询条件', async () => {
      first = await readFirstRow(page);
      console.log('FIRST_ROW=', JSON.stringify(first));
      await expandMore(page);
    });

    await test.step('录入8项查询条件（同P1）', async () => {
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

    await test.step('落盘本运行录入值（供 wire 生成，须在重置前）', async () => {
      for (const lb of ['客户编号', '客户名称', '对私客户细分类型', '证件类型', '证件号码', '客户状态', '管户客户经理名称']) {
        rects[lb] = await fieldRect(page, lb);
      }
      rects['更多'] = await moreRect(page);
      rects['创建时间排序'] = await switchRect(page);
      rects['重置'] = await btnRect(page, '重置');
      const opts: Record<string, string[]> = {};
      opts['对私客户细分类型'] = await dumpSelectOptions(page, '对私客户细分类型', first['客户类型细分'], rects);
      opts['证件类型'] = await dumpSelectOptions(page, '证件类型', first['证件类型'], rects);
      opts['客户状态'] = await dumpSelectOptions(page, '客户状态', first['客户状态'], rects);
      const used: Record<string, string> = {
        '客户编号': first['客户编号'],
        '客户名称': first['客户名称'],
        '对私客户细分类型': first['客户类型细分'],
        '证件类型': first['证件类型'],
        '证件号码': first['证件号码'],
        '客户状态': first['客户状态'],
        '管户客户经理名称': first['管户客户经理'],
      };
      fs.writeFileSync(VALUES_FILE, JSON.stringify({ used, manager: first['管户客户经理'], switchOn: true, rects, opts }, null, 2));
      console.log('P2_VALUES_SAVED');
    });

    await test.step('点击【重置】', async () => {
      await page.locator('button:visible').filter({ hasText: '重置' }).first().click();
      await page.waitForTimeout(1500);
    });

    await test.step('验证：7个查询输入项全部清空、创建时间排序开关恢复未选中', async () => {
      for (const lb of ['客户编号', '客户名称', '证件号码', '管户客户经理名称']) {
        await expect(inputListField(page, lb)).toHaveValue('');
      }
      for (const lb of ['对私客户细分类型', '证件类型', '客户状态']) {
        await expect(
          page.locator('.el-form-item').filter({ hasText: lb }).first().locator('input').first()
        ).toHaveValue('');
      }
      const sw = page.locator('.el-form-item').filter({ hasText: '创建时间排序' }).first().locator('.el-switch').first();
      await expect(sw).not.toHaveClass(/is-on/);
      console.log('P2_RESET_OK');
    });
  });
});
