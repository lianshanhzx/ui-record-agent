#!/usr/bin/env node
/**
 * scan-probe.js — 真实页面扫描验证库（配合 page-scanner.js 使用）
 *
 * 设计目标：把「JSON 和页面逐条对比」变成「看一张标注图 + 一张表」。
 *   - capture(page, name)  ：扫当前状态 → L1 对拍 / L2 定位回代 / L3 抽样填充
 *                            → 截图并在页面上画框编号（编号 = 表格 seq）
 *                            → 落盘 inventory.json / .md / .html / .annotated.png
 *   - writeIndex(dir, list) ：把多个状态汇总成一个 index.html
 *
 * 用法 A（单页 CLI）：见 scan-verify.js
 * 用法 B（探路脚本里逐状态调用，推荐）：
 *
 *   const { capture, writeIndex } = require(path.resolve(process.cwd(), 'tools/page-scanner/lib/scan-probe'))
 *   const page = await ctx.newPage()
 *   await page.goto(URL)
 *
 *   await capture(page, '01-列表', { outDir: 'work/<task>/scans' })
 *   await page.getByRole('button', { name: '新增' }).click()
 *   await capture(page, '02-新增抽屉', { outDir: 'work/<task>/scans' })
 *   await writeIndex('work/<task>/scans', null, { task: '<task>' })
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveScanner } = require('./resolve-scanner')

const RECT_BASE = { width: 1440, height: 900 }

// 运行时脚本在技能目录，按路径引用（单真源，不复制）
let cachedScanner = { path: '', src: '' }
function scannerSource(scannerPath) {
  const p = resolveScanner(scannerPath)
  if (cachedScanner.path !== p) {
    cachedScanner = { path: p, src: fs.readFileSync(p, 'utf8') }
  }
  return cachedScanner.src
}

function norm(s) { return String(s == null ? '' : s).replace(/[*\s]/g, '').trim() }

function multisetDiff(a, b) {
  const count = {}
  b.forEach((x) => { count[x] = (count[x] || 0) + 1 })
  const onlyA = []
  a.forEach((x) => {
    if (count[x]) count[x]--
    else onlyA.push(x)
  })
  return onlyA
}

async function init(page, scannerPath) {
  if (page.__scanInited) return
  await page.addScriptTag({ content: scannerSource(scannerPath) })
  page.__scanInited = true
}

// ======================= 三层验证 =======================

/** L1：与 Playwright 独立枚举的 .el-form-item 标签对拍。 */
async function verifyCompleteness(page, inv) {
  const domLabels = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('.el-form-item').forEach((fi) => {
      if (!fi.getClientRects().length) return
      const label = fi.querySelector('.el-form-item__label, label')
      if (!label) return
      const text = (label.innerText || '').replace(/[*\s]/g, '').trim()
      if (text) out.push(text)
    })
    return out
  })
  const scanFields = inv.fields.filter((f) =>
    f.controlType !== 'button' && f.controlType !== 'link' && !f.inShadow && !f.inIframe)
  const missing = multisetDiff(domLabels, scanFields.map((f) => f.label))
  const extra = multisetDiff(scanFields.map((f) => f.label), domLabels)
  return { domFormItems: domLabels.length, scanFormItems: scanFields.length, missing, extra }
}

