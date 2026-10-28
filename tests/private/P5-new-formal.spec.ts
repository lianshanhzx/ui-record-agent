import { test, expect, Locator } from '@playwright/test';
import * as path from 'path';
import { openList, ROWS } from './privateListFields';
import { inspectPage, runFillPlan, openAllSections, measureAndSaveRects, clickTmpSave, FieldItem, FillLogEntry } from './fillEngine';
import { genIdNo, ts14 } from './idgen';

const CHECK_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/checkCustPersonal') && r.request().method() === 'POST';
const SAVE_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/updateCustBase') && r.request().method() === 'POST';
const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && r.request().method() === 'POST';

const drawer = (page: any) => page.locator('.el-drawer:visible').first();
const drawerItem = (page: any, label: string) => drawer(page).locator('.el-form-item').filter({ hasText: label }).first();
const listItem = (page: any, label: string) => page.locator('.el-form-item').filter({ hasText: label }).first();

async function pickSelect(page: any, item: Locator, optionText: string) {
  await item.locator('.el-select, input').first().click();
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

test.describe('P5 对私客户管理-新增正式客户场景(基本信息组件版)', () => {
  test('新增保存→正式场景页【基本信息】按序全字段填充→暂存→列表反查', async ({ page }) => {
    test.setTimeout(600_000);
    const idNo = genIdNo();
    const nm = 'AT_正式_' + ts14();
    const ctx = {
      phone: '139' + String(Date.now() % 1e8).padStart(8, '0'),
      idNo,
      addrDetail: 'AT测试地址100号',
      tag: 'P5',
    };

    await test.step('打开对私客户管理页', async () => {
      await openList(page);
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    });

    await test.step('点击【新增】，录入信贷正式客户+其他自然人+城镇个体工商户+名称+随机18位身份证，点【保存】', async () => {
      await page.getByRole('button').filter({ hasText: '新增' }).click();
      await page.waitForSelector('.el-drawer:visible', { timeout: 15_000 });
      await expect(drawer(page)).toBeVisible();
      await pickSelect(page, drawerItem(page, '客户状态'), '信贷正式客户');
      await pickSelect(page, drawerItem(page, '对私客户类型'), '其他自然人');
      await pickSelect(page, drawerItem(page, '对私客户细分类型'), '城镇个体工商户');
      await expect(drawerItem(page, '证件类型').locator('input').first()).toHaveValue('居民身份证');
      await drawerItem(page, '客户名称').locator('input').first().fill(nm);
      await drawerItem(page, '证件号码').locator('input').first().fill(idNo);
      const q = page.waitForResponse(CHECK_API, { timeout: 30_000 });
      await drawer(page).getByRole('button').filter({ hasText: '保存' }).first().click();
      const res = await q;
      const j = JSON.parse(await res.text());
      console.log('CHECK_RESP=', JSON.stringify(j).slice(0, 300));
      expect(j.status).toBe(200);
      expect(j.data.cstNo).toBeTruthy();
      await page.waitForFunction(
        () => !location.hash.includes('idcstMgtPg') && /fcnScnEcd=FS\d{8}/.test(location.hash),
        { timeout: 60_000 }
      );
      await page.waitForTimeout(3000);
    });

    await test.step('正式场景页带出客户信息（FS00001360, 客户名称/证件号码反显）', async () => {
      await expect(page).toHaveURL(/fcnScnEcd=FS\d{8}/, { timeout: 15_000 });
      await expect(listItem(page, '客户名称').locator('input').first()).toHaveValue(nm, { timeout: 30_000 });
      await expect(listItem(page, '证件号码').locator('input').first()).toHaveValue(idNo);
    });

    const logPath = path.join(__dirname, '..', '..', 'work', 'a02-corp', 'filllog-P5.json');
    let plan: FieldItem[] = [];
    let fillLog: FillLogEntry[] = [];
    await test.step('展开各小节并盘点【基本信息】组件字段(分组+视觉顺序+类型)', async () => {
      await openAllSections(page);
      plan = await inspectPage(page, '基本信息');
      expect(plan.length).toBeGreaterThan(5);
      const groups = [...new Set(plan.map((p) => p.group))];
      expect(groups).toEqual(['基本信息']);
      for (const p of plan) console.log(`PLAN seq=${p.seq} g=${p.group} label=${p.label} type=${p.type} req=${p.req ? 1 : 0} btns=${p.btns.join('/')}`);
    });

    await test.step('严格按盘点顺序逐项填充+断言+标记(输出filllog-P5)', async () => {
      fillLog = await runFillPlan(page, plan, ctx, logPath);
      const failed = fillLog.filter((l) => !l.ok);
      for (const f of failed) console.log(`FAILED seq=${f.seq} label=${f.label} type=${f.type} action=${f.action} note=${f.note}`);
      expect(failed.length).toBe(0);
    });

    await test.step('重测全部项绝对坐标(与滚动无关)回写filllog', async () => {
      await measureAndSaveRects(page, plan, fillLog, logPath, 'P5');
    });

    await test.step('点击【暂存】落库', async () => {
      const { url, j } = await clickTmpSave(page, SAVE_API);
      console.log('TEMPSAVE_URL=', url);
      console.log('TEMPSAVE_RESP=', JSON.stringify(j).slice(0, 300));
      expect(j.status).toBe(200);
      expect(j.description).toBe('操作成功');
    });

    await test.step('【返回】列表按客户名称反查，新记录存在', async () => {
      // 正式场景页无【返回】按钮（仅 保存/暂存/取消），尽力点击，不存在则走下方 goto 列表路由兜底
      await page.getByRole('button').filter({ hasText: '返回' }).first().click({ timeout: 5_000 }).catch(() => {});
      await page
        .locator('.el-message-box:visible button:has-text("确 定"), .el-message-box:visible button:has-text("确定"), .el-message-box:visible button:has-text("确认")')
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(1500);
      if (!page.url().includes('idcstMgtPg')) {
        // 正式场景页无【返回】：goto 列表路由；列表首载接口与【查询】触发的 queryUnion 不必然同形，
        // 故按 UI 就绪（查询按钮可见）等待，与回放引擎 gotoReady 口径一致
        await page.goto('/#/cstMgt/csinfMnt/prvtCstMgt/idcstMgtPg', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('button:visible').filter({ hasText: '查询' }).first()).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(3000);
      } else {
        await page.waitForResponse(LIST_API, { timeout: 60_000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
      await listItem(page, '客户名称').locator('input').first().fill(nm);
      const q = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      await expect(page.locator(ROWS).filter({ hasText: nm }).first()).toBeVisible({ timeout: 30_000 });
      console.log('P5_NEW_ROW=', nm);
    });
  });
});
