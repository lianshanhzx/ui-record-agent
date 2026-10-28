// 工厂（Factory）：按节点动作类型 + 目标特征选择元素动作（Strategy）
import { ClickAction } from './ClickAction.js';
import { InputAction } from './InputAction.js';
import { SelectClickAction } from './SelectClickAction.js';
import { DownloadAction } from './DownloadAction.js';
import { FileChooseAction } from './FileChooseAction.js';
import { RadioRowAction } from './RadioRowAction.js';

export class ActionFactory {
  static create(node, profile) {
    if (node.action === 'input') return new InputAction();
    if (node.action === 'select:click') return new SelectClickAction();
    if (node.action === 'file:choose') return new FileChooseAction();
    if (node.action === 'click') {
      const label = `${node.name}|${node.realLabel}`;
      if ((profile.downloadTriggers || []).some((t) => label.includes(t))) return new DownloadAction();
      if (RadioRowAction.isRadioRow(node)) return new RadioRowAction();
      return new ClickAction();
    }
    throw new Error(`未知动作类型：${node.action}`);
  }
}
