// 策略（Strategy）：平台登录流程，完全由 profile.login 配置驱动
// （本环境图形验证码不校验，captchaValue 可任意）
import { log } from '../util/log.js';

export class PlatformLogin {
  static async login(page, profile, stateSavePath) {
    const L = profile.login;
    log('  登录态缺失/过期，执行自动登录…');
    await page.goto(profile.baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    if (String(page.url()).includes(L.loggedInUrlShouldNotContain)) {
      await page.locator(L.usernameSelector).fill(L.username);
      await page.locator(L.passwordSelector).fill(L.password);
      const cap = page.locator(L.captchaSelector).first();
      if (await cap.count()) await cap.fill(L.captchaValue);
      await PlatformLogin.selectLegalPerson(page, L);
      // 按钮文字可能带空格（如「登 录」）→ 逐字间插入 \s* 容忍空白
      const btnRe = new RegExp(L.loginButtonText.trim().split('').join('\\s*'));
      await page.getByRole('button').filter({ hasText: btnRe }).first().click();
      await page.waitForURL((u) => !String(u).includes(L.loggedInUrlShouldNotContain), { timeout: 30000 });
    }
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.context().storageState({ path: stateSavePath }).catch(() => {});
    log(`  登录成功，登录态已保存 → ${stateSavePath}`);
  }

  // 法人下拉：无默认值时选第一项
  static async selectLegalPerson(page, L) {
    const legal = page.locator(L.legalPersonSelector).first();
    if (!(await legal.count())) return;
    if (await legal.inputValue().catch(() => '')) return;
    await legal.click();
    await page.waitForTimeout(1000);
    const firstOpt = page.locator('.el-select-dropdown__item').first();
    if (await firstOpt.count()) await firstOpt.click();
    await page.waitForTimeout(400);
  }
}
