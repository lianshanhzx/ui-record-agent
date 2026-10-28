// 抽象元素动作（Strategy 基类）：按 eventTypeValue 实现单个元素操作
export class ElementAction {
  async execute(_ctx, _node) {
    throw new Error(`ElementAction.execute 未实现: ${_node.action}`);
  }
}
