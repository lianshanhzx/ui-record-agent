// 领域模型：一笔回放交易（报文中的一条 transcationEventTypeList 项）
// 节点按 propertiesID 升序 = 录制时的操作顺序
import { StepNode } from './StepNode.js';

export class WireTransaction {
  constructor(file, txn) {
    this.file = file;
    this.name = txn.transcationName || file;
    this.pageId = txn.pageId || '';
    this.nodes = (txn.transcationProperties || [])
      .slice()
      .sort((a, b) => Number(a.propertiesID) - Number(b.propertiesID))
      .map((n) => StepNode.from(n));
  }

  get stepCount() {
    return this.nodes.length;
  }
}
