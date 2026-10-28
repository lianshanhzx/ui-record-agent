// probe87 - 列表页未录入口逐个探路：查询区空按钮(全文检索?) / 查看 / 联网核查信息 / 法院信息（结构+API）
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const CST_NO = '260924144929974126';
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
    if (u.includes('.js') || u.includes('.css') || u.includes('.png') || u.includes('socket')) return;
    let body = '';
    try { if (r.request().method() === 'POST') body = (r.request().postData() || '').slice(0, 300); } catch (e) {}
    apiLog.push({ url: u.split('/api/').pop() || u.slice(-80), status: r.status(), body });
  });
  const snapApis = (tag) => { result[tag] = apiLog.splice(0); log(tag + ' APIs=' + JSON.stringify(result[tag].map((a) => a.url + ' ' + a.status))); };

  await page.goto('http://test.creditv5P2.tansun.com.cn'.replace('P2', 'p2') + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  if (page.url().includes('login')) { log('AUTH_EXPIRED'); await browser.close(); process.exit(2); }
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 120_000 });
  await sleep(1500);

  // 查询基线客户并选行
  await page.locator('.el-form input').first().fill(CST_NO);
  apiLog.length = 0;
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30_000 }).catch(() => null);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await qP; await sleep(1500);
  const tr = page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first();
  log('P87_ROW found, count=' + await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count());
  await tr.locator('label.el-radio').first().evaluate((el) => el.click());
  await sleep(1000);

  // ---- A) 查询区空按钮（查询/重置旁的图标按钮）----
  const iconBtn = page.locator('button.el-button:visible', { hasNot: page.locator(':scope:empty') }).nth(2);
  const iconInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().y > 150 && b.getBoundingClientRect().y < 210);
    return btns.map((b) => ({ text: b.innerText.trim(), html: b.innerHTML.slice(0, 200), cls: b.className }));
  });
  result.queryAreaBtns = iconInfo;
  log('P87_QUERYBTN=' + JSON.stringify(iconInfo, null, 1));

  // 点击第三个可见查询区按钮（空文本的那个）
  const emptyQueryBtn = page.locator('button:visible').filter({ hasText: '' }).nth(1);
  try {
    const eb = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      const q = btns.find((b) => b.innerText.trim() === '' && b.getBoundingClientRect().y > 150 && b.getBoundingClientRect().y < 210);
      if (q) { q.click(); return true; } return false;
    });
    log('P87_EMPTYBTN_CLICKED=' + eb);
    if (eb) {
      await sleep(2000);
      const formAfter = await page.evaluate(() => ({
        labels: [...document.querySelectorAll('.el-form-item__label, label')].map((l) => l.innerText.trim()).filter(Boolean),
        inputs: [...document.querySelectorAll('.el-form input, .el-form textarea')].map((i) => i.getAttribute('placeholder') || i.type).slice(0, 40),
      }));
      result.fulltextForm = formAfter;
      log('P87_FULLTEXT_FORM=' + JSON.stringify(formAfter, null, 1).slice(0, 1500));
      await page.screenshot({ path: path.join(__dirname, 'p87-fulltext.png') });
      // 切回
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
        const q = btns.find((b) => b.innerText.trim() === '' && b.getBoundingClientRect().y > 150 && b.getBoundingClientRect().y < 210);
        if (q) q.click();
      });
      await sleep(1500);
    }
  } catch (e) { log('P87_EMPTYBTN_ERR ' + e.message); }

  // 重新选行（切检索模式可能重置）
  const tr2 = page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first();
  const trCount = await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count();
  log('P87_RESELECT count=' + trCount);
  if (trCount) { await tr2.locator('label.el-radio').first().evaluate((el) => el.click()); await sleep(1000); }

  // ---- 通用：点工具栏按钮 → 捕获弹窗/新页 + API + 截图 → 关闭 ----
  const openAndDump = async (btnText, tag) => {
    apiLog.length = 0;
    const clicked = await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && x.innerText.trim() === t);
      if (b) { b.click(); return true; } return false;
    }, btnText);
    if (!clicked) { log(tag + '_BTN_NOT_FOUND'); return; }
    await sleep(3500);
    const dump = await page.evaluate(() => {
      const dialogs = [...document.querySelectorAll('.el-dialog, .el-drawer, .el-message-box')].filter((d) => d.offsetParent !== null || getComputedStyle(d).display !== 'none');
      const info = dialogs.map((d) => ({
        tag: d.className.includes('drawer') ? 'drawer' : d.className.includes('message-box') ? 'msgbox' : 'dialog',
        cls: d.className.slice(0, 80),
        title: (d.querySelector('.el-dialog__title, .el-drawer__title') || {}).innerText || '',
        items: [...d.querySelectorAll('.el-form-item')].map((fi) => {
          const l = (fi.querySelector('label') || {}).innerText || '';
          const inp = fi.querySelector('input, textarea');
          const sel = fi.querySelector('.el-select');
          return { label: l.trim(), val: inp ? (inp.value || inp.innerText).slice(0, 80) : (sel ? (sel.innerText.trim().slice(0, 60)) : (fi.innerText.trim().replace(/\s+/g, ' ').slice(0, 80))) };
        }),
        btns: [...d.querySelectorAll('button')].map((b) => b.innerText.trim().replace(/\s+/g, '')).filter(Boolean),
        tables: [...d.querySelectorAll('.el-table__header-wrapper')].map((h) => [...h.querySelectorAll('th')].map((th) => th.innerText.trim()).filter(Boolean)),
        total: (d.querySelector('.el-pagination__total') || {}).innerText || null,
        text: d.innerText.slice(0, 600),
      }));
      return { url: location.hash, dialogs: info, newPage: !location.hash.includes('smbsnCstMgtPg') };
    });
    result[tag] = dump;
    snapApis(tag + '_API');
    await page.screenshot({ path: path.join(__dirname, 'p87-' + tag + '.png') });
    log(tag + ' url=' + dump.url.slice(0, 100) + ' dialogs=' + dump.dialogs.length);
    if (dump.dialogs.length) log(tag + '_DUMP=' + JSON.stringify(dump.dialogs, null, 1).slice(0, 3000));
    else log(tag + '_TEXT=' + JSON.stringify(dump.text || '').slice(0, 800));
    // 关闭：取消/关闭/×
    await page.evaluate(() => {
      const ds = [...document.querySelectorAll('.el-dialog, .el-drawer, .el-message-box')].filter((d) => d.offsetParent !== null || getComputedStyle(d).display !== 'none');
      for (const d of ds) {
        const c = [...d.querySelectorAll('button')].find((b) => ['取消', '关 闭', '关闭', 'Cancel', 'Close'].includes(b.innerText.trim().replace(/\s+/g, b.innerText.trim() === '关 闭' ? '关闭' : b.innerText.trim())));
        if (c) { c.click(); return 'cancel'; }
      }
      const x = document.querySelector('.el-dialog__wrapper:visible .el-dialog__headerbtn, .el-dialog__headerbtn');
      if (x && x.offsetParent !== null) { x.click(); return 'x'; }
      return null;
    });
    await sleep(1500);
  };

  await openAndDump('查看', 'view');
  // 关闭后可能回到列表，重新选行
  const tr3 = page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first();
  if (await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count()) { await tr3.locator('label.el-radio').first().evaluate((el) => el.click()); await sleep(800); }

  await openAndDump('联网核查信息', 'netcheck');
  const tr4 = page.locator('.el-table__body-wrapper .el-table__body tbody tr', { hasText: CST_NO }).first();
  if (await page.locator('.el-table__body-wrapper .el-table__body tbody tr').count()) { await tr4.locator('label.el-radio').first().evaluate((el) => el.click()); await sleep(800); }

  await openAndDump('法院信息', 'court');

  fs.writeFileSync(path.join(__dirname, 'probe87.out.json'), JSON.stringify(result, null, 2), 'utf8');
  log('P87_SAVED');
  await browser.close();
})().catch((e) => { console.error('P87_ERR', e); process.exit(1); });
