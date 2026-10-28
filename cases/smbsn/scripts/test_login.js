const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const AUTH = path.join(ROOT, 'auth.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const u = await page.locator("input[name='username']");
  if (!(await u.count())) { console.log('NO_USERNAME_FIELD url=' + page.url().slice(0,80)); await browser.close(); return; }
  await u.fill('701994');
  await page.locator("input[name='password']").fill('1');
  const cap = page.locator("input[placeholder*='图形']").first();
  if (await cap.count()) await cap.fill('1234');
  const legal = page.locator("input[placeholder*='法人']").first();
  if ((await legal.count()) && !(await legal.inputValue().catch(() => ''))) {
    await legal.click(); await page.waitForTimeout(1000);
    const fo = page.locator('.el-select-dropdown__item').first();
    if (await fo.count()) await fo.click(); await page.waitForTimeout(400);
  }
  // 用白空格容忍正则点登录（不点 发送验证码）
  await page.getByRole('button').filter({ hasText: /登\s*录/ }).first().click({ timeout: 15000 });
  console.log('CLICKED_LOGIN');
  let ok = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    const uu = String(page.url());
    if (!uu.includes('/login')) { ok = true; break; }
  }
  console.log('LOGIN_OK=' + ok + ' final_url=' + page.url().slice(0, 90));
  // 若有错误提示，抓出来
  const err = await page.locator('.el-message, .el-message-box__message, [class*="error"], [class*="tip"]').allInnerTexts().catch(() => []);
  console.log('PAGE_MSG=' + JSON.stringify(err.filter(x=>x.trim()).slice(0,6)));
  if (ok) { await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(()=>{}); await ctx.storageState({ path: AUTH }); console.log('SAVED_AUTH'); }
  await browser.close();
})().catch((e) => { console.error('ERR ' + (e.message||e).toString().slice(0,300)); process.exit(1); });
