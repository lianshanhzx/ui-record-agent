// probe80 - 客户管理团队 新增(引入系统用户701994→业务权行) + 删除该业务权行 往返实测，取保存/删除 API 与删除确认文案；结束恢复基线(1行=管理权)
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
    if (u.includes('findCustTradeList') || u.includes('getCustTrade') || u.includes('ipcFcnScnInf') || u.includes('findCustTeam')) return;
    let body = '';
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 400); } catch (_) {}
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
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30_000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60_000 });
  await sleep(5000);
  await page.locator('.el-tabs__item').filter({ hasText: '其他信息' }).first().click();
  await sleep(6000);
  const teamPane = page.locator('.el-collapse-item').filter({ has: page.locator('text=维护客户管理团队') }).first();

  // —— 基线 ——
  result.baselineRows = await teamRows();
  log('P80_BASE=' + JSON.stringify(result.baselineRows));
  if (!result.baselineRows || result.baselineRows.length !== 1) { log('P80_BASE_NOT_1_ABORT'); await browser.close(); process.exit(3); }

  // —— 1) 新增 → 引入 ——
  result.apis.forEach((a) => (a._seen = 1));
  await teamPane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  const addDlg = page.locator('.el-dialog:visible').last();
  await addDlg.getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);
  const selDlg = page.locator('.el-dialog:visible').last();
  const usrNoInp = selDlg.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '用户编号' }) }).locator('input').first();
  await usrNoInp.fill('701994');
  const sP = page.waitForResponse((r) => r.url().includes('selector') && r.request().method() === 'POST', { timeout: 30_000 });
  await selDlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sP;
  await sleep(2000);
  let selRows = await selDlg.locator('.el-table__body-wrapper tbody tr').count();
  result.selBy701994 = selRows;
  log('P80_SEL701994=' + selRows);
  if (selRows === 0) {
    log('P80_FALLBACK_NO_FILTER');
    await selDlg.getByRole('button').filter({ hasText: /重\s*置/ }).first().click();
    await sleep(1000);
    await selDlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    await sleep(2000);
    selRows = await selDlg.locator('.el-table__body-wrapper tbody tr').count();
    log('P80_SEL_ANY=' + selRows);
  }
  if (selRows === 0) { log('P80_NO_USER_ABORT'); await browser.close(); process.exit(4); }

  // 行选择机制
  const radioCnt = await selDlg.locator('.el-table__body-wrapper tbody tr').first().locator('input[type="radio"]').count();
  const chkCnt = await selDlg.locator('.el-table__body-wrapper tbody tr').first().locator('input[type="checkbox"]').count();
  result.selMech = { radio: radioCnt, chk: chkCnt };
  const firstRow = selDlg.locator('.el-table__body-wrapper tbody tr').first();
  result.selPicked = (await firstRow.innerText()).replace(/\s+/g, ' ').trim().slice(0, 80);
  if (radioCnt > 0) await firstRow.locator('input[type="radio"]').first().evaluate((el) => el.click());
  else if (chkCnt > 0) await firstRow.locator('input[type="checkbox"]').first().evaluate((el) => el.click());
  else await firstRow.click();
  await sleep(800);
  result.apis.forEach((a) => (a._seen = 1));
  await selDlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await sleep(2500);
  result.apis_引入确认 = result.apis.filter((a) => !a._seen);
  result.apis.forEach((a) => (a._seen = 1));

  // 回填检查
  result.addDlgAfter = await addDlg.evaluate((d) => [...d.querySelectorAll('.el-form-item')].map((i) => ({ lb: i.querySelector('label') ? i.querySelector('label').innerText.trim() : '', val: (i.querySelector('input') || {}).value || '' })));
  log('P80_BACKFILL=' + JSON.stringify(result.addDlgAfter));
  await page.screenshot({ path: path.join(__dirname, 'p80_after_magnifier.png') });

  // —— 2) 新增弹窗【确定】→ 保存 API ——
  result.apis.forEach((a) => (a._seen = 1));
  await addDlg.getByRole('button').filter({ hasText: /确\s*定/ }).first().click();
  await sleep(3000);
  result.apis_新增保存 = result.apis.filter((a) => !a._seen);
  result.apis.forEach((a) => (a._seen = 1));
  log('P80_SAVE=' + JSON.stringify(result.apis_新增保存.map((a) => a.u.split('/').pop() + ' ' + a.resp.slice(0, 150))));
  const errToast = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((t) => t.innerText.trim()).join('|'));
  result.toastAfterSave = errToast || null;
  result.afterSaveRows = await teamRows();
  log('P80_AFTER_SAVE=' + JSON.stringify(result.afterSaveRows));
  await page.screenshot({ path: path.join(__dirname, 'p80_after_save.png') });
  if (!result.afterSaveRows || result.afterSaveRows.length !== 2) { log('P80_SAVE_NOT_2_ROWS'); }

  // —— 3) 选业务权行 → 删除 ——
  if (result.afterSaveRows && result.afterSaveRows.length === 2) {
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.el-collapse-item')].filter((c) => c.innerText.includes('维护客户管理团队'));
      const trs = [...items[0].querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')];
      const biz = trs.find((tr) => tr.innerText.includes('业务权'));
      if (biz) { const r = biz.querySelector('input[type="radio"]'); if (r) r.click(); }
    });
    await sleep(1000);
    result.apis.forEach((a) => (a._seen = 1));
    await teamPane.getByRole('button').filter({ hasText: /删\s*除/ }).first().click();
    await sleep(2500);
    result.msgbox = await page.evaluate(() => {
      const mb = document.querySelector('.el-message-box');
      return mb && mb.offsetParent !== null ? { text: mb.innerText.replace(/\s+/g, ' '), btns: [...mb.querySelectorAll('button')].map((b) => b.innerText.trim()) } : null;
    });
    log('P80_MSGBOX=' + JSON.stringify(result.msgbox));
    if (result.msgbox) {
      const okBtn = page.locator('.el-message-box').getByRole('button').filter({ hasText: /确\s*定|^OK$/ }).first();
      await okBtn.click();
      await sleep(3000);
      result.apis_删除 = result.apis.filter((a) => !a._seen);
      result.apis.forEach((a) => (a._seen = 1));
      log('P80_DEL=' + JSON.stringify(result.apis_删除.map((a) => a.u.split('/').pop() + ' ' + a.resp.slice(0, 150))));
    }
    result.afterDelRows = await teamRows();
    log('P80_AFTER_DEL=' + JSON.stringify(result.afterDelRows));
    await page.screenshot({ path: path.join(__dirname, 'p80_after_delete.png') });
  }

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  fs.writeFileSync(path.join(__dirname, 'probe80.out.json'), JSON.stringify(result, null, 1));
  log('P80_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P80_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
