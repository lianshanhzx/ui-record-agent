// fillEngine.ts - 页面字段盘点 + 按视觉顺序逐项填充引擎
// 流程：inspectPage() 盘点(分组+顺序+类型) -> runFillPlan() 严格逐项填充/断言/标记 -> filllog JSON(wire 数据源)
import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fillAddress, fillIndustry, fillImport, fillCalc } from './fillSubflows';

export interface FieldItem {
  seq: number;
  group: string;
  label: string;
  req: boolean;
  type: string;
  btns: string[];
}
export interface DialogStep {
  dialog: string;
  action: string;
  target: string;
  value?: string;
  rect?: string;
}
export interface FillLogEntry {
  seq: number;
  group: string;
  label: string;
  req: boolean;
  type: string;
  action: string;
  value: string;
  ok: boolean;
  note: string;
  rect: string;
  steps?: DialogStep[];
}
export interface FillCtx {
  uscc: string;
  phone: string;
  addrDetail: string;
  tag: string;
}

const SECTION_NAMES = ['对公客户概况', '客户标签', '股东及关联人信息', '经营情况'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const norm = (b: { x: number; y: number; width: number; height: number } | null): string =>
  b
    ? JSON.stringify({
        x1: +(b.x / 1440).toFixed(3),
        y1: +(b.y / 900).toFixed(3),
        x2: +((b.x + b.width) / 1440).toFixed(3),
        y2: +((b.y + b.height) / 900).toFixed(3),
      })
    : '';

const normBtn = (s: string) => s.replace(/\s/g, '');

// onlyGroup: 只盘点指定组件(页面标签/折叠段)，如 '对公客户概况' —— 每个组件是独立原子操作(各自【保存/暂存】)
export async function inspectPage(page: Page, onlyGroup?: string): Promise<FieldItem[]> {
  const raw = await page.evaluate((a: [string[], string]) => {
    const [names, only] = a;
    const secEls: { top: number; name: string }[] = [];
    document.querySelectorAll('[aria-expanded]').forEach((el) => {
      const t = (el.innerText || '').trim().split('\n')[0].trim();
      if (names.includes(t)) secEls.push({ top: el.getBoundingClientRect().top, name: t });
    });
    secEls.sort((a, b) => a.top - b.top);
    const groupOf = (top: number): string => {
      let g = '对公客户概况';
      for (const s of secEls) if (top >= s.top - 10) g = s.name;
      return g;
    };
    const out: any[] = [];
    document.querySelectorAll('.el-form-item').forEach((item) => {
      const labelEl = item.querySelector('label');
      if (!labelEl) return;
      const label = labelEl.innerText.trim().replace(/[*\s]/g, '');
      if (!label) return;
      const r = item.getBoundingClientRect();
      if (item.offsetParent === null || r.height === 0) return;
      const ctrls: any[] = [];
      item.querySelectorAll('input, textarea').forEach((inp) => {
        const ir = inp.getBoundingClientRect();
        if (ir.width === 0) return;
        ctrls.push({ tag: inp.tagName, ph: inp.placeholder || '', dis: inp.disabled, ro: inp.readOnly, val: (inp.value || '').slice(0, 40) });
      });
      const hasSelect = !!item.querySelector('.el-select');
      const hasDate = !!item.querySelector('.el-date-editor');
      const hasSwitch = !!item.querySelector('.el-switch');
      const btns = Array.from(item.querySelectorAll('button')).map((b) => b.innerText.trim()).filter(Boolean);
      const g = groupOf(r.top);
      if (only && g !== only) return;
      out.push({ label, req: labelEl.classList.contains('is-required'), top: r.top, left: r.left, ctrls, hasSelect, hasDate, hasSwitch, btns, group: g });
    });
    return out;
  }, [SECTION_NAMES, onlyGroup || '']);
  raw.sort((a: any, b: any) => a.top - b.top || a.left - b.left);
  return raw.map((x: any, i: number): FieldItem => {
    const c = (x.ctrls || [])[0];
    let type = 'skip';
    if (x.label === '行业代码') type = 'industry';
    else if (x.label === '企业规模') type = 'calc';
    else if (x.hasSwitch) type = 'switch';
    else if (x.hasDate && c && !c.dis) type = 'date';
    else if (x.hasSelect && c && !c.dis && !x.hasDate) type = 'select';
    else if (x.btns.some((b) => normBtn(b) === '选择' || normBtn(b) === '获取地址')) type = 'address';
    else if (x.btns.some((b) => normBtn(b) === '引入')) type = 'import';
    else if (c && !c.dis && c.tag === 'TEXTAREA') type = 'textarea';
    else if (c && !c.dis) type = 'input';
    return { seq: i + 1, group: x.group, label: x.label, req: x.req, type, btns: x.btns };
  });
}

export function defValue(label: string, ctx: FillCtx): string {
  if (label === '统一社会信用代码' || label === '纳税人识别号') return ctx.uscc;
  if (/手机号码/.test(label)) return ctx.phone;
  if (label === '单位电话') return '0593-8888666';
  if (/固定电话/.test(label)) return '0593-2222333';
  if (/单位电话号码/.test(label)) return '0593-8888666';
  if (/邮政编码|邮编/.test(label)) return '355200';
  if (label === '经度') return '119.6';
  if (label === '纬度') return '26.4';
  if (/从业人数/.test(label)) return '100';
  if (/资产总额/.test(label)) return '1000000';
  if (/营业收入/.test(label)) return '2000000';
  if (/注册资本金额|实收资本金额/.test(label)) return '5000000';
  if (/所得税及增值税/.test(label)) return '3000000';
  if (/欠税总额/.test(label)) return '0';
  if (/租金/.test(label)) return '50000';
  if (/土地面积/.test(label)) return '100';
  if (/建筑面积/.test(label)) return '500';
  if (/经营场所面积/.test(label)) return '800';
  if (label === '外文名称') return 'AT_Test_Name';
  if (/财务部联系人名称/.test(label)) return 'AT联系人';
  if (/归属人名称/.test(label)) return 'AT归属人';
  if (/身份证号码|证件号码$/.test(label)) return '355200199001010013';
  if (/法定代表人.*证件号码|负责人证件号码/.test(label)) return '355200198501010023';
  if (/法定代表人.*姓名|负责人姓名/.test(label)) return 'AT法代';
  if (/邮箱|Email/.test(label)) return 'at_test@example.com';
  if (label === '登记注册号') return '35520000MA000AT01';
  if (label === '机构信用代码') return 'AT000AT001';
  if (label === '管户机构编号') return '9881';
  if (/描述/.test(label)) return 'AT测试描述';
  if (label === '经营范围') return 'AT测试经营范围：科技开发、技术咨询';
  if (/主要产品情况/.test(label)) return 'AT主要产品：软件产品';
  if (/主要生产设备/.test(label)) return 'AT主要设备：服务器、测试设备';
  if (/实际生产能力/.test(label)) return 'AT实际产能：年处理1000笔';
  if (/个人简历/.test(label)) return 'AT简历：测试人员，从事金融测试';
  if (label === '备注') return 'AT测试备注';
  if (/登记机关/.test(label)) return 'AT登记机关';
  if (label === '行政区划名称') return '宁德市福鼎市';
  if (/行政区划代码|行政划分代码/.test(label)) return '350982';
  if (/客户简称/.test(label)) return 'AT简称';
  if (/基本存款账户开户行/.test(label)) return 'AT测试开户行';
  if (/基本存款账户账号/.test(label)) return 'AT6222000000000001';
  return 'AT值_' + label.slice(0, 6);
}

export function defSelect(label: string): string {
  const map: Record<string, string> = {
    国别: '中华人民共和国',
    投资主体: '法人投资',
    投资主体类型: '法人投资',
    控股经济类型: '私人绝对控股',
    登记注册号类型: '统一社会信用代码',
    注册资本币种: '人民币',
    实收资本币种: '人民币',
    区域类型: '县城城区',
    城乡类型: '城市企业',
    经营状态: '存续',
    纳税评级标识: 'A',
    合作状态: '已生效',
    基本户状态: '正常',
    与本行关系: '普通客户',
    与我行合作关系类型: '一般',
    国民经济部门: '非金融企业部门',
    国民经济部门类别: '公司',
    龙头企业: '非龙头企业',
    评级客户分类标识: '发展巩固类',
    经费来源: '自营收入',
    经营场所所有权类型: '自有',
    基本存款账户是否在法人行: '是',
    企业规模: '中型企业',
    隶属关系标识: '地市级',
    联网核查状态: '核查通过',
  };
  if (map[label]) return map[label];
  if (/法定代表人.*证件类型|负责人证件类型/.test(label)) return '居民身份证';
  if (/归属人关系类型/.test(label)) return '本人';
  if (/^是否/.test(label)) return '否';
  if (/^是$|标志$/.test(label)) return '否';
  if (label.startsWith('是否')) return '否';
  return '';
}

export function defDate(label: string): string {
  const rules: [RegExp, string][] = [
    [/成立/, '2024-01-01'],
    [/注册登记日期/, '2024-01-15'],
    [/失效/, '2034-01-14'],
    [/年检/, '2026-12-31'],
    [/基本户开户/, '2024-02-01'],
    [/发证/, '2024-01-20'],
    [/查询时间/, '2026-09-22'],
    [/证件到期|证件有效|证件起始/, '2026-01-01'],
    [/认定|评级到期/, '2026-09-01'],
  ];
  for (const [re, d] of rules) if (re.test(label)) return d;
  return '2024-06-01';
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 标签精确匹配(允许任意换行/空格插入)
const labelRe = (label: string) => new RegExp('^\\s*\\*?\\s*' + label.split('').map(esc).join('[\\s\\n]*') + '[\\s\\n]*$');
export const itemLoc = (page: Page, label: string): Locator =>
  page
    .locator('.el-form-item:visible')
    .filter({ has: page.locator('label:visible').filter({ hasText: labelRe(label) }) })
    .first();

export async function evalClickItemBtn(page: Page, label: string, btn: string): Promise<string> {
  return page.evaluate(
    ([lb, bt]) => {
      const items = Array.from(document.querySelectorAll('.el-form-item')).filter((x) => {
        const l = x.querySelector('label');
        return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && x.offsetParent !== null;
      });
      if (!items.length) return 'NO_ITEM';
      const nb = (s: string) => s.replace(/\s/g, '');
      const b = Array.from(items[0].querySelectorAll('button')).find((x) => nb(x.innerText) === nb(bt));
      if (!b) return 'NO_BTN:' + Array.from(items[0].querySelectorAll('button')).map((x) => x.innerText.trim()).join(',');
      b.click();
      return 'CLICKED';
    },
    [label, btn] as const
  );
}

// ---- 子流程元素 rect 测量（供 DialogStep.rect 录取, wire 回放定位）----
// 主页面元素用 offsetTop 累加(绝对坐标,与滚动无关)；弹层内元素用 viewport(弹层 fixed 居中)
// 注意: page.evaluate 回调只能内联代码,不可引用模块级函数
export async function measureItemBtn(page: Page, label: string, btn: string): Promise<string> {
  const b = await page.evaluate(([lb, bt]) => {
    const nb2 = (s: string) => s.replace(/\s/g, '');
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && (x as HTMLElement).offsetParent !== null;
    });
    if (!it) return null;
    const el = Array.from(it.querySelectorAll('button')).find((x) => nb2(x.innerText) === nb2(bt)) as HTMLElement | undefined;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let t = 0, l = 0, n: Element | null = el;
    while (n) { t += n.offsetTop || 0; l += n.offsetLeft || 0; n = n.offsetParent; }
    return { x: l, y: t, width: r.width, height: r.height };
  }, [label, btn] as const).catch(() => null);
  return norm(b);
}

