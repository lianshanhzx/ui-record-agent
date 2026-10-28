#!/usr/bin/env node
/**
 * scan-selftest.js — page-scanner.js 的自测（不需要登录、不依赖平台环境）
 *
 * 用法：
 *   node tools/page-scanner/test/selftest.js
 *   node tools/page-scanner/test/selftest.js --headed
 *
 * 覆盖两件事：
 *   1. 语义断言：类型/必填/选项/行内按钮/表格/排除规则/弹窗作用域
 *   2. 定位回代：每条 wireXPath 回到页面求值，必须命中元素且「标签 + 位置」与扫描记录一致
 */
'use strict'

const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')
const { resolveScanner } = require('../lib/resolve-scanner')

// 运行时脚本在技能目录，本次测试按路径引用（--scanner 可覆盖）
const SCANNER_ARG = process.argv.indexOf('--scanner')
const SCANNER = resolveScanner(SCANNER_ARG > -1 ? process.argv[SCANNER_ARG + 1] : '')
const FIXTURES = path.join(__dirname, 'fixtures')
const HEADED = process.argv.includes('--headed')
const REPORT_INDEX = process.argv.indexOf('--report')
const REPORT_PATH = REPORT_INDEX > -1 ? process.argv[REPORT_INDEX + 1] : ''

// 同时写一份 UTF-8 报告，规避 Windows 控制台编码问题
const lines = []
const consoleLog = console.log.bind(console)
console.log = function () {
  const s = Array.prototype.map.call(arguments, String).join(' ')
  lines.push(s)
  consoleLog(s)
}

let pass = 0
const failures = []

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); return }
  failures.push({ name, detail: detail || '' })
  console.log('  ✗ ' + name + (detail ? '  → ' + detail : ''))
}

function eq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected),
    'actual=' + JSON.stringify(actual) + ' expected=' + JSON.stringify(expected))
}

function fileUrl(name) {
  return 'file:///' + path.join(FIXTURES, name).replace(/\\/g, '/')
}

async function openPage(browser, name) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(fileUrl(name), { waitUntil: 'load' })
  await page.addScriptTag({ content: require('fs').readFileSync(SCANNER, 'utf8') })
  return { page, errors }
}

function byLabel(inv) {
  const map = {}
  inv.fields.forEach((f) => { map[f.label] = f })
  return map
}

/**
 * 定位回代：把 wireXPath 放回页面求值，核对「命中数 / 标签 / 位置」。
 * 这是判断“扫出来的 XPath 到底是不是指向同一个元素”的硬标准。
 */
