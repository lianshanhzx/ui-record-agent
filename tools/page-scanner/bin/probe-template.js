#!/usr/bin/env node
/**
 * probe-template.js — 真实页面扫描验证模板（多状态）
 *
 * 用法（在项目根目录执行）：
 *   node tools/page-scanner/bin/probe-template.js
 *   node tools/page-scanner/bin/probe-template.js --task T1 --route "/#/cstMgt/..." --add 新增
 *
 * 建议复制成 work/<task>/probe_scan.js 后改顶部 CONFIG，再按实际业务补 capture 步骤。
 *
 * 产出：<out>/index.html（汇总）+ 每个状态的 .html / .annotated.png / .inventory.json
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

// 采集/验证库（与本文件同属 tools/page-scanner 子项目）
const { capture, writeIndex } = require('../lib/scan-probe')

// ==================== CONFIG（改这里） ====================
const CONFIG = {
  base: 'http://test.creditv5p2.tansun.com.cn',
  route: '/#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg', // 目标页 hash 路由
  task: 'scan-check',                              // 输出目录名：work/<task>/scans
  addButton: '新增',                                // 列表页进入新增的按钮文本
  secondButton: '引入',                             // 二级弹窗触发按钮文本（没有就留空）
  fill: 3,                                          // 每屏抽样填充条数（0 = 不填）
  readyWait: 800,                                   // 每步等待 ms
  auth: 'auth.json'
}

function arg(name, def) {
  const i = process.argv.indexOf('--' + name)
  return i > -1 ? process.argv[i + 1] : def
}
function flag(name) { return process.argv.includes('--' + name) }

const URL_ARG = arg('url') || (CONFIG.base + CONFIG.route)
const TASK = arg('task', CONFIG.task)
const OUT = arg('out', path.join('work', TASK, 'scans'))
const FILL = parseInt(arg('fill', String(CONFIG.fill)), 10) || 0
const ADD = arg('add', CONFIG.addButton)
const SECOND = arg('second', CONFIG.secondButton)
const HEADED = flag('headed')
const AUTH = arg('auth', CONFIG.auth)
const SCANNER_PATH = arg('scanner', '')

function log(msg) { console.log('[probe] ' + msg) }

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: !HEADED })
  const opts = { viewport: { width: 1440, height: 900 } }
  if (!/^file:\/\//i.test(URL_ARG) && fs.existsSync(AUTH)) {
    opts.storageState = JSON.parse(fs.readFileSync(AUTH, 'utf8'))
  }
  const context = await browser.newContext(opts)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  const results = []
  async function step(name, fn) {
    try {
      await fn()
      await page.waitForTimeout(CONFIG.readyWait)
      const r = await capture(page, name, { outDir: OUT, fill: FILL, scannerPath: SCANNER_PATH })
      results.push(r)
      return r
    } catch (e) {
      log('跳过 ' + name + '：' + String(e.message || e).split('\n')[0])
      return null
    }
  }

  // ---- 1. 列表页 ----
  await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.locator('.el-form-item').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(CONFIG.readyWait)
  await step('01-列表', async () => {})

  // ---- 2. 新增（抽屉/弹窗） ----
  const modal = page.locator('.el-drawer, .el-dialog').first()
  await step('02-新增', async () => {
    await page.getByRole('button', { name: ADD, exact: true }).first().click({ timeout: 8000 })
    await modal.waitFor({ state: 'visible', timeout: 15000 })
  })

  // ---- 3. 二级弹窗（如「引入」） ----
  if (SECOND) {
    await step('03-二级弹窗', async () => {
      const scope = page.locator('.el-drawer:visible, .el-dialog:visible').last()
      await scope.getByRole('button', { name: SECOND, exact: true }).first().click({ timeout: 8000 })
      await page.locator('.el-dialog:visible').last().waitFor({ state: 'visible', timeout: 15000 })
    })
  }

  // ---- 4. 场景页 / 其他页签：按需继续补 ----
  // await step('04-场景页', async () => {
  //   await page.getByRole('button', { name: '保存', exact: true }).click()
  //   await page.waitForURL(/cstMgt\/.*scene/, { timeout: 15000 })
  // })

  await writeIndex(OUT, results, { task: TASK })

  const hard = results.reduce((n, r) => n + r.issues.hard.length, 0)
  const soft = results.reduce((n, r) => n + r.issues.soft.length, 0)
  log('状态 ' + results.length + ' 个　硬失败 ' + hard + '　软告警 ' + soft)
  if (errors.length) log('页面异常 ' + errors.length + ' 个（首个：' + errors[0].slice(0, 120) + '）')
  results.forEach((r) => {
    log(r.name + '：字段 ' + r.inv.stats.fields + '　coverage ' + r.inv.stats.coverage +
      '　wireBad ' + r.inv.stats.wireBad + '　漏 ' + r.L1.missing.length +
      '　L2硬 ' + r.L2.hard.length + '　→ ' + r.files.html)
  })
  log('汇总页：' + path.join(OUT, 'index.html'))

  await context.close()
  await browser.close()
  process.exit(hard ? 1 : 0)
})().catch((e) => {
  console.error('PROBE ERROR:', e && e.stack || e)
  process.exit(2)
})
