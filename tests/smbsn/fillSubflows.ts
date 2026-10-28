// fillSubflows.ts - 同业客户场景页 3 个【引入】子流程：调查机构 / 法定代表人(客户放大镜) / 登记注册地址(五级级联)
import { Page } from '@playwright/test';
import {
  evalClickItemBtn, itemValue, type DialogStep, type FillCtx,
  measureItemBtn, measureDlgField, measureDlgBtn
} from './fillEngine';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normBtn = (s: string) => s.replace(/\s/g, '');

// edit 模式: 在引入弹窗表格中选一个「与当前字段值不同」的行, 保证真的换了对象
// cur 为空(字段原为空)时直接选首行; 所有行都含 cur 时退回首行(数据受限)
async function pickRowDiffersFrom(page: Page, dlg: ReturnType<Page['locator']>, rows: number, cur: string): Promise<number> {
  if (!cur) return 0;
  for (let i = 0; i < rows; i++) {
    const t = (((await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(i).innerText().catch(() => '')) || '').replace(/\s+/g, ' '));
    if (t.includes(cur)) continue;
    return i;
  }
  return 0;
}

// 行 Radio 选中：Playwright 点 label 会被拦截，必须 DOM 直点 input[type=radio]，成功标志是 tr 带 current-row
async function selectRowRadio(page: Page, row: ReturnType<Page['locator']>): Promise<boolean> {
  const inp = row.locator('input[type="radio"]').first();
  if (await inp.count().catch(() => 0)) {
    await inp.evaluate((el: any) => el.click()).catch(() => {});
  } else {
    await row.click({ timeout: 5000 }).catch(() => {});
  }
  await sleep(600);
  const cls = (await row.getAttribute('class').catch(() => '')) || '';
  return cls.includes('current-row');
}

export async function fillImport(page: Page, label: string, ctx: FillCtx): Promise<{ ok: boolean; note: string; steps: DialogStep[] }> {
  if (label === '银行行号') return { ok: false, note: 'BANKNO_NO_DATA(测试环境分行主数据表为空,无行可选)', steps: [] };
  if (label === '调查机构') return fillOrgIntro(page, label, ctx);
  if (label === '法定代表人/负责人姓名') return fillPersonalIntro(page, label, ctx);
  if (label === '登记注册地址') return fillAddressIntro(page, label, ctx);
  return fillOrgIntro(page, label, ctx);
}

// 打开引入弹窗通用前置：点击[引入]并等待 .el-dialog:visible
async function openIntroDialog(page: Page, label: string, steps: DialogStep[]): Promise<{ dlg: ReturnType<Page['locator']>; err: string }> {
  const rOpen = await measureItemBtn(page, label, '引入');
  const cr = await evalClickItemBtn(page, label, '引入');
  if (cr.startsWith('NO_')) return { dlg: page.locator('none'), err: cr };
  steps.push({ dialog: '引入', action: 'click', target: '打开[引入]', rect: rOpen });
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 }).catch(() => {});
  await sleep(1500);
  const dlg = page.locator('.el-dialog:visible').last();
  if (!(await dlg.count())) return { dlg: page.locator('none'), err: 'INTRO_NO_DIALOG' };
  return { dlg, err: '' };
}

// 调查机构：默认已列 33 条(9881**银行股份有限公司…) -> 选中首行 Radio -> 确认 -> 回写机构名称
// edit 模式：选第 2 行(与当前已挂接机构不同, 证明真的改了)
async function fillOrgIntro(page: Page, label: string, ctx: FillCtx): Promise<{ ok: boolean; note: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlgName = '调查机构查询';
  const { dlg, err } = await openIntroDialog(page, label, steps);
  if (err) return { ok: false, note: err, steps };
  let rows = 0;
  let picked = '';
  try {
    rows = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  } catch {}
  if (rows === 0) {
    // 默认无数据则按机构名称"银行"查询
    const rNm = await measureDlgField(page, '机构名称', 'input');
    await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '机构名称' }) }).locator('input').first().fill('银行', { timeout: 8000 }).catch(() => {});
    steps.push({ dialog: dlgName, action: 'input', target: '机构名称', value: '银行', rect: rNm });
    const rQ = await measureDlgBtn(page, '查询');
    steps.push({ dialog: dlgName, action: 'click', target: '查询', rect: rQ });
    const qP = page.waitForResponse((r) => r.url().includes('findAllOrgPage'), { timeout: 15000 }).catch(() => null);
    await dlg.getByRole('button').filter({ hasText: normBtn('查询') }).first().click({ timeout: 8000 });
    await qP;
    await sleep(2000);
    rows = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  }
  let pickedOk = false;
  let rowIdx = 0;
  if (ctx.mode === 'edit' && rows > 1) rowIdx = await pickRowDiffersFrom(page, dlg, rows, await itemValue(page, label));
  if (rows > 0) {
    const row = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(rowIdx);
    pickedOk = await selectRowRadio(page, row);
    picked = (((await row.innerText().catch(() => '')) || '').replace(/\s+/g, ' ')).slice(0, 30);
  }
  const rOk = await measureDlgBtn(page, '确认');
  steps.push({ dialog: dlgName, action: 'click', target: '确认', value: 'rows=' + rows + ' rowIdx=' + rowIdx + (picked ? ' pick=' + picked : '') + (pickedOk ? ' picked=1' : ' picked=0'), rect: rOk });
  await dlg.getByRole('button').filter({ hasText: normBtn('确认') }).first().click({ timeout: 8000 });
  await sleep(1500);
  const closed = await page.evaluate(() => !Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  const v = await itemValue(page, label);
  if (!closed) return { ok: false, note: 'ORG_DLG_STUCK rows=' + rows, steps };
  return { ok: true, note: 'org_rows=' + rows + ' rowIdx=' + rowIdx + ' write=' + v.slice(0, 30), steps };
}

