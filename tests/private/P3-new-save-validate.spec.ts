import { test, expect, Locator } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { openList, ROWS, normRect, dumpSelectOptionsIn } from './privateListFields';

const VALUES_FILE = path.join(__dirname, '..', '..', 'work', 'a02-corp', 'p3-values.json');

const CHECK_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/checkCustPersonal') && r.request().method() === 'POST';

const drawer = (page: any) => page.locator('.el-drawer:visible').first();
const formItem = (page: any, label: string) =>
  drawer(page).locator('.el-form-item').filter({ hasText: label }).first();

async function pickSelect(page: any, label: string, optionText: string) {
  await formItem(page, label).locator('.el-select, input').first().click();
  await page.waitForTimeout(800);
  const dd = page.locator('.el-select-dropdown:visible').last();
  await dd.waitFor({ state: 'visible', timeout: 10_000 });
  const opts = dd.locator('.el-select-dropdown__item');
  const n = await opts.count();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    if (((await opts.nth(i).innerText()) || '').trim() === optionText) {
      idx = i;
      break;
    }
  }
  if (idx < 0) throw new Error('option not found: ' + optionText);
  const opt = opts.nth(idx);
  await opt.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await opt.click();
  await page.waitForTimeout(500);
}

test.describe('P3 对私客户管理-新增保存校验', () => {
  test('保存三条校验规则（必输项/18位/已存在）', async ({ page }) => {
    test.setTimeout(300_000);

    await test.step('打开对私客户管理页', async () => {
      await openList(page);
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    });

    await test.step('点击【新增】打开新增客户抽屉（证件类型默认居民身份证）', async () => {
      await page.getByRole('button').filter({ hasText: '新增' }).click();
      await page.waitForSelector('.el-drawer:visible', { timeout: 15_000 });
      await expect(drawer(page)).toBeVisible();
      await expect(formItem(page, '证件类型').locator('input').first()).toHaveValue('居民身份证');
    });

    let checkFired = false;
    let nameRule2 = '';
    page.on('response', (r) => {
      if (CHECK_API(r)) checkFired = true;
    });

    await test.step('规则1 必输项为空点保存 → 5条内联报错，不发起校验请求', async () => {
      await drawer(page).getByRole('button').filter({ hasText: '保存' }).first().click();
      await page.waitForTimeout(1500);
      const errs = drawer(page).locator('.el-form-item__error');
      await expect(errs.filter({ hasText: '请选择客户状态' }).first()).toBeVisible();
      await expect(errs.filter({ hasText: '请选择对私客户类型' }).first()).toBeVisible();
      await expect(errs.filter({ hasText: '请选择对私客户细分类型' }).first()).toBeVisible();
      await expect(errs.filter({ hasText: '请输入证件号码' }).first()).toBeVisible();
      await expect(errs.filter({ hasText: '请输入客户名称' }).first()).toBeVisible();
      expect(checkFired).toBe(false);
      await expect(drawer(page)).toBeVisible();
    });

    await test.step('规则2 身份证证件号码非18位 → 内联报错「请输入有效身份证号码」', async () => {
      await pickSelect(page, '客户状态', '信贷预客户');
      await pickSelect(page, '对私客户类型', '其他自然人');
      await pickSelect(page, '对私客户细分类型', '城镇个体工商户');
      nameRule2 = 'AT_18位校验_' + Date.now();
      await formItem(page, '客户名称').locator('input').first().fill(nameRule2);
      await formItem(page, '证件号码').locator('input').first().fill('12345678901234567');
      await drawer(page).getByRole('button').filter({ hasText: '保存' }).first().click();
      await page.waitForTimeout(1500);
      const errs = drawer(page).locator('.el-form-item__error');
      await expect(errs.filter({ hasText: '请输入有效身份证号码' }).first()).toBeVisible();
      expect(checkFired).toBe(false);
      await expect(drawer(page)).toBeVisible();
    });

    await test.step('规则3 证件号码已存在 → checkCustPersonal 返回 code=100 提示已存在', async () => {
      await formItem(page, '客户名称').locator('input').first().fill('蒲秀英');
      await formItem(page, '证件号码').locator('input').first().fill('120108197911134241');
      const q = page.waitForResponse(CHECK_API, { timeout: 15_000 });
      await drawer(page).getByRole('button').filter({ hasText: '保存' }).first().click();
      const res = await q;
      const j = JSON.parse(await res.text());
      console.log('CHECK_RESP=', JSON.stringify(j).slice(0, 300));
      expect(j.code).toBe(100);
      expect(j.description).toContain('该客户在信贷系统内已存在');
      const reqBody = JSON.parse(res.request().postData() || '{}');
      expect(reqBody.crdtNo).toBe('120108197911134241');
      expect(reqBody.cstNm).toBe('蒲秀英');
      await expect(drawer(page)).toBeVisible();
      console.log('P3_CHECK_OK');
    });

    await test.step('落盘本运行录入值（供 wire 生成）', async () => {
      const rects: Record<string, string> = {};
      const dr = drawer(page);
      rects['新增'] = normRect(await page.getByRole('button').filter({ hasText: '新增' }).first().boundingBox());
      rects['保存'] = normRect(await dr.getByRole('button').filter({ hasText: '保存' }).first().boundingBox());
      for (const lb of ['客户状态', '对私客户类型', '对私客户细分类型', '客户名称', '证件号码']) {
        rects[lb] = normRect(await formItem(page, lb).locator('input').first().boundingBox());
      }
      const db = await dr.boundingBox();
      const drawerRectPx = db ? { x1: db.x, y1: db.y, x2: db.x + db.width, y2: db.y + db.height } : null;
      const opts: Record<string, string[]> = {};
      opts['客户状态'] = await dumpSelectOptionsIn(page, dr, '客户状态', '信贷预客户', rects);
      opts['对私客户类型'] = await dumpSelectOptionsIn(page, dr, '对私客户类型', '其他自然人', rects);
      opts['对私客户细分类型'] = await dumpSelectOptionsIn(page, dr, '对私客户细分类型', '城镇个体工商户', rects);
      fs.writeFileSync(VALUES_FILE, JSON.stringify({
        nameRule2,
        nameRule3: '蒲秀英', crdtNoRule2: '12345678901234567', crdtNoRule3: '120108197911134241',
        st: '信贷预客户', tp: '其他自然人', sbdvsn: '城镇个体工商户',
        drawerRectPx, rects, opts
      }, null, 2));
      console.log('P3_VALUES_SAVED');
    });
  });
});
