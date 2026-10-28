// 下载点击动作：点击并捕获 download 事件，落盘后入队，
// 供后续「下载完成」页面节点校验（文件名/大小/已知缺陷）
import path from 'node:path';
import { PageHelpers } from '../../web/PageHelpers.js';
import { ElementAction } from './ElementAction.js';

export class DownloadAction extends ElementAction {
  async execute(ctx, node) {
    const page = ctx.page;
    const loc = PageHelpers.byXpath(page, node.xpath);
    await loc.waitFor({ state: 'visible', timeout: ctx.stepTimeout });
    const dlPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await loc.click();
    const dl = await dlPromise;
    if (!dl) throw new Error(`点击「${node.name}」后未捕获到下载事件`);
    const p = path.join(ctx.outDirs.downloads, dl.suggestedFilename());
    await dl.saveAs(p);
    ctx.downloads.push({ name: dl.suggestedFilename(), path: p });
    await PageHelpers.settle(page, ctx.profile.settleAfterClickMs);
    return `点击「${node.name}」并捕获下载 ${dl.suggestedFilename()}`;
  }
}
