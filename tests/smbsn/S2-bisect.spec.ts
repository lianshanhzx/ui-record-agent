import { test, expect } from '@playwright/test';
import path from 'path';
import { inspectPage, runFillPlan, openAllSections, itemValue, randUscc, type FillCtx } from './fillEngine';

const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';
const LIST_API = (r: any) => r.url().includes('/tansun-tcp-cst/custTrade/findCustTradeList') && r.request().method() === 'POST';
const ROWS = '.el-table__body-wrapper .el-table__body tbody tr';
const formItem = (page: any, lb: string) =>
  page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('bisect v2 法代回滚', async ({ page }) => {
  test.setTimeout(600_000);
  const V = process.env.BIS_V || 'V1';
  await page.setViewportSize({ width: 1440, height: 900 });
  const listReady = page.waitForResponse(LIST_API, { timeout: 120_000 });
  await page.goto(LIST_ROUTE, { waitUntil: 'domcontentloaded' });
  await listReady;
  await expect(page.locator(ROWS).first()).toBeVisible({ timeout: 30_000 });
  await formItem(page, '客户编号').locator('input').first().fill(CUST_NO, { timeout: 10_000 });
  const qP = page.waitForResponse(LIST_API, { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(1500);
  const row = page.locator(ROWS).first();
  const rInp = row.locator('input[type="radio"]').first();
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el: any) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('/custTrade/getCustTrade') && r.request().method() === 'POST', { timeout: 90_000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await getCustP;
  await page.waitForTimeout(4000);

  await openAllSections(page);
  const plan = (await inspectPage(page)).map((it) =>
    it.label === '银行行号' ? { ...it, type: 'skip', skipNote: '不录' } : it
  );
  const LEGAL = '法定代表人/负责人姓名';
  const ADDR = '登记注册地址';
  const iLegal = plan.findIndex((p) => p.label === LEGAL);
  const iAddr = plan.findIndex((p) => p.label === ADDR);
  const byLabel = (lb: string) => plan.filter((p) => p.label === lb);

  let chunks: [string, typeof plan][];
  if (V === 'V1') {
    chunks = [
      ['C1(1..法代前)', plan.slice(0, iLegal)],
      ['C2(法代)', byLabel(LEGAL)],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V2') {
    // 仅 调查机构引入 在法代前
    chunks = [
      ['ORG(调查机构)', byLabel('调查机构')],
      ['C2(法代)', byLabel(LEGAL)],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V3') {
    // 仅 机构统一社会信用代码 在法代前
    chunks = [
      ['USCC(机构统一社会信用代码)', byLabel('机构统一社会信用代码')],
      ['C2(法代)', byLabel(LEGAL)],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V4') {
    // 法代前填 C1 但去掉 调查机构 和 机构统一社会信用代码
    const drop = new Set(['调查机构', '机构统一社会信用代码']);
    chunks = [
      ['C1nomin(1..法代前,去调查机构/USCC)', plan.slice(0, iLegal).filter((p) => !drop.has(p.label))],
      ['C2(法代)', byLabel(LEGAL)],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V5') {
    // C1 + 法代 + 仅营业执照 + 地址
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['C2(法代)', byLabel(LEGAL)],
      ['YZ(营业执照)', byLabel('营业执照')],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V6') {
    // C1 + 法代 + 仅注册资本 + 地址
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['C2(法代)', byLabel(LEGAL)],
      ['ZZ(注册资本金额)', byLabel('注册资本金额')],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V7') {
    // C1 + 法代 + 金融许可证号/地税/国税 + 地址
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['C2(法代)', byLabel(LEGAL)],
      ['JG(金融许可证号/地税/国税)', plan.filter((p) => ['金融许可证号', '地税登记证号码', '国税登记证号码'].includes(p.label))],
      ['C4(地址)', byLabel(ADDR)],
    ];
  } else if (V === 'V9') {
    // 复现 run3: C1 -> 法代 -> 地址 -> 组织明文(含注册资本) -> 财务段, 每块后复读 法代+地址
    const ORG = ['金融许可证号', '地税登记证号码', '国税登记证号码', '营业执照', '注册资本金额', '经营范围', '主营范围', '登记注册有效期'];
    const FIN = plan.filter((p) => p.group === '财务信息' && p.type !== 'skip');
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['LEGAL', byLabel(LEGAL)],
      ['ADDR', byLabel(ADDR)],
      ['ORG', plan.filter((p) => ORG.includes(p.label))],
      ['FIN', FIN],
    ];
  } else if (V === 'V11') {
    // ORG 细分: C1 -> 法代 -> 地址 -> G1(许可证/地税/国税) -> G2(注册资本/经营范围/主营/有效期)
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['LEGAL', byLabel(LEGAL)],
      ['ADDR', byLabel(ADDR)],
      ['G1', plan.filter((p) => ['金融许可证号', '地税登记证号码', '国税登记证号码'].includes(p.label))],
      ['G2', plan.filter((p) => ['注册资本金额', '经营范围', '主营范围', '登记注册有效期'].includes(p.label))],
    ];
  } else if (V === 'V12') {
    // G2 细分: 注册资本 单独 -> 经营范围+主营+有效期
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['LEGAL', byLabel(LEGAL)],
      ['ADDR', byLabel(ADDR)],
      ['ZZ', byLabel('注册资本金额')],
      ['FW', plan.filter((p) => ['经营范围', '主营范围', '登记注册有效期'].includes(p.label))],
    ];
  } else if (V === 'V13') {
    // 假设解: C1 -> 全部组织信息明文项(含注册资本/触发项/成立日期) -> 地址引入 -> 法代引入(最后) -> 经营/财务段
    const ORG9 = ['金融许可证号', '地税登记证号码', '国税登记证号码', '营业执照', '注册资本金额', '经营范围', '主营范围', '登记注册有效期', '成立日期'];
    const TAIL = plan.filter((p) => p.group === '经营信息' || p.group === '财务信息');
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['ORG9', plan.filter((p) => ORG9.includes(p.label))],
      ['ADDR', byLabel(ADDR)],
      ['LEGAL', byLabel(LEGAL)],
      ['TAIL', TAIL],
    ];
  } else if (V === 'V14') {
    // 终局假设: C1 -> 8 组织项(去注册资本) -> 地址引入 -> 法代引入(注册资本干净时) -> 注册资本(最后)
    const ORG8 = ['金融许可证号', '地税登记证号码', '国税登记证号码', '营业执照', '经营范围', '主营范围', '登记注册有效期', '成立日期'];
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['ORG8', plan.filter((p) => ORG8.includes(p.label))],
      ['ADDR', byLabel(ADDR)],
      ['LEGAL', byLabel(LEGAL)],
      ['ZZ', byLabel('注册资本金额')],
      ['FIN', plan.filter((p) => p.group === '财务信息' || p.group === '经营信息')],
    ];
  } else if (V === 'V15') {
    // 终局: C1 -> ORG8(去注册资本) -> 经营/财务段 -> 法代引入 -> 地址引入(ZZ干净) -> 注册资本(绝对最后)
    const ORG8 = ['金融许可证号', '地税登记证号码', '国税登记证号码', '营业执照', '经营范围', '主营范围', '登记注册有效期', '成立日期'];
    const FIN = plan.filter((p) => p.group === '财务信息' || p.group === '经营信息');
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['ORG8', plan.filter((p) => ORG8.includes(p.label))],
      ['FIN', FIN],
      ['LEGAL', byLabel(LEGAL)],
      ['ADDR', byLabel(ADDR)],
      ['ZZ', byLabel('注册资本金额')],
    ];
  } else if (V === 'V16') {
    // 实测: C1 -> 法代 -> 地址 -> 全部 39 明文项(原始相对序), 逐步观察 法代/地址/spot 存活
    const iAddr = plan.findIndex((p) => p.label === ADDR);
    const L = byLabel(LEGAL);
    const A = byLabel(ADDR);
    const restAll = plan.filter((p) => p.type !== 'skip' && p.label !== LEGAL && p.label !== ADDR);
    const c1all = restAll.filter((p) => plan.indexOf(p) < iLegal);
    const restAfterLegal = restAll.filter((p) => plan.indexOf(p) >= iLegal);
    const orgNonTrig = restAfterLegal.filter((p) => ['金融许可证号', '地税登记证号码', '国税登记证号码', '营业执照', '注册资本金额'].includes(p.label));
    const trig3 = restAfterLegal.filter((p) => ['经营范围', '主营范围', '登记注册有效期'].includes(p.label));
    const fd = restAfterLegal.filter((p) => p.label === '成立日期');
    const finAll = restAfterLegal.filter((p) => p.group === '经营信息' || p.group === '财务信息');
    chunks = [
      ['C1', c1all],
      ['LEGAL', L],
      ['ADDR', A],
      ['ORG5', orgNonTrig],
      ['TRIG3', trig3],
      ['FD', fd],
      ['FIN', finAll],
    ];
  } else if (V === 'V10') {
    // 假设: 注册资本移到两引入之前 -> C1(去USCC?) 用 C1 + 注册资本 + 法代 + 地址
    const ORG2 = ['金融许可证号', '地税登记证号码', '国税登记证号码', '营业执照', '经营范围', '主营范围', '登记注册有效期'];
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['ZZ(注册资本)', byLabel('注册资本金额')],
      ['ORG2', plan.filter((p) => ORG2.includes(p.label))],
      ['LEGAL', byLabel(LEGAL)],
      ['ADDR', byLabel(ADDR)],
    ];
  } else if (V === 'V8') {
    // 重排: C1 -> 地址 -> 法代后5项 -> 法代(最后)
    chunks = [
      ['C1', plan.slice(0, iLegal)],
      ['C4(地址)', byLabel(ADDR)],
      ['C3(法代后..地址前)', plan.slice(iLegal + 1, iAddr)],
      ['C2(法代)', byLabel(LEGAL)],
    ];
  }

  const ctx: FillCtx = { uscc: randUscc(), instUscc: randUscc(), phone: '13911112222', addrDetail: 'AT改测试路99号', tag: V, mode: 'edit' };
  const readLegal = async () => itemValue(page, LEGAL).catch(() => 'READ_ERR');
  const readAddr = async () => itemValue(page, ADDR).catch(() => 'READ_ERR');
  const SPOT = ['客户简称', '金融许可证号', '经营范围', '联系人姓名', '投资总额（元）'];
  const readSpot = async () => {
    const o: Record<string, string> = {};
    for (const s of SPOT) o[s] = (await itemValue(page, s).catch(() => 'READ_ERR')).slice(0, 18);
    return JSON.stringify(o);
  };
  const log = async (t: string) => console.log(`BISECT[${V}] ${t} legal=${await readLegal()} addr=${(await readAddr()).slice(0, 24)} spot=${await readSpot()}`);

  await log('L0(进场)');
  for (const [name, items] of chunks) {
    const l = await runFillPlan(page, items, { ...ctx, tag: V + name.slice(0, 8) }, undefined);
    const bad = l.filter((x) => !x.ok);
    console.log(`CHUNK[${V}] ${name} n=${items.length} bad=${JSON.stringify(bad.map((b) => b.label + ':' + b.note))}`);
    await log(`after ${name}`);
    for (let i = 1; i <= 2; i++) {
      await sleep(5000);
      await log(`${name} +${i * 5}s`);
    }
  }
  await page.screenshot({ path: path.join(__dirname, '..', '..', 'work', 'smbsn', `s2_bisect_${V}_end.png`) });
});
