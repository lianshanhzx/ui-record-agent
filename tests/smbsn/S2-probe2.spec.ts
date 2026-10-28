import { test, expect } from '@playwright/test';
import path from 'path';
import { openAllSections, itemValue, randUscc, type FillCtx } from './fillEngine';
import { fillImport as fi } from './fillSubflows';

const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('真实子流程: 法代引入 -> 地址引入, 跟踪法代', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
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
  const ctx: FillCtx = { uscc: randUscc(), instUscc: randUscc(), phone: '13911112222', addrDetail: 'AT改测试路99号', tag: 'P2', mode: 'edit' };
  const readLegal = async () => itemValue(page, '法定代表人/负责人姓名').catch(() => 'READ_ERR');
  console.log('P2 L0 legal=' + (await readLegal()));

  const r1 = await fi(page, '法定代表人/负责人姓名', ctx);
  console.log('P2 法代import ok=' + r1.ok + ' note=' + r1.note + ' legal=' + (await readLegal()));

  const r2 = await fi(page, '登记注册地址', ctx);
  console.log('P2 地址import ok=' + r2.ok + ' note=' + r2.note + ' legal=' + (await readLegal()));
  for (let i = 1; i <= 3; i++) {
    await sleep(5000);
    console.log('P2 +' + i * 5 + 's legal=' + (await readLegal()));
  }
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'work', 'smbsn', 's2_probe2_end.png') });
});
