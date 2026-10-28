// 单选行选中动作：
// radio 的 span 可能 hidden（el-table 固定列复制/渲染状态），不能等其可见；
// 采用已验证策略：行可见 → 强制点首列 td → 断言 radio checked（失败再点一次）
import { PageHelpers } from '../../web/PageHelpers.js';
import { ElementAction } from './ElementAction.js';

export class RadioRowAction extends ElementAction {
  static isRadioRow(node) {
    return /el-radio/.test(node.xpath || '');
  }

  async execute(ctx, node) {
    const page = ctx.page;
    // 可见行优先：取第一个"所在 tr 可见"的 radio 实例，
    // 规避 .first() 命中 is-hidden 主表克隆（其行不可见导致空等超时）
    const radios = page.locator(`xpath=${node.xpath}`);
    const t0 = Date.now();
    let row = null;
    while (!row && Date.now() - t0 < ctx.stepTimeout) {
      const n = await radios.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const r = radios.nth(i).locator('xpath=ancestor::tr[1]').first();
        if (await r.isVisible().catch(() => false)) { row = r; break; }
      }
      if (!row) await page.waitForTimeout(250);
    }
    if (!row) throw new Error(`未找到可见行（xpath=${node.xpath}，等待 ${ctx.stepTimeout}ms）`);
    await page.waitForTimeout(500);
    await row.locator('td').first().click({ force: true });
    try {
      await this.waitChecked(row);
    } catch {
      await row.locator('td').first().click({ force: true });
      await this.waitChecked(row);
    }
    await PageHelpers.settle(page, 500);
    return `选中行「${node.name}」`;
  }

  async waitChecked(row) {
    const radio = row.locator('input[type=radio]').first();
    const t0 = Date.now();
    while (Date.now() - t0 < 5000) {
      if (await radio.isChecked().catch(() => false)) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('radio 未变为选中状态（5s 内）');
  }
}
