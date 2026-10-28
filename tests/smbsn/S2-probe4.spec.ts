import { test, expect } from '@playwright/test';
import path from 'path';
import { inspectPage, runFillPlan, openAllSections, itemValue, randUscc, type FillCtx } from './fillEngine';

const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('probe4: 明文项先改全 -> 暂存(表单是否保留) -> 法代引入 -> 地址引入 -> 注册资本 -> 全量复读', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const apiLog: any[] = [];
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/prod-api/')) {
      try {
        const ct = (r.headers()['content-type'] || '');
        if (ct.includes('json')) {
          const j = await r.json();
          apiLog.push({ t: Date.now(), u: r.url().split('/prod-api/')[1] });
        }
      } catch {}
    }
  });

  const listReady = page.waitForResponse(LIST_API, { timeout: 120_000 });
  await page.goto(LIST_ROUTE, { waitUntil: 'domcontentloaded' });
  await listReady;
  await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
  await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
  const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(1500);
  const row = page.locator(ROWS).first();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el: any) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('/custTrade/getCustTrade') && r.request().method() === 'POST', { timeout: 90_000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await getCustP;
  await page.waitForTimeout(4000);

  await openAllSections(page);
  const plan = (await inspectPage(page)).map((it) =>
    it.label === '银行行号' ? { ...it, type: 'skip', skipNote: '不录' } : it
  );
  const LBL = { LEGAL: '法定代表人/负责人姓名', ADDR: '登记注册地址', ZZ: '注册资本金额' };
  const iLegal = plan.findIndex((p) => p.label === LBL.LEGAL);
  const c1 = plan.slice(0, iLegal);
  const plains = plan.filter((p) => p.type !== 'skip' && p.label !== LBL.LEGAL && p.label !== LBL.ADDR && p.label !== LBL.ZZ);
  const ctx: FillCtx = { uscc: randUscc(), instUscc: randUscc(), phone: '13911112222', addrDetail: 'AT改测试路99号', tag: 'P4', mode: 'edit' };
  const read = async (lb: string) => itemValue(page, lb).catch(() => 'READ_ERR');
  const SPOT = ['客户简称', '金融许可证号', '经营范围', '联系人姓名', '投资总额（元）'];

  // Phase 1: C1 + 全部明文(去 ZZ/法代/地址)
  await runFillPlan(page, [...c1, ...plains], { ...ctx, tag: 'P4-P1' }, undefined);
  console.log('P4 P1 done. spot=', JSON.stringify(Object.fromEntries(await Promise.all(SPOT.map(async (s) => [s, await read(s)])))));

  // Phase 2: 暂存 (观察: 是否跳转 / saveCustTrade)
  apiLog.length = 0;
  const saveP = page.waitForResponse((r) => r.url().includes('saveCustTrade') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /暂\s*存/ }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.getByRole('button').filter({ hasText: /暂\s*存/ }).first().click();
  const save = await saveP;
  console.log('P4 SAVE status=' + save.status() + ' url_after=' + page.url());
  await page.waitForTimeout(3000);
  console.log('P4 after-save spot=', JSON.stringify(Object.fromEntries(await Promise.all(SPOT.map(async (s) => [s, await read(s)])))));
  console.log('P4 after-save API=', JSON.stringify(apiLog.map((a) => a.u)));
  const stillForm = await page.locator('.el-form-item:visible').count();
  console.log('P4 stillForm formItems=' + stillForm);
  if (stillForm < 10) {
    console.log('P4 ABORT: 暂存后表单已离开, 快照假设不成立');
    return;
  }

  // Phase 3: 法代引入
  await runFillPlan(page, plan.filter((p) => p.label === LBL.LEGAL), { ...ctx, tag: 'P4-P3' }, undefined);
  console.log('P4 P3 legal=' + (await read(LBL.LEGAL)) + ' spot=', JSON.stringify(Object.fromEntries(await Promise.all(SPOT.map(async (s) => [s, await read(s)])))));

  // Phase 4: 地址引入
  await runFillPlan(page, plan.filter((p) => p.label === LBL.ADDR), { ...ctx, tag: 'P4-P4' }, undefined);
  console.log('P4 P4 legal=' + (await read(LBL.LEGAL)) + ' addr=' + (await read(LBL.ADDR)).slice(0, 24) + ' spot=', JSON.stringify(Object.fromEntries(await Promise.all(SPOT.map(async (s) => [s, await read(s)])))));

  // Phase 5: 注册资本
  await runFillPlan(page, plan.filter((p) => p.label === LBL.ZZ), { ...ctx, tag: 'P4-P5' }, undefined);
  console.log('P4 P5 legal=' + (await read(LBL.LEGAL)) + ' addr=' + (await read(LBL.ADDR)).slice(0, 24) + ' zz=' + (await read(LBL.ZZ)));
  for (let i = 1; i <= 3; i++) {
    await sleep(5000);
    console.log('P4 +' + i * 5 + 's legal=' + (await read(LBL.LEGAL)) + ' addr=' + (await read(LBL.ADDR)).slice(0, 24) + ' zz=' + (await read(LBL.ZZ)));
  }
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'work', 'smbsn', 's2_probe4_end.png') });
});
