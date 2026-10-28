import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { inspectPage, runFillPlan, openAllSections, itemValue, randUscc, type FillCtx, type FieldItem } from './fillEngine';

// S2-clean 同业客户-修改客户(干净单次版)
// 链路: 客户编号搜索 → 查询 → 选行 → 修改 → 改明文项 → 暂存 → 反查
// 只改明文项(input/select/date/textarea/switch), 排除 3 引入(import/address)+只读(skip) → 绕开"引入确认回滚"(R1/R2/M-A)
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's2c-values.json');
const PLAN_FILE = path.join(DIR, 's2c-plan.json');
const FILLLOG_FILE = path.join(DIR, 'filllog-S2c.json');

const CUST_NO = '260924144929974126';
const CUST_NM = 'AT_SMB_20260924144917';

const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

const pad = (x: number) => String(x).padStart(2, '0');
const d = new Date();
const TS = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const PHONE = '139' + String(10000000 + Math.floor(Math.random() * 89999999));
const KEEP_TYPES = new Set(['input', 'select', 'date', 'textarea', 'switch']);

test('S2-clean 同业客户-修改客户(单次: 搜索→查询→选行→修改→改明文项→暂存→反查)', async ({ page }) => {
  test.setTimeout(600_000);
  let plan: FieldItem[] = [];
  let orig: Record<string, string> = {};
  let log: any[] = [];

  await test.step('1 打开同业客户管理列表页', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const listReady = page.waitForResponse(LIST_API, { timeout: 120_000 });
    await page.goto(LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await listReady;
    await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
  });

  await test.step('2 客户编号搜索 → 点查询 → total=1', async () => {
    await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
    const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const j = JSON.parse(await (await qP).text());
    expect(j.data.total).toBe(1);
    expect(j.data.list[0].cstNo).toBe(CUST_NO);
    await page.waitForTimeout(1500);
  });

  await test.step('3 选行 Radio → 点【修改】进场景页', async () => {
    const row = page.locator(ROWS).first();
    const rInp = row.locator('input[type="radio"]').first();
    if (await rInp.count().catch(() => 0)) await rInp.evaluate((el: any) => el.click());
    else await row.locator('td').first().click({ force: true });
    await page.waitForTimeout(800);
    const cls = (await row.getAttribute('class').catch(() => '')) || '';
    expect(cls, '行选中态 current-row').toContain('current-row');
    const getCustP = page.waitForResponse((r) => r.url().includes('/custTrade/getCustTrade') && r.request().method() === 'POST', { timeout: 90_000 });
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await getCustP;
    await page.waitForTimeout(4000);
  });

  await test.step('4 场景页盘点(编辑态) + 过滤明文项', async () => {
    await openAllSections(page);
    plan = await inspectPage(page);
    plan = plan.map((it) => (it.label === '银行行号' ? { ...it, type: 'skip', skipNote: '不录: 引入主数据为空' } : it));
    const keep = plan.filter((p) => KEEP_TYPES.has(p.type));
    const skip = plan.filter((p) => !KEEP_TYPES.has(p.type));
    console.log('S2C_PLAN total=' + plan.length + ' keep(明文项)=' + keep.length + ' skip=' + skip.length);
    console.log('S2C_SKIP=' + JSON.stringify(skip.map((s) => s.label + ':' + s.type)));
    expect(keep.length, '明文项数量').toBeGreaterThanOrEqual(40);
    fs.writeFileSync(PLAN_FILE, JSON.stringify({ custNo: CUST_NO, ts: TS, keep: keep.length, items: plan }, null, 2));
    for (const it of keep) orig[it.label] = await itemValue(page, it.label).catch(() => '');
    (globalThis as any).__S2C_KEEP = keep;
  });

  await test.step('5 改值: 明文项全改(新值≠当前值)', async () => {
    const keep: FieldItem[] = (globalThis as any).__S2C_KEEP;
    const ctx: FillCtx = { uscc: randUscc(), instUscc: randUscc(), phone: PHONE, addrDetail: '', tag: 'S2C', mode: 'edit' };
    log = await runFillPlan(page, keep, ctx, FILLLOG_FILE);
    const bad = log.filter((l) => !l.ok && l.action !== 'skip');
    console.log('S2C_FILL total=' + log.length + ' ok=' + log.filter((l) => l.ok).length + ' bad=' + JSON.stringify(bad.map((b) => ({ seq: b.seq, label: b.label, note: b.note }))));
    expect(bad, '明文项填充失败: ' + JSON.stringify(bad.map((b) => b.label + ':' + b.note))).toEqual([]);
    const unchanged: string[] = [];
    for (const l of log) {
      if (l.type === 'skip' || l.action === 'skip') continue;
      const o = (orig[l.label] || '').replace(/[,%\s]/g, '');
      if (!o) continue;
      const n = String(l.value).replace(/[,%\s]/g, '');
      const isNum = (s: string) => /^\d+(\.\d+)?$/.test(s);
      if (String(l.value) === o || (isNum(o) && isNum(n) && parseFloat(o) === parseFloat(n))) unchanged.push(l.label);
    }
    console.log('S2C_UNCHANGED=' + JSON.stringify(unchanged));
    expect(unchanged, '以下字段改后值未变: ' + unchanged.join(',')).toEqual([]);
  });

  await test.step('6 【暂存】→ saveCustTrade 成功', async () => {
    const saveP = page.waitForResponse((r) => r.url().includes('saveCustTrade') && r.request().method() === 'POST', { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /暂\s*存/ }).first().scrollIntoViewIfNeeded().catch(() => {});
    await page.getByRole('button').filter({ hasText: /暂\s*存/ }).first().click();
    const save = await saveP;
    expect(save.status()).toBe(200);
    const body = save.request().postDataJSON();
    expect(body.smbsnCstBaseInf.cstNo).toBe(CUST_NO);
  });

  await test.step('7 【返回】回列表 → 客户编号反查 total=1', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
    const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const j = JSON.parse(await (await qP).text());
    expect(j.data.total).toBe(1);
    expect(j.data.list[0].cstNo).toBe(CUST_NO);
    await expect(page.locator(ROWS).first()).toContainText(CUST_NO, { timeout: 15_000 });
  });

  await test.step('落盘本运行值(供 wire 生成)', async () => {
    fs.writeFileSync(VALUES_FILE, JSON.stringify({ custNo: CUST_NO, custNm: CUST_NM, phone: PHONE, ts: TS, filllog: FILLLOG_FILE, plan: PLAN_FILE }, null, 2));
    console.log('S2C_VALUES_SAVED');
  });
});
