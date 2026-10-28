#!/usr/bin/env node
/**
 * scan-verify.js — 单页面扫描验证 CLI（真实页面）
 *
 * 三层验证 + 标注截图 + 核对报告，实现见 scan-probe.js。
 *
 * 用法：
 *   node tools/page-scanner/bin/scan-verify.js \
 *     --url "http://test.creditv5p2.tansun.com.cn/#/cstMgt/..." \
 *     --state 列表 --fill 3
 *
 * 参数：
 *   --url      必填，完整地址（含 hash 路由）
 *   --state    状态名（默认 page），决定输出文件名
 *   --scope    modal | page（默认 page）
 *   --fill     N，抽样填充前 N 个输入框（默认 0）
 *   --out      输出目录（默认 work/scans/verify）
 *   --auth     storageState（默认 auth.json，缺失或 file:// 时跳过）
 *   --headed   有头模式
 *   --timeout  页面就绪超时 ms（默认 20000）
 *   --no-shot  不生成标注截图
 *
 * 退出码：0 无硬失败；1 有硬失败；2 运行异常
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')
const { capture, writeIndex } = require('../lib/scan-probe')

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i > -1 ? process.argv[i + 1] : def
}
function flag(name) { return process.argv.includes('--' + name) }

const URL_ARG = arg('url')
const STATE = arg('state', 'page')
const SCOPE = arg('scope', 'page')
const FILL_N = parseInt(arg('fill', '0'), 10) || 0
const OUT_DIR = arg('out', path.join('work', 'scans', 'verify'))
const AUTH = arg('auth', 'auth.json')
const HEADED = flag('headed')
const NO_SHOT = flag('no-shot')
const TIMEOUT = parseInt(arg('timeout', '20000'), 10) || 20000
const SCANNER_PATH = arg('scanner', '')

if (!URL_ARG) {
  console.error('缺少 --url')
  process.exit(2)
}

;(async () => {
  const isFile = /^file:\/\//i.test(URL_ARG)
  const browser = await chromium.launch({ headless: !HEADED })
  const contextOptions = { viewport: { width: 1440, height: 900 } }
  if (!isFile && fs.existsSync(AUTH)) {
    contextOptions.storageState = JSON.parse(fs.readFileSync(AUTH, 'utf8'))
  }
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  await page.locator('.el-form-item').first().waitFor({ state: 'visible', timeout: TIMEOUT }).catch(() => {})
  await page.waitForTimeout(800)

  const result = await capture(page, STATE, {
    outDir: OUT_DIR,
    fill: FILL_N,
    annotate: !NO_SHOT,
    scannerPath: SCANNER_PATH,
    scan: { scope: SCOPE }
  })

  writeIndex(OUT_DIR, [result], { task: STATE })

  const { issues, L1, L2, L3, inv } = result
  console.log('\n==== 扫描验证 ' + STATE + ' ====')
  console.log('页面：' + (inv.pageName || inv.title) + '　路由：' + inv.route)
  console.log('L1：DOM 表单项 ' + L1.domFormItems + ' / 扫描 ' + L1.scanFormItems +
    '　漏 ' + L1.missing.length + '　多 ' + L1.extra.length)
  console.log('L2：校验 ' + L2.checked + ' 条　硬失败 ' + L2.hard.length + '　软告警 ' + L2.soft.length)
  if (FILL_N) console.log('L3：抽样 ' + L3.filter((f) => f.ok).length + '/' + L3.length)
  if (pageErrors.length) console.log('页面异常：' + pageErrors.length)

  if (issues.hard.length) {
    console.log('\n[硬失败]')
    issues.hard.forEach((x) => console.log('  ✗ ' + x))
  }
  if (issues.soft.length) {
    console.log('\n[软告警]')
    issues.soft.slice(0, 20).forEach((x) => console.log('  ! ' + x))
  }
  console.log('\n核对页：' + result.files.html)
  console.log('标注图：' + (result.files.shot || '（未生成）'))

  await context.close()
  await browser.close()
  process.exit(issues.hard.length ? 1 : 0)
})().catch((e) => {
  console.error('VERIFY ERROR:', e && e.stack || e)
  process.exit(2)
})
