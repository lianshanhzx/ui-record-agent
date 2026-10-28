// fillSubflows.ts - 按钮辅助子流程：地址弹窗 / 行业5级级联 / 引入空查 / 企业规模测算
import { Page } from '@playwright/test';
import {
  evalClickItemBtn, itemValue, itemLoc, type DialogStep,
  measureItemBtn, measureItemField, measureDlgField, measureDlgBtn, measureDlgPh, measurePopSel, measurePopBtn
} from './fillEngine';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normBtn = (s: string) => s.replace(/\s/g, '');

// 地址弹窗：省份(预填)/城市/区/县/乡镇/街道/行政村/社区/详细地址 -> 确认 -> 回写(偶发丢详细地址,重试)
// mode='division'：行政区划名称，仅回写省/市/区(无详细地址)
export async function fillAddress(page: Page, label: string, ctx: { addrDetail: string }, mode: 'detail' | 'division' = 'detail'): Promise<{ ok: boolean; note: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlgName = mode === 'division' ? '行政区划联动' : '客户地址五级联动';
  let btnName = '';
  for (const attempt = 0; attempt < 2 && !btnName; attempt++) {
    const bs = await page.evaluate((lb: string) => {
      const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
        const l = x.querySelector('label');
        return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && x.offsetParent !== null;
      });
      return it ? Array.from(it.querySelectorAll('button')).map((x) => x.innerText.trim()).filter(Boolean) : [];
    }, label);
    btnName = bs.find((b) => normBtn(b) === '选择') || bs.find((b) => normBtn(b) === '获取地址') || '';
    if (!btnName) return { ok: false, note: 'NO_ADDR_BTN:' + bs.join(','), steps };
    const rOpen = await measureItemBtn(page, label, btnName);
    const cr = await evalClickItemBtn(page, label, btnName);
    steps.push({ dialog: dlgName, action: 'click', target: '打开[' + btnName + ']', rect: rOpen });
    if (cr.startsWith('NO_')) return { ok: false, note: cr, steps };
    await sleep(1500);
    const hasDlg = await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).some((x) => x.offsetParent !== null && x.querySelector('input')));
    if (!hasDlg) {
      if (attempt === 0) await sleep(1500);
      if (!hasDlg && attempt === 0) continue;
    }
    if (attempt === 1 && !hasDlg) return { ok: false, note: 'ADDR_NO_DIALOG', steps };
    break;
  }
  await sleep(1200);
  const adlg = page.locator('.el-dialog:visible').first();
  if (!(await adlg.count())) return { ok: false, note: 'ADDR_NO_DIALOG2', steps };
  const dIt = (lb: string) => adlg.locator('.el-form-item').filter({ hasText: lb }).first();
  const pickFirst = async (field: string, rField: string) => {
    const opt = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').first();
    const txt = ((await opt.innerText().catch(() => '')) || '').trim();
    await opt.click({ timeout: 8000 });
    steps.push({ dialog: dlgName, action: 'select', target: field, value: txt, rect: rField });
  };
  try {
    const rCity = await measureDlgField(page, '城市', 'select');
    await dIt('城市').locator('.el-select, input').first().click({ timeout: 8000 });
    await sleep(1500);
    await pickFirst('城市', rCity);
    await sleep(2200);
    const rDist = await measureDlgField(page, '区/县', 'select');
    await dIt('区/县').locator('.el-select, input').first().click({ timeout: 8000 });
    await sleep(1500);
    await pickFirst('区/县', rDist);
    await sleep(1200);
  } catch (e: any) {
    return { ok: false, note: 'ADDR_SEL:' + e.message.slice(0, 60), steps };
  }
  const detailIt = dIt('详细地址');
  if ((await detailIt.count().catch(() => 0)) > 0) {
    const dv = mode === 'division' ? 'AT' : ctx.addrDetail;
    const rDetail = await measureDlgField(page, '详细地址', 'input');
    await detailIt.locator('input,textarea').first().fill(dv).catch(() => {});
    steps.push({ dialog: dlgName, action: 'input', target: '详细地址', value: dv, rect: rDetail });
  }
  await sleep(400);
  const rOk = await measureDlgBtn(page, '确认');
  steps.push({ dialog: dlgName, action: 'click', target: '确认', rect: rOk });
  await adlg.getByRole('button').filter({ hasText: '确认' }).click();
  try {
    await page.waitForFunction(
      (a: [string, string, string]) => {
        const [lb, detail, md] = a;
        const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
          const l = x.querySelector('label');
          return l && l.innerText.trim().replace(/[*\s]/g, '') === lb && x.offsetParent !== null;
        });
        const v = it ? (it.querySelector('input') || {}).value || '' : '';
        return md === 'division' ? v.length >= 3 && /[省市区县]/.test(v) : v.includes(detail);
      },
      [label, ctx.addrDetail, mode] as const,
      { timeout: 15000 }
    );
    const v = await itemValue(page, label);
    return { ok: true, note: (mode === 'division' ? 'admdv:' : 'addr:') + v.slice(0, 30), steps };
  } catch {
    const v = await itemValue(page, label);
    return { ok: false, note: (mode === 'division' ? 'ADMDV_FAIL' : 'ADDR_NO_DETAIL') + ' val=' + v.slice(0, 40), steps };
  }
}

