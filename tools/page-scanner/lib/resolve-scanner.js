'use strict'

/**
 * resolve-scanner.js — 定位运行时脚本 page-scanner.js（单真源）
 *
 * 运行时脚本不在本子项目里，它留在技能目录（录制时 agent 直接注入页面）：
 *   .opencode/skills/playwright-ui-recorder/scripts/page-scanner.js
 *
 * 查找顺序：
 *   1. 显式传入的路径（--scanner / capture({ scannerPath }))
 *   2. 环境变量 PAGE_SCANNER_PATH
 *   3. 从本文件向上找仓库根（含 .opencode/skills/playwright-ui-recorder/scripts/page-scanner.js）
 *   4. 从 cwd 向上找同样的路径
 */

const fs = require('fs')
const path = require('path')

const REL = path.join('.opencode', 'skills', 'playwright-ui-recorder', 'scripts', 'page-scanner.js')

function exists(p) {
  try { return !!p && fs.existsSync(p) && fs.statSync(p).isFile() } catch (e) { return false }
}

function walkUpFor(start, rel) {
  let dir = path.resolve(start)
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, rel)
    if (exists(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return ''
}

function resolveScanner(explicit) {
  if (exists(explicit)) return path.resolve(explicit)
  if (exists(process.env.PAGE_SCANNER_PATH)) return path.resolve(process.env.PAGE_SCANNER_PATH)

  const fromFile = walkUpFor(__dirname, REL)
  if (fromFile) return fromFile

  const fromCwd = walkUpFor(process.cwd(), REL)
  if (fromCwd) return fromCwd

  throw new Error(
    '找不到 page-scanner.js。请用 --scanner <path> 指定，或设置环境变量 PAGE_SCANNER_PATH。\n' +
    '默认位置：<repo>/' + REL
  )
}

module.exports = { resolveScanner: resolveScanner, RELATIVE_SCANNER_PATH: REL }
