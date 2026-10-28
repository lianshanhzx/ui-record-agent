import { test, expect } from '@playwright/test';
import * as path from 'path';
import { openList, ROWS, pickRow, rowByIndex } from './privateListFields';
import { inspectPage, runFillPlan, openAllSections, measureAndSaveRects, clickTmpSave, FieldItem, FillLogEntry } from './fillEngine';

const SAVE_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/updateCustBase') && r.request().method() === 'POST';
const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && r.request().method() === 'POST';
const FORBIDDEN_ST = ['合并注销', '合并中', '注销'];
const listItem = (page: any, label: string) => page.locator('.el-form-item').filter({ hasText: label }).first();

test.describe('P6 对私客户管理-修改（潜在客户场景, 引擎版）', () => {
  test('列表选AT_潜客行→修改→基本信息组件按序全字段填充→暂存→列表反查', async ({ page }) => {
    test.setTimeout(600_000);

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
    await test.step('选中首条可修改记录（客户状态非合并注销/合并中/注销）', async () => {
      const chosen = await pickRow(page, 'AT_潜客', FORBIDDEN_ST);
      expect(chosen, 'AT_潜客 结果中无可修改行（状态均为合并注销/合并中/注销）').toBeGreaterThanOrEqual(0);
      const m = await rowByIndex(page, chosen);
      rowNm = m['客户名称'] || '';
      expect(rowNm).toContain('AT_潜客');
      await page.locator('.el-radio:visible').nth(chosen).click();
      await page.waitForTimeout(1000);
    });

    await test.step('点【修改】进入场景修改页（编辑态）', async () => {
      await page.getByRole('button').filter({ hasText: '修改' }).first().click();
      await page.waitForFunction(() => !location.hash.includes('idcstMgtPg'), { timeout: 60_000 });
      await expect(page).toHaveURL(/fcnScnEcd=FS\d{8}/, { timeout: 15_000 });
      await expect(listItem(page, '客户名称').locator('input').first()).toHaveValue(rowNm, { timeout: 30_000 });
      await page.waitForTimeout(2000);
    });

    const logPath = path.join(__dirname, '..', '..', 'work', 'a02-corp', 'filllog-P6.json');
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const ctx = {
      phone: '139' + String(Date.now() % 1e8).padStart(8, '0'),
      idNo: '',
      addrDetail: 'AT测试地址100号',
      tag: 'P6' + ts,
    };

    let plan: FieldItem[] = [];
    let fillLog: FillLogEntry[] = [];
    await test.step('展开各小节并盘点【基本信息】组件字段(编辑态)', async () => {
      await openAllSections(page);
      plan = await inspectPage(page, '基本信息');
      expect(plan.length).toBeGreaterThan(5);
      const groups = [...new Set(plan.map((p) => p.group))];
      expect(groups).toEqual(['基本信息']);
      for (const p of plan) console.log(`PLAN seq=${p.seq} g=${p.group} label=${p.label} type=${p.type} req=${p.req ? 1 : 0} btns=${p.btns.join('/')}`);
    });

    await test.step('严格按盘点顺序逐项填充+断言+标记(输出filllog-P6)', async () => {
      fillLog = await runFillPlan(page, plan, ctx, logPath);
      const failed = fillLog.filter((l) => !l.ok);
      for (const f of failed) console.log(`FAILED seq=${f.seq} label=${f.label} type=${f.type} action=${f.action} note=${f.note}`);
      expect(failed.length).toBe(0);
    });

    await test.step('重测全部项绝对坐标(与滚动无关)回写filllog', async () => {
      await measureAndSaveRects(page, plan, fillLog, logPath, 'P6');
    });

    await test.step('点击【暂存】落库', async () => {
      const { url, j } = await clickTmpSave(page, SAVE_API);
      console.log('TEMPSAVE_URL=', url);
      console.log('TEMPSAVE_RESP=', JSON.stringify(j).slice(0, 300));
      expect(j.status).toBe(200);
      expect(j.description).toBe('操作成功');
    });

    await test.step('【返回】列表按客户名称反查，记录仍在', async () => {
      await page.getByRole('button').filter({ hasText: '返回' }).first().click({ timeout: 30_000 });
      await page
        .locator('.el-message-box:visible button:has-text("确 定"), .el-message-box:visible button:has-text("确定"), .el-message-box:visible button:has-text("确认")')
        .first()
        .click({ timeout: 5000 })
        .catch(() => {});
      await page.waitForFunction(() => location.hash.includes('idcstMgtPg'), { timeout: 120_000 }).catch(() => {});
      if (!page.url().includes('idcstMgtPg')) {
        const listReady = page.waitForResponse(LIST_API, { timeout: 240_000 });
        await page.goto('/#/cstMgt/csinfMnt/prvtCstMgt/idcstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
        await listReady;
      }
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('button')).some(
            (b) => (b.innerText || '').trim() === '查询' && (b as HTMLElement).offsetParent !== null
          ),
        { timeout: 240_000 }
      );
      await listItem(page, '客户名称').locator('input').first().fill(rowNm);
      const q = page.waitForResponse(LIST_API, { timeout: 60_000 });
      await page.locator('button:visible').filter({ hasText: '查询' }).first().click();
      await q;
      await expect(page.locator(ROWS).filter({ hasText: rowNm }).first()).toBeVisible({ timeout: 30_000 });
      console.log('P6_MODIFY_ROW=', rowNm);
    });
  });
});
