// 下拉选择动作：点开 el-select → 在可见下拉面板中选文案匹配的选项
import { PageHelpers } from '../../web/PageHelpers.js';
import { ElementAction } from './ElementAction.js';

export class SelectClickAction extends ElementAction {
  async execute(ctx, node) {
    const page = ctx.page;
    const loc = PageHelpers.byXpath(page, node.xpath);
    await loc.waitFor({ state: 'visible', timeout: ctx.stepTimeout });
    await loc.click();
    // 下拉面板挂 body 末尾，取最后一个可见面板即刚打开的
    const dropdown = page.locator('.el-select-dropdown:visible').last();
    await dropdown.waitFor({ state: 'visible', timeout: ctx.stepTimeout });
    const item = dropdown.locator(ctx.profile.selectDropdownItemSelector).filter({ hasText: node.value }).first();
    await item.click({ timeout: ctx.stepTimeout });
    await page.waitForTimeout(500);
    // 多选型下拉（如 tssc-multi-select）选完不自动收起：仍可见则 Esc 兜底
    if (await dropdown.isVisible().catch(() => false)) await page.keyboard.press('Escape');
    await PageHelpers.settle(page, 200);
    return `下拉选择「${node.name}」= ${node.value}`;
  }
}
