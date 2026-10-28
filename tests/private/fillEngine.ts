import { Page, Locator } from '@playwright/test';
import * as fs from 'fs';

const SECTION_NAMES = ['基本信息', '其他信息', '评级信息', '关联方信息', '关系人信息'];

export interface FieldItem {
  seq: number;
  group: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'textarea' | 'switch' | 'skip';
  req: boolean;
  disabled: boolean;
  btns: string[];
}

export const groupOf = (item: any): string => {
  let n: any = item.parentElement;
  while (n) {
    const txt = (n.innerText || '').trim();
    for (const s of SECTION_NAMES) {
      if (txt.startsWith(s) && txt.length < 4000) return s;
    }
    if (n.querySelector?.('.el-form-item')) return SECTION_NAMES[0];
    n = n.parentElement;
  }
  return SECTION_NAMES[0];
};

export const openAllSections = async (page: Page) => {
  const heads = page.locator('[aria-expanded]');
  const n = await heads.count();
  for (let i = 0; i < n; i++) {
    const h = heads.nth(i);
    const t = (await h.innerText()).trim();
    if (SECTION_NAMES.some((s) => t === s || t.startsWith(s))) {
      const exp = await h.getAttribute('aria-expanded');
      if (exp === 'false') {
        try {
          await h.click({ timeout: 3000 });
          await page.waitForTimeout(400);
        } catch {
          /* ignore */
        }
      }
    }
  }
};

export const inspectPage = async (page: Page, onlyGroup: string): Promise<FieldItem[]> => {
  return page.evaluate((only) => {
    const out: any[] = [];
    const items = Array.from(document.querySelectorAll('.el-form-item')) as HTMLElement[];
    let seq = 0;
    for (const it of items) {
      const labelEl = it.querySelector('.el-form-item__label');
      if (!labelEl) continue;
      let label = (labelEl.innerText || '').trim().replace(/[:：\s]+$/g, '');
      if (!label || label.length > 24) continue;
      if (label === '配偶姓名') continue;
      const group = (() => {
        let n: any = it.parentElement;
        while (n) {
          const txt = (n.innerText || '').trim();
          for (const s of ['基本信息', '其他信息', '评级信息', '关联方信息', '关系人信息']) {
            if (txt.startsWith(s) && txt.length < 4000) return s;
          }
          if (n.querySelector?.('.el-form-item')) return '基本信息';
          n = n.parentElement;
        }
        return '基本信息';
      })();
      if (only && group !== only) continue;
      const ctrl = it.querySelector('.el-form-item__content');
      if (!ctrl) continue;
      const btns: string[] = [];
      ctrl.querySelectorAll('button').forEach((b) => {
        const t = (b.innerText || '').trim();
        if (t) btns.push(t);
      });
      const disabled = !!ctrl.querySelector('input[disabled], textarea[disabled]');
      const isDate = !!ctrl.querySelector('.el-date-editor');
      const isSwitch = !!ctrl.querySelector('.el-switch');
      const isSelect =
        !!ctrl.querySelector('.el-select') ||
        (ctrl.querySelector('input') && !!ctrl.querySelector('.el-select__caret'));
      const isTextarea = !!ctrl.querySelector('textarea');
      const input = ctrl.querySelector('input') as HTMLInputElement | null;
      const readonlyInput = input && (input.readOnly || input.disabled);
      let type: any;
      if (isDate) type = 'date';
      else if (isSwitch) type = 'switch';
      else if (isSelect) type = 'select';
      else if (isTextarea) type = 'textarea';
      else if (readonlyInput) type = 'skip';
      else if (input) type = 'input';
      else type = 'skip';
      const req = !!it.querySelector('.el-form-item.is-required, .el-form-item__label.required, .el-form-item__label .el-icon-question');
      const req2 = /是|必填/.test(labelEl.className || '');
      out.push({ seq: seq++, group, label, type, req: req || req2, disabled, btns });
    }
    return out;
  }, onlyGroup);
};

