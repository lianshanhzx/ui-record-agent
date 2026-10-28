// probe43: S4 修改保存报「注册资本不能为空」定位
// 1) 场景页读 注册资本 字段值 2) 股东修改弹窗 预填值直接确定 3) 捕获 save API 请求/响应 + 异常弹窗文本
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const CUST_NO = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 抓 save 相关 API
  const apiLog = [];
  page.on('response', async (resp) => {
    const u = resp.url();
    if (/custCorporatRelatedParty|shareholder|shrh|save|update/i.test(u) && resp.request().method() === 'POST') {
      let body = '';
      try { body = JSON.stringify(await resp.json()).slice(0, 400); } catch {}
      apiLog.push({ url: u.split('/').slice(-2).join('/'), status: resp.status(), resp: body });
    }
  });
  page.on('request', (req) => {
    const u = req.url();
    if (/custCorporatRelatedParty|shareholder|shrh/i.test(u) && req.method() === 'POST') {
      const pd = req.postData();
      apiLog.push({ REQ: u.split('/').slice(-2).join('/'), postData: (pd || '').slice(0, 600) });
    }
  });

  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(CUST_NO);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await page.waitForTimeout(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(4000);

  // 1) 基本信息 tab 读 注册资本
  const regCap = await page.evaluate(() => {
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && (l.innerText || '').trim().replace(/[*\s]/g, '') === '注册资本金额' && x.offsetParent !== null;
    });
    if (!it) return 'NO_FIELD';
    const inp = it.querySelector('input');
    return '注册资本金额=' + (inp ? inp.value : 'no-input');
  });
  console.log('REG_CAPITAL=', regCap);

  // 2) 股东信息 tab → 选行 → 修改弹窗 → 直接确定(预填值)
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await page.waitForTimeout(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await sleep(2500);
  apiLog.length = 0; // 清空，只看确定后的
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(4000);

  // 3) 异常弹窗文本
  const excText = await page.evaluate(() => {
    const box = Array.from(document.querySelectorAll('.el-message-box, .el-dialog, [class*="exception"], [class*="error"]'))
      .filter((d) => d.offsetParent !== null)
      .map((d) => (d.innerText || '').trim())
      .filter((t) => t && t.length < 400);
    return box.slice(0, 3);
  });
  console.log('EXC_TEXT=', JSON.stringify(excText));
  console.log('API_LOG=', JSON.stringify(apiLog, null, 1));
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
