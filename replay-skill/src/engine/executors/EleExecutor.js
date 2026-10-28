// 元素节点执行器：按动作类型委派给具体元素动作（Strategy）
import { ActionFactory } from '../actions/ActionFactory.js';
import { StepExecutor } from './StepExecutor.js';

export class EleExecutor extends StepExecutor {
  constructor(profile) {
    super();
    this.profile = profile;
  }

  async execute(ctx, node) {
    const action = ActionFactory.create(node, this.profile);
    return action.execute(ctx, node);
  }
}