// 法定代表人/负责人姓名：客户放大镜(默认 0 条) -> 按客户名称查询 -> 有行选首行,无行直接确认 -> 回写法代姓名
// edit 模式：选第 2 行(与当前法代不同)
async function fillPersonalIntro(page: Page, label: string, ctx: FillCtx): Promise<{ ok: boolean; note: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlgName = '客户放大镜';
  const { dlg, err } = await openIntroDialog(page, label, steps);
  if (err) return { ok: false, note: err, steps };
  const rNm = await measureDlgField(page, '客户名称', 'input');
  await dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).locator('input').first().fill('黄', { timeout: 8000 }).catch(() => {});
  steps.push({ dialog: dlgName, action: 'input', target: '客户名称', value: '黄', rect: rNm });
  const rQ = await measureDlgBtn(page, '查询');
  steps.push({ dialog: dlgName, action: 'click', target: '查询', rect: rQ });
  const qP = page.waitForResponse((r) => r.url().includes('queryPersonalMagnifierList'), { timeout: 15000 }).catch(() => null);
  await dlg.getByRole('button').filter({ hasText: normBtn('查询') }).first().click({ timeout: 8000 });
  const qRes = await qP;
  let total = -1;
  if (qRes) {
    try { const j = await qRes.json(); total = (j && j.data && j.data.total) ?? -1; } catch {}
  }
  await sleep(2000);
  let rows = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  if (rows === 0) {
    // 无"黄"则空条件再查一次
    const rQ2 = await measureDlgBtn(page, '查询');
    steps.push({ dialog: dlgName, action: 'click', target: '查询(空条件)', value: 'prev_total=' + total, rect: rQ2 });
    const qP2 = page.waitForResponse((r) => r.url().includes('queryPersonalMagnifierList'), { timeout: 15000 }).catch(() => null);
    await dlg.getByRole('button').filter({ hasText: normBtn('查询') }).first().click({ timeout: 8000 });
    const qRes2 = await qP2;
    if (qRes2) {
      try { const j = await qRes2.json(); total = (j && j.data && j.data.total) ?? total; } catch {}
    }
    await sleep(2000);
    rows = await dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  }
  let pickedOk = false;
  let rowIdx = 0;
  if (ctx.mode === 'edit' && rows > 1) rowIdx = await pickRowDiffersFrom(page, dlg, rows, await itemValue(page, label));
  if (rows > 0) {
    const row = dlg.locator('.el-table__body-wrapper .el-table__body tbody tr').nth(rowIdx);
    pickedOk = await selectRowRadio(page, row);
  }
  const rOk = await measureDlgBtn(page, '确认');
  steps.push({ dialog: dlgName, action: 'click', target: '确认', value: 'rows=' + rows + ' total=' + total + ' rowIdx=' + rowIdx + (rows ? ' picked=' + (pickedOk ? 1 : 0) : ''), rect: rOk });
  await dlg.getByRole('button').filter({ hasText: normBtn('确认') }).first().click({ timeout: 8000 }).catch(() => {});
  await sleep(1500);
  let closed = await page.evaluate(() => !Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  if (!closed) {
    const rCx = await measureDlgBtn(page, '取消');
    steps.push({ dialog: dlgName, action: 'click', target: '取消(确认未关闭)', rect: rCx });
    await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: normBtn('取消') }).first().click({ timeout: 5000 }).catch(() => page.keyboard.press('Escape'));
    await sleep(1000);
    closed = await page.evaluate(() => !Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  }
  const v = await itemValue(page, label);
  if (!closed) return { ok: false, note: 'PERS_DLG_STUCK rows=' + rows, steps };
  return { ok: true, note: 'pers_rows=' + rows + ' total=' + total + ' write=' + v.slice(0, 30), steps };
}