export async function measureItemField(page: Page, label: string, kind: 'select' | 'input' | 'span'): Promise<string> {
  const sel = kind === 'select' ? '.el-select' : kind === 'input' ? 'input,textarea' : '.my-popover, .el-tooltip';
  const b = await page.evaluate(([lb, s]) => {
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && (x as HTMLElement).offsetParent !== null;
    });
    if (!it) return null;
    const el = it.querySelector(s) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    let t = 0, l = 0, n: Element | null = el;
    while (n) { t += n.offsetTop || 0; l += n.offsetLeft || 0; n = n.offsetParent; }
    return { x: l, y: t, width: r.width, height: r.height };
  }, [label, sel] as const).catch(() => null);
  return norm(b);
}

export async function measureDlgField(page: Page, label: string, kind: 'select' | 'input'): Promise<string> {
  const b = await page.evaluate(([lb, kd]) => {
    const ws = Array.from(document.querySelectorAll('.el-dialog__wrapper')).filter(
      (w) => getComputedStyle(w as HTMLElement).display !== 'none'
    );
    const d = ws.length ? (ws[ws.length - 1].querySelector('.el-dialog') as HTMLElement) : null;
    if (!d) return null;
    const it = Array.from(d.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && (x as HTMLElement).offsetParent !== null;
    });
    if (!it) return null;
    const el = (kd === 'select' ? it.querySelector('.el-select') : it.querySelector('input,textarea')) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, [label, kind] as const).catch(() => null);
  return norm(b);
}