/** L2：每条 wireXPath 回代求值，核对命中数与落点（标签 + 位置）。 */
async function verifyLocators(page, inv) {
  const targets = inv.fields.filter((f) => f.wireXPath && f.action !== 'skip')
  const resolved = await page.evaluate((list) => list.map((item) => {
    let res
    try {
      res = document.evaluate(item.xp, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
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
      label: String(labelEl ? labelEl.innerText : (el.innerText || '')).replace(/[*\s]/g, '').trim(),
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      rect: { x: box.left, y: box.top }
    }
  }), targets.map((f) => ({ xp: f.wireXPath })))

  const hard = []
  const soft = []
  targets.forEach((f, i) => {
    const r = resolved[i] || {}
    if (r.error) { soft.push(f.label + '：XPath 非法 ' + r.error); return }
    if (r.count !== f.wireCount) {
      hard.push(f.label + '：命中数不一致（扫描 ' + f.wireCount + '，回代 ' + r.count + '）')
      return
    }
    if (r.count === 0) { hard.push(f.label + '：回代命中 0，定位失效'); return }
    if (r.count > 1) { soft.push(f.label + '：命中 ' + r.count + '，回放会取第一个（歧义）'); return }
    const semantic = (f.controlType === 'button' || f.controlType === 'link') ? r.text : r.label
    if (semantic !== f.label) { hard.push(f.label + '：定位到了「' + semantic + '」'); return }
    if (f.rect) {
      const dx = Math.abs(r.rect.x - f.rect.x)
      const dy = Math.abs(r.rect.y - f.rect.y)
      if (dx > 2 || dy > 2) soft.push(f.label + '：位置偏差 dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1))
    }
  })
  return { checked: targets.length, hard, soft }
}

/** L3：抽样真实 fill + 读回，验证定位到的是可操作控件。 */
async function sampleFill(page, inv, n) {
  const out = []
  if (!n) return out
  const samples = inv.fields.filter((f) =>
    f.action === 'input' && f.wireCount === 1 &&
    (f.controlType === 'input' || f.controlType === 'number' || f.controlType === 'textarea')
  ).slice(0, n)
  for (const f of samples) {
    const loc = page.locator('xpath=' + f.wireXPath).first()
    let before = ''
    try { before = await loc.inputValue() } catch (e) {}
    try {
      await loc.fill('SCAN-VERIFY', { timeout: 5000 })
      const got = await loc.inputValue()
      out.push({ label: f.label, ok: got === 'SCAN-VERIFY', got: got })
      await loc.fill(before)
    } catch (e) {
      out.push({ label: f.label, ok: false, error: String(e.message || e).slice(0, 120) })
    }
  }
  return out
}

// ======================= 标注截图 =======================

/**
 * 在页面上按字段 rect 画框 + 编号（编号 = 表格 seq），截当前视口图后移除。
 *
 * 为什么用「视口 + fixed」而不是「整页 + 文档坐标」：
 *   本平台的页面多是内部容器滚动（.el-main / .el-scrollbar__wrap），window.scrollY 恒为 0，
 *   整页截图会把视口外字段画到图外，且内部滚动量无法换算。
 *   视口截图 + position:fixed 直接使用 getBoundingClientRect 坐标，无换算误差。
 *
 * @returns {{annotated:number, offViewport:number}}
 */
async function annotate(page, inv, file) {
  const vp = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const all = inv.fields.filter((f) => f.rect)
  const items = all.filter((f) =>
    f.rect.y < vp.h && f.rect.y + f.rect.h > 0 && f.rect.x < vp.w && f.rect.x + f.rect.w > 0)
    .map((f) => ({
      seq: f.seq,
      label: f.label,
      skip: f.action === 'skip',
      review: f.needsReview === true,
      x: f.rect.x,
      y: f.rect.y,
      w: f.rect.w,
      h: f.rect.h
    }))

  await page.evaluate((list) => {
    const old = document.getElementById('__scan_annot__')
    if (old) old.remove()
    const layer = document.createElement('div')
    layer.id = '__scan_annot__'
    layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647;pointer-events:none'
    document.documentElement.appendChild(layer)
    list.forEach((it) => {
      const color = it.review ? '#e6a23c' : (it.skip ? '#909399' : '#f56c6c')
      const box = document.createElement('div')
      box.style.cssText = 'position:fixed;box-sizing:border-box;border:1px solid ' + color +
        ';background:' + (it.skip ? 'rgba(144,147,153,.06)' : 'rgba(245,108,108,.06)')
      box.style.left = it.x + 'px'
      box.style.top = it.y + 'px'
      box.style.width = it.w + 'px'
      box.style.height = it.h + 'px'
      const tag = document.createElement('span')
      tag.textContent = it.seq
      tag.style.cssText = 'position:absolute;left:-1px;top:-15px;font:11px/14px monospace;padding:0 3px;' +
        'border-radius:2px;background:' + color + ';color:#fff'
      box.appendChild(tag)
      layer.appendChild(box)
    })
  }, items)

  await page.screenshot({ path: file, fullPage: false })
  await page.evaluate(() => {
    const layer = document.getElementById('__scan_annot__')
    if (layer) layer.remove()
  })
  return { annotated: items.length, offViewport: all.length - items.length }
}

// ======================= 报告 =======================

function statusOf(f, issues) {
  if (f.action === 'skip') return '跳过'
  if (f.reviewReasons && f.reviewReasons.length) return f.reviewReasons.join(',')
  if (issues && issues.hard && issues.hard.some((x) => x.indexOf(f.label + '：') === 0)) return '定位失败'
  return 'ok'
}

function toMarkdown(inv, issues) {
  const lines = []
  lines.push('# 扫描盘点：' + (inv.pageName || inv.title))
  lines.push('')
  lines.push('- 路由：`' + inv.route + '`')
  lines.push('- 范围：' + inv.scope + (inv.scopeTitle ? '（' + inv.scopeTitle + '）' : ''))
  lines.push('- 字段 ' + inv.stats.fields + ' / 表单项 ' + inv.stats.formItems + ' / coverage ' + inv.stats.coverage)
  lines.push('- wireBad ' + inv.stats.wireBad + ' / needsReview ' + inv.stats.needsReview + ' / 耗时 ' + inv.elapsedMs + 'ms')
  lines.push('')
  lines.push('| # | 组 | 字段 | 类型 | 动作 | 必填 | 选项 | wireCount | 状态 |')
  lines.push('|---|---|---|---|---|---|---|---|---|')
  inv.fields.forEach((f) => {
    lines.push('| ' + [
      f.seq, f.group, f.label, f.controlType, f.action,
      f.required ? '是' : '',
      f.options && f.options.length ? f.options.join('/') : '',
      f.wireCount, statusOf(f, issues)
    ].join(' | ') + ' |')
  })
  if (inv.tables.length) {
    lines.push('')
    lines.push('## 表格')
    inv.tables.forEach((t) => {
      lines.push('- 表头：' + t.headers.join(' / '))
      lines.push('- 行数：' + t.rowCount + '　行操作：' + (t.rowActions.join(' / ') || '-'))
      if (t.rows[0]) lines.push('- 首行：' + t.rows[0].join(' / '))
    })
  }
  return lines.join('\n') + '\n'
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function toHtml(name, inv, result, shotRel, shotInfo) {
  const hard = result.issues.hard
  const soft = result.issues.soft
  const shotTip = shotInfo
    ? '标注图覆盖 ' + shotInfo.annotated + ' 个字段' +
      (shotInfo.offViewport ? '，另有 <b>' + shotInfo.offViewport + '</b> 个在视口外未标注' : '')
    : '未生成标注图'
  const rows = inv.fields.map((f) => {
    const st = statusOf(f, result.issues)
    const cls = st === 'ok' ? '' : (st === '跳过' ? 'skip' : 'warn')
    return '<tr class="' + cls + '"><td>' + f.seq + '</td><td>' + esc(f.group) + '</td><td>' + esc(f.label) +
      '</td><td>' + esc(f.controlType) + '</td><td>' + esc(f.action) + '</td><td>' + (f.required ? '是' : '') +
      '</td><td>' + esc((f.options || []).join('/')) + '</td><td>' + f.wireCount + '</td><td>' + esc(st) + '</td></tr>'
  }).join('\n')

  const issueHtml = (hard.length || soft.length)
    ? '<div class="issues"><b>硬失败 ' + hard.length + '</b><ul>' + hard.map((x) => '<li>✗ ' + esc(x) + '</li>').join('') +
      '</ul><b>软告警 ' + soft.length + '</b><ul>' + soft.map((x) => '<li>! ' + esc(x) + '</li>').join('') + '</ul></div>'
    : '<div class="issues ok">无硬失败、无软告警</div>'

  return '<!doctype html><meta charset="utf-8"><title>扫描核对 - ' + esc(name) + '</title>' +
    '<style>body{font:13px/1.6 system-ui,sans-serif;margin:16px;color:#222}' +
    'h1{font-size:18px;margin:0 0 4px}.meta{color:#666;margin-bottom:10px}' +
    '.card{background:#f6f7f9;border:1px solid #e4e6eb;border-radius:6px;padding:8px 12px;margin-bottom:12px}' +
    '.issues ul{margin:4px 0 8px 18px;padding:0}.issues li{color:#c0392b}.issues.ok{color:#1e8e3e}' +
    'img{max-width:100%;border:1px solid #ddd;border-radius:4px;display:block;margin-bottom:12px}' +
    'table{border-collapse:collapse;width:100%;font-size:12px}' +
    'th,td{border:1px solid #e0e0e0;padding:3px 6px;text-align:left}' +
    'th{background:#fafafa;position:sticky;top:0}' +
    'tr.skip td{color:#909399}tr.warn td{background:#fff8e6}' +
    '.tip{color:#666;margin:10px 0}</style>' +
    '<h1>扫描核对：' + esc(name) + '</h1>' +
    '<div class="meta">' + esc(inv.pageName || inv.title) + '　' + esc(inv.route) + '</div>' +
    '<div class="card">字段 ' + inv.stats.fields + '　表单项 ' + inv.stats.formItems + '　coverage ' + inv.stats.coverage +
    '　wireBad ' + inv.stats.wireBad + '　needsReview ' + inv.stats.needsReview +
    '　L1 漏 ' + result.L1.missing.length + ' / 多 ' + result.L1.extra.length +
    '　耗时 ' + inv.elapsedMs + 'ms</div>' + issueHtml +
    '<div class="tip">图上编号 = 下表 <b>#</b>：有个框没编号说明扫到了不该扫的；页面上有字段却没有框 → 漏扫；' +
    '框是灰色 = skip，橙色 = 需复核。' + shotTip + '</div>' +
    '<img src="' + shotRel + '" alt="annotated">' +
    '<table><thead><tr><th>#</th><th>组</th><th>字段</th><th>类型</th><th>动作</th><th>必填</th><th>选项</th><th>wireCount</th><th>状态</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>'
}

// ======================= 对外入口 =======================

/**
 * 扫描 + 验证 + 出报告（一个 UI 状态调用一次）
 * @param {import('playwright').Page} page
 * @param {string} name 状态名，如 '01-列表'、'02-引入弹窗'
 * @param {object} [opts]
 * @param {string} [opts.outDir='work/scans'] 输出目录
 * @param {object} [opts.scan] 传给 PageScanner.scan 的选项（默认 {scope:'page'}）
 * @param {number} [opts.fill=0] 抽样填充条数
 * @param {boolean} [opts.annotate=true] 是否出标注截图
 * @param {string} [opts.scannerPath] 显式指定 page-scanner.js（默认自动定位）
 */
async function capture(page, name, opts) {
  opts = opts || {}
  const outDir = opts.outDir || path.join('work', 'scans')
  const fillN = typeof opts.fill === 'number' ? opts.fill : 0
  const doAnnotate = opts.annotate !== false
  fs.mkdirSync(outDir, { recursive: true })

  await init(page, opts.scannerPath)
  const inv = await page.evaluate((o) => PageScanner.scan(o), opts.scan || { scope: 'page' })

  const L1 = await verifyCompleteness(page, inv)
  const L2 = await verifyLocators(page, inv)
  const L3 = await sampleFill(page, inv, fillN)

  const issues = { hard: [], soft: [] }
  L1.missing.forEach((l) => issues.hard.push('L1 漏字段：' + l))
  L1.extra.forEach((l) => issues.hard.push('L1 多余字段：' + l))
  L2.hard.forEach((x) => issues.hard.push('L2 ' + x))
  L2.soft.forEach((x) => issues.soft.push('L2 ' + x))
  L3.filter((f) => !f.ok).forEach((f) => issues.hard.push('L3 填充失败：' + f.label + (f.error ? ' ' + f.error : '')))

  const base = path.join(outDir, name)
  let shotFile = ''
  let shotInfo = null
  if (doAnnotate) {
    shotFile = base + '.annotated.png'
    try {
      shotInfo = await annotate(page, inv, shotFile)
      if (shotInfo.offViewport > 0) {
        issues.soft.push('有 ' + shotInfo.offViewport + ' 个字段在当前视口之外，未进标注图（滚动后对该区域再 capture 一次）')
      }
    } catch (e) {
      issues.soft.push('标注截图失败：' + String(e.message || e))
      shotFile = ''
    }
  }

  fs.writeFileSync(base + '.inventory.json', JSON.stringify(inv, null, 1), 'utf8')
  fs.writeFileSync(base + '.md', toMarkdown(inv, issues), 'utf8')

  const result = { name, inv, L1, L2, L3, issues, shot: shotInfo }
  const shotRel = shotFile ? path.basename(shotFile) : ''
  fs.writeFileSync(base + '.html', toHtml(name, inv, result, shotRel, shotInfo), 'utf8')
  fs.writeFileSync(base + '.verify.json', JSON.stringify({
    name: name,
    url: inv.url,
    route: inv.route,
    scannedAt: new Date(inv.scannedAt).toISOString(),
    stats: inv.stats,
    L1: L1,
    L2: L2,
    L3: L3,
    issues: issues
  }, null, 1), 'utf8')

  result.files = { base: base, html: base + '.html', md: base + '.md', shot: shotFile }
  console.log('[scan] ' + name + '  字段 ' + inv.stats.fields + '  漏 ' + L1.missing.length +
    '  多 ' + L1.extra.length + '  L2硬 ' + L2.hard.length + '  L2软 ' + L2.soft.length +
    (fillN ? '  L3 ' + L3.filter((f) => f.ok).length + '/' + L3.length : '') +
    '  → ' + path.basename(base) + '.html')
  return result
}

/** 多状态汇总页。list 省略时扫描 outDir 下已有的 *.verify.json。 */
function writeIndex(outDir, list, meta) {
  outDir = outDir || path.join('work', 'scans')
  let results = list
  if (!results) {
    results = []
    if (fs.existsSync(outDir)) {
      fs.readdirSync(outDir).filter((f) => /\.verify\.json$/.test(f)).forEach((f) => {
        try {
          const j = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'))
          results.push({ name: j.name, inv: { stats: j.stats }, L1: j.L1, L2: j.L2, issues: j.issues, files: { html: path.join(outDir, j.name + '.html') } })
        } catch (e) {}
      })
    }
  }
  results = (results || []).slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))

  const rows = results.map((r) => {
    const hard = (r.issues && r.issues.hard || []).length
    const soft = (r.issues && r.issues.soft || []).length
    const s = r.inv && r.inv.stats ? r.inv.stats : {}
    return '<tr><td><a href="' + esc(path.basename(r.files.html)) + '">' + esc(r.name) + '</a></td>' +
      '<td>' + (s.fields || '') + '</td><td>' + (s.coverage != null ? s.coverage : '') + '</td>' +
      '<td>' + (s.wireBad != null ? s.wireBad : '') + '</td>' +
      '<td class="' + (hard ? 'bad' : 'ok') + '">' + hard + '</td>' +
      '<td class="' + (soft ? 'warn' : 'ok') + '">' + soft + '</td></tr>'
  }).join('\n')

  const totalHard = results.reduce((n, r) => n + ((r.issues && r.issues.hard || []).length), 0)
  const html = '<!doctype html><meta charset="utf-8"><title>扫描核对汇总</title>' +
    '<style>body{font:13px/1.6 system-ui,sans-serif;margin:16px}table{border-collapse:collapse}' +
    'th,td{border:1px solid #e0e0e0;padding:4px 10px}th{background:#fafafa}' +
    '.ok{color:#1e8e3e}.bad{color:#c0392b;font-weight:700}.warn{color:#b8860b}</style>' +
    '<h1>扫描核对汇总' + (meta && meta.task ? '：' + esc(meta.task) : '') + '</h1>' +
    '<p>共 ' + results.length + ' 个状态，硬失败合计 <b class="' + (totalHard ? 'bad' : 'ok') + '">' + totalHard + '</b></p>' +
    '<table><thead><tr><th>状态</th><th>字段</th><th>coverage</th><th>wireBad</th><th>硬失败</th><th>软告警</th></tr></thead><tbody>' +
    rows + '</tbody></table>'

  const file = path.join(outDir, 'index.html')
  fs.writeFileSync(file, html, 'utf8')
  console.log('[scan] 汇总 → ' + file)
  return file
}

module.exports = {
  resolveScanner: resolveScanner,
  scannerSource: scannerSource,
  init: init,
  capture: capture,
  writeIndex: writeIndex,
  verifyCompleteness: verifyCompleteness,
  verifyLocators: verifyLocators,
  sampleFill: sampleFill,
  annotate: annotate,
  RECT_BASE: RECT_BASE
}