// 登记注册地址：省份->城市->区/县->乡镇/街道->行政村/社区 五级级联 + 详细地址 -> 确认 -> 回写完整地址
async function fillAddressIntro(page: Page, label: string, ctx: FillCtx): Promise<{ ok: boolean; note: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlgName = '登记注册地址五级联动';
  const { dlg, err } = await openIntroDialog(page, label, steps);
  if (err) return { ok: false, note: err, steps };
  const dIt = (lb: string) => dlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  const pickOpt = async (field: string, rField: string, prefer?: string, skip?: string) => {
    await page
      .locator('.el-select-dropdown:visible .el-select-dropdown__item')
      .first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .catch(() => {});
    const opts = page.locator('.el-select-dropdown:visible .el-select-dropdown__item');
    const n = await opts.count();
    let idx = -1;
    let txt = '';
    for (let i = 0; i < n; i++) {
      const t = (((await opts.nth(i).innerText().catch(() => '')) || '').trim());
      if (skip && t.includes(skip)) continue;
      if (prefer && t.includes(prefer)) { idx = i; txt = t; break; }
      if (!prefer && t && t !== '其他') { idx = i; txt = t; break; }
    }
    if (idx < 0 && n > 0) { idx = 0; txt = ((await opts.nth(0).innerText().catch(() => '')) || '').trim(); }
    if (idx < 0) return null;
    await opts.nth(idx).click({ timeout: 8000 });
    steps.push({ dialog: dlgName, action: 'select', target: field, value: txt.slice(0, 20), rect: rField });
    return txt.slice(0, 20);
  };
  // edit 模式：当前地址在广西, 换省(跳过广西)才是真修改
  const levels: [string, number, string?, string?][] = [
    ['省份', 2000, ctx.mode === 'edit' ? undefined : '广西', ctx.mode === 'edit' ? '广西' : undefined],
    ['城市', 2500],
    ['区/县', 2500],
    ['乡镇/街道', 2500],
    ['行政村/社区', 1500],
  ];
  // 级联某级无选项(如保税区无村级)或不可点时优雅结束
  try {
    for (const [field, wait, prefer, skip] of levels) {
      const rF = await measureDlgField(page, field, 'select');
      await dIt(field).locator('.el-select, input').first().click({ timeout: 8000 }).catch(() => {});
      await sleep(1500);
      const picked = await pickOpt(field, rF, prefer, skip).catch(() => null);
      console.log(`ADDR_DBG pick=${field} picked=${picked}`);
      if (!picked) break;
      await sleep(wait);
    }
  } catch (e: any) {
    return { ok: false, note: 'ADR_SEL:' + e.message.slice(0, 60), steps };
  }
  console.log('ADDR_DBG before header click, legal=' + (await itemValue(page, '法定代表人/负责人姓名').catch(() => '?')));
  await dlg.locator('.el-dialog__header').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(400);
  console.log('ADDR_DBG after header click, legal=' + (await itemValue(page, '法定代表人/负责人姓名').catch(() => '?')));
  const rDetail = await measureDlgField(page, '详细地址', 'input');
  await dIt('详细地址').locator('input, textarea').first().fill(ctx.addrDetail, { timeout: 8000 }).catch(() => {});
  steps.push({ dialog: dlgName, action: 'input', target: '详细地址', value: ctx.addrDetail, rect: rDetail });
  await sleep(400);
  console.log('ADDR_DBG before confirm, legal=' + (await itemValue(page, '法定代表人/负责人姓名').catch(() => '?')));
  const rOk = await measureDlgBtn(page, '确认');
  steps.push({ dialog: dlgName, action: 'click', target: '确认', rect: rOk });
  await dlg.getByRole('button').filter({ hasText: normBtn('确认') }).first().click({ timeout: 8000 });
  await sleep(1500);
  console.log('ADDR_DBG after confirm, legal=' + (await itemValue(page, '法定代表人/负责人姓名').catch(() => '?')));
  const closed = await page.evaluate(() => !Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null));
  const v = await itemValue(page, label);
  if (!closed || !v) return { ok: false, note: 'ADR_NO_WRITEBACK val=' + v.slice(0, 30), steps };
  return { ok: true, note: 'addr:' + v.slice(0, 40), steps };
}
