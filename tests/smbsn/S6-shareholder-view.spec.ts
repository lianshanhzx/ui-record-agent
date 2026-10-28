import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S6 同业客户-股东信息查看（列表查询→修改→股东信息tab→选行→查看→只读弹窗断言→取消关闭）
// probe50：查看=.el-dialog(12项全 dis)+[引入/取消]；API custCorporatRelatedParty/get {id}
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's6-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const SH_QUERY_API = (r: any) => r.url().includes('queryCustCorporatRelatedParty') && r.request().method() === 'POST';
const SH_GET_API = (r: any) => r.url().includes('custCorporatRelatedParty/get') && r.request().method() === 'POST';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S6 同业客户-股东信息查看（选行→查看→只读弹窗断言→取消关闭）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号搜索→查询 total=1', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    V.listNoRect = await noInput.evaluate(rectEval);
    await noInput.fill(CUST_NO);
    const q = page.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    const listRespP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await q.click();
    const lr = JSON.parse(await (await listRespP).text());
    expect(lr.data.total).toBe(1);
  });

  await test.step('2 选行→修改→场景页', async () => {
    const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
    await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await page.waitForTimeout(3000);
  });

  await test.step('3 股东信息tab→读首行→选首行radio', async () => {
    const tabEl = page.locator('.el-tabs__item').filter({ hasText: /股东/ }).first();
    V.tabRect = await tabEl.evaluate(rectEval);
    await tabEl.click();
    await page.waitForTimeout(2500);
    const pane = page.locator('.el-tab-pane:visible').last();
    const shRows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
    const before = await shRows().count();
    expect(before, '股东表至少 1 行').toBeGreaterThanOrEqual(1);
    // 首行各列文本（列序：单选/股东类型/股东客户编号/股东名称/证件类型/证件号码/币种/认缴出资额/实缴出资额/持股比例/出资方式/出资时间/备注）
    const cells = await shRows().first().locator('td').allInnerTexts();
    V.rowCells = cells.map((c) => c.trim());
    const first = shRows().first();
    await first.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    V.shRadioRect = await first.locator('label.el-radio').first().evaluate(rectEval);
  });

  await test.step('4 点【查看】→ 只读弹窗断言 12 项 dis + 值 == 行值', async () => {
    const viewBtn = page.locator('.el-tab-pane:visible').last().getByRole('button').filter({ hasText: /查\s*看/ }).first();
    await expect(viewBtn).toBeEnabled({ timeout: 10_000 });
    V.viewRect = await viewBtn.evaluate(rectEval);
    const getRespP = page.waitForResponse(SH_GET_API, { timeout: 20_000 });
    await viewBtn.click();
    const dlg = page.locator('.el-dialog:visible').last();
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    const getRespRaw = await getRespP;
    V.getPostData = getRespRaw.request().postData() || '';
    const getResp = JSON.parse(await getRespRaw.text());
    expect(getResp.status, 'custCorporatRelatedParty/get 200').toBe(200);
    const items = dlg.locator('.el-form-item:visible');
    expect(await items.count(), '弹窗 12 项').toBe(12);
    const labels: string[] = [];
    for (let i = 0; i < 12; i++) {
      const it = items.nth(i);
      const lb = (await it.locator('label').first().innerText()).trim();
      labels.push(lb);
      const disInp = it.locator('input:visible, textarea:visible');
      const n = await disInp.count();
      expect(n, lb + ' 可见控件').toBeGreaterThanOrEqual(1);
      for (let k = 0; k < n; k++) {
        await expect(disInp.nth(k), lb + ' input/textarea disabled').toBeDisabled();
      }
    }
    expect(labels.join('/')).toBe('股东类型/股东名称/股东客户编号/证件类型/证件号码/币种/持股比例/出资方式/出资时间/认缴出资额(元)/实缴出资额（元）/备注');
    // 值 == 行值（日期取前 10 位比较）
    const val = async (lb: string) => (await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first().locator('input:visible, textarea:visible').first().inputValue()).trim();
    const row = V.rowCells;
    expect(await val('股东名称'), '股东名称').toBe(row[3]);
    expect(await val('股东客户编号'), '股东客户编号').toBe(row[2]);
    expect(await val('证件号码'), '证件号码').toBe(row[5]);
    expect(await val('持股比例'), '持股比例').toBe(row[9]);
    expect((await val('出资时间')).slice(0, 10), '出资时间').toBe(row[11].slice(0, 10));
    expect(await val('认缴出资额(元)'), '认缴出资额').toBe(row[7]);
    expect(await val('实缴出资额（元）'), '实缴出资额').toBe(row[8]);
    expect(await val('备注'), '备注').toBe(row[12]);
    console.log('S6_VIEW_LABELS=' + labels.join('/'));
    console.log('S6_VIEW_VALS name=' + row[3] + ' ratio=' + row[9] + ' amt=' + row[7]);
  });

  await test.step('5 点【取消】关闭弹窗', async () => {
    const dlg = page.locator('.el-dialog:visible').last();
    const cancelBtn = dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first();
    V.cancelRect = await cancelBtn.evaluate(rectEval);
    await cancelBtn.click();
    await expect(page.locator('.el-dialog:visible')).toHaveCount(0, { timeout: 10_000 });
  });

  await test.step('6 返回列表→反查 total=1', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await page.waitForTimeout(2500);
    const requeryP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    await noInput.fill(CUST_NO);
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const lr = JSON.parse(await (await requeryP).text());
    expect(lr.data.total).toBe(1);
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S6_VALUES_SAVED ' + VALUES_FILE);
});
