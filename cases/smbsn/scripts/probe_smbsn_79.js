// probe79 - 探「维护客户管理团队」新增弹窗内【引入】放大镜结构（只探不改：不确认）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const CUST_NO = '260924144929974126';
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = { apis: [] };
  page.on('response', async (resp) => {
    const u = resp.url();
    if (resp.request().method() === 'GET' || !u.includes('/tansun')) return;
    if (u.includes('findCustTradeList') || u.includes('getCustTrade') || u.includes('ipcFcnScnInf')) return;
    let body = '';
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 400); } catch (_) {}
    let req = '';
    try { req = (resp.request().postData() || '').slice(0, 300); } catch (_) {}
    result.apis.push({ m: resp.request().method(), u: u.replace('http://test.creditv5p2.tansun.com.cn', ''), req, resp: body });
  });

  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  const fi = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await fi('客户编号').locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP;
  await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(5000);
  await page.locator('.el-tabs__item').filter({ hasText: '其他信息' }).first().click();
  await sleep(6000);

  const teamPane = page.locator('.el-collapse-item').filter({ has: page.locator('text=维护客户管理团队') }).first();
  await teamPane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  const dlg = page.locator('.el-dialog:visible').last();

  // 点【引入】
  result.apis.forEach((a) => (a._seen = 1));
  await dlg.getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(4000);
  const mag = await page.evaluate(() => {
    const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null);
    if (dlgs.length < 2) return { err: 'NO_SUBDIALOG', dlgs: dlgs.length };
    const sub = dlgs[dlgs.length - 1];
    const title = sub.querySelector('.el-dialog__title');
    const items = [...sub.querySelectorAll('.el-form-item')].map((i) => {
      const lb = i.querySelector('label');
      const inp = i.querySelector('input');
      const sel = i.querySelector('.el-select');
      return { lb: lb ? lb.innerText.trim() : '', type: sel ? 'select' : (inp ? (inp.disabled ? 'dis-input' : 'input') : 'other'), val: inp ? inp.value : '' };
    });
    const btns = [...sub.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean);
    const headers = [...sub.querySelectorAll('.el-table__header-wrapper th')].map((h) => h.innerText.trim()).filter(Boolean);
    const rows = sub.querySelectorAll('.el-table__body-wrapper tbody tr').length;
    return { title: title ? title.innerText.trim() : '', items, btns, headers, rows };
  });
  result.mag = mag;
  log('P79_MAG=' + JSON.stringify(mag));
  await page.screenshot({ path: path.join(__dirname, 'p79_magnifier.png') });

  // 触发一次查询看 API
  const subDlg = page.locator('.el-dialog:visible').last();
  const newApis = result.apis.filter((a) => !a._seen);
  result.apis_打开引入 = newApis;
  result.apis.forEach((a) => (a._seen = 1));
  const qBtn = subDlg.getByRole('button').filter({ hasText: /查\s*询|检\s*索/ }).first();
  if (await qBtn.isVisible().catch(() => false)) {
    await qBtn.click();
    await sleep(3000);
    result.apis_引入查询 = result.apis.filter((a) => !a._seen);
    result.apis.forEach((a) => (a._seen = 1));
    log('P79_Q_API=' + JSON.stringify(result.apis_引入查询.map((a) => a.u.split('/').pop() + ' ' + a.resp.slice(0, 120))));
  }

  // 关闭子弹窗 + 新增弹窗
  const subCancel = subDlg.getByRole('button').filter({ hasText: /取\s*消|关\s*闭/ }).first();
  if (await subCancel.isVisible().catch(() => false)) { await subCancel.click(); await sleep(1500); }
  else { await page.keyboard.press('Escape'); await sleep(1500); }
  const dlg2 = page.locator('.el-dialog:visible').last();
  const cancel = dlg2.getByRole('button').filter({ hasText: /取\s*消/ }).first();
  if (await cancel.isVisible().catch(() => false)) { await cancel.click(); await sleep(1500); }

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  fs.writeFileSync(path.join(__dirname, 'probe79.out.json'), JSON.stringify(result, null, 1));
  log('P79_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P79_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
