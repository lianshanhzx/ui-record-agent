// 输入动作：input / textarea 填写
import { PageHelpers } from '../../web/PageHelpers.js';
import { ElementAction } from './ElementAction.js';

export class InputAction extends ElementAction {
  async execute(ctx, node) {
    const loc = await PageHelpers.byXpathVisible(ctx.page, node.xpath, ctx.stepTimeout, node.name);
    await loc.fill(node.value);
    await PageHelpers.settle(ctx.page, ctx.profile.settleAfterInputMs);
    return `输入「${node.name}」= ${node.value}`;
  }
}
