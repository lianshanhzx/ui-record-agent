// probe_smbsn_5.js - 诊断：抽屉保存静默失败原因(变体A 重选证件类型 / 变体B 不碰默认)
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const BASE = 'http://test.creditv5p2.tansun.com.cn';
const ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const CH = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const randUscc = () => {
  let s = '';
  for (let i = 0; i < 18; i++) s += CH[Math.floor(Math.random() * CH.length)];
  return (s[0] === '0' ? '1' : s[0]) + s.slice(1);
};

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const apis = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/prod-api/') || r.request().method() !== 'POST') return;
    try {
      apis.push({ url: u.replace(BASE, ''), t: Date.now() });
    } catch {}
  });

  await page.goto(BASE + ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);

  const toasts = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.el-message, .el-notification__content'))
        .filter((e) => e.offsetParent !== null)
        .map((e) => (e.innerText || '').trim()).filter(Boolean)
    );

  for (const variant of ['A_reselect', 'B_default']) {
    const ts = Date.now();
    const uscc = randUscc();
    const name = 'AT_DBG_' + ts + (variant === 'A_reselect' ? 'A' : 'B');
    apis.length = 0;
    await page.locator('button', { hasText: /新\s*增/ }).first().click();
    await page.waitForSelector('.el-drawer:visible', { timeout: 15000 });
    await page.waitForTimeout(1500);
    if (variant === 'A_reselect') {
      const dIt = page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '证件类型' }) }).first();
      await dIt.locator('.el-select, input').first().click({ timeout: 8000 });
      await page.waitForTimeout(1200);
      await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({ hasText: /^营业执照$/ }).last().click({ timeout: 8000 });
      await page.waitForTimeout(800);
    }
    await page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '证件号码' }) }).first().locator('input').fill(uscc);
    await page.locator('.el-drawer:visible .el-form-item').filter({ has: page.locator('label', { hasText: '客户名称' }) }).first().locator('input').fill(name);
    await page.waitForTimeout(1000);
    const savedApis = apis.length;
    await page.locator('.el-drawer:visible button', { hasText: /保\s*存/ }).first().click();
    console.log(`[${variant}] SAVE_CLICKED name=${name} uscc=${uscc}`);
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      const t = await toasts();
      if (t.length) console.log(`[${variant}] t=${i + 1}s TOASTS=`, JSON.stringify(t));
    }
    console.log(`[${variant}] APIS_AFTER_SAVE=`, JSON.stringify(apis.slice(savedApis).map((a) => a.url)));
    console.log(`[${variant}] URL=`, page.url());
    const drawerOpen = await page.evaluate(() => Array.from(document.querySelectorAll('.el-drawer')).some((d) => d.offsetParent !== null));
    console.log(`[${variant}] DRAWER_OPEN=`, drawerOpen);
    if (drawerOpen) {
      await page.locator('.el-drawer:visible button', { hasText: /取\s*消/ }).first().click().catch(() => page.keyboard.press('Escape'));
      await page.waitForTimeout(1500);
    } else if (page.url().includes('mdfSmbsnCst')) {
      await page.locator('button', { hasText: /返\s*回/ }).first().click().catch(() => {});
      await page.waitForTimeout(4000);
    }
    await page.waitForSelector('button:has-text("新增")', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
