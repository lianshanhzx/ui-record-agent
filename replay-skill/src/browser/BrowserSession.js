// 门面（Facade）：浏览器生命周期 + 登录态 + 页面导航的统一入口
// 调用方只依赖 session.goto / newPage / close，内部处理会话过期自动登录
import { chromium } from './playwright.js';
import { PlatformLogin } from './PlatformLogin.js';
import { PageHelpers } from '../web/PageHelpers.js';

export class BrowserSession {
  constructor({ profile, authFile, headed, stateSavePath }) {
    this.profile = profile;
    this.authFile = authFile;
    this.headed = headed;
    this.stateSavePath = stateSavePath;
    this.browser = null;
    this.context = null;
  }

  async start() {
    this.browser = await chromium.launch({ headless: !this.headed });
    this.context = await this.browser.newContext({
      viewport: this.profile.viewport,
      storageState: this.authFile || undefined,
    });
  }

  async newPage() {
    return this.context.newPage();
  }

  async close() {
    await this.browser.close().catch(() => {});
  }

  isLoginPage(page) {
    return String(page.url()).includes(this.profile.login.loggedInUrlShouldNotContain);
  }

  // 导航并保证落在业务页：若被重定向到登录页则自动登录后重进
  async goto(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await PageHelpers.settle(page, 1500);
    if (this.isLoginPage(page)) {
      await PlatformLogin.login(page, this.profile, this.stateSavePath);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await PageHelpers.settle(page, 1500);
    }
  }
}
