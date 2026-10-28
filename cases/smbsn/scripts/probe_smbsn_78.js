// probe78 - 探「维护客户管理团队」【新增】弹窗结构（只探不改：不保存；顺带探未选行点【删除】的行为）
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
    const m = resp.request().method();
    if (m === 'GET' || !u.includes('custPermision') && !u.includes('CustTeam') && !u.includes('cstTeam')) {
      if (m === 'GET' || !u.includes('/tansun')) return;
    }
    let body = '';
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 500); } catch (_) {}
    let req = '';
    try { req = (resp.request().postData() || '').slice(0, 300); } catch (_) {}
    result.apis.push({ m, u: u.replace('http://test.creditv5p2.tansun.com.cn', ''), req, resp: body });
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

  // —— 1) 未选行点【删除】看行为 ——
  const teamPane = page.locator('.el-collapse-item').filter({ has: page.locator('text=维护客户管理团队') }).first();
  const delBtn = teamPane.getByRole('button').filter({ hasText: /删\s*除/ }).first();
  log('P78_DEL_BTN_VISIBLE=' + (await delBtn.isVisible().catch(() => false)));
  await delBtn.click().catch((e) => log('P78_DEL_CLICK_ERR=' + e.message.split('\n')[0]));
  await sleep(2000);
  const noSelState = await page.evaluate(() => {
    const mb = document.querySelector('.el-message-box');
    const toast = [...document.querySelectorAll('.el-message, .el-notification')].map((t) => t.innerText.trim()).join('|');
    return { mb: mb && mb.offsetParent !== null ? mb.innerText.replace(/\s+/g, ' ') : null, toast: toast || null };
  });
  log('P78_NOSEL=' + JSON.stringify(noSelState));

  // —— 2) 点【新增】dump 弹窗 ——
  const addBtn = teamPane.getByRole('button').filter({ hasText: /新\s*增/ }).first();
  await addBtn.click();
  await sleep(3000);
  const dlgInfo = await page.evaluate(() => {
    const dlgs = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter((d) => d.offsetParent !== null);
    if (!dlgs.length) return { err: 'NO_DIALOG' };
    const dlg = dlgs[0];
    const title = dlg.querySelector('.el-dialog__title, .el-drawer__title');
    const btns = [...dlg.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean);
    const items = [...dlg.querySelectorAll('.el-form-item')].map((i) => {
      const lb = i.querySelector('label');
      const ta = i.querySelector('textarea');
      const sel = i.querySelector('.tssc-multi-select, .el-select, .el-cascader');
      const dt = i.querySelector('.el-date-editor');
      const ck = i.querySelectorAll('.el-checkbox').length;
      const rd = i.querySelectorAll('.el-radio').length;
      const inp = ta ? null : (sel ? null : i.querySelector('input'));
      let type, val = '';
      if (ta) { type = 'textarea'; val = ta.value; }
      else if (sel) {
        const dis = sel.querySelector('input[disabled]') || sel.querySelector('.is-disabled');
        const mag = i.querySelector('button, .el-input__suffix');
        type = (dis ? 'dis-select' : 'select');
        val = ((sel.querySelector('.el-input__inner') || {}).value || '').trim().slice(0, 60);
        if (mag && (mag.innerText || '').includes('引入')) type += '+引入';
      }
      else if (dt) { type = 'date' + (dt.className.includes('daterange') ? '-range' : ''); val = (dt.querySelector('input') || {}).value || ''; }
      else if (ck) type = 'x' + ck + '-checkbox';
      else if (rd) type = 'x' + rd + '-radio';
      else if (inp) { type = inp.disabled ? 'dis-input' : (inp.readOnly ? 'ro-input' : 'input'); val = inp.value; }
      else type = 'other';
      return { lb: lb ? lb.innerText.trim() : '', type, val };
    });
    return { kind: dlg.className.includes('drawer') ? 'drawer' : 'dialog', title: title ? title.innerText.trim() : '', btns, items };
  });
  result.dlg = dlgInfo;
  log('P78_DLG=' + JSON.stringify(dlgInfo));
  await page.screenshot({ path: path.join(__dirname, 'p78_add_dlg.png') });

  // —— 3) 展开弹窗内 select 看选项 ——
  const selEls = page.locator('.el-dialog:visible .el-select, .el-dialog:visible .tssc-multi-select, .el-drawer:visible .el-select, .el-drawer:visible .tssc-multi-select');
  const selCount = await selEls.count();
  result.selOptions = [];
  for (let i = 0; i < selCount; i++) {
    const s = selEls.nth(i);
    if (await s.locator('input[disabled]').count() > 0) { result.selOptions.push({ i, dis: true }); continue; }
    await s.click().catch(() => {});
    await sleep(1500);
    const opts = await page.evaluate(() => {
      const dds = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent !== null && !d.classList.contains('el-popper.is-hidden'));
      return dds.flatMap((d) => [...d.querySelectorAll('.el-select-dropdown__item')].map((it) => it.innerText.trim()));
    });
    result.selOptions.push({ i, opts: opts.slice(0, 20) });
    await page.keyboard.press('Escape');
    await sleep(800);
  }
  log('P78_SELOPTS=' + JSON.stringify(result.selOptions));

  // —— 4) 关闭弹窗（取消）——
  const cancel = page.locator('.el-dialog:visible, .el-drawer:visible').first().getByRole('button').filter({ hasText: /取\s*消|关\s*闭/ }).first();
  if (await cancel.isVisible().catch(() => false)) { await cancel.click(); await sleep(1500); log('P78_CLOSED_BY_CANCEL'); }
  else { await page.keyboard.press('Escape'); await sleep(1500); log('P78_CLOSED_BY_ESC'); }

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  fs.writeFileSync(path.join(__dirname, 'probe78.out.json'), JSON.stringify(result, null, 1));
  log('P78_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P78_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
