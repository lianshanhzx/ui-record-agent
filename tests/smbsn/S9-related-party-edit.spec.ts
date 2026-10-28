import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { measureDlgField, measureDlgBtn } from './fillEngine';
import type { FillLogEntry } from './fillEngine';

// S9 同业客户-关联人信息修改（列表查询→选行→修改→关联人tab→选行→修改弹窗改 6 项→确定→查看核对→返回反查）
const CUST_NO = '260924144929974126';
// 修改对象=关联人表首行（AT_正式_20260923110954，S8 建）；改动值全部按平台格式要求且与现值不同（同值不产生变更）
const OLD = { mobile: '13988158428', addr: '广西壮族自治区南宁市青秀区测试路1号', rank: '中级', tel: '0771-1234568', org: 'AT测试银行有限责任公司', resume: 'AT测试关联人工作简历描述' };
const NEW = { mobile: '13988158429', addr: '广西壮族自治区南宁市西乡塘区测试路2号', rank: '一般员工', tel: '0771-1234569', org: 'AT测试商业银行股份有限公司', resume: 'AT测试关联人修改后工作简历描述' };
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');

test('S9 同业客户-关联人信息修改（编辑弹窗改 6 项→确定保存→查看回显核对）', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const sleep = (ms: number) => page.waitForTimeout(ms);

  // ---------- 1) 列表: 客户编号查询 ----------
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await sleep(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;

  // ---------- 2) 行 radio + 修改（进场景页） ----------
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);

  // ---------- 3) 关联人信息 tab ----------
  const tabEl = page.locator('.el-tabs__item').filter({ hasText: '关联人信息' }).first();
  const tabRect = await tabEl.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await tabEl.click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  const rpRows = () => pane.locator('.el-table__body-wrapper .el-table__body tbody tr');
  expect(await rpRows().count(), '关联人表 ≥1 行（修改前提）').toBeGreaterThanOrEqual(1);

  // ---------- 4) 选行 + 修改 ----------
  await rpRows().first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  const editBtn = pane.getByRole('button').filter({ hasText: /修\s*改/ }).first();
  const editBtnRect = await editBtn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await editBtn.click();
  await sleep(3000);

  const D = '.el-dialog:visible';
  const dlg = () => page.locator(D).last();
  const FI = (lb: string) => dlg().locator('.el-form-item').filter({ hasText: lb }).first();
  expect(await dlg().locator('label').filter({ hasText: '关联客户编号' }).count(), '修改弹窗已打开').toBeGreaterThan(0);
  expect(await FI('关联客户名称').locator('input').first().isDisabled(), '关联客户名称 disabled（不可改指向）').toBeTruthy();
  // 回显核对：联系电话预填=现值
  expect((await FI('联系电话').locator('input').first().inputValue()).trim(), '联系电话回显=现值').toBe(OLD.mobile);

  const log: FillLogEntry[] = [];
  let seq = 0;
  const dlgInput = async (label: string, value: string) => {
    const ctl = FI(label).locator('input').first();
    await ctl.click({ timeout: 8000 });
    await ctl.fill(value);
    await ctl.press('Enter');
    await sleep(500);
    const got = await ctl.inputValue();
    seq++;
    const rect = await measureDlgField(page, label, 'input');
    log.push({ seq, group: '关联人信息修改', label, req: true, type: 'input', action: 'input', value, ok: got === value, rect });
    console.log(`S9_FILL seq=${seq} ${label} = ${value} ok=${got === value ? 1 : 0}`);
    expect(got === value, `${label} 回读一致`).toBeTruthy();
  };
  const dlgSelect = async (label: string, opt: string) => {
    const loc = FI(label);
    await loc.locator('.el-select').first().click({ timeout: 8000 });
    const dd = page.locator('.el-select-dropdown:visible').last();
    await dd.waitFor({ state: 'visible', timeout: 8000 });
    await dd.locator('.el-select-dropdown__item').filter({ hasText: opt }).first().click({ timeout: 8000 });
    await sleep(900);
    const got = (await loc.locator('.el-input__inner').first().inputValue()).trim();
    seq++;
    const rect = await measureDlgField(page, label, 'select');
    log.push({ seq, group: '关联人信息修改', label, req: true, type: 'select', action: 'select', value: opt, ok: got.includes(opt), rect });
    console.log(`S9_FILL seq=${seq} ${label} = ${opt} ok=${got.includes(opt) ? 1 : 0}`);
    expect(got.includes(opt), `${label} 选择生效`).toBeTruthy();
  };

  // ---------- 5) 改 6 项（异值，格式合规） ----------
  await dlgInput('联系电话', NEW.mobile);
  await dlgInput('居住地址', NEW.addr);
  await dlgSelect('职称', NEW.rank);
  await dlgInput('单位电话', NEW.tel);
  await dlgInput('工作单位', NEW.org);
  await dlgInput('工作简历描述', NEW.resume);

  // ---------- 6) 确定保存 ----------
  const confirmRect = await measureDlgBtn(page, '确定');
  const saveP = page
    .waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('custCorporatRelatedParty') && !/query|\/get/i.test(r.url()), { timeout: 30000 })
    .catch(() => null);
  await dlg().getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(3500);
  const saveResp = await saveP;
  const saveBody = saveResp ? await saveResp.json().catch(() => ({})) : {};
  console.log('S9_SAVE_API=', saveResp ? saveResp.url().split('/').filter(Boolean).slice(-2).join('/') : 'none', 'code=', saveBody?.code ?? saveBody?.status);
  const notif = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-notification, .el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean)
  );
  console.log('S9_TOASTS=', JSON.stringify(notif));
  const dlgGone = (await page.locator(D).count()) === 0;
  expect(dlgGone || notif.some((n) => /成功/.test(n)), '保存成功（弹窗关闭或成功提示）').toBeTruthy();
  if (saveResp) {
    const code = saveBody?.code ?? saveBody?.status;
    expect(code === 0 || code === '0' || code === 200 || code === '200', '保存接口成功码').toBeTruthy();
  }

  // ---------- 7) 查看核对持久化（两行同名：逐行查看直到联系电话==新值） ----------
  await sleep(2500);
  const viewBtn = pane.getByRole('button').filter({ hasText: /查\s*看/ }).first();
  const viewBtnRect = await viewBtn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  const nRows = await rpRows().count();
  let verified = -1;
  for (let i = 0; i < nRows; i++) {
    await rpRows().nth(i).locator('input[type="radio"]').first().evaluate((el) => el.click());
    await sleep(800);
    await viewBtn.click();
    await sleep(3000);
    const vDlg = () => page.locator(D).last();
    const vFI = (lb: string) => vDlg().locator('.el-form-item').filter({ hasText: lb }).first();
    const mobileGot = (await vFI('联系电话').locator('input, textarea').first().inputValue()).trim();
    console.log(`S9_VERIFY row=${i} 联系电话=${mobileGot}`);
    if (mobileGot === NEW.mobile) {
      verified = i;
      expect((await vFI('居住地址').locator('input, textarea').first().inputValue()).trim(), '持久化-居住地址').toBe(NEW.addr);
      expect((await vFI('单位电话').locator('input, textarea').first().inputValue()).trim(), '持久化-单位电话').toBe(NEW.tel);
      expect((await vFI('工作单位').locator('input, textarea').first().inputValue()).trim(), '持久化-工作单位').toBe(NEW.org);
      expect((await vFI('工作简历描述').locator('input, textarea').first().inputValue()).trim(), '持久化-工作简历描述').toBe(NEW.resume);
      const rankGot = (await vFI('职称').locator('.el-input__inner, input').first().inputValue()).trim();
      expect(rankGot.includes(NEW.rank), '持久化-职称').toBeTruthy();
      break;
    }
    await vDlg().getByRole('button').filter({ hasText: /取\s*消/ }).last().click();
    await sleep(1500);
  }
  expect(verified, '至少 1 行已持久化新值').toBeGreaterThanOrEqual(0);
  const cancelRect = await measureDlgBtn(page, '取消');
  await page.locator(D).last().getByRole('button').filter({ hasText: /取\s*消/ }).last().click().catch(() => {});
  await sleep(1500);

  // ---------- 8) 返回 + 列表反查 ----------
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30000 });
  await sleep(2500);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await expect(page.locator('.el-table__body-wrapper .el-table__body tbody tr').filter({ hasText: CUST_NO }).first(), '返回后列表反查命中客户').toBeVisible({ timeout: 30000 });

  // ---------- 9) 落盘 ----------
  const okCount = log.filter((l) => l.ok).length;
  fs.writeFileSync(path.join(DIR, 'filllog-S9.json'), JSON.stringify({ tag: 'S9', total: log.length, ok: okCount, items: log }, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(DIR, 's9-values.json'),
    JSON.stringify({ custNo: CUST_NO, old: OLD, new: NEW, editBtnRect, viewBtnRect, confirmRect, cancelRect, tabRect }, null, 2),
    'utf8',
  );
  console.log('S9_LOG total=', log.length, 'ok=', okCount);
});
