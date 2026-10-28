// probe84 - 牺牲客户 260924143428658123：删管户权行(取删除API+确认文案+行1→0) → 回列表查该客户是否可见
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const CUST_NO = '260924143428658123';
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = { apis: [], console: [], pageerrors: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') result.console.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => result.pageerrors.push(String(e).slice(0, 300)));
  page.on('response', async (resp) => {
    const u = resp.url();
    if (resp.request().method() !== 'POST' || !u.includes('test.creditv5p2')) return;
    let body = '';
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 500); } catch (_) {}
    let req = '';
    try { req = (resp.request().postData() || '').slice(0, 300); } catch (_) {}
    result.apis.push({ m: resp.request().method(), u: u.replace('http://test.creditv5p2.tansun.com.cn', ''), req, resp: body });
  });
  const teamRows = async () => {
    return await page.evaluate(() => {
      const items = [...document.querySelectorAll('.el-collapse-item')].filter((c) => c.innerText.includes('维护客户管理团队'));
      if (!items.length) return null;
      const trs = items[0].querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr');
      return [...trs].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()).join('|')).filter(Boolean);
    });
  };

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
  const rows0 = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  log('P84_LIST0=' + rows0);
  if (rows0 < 1) { log('P84_NO_CUSTOMER_ABORT'); await browser.close(); process.exit(3); }
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(5000);
  await page.locator('.el-tabs__item').filter({ hasText: '其他信息' }).first().click();
  await sleep(6000);
  const teamPane = page.locator('.el-collapse-item').filter({ hasText: '维护客户管理团队' }).first();

  result.baselineRows = await teamRows();
  log('P84_BASE=' + JSON.stringify(result.baselineRows));
  if (!result.baselineRows || result.baselineRows.length !== 1) { log('P84_BASE_NOT_1_ABORT'); await browser.close(); process.exit(4); }

  // 选行 → 删除
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-collapse-item')].filter((c) => c.innerText.includes('维护客户管理团队'));
    const r = items[0].querySelector('.el-table__body-wrapper .el-table__body tbody tr input[type="radio"]');
    if (r) r.click();
  });
  await sleep(1000);
  result.apis.forEach((a) => (a._seen = 1));
  await teamPane.getByRole('button').filter({ hasText: /删\s*除/ }).first().click();
  await sleep(2500);
  result.msgbox = await page.evaluate(() => {
    const mb = document.querySelector('.el-message-box');
    return mb && mb.offsetParent !== null ? { text: mb.innerText.replace(/\s+/g, ' '), btns: [...mb.querySelectorAll('button')].map((b) => b.innerText.trim()) } : null;
  });
  log('P84_MSGBOX=' + JSON.stringify(result.msgbox));
  if (result.msgbox) {
    result.okBtnDiag = await page.evaluate(() => {
      const mb = [...document.querySelectorAll('.el-message-box')].find((m) => m.offsetParent !== null);
      if (!mb) return null;
      const bs = [...mb.querySelectorAll('button')];
      return bs.map((b) => ({ cls: b.className, txt: (b.innerText || '').trim(), dis: b.disabled, vis: b.offsetParent !== null, rect: b.getBoundingClientRect().toJSON() }));
    });
    log('P84_OKDIAG=' + JSON.stringify(result.okBtnDiag));
    await page.screenshot({ path: path.join(__dirname, 'p84_msgbox.png') });
    const okBtn = page.locator('.el-message-box:visible button.el-button--primary').first();
    await okBtn.click();
    await sleep(3000);
    result.boxClosed = await page.evaluate(() => {
      const mb = document.querySelector('.el-message-box');
      return !mb || mb.offsetParent === null;
    });
    log('P84_BOX_CLOSED=' + result.boxClosed);
  }
  result.delApis = result.apis.filter((a) => !a._seen);
  result.apis.forEach((a) => (a._seen = 1));
  log('P84_DEL_APIS=' + JSON.stringify(result.delApis.map((a) => a.u + ' ' + a.resp.slice(0, 200))));
  result.afterDel = await teamRows();
  log('P84_AFTER_DEL=' + JSON.stringify(result.afterDel));
  await page.screenshot({ path: path.join(__dirname, 'p84_after_delete.png') });

  // 回列表查可见性
  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(2500);
  await fi('客户编号').locator('input').first().fill(CUST_NO);
  const qP2 = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP2;
  await sleep(2000);
  const vis = await page.evaluate(() => {
    const trs = [...document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')];
    return { n: trs.length, rows: trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()).join('|')).filter(Boolean).map((r) => r.slice(0, 90)) };
  });
  result.listAfterDel = vis;
  log('P84_LIST_AFTER=' + JSON.stringify(vis));
  fs.writeFileSync(path.join(__dirname, 'probe84.out.json'), JSON.stringify(result, null, 1));
  log('P84_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P84_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
