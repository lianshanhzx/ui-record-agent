import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { inspectPage, runFillPlan, openAllSections, type FillCtx } from './fillEngine';

const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const VALUES_FILE = path.join(__dirname, '..', '..', 'work', 'smbsn', 's1-values.json');
const PLAN_FILE = path.join(__dirname, '..', '..', 'work', 'smbsn', 's1-plan.json');
const FILLLOG_FILE = path.join(__dirname, '..', '..', 'work', 'smbsn', 'filllog-S1.json');

const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';

// GB 32100-2015 统一社会信用代码：17 位本体 + mod31 校验位
const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const USCC_W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
const randUscc = () => {
  let body = '91450100';
  for (let i = 0; i < 9; i++) body += USCC_CHARS[Math.floor(Math.random() * USCC_CHARS.length)];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += USCC_CHARS.indexOf(body[i]) * USCC_W[i];
  let check = 31 - (sum % 31);
  if (check === 31) check = 0;
  return body + USCC_CHARS[check];
};
const pad = (x: number) => String(x).padStart(2, '0');
const d = new Date();
const TS = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
const NAME = 'AT_SMB_' + TS;
const USCC = randUscc();
const INST_USCC = randUscc();
const PHONE = '139' + String(10000000 + Math.floor(Math.random() * 89999999));
const ADDR = 'AT引入测试路1号';

test.describe('S1 同业客户管理-新增客户', () => {
  test('抽屉录入→场景页全量填充(3引入)→暂存→列表反查', async ({ page }) => {
    test.setTimeout(600_000);
    let cstNo = '';
    let saveStatus = 0;
    let plan: Awaited<ReturnType<typeof inspectPage>> = [];

    await test.step('打开同业客户管理列表页', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const listReady = page.waitForResponse(LIST_API, { timeout: 120_000 });
      await page.goto(LIST_ROUTE, { waitUntil: 'domcontentloaded' });
      await listReady;
      await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
    });

    await test.step('点击【新增】打开抽屉', async () => {
      await page.locator('button', { hasText: /新\s*增/ }).first().click();
      await expect(page.locator('.el-drawer:visible')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(1500);
    });

    await test.step('抽屉录入 证件类型/证件号码/客户名称', async () => {
      const dIt = (lb: string) =>
        page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
      // 证件类型：显式选 营业执照(默认值)
      await dIt('证件类型').locator('.el-select, input').first().click({ timeout: 8000 });
      await page
        .locator('.el-select-dropdown:visible .el-select-dropdown__item')
        .filter({ hasText: /^营业执照$/ })
        .last()
        .click({ timeout: 8000 });
      await expect(dIt('证件类型').locator('input').first()).toHaveValue('营业执照', { timeout: 5000 });
      await page.waitForTimeout(800);
      await dIt('证件号码').locator('input').first().fill(USCC, { timeout: 8000 });
      await expect(dIt('证件号码').locator('input').first()).toHaveValue(USCC);
      await dIt('客户名称').locator('input').first().fill(NAME, { timeout: 8000 });
      await expect(dIt('客户名称').locator('input').first()).toHaveValue(NAME);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(__dirname, '..', '..', 'work', 'smbsn', 's1_02_drawer_filled.png') });
    });

    await test.step('抽屉【保存】→ checkCustTrade 查重通过 → 进入场景页', async () => {
      const checkP = page.waitForResponse((r) => r.url().includes('checkCustTrade') && r.request().method() === 'POST', { timeout: 30_000 });
      const getCustP = page.waitForResponse((r) => r.url().includes('/custTrade/getCustTrade') && r.request().method() === 'POST', { timeout: 90_000 });
      await page.locator('.el-drawer:visible').getByRole('button').filter({ hasText: /保\s*存/ }).first().click();
      const check = await checkP;
      expect(check.status()).toBe(200);
      const cj = JSON.parse(await check.text());
      cstNo = (cj && cj.data && cj.data.cstNo) || '';
      expect(cstNo, 'checkCustTrade 应返回新 cstNo').not.toBe('');
      await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
      await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
      const getCust = await getCustP;
      expect(getCust.status()).toBe(200);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(__dirname, '..', '..', 'work', 'smbsn', 's1_03_scene_ready.png') });
    });

    await test.step('场景页全量盘点(5 折叠段, 71 字段)', async () => {
      await openAllSections(page);
      plan = await inspectPage(page);
      expect(plan.length, '场景页可盘点字段数').toBeGreaterThanOrEqual(60);
      fs.writeFileSync(PLAN_FILE, JSON.stringify({ name: NAME, uscc: USCC, cstNo, total: plan.length, items: plan }, null, 2));
    });

    await test.step('按序填充全部可编辑字段(含 3 个引入子流程)', async () => {
      const ctx: FillCtx = { uscc: USCC, instUscc: INST_USCC, phone: PHONE, addrDetail: ADDR, tag: 'S1' };
      const log = await runFillPlan(page, plan, ctx, FILLLOG_FILE);
      const bad = log.filter((l) => !l.ok);
      console.log('FILLLOG total=' + log.length + ' ok=' + log.filter((l) => l.ok).length + ' bad=' + JSON.stringify(bad.map((b) => ({ seq: b.seq, label: b.label, note: b.note }))));
      expect(bad, '存在填充失败字段: ' + JSON.stringify(bad.map((b) => b.label + ':' + b.note))).toEqual([]);
    });

    await test.step('点击【暂存】→ saveCustTrade(prsvInd=0) 成功', async () => {
      const saveP = page.waitForResponse((r) => r.url().includes('saveCustTrade') && r.request().method() === 'POST', { timeout: 30_000 });
      await page.getByRole('button').filter({ hasText: /暂\s*存/ }).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.getByRole('button').filter({ hasText: /暂\s*存/ }).first().click();
      const save = await saveP;
      saveStatus = save.status();
      expect(saveStatus).toBe(200);
      const body = save.request().postDataJSON();
      expect(body.prsvInd).toBe('0');
      expect(body.smbsnCstBaseInf.cstNo).toBe(cstNo);
      expect(body.smbsnCstBaseInf.cstNm).toBe(NAME);
    });

    await test.step('点击【返回】回列表，按客户名称反查命中唯一行', async () => {
      await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
      await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30_000 });
      await page.waitForTimeout(2000);
      const formItem = (lb: string) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
      await formItem('客户名称').locator('input').first().fill(NAME, { timeout: 10_000 });
      const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
      await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
      const q = await qP;
      const j = JSON.parse(await q.text());
      expect(j.data.total).toBe(1);
      expect(j.data.list[0].cstNm).toBe(NAME);
      expect(j.data.list[0].cstNo).toBe(cstNo);
      await expect(page.locator(ROWS).first()).toContainText(NAME, { timeout: 15_000 });
    });

    await test.step('落盘本运行值(供 wire 生成)', async () => {
      fs.writeFileSync(
        VALUES_FILE,
        JSON.stringify({ name: NAME, uscc: USCC, instUscc: INST_USCC, phone: PHONE, addr: ADDR, cstNo, saveStatus, filllog: FILLLOG_FILE }, null, 2)
      );
      console.log('VALUES_SAVED ' + VALUES_FILE + ' cstNo=' + cstNo);
    });
  });
});
