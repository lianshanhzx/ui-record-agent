// 抽象执行器（Strategy 基类）：每种报文节点类型继承并实现 execute(ctx, node)
export class StepExecutor {
  async execute(_ctx, _node) {
    throw new Error(`StepExecutor.execute 未实现: ${_node.type}`);
  }
}
