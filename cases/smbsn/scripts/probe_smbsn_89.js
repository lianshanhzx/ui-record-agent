// probe89 - 联网核查：选行→查看详情(子弹窗+API) / 发起实时核查→OK(API+成功提示+行+1) / 法院信息「是否有效」选项 / 高级查询-客户状态筛选生效性
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
  page.setDefaultTimeout(120_000);
  const result = {};
  const apiLog = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/\.(js|css|png|jpg|svg|woff2?)(\?|$)/.test(u) || u.includes('socket')) return;
    let body = '';
    let resp = '';
    try { if (r.request().method() === 'POST') body = (r.request().postData() || '').slice(0, 300); } catch (e) {}
    try { if (/networkCheck|NetworkCheck/i.test(u) && !/page/.test(u)) resp = JSON.stringify(await r.json()).slice(0, 400); } catch (e) {}
    apiLog.push({ t: Date.now(), url: (u.split('/prod-api/') || [u]).pop().slice(0, 110), status: r.status(), body, resp });
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

  // ---- A) 联网核查：选行 → 查看详情 ----
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '联网核查信息').click(); });
  await sleep(3000);
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    const tr = d.querySelector('.el-table__body-wrapper tbody tr');
    const radio = tr.querySelector('input[type=radio], label.el-radio');
    (radio.closest('label') || radio).click();
  });
  await sleep(1000);
  apiLog.length = 0;
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    const b = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '查看详情');
    b.click();
  });
  await sleep(3000);
  result.detailApis = apiLog.map((a) => a.url + ' ' + a.status + (a.body ? ' ' + a.body : ''));
  log('P89_DETAIL_APIS=' + JSON.stringify(result.detailApis));
  result.detail = await page.evaluate(() => {
    const ds = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetWidth > 0);
    return ds.map((d) => ({
      cls: d.className.slice(0, 50),
      items: [...d.querySelectorAll('.el-form-item')].map((fi) => {
        const l = (fi.querySelector('label') || {}).innerText || '';
        const inp = fi.querySelector('input, textarea');
        return { l: l.trim().slice(0, 24), v: inp ? (inp.value || '').slice(0, 80) : fi.innerText.trim().replace(/\s+/g, ' ').slice(0, 80), dis: inp ? (inp.readOnly || inp.classList.contains('is-disabled')) : null };
      }),
      btns: [...d.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, '')).filter(Boolean),
      tables: [...d.querySelectorAll('.el-table__header-wrapper')].map((h) => [...h.querySelectorAll('th')].map((th) => th.innerText.trim()).filter(Boolean)),
      rows: [...d.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 50)).join(' | ')),
      text: d.innerText.slice(0, 300),
    }));
  });
  log('P89_DETAIL=' + JSON.stringify(result.detail, null, 1).slice(0, 3500));
  await page.screenshot({ path: path.join(__dirname, 'p89-detail.png') });
  // 关闭子弹窗
  await page.evaluate(() => {
    const ds = [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetWidth > 0);
    if (ds.length > 1) {
      const top = ds[ds.length - 1];
      const c = [...top.querySelectorAll('button')].find((b) => ['取消', '关闭', '确定', '确认', 'Cancel', 'Close', 'OK'].includes(b.innerText.trim()));
      if (c) c.click();
    }
  });
  await sleep(1500);

  // ---- B) 发起实时核查 → OK ----
  const rowsBefore = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    return d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1;
  });
  apiLog.length = 0;
  const t0 = Date.now();
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    const b = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '发起实时核查');
    b.click();
  });
  await sleep(1500);
  const msgboxInfo = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetWidth > 0);
    return m ? { text: m.innerText.trim().replace(/\s+/g, ' '), btns: [...m.querySelectorAll('button')].map((b) => b.innerText.trim()) } : null;
  });
  log('P89_MSGBOX=' + JSON.stringify(msgboxInfo));
  const okClicked = await page.evaluate(() => {
    const m = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetWidth > 0);
    if (!m) return false;
    const ok = [...m.querySelectorAll('button')].find((b) => b.classList.contains('el-button--primary'));
    if (ok) { ok.click(); return true; }
    return false;
  });
  log('P89_OK=' + okClicked + ' rowsBefore=' + rowsBefore);
  // 等核查 API 响应（最长 90s）
  let got = false;
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    if (apiLog.some((a) => /networkCheck|NetworkCheck/i.test(a.url) && !/page/.test(a.url))) { got = true; break; }
  }
  const el = Date.now() - t0;
  log('P89_NETCHECK_APIS=' + JSON.stringify(apiLog.map((a) => a.url + ' ' + a.status + (a.body ? ' body=' + a.body : '') + (a.resp ? ' resp=' + a.resp : '')), null, 1));
  await sleep(3000);
  const toast = await page.evaluate(() => ({
    msg: [...document.querySelectorAll('.el-message')].filter((m) => m.offsetWidth > 0).map((m) => m.innerText.trim()),
    notif: [...document.querySelectorAll('.el-notification')].filter((m) => m.offsetWidth > 0).map((n) => n.innerText.trim().replace(/\s+/g, ' ')),
  }));
  log('P89_TOAST=' + JSON.stringify(toast) + ' elapsed=' + el + ' gotApi=' + got);
  // 重新查询看行变化
  apiLog.length = 0;
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    const b = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '查询');
    b.click();
  });
  await sleep(2500);
  const rowsAfter = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    const trs = d ? d.querySelectorAll('.el-table__body-wrapper tbody tr') : [];
    const first = trs[0] ? [...trs[0].querySelectorAll('td')].map((td) => td.innerText.trim().replace(/\s+/g, ' ').slice(0, 50)).join(' | ') : null;
    return { count: trs.length, first };
  });
  log('P89_ROWS after=' + JSON.stringify(rowsAfter));
  result.netcheck = { rowsBefore, rowsAfter, elapsed: el, gotApi: got, toast, apis: apiLog.map((a) => a.url + ' ' + a.status) };
  await page.screenshot({ path: path.join(__dirname, 'p89-netcheck.png') });
  // 关闭 dialog
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('核查结果信息'));
    if (d) { const c = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '取消'); if (c) c.click(); }
  });
  await sleep(2000);

  // ---- C) 法院信息「是否有效」选项（单独打开）----
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first().locator('label.el-radio').first().evaluate((el) => el.click());
  await sleep(800);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === '法院信息').click(); });
  await sleep(3000);
  result.courtVld = await page.evaluate(async () => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('法院信息类型'));
    if (!d) return 'no dialog';
    const out = {};
    const items = [...d.querySelectorAll('.el-form-item')];
    const v = items.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '是否有效');
    if (!v) return 'no vld item';
    out.html = v.innerHTML.slice(0, 400);
    const sel = v.querySelector('.el-select') || v.querySelector('.el-input');
    if (sel) { sel.click(); await new Promise((r) => setTimeout(r, 1000)); }
    const dds = [...document.querySelectorAll('.el-select-dropdown')].filter((w) => w.offsetWidth > 0 && w.closest('body'));
    out.opts = dds.map((w) => [...w.querySelectorAll('.el-select-dropdown__item')].map((i) => i.innerText.trim()));
    return out;
  });
  log('P89_COURT_VLD=' + JSON.stringify(result.courtVld));
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth > 0 && x.innerText.includes('法院信息类型'));
    if (d) { const c = [...d.querySelectorAll('button')].find((b) => b.innerText.trim() === '取消'); if (c) c.click(); }
  });
  await sleep(1500);

  // ---- D) 高级查询：客户状态=信贷正式客户 筛选生效性 ----
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.querySelector('.el-icon-caret-bottom'));
    if (b) b.click();
  });
  await sleep(1500);
  // 清空客户编号，查全部
  await page.locator('.el-form input').first().fill('');
  // 选客户状态
  await page.evaluate(async () => {
    const items = [...document.querySelectorAll('.el-form-item')];
    const s = items.find((i) => (i.querySelector('label') || {}).innerText?.trim() === '客户状态');
    if (!s) return;
    const inp = s.querySelector('input');
    inp.click();
    await new Promise((r) => setTimeout(r, 800));
  });
  const stOptClicked = await page.evaluate(() => {
    const dds = [...document.querySelectorAll('.el-select-dropdown')].filter((w) => w.offsetWidth > 0);
    for (const w of dds) {
      const item = [...w.querySelectorAll('.el-select-dropdown__item')].find((i) => i.innerText.trim() === '信贷正式客户');
      if (item) { item.click(); return true; }
    }
    return false;
  });
  log('P89_ST_OPT=' + stOptClicked);
  await sleep(1000);
  apiLog.length = 0;
  const qResp = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => null);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.offsetParent !== null && b.innerText.trim().replace(/\s/g, '') === '查询').click(); });
  const resp = await qResp;
  let total = null, reqBody = null;
  if (resp) {
    reqBody = resp.request().postData();
    try { total = (await resp.json()).total; } catch (e) {}
  }
  log('P89_ADV_QUERY total=' + total + ' body=' + reqBody);
  result.advQuery = { total, reqBody };

  fs.writeFileSync(path.join(__dirname, 'probe89.out.json'), JSON.stringify(result, null, 2), 'utf8');
  log('P89_SAVED');
  await browser.close();
})().catch((e) => { console.error('P89_ERR', e.message); process.exit(1); });
