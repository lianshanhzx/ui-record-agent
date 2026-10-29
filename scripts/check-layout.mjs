#!/usr/bin/env node
// =====================================================================
// check-layout — 目录结构守卫
//
// 目的：资料与生成物必须按约定结构存放。.gitignore 只按结构忽略，
// 因此「放错位置」的文件会出现在 git status；本脚本进一步在提交前拦截，
// 防止有人用 git add -f 或改规则把客户资料、批次产物带进仓库。
//
// 用法：node scripts/check-layout.mjs      （npm run check:layout）
// 退出码：0 通过；1 有违规
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MATERIALS_ROOT = 'materials';

// materials/ 下允许的结构（与 .gitignore、docs/materials.md 保持一致）
const MATERIALS_RULES = [
  { re: /^materials\/requirements\/[^/]+\.docx$/i, desc: 'materials/requirements/*.docx（需求分册）' },
  { re: /^materials\/screenshots\/[^/]+\.(png|jpe?g|gif)$/i, desc: 'materials/screenshots/*.{png,jpg,jpeg,gif}（文档抽图）' },
  { re: /^materials\/catalog\/[^/]+\.json$/i, desc: 'materials/catalog/*.json（docx 解析产物）' },
  { re: /^materials\/archive\/[^/]+\.(zip|rar|7z|pdf)$/i, desc: 'materials/archive/*.{zip,rar,7z,pdf}（压缩包/原件）' },
];

// 生成物目录：不允许出现被跟踪文件
const ARTIFACT_DIRS = [
  'work/', 'partner-wire/', 'runs/', 'out/', 'replay-out/',
  'playwright-report/', 'blob-report/', 'test-results/',
];

// 资料类扩展名：只允许出现在 materials/ 的约定结构里（默认不入库）
const MATERIAL_EXT = /\.(docx?|pdf|zip|rar|7z|xlsx?|pptx?)$/i;

const MAX_TRACKED_BYTES = 5 * 1024 * 1024;

const errors = [];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  return out.toString('utf8').split('\0').filter(Boolean);
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(f, out);
    else out.push(toPosix(f));
  }
  return out;
}

// ---------- 1. materials/ 实际文件必须落在约定结构内 ----------
for (const file of walkFiles(MATERIALS_ROOT)) {
  if (!MATERIALS_RULES.some((r) => r.re.test(file))) {
    errors.push(file + '\n     不在 materials 的约定结构内。允许的位置：\n' +
      MATERIALS_RULES.map((r) => '       - ' + r.desc).join('\n'));
  }
}

// ---------- 2. 被跟踪文件检查 ----------
const tracked = trackedFiles();

for (const file of tracked) {
  // 2.1 生成物目录不允许入库
  if (ARTIFACT_DIRS.some((d) => file.startsWith(d))) {
    errors.push(file + '\n     属于生成物目录（' + ARTIFACT_DIRS.find((d) => file.startsWith(d)) + '），不应入库。' +
      '\n     处理：git rm --cached "' + file + '"');
    continue;
  }

  // 2.2 资料类文件不允许入库（含 materials/ 下的强制添加）
  if (MATERIAL_EXT.test(file)) {
    errors.push(file + '\n     是资料/办公文件，按约定不入库（放 materials/ 对应子目录即可，目录已按结构忽略）。' +
      '\n     处理：git rm --cached "' + file + '"');
    continue;
  }

  // 2.3 单文件体积上限
  if (fs.existsSync(file)) {
    const size = fs.statSync(file).size;
    if (size > MAX_TRACKED_BYTES) {
      errors.push(file + '\n     体积 ' + (size / 1048576).toFixed(1) + 'MB，超过入库上限 5MB。' +
        '\n     处理：移到 materials/ 或 runs/（不跟踪），或 git rm --cached "' + file + '"');
    }
  }
}

// ---------- 3. 结构外散文件提示（不阻断，只提醒归位） ----------
const strayByDir = new Map();
for (const dir of ['work', 'partner-wire']) {
  if (!fs.existsSync(dir)) continue;
  const loose = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile());
  if (loose.length) strayByDir.set(dir, loose.map((e) => dir + '/' + e.name));
}
if (strayByDir.size) {
  const detail = process.argv.includes('--verbose');
  console.log('提示（不阻断提交，历史遗留待 P5 归位）：');
  for (const [dir, list] of strayByDir) {
    console.log('  - ' + dir + '/ 根层有 ' + list.length + ' 个散文件（约定应为 ' + dir + '/<批次|模块>/）');
    if (detail) for (const f of list) console.log('      ' + f);
  }
  if (!detail) console.log('    查看明细：node scripts/check-layout.mjs --verbose');
  console.log('');
}

// ---------- 汇总 ----------
if (errors.length) {
  console.log('目录结构校验失败：共 ' + errors.length + ' 项违规\n');
  for (const e of errors) console.log('  ✗ ' + e + '\n');
  console.log('规则见 docs/materials.md 与 .gitignore；本检查由 .githooks/pre-commit 调用。');
  process.exit(1);
}

console.log('目录结构校验通过（materials 结构 / 生成物 / 资料入库 / 单文件体积）。');
