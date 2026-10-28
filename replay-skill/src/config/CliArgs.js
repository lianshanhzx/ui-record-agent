// CLI 参数解析（值对象）：把 process.argv 归一化为回放配置
export function parseCliArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i += 1; }
    } else {
      positional.push(t);
    }
  }
  return {
    input: positional[0] || null,
    profile: typeof flags.profile === 'string' ? flags.profile : null,
    auth: typeof flags.auth === 'string' ? flags.auth : null,
    base: typeof flags.base === 'string' ? flags.base : null,
    out: typeof flags.out === 'string' ? flags.out : null,
    only: typeof flags.only === 'string' ? flags.only : '',
    headed: Boolean(flags.headed),
    strict: Boolean(flags.strict),
    stepTimeout: Number(flags['step-timeout'] || 20000),
    list: Boolean(flags.list),
  };
}

export function printUsage() {
  console.error('用法: node replay.mjs <wire.json|目录> [选项]');
  console.error('  --profile <json>    平台配置（默认 <skill>/profiles/tansun-credit.json）');
  console.error('  --auth <json>       登录态 storageState（默认当前目录 auth.json）');
  console.error('  --base <url>        覆盖平台地址');
  console.error('  --out <dir>         输出目录（默认 <报文目录>/replay-out）');
  console.error('  --only <关键字>     只回放文件名/交易名包含关键字的报文');
  console.error('  --headed            有头浏览器（默认 headless）');
  console.error('  --strict            警告（已知缺陷）也判失败');
  console.error('  --step-timeout <ms> 单步元素等待（默认 20000）');
  console.error('  --list              只列出将回放的交易，不执行');
}
