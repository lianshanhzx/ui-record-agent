// probe85 - 查看登记信息段的「日期」字段 DOM 上下文 + 改值是否触发 API（基线客户）
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
    if (resp.request().method() !== 'POST' || !u.includes('test.creditv5p2')) return;
    if (u.includes('findCustTradeList') || u.includes('getCustTrade') || u.includes('ipcFcnScnInf') || u.includes('findCustTeam') || u.includes('getRegistInfo') || u.includes('ICstTradeMdfHist')) return;
    let body = '';
    try { body = resp.status() + ' ' + (await resp.text()).slice(0, 300); } catch (_) {}
    result.apis.push({ u: u.replace('http://test.creditv5p2.tansun.com.cn', ''), req: (resp.request().postData() || '').slice(0, 200), resp: body });
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

  // 找「日期」字段并 dump 上下文
  result.dateField = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-collapse-item')].filter((c) => c.innerText.includes('查看登记信息'));
    if (!items.length) return { err: 'NO_SECTION' };
    const sec = items[0];
    const allItems = [...sec.querySelectorAll('.el-form-item')];
    const info = allItems.map((i) => {
      const lb = i.querySelector('label');
      const inp = i.querySelector('input');
      const dt = i.querySelector('.el-date-editor');
      return {
        lb: lb ? lb.innerText.trim() : '',
        dtCls: dt ? dt.className : null,
        dis: dt && dt.classList.contains('is-disabled') ? true : (inp ? inp.disabled : null),
        val: inp ? inp.value : ''
      };
    });
    const dateItem = allItems.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '日期');
    let ctx = null;
    if (dateItem) {
      const inp = dateItem.querySelector('input');
      ctx = {
        parentTag: dateItem.parentElement.tagName + '.' + (dateItem.parentElement.className || '').slice(0, 60),
        grandTag: dateItem.parentElement.parentElement ? dateItem.parentElement.parentElement.className.slice(0, 80) : null,
        ph: inp ? inp.placeholder : null,
        disabled: inp ? inp.disabled : null,
        readOnly: inp ? inp.readOnly : null,
        sectionOrder: info.map((x) => x.lb)
      };
    }
    return { items: info, ctx };
  });
  log('P85_DATE=' + JSON.stringify(result.dateField));

  // 改日期值看 API
  if (result.dateField.ctx && !result.dateField.ctx.disabled) {
    result.apis.forEach((a) => (a._seen = 1));
    const dateInp = page.locator('.el-collapse-item').filter({ hasText: '查看登记信息' }).locator('.el-form-item').filter({ has: page.locator('label', { hasText: /^日\s*期$/ }) }).locator('input').first();
    await dateInp.click().catch((e) => log('P85_CLK_ERR=' + e.message.split('\n')[0]));
    await sleep(800);
    const pickerOpen = await page.locator('.el-picker-panel:visible').count();
    result.pickerOpen = pickerOpen;
    if (pickerOpen > 0) {
      const days = page.locator('.el-date-table:visible td.available:not(.disabled)');
      const n = await days.count();
      result.pickerDays = n;
      if (n > 0) {
        await days.nth(Math.min(5, n - 1)).click().catch((e) => log('P85_PICK_ERR=' + e.message.split('\n')[0]));
        await sleep(2500);
      }
    }
    result.apis_日期变更 = result.apis.filter((a) => !a._seen);
    log('P85_DATE_APIS=' + JSON.stringify(result.apis_日期变更.map((a) => a.u + ' ' + a.resp.slice(0, 120))));
  } else {
    log('P85_DATE_DISABLED_OR_MISSING');
  }

  await page.getByRole('button').filter({ hasText: /返\s*回/ }).first().click();
  await sleep(1500);
  fs.writeFileSync(path.join(__dirname, 'probe85.out.json'), JSON.stringify(result, null, 1));
  log('P85_DONE');
  await browser.close();
})().catch(async (e) => {
  console.error('P85_FATAL', e.message.split('\n')[0]);
  try { await browser.close(); } catch (_) {}
  process.exit(1);
});
