import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S11 同业客户-关联人信息删除（列表查询→修改→关联人信息tab→选首行→删除→确认弹窗OK→断言行-1）
// 镜像 S5 股东删除；关联人表列序：单选/关联客户编号/关联客户名称/关联人类型/证件类型/证件号码/职务名称（名称=cell nth(2)）
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's11-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const RP_QUERY_API = (r: any) => r.url().includes('queryCustCorporatRelatedParty') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();

test('S11 同业客户-关联人信息删除（选首行→删除→确认OK→行-1）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号搜索→查询 total=1', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const listReady = page.waitForResponse(LIST_API, { timeout: 120_000 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
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

  await test.step('3 关联人信息 tab → 读行 → 选首行 radio', async () => {
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /关联人/ }).first();
    V.tabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(3000);
    const pane = page.locator('.el-tab-pane:visible').last();
    const rpRows = () => pane.locator(ROWS);
    const before = await rpRows().count();
    expect(before, '关联人表至少 1 行').toBeGreaterThan(0);
    const rows: string[] = [];
    for (let i = 0; i < before; i++) {
      const cells = await rpRows().nth(i).locator('td .cell').allInnerTexts();
      rows.push(JSON.stringify(cells.map((c) => c.trim())));
    }
    console.log('S11_RP_ROWS_BEFORE=' + before + ' ROWS=' + JSON.stringify(rows));
    const first = rpRows().first();
    await first.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    V.rpRadioRect = await first.locator('label.el-radio').first().evaluate(rectEval);
    V.deletedRow = JSON.parse(rows[0]);
    V.beforeCount = before;
  });

  await test.step('4 点【删除】→ message-box 确认断言 → 点 OK', async () => {
    const delBtn = page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /删\s*除/ }).first();
    await expect(delBtn).toBeEnabled({ timeout: 10_000 });
    V.delRect = await delBtn.evaluate(rectEval);
    await delBtn.click();
    await page.waitForTimeout(2500);
    const mb = page.locator('.el-message-box:visible').last();
    await expect(mb).toBeVisible({ timeout: 10_000 });
    const msg = ((await mb.locator('.el-message-box__message').innerText().catch(() => '')) || (await mb.innerText().catch(() => ''))).trim().replace(/\s+/g, ' ');
    console.log('S11_CONFIRM_MSG=' + msg);
    expect(msg).toContain('删除');
    const okBtn = mb.locator('button.el-button--primary');
    expect(await okBtn.count(), 'message-box OK 按钮(el-button--primary)').toBe(1);
    expect((await okBtn.innerText()).trim()).toBe('OK');
    V.okRect = await okBtn.evaluate(rectEval);
    const delRespP = page.waitForResponse((r) => r.url().includes('custCorporatRelatedParty') && r.request().method() === 'POST' && !/queryCustCorporatRelatedParty|save/i.test(r.url()), { timeout: 20_000 });
    const requeryP = page.waitForResponse(RP_QUERY_API, { timeout: 20_000 });
    await okBtn.click();
    const delResp = await delRespP;
    V.delApi = delResp.url().split('/').slice(-2).join('/');
    V.delPostData = (delResp.request().postData() || '').slice(0, 500);
    expect(delResp.status()).toBe(200);
    const rej = await delResp.json().catch(() => null);
    if (rej) {
      console.log('S11_DEL_RESP=' + JSON.stringify(rej).slice(0, 300));
      expect(String(rej.status || rej.code), '删除接口成功').not.toMatch(/100|error/i);
    }
    const rq = JSON.parse(await (await requeryP).text());
    console.log('S11_REQUERY total=' + rq.data.total);
    expect(rq.data.total).toBe(V.beforeCount - 1);
  });

  await test.step('5 断言表格行-1 且被删行消失', async () => {
    const pane = page.locator('.el-tab-pane:visible').last();
    const rpRows = () => pane.locator(ROWS);
    await expect(async () => {
      expect(await rpRows().count()).toBe(V.beforeCount - 1);
    }).toPass({ timeout: 10_000 });
    const afterCells: string[] = [];
    for (let i = 0; i < V.beforeCount - 1; i++) {
      const cells = await rpRows().nth(i).locator('td .cell').allInnerTexts();
      afterCells.push(JSON.stringify(cells.map((c) => c.trim())));
    }
    console.log('S11_RP_ROWS_AFTER=' + afterCells.length + ' ROWS=' + JSON.stringify(afterCells));
    // 注：两行关联人表格 6 列完全同值（联系电话等不在列中），无法用行文本区分，行数-1 以 step4 requery total 为权威断言
    V.afterCount = afterCells.length;
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
    console.log('S11_VALUES_SAVED before=' + V.beforeCount + ' after=' + V.afterCount + ' delApi=' + V.delApi);
  });
});
