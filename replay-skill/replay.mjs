#!/usr/bin/env node
// =====================================================================
// wire-replay — 录制报文回放引擎 CLI 入口
// 主流程：解析参数 → 加载平台 Profile → 收集 wire 报文（Repository）
//         → 顺序回放（Orchestrator）→ 输出报告（Reporter）
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { parseCliArgs, printUsage } from './src/config/CliArgs.js';
import { loadProfile } from './src/config/Profile.js';
import { WireRepository } from './src/wire/WireRepository.js';
import { ReplayOrchestrator } from './src/engine/ReplayOrchestrator.js';
import { ConsoleReporter } from './src/report/ConsoleReporter.js';
import { log } from './src/util/log.js';

const args = parseCliArgs(process.argv.slice(2));
if (!args.input) {
  printUsage();
  process.exit(2);
}

// 1. 平台配置
const profile = loadProfile(args.profile);
if (args.base) profile.baseUrl = args.base.replace(/\/+$/, '');

// 2. 收集 wire 报文
const repo = new WireRepository();
const transactions = repo.discover(args.input, args.only);
if (!transactions.length) {
  console.error('[FATAL] 没有可回放的报文（--only 过滤后为空？）');
  process.exit(2);
}

// 3. --list：仅列出，不执行
if (args.list) {
  for (const t of transactions) {
    log(`[LIST] ${t.file}  ${t.name}  (${t.stepCount} 步, pageId=${t.pageId})`);
  }
  log(`共 ${transactions.length} 笔交易将回放`);
  process.exit(0);
}

// 4. 输出目录与登录态
const outDir = path.resolve(args.out || path.join(repo.wireDir, 'replay-out'));
const cwdAuth = path.resolve('auth.json');
const authFile = args.auth ? path.resolve(args.auth) : (fs.existsSync(cwdAuth) ? cwdAuth : null);

// 5. 顺序回放
const orchestrator = new ReplayOrchestrator({
  profile,
  transactions,
  outDir,
  authFile,
  headed: args.headed,
  strict: args.strict,
  stepTimeout: args.stepTimeout,
});
const report = await orchestrator.run();

// 6. 汇报
new ConsoleReporter().print(report);
log(`报告: ${path.join(outDir, 'replay-report.json')}`);
log(`截图: ${path.join(outDir, 'shots')}`);
process.exit(report.summary.fail > 0 ? 1 : 0);
