import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S19 同业客户-联网核查-查看详情（列表查询→选行→【联网核查信息】dialog→选核查行radio→【查看详情】→50项只读详情dialog断言→【返回】→【取消】）
// probe89：API custCorporatNetworkCheckBasic/get {id}；详情 dialog(dialog335) 50 项只读 + 仅【返回】
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's19-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const PAGE_API = (r: any) => r.url().includes('/tansun-tcp-cst/custCorporatNetworkCheckBasic/page') && r.request().method() === 'POST';
const GET_API = (r: any) => r.url().includes('/tansun-tcp-cst/custCorporatNetworkCheckBasic/get') && r.request().method() === 'POST';
const D = `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`;
const DetX = `//div[@role='dialog'][.//label[normalize-space()='核查结果信息']]`;
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S19 同业客户-联网核查-查看详情（选行radio→查看详情→只读详情断言→返回→取消）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号查询 total=1 → 选行 → 开联网核查 dialog', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    await noInput.fill(CUST_NO);
    const q = page.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    const listRespP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await q.click();
    const lr = JSON.parse(await (await listRespP).text());
    expect(lr.data.total, '查询 total=1').toBe(1);
    const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    const pageRespP = page.waitForResponse(PAGE_API, { timeout: 30_000 });
    await page.getByRole('button').filter({ hasText: /联网核查信息/ }).first().click();
    const dlg = page.locator(`xpath=${D}`);
    await expect(dlg, '联网核查 dialog').toBeVisible({ timeout: 15_000 });
    await pageRespP;
    await dlg.locator('.el-table__body-wrapper tbody tr').first().waitFor({ state: 'visible', timeout: 15_000 });
  });

  await test.step('2 选核查表首行 radio → 读首行时间', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const rrow = dlg.locator('.el-table__body-wrapper tbody tr').first();
    const radio = rrow.locator('label.el-radio, input[type="radio"]').first();
    V.dlgRadioRect = await radio.evaluate(rectEval);
    await radio.evaluate((el) => (el as HTMLInputElement).click());
    await page.waitForTimeout(800);
    const rowTxt = (await rrow.innerText()).replace(/\s+/g, ' ').trim();
    V.firstRow = rowTxt;
    V.firstRowTime = rowTxt.split(' ')[0] + ' ' + rowTxt.split(' ')[1];
    console.log('S19_ROW0=' + rowTxt.slice(0, 100));
  });

  await test.step('3 点【查看详情】→ get API → 详情 dialog 出现', async () => {
    const dlg = page.locator(`xpath=${D}`);
    const detBtn = dlg.getByRole('button').filter({ hasText: /查看详情/ }).first();
    V.detailBtnRect = await detBtn.evaluate(rectEval);
    const getRespP = page.waitForResponse(GET_API, { timeout: 30_000 });
    await detBtn.click();
    const det = page.locator(`xpath=${DetX}`);
    await expect(det, '核查详情 dialog').toBeVisible({ timeout: 15_000 });
    const getResp = await getRespP;
    const body = JSON.parse(getResp.request().postData() || '{}');
    expect(String(body.id || ''), 'get 请求带 id').not.toBe('');
    V.getReqBody = body;
    await det.locator('.el-form-item').first().waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1500);
  });

  await test.step('4 只读详情断言：≥45 项 + 关键值 + 仅返回按钮', async () => {
    const det = page.locator(`xpath=${DetX}`);
    const items = det.locator('.el-form-item');
    const n = await items.count();
    expect(n, '详情项数 ≥45').toBeGreaterThanOrEqual(45);
    V.detailItems = n;
    const labels: string[] = [];
    const values: Record<string, string> = {};
    for (let i = 0; i < n; i++) {
      const it = items.nth(i);
      const lb = (await it.locator('label').first().innerText().catch(() => '')).trim();
      if (!lb) continue;
      labels.push(lb);
      const inp = it.locator('input, .el-select .el-input__inner, .el-select').first();
      if (await inp.count()) values[lb] = (await inp.inputValue().catch(() => '')).trim() || (await inp.innerText().catch(() => '')).trim();
    }
    for (const k of ['核查时间', '客户编号', '客户名称', '证件号码', '核查结果信息', '业务状态', '发起清算行']) {
      expect(labels, '含字段 ' + k).toContain(k);
    }
    expect(values['客户编号'], '客户编号回显').toBe(CUST_NO);
    expect(values['核查结果信息'], '核查结果信息').toContain('要素核查匹配正确');
    expect(values['核查时间'] || '', '详情核查时间=首行日期').toContain(V.firstRowTime.slice(0, 10));
    const btns = await det.evaluate((d) =>
      [...d.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, '')).filter(Boolean)
    );
    expect(btns, '详情仅 返回 按钮').toEqual(['返回']);
    V.detailBackRect = await det.getByRole('button').filter({ hasText: /返\s*回/ }).first().evaluate(rectEval);
    console.log('S19_ITEMS=' + n + ' TIME=' + values['核查时间'] + ' STATE=' + values['业务状态']);
  });

  await test.step('5 点【返回】关详情 → 核查 dialog 仍在', async () => {
    const det = page.locator(`xpath=${DetX}`);
    const dlg = page.locator(`xpath=${D}`);
    await det.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
    await expect(det, '详情 dialog 关闭').toBeHidden({ timeout: 10_000 });
    await expect(dlg, '核查 dialog 仍在').toBeVisible();
    console.log('S19_BACK_OK');
  });

  await test.step('6 取消关闭核查 dialog', async () => {
    const dlg = page.locator(`xpath=${D}`);
    await dlg.getByRole('button').filter({ hasText: /取\s*消/ }).first().click();
    await expect(dlg).toBeHidden({ timeout: 10_000 });
    console.log('S19_CLOSED');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S19_VALUES_SAVED');
});
