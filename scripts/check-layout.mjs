#!/usr/bin/env node
// =====================================================================
// check-layout — 目录结构守卫
//
// 目的：资料与生成物按固定文件夹存放。.gitignore 只忽略这些文件夹，
// 因此放错位置的文件会出现在 git status；本脚本在提交前再兜一层，
// 防止有人用 git add -f 或改规则把客户资料、批次产物带进仓库。
//
// 用法：node scripts/check-layout.mjs      （npm run check:layout）
// 退出码：0 通过；1 有违规
// =====================================================================
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// 客户资料的固定文件夹（与 .gitignore、README「数据策略与目录规则」一致）
const MATERIALS_FOLDERS = [
  'materials/requirements/',   // 需求分册 docx
  'materials/screenshots/',    // 文档抽图
  'materials/catalog/',        // docx 解析产物
  'materials/archive/',        // 压缩包 / 原件
];

// 生成物文件夹：不允许出现被跟踪文件
const ARTIFACT_DIRS = [
  'work/', 'partner-wire/', 'runs/', 'out/', 'replay-out/',
  'playwright-report/', 'blob-report/', 'test-results/',
];

// 资料类扩展名：一律不入库（materials/ 文件夹已被忽略，这里是防强制添加）
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

// ---------- 1. materials/ 下的实际文件必须在固定文件夹内 ----------
for (const file of walkFiles('materials')) {
  if (!MATERIALS_FOLDERS.some((d) => file.startsWith(d))) {
    errors.push(file + '\n     materials/ 下只允许放在固定文件夹：\n' +
      MATERIALS_FOLDERS.map((d) => '       - ' + d).join('\n'));
  }
}

// ---------- 2. 被跟踪文件检查 ----------
for (const file of trackedFiles()) {
  // 2.1 生成物目录不允许入库
  const artifactDir = ARTIFACT_DIRS.find((d) => file.startsWith(d));
  if (artifactDir) {
    errors.push(file + '\n     属于生成物目录（' + artifactDir + '），不应入库。' +
      '\n     处理：git rm --cached "' + file + '"');
    continue;
  }

  // 2.2 资料类文件不允许入库（含 materials/ 下的强制添加）
  if (MATERIAL_EXT.test(file)) {
    errors.push(file + '\n     是资料/办公文件，按约定不入库（放 materials/ 对应文件夹即可）。' +
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

// ---------- 汇总 ----------
if (errors.length) {
  console.log('目录结构校验失败：共 ' + errors.length + ' 项违规\n');
  for (const e of errors) console.log('  ✗ ' + e + '\n');
  console.log('规则见 README「数据策略与目录规则」与 .gitignore；本检查由 .githooks/pre-commit 调用。');
  process.exit(1);
}

console.log('目录结构校验通过（资料位置 / 生成物 / 资料入库 / 单文件体积）。');
