// probe81 - 团队新增改用其他系统用户（非701994）→ 保存(全量响应) → 删除该业务权行 往返实测，恢复基线
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
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 1000); } catch (_) {}
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
  const mbText = async () => {
    return await page.evaluate(() => {
      const mb = document.querySelector('.el-message-box');
      if (!mb || mb.offsetParent === null) return null;
      return { text: mb.innerText.replace(/\s+/g, ' '), btns: [...mb.querySelectorAll('button')].map((b) => b.innerText.trim()) };
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

  result.baselineRows = await teamRows();
  log('P81_BASE=' + JSON.stringify(result.baselineRows));
  if (!result.baselineRows || result.baselineRows.length !== 1) { log('P81_BASE_NOT_1_ABORT'); await browser.close(); process.exit(3); }

  // 新增 → 引入（不过滤，取第一个非701994用户）
  await teamPane.getByRole('button').filter({ hasText: /新\s*增/ }).first().click();
  await sleep(2500);
  const addDlg = page.locator('.el-dialog:visible').last();
  await addDlg.getByRole('button').filter({ hasText: /引\s*入/ }).first().click();
  await sleep(3000);
  const selDlg = page.locator('.el-dialog:visible').last();
  const sP = page.waitForResponse((r) => r.url().includes('selector') && r.request().method() === 'POST', { timeout: 30_000 });
  await selDlg.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await sP;
  await sleep(2000);
  const nRows = await selDlg.locator('.el-table__body-wrapper tbody tr').count();
  result.selTotal = nRows;
  let picked = null;
  for (let i = 0; i < nRows; i++) {
    const row = selDlg.locator('.el-table__body-wrapper tbody tr').nth(i);
    const txt = (await row.innerText()).replace(/\s+/g, ' ').trim();
    if (!txt.includes('701994')) { picked = { i, txt: txt.slice(0, 80) }; break; }
  }
  if (!picked && nRows > 0) picked = { i: 0, txt: (await selDlg.locator('.el-table__body-wrapper tbody tr').first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 80) };
  result.picked = picked;
  log('P81_PICK=' + JSON.stringify(picked));
  if (!picked) { log('P81_NO_USER_ABORT'); await browser.close(); process.exit(4); }
  const row = selDlg.locator('.el-table__body-wrapper tbody tr').nth(picked.i);
  const radioCnt = await row.locator('input[type="radio"]').count();
  if (radioCnt > 0) await row.locator('input[type="radio"]').first().evaluate((el) => el.click());
  else await row.click();
  await sleep(800);
  await selDlg.getByRole('button').filter({ hasText: /确\s*认/ }).first().click();
  await sleep(2500);
  result.addDlgAfter = await addDlg.evaluate((d) => [...d.querySelectorAll('.el-form-item')].map((i) => ({ lb: i.querySelector('label') ? i.querySelector('label').innerText.trim() : '', val: (i.querySelector('input') || {}).value || '' })));
  log('P81_BACKFILL=' + JSON.stringify(result.addDlgAfter));

  // 确定保存（全量响应）
  await addDlg.getByRole('button').filter({ hasText: /确\s*定/ }).first().click();
  await sleep(3000);
  result.saveApi = result.apis.filter((a) => a.u.endsWith('/save') || a.u.includes('save'));
  log('P81_SAVE=' + JSON.stringify(result.saveApi.map((a) => a.u.split('/').pop() + ' ' + a.resp.slice(0, 300))));
  result.mbAfterSave = await mbText();
  const toast = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((t) => t.innerText.trim()).join('|'));
  result.toastAfterSave = toast || null;
  log('P81_MB=' + JSON.stringify(result.mbAfterSave) + ' TOAST=' + result.toastAfterSave);
  if (result.mbAfterSave) {
    const ok = page.locator('.el-message-box').getByRole('button').filter({ hasText: /确\s*定|^OK$/ }).first();
    if (await ok.isVisible().catch(() => false)) { await ok.click(); await sleep(1500); }
  }
  result.afterSaveRows = await teamRows();
  log('P81_AFTER_SAVE=' + JSON.stringify(result.afterSaveRows));
  await page.screenshot({ path: path.join(__dirname, 'p81_after_save.png') });

  // 删除业务权行
  if (result.afterSaveRows && result.afterSaveRows.length === 2) {
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.el-collapse-item')].filter((c) => c.innerText.includes('维护客户管理团队'));
      const trs = [...items[0].querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')];
      const biz = trs.find((tr) => tr.innerText.includes('业务权'));
      if (biz) { const r = biz.querySelector('input[type="radio"]'); if (r) r.click(); }
    });
    await sleep(1000);
    await teamPane.getByRole('button').filter({ hasText: /删\s*除/ }).first().click();
    await sleep(2500);
    result.msgbox = await mbText();
    log('P81_MSGBOX=' + JSON.stringify(result.msgbox));
    if (result.msgbox) {
      const okBtn = page.locator('.el-message-box').getByRole('button').filter({ hasText: /确\s*定|^OK$/ }).first();
      await okBtn.click();
      await sleep(3000);
      result.delApi = result.apis.filter((a) => a.u.includes('delete') || a.u.includes('Delete'));
      log('P81_DEL=' + JSON.stringify(result.delApi.map((a) => a.u.split('/').pop() + ' ' + a.resp.slice(0, 200))));
    }
    result.afterDelRows = await teamRows();
    log('P81_AFTER_DEL=' + JSON.stringify(result.afterDelRows));
    await page.screenshot({ path: path.join(__dirname, 'p81_after_delete.png') });
  }

  const back = page.getByRole('button').filter({ hasText: /返\s*回/ }).first();
  if (await back.isVisible().catch(() => false)) { await back.click(); await sleep(1500); }
  else log('P81_BACK_NOT_VISIBLE');
  fs.writeFileSync(path.join(__dirname, 'probe81.out.json'), JSON.stringify(result, null, 1));
  log('P81_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P81_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
