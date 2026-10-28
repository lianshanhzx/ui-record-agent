import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// S22 同业客户-高级查询（列表→caret 展开高级查询→客户编号+证件号码+客户状态=草稿客户→查询 cstSt=6 total=1→重置清空→caret 收起）
// probe89：展开加 证件号码/管户客户经理/客户状态；客户状态[信贷正式客户(cstSt=1)/草稿客户(cstSt=6)]；请求 body {cstNo,cstNm,crdtTp,crdtNo,usrNo,cstSt}
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');
const VALUES_FILE = path.join(DIR, 's22-values.json');
const CUST_NO = '260924144929974126';
const CRDT_NO = '914501005QBUAEFCJ8';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ADV_LABELS = ['证件号码', '管户客户经理', '客户状态'];
const rectEval = (el: Element) => {
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x1: +(r.x / 1440).toFixed(4), y1: +(r.y / 900).toFixed(4), x2: +((r.x + r.width) / 1440).toFixed(4), y2: +((r.y + r.height) / 900).toFixed(4) });
};

test('S22 同业客户-高级查询（展开→三条件查询 cstSt=6→重置→收起）', async ({ page }) => {
  test.setTimeout(300_000);
  const V: Record<string, any> = { custNo: CUST_NO };

  await test.step('1 列表页加载 → caret 展开高级查询', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://test.creditv5p2.tansun.com.cn' + LIST_ROUTE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90_000 });
    await page.waitForTimeout(2000);
    const advVisible = await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户状态' }) }).count();
    expect(advVisible, '默认收起（客户状态不可见）').toBe(0);
    const caret = page.locator('button:has(i.el-icon-caret-bottom)').first();
    await expect(caret, '高级查询 caret 按钮').toBeVisible({ timeout: 5_000 });
    V.caretRect = await caret.evaluate(rectEval);
    await caret.click();
    await page.waitForTimeout(1200);
    for (const lb of ADV_LABELS) {
      const c = await page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: lb }) }).count();
      expect(c, '展开后含 ' + lb).toBeGreaterThanOrEqual(1);
    }
    V.advExpanded = true;
    console.log('S22_EXPANDED');
  });

  await test.step('2 填 客户编号 + 证件号码 + 客户状态=草稿客户', async () => {
    const noInput = page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first();
    await noInput.fill(CUST_NO);
    const crdtInput = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '证件号码' }) }).first().locator('input').first();
    V.crdtRect = await crdtInput.evaluate(rectEval);
    await crdtInput.fill(CRDT_NO);
    // 管户客户经理：打开读选项后 Esc（不选，保持空）
    const mgrItem = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '管户客户经理' }) }).first();
    const mgrSel = mgrItem.locator('.el-select, .tssc-multi-select .el-select').first();
    await mgrSel.click();
    const mgrDd = page.locator('.el-select-dropdown').filter({ hasText: 'YG' }).last();
    await mgrDd.waitFor({ state: 'visible', timeout: 10_000 });
    V.mgrOptions = (await mgrDd.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim());
    expect(V.mgrOptions.length, '管户客户经理选项 ≥5').toBeGreaterThanOrEqual(5);
    console.log('S22_MGR_OPTS=' + V.mgrOptions.slice(0, 8).join(','));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    // 客户状态=草稿客户
    const stItem = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '客户状态' }) }).first();
    const stSel = stItem.locator('.el-select, .tssc-multi-select .el-select').first();
    V.stRect = await stSel.evaluate(rectEval);
    await stSel.click();
    const stDd = page.locator('.el-select-dropdown').filter({ hasText: '草稿客户' }).last();
    await stDd.waitFor({ state: 'visible', timeout: 10_000 });
    V.stOptions = (await stDd.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim());
    console.log('S22_ST_OPTS=' + JSON.stringify(V.stOptions));
    expect(V.stOptions, '客户状态选项').toEqual(['信贷正式客户', '草稿客户']);
    await stDd.locator('.el-select-dropdown__item').filter({ hasText: '草稿客户' }).first().click();
    await page.waitForTimeout(600);
  });

  await test.step('3 查询 → cstSt=6 + crdtNo 生效 + total=1', async () => {
    const q = page.getByRole('button').filter({ hasText: /查\s*询/ }).first();
    const respP = page.waitForResponse(LIST_API, { timeout: 30_000 });
    await q.click();
    const resp = await respP;
    const body = JSON.parse(resp.request().postData() || '{}');
    V.queryReqBody = body;
    console.log('S22_QUERY_BODY=' + JSON.stringify(body));
    expect(body.cstNo, 'cstNo').toBe(CUST_NO);
    expect(body.crdtNo, 'crdtNo').toBe(CRDT_NO);
    expect(body.cstSt, '客户状态=草稿客户 → cstSt=6').toBe('6');
    const j = await resp.json();
    expect(j.data.total, 'total=1').toBe(1);
    expect(j.data.list[0].cstNo, '首行=基准客户').toBe(CUST_NO);
    expect(j.data.list[0].cstNm, '首行客户名').toContain('AT_SMB');
    const rowTxt = (await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().innerText()).replace(/\s+/g, ' ');
    expect(rowTxt, '表格含客户编号').toContain(CUST_NO);
  });

  await test.step('4 重置 → 高级字段清空', async () => {
    const rBtn = page.getByRole('button').filter({ hasText: /重\s*置/ }).first();
    V.resetRect = await rBtn.evaluate(rectEval);
    await rBtn.click();
    await page.waitForTimeout(1500);
    const noVal = await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().inputValue();
    const crdtVal = await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '证件号码' }) }).first().locator('input').first().inputValue().catch(() => '');
    const stVal = await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户状态' }) }).first().locator('input').first().inputValue().catch(() => '');
    expect(noVal, '客户编号清空').toBe('');
    expect(crdtVal, '证件号码清空').toBe('');
    expect(stVal, '客户状态清空').toBe('');
    console.log('S22_RESET_OK');
  });

  await test.step('5 caret 收起高级查询', async () => {
    const caretTop = page.locator('button:has(i.el-icon-caret-top)').first();
    await expect(caretTop, '展开态 caret-top 按钮').toBeVisible({ timeout: 5_000 });
    await caretTop.click();
    await page.waitForTimeout(1200);
    const advVisible = await page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: '客户状态' }) }).count();
    expect(advVisible, '收起后客户状态不可见').toBe(0);
    console.log('S22_COLLAPSED');
  });

  fs.writeFileSync(VALUES_FILE, JSON.stringify(V, null, 2), 'utf8');
  console.log('S22_VALUES_SAVED');
});
