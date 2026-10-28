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

test('probe3: C1+法代+注册资本, 无地址, 45s 轮询+API 抓取', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const apiLog: any[] = [];
  page.on('response', async (r) => {
    if (r.request().method() === 'POST' && r.url().includes('/prod-api/')) {
      try {
        const ct = (r.headers()['content-type'] || '');
        if (ct.includes('json')) {
          const j = await r.json();
          apiLog.push({ t: Date.now(), u: r.url().split('/prod-api/')[1], desc: j && j.description, data: j && j.data ? JSON.stringify(j.data).slice(0, 250) : null });
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
  const LEGAL = '法定代表人/负责人姓名';
  const iLegal = plan.findIndex((p) => p.label === LEGAL);
  const byLabel = (lb: string) => plan.filter((p) => p.label === lb);
  const ctx: FillCtx = { uscc: randUscc(), instUscc: randUscc(), phone: '13911112222', addrDetail: 'AT改测试路99号', tag: 'P3', mode: 'edit' };
  const readLegal = async () => itemValue(page, LEGAL).catch(() => 'READ_ERR');

  await runFillPlan(page, plan.slice(0, iLegal), { ...ctx, tag: 'P3-C1' }, undefined);
  console.log('P3 after C1 legal=' + (await readLegal()));
  await runFillPlan(page, byLabel(LEGAL), { ...ctx, tag: 'P3-C2' }, undefined);
  console.log('P3 after 法代 legal=' + (await readLegal()));
  apiLog.length = 0;
  const t0 = Date.now();
  await runFillPlan(page, byLabel('注册资本金额'), { ...ctx, tag: 'P3-ZZ' }, undefined);
  console.log('P3 after 注册资本 legal=' + (await readLegal()) + ' (t=' + ((Date.now() - t0) / 1000).toFixed(1) + 's)');
  for (let i = 1; i <= 9; i++) {
    await sleep(5000);
    const lv = await readLegal();
    console.log(`P3 t=${i * 5}s legal=${lv}`);
    if (lv !== '黄飞鸿') break;
  }
  console.log('P3 API_AFTER_注册资本=', JSON.stringify(apiLog.map((a) => ({ t: a.t - t0, u: a.u, desc: a.desc, data: a.data })), null, 1));
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'work', 'smbsn', 's2_probe3_end.png') });
});
