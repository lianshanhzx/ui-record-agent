// 弹窗节点执行器：等待弹窗可见（健壮 visible 等待，规避隐藏实例陷阱）
import { PageHelpers } from '../../web/PageHelpers.js';
import { StepExecutor } from './StepExecutor.js';

export class PopupExecutor extends StepExecutor {
  constructor(profile) {
    super();
    this.profile = profile;
  }

  async execute(ctx, node) {
    const entry = (this.profile.popups || [])
      .find((p) => (p.match || []).some((kw) => node.name.includes(kw))) || null;
    const selector = (entry && entry.selector) || this.profile.popupFallbackSelector;
    await PageHelpers.waitForVisible(ctx.page, selector, 15000, `弹窗「${node.name}」`);
    await PageHelpers.settle(ctx.page, 300);
    return `弹窗可见：${node.name}`;
  }
}
