import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S28 同业客户-客户保存(暂存口径)：客户编号查询→选行→修改→改 客户简称(单字段最小改动)→【暂存】saveCustTrade 200→返回→反查 total=1 且 客户简称 已更新
// 说明：正式保存【保存】按钮本环境 no-op(不触发 API)，唯一可用保存=【暂存】(草稿 prsvInd=0, cstSt 保持 6)；本笔为单字段最小保存，区别于 S2 的 40+ 明文项全改
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's28-values.json');
const CUST_NO = '260924144929974126';
const JC_TARGET = 'AT_S28暂存';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('findCustTradeList') && r.request().method() === 'POST';
const SAVE_API = (r: any) => r.url().includes('saveCustTrade') && r.request().method() === 'POST';
const X_JC = "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户简称']]//input";
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const normBox = (b: any) => (b ? { x1: +(b.x / 1440).toFixed(4), y1: +(b.y / 900).toFixed(4), x2: +((b.x + b.width) / 1440).toFixed(4), y2: +((b.y + b.height) / 900).toFixed(4) } : null);

test('S28 同业客户-客户保存(暂存口径: 改客户简称→暂存→反查)', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO, jcTarget: JC_TARGET };

  // 列表→查询→选行→修改
  await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
  await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const qj = JSON.parse(await (await qP).text());
  expect(qj.data.total).toBe(1);
  const jcBefore = qj.data.list[0].cstShrtnm;
  V.jcBefore = jcBefore;
  await page.waitForTimeout(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el: any) => el.click());
  await page.waitForTimeout(800);
  const gcP = page.waitForResponse((r: any) => r.url().includes('getCustTrade') && r.request().method() === 'POST', { timeout: 60_000 }).catch(() => null);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  if (gcP) await gcP.catch(() => {});
  await page.waitForTimeout(5000);

  // 改 客户简称（单字段，保证脏表单）
  const jc = page.locator('xpath=' + X_JC).first();
  const cur = await jc.inputValue();
  let target = JC_TARGET;
  if (target === cur) target = cur + 'x';
  V.jcSet = target;
  V.jcRect = normBox(await jc.boundingBox());
  await jc.click();
  await jc.fill(target);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(2500);

  // 暂存 → saveCustTrade 200
  const tempSave = page.locator("//button[normalize-space()='暂存']").filter({ visible: true }).first();
  V.tempSaveRect = normBox(await tempSave.boundingBox());
  const saveP = page.waitForResponse(SAVE_API, { timeout: 30_000 });
  await tempSave.click({ timeout: 8_000 });
  const save = await saveP;
  expect(save.status()).toBe(200);
  const sj = JSON.parse(await save.text());
  expect(sj.status).toBe(200);
  console.log('S28_SAVECUST_TRADE 200 jc=' + target);

  // 返回→列表→反查
  const back = page.locator("//button[normalize-space()='返回']").filter({ visible: true }).first();
  V.backRect = normBox(await back.boundingBox());
  await back.click({ timeout: 8_000 });
  await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
  await page.waitForTimeout(2000);
  const qP2 = page.waitForResponse(LIST_API, { timeout: 30_000 });
  await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const qj2 = JSON.parse(await (await qP2).text());
  expect(qj2.data.total).toBe(1);
  expect(qj2.data.list[0].cstShrtnm).toBe(target);
  console.log('S28_VERIFY jc ' + jcBefore + ' -> ' + qj2.data.list[0].cstShrtnm);

  V.steps = '查询→修改→改客户简称→暂存(saveCustTrade 200)→返回→反查 total=1 且 客户简称 更新';
  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2));
});
