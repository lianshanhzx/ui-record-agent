// 建造者（Builder）：回放报告的模型组装与 JSON 持久化
import fs from 'node:fs';
import path from 'node:path';

export class ReportBuilder {
  static createTransactionResult(txn) {
    return {
      file: txn.file,
      transaction: txn.name,
      pageId: txn.pageId,
      status: 'pass',
      startedAt: Date.now(),
      durationMs: 0,
      steps: [],
      warnings: [],
      errors: [],
    };
  }

  static finish({ profile, base, results, startedAt }) {
    return {
      generatedAt: new Date().toISOString(),
      profile: profile.name || profile.platform,
      base,
      durationMs: Date.now() - startedAt,
      summary: {
        total: results.length,
        pass: results.filter((r) => r.status === 'pass').length,
        warn: results.filter((r) => r.status === 'warn').length,
        fail: results.filter((r) => r.status === 'fail').length,
      },
      results,
    };
  }

  static write(report, outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const p = path.join(outDir, 'replay-report.json');
    fs.writeFileSync(p, JSON.stringify(report, null, 2));
    return p;
  }
}
