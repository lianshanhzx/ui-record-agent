import { Page, Locator } from '@playwright/test';

export const W = 1440;
export const H = 900;

export const normRect = (b: { x: number; y: number; width: number; height: number } | null): string => {
  if (!b) return '';
  const n = (v: number) => Math.round(v * 1000) / 1000;
  return JSON.stringify({ x1: n(b.x / W), y1: n(b.y / H), x2: n((b.x + b.width) / W), y2: n((b.y + b.height) / H) });
};

export const reqMethod = (r: any): string => {
  if (typeof r.request === 'function') return r.request().method();
  if (r.request && typeof r.request.method === 'string') return r.request.method;
  if (typeof r.method === 'function') return r.method();
  return r.method;
};

export const LIST_API = (r: any) =>
  r.url().includes('/tansun-tcp-cst/custPersonal/queryUnion') && reqMethod(r) === 'POST';

export const PRIVATE_ROUTE = '/#/cstMgt/csinfMnt/prvtCstMgt/idcstMgtPg';

export const openList = async (page: Page) => {
  await page.setViewportSize({ width: W, height: H });
  const listReady = page.waitForResponse(LIST_API, { timeout: 240_000 });
  await page.goto(PRIVATE_ROUTE, { waitUntil: 'domcontentloaded' });
  await listReady;
};

export const ROWS = '.el-table__body-wrapper .el-table__body tbody tr:visible';

export const formItem = (page: Page, label: string) =>
  page.locator('.el-form-item').filter({ hasText: label }).first();

export const inputListField = (page: Page, label: string) =>
  formItem(page, label).locator('input').first();

export const expandMore = async (page: Page) => {
  await page.locator('button i.el-icon-caret-bottom').first().click();
  await page.waitForTimeout(800);
};

export const switchQuerySort = async (page: Page, on: boolean) => {
  const sw = formItem(page, '创建时间排序').locator('.el-switch');
  const isOn = await sw.first().evaluate((el) => el.className.includes('is-on'));
  if (isOn !== on) await sw.first().click();
  await page.waitForTimeout(500);
};

export const pickListSelect = async (page: Page, label: string, optionText: string) => {
  await formItem(page, label).locator('.el-select, input').first().click();
  await page.waitForTimeout(800);
  const dd = page.locator('.el-select-dropdown:visible').last();
  await dd.waitFor({ state: 'visible', timeout: 10_000 });
  const opts = dd.locator('.el-select-dropdown__item');
  const n = await opts.count();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    if (((await opts.nth(i).innerText()) || '').trim() === optionText) {
      idx = i;
      break;
    }
  }
  if (idx < 0) throw new Error('option not found: ' + optionText);
  const opt = opts.nth(idx);
  await opt.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await opt.click();
  await page.waitForTimeout(500);
};

export const pickUserSelect = async (
  page: Page,
  label: string,
  userName: string,
  onPanel?: (search: Locator, row: Locator) => Promise<void>
) => {
  await formItem(page, label).locator('.el-select, input').first().click();
  await page.waitForTimeout(1000);
  const dd = page.locator('.el-select-dropdown:visible').last();
  await dd.waitFor({ state: 'visible', timeout: 10_000 });
  const search = dd.locator('input:visible').first();
  if ((await search.count()) > 0) {
    await search.fill(userName);
    await page.waitForTimeout(1200);
  }
  const row = dd
    .locator('.el-table__body-wrapper .el-table__body tbody tr:visible')
    .filter({ hasText: userName })
    .first();
  if (onPanel) await onPanel(search, row);
  await row.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await row.click();
  await page.waitForTimeout(500);
};

export const drawerVisible = (page: Page): Locator => page.locator('.el-drawer:visible').first();

export const dumpSelectOptionsIn = async (
  page: Page,
  root: Locator,
  label: string,
  value: string,
  rects: Record<string, string>,
  key?: string
): Promise<string[]> => {
  await root.locator('.el-form-item').filter({ hasText: label }).first().locator('.el-select, input').first().click();
  await page.waitForTimeout(800);
  const dd = page.locator('.el-select-dropdown:visible').last();
  const opts = dd.locator('.el-select-dropdown__item');
  const n = await opts.count();
  const arr: string[] = [];
  let exactRect = '';
  for (let i = 0; i < n; i++) {
    const t = ((await opts.nth(i).innerText()) || '').trim();
    arr.push(t);
    if (t === value) exactRect = normRect(await opts.nth(i).boundingBox());
  }
  rects[key || label + '-选项'] = exactRect;
  console.log(`OPTS ${label} =`, JSON.stringify(arr));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return arr;
};

export const dumpSelectOptions = (
  page: Page,
  label: string,
  value: string,
  rects: Record<string, string>,
  key?: string
): Promise<string[]> => dumpSelectOptionsIn(page, page.locator('body'), label, value, rects, key);

export const firstOptionText = async (page: Page, label: string): Promise<string> => {
  await formItem(page, label).locator('.el-select, input').first().click();
  await page.waitForTimeout(800);
  const dd = page.locator('.el-select-dropdown:visible').last();
  const txt = (await dd.locator('.el-select-dropdown__item').first().innerText()).trim();
  await page.keyboard.press('Escape');
  return txt;
};

export const readFirstRow = async (page: Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll('.el-table__header-wrapper th .cell')).map(
      (h) => (h.innerText || '').trim()
    );
    const tr = Array.from(document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).find(
      (t) => (t as HTMLElement).offsetParent !== null
    );
    if (!tr) throw new Error('no row');
    const cells = Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim());
    const o: Record<string, string> = {};
    heads.forEach((h, j) => {
      if (h) o[h] = cells[j] || '';
    });
    return o;
  });

export const rowByIndex = async (page: Page, i: number): Promise<Record<string, string>> =>
  page.evaluate((idx) => {
    const heads = Array.from(document.querySelectorAll('.el-table__header-wrapper th .cell')).map(
      (h) => (h.innerText || '').trim()
    );
    const tr = Array.from(document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr'))
      .filter((t) => (t as HTMLElement).offsetParent !== null)[idx];
    if (!tr) throw new Error('row ' + idx + ' not found');
    const cells = Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim());
    const o: Record<string, string> = {};
    heads.forEach((h, j) => {
      if (h) o[h] = cells[j] || '';
    });
    return o;
  }, i);

export const pickRow = async (page: Page, keyword: string, forbiddenSt: string[], col = '客户名称'): Promise<number> => {
  const cnt = await page.locator(ROWS).count();
  for (let i = 0; i < cnt; i++) {
    const m = await rowByIndex(page, i);
    const st = m['客户状态'] || '';
    if ((m[col] || '').includes(keyword) && !forbiddenSt.some((f) => st.includes(f))) return i;
  }
  return -1;
};

export const fieldRect = async (page: Page, label: string): Promise<string> => {
  const b = await formItem(page, label).locator('input').first().boundingBox();
  return b ? normRect(b) : '';
};

export const btnRect = async (page: Page, text: string): Promise<string> => {
  const b = await page.getByRole('button').filter({ hasText: text }).first().boundingBox();
  return b ? normRect(b) : '';
};

export const moreRect = async (page: Page): Promise<string> => {
  const b = await page.locator('button:has(i[class*="el-icon-caret"])').first().boundingBox();
  return b ? normRect(b) : '';
};

export const switchRect = async (page: Page): Promise<string> => {
  const b = await formItem(page, '创建时间排序').locator('.el-switch').first().boundingBox();
  return b ? normRect(b) : '';
};
