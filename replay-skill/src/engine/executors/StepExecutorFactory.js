// 工厂（Factory）：节点类型 → 具体执行器
import { PageExecutor } from './PageExecutor.js';
import { PopupExecutor } from './PopupExecutor.js';
import { EleExecutor } from './EleExecutor.js';
import { StepExecutor } from './StepExecutor.js';

class UnknownTypeExecutor extends StepExecutor {
  constructor(type) {
    super();
    this.type = type;
  }

  async execute() {
    return `跳过未知节点类型 ${this.type}`;
  }
}

export class StepExecutorFactory {
  static create(node, profile) {
    switch (node.type) {
      case 'page': return new PageExecutor(profile);
      case 'popup': return new PopupExecutor(profile);
      case 'ele': return new EleExecutor(profile);
      default: return new UnknownTypeExecutor(node.type);
    }
  }
}
