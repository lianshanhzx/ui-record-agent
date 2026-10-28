import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S5 同业客户-股东信息删除（列表查询→修改→股东信息tab→选行→删除→确认弹窗OK→断言行-1）
// 依据 S3(新增)/S4(修改) 同链路；删除入口=pane 工具栏【删除】(选行后可用)，确认=.el-message-box(按钮 Cancel/OK)
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's5-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const SH_QUERY_API = (r: any) => r.url().includes('queryCustCorporatRelatedParty') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

test('S5 同业客户-股东信息删除（选行→删除→确认OK→行-1）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号搜索→查询 total=1', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const listReady = page.waitForResponse(LIST_API, { timeout: 120_000 });
    await page.goto(LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await listReady;
    await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const noInput = formItem(page, '客户编号').locator('input').first();
    V.listNoRect = await noInput.evaluate(rectEval);
    await noInput.fill(CUST_NO, { timeout: 10_000 });
    const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const j = JSON.parse(await (await qP).text());
    expect(j.data.total).toBe(1);
    expect(j.data.list[0].cstNo).toBe(CUST_NO);
    await page.waitForTimeout(1500);
  });

  await test.step('2 选行 Radio → 点【修改】进场景页', async () => {
    const row = page.locator(ROWS).first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    expect((await row.getAttribute('class')) || '').toContain('current-row');
    const getCustP = page.waitForResponse((r) => r.url().includes('/custTrade/getCustTrade') && r.request().method() === 'POST', { timeout: 90_000 });
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await getCustP;
    await page.waitForTimeout(4000);
  });

  await test.step('3 股东信息 tab → 读行 → 选首行 radio', async () => {
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /股东/ }).first();
    V.tabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(3000);
    const pane = page.locator('.el-tab-pane:visible').last();
    const shRows = () => pane.locator(ROWS);
    const before = await shRows().count();
    expect(before, '股东表至少 1 行').toBeGreaterThan(0);
    const names: string[] = [];
    for (let i = 0; i < before; i++) names.push((await shRows().nth(i).locator('td .cell').nth(3).innerText()).trim());
    console.log('S5_SH_ROWS_BEFORE=' + before + ' NAMES=' + JSON.stringify(names));
    const first = shRows().first();
    await first.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    V.shRadioRect = await first.locator('label.el-radio').first().evaluate(rectEval);
    V.deletedName = names[0];
    V.beforeCount = before;
  });

  await test.step('4 点【删除】→ message-box 确认断言 → 点 OK', async () => {
    const delBtn = page.getByRole('button').filter({ hasText: /删\s*除/ }).first();
    await expect(delBtn).toBeEnabled({ timeout: 10_000 });
    V.delRect = await delBtn.evaluate(rectEval);
    await delBtn.click();
    await page.waitForTimeout(2500);
    const mb = page.locator('.el-message-box:visible').last();
    await expect(mb).toBeVisible({ timeout: 10_000 });
    const msg = (await mb.locator('.el-message-box__message').innerText().catch(() => '')) || (await mb.innerText().catch(() => ''));
    console.log('S5_CONFIRM_MSG=' + msg.trim().replace(/\s+/g, ' '));
    expect(msg).toContain('确认是否删除当前选择的数据');
    const okBtn = mb.locator('button.el-button--primary');
    expect(await okBtn.count(), 'message-box OK 按钮(el-button--primary)').toBe(1);
    expect((await okBtn.innerText()).trim()).toBe('OK');
    V.okRect = await okBtn.evaluate(rectEval);
    const delRespP = page.waitForResponse((r) => r.url().includes('custCorporatRelatedParty') && r.request().method() === 'POST' && !/queryCustCorporatRelatedParty|save/i.test(r.url()), { timeout: 20_000 });
    const requeryP = page.waitForResponse(SH_QUERY_API, { timeout: 20_000 });
    await okBtn.click();
    const delResp = await delRespP;
    V.delApi = delResp.url().split('/').slice(-2).join('/');
    V.delPostData = (delResp.request().postData() || '').slice(0, 500);
    expect(delResp.status()).toBe(200);
    const rej = await delResp.json().catch(() => null);
    if (rej) {
      console.log('S5_DEL_RESP=' + JSON.stringify(rej).slice(0, 300));
      expect(String(rej.status || rej.code), '删除接口成功').not.toMatch(/100|error/i);
    }
    const rq = JSON.parse(await (await requeryP).text());
    console.log('S5_REQUERY total=' + rq.data.total);
    expect(rq.data.total).toBe(V.beforeCount - 1);
  });

  await test.step('5 断言表格行-1 且被删行消失', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const shRows = () => pane.locator(ROWS);
    await expect(async () => {
      expect(await shRows().count()).toBe(V.beforeCount - 1);
    }).toPass({ timeout: 10_000 });
    let names: string[] = [];
    for (let i = 0; i < V.beforeCount - 1; i++) names.push((await shRows().nth(i).locator('td .cell').nth(3).innerText()).trim());
    console.log('S5_SH_ROWS_AFTER=' + names.length + ' NAMES=' + JSON.stringify(names));
    expect(names).not.toContain(V.deletedName);
    V.afterCount = names.length;
  });

  await test.step('6 【返回】列表 → 客户编号反查 total=1', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForTimeout(2000);
    await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
    const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const j = JSON.parse(await (await qP).text());
    expect(j.data.total).toBe(1);
    expect(j.data.list[0].cstNo).toBe(CUST_NO);
  });

  await test.step('落盘本运行值(供 wire 生成)', async () => {
    fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2));
    console.log('S5_VALUES_SAVED deleted=' + V.deletedName + ' delApi=' + V.delApi);
  });
});
