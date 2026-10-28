// 通用页面工具（静态方法）：等待/沉降/健壮可见等待/截图/表格行/错误提示采集
import path from 'node:path';

export class PageHelpers {
  static byXpath(page, xpath) {
    return page.locator(`xpath=${xpath}`).first();
  }

  // 可见优先的 xpath 定位：返回第一个"可见"匹配实例（等待其可见），
  // 规避 .first() 命中隐藏重复实例（残留 popover/dialog、主表 is-hidden 副本）导致的空等超时
  static async byXpathVisible(page, xpath, timeout, label) {
    return PageHelpers.waitForVisible(page, `xpath=${xpath}`, timeout, label);
  }

  // 点击/输入后的沉降：等网络空闲（有上限）+ 固定缓冲，覆盖组件异步状态复位
  static async settle(page, ms = 0) {
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    if (ms > 0) await page.waitForTimeout(ms);
  }

  static slug(s, max = 40) {
    return String(s || 'step').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, max);
  }

  static baseNoExt(name) {
    return path.basename(String(name)).replace(/\.xlsx?$/i, '');
  }

  static async shot(page, shotsDir, stem, id, name) {
    const p = path.join(shotsDir, `${stem}_${String(id).padStart(2, '0')}_${PageHelpers.slug(name)}.png`);
    await page.screenshot({ path: p }).catch(() => {});
    return path.basename(p);
  }

  // 健壮"等待任一匹配元素可见"：用 visible 过滤集合轮询，
  // 避免 .first() 命中隐藏实例（如残留 el-dialog）导致空等到超时
  static async waitForVisible(page, selector, timeout, label) {
    const visible = page.locator(selector).filter({ visible: true });
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if ((await visible.count().catch(() => 0)) > 0) return visible.first();
      await page.waitForTimeout(250);
    }
    throw new Error(`${label ? `${label}：` : ''}元素未可见（${selector}，等待 ${timeout}ms）`);
  }

  // 页面就绪：导航 + 可选就绪选择器（表单挂载完成信号）
  static async gotoReady(session, page, url, readySelector) {
    await session.goto(page, url);
    if (readySelector) {
      await page.locator(readySelector).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
  }

  static async collectErrorToasts(page, profile) {
    const texts = await page.locator(profile.errorToastSelector).allInnerTexts().catch(() => []);
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  static async rowCount(page, profile) {
    return page.locator(profile.tableRowSelector).count();
  }

  static async expectRows(page, profile, want, label) {
    let c = -1;
    for (let i = 0; i < 40; i++) {
      c = await PageHelpers.rowCount(page, profile);
      if (c === want) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`${label}：期望 ${want} 行，实际 ${c} 行`);
  }
}
