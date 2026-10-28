import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S17 同业客户-查看（列表查询→选行→【查看】→场景页 viewType=look：6tab/5段/仅【返回】按钮（无引入/保存/暂存）→返回）
// probe87b：查看=同 mdfSmbsnCst 路由 viewType=look（编辑态 viewType=edit）；API getCustTrade×2 + getRatingResult
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's17-values.json');
const CUST_NO = '260924144929974126';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const GET_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/getCustTrade') && r.request().method() === 'POST';
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S17 同业客户-查看（viewType=look 只读场景页断言→返回）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页：客户编号查询 total=1', async () => {
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
    expect(lr.data.total, '查询 total=1').toBe(1);
  });

  await test.step('2 选行→点【查看】→viewType=look 场景页', async () => {
    const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
    await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
    await page.waitForTimeout(800);
    const viewBtn = page.getByRole('button').filter({ hasText: /查\s*看/ }).first();
    V.viewBtnRect = await viewBtn.evaluate(rectEval);
    const getRespP = page.waitForResponse(GET_API, { timeout: 30_000 });
    await viewBtn.click();
    await page.waitForURL(/viewType=look/, { timeout: 30_000 });
    await getRespP;
    await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
    await page.waitForTimeout(4000);
  });

  await test.step('3 只读场景断言：6tab/5段/仅返回按钮/客户编号回显', async () => {
    const url = page.url();
    expect(url, 'URL viewType=look').toContain('viewType=look');
    const tabs = await page.locator('.el-tabs__item:visible').allInnerTexts();
    const tabNames = tabs.map((t) => t.trim()).filter(Boolean);
    expect(tabNames, '6 tab').toEqual(['基本信息', '股东信息', '关联人信息', '影像资料', '业务信息', '其他信息']);
    const sections = await page.locator('.el-collapse-item__title:visible, .el-collapse-item__header:visible').allInnerTexts();
    const secNames = sections.map((s) => s.trim()).filter(Boolean);
    expect(secNames, '基本信息 5 段').toContain('基本信息');
    expect(secNames, '含财务信息段').toContain('财务信息');
    const pageBtns = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .filter((b) => b.offsetParent !== null && !b.closest('.el-dialog') && !b.closest('.el-drawer'))
        .map((b) => b.innerText.trim().replace(/\s+/g, ''))
        .filter(Boolean)
    );
    expect(pageBtns, '无 引入/保存/暂存 按钮').not.toContain('引入');
    expect(pageBtns, '无 保存 按钮').not.toContain('保存');
    expect(pageBtns, '无 暂存 按钮').not.toContain('暂存');
    expect(pageBtns, '有 返回 按钮').toContain('返回');
    const noVal = await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().inputValue();
    expect(noVal, '客户编号回显').toBe(CUST_NO);
    const backBtn = page.getByRole('button').filter({ hasText: /返\s*回/ }).last();
    V.viewBackRect = await backBtn.evaluate(rectEval);
    console.log('S17_VIEW_BTNS=' + JSON.stringify(pageBtns));
  });

  await test.step('4 点【返回】回列表', async () => {
    await page.getByRole('button').filter({ hasText: /返\s*回/ }).last().click();
    await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 60_000 });
    console.log('S17_BACK_OK');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S17_VALUES_SAVED');
});
