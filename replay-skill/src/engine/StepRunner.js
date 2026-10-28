// 单笔交易回放器（Template Method：固定骨架 = 逐步执行 → 错误提示采集 → 截图留证 → 失败即停）
import { StepExecutorFactory } from './executors/StepExecutorFactory.js';
import { PageHelpers } from '../web/PageHelpers.js';
import { ReportBuilder } from '../report/ReportBuilder.js';
import { log } from '../util/log.js';

export class StepRunner {
  constructor({ strict = false } = {}) {
    this.strict = strict;
  }

  async run(ctx) {
    const result = ReportBuilder.createTransactionResult(ctx.txn);
    for (const node of ctx.txn.nodes) {
      const step = { id: node.id, type: node.type, name: node.name, action: node.action, ms: 0, status: 'ok', detail: '' };
      const t0 = Date.now();
      try {
        const executor = StepExecutorFactory.create(node, ctx.profile);
        step.detail = await executor.execute(ctx, node);
        step.screenshot = await ctx.shot(node.id, node.name || node.type);
      } catch (e) {
        step.status = 'fail';
        step.error = e.message;
        step.screenshot = await ctx.shot(node.id, 'FAIL');
        result.errors.push(`步骤(${node.id}) ${step.name}: ${e.message}`);
        result.status = 'fail';
        result.steps.push(step);
        log(`  ✖ (${node.id}) ${step.name} 失败: ${e.message}`);
        break;
      }
      const toasts = await PageHelpers.collectErrorToasts(ctx.page, ctx.profile);
      if (toasts.length) {
        step.warnings = toasts;
        result.warnings.push(`步骤(${node.id}) ${step.name} 出现错误提示: ${toasts.join(' | ')}`);
      }
      step.ms = Date.now() - t0;
      result.steps.push(step);
      log(`  (${node.id}) ${node.type}/${node.action || '-'} ${step.name} → ${step.detail} (${step.ms}ms)`);
    }
    result.warnings.push(...ctx.warnings);
    result.durationMs = Date.now() - result.startedAt;
    if (this.strict && result.warnings.length) result.status = 'fail';
    else if (result.warnings.length && result.status === 'pass') result.status = 'warn';
    return result;
  }
}