export async function measureDlgBtn(page: Page, btn: string): Promise<string> {
  const b = await page.evaluate((bt) => {
    const nb2 = (s: string) => s.replace(/\s/g, '');
    const ws = Array.from(document.querySelectorAll('.el-dialog__wrapper')).filter(
      (w) => getComputedStyle(w as HTMLElement).display !== 'none'
    );
    const d = ws.length ? (ws[ws.length - 1].querySelector('.el-dialog') as HTMLElement) : null;
    if (!d) return null;
    const el = Array.from(d.querySelectorAll('button')).find((x) => nb2(x.innerText) === nb2(bt)) as HTMLElement | undefined;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, btn).catch(() => null);
  return norm(b);
}

export async function measureDlgPh(page: Page, ph: string): Promise<string> {
  const b = await page.evaluate((p) => {
    const ws = Array.from(document.querySelectorAll('.el-dialog__wrapper')).filter(
      (w) => getComputedStyle(w as HTMLElement).display !== 'none'
    );
    const d = ws.length ? (ws[ws.length - 1].querySelector('.el-dialog') as HTMLElement) : null;
    if (!d) return null;
    const el = d.querySelector('input[placeholder="' + p + '"]') as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, ph).catch(() => null);
  return norm(b);
}

export async function measurePopSel(page: Page, sel: string): Promise<string> {
  const b = await page.evaluate((s) => {
    const p = Array.from(document.querySelectorAll('.el-popover')).find(
      (x) => x.offsetParent !== null && x.getAttribute('aria-hidden') === 'false'
    ) as HTMLElement | undefined;
    if (!p) return null;
    const el = p.querySelector(s) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, sel).catch(() => null);
  return norm(b);
}

export async function measurePopBtn(page: Page, btn: string): Promise<string> {
  const b = await page.evaluate((bt) => {
    const nb2 = (s: string) => s.replace(/\s/g, '');
    const p = Array.from(document.querySelectorAll('.el-popover')).find(
      (x) => x.offsetParent !== null && x.getAttribute('aria-hidden') === 'false'
    ) as HTMLElement | undefined;
    if (!p) return null;
    const el = Array.from(p.querySelectorAll('button')).find((x) => nb2(x.innerText) === nb2(bt)) as HTMLElement | undefined;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, btn).catch(() => null);
  return norm(b);
}

export async function measureDropdownOpt(page: Page, text: string): Promise<string> {
  const b = await page.evaluate((t) => {
    const nb2 = (s: string) => s.replace(/\s/g, '');
    const dds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null);
    for (const d of dds) {
      const el = Array.from(d.querySelectorAll('.el-select-dropdown__item')).find((x) => nb2(x.innerText) === nb2(t)) as HTMLElement | undefined;
      if (el) {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return null;
  }, text).catch(() => null);
  return norm(b);
}

// 确认页面无残留弹层（dialog/message-box/popover）；有则强制关闭(X/Escape)，返回是否最终干净
export async function ensureDialogsClosed(page: Page): Promise<{ wasOpen: boolean; closed: boolean }> {
  const probe = () =>
    page.evaluate(() => {
      const dlg = Array.from(document.querySelectorAll('.el-dialog__wrapper')).filter(
        (w) => getComputedStyle(w as HTMLElement).display !== 'none' && w.querySelector('.el-dialog')
      );
      const msg = Array.from(document.querySelectorAll('.el-message-box__wrapper')).filter(
        (w) => getComputedStyle(w as HTMLElement).display !== 'none'
      );
      const pop = Array.from(document.querySelectorAll('.el-popover')).filter(
        (p) => p.offsetParent !== null && p.getAttribute('aria-hidden') === 'false'
      );
      const titles = dlg.map((w) => (w.querySelector('.el-dialog__title') || {}).innerText || '').join('|');
      return { n: dlg.length + msg.length + pop.length, titles };
    });
  const first = await probe().catch(() => ({ n: 0, titles: '' }));
  if (!first.n) return { wasOpen: false, closed: true };
  for (let i = 0; i < 3; i++) {
    await page
      .evaluate(() => {
        Array.from(document.querySelectorAll('.el-dialog__wrapper')).forEach((w) => {
          if (getComputedStyle(w as HTMLElement).display === 'none') return;
          const x = w.querySelector('.el-dialog__headerbtn');
          if (x) (x as HTMLElement).click();
        });
      })
      .catch(() => {});
    await sleep(500);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    const cur = await probe().catch(() => ({ n: 0, titles: '' }));
    if (!cur.n) return { wasOpen: true, closed: true };
  }
  const fin = await probe().catch(() => ({ n: 1, titles: '' }));
  return { wasOpen: true, closed: fin.n === 0 };
}

export async function itemValue(page: Page, label: string): Promise<string> {
  return page.evaluate((lb: string) => {
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && x.offsetParent !== null;
    });
    return it ? (it.querySelector('input,textarea') || {}).value || '' : 'N/A';
  }, label);
}

async function firstOption(page: Page, item: Locator): Promise<string> {
  try {
    await item.locator('.el-select, input').first().click({ timeout: 5000 });
    await sleep(900);
    const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item:visible').first();
    const t = (await opt.innerText()).trim();
    await opt.click({ timeout: 5000 });
    await sleep(500);
    return t;
  } catch {
    return '';
  }
}

async function pickSelect(page: Page, item: Locator, opt: string): Promise<boolean> {
  try {
    await item.locator('.el-select, input').first().click({ timeout: 5000 });
    const exact = new RegExp('^\\s*' + esc(opt) + '\\s*$');
    const target = page
      .locator('.el-select-dropdown:visible')
      .filter({ has: page.locator('.el-select-dropdown__item', { hasText: exact }) })
      .last()
      .locator('.el-select-dropdown__item:visible', { hasText: exact })
      .last();
    await target.waitFor({ state: 'visible', timeout: 8000 });
    await target.click({ timeout: 5000 });
    await sleep(500);
    return true;
  } catch {
    return false;
  }
}

async function ensureSectionOpen(page: Page, name: string): Promise<void> {
  const state = await page.evaluate((nm: string) => {
    const els = Array.from(document.querySelectorAll('[aria-expanded]')).filter((e) => (e.innerText || '').trim().startsWith(nm));
    return els.length ? els[0].getAttribute('aria-expanded') : 'MISSING';
  }, name);
  if (state === 'false') {
    await page.evaluate((nm: string) => {
      const el = Array.from(document.querySelectorAll('[aria-expanded]')).find((e) => (e.innerText || '').trim().startsWith(nm));
      (el as HTMLElement).click();
    }, name);
    await sleep(1500);
  }
}

// 绝对坐标(与滚动无关)重测 rect 并回写 filllog：用于 wire 回放定位
export async function measureAndSaveRects(page: Page, plan: FieldItem[], log: FillLogEntry[], logPath: string, tag: string): Promise<void> {
  const rects = await page.evaluate((labels: string[]) => {
    const abs = (el: Element) => {
      let t = 0;
      let l = 0;
      let n: Element | null = el;
      while (n) {
        t += n.offsetTop || 0;
        l += n.offsetLeft || 0;
        n = n.offsetParent;
      }
      return { t, l };
    };
    const out: Record<number, string> = {};
    labels.forEach((lb, i) => {
      const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
        const l = x.querySelector('label');
        return l && l.innerText.trim().replace(/[*\s]/g, '') === lb;
      });
      if (!it) return;
      const ctl = it.querySelector('input, textarea, .el-select, .el-switch, button') || it;
      const r = ctl.getBoundingClientRect();
      const a = abs(ctl);
      out[i] = JSON.stringify({
        x1: +(a.l / 1440).toFixed(3),
        y1: +(a.t / 900).toFixed(3),
        x2: +((a.l + r.width) / 1440).toFixed(3),
        y2: +((a.t + r.height) / 900).toFixed(3),
      });
    });
    return out;
  }, plan.map((p) => p.label));
  log.forEach((l, i) => {
    if (rects[i]) l.rect = rects[i];
  });
  fs.writeFileSync(logPath, JSON.stringify({ tag, total: log.length, ok: log.filter((l) => l.ok).length, items: log }, null, 2), 'utf-8');
}

export async function openAllSections(page: Page): Promise<string[]> {
  const opened: string[] = [];
  for (const nm of SECTION_NAMES) {
    try {
      const st = await page.evaluate((n: string) => {
        const el = Array.from(document.querySelectorAll('[aria-expanded]')).find((e) => (e.innerText || '').trim().startsWith(n));
        return el ? el.getAttribute('aria-expanded') : 'MISSING';
      }, nm);
      if (st === 'false') {
        await ensureSectionOpen(page, nm);
        opened.push(nm);
      }
    } catch {}
  }
  return opened;
}

export async function runFillPlan(page: Page, plan: FieldItem[], ctx: FillCtx, logPath?: string): Promise<FillLogEntry[]> {
  const log: FillLogEntry[] = [];
  for (const it of plan) {
    await ensureDialogsClosed(page).catch(() => {});
    const entry: FillLogEntry = { seq: it.seq, group: it.group, label: it.label, req: it.req, type: it.type, action: '', value: '', ok: false, note: '', rect: '' };
    try {
      const item = itemLoc(page, it.label);
      const present = await item.count().catch(() => 0);
      if (it.type !== 'skip' && !present) {
        entry.action = 'skip';
        entry.ok = true;
        entry.note = 'DYN_GONE(前序选择动态移除/隐藏该项,如归属人=本人时名称/身份证消失)';
        console.log(`FILL ${ctx.tag} seq=${it.seq} label=${it.label} DYN_GONE`);
        log.push(entry);
        continue;
      }
      entry.rect = norm((await item.boundingBox().catch(() => null)) as any);
      if (it.type === 'skip') {
        entry.action = 'skip';
        entry.ok = true;
        entry.note = it.btns.length ? '只读,辅助按钮[' + it.btns.join('/') + ']' : '只读/系统反显';
      } else if (it.type === 'input' || it.type === 'textarea') {
        const v = defValue(it.label, ctx);
        await item.locator('input:visible, textarea:visible').first().fill(v, { timeout: 8000 });
        await sleep(300);
        const got = await itemValue(page, it.label);
        entry.action = it.type === 'textarea' ? 'input_textarea' : 'input';
        entry.value = v;
        entry.ok = got === v;
        if (!entry.ok) entry.note = 'got=' + got.slice(0, 30);
      } else if (it.type === 'select') {
        const opt = defSelect(it.label) || (await firstOption(page, item));
        if (!opt) {
          entry.action = 'select';
          entry.note = 'NO_OPTIONS';
        } else {
          const ok = await pickSelect(page, item, opt);
          await sleep(300);
          const got = await itemValue(page, it.label);
          entry.action = 'select';
          entry.value = opt;
          entry.ok = ok && got === opt;
          if (!entry.ok) {
            let diag = '';
            try {
              diag = await page.evaluate(() => {
                const dds = Array.from(document.querySelectorAll('.el-select-dropdown')).filter((d) => d.offsetParent !== null);
                return dds.map((d) => Array.from(d.querySelectorAll('.el-select-dropdown__item')).slice(0, 12).map((x) => x.innerText.trim().replace(/\s/g, '')).join('/')).join('||');
              });
            } catch {}
            entry.note = 'got=' + got.slice(0, 30) + (diag ? ' dd=' + diag.slice(0, 120) : ' dd=EMPTY');
          }
        }
      } else if (it.type === 'date') {
        const v = defDate(it.label);
        const inp = item.locator('input:visible').first();
        await inp.click({ timeout: 8000 });
        await inp.fill(v);
        await page.keyboard.press('Enter');
        await sleep(700);
        const got = await itemValue(page, it.label);
        entry.action = 'date';
        entry.value = v;
        entry.ok = got === v;
        if (!entry.ok) entry.note = 'got=' + got.slice(0, 30);
      } else if (it.type === 'switch') {
        const sw = item.locator('.el-switch').first();
        const before = ((await sw.getAttribute('class')) || '').includes('is-checked');
        await sw.click({ timeout: 8000 });
        await sleep(400);
        const after = ((await sw.getAttribute('class')) || '').includes('is-checked');
        entry.action = 'switch';
        entry.value = after ? 'on' : 'off';
        entry.ok = before !== after;
        entry.note = 'toggle:' + (before ? '1' : '0') + '->' + (after ? '1' : '0');
      } else if (it.type === 'address') {
        const mode = it.label === '行政区划名称' ? 'division' : 'detail';
        const r = await fillAddress(page, it.label, ctx, mode);
        entry.action = mode === 'division' ? 'admdv_dialog' : 'address_dialog';
        entry.value = r.note.slice(0, 40);
        entry.ok = r.ok;
        entry.note = r.note;
        entry.steps = r.steps;
        const dc = await ensureDialogsClosed(page);
        if (dc.wasOpen && !dc.closed) entry.note = (entry.note + ' |MODAL_STUCK').slice(0, 150);
      } else if (it.type === 'industry') {
        const r = await fillIndustry(page, it.label);
        entry.action = 'industry_tree';
        entry.value = r.value || r.note;
        entry.ok = r.ok;
        entry.note = r.note;
        entry.steps = r.steps;
        const dc = await ensureDialogsClosed(page);
        if (dc.wasOpen && !dc.closed) entry.note = (entry.note + ' |MODAL_STUCK').slice(0, 150);
      } else if (it.type === 'import') {
        const r = await fillImport(page, it.label);
        entry.action = 'import_dialog';
        entry.value = 'AT';
        entry.ok = r.ok;
        entry.note = r.note;
        entry.steps = r.steps;
        const dc = await ensureDialogsClosed(page);
        if (dc.wasOpen && !dc.closed) entry.note = (entry.note + ' |MODAL_STUCK').slice(0, 150);
      } else if (it.type === 'calc') {
        const r = await fillCalc(page, it.label);
        entry.action = 'calc_button';
        entry.value = r.value;
        entry.ok = r.ok;
        entry.note = r.note;
        entry.steps = r.steps;
        const dc = await ensureDialogsClosed(page);
        if (dc.wasOpen && !dc.closed) entry.note = (entry.note + ' |MODAL_STUCK').slice(0, 150);
      }
      console.log(
        `FILL ${ctx.tag} seq=${it.seq} g=${it.group} label=${it.label} type=${it.type} action=${entry.action} value=${String(entry.value).slice(0, 30)} ok=${entry.ok ? 1 : 0} rect=${entry.rect}${entry.note ? ' note=' + entry.note : ''}`
      );
    } catch (e: any) {
      entry.action = 'error';
      entry.note = e.message.slice(0, 120);
      console.log(`FILL ${ctx.tag} seq=${it.seq} label=${it.label} ERROR ${entry.note}`);
    }
    log.push(entry);
  }
  if (logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify({ tag: ctx.tag, total: log.length, ok: log.filter((l) => l.ok).length, items: log }, null, 2), 'utf-8');
  }
  return log;
}
