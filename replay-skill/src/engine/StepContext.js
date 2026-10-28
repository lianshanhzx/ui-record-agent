// 步骤上下文：贯穿执行器/动作的运行时参数与中间状态
import { PageHelpers } from '../web/PageHelpers.js';

export class StepContext {
  constructor({ page, session, profile, outDirs, txn, stepTimeout }) {
    this.page = page;
    this.session = session;
    this.profile = profile;
    this.outDirs = outDirs;
    this.txn = txn;
    this.stepTimeout = stepTimeout;
    this.downloads = [];
    this.lastDownload = null;
    this.warnings = [];
  }

  async shot(id, name) {
    return PageHelpers.shot(this.page, this.outDirs.shots, this.txn.file, id, name);
  }
}