export const ensureDialogsClosed = async (page: Page) => {
  for (let k = 0; k < 3; k++) {
    const n = await page.locator('.el-dialog:visible').count();
    if (!n) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
};

const dateVal = (label: string): string => {
  if (label.includes('出生')) return '1988-12-12';
  if (label.includes('到期') || label.includes('有效期')) return '2038-12-31';
  return '2028-12-31';
};

const defSelect = (label: string): string | null => {
  if (label.includes('婚姻状况')) return '未婚';
  return null;
};

const defValue = (label: string): string | null => {
  if (label.includes('国籍')) return '中华人民共和国';
  return null;
};

const itemValue = async (page: Page, label: string): Promise<string> => {
  const v = await page
    .locator('.el-form-item')
    .filter({ hasText: label })
    .first()
    .locator('input')
    .first()
    .inputValue()
    .catch(() => '');
  return v;
};

export const itemLoc = (page: Page, label: string): Locator =>
  page.locator('.el-form-item').filter({ hasText: label }).first();

export const measureRect = async (page: Page, label: string): Promise<[number, number] | null> =>
  page.evaluate((lb) => {
    const f = Array.from(document.querySelectorAll('.el-form-item')).find((e) =>
      (e.innerText || '').includes(lb)
    );
    if (!f) return null;
    const b = (f.querySelector('input,textarea,.el-select') as HTMLElement)?.getBoundingClientRect();
    return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
  }, label);

export const measureBtnsRect = async (
  page: Page,
  label: string,
  btns: string[]
): Promise<[string, number, number][]> =>
  page.evaluate(({ lb, bs }) => {
    const f = Array.from(document.querySelectorAll('.el-form-item')).find((e) =>
      (e.innerText || '').includes(lb)
    );
    if (!f) return [];
    return bs
      .map((t) => {
        const b = Array.from(f.querySelectorAll('button')).find(
          (x) => (x.innerText || '').trim() === t
        ) as HTMLElement;
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return [t, r.x + r.width / 2, r.y + r.height / 2] as [string, number, number];
      })
      .filter(Boolean) as [string, number, number][];
  }, { lb: label, bs: btns });

export const measureInputRect = async (page: Page, label: string): Promise<[number, number] | null> =>
  page.evaluate((lb) => {
    const f = Array.from(document.querySelectorAll('.el-form-item')).find((e) =>
      (e.innerText || '').includes(lb)
    );
    if (!f) return null;
    const b = (f.querySelector('input') as HTMLElement)?.getBoundingClientRect();
    return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
  }, label);

export const measureDropdownRect = async (
  page: Page,
  label: string,
  optionText: string
): Promise<[number, number] | null> =>
  page.evaluate(({ lb, opt }) => {
    const dd = Array.from(document.querySelectorAll('.el-select-dropdown')).find((d) =>
      (d.innerText || '').includes(opt)
    );
    if (!dd) return null;
    const it = Array.from(dd.querySelectorAll('.el-select-dropdown__item')).find(
      (i) => (i.innerText || '').trim() === opt
    ) as HTMLElement;
    if (!it) return null;
    const b = it.getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2];
  }, { lb: label, opt: optionText });

export interface FillLogEntry {
  seq: number;
  label: string;
  type: string;
  action: string;
  note: string;
  ok: boolean;
  absX: number | null;
  absY: number | null;
  inputX: number | null;
  inputY: number | null;
  dropdownX: number | null;
  dropdownY: number | null;
  btns: [string, number, number][];
}