async function roundtrip(page, fields) {
  const problems = []
  for (const f of fields) {
    if (!f.wireXPath || f.action === 'skip') continue
    const r = await page.evaluate((xp) => {
      let res
      try {
        res = document.evaluate(xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
      } catch (e) {
        return { error: String(e) }
      }
      if (res.snapshotLength !== 1) return { count: res.snapshotLength }
      const el = res.snapshotItem(0)
      const fi = el.closest && el.closest('.el-form-item')
      const labelEl = fi && fi.querySelector('.el-form-item__label, label')
      const box = fi ? fi.getBoundingClientRect() : el.getBoundingClientRect()
      return {
        count: 1,
        label: (labelEl ? labelEl.innerText : el.innerText || '').replace(/[*\s]/g, ''),
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        rect: { x: box.left, y: box.top, w: box.width, h: box.height }
      }
    }, f.wireXPath)

    if (r.error) { problems.push(`${f.label}: XPath 非法 ${r.error}`); continue }
    if (r.count !== f.wireCount) {
      problems.push(`${f.label}: 回代命中 ${r.count}，扫描时记录 ${f.wireCount}`)
      continue
    }
    if (r.count !== 1) continue // 歧义项由 needsReview 负责，不算回代失败
    const semantic = f.controlType === 'button' || f.controlType === 'link' ? r.text : r.label
    if (semantic !== f.label) {
      problems.push(`${f.label}: XPath 落到了「${semantic}」`)
      continue
    }
    if (f.rect) {
      const dy = Math.abs(r.rect.y - f.rect.y)
      const dx = Math.abs(r.rect.x - f.rect.x)
      if (dx > 2 || dy > 2) problems.push(`${f.label}: 位置偏差 dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`)
    }
  }
  return problems
}

async function testBasePage(browser) {
  console.log('\n[1] scan-fixture.html  scope=page')
  const { page, errors } = await openPage(browser, 'scan-fixture.html')
  const inv = await page.evaluate(() => PageScanner.scan({ scope: 'page' }))
  const map = byLabel(inv)
  const labels = inv.fields.map((f) => f.label).sort()

  check('无 pageerror', errors.length === 0, errors.join('; '))
  check('字段数=8', inv.fields.length === 8, 'fields=' + inv.fields.length)
  ;['客户名称', '客户等级', '是否有效', '所属机构', '行业代码', '客户类型', '是否禁用', '阴影输入']
    .forEach((name) => check('包含字段 ' + name, !!map[name]))
  check('coverage=1', inv.stats.coverage === 1, 'coverage=' + inv.stats.coverage)

  // 语义
  check('必填识别（客户名称）', map['客户名称'] && map['客户名称'].required === true)
  check('非必填（客户类型）', map['客户类型'] && map['客户类型'].required === false)
  eq('类型-客户名称', map['客户名称'] && map['客户名称'].controlType, 'input')
  eq('类型-客户等级', map['客户等级'] && map['客户等级'].controlType, 'radio')
  eq('类型-是否有效', map['是否有效'] && map['是否有效'].controlType, 'switch')
  eq('类型-所属机构', map['所属机构'] && map['所属机构'].controlType, 'select')
  eq('类型-行业代码', map['行业代码'] && map['行业代码'].controlType, 'button-group')
  eq('类型-客户类型', map['客户类型'] && map['客户类型'].controlType, 'readonly')
  eq('选项-所属机构', map['所属机构'] && map['所属机构'].options, ['总行', '分行', '支行'])
  eq('选项-客户等级', map['客户等级'] && map['客户等级'].options, ['一级', '二级'])
  eq('行内按钮-行业代码', map['行业代码'] && map['行业代码'].inlineButtons, ['选择'])
  check('行业代码 wireCount=1', map['行业代码'] && map['行业代码'].wireCount === 1)
  check('禁用字段 action=skip', map['是否禁用'] && map['是否禁用'].action === 'skip' &&
    map['是否禁用'].actionable === false)
  check('只读字段 action=skip', map['客户类型'] && map['客户类型'].action === 'skip')
  check('单选组标记歧义', map['客户等级'] &&
    map['客户等级'].wireCount === 2 &&
    map['客户等级'].reviewReasons.indexOf('WIRE_XPATH_AMBIGUOUS') !== -1)
  check('单选组给出选项模板', map['客户等级'] &&
    String(map['客户等级'].wireOptionTemplate).indexOf('{option}') !== -1)

  // shadow / 排除
  check('shadow 字段被标记', map['阴影输入'] &&
    map['阴影输入'].inShadow === true &&
    map['阴影输入'].reviewReasons.indexOf('SHADOW_UNSUPPORTED') !== -1)
  check('第三方浮窗被排除', !map['扩展按钮'], '仍扫到 扩展按钮')
  check('表格内控件被排除', !map['表格内输入'], '仍扫到 表格内输入')
  check('排除计数 > 0', inv.stats.excluded > 0, 'excluded=' + inv.stats.excluded)

  // 表格
  check('表格摘要 1 张', inv.tables.length === 1)
  if (inv.tables[0]) {
    eq('表头', inv.tables[0].headers, ['客户编号', '客户名称', '操作'])
    check('行数=2', inv.tables[0].rowCount === 2, 'rowCount=' + inv.tables[0].rowCount)
    eq('首行', inv.tables[0].rows[0], ['C0001', '甲公司', '查看修改'])
    check('行单选识别', inv.tables[0].hasRowRadio === true)
    check('行操作识别', JSON.stringify(inv.tables[0].rowActions) === JSON.stringify(['查看', '修改']),
      JSON.stringify(inv.tables[0].rowActions))
  }

  // 顺序
  check('视觉顺序（客户名称在客户等级前）', map['客户名称'].seq < map['客户等级'].seq)

  // 定位回代
  const problems = await roundtrip(page, inv.fields)
  check('wireXPath 回代全部一致', problems.length === 0, problems.join(' | '))

  await page.context().close()
  return inv
}

async function testModalPage(browser) {
  console.log('\n[2] scan-modal-fixture.html  弹窗作用域 + 同名标签')
  const { page, errors } = await openPage(browser, 'scan-modal-fixture.html')

  const modalInv = await page.evaluate(() => PageScanner.scan({ scope: 'modal' }))
  check('无 pageerror', errors.length === 0, errors.join('; '))
  const modalLabels = modalInv.fields.map((f) => f.label).sort()
  eq('modal 只扫弹窗内容（字段+按钮）', modalLabels, ['客户名称', '手机号', '确定'])
  eq('modal scopeTitle', modalInv.scopeTitle, '客户信息')
  check('modal 字段都带 el-dialog 前缀',
    modalInv.fields.every((f) => f.wireXPath.indexOf("//div[contains(@class,'el-dialog')]") === 0),
    modalInv.fields.map((f) => f.wireXPath).join(' | '))
  check('modal 全部 wireCount=1', modalInv.fields.every((f) => f.wireCount === 1))
  const modalProblems = await roundtrip(page, modalInv.fields)
  check('modal 回代一致', modalProblems.length === 0, modalProblems.join(' | '))

  const pageInv = await page.evaluate(() => PageScanner.scan({ scope: 'page' }))
  const pageLabels = pageInv.fields.map((f) => f.label).sort()
  eq('page 扫到 4 条（含弹窗按钮）', pageLabels, ['客户名称', '客户名称', '手机号', '确定'])
  const pageLevel = pageInv.fields.filter((f) => !f.inDialog)
  const dialogForms = pageInv.fields.filter((f) => f.inDialog && f.controlType !== 'button')
  check('页面层同名字段被标歧义', pageLevel.length === 1 &&
    pageLevel[0].reviewReasons.indexOf('WIRE_XPATH_AMBIGUOUS') !== -1,
    JSON.stringify(pageLevel.map((f) => f.reviewReasons)))
  check('弹窗层同名字段仍唯一（作用域生效）', dialogForms.length === 2 &&
    dialogForms.every((f) => f.wireCount === 1),
    JSON.stringify(dialogForms.map((f) => [f.label, f.wireCount])))

  await page.context().close()
}

;(async () => {
  const browser = await chromium.launch({ headless: !HEADED })
  try {
    await testBasePage(browser)
    await testModalPage(browser)
  } finally {
    await browser.close()
  }

  console.log('\n========================================')
  console.log('PASS ' + pass + '   FAIL ' + failures.length)
  if (failures.length) {
    failures.forEach((f) => console.log('  ✗ ' + f.name + (f.detail ? ' → ' + f.detail : '')))
  } else {
    console.log('全部通过')
  }
  if (REPORT_PATH) {
    fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8')
    console.log('报告已写入 ' + REPORT_PATH)
  }
  if (failures.length) process.exit(1)
})().catch((e) => {
  console.error('\nSELFTEST ERROR:', e && e.stack || e)
  process.exit(2)
})