// 行业代码：真实鼠标点击 span.my-popover(合成事件无效) -> .el-popover 内 el-tree 行业树
// 树内[查询]输入筛选 -> 逐级选节点(叶子/首个可见节点) -> 回写代码
export async function fillIndustry(page: Page, label: string): Promise<{ ok: boolean; note: string; value: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlg = '行业代码树查询';
  const item = itemLoc(page, label);
  if (!(await item.count())) return { ok: false, note: 'IND_NO_ITEM', value: '', steps };
  const span = item.locator('.my-popover, .el-tooltip').first();
  let opened = false;
  for (let i = 0; i < 3 && !opened; i++) {
    const box = await span.boundingBox().catch(() => null);
    if (!box) return { ok: false, note: 'IND_NO_SPAN', value: '', steps };
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(1800);
    opened = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.el-popover')).some(
        (p) => p.offsetParent !== null && p.getAttribute('aria-hidden') === 'false' && !!p.querySelector('.el-tree')
      )
    );
  }
  if (!opened) return { ok: false, note: 'IND_NO_POPOVER', value: '', steps };
  const rSpan = await measureItemField(page, label, 'span');
  steps.push({ dialog: dlg, action: 'click', target: '打开行业树[span.my-popover]', rect: rSpan });
  const pop = page.locator('.el-popover:visible').filter({ has: page.locator('.el-tree') }).first();
  try {
    const rSearch = await measurePopSel(page, '.search-input input, input');
    await pop.locator('.search-input input, input').first().fill('银行', { timeout: 5000 });
    steps.push({ dialog: dlg, action: 'input', target: '树内搜索', value: '银行', rect: rSearch });
    const rQ = await measurePopBtn(page, '查询');
    await pop.getByRole('button').filter({ hasText: '查询' }).first().click({ timeout: 5000 });
    steps.push({ dialog: dlg, action: 'click', target: '查询', rect: rQ });
    await sleep(2000);
  } catch {}
  let lastR = '';
  let lastRect = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const prevR = lastR;
    const res = await page.evaluate(() => {
      const pop = Array.from(document.querySelectorAll('.el-popover')).find(
        (p) => p.offsetParent !== null && p.getAttribute('aria-hidden') === 'false' && p.querySelector('.el-tree')
      );
      if (!pop) return { r: 'NO_POP', rect: null };
      const vis = Array.from(pop.querySelectorAll('.el-tree-node__content')).filter((n) => (n as HTMLElement).offsetParent !== null);
      if (!vis.length) return { r: 'NO_NODE', rect: null };
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const isLeaf = (n: HTMLElement) => {
        const ic = n.querySelector('.el-tree-node__expand-icon') as HTMLElement | null;
        return !!ic && ic.classList.contains('is-leaf');
      };
      for (const n of vis) {
        if (isLeaf(n)) {
          n.click();
          return { r: 'LEAF:' + (n.innerText || '').trim().slice(0, 24), rect: box(n) };
        }
      }
      const first = vis[0];
      const nodeDiv = first.closest('.el-tree-node');
      const icon = first.querySelector('.el-tree-node__expand-icon') as HTMLElement | null;
      const txt = (first.innerText || '').trim().slice(0, 24);
      if (icon && nodeDiv && !nodeDiv.classList.contains('is-expanded')) {
        icon.click();
        return { r: 'EXPAND:' + txt, rect: box(icon) };
      }
      first.click();
      return { r: 'NODE:' + txt, rect: box(first) };
    }) as { r: string; rect: { x: number; y: number; width: number; height: number } | null };
    lastR = res.r;
    lastRect = res.rect
      ? JSON.stringify({
          x1: +(res.rect.x / 1440).toFixed(3),
          y1: +(res.rect.y / 900).toFixed(3),
          x2: +((res.rect.x + res.rect.width) / 1440).toFixed(3),
          y2: +((res.rect.y + res.rect.height) / 900).toFixed(3)
        })
      : '';
    if (lastR && lastR !== prevR && lastR !== 'NO_POP' && lastR !== 'NO_NODE') {
      const [act, ...rest] = lastR.split(':');
      steps.push({ dialog: dlg, action: act === 'LEAF' ? 'tree_select' : act === 'EXPAND' ? 'tree_expand' : 'tree_node', target: rest.join(':'), rect: lastRect });
    }
    await sleep(1500);
    const v = await itemValue(page, label);
    if (v) {
      steps.push({ dialog: dlg, action: 'close', target: 'Escape' });
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(500);
      return { ok: true, note: 'industry_tree:' + lastR, value: v, steps };
    }
    if (lastR === 'NO_POP') return { ok: false, note: 'IND_NO_POPOVER2', value: '', steps };
    if (lastR === 'NO_NODE') return { ok: false, note: 'IND_NO_NODE', value: '', steps };
  }
  return { ok: false, note: 'IND_NO_WRITEBACK ' + lastR, value: '', steps };
}

