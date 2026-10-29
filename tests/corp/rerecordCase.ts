import { expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

// Each atomic spec delegates to the unchanged official engine.
// Prepare a fresh batch once, then execute all specs with one worker in numeric order.
export async function replayRecordedCase(id: string) {
  const root = process.cwd();
  // 录制批次产物不入库。默认沿用历史批次目录，可用 CORP_RUN_DIR 指向新批次
  // （例如迁移到 runs/corp/rerecord-20261012），批次由 cases/corp/scripts 生成。
  const run = process.env.CORP_RUN_DIR || path.join(root, 'work/corp-rerecord-20261012');
  const input = process.env.CORP_WIRE_DIR || path.join(run, 'delivery-input');
  const out = path.join(run, 'spec-replay-out', id);
  const wire = path.join(input, `${id}.json`);
  expect(fs.existsSync(wire), 'Generate a fresh recording batch before execution').toBeTruthy();
  const result = await promisify(execFile)(process.execPath, [
    path.join(root, 'replay-skill/replay.mjs'), wire,
    '--profile', path.join(run, 'profile.json'),
    '--auth', path.join(run, 'auth.json'), '--out', out,
  ], { cwd: root, timeout: 280000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || 'C:/Users/longpeng/AppData/Local/ms-playwright' } });
  const report = JSON.parse(fs.readFileSync(path.join(out, 'replay-report.json'), 'utf8'));
  expect(report.summary.fail, result.stdout.slice(-6000)).toBe(0);
  if (id === 'R106') {
    // This recorded negative case intentionally submits an empty OCR form.
    const warnings = report.results.flatMap((entry: any) => entry.warnings || []);
    expect(warnings.length, 'Empty OCR submission must show its validation message').toBeGreaterThan(0);
    expect(warnings.every((message: string) => message.includes('请选择需要识别的内容'))).toBeTruthy();
    expect(report.summary.warn).toBe(1);
  } else {
    expect(report.summary.warn, 'Inspect any unexpected warning before acceptance').toBe(0);
  }
  expect(report.summary.pass + report.summary.warn).toBe(1);
}
