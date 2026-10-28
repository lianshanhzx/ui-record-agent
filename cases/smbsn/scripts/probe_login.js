const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const AUTH = path.join(ROOT, 'auth.json');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST = BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
(async () => {
  const browser = await chromium.launch({ headless: true });
  // --- 1) 当前 auth.json 能否直接进列表页 ---
  const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(LIST, { waitUntil: 'domcontentloaded', timeout: 60000 });
  let redirected = false;
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    const u = String(page.url());
    if (u.includes('/login')) { redirected = true; break; }
    if (u.includes('smbsnCstMgtPg') && await page.locator('.el-table__body-wrapper').count()) break;
  }
  console.log('AUTH_VALID=' + (!redirected) + ' url=' + page.url().slice(0, 80));
  await ctx.close();

  // --- 2) 登录页：按钮文字/DOM文本 + 是否 disabled（不实际提交） ---
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p2.waitForTimeout(3000);
  const info = await p2.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => ({ text: b.innerText.replace(/\s+/g, ' ').trim(), disabled: b.disabled, cls: b.className }));
    const sms = !!document.querySelector("input[placeholder*='手机验证码'], input[placeholder*='短信']");
    const captchaImg = !!document.querySelector('canvas, img[alt*="验证"], .captcha, [class*="captcha"]');
    return { btns, sms, captchaImg };
  });
  console.log('LOGIN_BTN=' + JSON.stringify(info.btns));
  console.log('HAS_SMS_FIELD=' + info.sms + ' CAPTCHA_IMG=' + info.captchaImg);
  await browser.close();
})().catch((e) => { console.error('ERR ' + (e.message || e).toString().slice(0, 300)); process.exit(1); });
