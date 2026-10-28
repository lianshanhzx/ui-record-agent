// 普通点击动作：点击 + 沉降；步骤名含「断言…N 行」时附带表格行数断言
import { PageHelpers } from '../../web/PageHelpers.js';
import { ElementAction } from './ElementAction.js';

const ROW_ASSERT = /断言[^0-9]*(\d+)\s*行/;

export class ClickAction extends ElementAction {
  async execute(ctx, node) {
    const page = ctx.page;
    const loc = await PageHelpers.byXpathVisible(page, node.xpath, ctx.stepTimeout, node.name);
    await loc.click();
    await PageHelpers.settle(page, ctx.profile.settleAfterClickMs);
    const m = (node.name || '').match(ROW_ASSERT);
    if (m) await PageHelpers.expectRows(page, ctx.profile, Number(m[1]), `步骤「${node.name}」`);
    return `点击「${node.name}」`;
  }
}
