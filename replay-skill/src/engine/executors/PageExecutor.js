// 页面节点执行器：
//  - 根页面（PID=0）：直达 homeRoute
//  - 子页面：校验上一步点击是否自然跳转（URL 模式），可选自愈直达
//  - 下载完成节点：校验上一步捕获的下载文件（平台文件名带随机数字后缀 → 前缀匹配）
import fs from 'node:fs';
import { PageHelpers } from '../../web/PageHelpers.js';
import { log } from '../../util/log.js';
import { StepExecutor } from './StepExecutor.js';

export class PageExecutor extends StepExecutor {
  constructor(profile) {
    super();
    this.profile = profile;
  }

  async execute(ctx, node) {
    if (PageExecutor.isDownloadCheckpoint(node)) return this.verifyDownload(ctx, node);
    if (node.pid === '0') return this.openRoot(ctx);
    return this.enterSubPage(ctx, node);
  }

  async openRoot(ctx) {
    const url = ctx.profile.baseUrl + ctx.profile.homeRoute;
    await PageHelpers.gotoReady(ctx.session, ctx.page, url, ctx.profile.tableReadySelector);
    return `进入根页面 → ${ctx.page.url()}`;
  }

  async enterSubPage(ctx, node) {
    const entry = this.resolveEntry(node.name);
    if (!entry) {
      await PageHelpers.settle(ctx.page, 800);
      return `检查点「${node.name}」（未注册路由规则，仅截图）`;
    }
    const pattern = new RegExp(entry.urlPattern);
    if (!pattern.test(ctx.page.url())) {
      await ctx.page.waitForURL(pattern, { timeout: 8000 }).catch(() => {});
    }
    if (!pattern.test(ctx.page.url())) {
      // 报文可能漏录导航动作（如保存后的「返回」点击）：
      // 先试 profile 配置的返回按钮（还原人工/spec 行为），失败再直达注册路由
      if (await this.tryBackButton(ctx, pattern, node.name)) {
        await PageHelpers.settle(ctx.page, 500);
        return `进入页面 ${node.name}（点「${ctx.profile.backButtonText}」返回）→ ${ctx.page.url()}`;
      }
      if (entry.route) {
        log(`    ! 未自然跳转到「${node.name}」，自愈直达 ${entry.route}`);
        ctx.warnings.push(`页面「${node.name}」未自然跳转，引擎自愈直达路由`);
        await PageHelpers.gotoReady(ctx.session, ctx.page, ctx.profile.baseUrl + entry.route, entry.readySelector || ctx.profile.tableReadySelector);
      } else {
        throw new Error(`期望进入页面「${node.name}」（URL 含 ${entry.urlPattern}），实际 ${ctx.page.url()}`);
      }
    } else if (entry.readySelector) {
      // URL 先到、表单后挂载（微前端）：等就绪信号再放行后续步骤
      await ctx.page.locator(entry.readySelector).first().waitFor({ state: 'visible', timeout: 15000 });
    }
    await PageHelpers.settle(ctx.page, 500);
    return `进入页面 ${node.name} → ${ctx.page.url()}`;
  }

  resolveEntry(name) {
    return (this.profile.pages || []).find((p) => (p.match || []).some((kw) => name.includes(kw))) || null;
  }

  // 返回按钮自愈：可见则点击并等待自然跳转成功
  async tryBackButton(ctx, pattern, pageName) {
    const text = this.profile.backButtonText;
    if (!text) return false;
    const btn = ctx.page.getByRole('button').filter({ hasText: text }).first();
    if (!(await btn.count().catch(() => 0)) || !(await btn.isVisible().catch(() => false))) return false;
    log(`    ! 未自然跳转到「${pageName}」，点击「${text}」按钮返回`);
    ctx.warnings.push(`页面「${pageName}」未自然跳转（报文未录导航动作），引擎点击「${text}」按钮返回`);
    await btn.click();
    await PageHelpers.settle(ctx.page, 1200);
    await ctx.page.waitForURL(pattern, { timeout: 10000 }).catch(() => {});
    return pattern.test(ctx.page.url());
  }

  static isDownloadCheckpoint(node) {
    return /\.xlsx?$/i.test(node.value) || (node.name || '').includes('下载完成');
  }

  verifyDownload(ctx, node) {
    const want = PageHelpers.baseNoExt(node.value || 'download');
    const dl = ctx.downloads.shift();
    if (!dl) throw new Error('未捕获到下载事件（点击后浏览器未产生下载）');
    const realBase = PageHelpers.baseNoExt(dl.name);
    if (!realBase.startsWith(want)) {
      throw new Error(`下载文件名不匹配：期望前缀 ${want}.xlsx，实际 ${dl.name}`);
    }
    const size = fs.statSync(dl.path).size;
    const known = (ctx.profile.downloads?.knownEmptyFiles || []).map((n) => PageHelpers.baseNoExt(n));
    if (size === 0 && !known.some((k) => realBase.startsWith(k))) {
      throw new Error(`下载文件为 0 字节且非已知缺陷：${dl.name}`);
    }
    if (size === 0) {
      ctx.warnings.push(`已知服务端缺陷（模板缺失）：下载 ${dl.name} 为 0 字节，接口与文件名契约正常`);
    }
    ctx.lastDownload = { file: dl.name, path: dl.path, size };
    return `下载校验通过：${dl.name}（${size} 字节）`;
  }
}
