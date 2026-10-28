import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { measureDlgField, measureDlgBtn } from './fillEngine';
import type { FillLogEntry, DialogStep } from './fillEngine';

// S4 同业客户-股东信息修改（列表查询→修改→股东信息tab→选行→修改→改值→确定保存）
const CUST_NO = '260924144929974126';
// 股东指向真实对公法人客户（"修改"保存时后端反查关联客户注册资本；probe54 核实其注册资本=5,000,000 元）
const REAL_CST_NO = '260925231811601136'; // AT_正式_20260925151416
const REAL_USCC = '9135GY777T5GAYB86G'; // 该客户营业执照号码（18 位）
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = path.resolve(__dirname, '..', '..', 'work', 'smbsn');

const localTs = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

test('S4 同业客户-股东信息修改（选行→修改→全量改值→确定保存）', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const TS = localTs();
  const V = {
    custNo: CUST_NO,
    shName: `AT_SMB股东_${TS}`, // 改（唯一）
    shCustNo: REAL_CST_NO, // 改 → 真实对公法人客户编号(注册资本 500 万, 过"修改"路径反查校验)
    shUscc: REAL_USCC, // 改 → 该真实客户的营业执照号码(18 位)
    currency: '人民币', // 保持
    ratio: '20', // 改（原 10）
    investDate: '', // 改（异值，避免与预填同值不提交）—— 列表加载后填，营业日期内合法值
    subAmt: '2000000', // 改（原 1000000）
    paidAmt: '2000000', // 改
    remark: `AT_SMB股东修改备注_${TS.slice(8, 14)}`, // 改
  };
  console.log('S4_VALUES=', JSON.stringify(V));

  // ---------- 1) 列表: 客户编号查询 ----------
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  const bizDate = await page.evaluate(() => {
    const b = localStorage.getItem('businessDate');
    const d = b ? new Date(b) : null;
    return d && !isNaN(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  });
  // 改值弹窗预填出资时间=2026-09-01(带时分秒)；必须填异值才提交(同值不变更) → 取营业日期同年 8 月 15 日(合法区间内)
  V.investDate = `${(bizDate || TS).slice(0, 4)}-08-15`;
  console.log('S4_BIZ_DATE=', bizDate, '→ investDate=', V.investDate);

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

  // 股东客户编号+证件号码固定指向真实对公法人客户（不随意填写）
  console.log('S4_PARENT_USCC=', V.shUscc, 'cstNo=', V.shCustNo);

  // ---------- 3) 股东信息 tab ----------
  const tabRect = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.el-tabs__item')).find((x) => (x.innerText || '').trim() === '股东信息');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(3000);

  const pane = () => page.locator('.el-tab-pane:visible').last();
  const shRows = () => pane().locator('.el-table__body-wrapper .el-table__body tbody tr');
  const beforeCount = await shRows().count();
  expect(beforeCount, '股东表至少 1 行').toBeGreaterThan(0);
  const oldName = (await shRows().first().locator('td .cell').nth(3).innerText()).trim();
  console.log('S4_SH_ROWS_BEFORE=', beforeCount, 'OLD_NAME=', oldName);

  // ---------- 4) 选首行 radio + 工具栏修改 ----------
  const firstShRow = shRows().first();
  await firstShRow.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const shRadioRect = await firstShRow.locator('label.el-radio').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  const modBtn = pane().getByRole('button').filter({ hasText: /修\s*改/ }).first();
  const shModifyRect = await modBtn.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x1: (r.x / 1440).toFixed(4), y1: (r.y / 900).toFixed(4), x2: ((r.x + r.width) / 1440).toFixed(4), y2: ((r.y + r.height) / 900).toFixed(4) });
  });
  await modBtn.click();
  await page.waitForTimeout(2500);

  const D = '.el-dialog:visible';
  const FI = (lb: string) => page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first();
  expect(await page.locator(`${D} label`).filter({ hasText: '股东类型' }).count(), '修改弹窗已打开').toBeGreaterThan(0);

  const log: FillLogEntry[] = [];
  const steps: DialogStep[] = [];
  let seq = 0;
  const sleep = (ms: number) => page.waitForTimeout(ms);

  const dlgInput = async (label: string, value: string, kind: 'input' | 'textarea' = 'input'): Promise<void> => {
    const loc = FI(label);
    const ctl = loc.locator(kind === 'textarea' ? 'textarea' : 'input').first();
    await ctl.click({ timeout: 8000 });
    await ctl.fill(value);
    if (kind === 'input') await ctl.press('Enter');
    await sleep(500);
    const got = await ctl.inputValue();
    seq++;
    const rect = await measureDlgField(page, label, 'input');
    const entry: FillLogEntry = { seq, group: '股东信息修改', label, req: true, type: kind, action: kind === 'textarea' ? 'textarea' : 'input', value, ok: got === value, rect };
    if (!entry.ok) entry.note = `got=${got.slice(0, 40)}`;
    log.push(entry);
    steps.push({ dialog: '修改股东信息', action: kind === 'textarea' ? 'textarea' : 'input', target: label, value, rect });
    console.log(`S4_FILL seq=${seq} ${label} = ${value} ok=${entry.ok ? 1 : 0}`);
    expect(entry.ok, `${label} 回读一致`).toBeTruthy();
  };

  const dlgSelect = async (label: string, opt: string): Promise<void> => {
    const loc = FI(label);
    const dd = page.locator('.el-select-dropdown:visible').last();
    if (!(await dd.count())) {
      await loc.locator('.el-select').first().click({ timeout: 8000 });
      await dd.waitFor({ state: 'visible', timeout: 8000 });
    }
    await dd.locator('.el-select-dropdown__item').filter({ hasText: opt }).first().click({ timeout: 8000 });
    await sleep(900);
    const got = (await loc.locator('.el-input__inner').first().inputValue()).trim();
    seq++;
    const rect = await measureDlgField(page, label, 'select');
    const entry: FillLogEntry = { seq, group: '股东信息修改', label, req: true, type: 'select', action: 'select', value: opt, ok: got === opt, rect };
    if (!entry.ok) entry.note = `got=${got.slice(0, 40)}`;
    log.push(entry);
    steps.push({ dialog: '修改股东信息', action: 'select', target: label, value: opt, rect });
    console.log(`S4_FILL seq=${seq} ${label} = ${opt} ok=${entry.ok ? 1 : 0}`);
    expect(entry.ok, `${label} 选择生效`).toBeTruthy();
  };

  const readDateModel = async () =>
    page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('.el-dialog .el-date-editor')).find((i) => (i as HTMLElement).offsetParent !== null) as HTMLElement | undefined;
      if (!el) return 'NO_INPUT';
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      let v: any = (el as any).__vue__;
      for (let i = 0; i < 8 && v; i++) {
        if (v.parsedValue !== undefined || v.valueFormat !== undefined || (v.value && v.value instanceof Date)) {
          const m = v.value;
          if (!m) return '';
          // 改值弹窗预填值带时分秒("2026-09-01 00:00:00")，比较取日期部分
          return m instanceof Date ? fmt(m) : String(m).slice(0, 10);
        }
        v = v.$parent;
      }
      return 'NO_PICKER';
    });

  const dlgDate = async (label: string, value: string): Promise<void> => {
    const loc = FI(label);
    const inp = loc.locator('input').first();
    await inp.click({ timeout: 8000 });
    await inp.fill(value);
    await inp.press('Enter');
    await sleep(800);
    const panel = page.locator('.el-picker-panel:visible');
    if (await panel.count()) {
      await FI('认缴出资额(元)').locator('label').first().click({ timeout: 5000 }).catch(() => {});
      await sleep(400);
    }
    if ((await readDateModel()) !== value) {
      console.log('S4_DATE model 未生效 → 面板点选兜底');
      if (!(await panel.count())) {
        await inp.click({ timeout: 8000 });
        await panel.first().waitFor({ state: 'visible', timeout: 8000 });
      }
      await panel.first().locator('.el-date-table td').filter({ hasText: new RegExp(`^\\s*${value.slice(8, 10)}\\s*$`) }).first().click({ timeout: 8000 });
      await sleep(700);
      if (await panel.count()) await page.keyboard.press('Escape');
      await sleep(400);
    }
    const got = (await inp.inputValue()).trim();
    const model = await readDateModel();
    if (model !== value) console.log('S4_DATE model=', model);
    seq++;
    const rect = await measureDlgField(page, label, 'input');
    const entry: FillLogEntry = { seq, group: '股东信息修改', label, req: true, type: 'date', action: 'date', value, ok: got === value && model === value, rect };
    if (!entry.ok) entry.note = `got=${got.slice(0, 20)} model=${String(model).slice(0, 20)}`;
    log.push(entry);
    steps.push({ dialog: '修改股东信息', action: 'input', target: label, value, rect });
    console.log(`S4_FILL seq=${seq} ${label} = ${value} ok=${entry.ok ? 1 : 0}`);
    expect(entry.ok, `${label} 日期回读一致`).toBeTruthy();
  };

  // ---------- 5) 全量改值（12 项） ----------
  await dlgSelect('股东类型', '法人或其他组织');
  await dlgInput('股东名称', V.shName);
  await dlgInput('股东客户编号', V.shCustNo);
  await dlgSelect('证件类型', '营业执照');
  await dlgInput('证件号码', V.shUscc);
  await dlgSelect('币种', V.currency);
  await dlgInput('持股比例', V.ratio);
  await dlgSelect('出资方式', '货币');
  await dlgDate('出资时间', V.investDate);
  await dlgInput('认缴出资额(元)', V.subAmt);
  await dlgInput('实缴出资额（元）', V.paidAmt);
  await dlgInput('备注', V.remark, 'textarea');
  await page.screenshot({ path: path.join(DIR, 's4_20_filled.png') });

  // ---------- 6) 确定 + 校验修正重试 ----------
  const confirmBtn = page.getByRole('button').filter({ hasText: /确\s*定/ }).last();
  const confirmRect = await measureDlgBtn(page, '确定');
  steps.push({ dialog: '修改股东信息', action: 'click', target: '确定', value: '', rect: confirmRect });

  let saved = false;
  let lastMsgs: string[] = [];
  for (let attempt = 1; attempt <= 3 && !saved; attempt++) {
    const respP = page
      .waitForResponse(
        (r) => r.request().method() === 'POST' && /custCorporatRelatedParty|shareholder|shrh/i.test(r.url()) && !/query|\/get/i.test(r.url()),
        { timeout: 25000 },
      )
      .catch(() => null);
    await confirmBtn.click();
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => ({
      formErrors: Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
      msgs: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
      dlgOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
    }));
    const resp = await respP;
    if (state.dlgOpen === 0) {
      const code = resp ? (await resp.json().catch(() => ({})))?.code : null;
      console.log(`S4_CONFIRM attempt=${attempt} SAVED resp=${resp ? resp.url().split('/').pop() : 'none'} code=${code}`);
      expect(code ?? 0, '保存接口 code=0').toBe(0);
      saved = true;
      break;
    }
    lastMsgs = [...state.formErrors, ...state.msgs];
    console.log(`S4_CONFIRM attempt=${attempt} VALIDATION_FAIL=`, JSON.stringify(lastMsgs));
    for (const m of lastMsgs) {
      if (m.includes('股东客户编号') || m.includes('客户编号')) { V.shCustNo = ''; }
      else if (m.includes('股东名称')) { V.shName = `AT_SMB股东_${TS}_${attempt}`; }
      else if (m.includes('证件号码')) { /* 保持真实对公客户 USCC，不随意更换 */ }
      else if (m.includes('营业日期')) { V.investDate = bizDate; }
    }
    const reFill = (label: string, m: string) => {
      if (!m.includes(label)) return Promise.resolve();
      switch (label) {
        case '股东名称': return dlgInput('股东名称', V.shName);
        case '股东客户编号': return V.shCustNo ? dlgInput('股东客户编号', V.shCustNo) : FI('股东客户编号').locator('input').first().fill('');
        case '证件类型': return dlgSelect('证件类型', '营业执照');
        case '证件号码': return dlgInput('证件号码', V.shUscc);
        case '币种': return dlgSelect('币种', V.currency);
        case '持股比例': return dlgInput('持股比例', V.ratio);
        case '出资方式': return dlgSelect('出资方式', '货币');
        case '出资时间':
        case '出资日期': return dlgDate('出资时间', V.investDate);
        case '认缴出资额': return dlgInput('认缴出资额(元)', V.subAmt);
        case '实缴出资额': return dlgInput('实缴出资额（元）', V.paidAmt);
        default: return Promise.resolve();
      }
    };
    for (const m of lastMsgs) {
      await reFill('股东名称', m);
      await reFill('股东客户编号', m);
      await reFill('证件类型', m);
      await reFill('证件号码', m);
      await reFill('币种', m);
      await reFill('持股比例', m);
      await reFill('出资方式', m);
      await reFill('出资时间', m);
      await reFill('出资日期', m);
      await reFill('认缴出资额', m);
      await reFill('实缴出资额', m);
    }
  }
  expect(saved, `确定保存成功（最后错误=${JSON.stringify(lastMsgs)}）`).toBeTruthy();

  // ---------- 7) 断言: 行被更新（同名新值出现，行数不变） ----------
  await page.waitForTimeout(2500);
  const afterCount = await shRows().count();
  console.log('S4_SH_ROWS_AFTER=', afterCount);
  expect(afterCount, '修改不增行').toBe(beforeCount);
  const newRow = shRows().filter({ hasText: V.shName });
  expect(await newRow.count(), '新股东名称已落表').toBeGreaterThan(0);
  const newRowVals = await newRow.first().locator('td .cell').allInnerTexts();
  console.log('S4_UPDATED_ROW=', JSON.stringify(newRowVals.map((s) => s.trim().slice(0, 30))));

  // ---------- 8) 落盘 ----------
  const okCount = log.filter((l) => l.ok).length;
  fs.writeFileSync(path.join(DIR, 'filllog-S4.json'), JSON.stringify({ tag: 'S4', total: log.length, ok: okCount, items: log }, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(DIR, 's4-values.json'),
    JSON.stringify({ ...V, oldName, listNoRect, tabRect, shRadioRect, shModifyRect, confirmRect, beforeCount, afterCount, shRows: newRowVals.map((s) => s.trim()) }, null, 2),
    'utf8',
  );
  console.log('S4_LOG total=', log.length, 'ok=', okCount);
});
