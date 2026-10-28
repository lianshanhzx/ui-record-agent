// fillEngine.ts - 同业客户场景页：字段盘点 + 按视觉顺序逐项填充引擎
// 流程：inspectPage() 盘点(分组+顺序+类型) -> runFillPlan() 严格逐项填充/断言/标记 -> filllog JSON(wire 数据源)
import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fillImport } from './fillSubflows';

export interface FieldItem {
  seq: number;
  group: string;
  label: string;
  req: boolean;
  type: string;
  btns: string[];
  skipNote?: string;
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
  prev?: string;
  steps?: DialogStep[];
}
export interface FillCtx {
  uscc: string;
  instUscc: string;
  phone: string;
  addrDetail: string;
  tag: string;
  mode?: 'new' | 'edit';
  watchLegal?: boolean;
}

// GB 32100-2015 统一社会信用代码：17 位本体 + mod31 校验位
const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const USCC_W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
export const randUscc = (): string => {
  let body = '91450100';
  for (let i = 0; i < 9; i++) body += USCC_CHARS[Math.floor(Math.random() * USCC_CHARS.length)];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += USCC_CHARS.indexOf(body[i]) * USCC_W[i];
  let check = 31 - (sum % 31);
  if (check === 31) check = 0;
  return body + USCC_CHARS[check];
};

// 回读容差比较：千分位/百分号格式化后与原始值等价
const stripFmt = (s: string) => s.replace(/[,%\s]/g, '');
export const sameVal = (a: string, b: string): boolean => {
  if (a === b) return true;
  const na = parseFloat(stripFmt(a));
  const nb = parseFloat(stripFmt(b));
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
};

// edit 模式：由当前值推导一个「必然不同」的新值
export function modValue(label: string, cur: string, ctx: FillCtx): string {
  const c = (cur || '').trim();
  if (/^91450100/.test(c)) return randUscc();
  if (/^-?[\d,]+(\.\d+)?%?$/.test(c)) {
    const n = parseFloat(stripFmt(c));
    return String(Number.isInteger(n) ? n + 1 : Math.round((n + 0.5) * 100) / 100);
  }
  if (/^[\d\-()]{6,}$/.test(c)) return c.slice(0, -1) + String((parseInt(c[c.length - 1], 10) + 1) % 10);
  if (ctx.phone && label === '联系电话') return ctx.phone;
  return c + '改';
}

// select 的可见显示文本（区别于底层 input 的 code 值）
export async function selectDisplayValue(page: Page, label: string): Promise<string> {
  return page.evaluate((lb: string) => {
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && x.offsetParent !== null;
    });
    if (!it) return '';
    const sel = it.querySelector('.el-select') as HTMLElement | null;
    if (!sel) return '';
    const t = (sel.innerText || '').trim().replace(/\s+/g, ' ');
    return t || ((sel.querySelector('input') as HTMLInputElement | null)?.value || '');
  }, label);
}

const SECTION_NAMES = ['基本信息', '法定代表人信息', '组织机构信息', '经营信息', '财务信息'];
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
      let g = '基本信息';
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
    if (x.hasSwitch) type = 'switch';
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
  if (/客户简称/.test(label)) return 'AT_SMB简称';
  if (label === '总行客户编号') return 'AT9881HQ0001';
  if (label === '调查机构地址') return 'AT测试路1号';
  if (label === '机构电话号码') return '0771-1234567';
  if (label === '机构统一社会信用代码') return ctx.instUscc;
  if (label === '中征码') return '1098810100012345';
  if (label === '金融许可证号') return 'B0001H450000001234';
  if (label === '地税登记证号码') return '4501001234567890';
  if (label === '国税登记证号码') return '4501001234567890';
  if (label === '营业执照') return '91450100MA5K67890X';
  if (label === '注册资本金额') return '1000000000';
  if (label === '经营范围') return 'AT同业测试经营范围：吸收存款、发放贷款、同业拆借';
  if (label === '主营范围') return 'AT同业测试主营：对公存款、对公贷款、同业业务';
  if (label === '联系人姓名') return 'AT联系人';
  if (label === '联系电话') return ctx.phone;
  if (label === '评定机构（外部）') return 'AT测试评级公司';
  if (label === '实收资本金额（元）') return '500000000';
  if (label === '平均总资产金额') return '2000000000';
  if (label === '流动负债合计金额') return '800000000';
  if (label === '贷款损失准备比率') return '2';
  if (label === '流动性资金比例') return '0.8';
  if (/（%）/.test(label)) return '1.5';
  if (/（元）/.test(label)) return '1000000';
  return 'AT值_' + label.slice(0, 6);
}

export function defSelect(label: string): string {
  const map: Record<string, string> = {
    所在地区行政区划: '柳州市',
    同业客户类型: '银行业存款类金融机构',
    机构类别: '股份制商业银行',
    组织形式: '总行',
    平均资产总额: '',
    中征码状态: '有效',
    上市公司标志: '否',
    '评级等级（外部）': 'AAA',
    控股经济成分类型: '国有绝对控股',
  };
  if (map[label]) return map[label];
  if (/^是否/.test(label)) return '否';
  return '';
}