export const runFillPlan = async (
  page: Page,
  plan: FieldItem[],
  ctx: { phone: string; idNo: string; addrDetail: string; tag: string },
  logPath: string
): Promise<FillLogEntry[]> => {
  const log: FillLogEntry[] = [];
  for (const p of plan) {
    const item = page.locator('.el-form-item').filter({ hasText: p.label }).first();
    const entry: FillLogEntry = {
      seq: p.seq,
      label: p.label,
      type: p.type,
      action: '',
      note: '',
      ok: false,
      absX: null,
      absY: null,
      inputX: null,
      inputY: null,
      dropdownX: null,
      dropdownY: null,
      btns: [],
    };
    const present = await item.count().catch(() => 0);
    const visibleNow = present ? await item.isVisible().catch(() => false) : false;
    if (!visibleNow) {
      entry.action = 'skip';
      entry.note = 'DYN_GONE(前序选择动态移除/隐藏该项,如归属人=本人时名称/身份证消失)';
      entry.ok = true;
      log.push(entry);
      console.log(`FILL seq=${p.seq} label=${p.label} type=${p.type} action=skip ok=true note=DYN_GONE`);
      continue;
    }
    if (p.btns.includes('查询') && !p.req) {
      entry.action = 'skip-ext';
      entry.note = 'EXT_SEARCH(外部检索字段且非必填,按步骤表不触发【查询】,留空)';
      entry.ok = true;
      log.push(entry);
      console.log(`FILL seq=${p.seq} label=${p.label} type=${p.type} action=skip-ext ok=true note=EXT_SEARCH`);
      continue;
    }
    try {
      await item.scrollIntoViewIfNeeded({ timeout: 8000 });
      await page.waitForTimeout(200);
      if (p.disabled) {
        entry.action = 'skip-disabled';
        entry.note = '控件禁用，跳过';
        entry.ok = true;
      } else if (p.type === 'skip') {
        entry.action = 'skip-readonly';
        entry.note = '只读/系统带出，跳过';
        entry.ok = true;
      } else if (p.type === 'date') {
        const dv = dateVal(p.label);
        const inp = item.locator('input').first();
        await inp.click();
        await inp.fill(dv);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        entry.action = 'date-fill';
        entry.note = '填' + dv + ' 后按Enter关闭面板';
        entry.ok = true;
      } else if (p.type === 'switch') {
        const sw = item.locator('.el-switch').first();
        const isOn = await sw.evaluate((el) => el.className.includes('is-on'));
        if (!isOn) {
          await sw.click();
          await page.waitForTimeout(300);
        }
        entry.action = isOn ? 'switch-already-on' : 'switch-on';
        entry.note = '开关置为打开';
        entry.ok = true;
      } else if (p.type === 'select') {
        let opt = defSelect(p.label);
        await item.locator('.el-select, input').first().click();
        await page.waitForTimeout(700);
        const dd = page.locator('.el-select-dropdown:visible').last();
        await dd.waitFor({ state: 'visible', timeout: 5000 });
        const opts = (await dd.locator('.el-select-dropdown__item').allInnerTexts()).map((s) => s.trim());
        if (!opts.length) {
          await page.keyboard.press('Escape');
          entry.action = 'select-no-option';
          entry.note = '下拉无选项，无法默认填充';
          entry.ok = false;
        } else {
          if (!opt || !opts.includes(opt)) opt = opts[0];
          const oidx = opts.indexOf(opt);
          await dd.locator('.el-select-dropdown__item').nth(oidx).click();
          await page.waitForTimeout(400);
          entry.action = 'select-first';
          entry.note = '取首项' + opt;
          entry.ok = true;
          entry.dropdownX = null;
          entry.dropdownY = null;
        }
      } else {
        const inp = item.locator('input, textarea').first();
        let v: string | null = defValue(p.label);
        if (p.label.includes('手机') || p.label.includes('电话')) v = ctx.phone;
        if (p.label.includes('证件号码')) v = ctx.idNo;
        if (!v) v = 'AT测试' + p.label.slice(0, 4) + ctx.tag;
        await inp.fill(v);
        entry.action = 'text-fill';
        entry.note = '填' + v;
        entry.ok = true;
      }
    } catch (e: any) {
      entry.action = 'error';
      entry.note = String(e.message || e).slice(0, 120);
      entry.ok = false;
      await ensureDialogsClosed(page);
    }
    try {
      const [ax, ay] = await measureRect(page, p.label);
      entry.absX = ax;
      entry.absY = ay;
      if (p.type === 'input' || p.type === 'textarea') {
        const ir = await measureInputRect(page, p.label);
        entry.inputX = ir ? ir[0] : null;
        entry.inputY = ir ? ir[1] : null;
      }
      entry.btns = p.btns.length ? (await measureBtnsRect(page, p.label, p.btns)) : [];
    } catch {
      /* rect measure best-effort */
    }
    log.push(entry);
    console.log(`FILL seq=${p.seq} label=${p.label} type=${p.type} action=${entry.action} ok=${entry.ok} note=${entry.note}`);
  }
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  return log;
};

