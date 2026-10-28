// 控制台汇报器：逐笔结果 + 汇总
export class ConsoleReporter {
  print(report) {
    console.log('\n================ 回放结果 ================');
    for (const r of report.results) {
      const tag = r.status === 'pass' ? 'PASS' : r.status === 'warn' ? 'WARN' : 'FAIL';
      console.log(`[${tag}] ${r.file}  ${r.transaction}  ${r.durationMs}ms  ${r.steps.length}步`);
      for (const e of r.errors) console.log(`       错误: ${e}`);
      for (const w of r.warnings) console.log(`       警告: ${w}`);
    }
    const s = report.summary;
    console.log(`通过 ${s.pass} / ${s.total}（警告 ${s.warn}，失败 ${s.fail}），总耗时 ${report.durationMs}ms`);
  }
}