export function defDate(label: string): string {
  const rules: [RegExp, string][] = [
    [/登记注册日期/, '2020-06-18'],
    [/中征码年检到期日期/, '2027-12-31'],
    [/登记注册有效期/, '2035-12-31'],
    [/成立日期/, '1996-08-22'],
    [/评级申请日期/, '2026-01-15'],
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
  // 调试钩子：跟踪"法定代表人/负责人姓名"是否被某一步骤异步回滚
  let watchLegalLast = ctx.watchLegal ? await itemValue(page, '法定代表人/负责人姓名').catch(() => '') : '';
  const watchLegalAfter = async (seq: number, label: string) => {
    if (!ctx.watchLegal) return;
    const now = await itemValue(page, '法定代表人/负责人姓名').catch(() => '');
    if (now !== watchLegalLast) {
      console.log(`WATCH_LEGAL after seq=${seq} label=${label}: ${JSON.stringify(watchLegalLast)} -> ${JSON.stringify(now)}`);
      watchLegalLast = now;
    }
  };
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
        entry.note = it.skipNote || (it.btns.length ? '只读,辅助按钮[' + it.btns.join('/') + ']' : '只读/系统反显');
      } else if (it.type === 'input' || it.type === 'textarea') {
        let v: string;
        if (ctx.mode === 'edit') {
          const cur = await itemValue(page, it.label);
          entry.prev = cur;
          v = modValue(it.label, cur, ctx);
        } else {
          v = defValue(it.label, ctx);
        }
        const inp = item.locator('input:visible, textarea:visible').first();
        if (ctx.mode === 'edit') {
          // 数字格式组件(千分位/小数/百分号)fill 替换会追加旧值, 需先清空再填
          await inp.fill('').catch(() => {});
          await sleep(150);
        }
        await inp.fill(v, { timeout: 8000 });
        await sleep(300);
        const got = await itemValue(page, it.label);
        entry.action = it.type === 'textarea' ? 'input_textarea' : 'input';
        entry.value = v;
        entry.ok = sameVal(got, v);
        if (!entry.ok) entry.note = 'got=' + got.slice(0, 30);
      } else if (it.type === 'select') {
        if (ctx.mode === 'edit') {
          // 编辑模式：选一个使「显示值」真正变化的选项
          // (显示可能是 code 而选项文本是 name, 文本对比会误判, 需逐个尝试以显示值变化为准)
          const curDisp = await selectDisplayValue(page, it.label);
          entry.prev = curDisp;
          entry.action = 'select';
          const optsSel = '.el-select-dropdown:visible .el-select-dropdown__item:visible';
          let candidates: number[] = [];
          try {
            await item.locator('.el-select, input').first().click({ timeout: 5000 });
            await sleep(900);
            const opts = page.locator(optsSel);
            const n = await opts.count();
            for (let i = 0; i < n && candidates.length < 6; i++) {
              const t = (((await opts.nth(i).innerText().catch(() => '')) || '').trim());
              if (t && t !== curDisp) candidates.push(i);
            }
          } catch {}
          if (candidates.length === 0) {
            entry.note = 'NO_ALT_OPTION cur=' + curDisp.slice(0, 20);
            await page.keyboard.press('Escape').catch(() => {});
          } else {
            let got = '';
            let opt = '';
            for (const idx of candidates) {
              if (!(await page.locator(optsSel).count().catch(() => 0))) {
                await item.locator('.el-select, input').first().click({ timeout: 5000 }).catch(() => {});
                await sleep(900);
              }
              opt = (((await page.locator(optsSel).nth(idx).innerText().catch(() => '')) || '').trim());
              await page.locator(optsSel).nth(idx).click({ timeout: 5000 });
              await sleep(500);
              got = await selectDisplayValue(page, it.label);
              if (got !== opt) { await sleep(800); got = await selectDisplayValue(page, it.label); }
              if (got && got !== curDisp) break;
            }
            entry.value = got || opt;
            entry.ok = !!got && got !== curDisp;
            if (!entry.ok) entry.note = 'NO_EFFECT tried=' + candidates.length + ' cur=' + curDisp.slice(0, 20) + ' got=' + got.slice(0, 30);
          }
        } else {
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
        }
      } else if (it.type === 'date') {
        let v: string;
        if (ctx.mode === 'edit') {
          const cur = (await itemValue(page, it.label)).trim();
          entry.prev = cur;
          v = /^\d{4}-\d{2}-\d{2}$/.test(cur) ? cur.slice(0, 4).replace(/^\d+/, (y) => String(+y + 1)) + cur.slice(4) : defDate(it.label);
        } else {
          v = defDate(it.label);
        }
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
      } else if (it.type === 'import') {
        const r = await fillImport(page, it.label, ctx);
        entry.action = 'import_dialog';
        entry.value = 'AT';
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
    await watchLegalAfter(it.seq, it.label);
  }
  if (logPath) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, JSON.stringify({ tag: ctx.tag, total: log.length, ok: log.filter((l) => l.ok).length, items: log }, null, 2), 'utf-8');
  }
  return log;
}
