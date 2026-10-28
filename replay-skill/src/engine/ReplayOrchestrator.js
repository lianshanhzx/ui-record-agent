// 编排器（Orchestrator）：
// 启动会话 → 逐笔交易回放（每笔新 page，数据依赖靠共享 context 与库内数据）→ 汇总报告落盘
import fs from 'node:fs';
import path from 'node:path';
import { BrowserSession } from '../browser/BrowserSession.js';
import { StepContext } from './StepContext.js';
import { StepRunner } from './StepRunner.js';
import { ReportBuilder } from '../report/ReportBuilder.js';
import { log } from '../util/log.js';

export class ReplayOrchestrator {
  constructor({ profile, transactions, outDir, authFile, headed, strict, stepTimeout }) {
    this.profile = profile;
    this.transactions = transactions;
    this.outDir = outDir;
    this.authFile = authFile;
    this.headed = headed;
    this.strict = strict;
    this.stepTimeout = stepTimeout;
  }

  get outDirs() {
    return {
      out: this.outDir,
      shots: path.join(this.outDir, 'shots'),
      downloads: path.join(this.outDir, 'downloads'),
    };
  }

  async run() {
    const startedAt = Date.now();
    fs.mkdirSync(this.outDirs.shots, { recursive: true });
    fs.mkdirSync(this.outDirs.downloads, { recursive: true });

    log(`回放 ${this.transactions.length} 笔交易 | profile=${path.basename(this.profile._path)} | base=${this.profile.baseUrl} | auth=${this.authFile ? path.basename(this.authFile) : '无(自动登录)'} | headed=${this.headed}`);

    const session = new BrowserSession({
      profile: this.profile,
      authFile: this.authFile,
      headed: this.headed,
      stateSavePath: path.join(this.outDir, 'auth-refreshed.json'),
    });
    await session.start();
    const results = [];
    try {
      for (let i = 0; i < this.transactions.length; i++) {
        const txn = this.transactions[i];
        log(`━━━ [${i + 1}/${this.transactions.length}] ${txn.name} ━━━`);
        const page = await session.newPage();
        const ctx = new StepContext({
          page,
          session,
          profile: this.profile,
          outDirs: this.outDirs,
          txn,
          stepTimeout: this.stepTimeout,
        });
        try {
          const runner = new StepRunner({ strict: this.strict });
          results.push(await runner.run(ctx));
        } finally {
          await page.close().catch(() => {});
        }
      }
    } finally {
      await session.close();
    }
    const report = ReportBuilder.finish({ profile: this.profile, base: this.profile.baseUrl, results, startedAt });
    ReportBuilder.write(report, this.outDir);
    return report;
  }
}
