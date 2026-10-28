// probe_smbsn_25.js - 选定股东类型后: select 打开机制 + 引入弹窗结构 + 其余选项 + 确定校验
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CUST_NO = '260924144929974126';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('tansun') || r.request().method() !== 'POST') return;
    try {
      const j = JSON.parse(await r.text());
      const d = j && j.data;
      apis.push({ url: u.replace(BASE, ''), code: j && j.code, msg: j && j.message, total: (d && d.total) ?? null });
    } catch {}
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await page.waitForTimeout(1500);
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  const getCustP = page.waitForResponse((r) => r.url().includes('getCustTrade') && r.request().method() === 'POST', { timeout: 90000 });
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await getCustP;
  await page.waitForTimeout(4000);
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-tab-pane:visible button').filter({ hasText: /新\s*增/ }).first().click();
  await page.waitForTimeout(2500);
  const D = '.el-dialog:visible';
  const FI = (lb) => page.locator(`${D} .el-form-item`).filter({ has: page.locator('label', { hasText: lb }) }).first();

  const ddState = () => page.evaluate(() => {
    const dds = Array.from(document.querySelectorAll('.el-select-dropdown'));
    return dds.map((d) => ({ disp: d.style.display, vis: d.offsetParent !== null, opts: Array.from(d.querySelectorAll('.el-select-dropdown__item')).map((o) => (o.innerText || '').trim()) }));
  });

  // ---- 1) 股东类型: 尝试 3 种打开方式 ----
  const fi = FI('股东类型');
  const trySel = async (name, fn) => {
    await fn().catch((e) => console.log(`SEL[${name}] act fail: ${e.message.split('\n')[0]}`));
    await page.waitForTimeout(1200);
    const st = await ddState();
    const open = st.find((x) => x.vis);
    console.log(`SEL[${name}] open=`, open ? JSON.stringify(open.opts) : 'NONE');
    return open;
  };
  let open = await trySel('inputInner', () => fi.locator('.el-input__inner').click({ timeout: 3000 }));
  if (!open) open = await trySel('mousedown', async () => { await fi.locator('.el-input__inner').dispatchEvent('mousedown'); await page.waitForTimeout(300); await fi.locator('.el-input__inner').dispatchEvent('mouseup'); await fi.locator('.el-input__inner').dispatchEvent('click'); });
  if (!open) open = await trySel('kbd', async () => { await fi.locator('.el-input__inner').focus(); await page.keyboard.press('ArrowDown'); });
  if (!open) { console.log('SELECT_OPEN_ALL_FAIL'); }

  if (open) {
    // 选「法人或其他组织」
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: '法人或其他组织' }).first().click();
    await page.waitForTimeout(1500);
    console.log('股东类型 selected=法人或其他组织');
    await page.screenshot({ path: path.join(DIR, 's3_07_after_shrt.png') });
  }

  // ---- 2) 其余 select 选项（此时证件类型可能随股东类型联动）----
  for (const lb of ['证件类型', '币种', '出资方式']) {
    const f = FI(lb);
    const o = await trySel(lb, () => f.locator('.el-input__inner').click({ timeout: 3000 }));
    if (!o) {
      // 直接从 DOM 读该 form-item 内联下拉的选项
      const dom = await page.evaluate((label) => {
        const f = Array.from(document.querySelectorAll('.el-dialog .el-form-item')).find((x) => (x.querySelector('label') || {}).innerText && x.querySelector('label').innerText.includes(label));
        if (!f) return null;
        const dd = f.querySelector('.el-select-dropdown');
        return dd ? Array.from(dd.querySelectorAll('.el-select-dropdown__item')).map((x) => (x.innerText || '').trim()) : null;
      }, lb);
      console.log(`OPTS[${lb}](dom)=`, JSON.stringify(dom));
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // ---- 3) 股东类型已选 → 点 引入 ----
  const impBtn = FI('股东名称').getByRole('button').filter({ hasText: /引\s*入/ }).first();
  await impBtn.click({ timeout: 5000 });
  await page.waitForTimeout(3500);
  const impDump = await page.evaluate(() => {
    const ds = Array.from(document.querySelectorAll('.el-dialog, .el-drawer')).filter((d) => d.offsetParent !== null);
    if (!ds.length) return null;
    const d = ds[ds.length - 1];
    const title = ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim();
    const fields = [];
    d.querySelectorAll('.el-form-item').forEach((f) => {
      const l = f.querySelector('label');
      if (!l) return;
      fields.push({ label: (l.innerText || '').trim(), type: f.querySelector('.el-select') ? 'select' : f.querySelector('input') ? 'input' : '?' });
    });
    const heads = Array.from(d.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map((h) => (h.innerText || '').trim()).filter(Boolean);
    const rows = Array.from(d.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).slice(0, 3).map((tr) => Array.from(tr.querySelectorAll('td .cell')).map((c) => (c.innerText || '').trim().slice(0, 25)));
    const btns = Array.from(d.querySelectorAll('button')).map((b) => (b.innerText || '').trim()).filter(Boolean);
    return { title, fields, heads, rowCount: rows.length, rows, btns };
  });
  console.log('IMP_DLG=', JSON.stringify(impDump, null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_08_import.png') });

  // 引入弹窗 select 选项
  if (impDump) {
    for (const f of impDump.fields.filter((x) => x.type === 'select')) {
      const floc = page.locator('.el-dialog:visible, .el-drawer:visible').last().locator('.el-form-item').filter({ has: page.locator('label', { hasText: f.label }) }).first();
      const o = await trySel('IMP_' + f.label, () => floc.locator('.el-input__inner').click({ timeout: 3000 }));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }
  // 引入弹窗点【查询】看 API
  const qBtn = page.locator('.el-dialog:visible, .el-drawer:visible').last().getByRole('button').filter({ hasText: /查\s*询/ });
  if (await qBtn.count()) {
    const p2 = page.waitForResponse((r) => r.request().method() === 'POST' && /List|Page|query|Query|find|Find/.test(r.url()), { timeout: 20000 }).catch(() => null);
    await qBtn.first().click();
    const resp = await p2;
    await page.waitForTimeout(2500);
    console.log('IMP_QUERY_API=', resp ? resp.url().replace(BASE, '') : 'none', JSON.stringify(apis.slice(-2)));
  }
  // 引入弹窗取消
  await page.locator('.el-dialog:visible, .el-drawer:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  // ---- 4) 只选了股东类型, 其余必填空 → 点确定看校验提示 ----
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await page.waitForTimeout(3500);
  const vld = await page.evaluate(() => ({
    messages: Array.from(document.querySelectorAll('.el-message')).map((m) => (m.innerText || '').trim()).filter(Boolean),
    msgbox: Array.from(document.querySelectorAll('.el-message-box')).filter((d) => d.offsetParent !== null).map((d) => (d.innerText || '').trim().slice(0, 300)),
    formErrors: Array.from(document.querySelectorAll('.el-dialog .el-form-item__error')).map((e) => (e.innerText || '').trim()).filter(Boolean),
    dlgOpen: Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length,
  }));
  console.log('VALIDATION=', JSON.stringify(vld, null, 1));
  console.log('APIS_TAIL=', JSON.stringify(apis.slice(-5), null, 1));
  await page.screenshot({ path: path.join(DIR, 's3_09_validation.png') });

  await page.locator('.el-dialog:visible').last().getByRole('button').filter({ hasText: /取\s*消/ }).first().click().catch(() => {});
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