export const clickTmpSave = async (page: Page, saveApi: (r: any) => boolean) => {
  await ensureDialogsClosed(page).catch(() => {});
  const reqLog: string[] = [];
  const onReq = (r: any) => {
    if (r.method() === 'POST') reqLog.push(r.url());
  };
  page.on('request', onReq);
  try {
    const found = await page.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('button')).filter(
        (b) => (b.innerText || '').trim() === '暂存' && (b as HTMLElement).offsetParent !== null
      );
      if (!bs.length) return false;
      (bs[0] as HTMLElement).scrollIntoView({ block: 'center' });
      return true;
    });
    if (!found) throw new Error('NO_TMP_SAVE_BTN');
    await page.waitForTimeout(800);
    const pos = await page.evaluate(() => {
      const bs = Array.from(document.querySelectorAll('button')).filter(
        (b) => (b.innerText || '').trim() === '暂存' && (b as HTMLElement).offsetParent !== null
      );
      if (!bs.length) return null;
      const r = (bs[0] as HTMLElement).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!pos) throw new Error('NO_TMP_SAVE_BTN_RECT');
    const q = page.waitForResponse(saveApi, { timeout: 90_000 });
    await page.mouse.click(pos.x, pos.y);
    await page
      .locator('.el-message-box:visible button:has-text("确 定"), .el-message-box:visible button:has-text("确定"), .el-message-box:visible button:has-text("确认")')
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});
    let res: any;
    try {
      res = await q;
    } catch (e: any) {
      const diag = await page.evaluate(() => {
        const v = Array.from(document.querySelectorAll('.el-form-item__error, .el-message, .el-message-box__message'))
          .map((m) => (m as HTMLElement).innerText.trim())
          .filter(Boolean)
          .join('|');
        return 'vErr=' + v.slice(0, 300);
      });
      console.log('TEMPSAVE_TIMEOUT_DIAG=', diag, 'REQS=', JSON.stringify(reqLog.slice(-10)));
      throw e;
    }
    const j = JSON.parse(await res.text());
    return { url: res.url(), j };
  } finally {
    page.off('request', onReq);
  }
};

export const measureAndSaveRects = async (
  page: Page,
  plan: FieldItem[],
  log: FillLogEntry[],
  logPath: string,
  tag: string
) => {
  for (const p of plan) {
    const e = log.find((l) => l.seq === p.seq);
    if (!e) continue;
    if (p.disabled || p.type === 'skip') continue;
    if ((await itemLoc(page, p.label).count().catch(() => 0)) === 0) continue;
    try {
      await itemLoc(page, p.label).scrollIntoViewIfNeeded({ timeout: 5000 });
      const [ax, ay] = await measureRect(page, p.label);
      if (ax != null) {
        e.absX = ax;
        e.absY = ay;
      }
      if (p.type === 'input' || p.type === 'textarea') {
        const ir = await measureInputRect(page, p.label);
        if (ir) {
          e.inputX = ir[0];
          e.inputY = ir[1];
        }
      }
      if (p.type === 'select' && e.note.startsWith('取首项')) {
        const opt = e.note.slice(3);
        try {
          await itemLoc(page, p.label).locator('.el-select, input').first().click();
          await page.waitForTimeout(500);
          const dr = await measureDropdownRect(page, p.label, opt);
          if (dr) {
            e.dropdownX = dr[0];
            e.dropdownY = dr[1];
          }
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* best-effort */
    }
  }
  fs.writeFileSync(logPath, JSON.stringify(log, null, 1));
  console.log('RECTS_SAVED=' + logPath + ' tag=' + tag);
};

export { itemValue, ensureDialogsClosed };
