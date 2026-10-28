// probe88 - 联网核查信息子操作：查看详情结构 / 发起实时核查(API+成功提示+行变化) / 法院信息查询表单选项 / 高级查询-管户客户经理选项
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
  page.setDefaultTimeout(90_000);
  const result = {};
  const apiLog = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/\.(js|css|png|jpg|svg|woff2?)(\?|$)/.test(u) || u.includes('socket')) return;
    let body = '';
    try { if (r.request().method() === 'POST') body = (r.request().postData() || '').slice(0, 300); } catch (e) {}
    apiLog.push({ t: Date.now(), url: (u.split('/prod-api/') || [u]).pop().slice(0, 110), status: r.status(), body });
  });
  const visibleDialogs = () => page.evaluate(() => {
    const out = [];
    for (const d of document.querySelectorAll('.el-dialog, .el-drawer')) {
      const w = d.closest('.el-dialog__wrapper, .el-drawer__wrapper') || d;
      if (getComputedStyle(w).display === 'none' || d.offsetWidth === 0) continue;
      out.push({
        cls: d.className.slice(0, 60),
        title: ((d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '').trim(),
        items: [...d.querySelectorAll('.el-form-item')].map((fi) => {
          const l = (fi.querySelector('label') || {}).innerText || '';
          const inp = fi.querySelector('input, textarea');
          return { l: l.trim().slice(0, 24), v: inp ? (inp.value || '').slice(0, 60) : fi.innerText.trim().replace(/\s+/g, ' ').slice(0, 60) };
        }),
        btns: [...d.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, '')).filter(Boolean),
        tables: [...d.querySelectorAll('.el-table__header-wrapper')].map((h) => [...h.querySelectorAll('th')].map((th) => th.innerText.trim()).filter(Boolean)),
        rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 4).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).join(' | ')),
        text: d.innerText.slice(0, 400),
      });
    }
    return out;
  });

  await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);
  await page.locator('.el-form input').first().fill(CST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => null);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.offsetParent !== null && b.innerText.trim().replace(/\s/g, '') === '查询').click(); });
  await qP; await sleep(1500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first().locator('label.el-radio').first().evaluate((el) => el.click());
  await sleep(800);

  // ---- A) 联网核查信息：查看详情 ----
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '联网核查信息').click(); });
  await sleep(3000);
  // 表格行内可能有「查看详情」链接/按钮；也可能需先选行
  const detailBtnInfo = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    if (!d) return 'no netcheck dialog';
    const tds = [...d.querySelectorAll('td')];
    const cands = [...d.querySelectorAll('button, a, span')]
      .filter((x) => x.offsetParent !== null && (x.innerText || '').trim() === '查看详情')
      .map((x) => ({ tag: x.tagName, cls: x.className.slice(0, 60), inTd: !!x.closest('td') }));
    return { candCount: cands.length, cands: cands.slice(0, 6), firstTdHtml: tds.find((t) => t.innerText.includes('查看详情')) ? tds.find((t) => t.innerText.includes('查看详情')).innerHTML.slice(0, 300) : (tds[0] ? tds[0].innerHTML.slice(0, 200) : '') };
  });
  log('P88_DETAIL_BTN=' + JSON.stringify(detailBtnInfo, null, 1));

  // 点第一个可见的「查看详情」（行内）
  const detailClicked = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    if (!d) return 'no dialog';
    const btns = [...d.querySelectorAll('button, a, span')].filter((x) => x.offsetParent !== null && (x.innerText || '').trim() === '查看详情');
    if (!btns.length) return 'no detail btn';
    btns[0].click();
    return 'clicked ' + btns[0].tagName;
  });
  log('P88_DETAIL_CLICKED=' + detailClicked);
  await sleep(2500);
  result.afterDetail = await visibleDialogs();
  log('P88_AFTER_DETAIL=' + JSON.stringify(result.afterDetail, null, 1).slice(0, 3000));
  await page.screenshot({ path: path.join(__dirname, 'p88-detail.png') });

  // 关闭子弹窗（如有）：取消/关闭
  await page.evaluate(() => {
    const ds = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetWidth > 0);
    if (ds.length > 1) {
      const top = ds[ds.length - 1];
      const c = [...top.querySelectorAll('button')].find((b) => ['取消', '关闭', 'Cancel', 'Close'].includes(b.innerText.trim().replace(/\s+/g, '')));
      if (c) { c.click(); return 'sub closed'; }
    }
    return 'no sub';
  });
  await sleep(1500);

  // ---- B) 联网核查信息：发起实时核查 ----
  const rowCountBefore = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    return d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1;
  });
  apiLog.length = 0;
  const t0 = Date.now();
  const netClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '发起实时核查');
    if (b) { b.click(); return true; } return false;
  });
  log('P88_NETCHECK_CLICKED=' + netClicked + ' rowsBefore=' + rowCountBefore);
  if (netClicked) {
    // 等 API（最长 60s）
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      if (apiLog.some((a) => /networkCheck|NetworkCheck/i.test(a.url) && !/page/.test(a.url))) break;
    }
    const el = Date.now() - t0;
    log('P88_NETCHECK_ELAPSED=' + el + 'ms');
    log('P88_NETCHECK_APIS=' + JSON.stringify(apiLog.map((a) => a.url + ' ' + a.status + (a.body ? ' ' + a.body : '')), null, 1));
    // toast / notification / msgbox
    const toast = await page.evaluate(() => ({
      msg: [...document.querySelectorAll('.el-message')].map((m) => m.innerText.trim()),
      notif: [...document.querySelectorAll('.el-notification')].map((n) => n.innerText.trim().replace(/\s+/g, ' ')),
      msgbox: [...document.querySelectorAll('.el-message-box')].filter((m) => m.offsetWidth > 0).map((m) => m.innerText.trim().replace(/\s+/g, ' ').slice(0, 200)),
    }));
    log('P88_TOAST=' + JSON.stringify(toast));
    await sleep(3000);
    const rowCountAfter = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
      return d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1;
    });
    const firstRow = await page.evaluate(() => {
      const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
      if (!d) return null;
      const tr = d.querySelector('.el-table__body-wrapper tbody tr');
      return tr ? [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).join(' | ') : null;
    });
    log('P88_ROWS after=' + rowCountAfter + ' firstRow=' + firstRow);
    result.netcheck = { rowsBefore: rowCountBefore, rowsAfter: rowCountAfter, firstRow, elapsed: el, apis: apiLog.map((a) => a.url + ' ' + a.status), toast };
    await page.screenshot({ path: path.join(__dirname, 'p88-netcheck.png') });
  }
  // 关闭联网核查 dialog
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    if (d) { const c = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '取消'); if (c) c.click(); }
  });
  await sleep(2000);

  // ---- C) 法院信息：查询表单选项 ----
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first().locator('label.el-radio').first().evaluate((el) => el.click());
  await sleep(800);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '法院信息').click(); });
  await sleep(3000);
  const courtOpts = await page.evaluate(async () => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('法院信息类型'));
    if (!d) return 'no court dialog';
    const out = {};
    const items = [...d.querySelectorAll('.el-form-item')];
    const t = items.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '法院信息类型');
    if (t) { t.querySelector('.el-select, .el-input').click(); await new Promise((r) => setTimeout(r, 800)); }
    out.typeOpts = [...document.querySelectorAll('.el-select-dropdown')].filter((w) => w.offsetWidth > 0).map((w) => [...w.querySelectorAll('.el-select-dropdown__item')].map((i) => i.innerText.trim()));
    await new Promise((r) => setTimeout(r, 500));
    const v = items.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '是否有效');
    if (v) { v.querySelector('.el-select, .el-input').click(); await new Promise((r) => setTimeout(r, 800)); }
    out.validOpts = [...document.querySelectorAll('.el-select-dropdown')].filter((w) => w.offsetWidth > 0).map((w) => [...w.querySelectorAll('.el-select-dropdown__item')].map((i) => i.innerText.trim()));
    return out;
  });
  log('P88_COURT_OPTS=' + JSON.stringify(courtOpts));
  result.courtOpts = courtOpts;
  // 查询（空条件=全量）
  apiLog.length = 0;
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('法院信息类型'));
    const b = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '查询');
    if (b) b.click();
  });
  await sleep(2500);
  log('P88_COURT_QUERY_APIS=' + JSON.stringify(apiLog.map((a) => a.url + ' ' + a.status + (a.body ? ' ' + a.body : ''))));
  const courtRows = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('法院信息类型'));
    return d ? [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).join(' | ')) : [];
  });
  log('P88_COURT_ROWS=' + JSON.stringify(courtRows));
  await page.screenshot({ path: path.join(__dirname, 'p88-court.png') });
  // 关闭
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('法院信息类型'));
    if (d) { const c = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '取消'); if (c) c.click(); }
  });
  await sleep(2000);

  // ---- D) 高级查询：管户客户经理选项 ----
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.querySelector('.el-icon-caret-bottom'));
    if (b) b.click();
  });
  await sleep(1500);
  const mgrOpts = await page.evaluate(async () => {
    const items = [...document.querySelectorAll('.el-form-item')];
    const m = items.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '管户客户经理');
    if (!m) return 'no mgr item';
    const inp = m.querySelector('input');
    if (inp) { inp.click(); inp.focus(); }
    await new Promise((r) => setTimeout(r, 1000));
    const dd = [...document.querySelectorAll('.el-select-dropdown, .el-autocomplete-suggestion, [class*=suggestion]')].filter((w) => w.offsetWidth > 0);
    return dd.map((w) => [...w.querySelectorAll('li, .el-select-dropdown__item')].slice(0, 8).map((i) => i.innerText.trim().replace(/\s+/g, ' ')));
  });
  log('P88_MGR_OPTS=' + JSON.stringify(mgrOpts));
  result.mgrOpts = mgrOpts;

  fs.writeFileSync(path.join(__dirname, 'probe88.out.json'), JSON.stringify(result, null, 2), 'utf8');
  log('P88_SAVED');
  await browser.close();
})().catch((e) => { console.error('P88_ERR', e.message); process.exit(1); });
