import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { measureDlgField, measureDlgBtn } from './fillEngine';
import type { FillLogEntry, DialogStep } from './fillEngine';

// S8 同业客户-关联人信息新增（列表查询→修改→关联人tab→新增→引入真实对私客户→按格式填值→确定保存）
const CUST_NO = '260924144929974126';
// 关联客户=真实对私客户（引入弹窗走对私放大镜 custPersonal/queryPersonalMagnifierList；数据按身份证格式要求）
const IMP_NM = 'AT_正式_20260923110954';
const IMP_NO = '260923191355585114';
const IMP_ID = '110101198501239591'; // 居民身份证 18 位；17 位奇数→男性；出生日期=1985-01-23
const IMP_BIRTH = '1985-01-23';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');

test('S8 同业客户-关联人信息新增（引入对私客户→按格式填 17 项→确定保存）', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const V = {
    custNo: CUST_NO,
    impNm: IMP_NM,
    impNo: IMP_NO,
    execv: '董事长',
    crdtTp: '居民身份证',
    crdtNo: IMP_ID,
    mobile: '13988158428',
    gender: '男性',
    birth: IMP_BIRTH,
    job: '专业技术人员',
    duty: '其他',
    rank: '中级',
    edu: '大学本科毕业',
    degree: '学士',
    addr: '广西壮族自治区南宁市青秀区测试路1号',
    tel: '0771-1234568',
    org: 'AT测试银行有限责任公司',
    resume: 'AT测试关联人工作简历描述',
  };
  console.log('S8_VALUES=', JSON.stringify(V));

  // ---------- 1) 列表: 客户编号查询 ----------
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  const listNoRect = await page.evaluate(() => {
    const f = Array.from(document.querySelectorAll('.el-form-item')).find((x) => (x.querySelector('label') || {}).innerText?.trim() === '客户编号');
    const inp = f?.querySelector('input') as HTMLElement | null;
    if (!inp) return null;
    const r = inp.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  const formItem = (lb: string) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const qResp = await qP;
  const qBody = await qResp.json().catch(() => ({}));
  expect(qBody?.data?.total, '列表查询 total=1').toBe(1);

  // ---------- 2) 行 radio + 修改（进场景页） ----------
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('getCustTrade') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await getCustP;
  await page.waitForTimeout(4000);

  // ---------- 3) 关联人信息 tab ----------
  const tabRect = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.el-tabs__item')).find((x) => (x.innerText || '').trim() === '关联人信息');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await page.locator('.el-tabs__item').filter({ hasText: '关联人信息' }).first().click();
  await page.waitForTimeout(3000);

  const pane = () => page.locator('.el-tab-pane:visible').last();
  const rpRows = () => pane().locator('.el-table__body-wrapper .el-table__body tbody tr');
  const beforeCount = await rpRows().count();
  console.log('S8_ROWS_BEFORE=', beforeCount);

  // ---------- 4) 新增 ----------
  const addBtn = pane().getByRole('button').filter({ hasText: /新\s*增/ }).first();
  const addRect = await addBtn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await addBtn.click();
  await page.waitForTimeout(2500);

  const D = '.el-dialog:visible';
  const dlg = () => page.locator(D).last();
  const FI = (lb: string) => dlg().locator('.el-form-item').filter({ hasText: lb }).first();
  expect(await dlg().locator('label').filter({ hasText: '高管类别' }).count(), '新增弹窗已打开').toBeGreaterThan(0);

  const log: FillLogEntry[] = [];
  const steps: DialogStep[] = [];
  let seq = 0;
  const sleep = (ms: number) => page.waitForTimeout(ms);

  const dlgSelect = async (label: string, opt: string): Promise<void> => {
    const loc = FI(label);
    await loc.locator('.el-select').first().click({ timeout: 8000 });
    const dd = page.locator('.el-select-dropdown:visible').last();
    await dd.waitFor({ state: 'visible', timeout: 8000 });
    await dd.locator('.el-select-dropdown__item').filter({ hasText: opt }).first().click({ timeout: 8000 });
    await sleep(900);
    const got = (await loc.locator('.el-input__inner').first().inputValue()).trim();
    seq++;
    const rect = await measureDlgField(page, label, 'select');
    const entry: FillLogEntry = { seq, group: '关联人信息新增', label, req: true, type: 'select', action: 'select', value: opt, ok: got.includes(opt), rect };
    if (!entry.ok) entry.note = `got=${got.slice(0, 40)}`;
    log.push(entry);
    steps.push({ dialog: '新增关联人信息', action: 'select', target: label, value: opt, rect });
    console.log(`S8_FILL seq=${seq} ${label} = ${opt} ok=${entry.ok ? 1 : 0}`);
    expect(entry.ok, `${label} 选择生效`).toBeTruthy();
  };

  const dlgInput = async (label: string, value: string): Promise<void> => {
    const ctl = FI(label).locator('input').first();
    await ctl.click({ timeout: 8000 });
    await ctl.fill(value);
    await ctl.press('Enter');
    await sleep(500);
    const got = await ctl.inputValue();
    seq++;
    const rect = await measureDlgField(page, label, 'input');
    const entry: FillLogEntry = { seq, group: '关联人信息新增', label, req: true, type: 'input', action: 'input', value, ok: got === value, rect };
    if (!entry.ok) entry.note = `got=${got.slice(0, 40)}`;
    log.push(entry);
    steps.push({ dialog: '新增关联人信息', action: 'input', target: label, value, rect });
    console.log(`S8_FILL seq=${seq} ${label} = ${value} ok=${entry.ok ? 1 : 0}`);
    expect(entry.ok, `${label} 回读一致`).toBeTruthy();
  };

  const readDateModel = async () =>
    page.evaluate(() => {
      const d = Array.from(document.querySelectorAll('.el-dialog')).find((x) => x.offsetParent !== null) as HTMLElement | undefined;
      const el = d ? (Array.from(d.querySelectorAll('.el-date-editor')).find((i) => (i as HTMLElement).offsetParent !== null) as HTMLElement | undefined) : undefined;
      if (!el) return 'NO_INPUT';
      const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      let v: any = (el as any).__vue__;
      for (let i = 0; i < 8 && v; i++) {
        if (v.parsedValue !== undefined || v.valueFormat !== undefined || (v.value && v.value instanceof Date)) {
          const m = v.value;
          if (!m) return '';
          return m instanceof Date ? fmt(m) : String(m).slice(0, 10);
        }
        v = v.$parent;
      }
      return 'NO_PICKER';
    });

  const dlgDate = async (label: string, value: string): Promise<void> => {
    const inp = FI(label).locator('input').first();
    await inp.click({ timeout: 8000 });
    await inp.fill(value);
    await inp.press('Enter');
    await sleep(800);
    const panel = page.locator('.el-picker-panel:visible');
    if (await panel.count()) {
      await FI('联系电话').locator('label').first().click({ timeout: 5000 }).catch(() => {});
      await sleep(400);
    }
    if ((await readDateModel()) !== value) {
      console.log('S8_DATE model 未生效 → 面板点选兜底');
      if (!(await panel.count())) {
        await inp.click({ timeout: 8000 });
        await panel.first().waitFor({ state: 'visible', timeout: 8000 });
      }
      const dayRe = new RegExp('^\\s*' + value.slice(8, 10) + '\\s*$');
      await panel.first().locator('.el-date-table td').filter({ hasText: dayRe }).first().click({ timeout: 8000 });
      await sleep(700);
      if (await panel.count()) await page.keyboard.press('Escape');
      await sleep(400);
    }
    const got = (await inp.inputValue()).trim();
    const model = await readDateModel();
    seq++;
    const rect = await measureDlgField(page, label, 'input');
    const entry: FillLogEntry = { seq, group: '关联人信息新增', label, req: true, type: 'date', action: 'date', value, ok: got === value && model === value, rect };
    if (!entry.ok) entry.note = `got=${got.slice(0, 20)} model=${String(model).slice(0, 20)}`;
    log.push(entry);
    steps.push({ dialog: '新增关联人信息', action: 'input', target: label, value, rect });
    console.log(`S8_FILL seq=${seq} ${label} = ${value} ok=${entry.ok ? 1 : 0}`);
    expect(entry.ok, `${label} 日期回读一致`).toBeTruthy();
  };

  // ---------- 5) 高管类别（tssc-multi-select：点选项后 Esc 收起） ----------
  const execvItem = FI('高管类别');
  await execvItem.locator('.el-select').first().click({ timeout: 8000 });
  const execvDd = page.locator('.el-select-dropdown:visible').last();
  await execvDd.waitFor({ state: 'visible', timeout: 8000 });
  await execvDd.locator('.el-select-dropdown__item').filter({ hasText: V.execv }).first().click({ timeout: 8000 });
  await sleep(600);
  await page.keyboard.press('Escape');
  await sleep(500);
  const execvGot = (await execvItem.locator('.el-input__inner').first().inputValue()).trim();
  seq++;
  const execvRect = await measureDlgField(page, '高管类别', 'select');
  log.push({ seq, group: '关联人信息新增', label: '高管类别', req: true, type: 'select', action: 'select', value: V.execv, ok: execvGot.includes(V.execv), rect: execvRect });
  steps.push({ dialog: '新增关联人信息', action: 'select', target: '高管类别', value: V.execv, rect: execvRect });
  console.log(`S8_FILL seq=${seq} 高管类别 = ${V.execv} ok=${execvGot.includes(V.execv) ? 1 : 0}`);
  expect(execvGot.includes(V.execv), '高管类别 选择生效').toBeTruthy();

  // ---------- 6) 引入关联客户（对私放大镜：客户名称→查询→选行→确认） ----------
  const impBtnRect = await FI('关联客户名称').locator('button').filter({ hasText: /引\s*入/ }).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  steps.push({ dialog: '新增关联人信息', action: 'click', target: '引入关联客户', value: '', rect: impBtnRect });
  await FI('关联客户名称').locator('button').filter({ hasText: /引\s*入/ }).first().click();
  await page.waitForTimeout(2500);

  const imp = page.locator(D).last();
  const impNmRect = await imp.locator('.el-form-item').filter({ hasText: '客户名称' }).first().locator('input').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await imp.locator('.el-form-item').filter({ hasText: '客户名称' }).first().locator('input').first().fill(V.impNm);
  const impQueryRect = await imp.getByRole('button').filter({ hasText: /查\s*询/ }).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  steps.push({ dialog: '引入客户', action: 'input', target: '客户名称', value: V.impNm, rect: impNmRect });
  steps.push({ dialog: '引入客户', action: 'click', target: '查询', value: '', rect: impQueryRect });
  const impQ = page.waitForResponse((r) => r.url().includes('queryPersonalMagnifierList') && r.request().method() === 'POST', { timeout: 30000 });
  await imp.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const impResp = await impQ;
  const impBody = await impResp.json().catch(() => ({}));
  console.log('S8_IMPORT_TOTAL=', impBody?.data?.total);
  await page.waitForTimeout(2000);
  const impRow = imp.locator('.el-table__body-wrapper .el-table__body tbody tr').filter({ hasText: V.impNo }).first();
  expect(await impRow.count(), '引入查询命中目标对私客户').toBe(1);
  const impRadioRect = await impRow.locator('input[type="radio"]').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await impRow.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const impConfirmRect = await imp.getByRole('button').filter({ hasText: /确\s*认/ }).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  steps.push({ dialog: '引入客户', action: 'click', target: '目标客户行单选', value: '', rect: impRadioRect });
  steps.push({ dialog: '引入客户', action: 'click', target: '确认', value: '', rect: impConfirmRect });
  await imp.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await page.waitForTimeout(2500);

  // 引入后自动回填核对
  const auto = await page.evaluate(() => {
    const d = Array.from(document.querySelectorAll('.el-dialog')).find((x) => x.offsetParent !== null && /dialog\d+/.test(x.className || ''));
    if (!d) return null;
    const o: Record<string, string> = {};
    for (const f of d.querySelectorAll('.el-form-item')) {
      const lb = ((f.querySelector('label') || {}).innerText || '').trim();
      if (!/关联客户|证件类型|证件号码/.test(lb)) continue;
      const inp = f.querySelector('input, textarea');
      o[lb] = inp ? (inp.value || '').trim() : '';
    }
    return o;
  });
  console.log('S8_AUTO_FILL=', JSON.stringify(auto));
  expect(auto?.['关联客户名称'], '引入回填关联客户名称').toBe(V.impNm);
  expect(auto?.['关联客户编号'], '引入回填关联客户编号').toBe(V.impNo);

  // ---------- 7) 其余字段（证件类型/号码若未回填则按身份证格式补填） ----------
  if (!auto?.['证件类型']) await dlgSelect('证件类型', V.crdtTp);
  if (!auto?.['证件号码']) await dlgInput('证件号码', V.crdtNo);
  await dlgInput('联系电话', V.mobile);
  await dlgSelect('性别', V.gender);
  await dlgDate('出生日期', V.birth);
  await dlgSelect('职业', V.job);
  await dlgSelect('职务名称', V.duty);
  await dlgSelect('职称', V.rank);
  await dlgSelect('最高学历', V.edu);
  await dlgSelect('最高学位', V.degree);
  await dlgInput('居住地址', V.addr);
  await dlgInput('单位电话', V.tel);
  await dlgInput('工作单位', V.org);
  await dlgInput('工作简历描述', V.resume);
  await page.screenshot({ path: path.join(DIR, 's8_filled.png') });

  // ---------- 8) 确定保存 ----------
  const confirmBtn = dlg().getByRole('button').filter({ hasText: /确\s*定/ }).last();
  const confirmRect = await measureDlgBtn(page, '确定');
  steps.push({ dialog: '新增关联人信息', action: 'click', target: '确定', value: '', rect: confirmRect });
  const saveP = page
    .waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('custCorporatRelatedParty') && !/query|\/get/i.test(r.url()), { timeout: 30000 })
    .catch(() => null);
  await confirmBtn.click();
  await page.waitForTimeout(3500);
  const saveResp = await saveP;
  const saveBody = saveResp ? await saveResp.json().catch(() => ({})) : {};
  console.log('S8_SAVE_API=', saveResp ? saveResp.url().split('/').filter(Boolean).slice(-2).join('/') : 'none', 'code=', saveBody?.code ?? saveBody?.status);
  const notif = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-notification, .el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean)
  );
  console.log('S8_TOASTS=', JSON.stringify(notif));
  const dlgGone = (await page.locator('.el-dialog:visible').count()) === 0;
  expect(dlgGone || notif.some((n) => /成功/.test(n)), '保存成功（弹窗关闭或成功提示）').toBeTruthy();
  if (saveResp) {
    const code = saveBody?.code ?? saveBody?.status;
    expect(code === 0 || code === '0' || code === 200 || code === '200', '保存接口成功码').toBeTruthy();
  }

  // ---------- 9) 断言: 关联人表 +1 且新行值正确 ----------
  await page.waitForTimeout(2500);
  const afterCount = await rpRows().count();
  console.log('S8_ROWS_AFTER=', afterCount);
  expect(afterCount, '新增后行数 +1').toBe(beforeCount + 1);
  const newRow = rpRows().filter({ hasText: V.impNm }).first();
  expect(await newRow.count(), '新关联人行已落表').toBe(1);
  const newRowVals = await newRow.locator('td .cell').allInnerTexts();
  console.log('S8_NEW_ROW=', JSON.stringify(newRowVals.map((s) => s.trim().slice(0, 30))));

  // ---------- 10) 返回 + 列表反查 ----------
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await page.waitForURL(/smbsnCstMgtPg/, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await expect(page.locator('.el-table__body-wrapper .el-table__body tbody tr').filter({ hasText: CUST_NO }).first(), '返回后列表反查命中客户').toBeVisible({ timeout: 30000 });

  // ---------- 11) 落盘 ----------
  const okCount = log.filter((l) => l.ok).length;
  fs.writeFileSync(path.join(DIR, 'filllog-S8.json'), JSON.stringify({ tag: 'S8', total: log.length, ok: okCount, items: log }, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(DIR, 's8-values.json'),
    JSON.stringify({ ...V, listNoRect, tabRect, addRect, impBtnRect, impNmRect, impQueryRect, impRadioRect, impConfirmRect, confirmRect, beforeCount, afterCount, newRowVals: newRowVals.map((s) => s.trim()) }, null, 2),
    'utf8',
  );
  console.log('S8_LOG total=', log.length, 'ok=', okCount);
});