// 引入：[引入] -> 对私客户查询弹窗(填AT+查询) -> 计数行数 -> 取消(环境无数据,选择不可达)
export async function fillImport(page: Page, label: string): Promise<{ ok: boolean; note: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlgName = '对私客户查询';
  const rOpen = await measureItemBtn(page, label, '引入');
  const cr = await evalClickItemBtn(page, label, '引入');
  if (cr.startsWith('NO_')) return { ok: false, note: cr, steps };
  steps.push({ dialog: dlgName, action: 'click', target: '打开[引入]', rect: rOpen });
  await page.waitForSelector('.el-dialog:visible', { timeout: 10000 }).catch(() => {});
  await sleep(1500);
  const dlg = page.locator('.el-dialog:visible').last();
  if (!(await dlg.count())) return { ok: false, note: 'IMP_NO_DIALOG', steps };
  try {
    const txt = dlg.locator('input[placeholder="请输入"]').first();
    if (await txt.count()) {
      const rCond = await measureDlgPh(page, '请输入');
      await txt.fill('AT');
      steps.push({ dialog: dlgName, action: 'input', target: '查询条件', value: 'AT', rect: rCond });
      const rQ = await measureDlgBtn(page, '查询');
      await dlg.getByRole('button').filter({ hasText: '查询' }).first().click();
      steps.push({ dialog: dlgName, action: 'click', target: '查询', rect: rQ });
      await sleep(2500);
    }
  } catch {}
  const rows = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter((x) => x.offsetParent !== null);
    const d = ds[ds.length - 1];
    return d ? d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr').length : -1;
  });
  const rCancel = await measureDlgBtn(page, '取消');
  await dlg.getByRole('button').filter({ hasText: '取消' }).first().click({ timeout: 8000 }).catch(() => page.keyboard.press('Escape'));
  steps.push({ dialog: dlgName, action: 'click', target: '取消', value: 'rows=' + rows, rect: rCancel });
  await sleep(800);
  return { ok: true, note: 'import_rows=' + rows, steps };
}

// 企业规模：[测算] -> 轮询回写; 无值则直接选默认 中型企业
export async function fillCalc(page: Page, label: string): Promise<{ ok: boolean; value: string; note: string; steps: DialogStep[] }> {
  const steps: DialogStep[] = [];
  const dlgName = '企业规模';
  const rCalc = await measureItemBtn(page, label, '测算');
  const cr = await evalClickItemBtn(page, label, '测算');
  if (cr.startsWith('NO_')) {
    const item = itemLoc(page, label);
    try {
      const rSel = await measureItemField(page, label, 'select');
      await item.locator('.el-select, input').first().click({ timeout: 4000 });
      await sleep(1000);
      await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '中型企业' }).first().click({ timeout: 4000 });
      await sleep(500);
      steps.push({ dialog: dlgName, action: 'select', target: '企业规模', value: '中型企业', rect: rSel });
      return { ok: true, value: '中型企业', note: 'NO_CALC_BTN_direct_select', steps };
    } catch {
      return { ok: false, value: '', note: cr, steps };
    }
  }
  steps.push({ dialog: dlgName, action: 'click', target: '测算', rect: rCalc });
  for (let i = 0; i < 10; i++) {
    await sleep(1200);
    const v = await itemValue(page, label);
    if (v) return { ok: true, value: v, note: 'calc_ok', steps };
  }
  try {
    const item = itemLoc(page, label);
    const rSel = await measureItemField(page, label, 'select');
    await item.locator('.el-select, input').first().click({ timeout: 4000 });
    await sleep(1000);
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '中型企业' }).first().click({ timeout: 4000 });
    await sleep(500);
    const v = await itemValue(page, label);
    steps.push({ dialog: dlgName, action: 'select', target: '企业规模', value: '中型企业', rect: rSel });
    return { ok: !!v, value: v, note: 'calc_empty_direct_select', steps };
  } catch (e: any) {
    return { ok: false, value: '', note: 'CALC_FALLBACK:' + e.message.slice(0, 60), steps };
  }
}
