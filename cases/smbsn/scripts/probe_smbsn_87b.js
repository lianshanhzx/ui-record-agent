// probe87b - 列表页未录入口探路（修正版）：高级查询展开 / 查看(场景页只读?) / 联网核查信息 / 法院信息
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const CST_NO = '260924144929974126';
const LIST_URL = 'http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
(async () => {
  const log = (...a) => { console.log(new Date().toISOString().slice(11, 19), ...a); };
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.resolve(__dirname, '..', '..', 'auth.json'), viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const result = {};
  const apiLog = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/\.(js|css|png|jpg|svg|woff2?)(\?|$)/.test(u) || u.includes('socket')) return;
    let body = '';
    try { if (r.request().method() === 'POST') body = (r.request().postData() || '').slice(0, 400); } catch (e) {}
    apiLog.push({ url: (u.split('/prod-api/') || [u]).pop().slice(0, 120), status: r.status(), body });
  });

  const onList = () => page.evaluate(() => location.hash.includes('smbsnCstMgtPg'));
  const selectRow = async () => {
    const tr = page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first();
    await tr.locator('label.el-radio').first().evaluate((el) => el.click());
    await sleep(800);
  };
  const gotoList = async () => {
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
    await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
    await sleep(1500);
    await page.locator('.el-form input').first().fill(CST_NO);
    const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => null);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.offsetParent !== null && b.innerText.trim().replace(/\s/g, '') === '查询').click(); });
    await qP; await sleep(1500);
  };

  await gotoList();
  log('P87B onList');

  // ---- A) 高级查询展开 ----
  apiLog.length = 0;
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.querySelector('.el-icon-caret-bottom, .el-icon-caret-top'));
    if (b) b.click();
  });
  await sleep(1500);
  result.advanced = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.el-form-item__label')].map((l) => l.innerText.trim()).filter(Boolean),
    caret: [...document.querySelectorAll('button')].filter((x) => x.offsetParent !== null && x.querySelector('.el-icon-caret-bottom, .el-icon-caret-top')).map((b) => b.querySelector('i').className),
  }));
  log('P87B_ADV=' + JSON.stringify(result.advanced));
  // 高级查询发请求测试：填客户状态/管户客户经理后查询
  const advQ = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-form-item')];
    const st = items.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '客户状态');
    if (!st) return 'no 客户状态 item';
    const sel = st.querySelector('.el-select, .el-input');
    if (sel) { sel.click(); return 'opened 客户状态 select'; }
    return 'no select';
  });
  log('P87B_ADVSEL ' + advQ);
  await sleep(800);
  const stOpts = await page.evaluate(() => {
    const ws = [...document.querySelectorAll('.el-select-dropdown')].filter((w) => w.offsetParent !== null || getComputedStyle(w).display !== 'none');
    return ws.map((w) => [...w.querySelectorAll('.el-select-dropdown__item')].map((i) => i.innerText.trim()));
  });
  log('P87B_ADVSEL_OPTS=' + JSON.stringify(stOpts));
  // 收起高级查询
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.querySelector('.el-icon-caret-bottom, .el-icon-caret-top'));
    if (b) b.click();
  });
  await sleep(1000);

  // ---- B) 查看（场景页只读?）----
  await selectRow();
  apiLog.length = 0;
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '查看').click(); });
  await page.waitForTimeout(6000);
  result.viewUrl = page.url();
  log('P87B_VIEW_URL=' + result.viewUrl.slice(0, 300));
  log('P87B_VIEW_APIS=' + JSON.stringify(apiLog.map((a) => a.url + ' ' + a.status)));
  result.viewPage = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.el-tabs__item')].map((t) => t.innerText.trim());
    const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null && !b.closest('.el-dialog') && !b.closest('.el-drawer')).map((b) => ({ t: b.innerText.trim().replace(/\s+/g, ''), dis: b.disabled }));
    const formItems = [...document.querySelectorAll('.el-form-item')].slice(0, 12).map((fi) => {
      const l = (fi.querySelector('label') || {}).innerText || '';
      const inp = fi.querySelector('input');
      return { l: l.trim().slice(0, 20), dis: inp ? (inp.readOnly || inp.classList.contains('is-disabled')) : null, val: inp ? (inp.value || '').slice(0, 30) : '' };
    });
    const sections = [...document.querySelectorAll('.el-collapse-item__title, .el-collapse-item__header')].map((s) => s.innerText.trim().replace(/\s+/g, ' ').slice(0, 40));
    return { tabs, btns: btns.filter((b) => b.t).slice(0, 25), formItems, sections, url: location.hash.slice(0, 200) };
  });
  log('P87B_VIEW_PAGE=' + JSON.stringify(result.viewPage, null, 1));
  await page.screenshot({ path: path.join(__dirname, 'p87b-view.png'), fullPage: false });
  // 返回
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '返回').click(); });
  await page.waitForTimeout(2500);
  log('P87B_BACK onList=' + (await onList()));

  // ---- C) 联网核查信息 ----
  if (await onList()) {
    await gotoList();
    await selectRow();
  }
  apiLog.length = 0;
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '联网核查信息').click(); });
  await sleep(5000);
  result.netUrl = page.url();
  log('P87B_NET_URL=' + result.netUrl.slice(0, 200) + ' onList=' + (await onList()));
  log('P87B_NET_APIS=' + JSON.stringify(apiLog.map((a) => a.url + ' ' + a.status)));
  result.netDump = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter((d) => { const s = getComputedStyle(d.closest('.el-dialog__wrapper, .el-drawer__wrapper') || d); return s.display !== 'none' && d.offsetWidth > 0; });
    const info = dialogs.map((d) => ({
      cls: d.className.slice(0, 60),
      title: ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim(),
      items: [...d.querySelectorAll('.el-form-item')].map((fi) => {
        const l = (fi.querySelector('label') || {}).innerText || '';
        const inp = fi.querySelector('input, textarea');
        return { l: l.trim().slice(0, 24), v: inp ? (inp.value || '').slice(0, 50) : fi.innerText.trim().replace(/\s+/g, ' ').slice(0, 60) };
      }),
      btns: [...d.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, '')).filter(Boolean),
      tables: [...d.querySelectorAll('.el-table__header-wrapper')].map((h) => [...h.querySelectorAll('th')].map((th) => th.innerText.trim()).filter(Boolean)),
      rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).join(' | ')),
      total: ((d.querySelector('.el-pagination__total') || {}).innerText || '').trim(),
      text: d.innerText.slice(0, 500),
    }));
    return { dialogs: info };
  });
  log('P87B_NET=' + JSON.stringify(result.netDump, null, 1).slice(0, 3500));
  await page.screenshot({ path: path.join(__dirname, 'p87b-net.png') });

  // ---- D) 法院信息 ----
  if (await onList()) {
    await selectRow();
  } else {
    await gotoList();
    await selectRow();
  }
  apiLog.length = 0;
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '法院信息').click(); });
  await sleep(5000);
  result.courtUrl = page.url();
  log('P87B_COURT_URL=' + result.courtUrl.slice(0, 200) + ' onList=' + (await onList()));
  log('P87B_COURT_APIS=' + JSON.stringify(apiLog.map((a) => a.url + ' ' + a.status)));
  result.courtDump = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter((d) => { const s = getComputedStyle(d.closest('.el-dialog__wrapper, .el-drawer__wrapper') || d); return s.display !== 'none' && d.offsetWidth > 0; });
    const info = dialogs.map((d) => ({
      cls: d.className.slice(0, 60),
      title: ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim(),
      items: [...d.querySelectorAll('.el-form-item')].slice(0, 25).map((fi) => {
        const l = (fi.querySelector('label') || {}).innerText || '';
        const inp = fi.querySelector('input, textarea');
        return { l: l.trim().slice(0, 24), v: inp ? (inp.value || '').slice(0, 50) : fi.innerText.trim().replace(/\s+/g, ' ').slice(0, 60) };
      }),
      btns: [...d.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, '')).filter(Boolean),
      tables: [...d.querySelectorAll('.el-table__header-wrapper')].map((h) => [...h.querySelectorAll('th')].map((th) => th.innerText.trim()).filter(Boolean)),
      rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).join(' | ')),
      total: ((d.querySelector('.el-pagination__total') || {}).innerText || '').trim(),
      text: d.innerText.slice(0, 500),
    }));
    return { dialogs: info };
  });
  log('P87B_COURT=' + JSON.stringify(result.courtDump, null, 1).slice(0, 3500));
  await page.screenshot({ path: path.join(__dirname, 'p87b-court.png') });

  fs.writeFileSync(path.join(__dirname, 'probe87b.out.json'), JSON.stringify(result, null, 2), 'utf8');
  log('P87B_SAVED');
  await browser.close();
})().catch((e) => { console.error('P87B_ERR', e.message); process.exit(1); });
