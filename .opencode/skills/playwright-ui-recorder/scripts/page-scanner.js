/*!
 * page-scanner.js — ui-agent1 页面盘点扫描器
 * ---------------------------------------------------------------------------
 * 独立维护，只服务本项目的「agent + Playwright 录制」链路：
 *   探路(probe) → 字段盘点(与 inspectPage 交叉校验) → filllog 的 xpathCount/xpathCandidates
 * 早期规则借鉴了另一个扩展项目，但本文件不与任何外部项目保持同步。
 *
 * 特点：
 *   - 单文件、无依赖、不使用 chrome.* API，可直接 addScriptTag / evaluate 注入
 *   - 不自动运行、不自动下载：由调用方显式 PageScanner.scan()
 *   - 一个 UI 状态扫一次；输出「字段清单 + 表格摘要 + wire 定位候选」
 *   - 定位遵循 reference/robust-locators.md：标签锚定、select 点容器、弹窗加作用域前缀
 *
 * 用法（Playwright）：
 *   await page.addScriptTag({ content: fs.readFileSync(SCANNER, 'utf8') })
 *   const inv = await page.evaluate(() => PageScanner.scan())
 *   const inv2 = await page.evaluate(() => PageScanner.run())     // 等 DOM 稳定再扫
 */
;(function (global) {
  'use strict'

  var VERSION = '2.1.0'
  var SCHEMA = 'ui-agent1.scan-inventory'
  var SCHEMA_VERSION = 1
  // 与 tests/<module>/fillEngine.ts 的 norm() 一致：视口基线 1440x900
  var RECT_BASE = { width: 1440, height: 900 }
  // 空格 / 不换行空格 / 全角空格
  var SPACES = ' \u00a0\u3000'

  var DEFAULTS = {
    format: 'inventory',     // inventory | full（full 额外带 chain / css / attributes）
    scope: 'modal',          // modal：页面有弹窗时只扫弹窗；page：整页都扫
    visibility: 'strict',    // strict | loose | none
    includeTables: true,
    tableRowLimit: 3,
    includeButtons: true,
    wireCandidateLimit: 3,
    maxFields: 800,
    maxWarnings: 200,
    excludedSelectors: [
      '#kiss-translator-fab',
      '#__ty_collect_overlay__',
      '#__record_tools_scan_overlay__',
      '.el-pagination', '.el-pager', '.ant-pagination', '.ivu-page', '.pagination'
    ],
    excludedKeywords: []
  }

  // ======================= 基础工具 =======================

  function resolveConfig(options) {
    var cfg = {}
    Object.keys(DEFAULTS).forEach(function (k) {
      cfg[k] = Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k]
    })
    var globalCfg = (typeof window !== 'undefined' && window.PAGE_SCANNER_CONFIG) || {}
    ;[globalCfg, options || {}].forEach(function (src) {
      Object.keys(src).forEach(function (k) { if (src[k] !== undefined) cfg[k] = src[k] })
    })
    // 兼容旧习惯写法
    if (options && options.scanOpenModalOnly === false) cfg.scope = 'page'
    if (options && options.visibilityMode) cfg.visibility = options.visibilityMode
    if (!Array.isArray(cfg.excludedSelectors)) cfg.excludedSelectors = []
    return cfg
  }

  /** XPath 1.0 字符串字面量。 */
  function q(value) {
    var s = String(value == null ? '' : value)
    if (s.indexOf("'") === -1) return "'" + s + "'"
    if (s.indexOf('"') === -1) return '"' + s + '"'
    var dq = '"' + "'" + '"'
    return 'concat(' + s.split("'").map(function (p) { return "'" + p + "'" }).join(', ' + dq + ', ') + ')'
  }

  function txt(el) {
    if (!el) return ''
    return String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  }

  function firstLine(el) {
    if (!el) return ''
    var raw = String(el.innerText || el.textContent || '')
    var line = raw.split('\n')[0] || ''
    return line.replace(/\s+/g, ' ').trim()
  }

  /** 与 fillEngine.inspectPage 一致：去掉必填星号与所有空白。 */
  function normLabel(value) {
    return String(value == null ? '' : value).replace(/[*\s]/g, '').trim()
  }

  function round3(n) { return Math.round(Number(n) * 1000) / 1000 }

  function hashKey(str) {
    var h = 0x811c9dc5
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = (h * 0x01000193) >>> 0
    }
    return ('00000000' + h.toString(16)).slice(-8)
  }

  function isVisible(el, mode) {
    if (!el || el.nodeType !== 1 || !el.getBoundingClientRect) return false
    if (el.isConnected === false) return false
    var box
    try { box = el.getBoundingClientRect() } catch (e) { return false }
    if (!box || (!box.width && !box.height)) return false
    var st
    try { st = getComputedStyle(el) } catch (e) { return true }
    if (st.display === 'none' || st.visibility === 'hidden' || st.visibility === 'collapse') return false
    if (mode !== 'loose' && mode !== 'none' && parseFloat(st.opacity) === 0) return false
    return true
  }

  function evalCount(doc, xpath) {
    if (!xpath) return { count: 0, visibleCount: 0 }
    try {
      var res = doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
      var visible = 0
      for (var i = 0; i < res.snapshotLength; i++) {
        if (isVisible(res.snapshotItem(i), 'loose')) visible++
      }
      return { count: res.snapshotLength, visibleCount: visible }
    } catch (e) {
      return { count: -1, visibleCount: -1 }
    }
  }

  function isStableClass(name) {
    if (!name || name.length < 2) return false
    if (/^data-v-/.test(name)) return false
    if (/^(is-|has-|active$|disabled$|selected$|focus$|hover$)/i.test(name)) return false
    if (/^el-/.test(name)) return false
    if (/^tssc/.test(name)) return false
    if (/^\d+$/.test(name)) return false
    if (/[_-]{2}[a-z0-9]{4,}$/i.test(name)) return false
    return true
  }

  function cssEscape(value) {
    try {
      if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
    } catch (e) {}
    return String(value).replace(/([^\w-])/g, '\\$1')
  }

  /** 紧凑 CSS 路径，仅用于排障，不进 wire。 */
  function cssPath(el, maxDepth) {
    if (!el || el.nodeType !== 1) return ''
    if (el.id && !/^el-id-|^tree[a-z0-9]{10,12}$/i.test(el.id)) return '#' + cssEscape(el.id)
    var parts = []
    var node = el
    var depth = 0
    var limit = maxDepth || 5
    while (node && node.nodeType === 1 && depth < limit) {
      var part = node.tagName.toLowerCase()
      var stable = []
      Array.prototype.forEach.call(node.classList || [], function (c) {
        if (stable.length < 2 && isStableClass(c)) stable.push(cssEscape(c))
      })
      if (stable.length) part += '.' + stable.join('.')
      var parent = node.parentElement
      if (parent) {
        var sameTag = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName })
        if (sameTag.length > 1) part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')'
      }
      parts.unshift(part)
      if (node.id) { parts[0] = '#' + cssEscape(node.id); break }
      node = parent
      depth++
    }
    return parts.join(' > ')
  }

  // ======================= 作用域 / 分组 =======================

  function titleFrom(el) { return el ? txt(el) : '' }

  function tabLabelOf(pane) {
    try {
      var tabs = pane.ownerDocument.querySelectorAll('.el-tabs__item, .t-tabs__nav-item')
      for (var i = 0; i < tabs.length; i++) {
        var controls = tabs[i].getAttribute('aria-controls') || tabs[i].getAttribute('id')
        if (pane.id && controls === pane.id) return txt(tabs[i])
      }
      var content = pane.parentElement
      if (content) {
        var panes = Array.prototype.filter.call(content.children, function (c) {
          return c.classList && (c.classList.contains('el-tab-pane') || c.classList.contains('t-tab-panel'))
        })
        var idx = panes.indexOf(pane)
        if (idx >= 0 && tabs[idx]) return txt(tabs[idx])
      }
    } catch (e) {}
    return '页签'
  }

  /** 判断某个祖先节点本身是否是一个「分组容器」。 */
  function containerOf(node) {
    if (!node || node.nodeType !== 1 || !node.classList) return null
    var c = node.classList
    if (c.contains('el-dialog')) return { type: 'dialog', name: titleFrom(node.querySelector('.el-dialog__title')) || '弹窗' }
    if (c.contains('el-drawer')) return { type: 'drawer', name: titleFrom(node.querySelector('.el-drawer__title, .el-drawer__header')) || '抽屉' }
    if (c.contains('el-message-box')) return { type: 'dialog', name: titleFrom(node.querySelector('.el-message-box__title')) || '确认框' }
    if (c.contains('el-popover')) return { type: 'popover', name: '浮层' }
    if (c.contains('el-tab-pane') || c.contains('t-tab-panel')) return { type: 'tab', name: tabLabelOf(node) }
    if (c.contains('el-collapse-item')) {
      return { type: 'collapse', name: titleFrom(node.querySelector('.el-collapse-item__header')) || '折叠区' }
    }
    // 本平台场景页用 [aria-expanded] 分节（对公客户概况 / 客户标签 / …）
    if (node.hasAttribute('aria-expanded') && node.querySelector('.el-form-item')) {
      var title = firstLine(node)
      if (title && title.length <= 30) return { type: 'section', name: title }
    }
    return null
  }

  /** 从元素向上收集分组链（外 → 内）。 */
  function scopeChain(el) {
    var chain = []
    var node = el
    var depth = 0
    while (node && node.nodeType === 1 && node !== document.body && depth < 40) {
      var c = containerOf(node)
      if (c) chain.push(c)
      node = node.parentElement
      depth++
    }
    return chain.reverse()
  }

  function dialogScopeOf(chain) {
    for (var i = chain.length - 1; i >= 0; i--) {
      var t = chain[i].type
      if (t === 'dialog' || t === 'drawer') {
        return { type: t, prefix: "//div[contains(@class,'el-" + t + "')]", title: chain[i].name }
      }
    }
    for (var j = chain.length - 1; j >= 0; j--) {
      if (chain[j].type === 'popover') {
        return { type: 'popover', prefix: "//div[contains(@class,'el-popover')]", title: chain[j].name }
      }
    }
    return null
  }

  function pageNameOf() {
    var selectors = ['.el-breadcrumb__item', '.breadcrumb li', '.breadcrumb-item', '.el-menu-item.is-active']
    for (var i = 0; i < selectors.length; i++) {
      var arr = Array.prototype.slice.call(document.querySelectorAll(selectors[i]))
        .map(txt).filter(Boolean)
      if (arr.length > 1) return arr.join('-')
      if (arr.length === 1) return arr[0]
    }
    return document.title || ''
  }

  // ======================= 多根（iframe / shadow） =======================

  function collectRoots() {
    var roots = [{ root: document, framePath: [], shadowPath: [], hostEl: null }]
    var seen = new Set()
    seen.add(document)

    function visit(rootInfo, depth) {
      if (depth > 4) return
      var root = rootInfo.root
      var iframes = safeQuery(root, 'iframe')
      Array.prototype.forEach.call(iframes, function (frame) {
        try {
          var doc = frame.contentDocument
          if (!doc || seen.has(doc)) return
          seen.add(doc)
          var info = { root: doc, framePath: rootInfo.framePath.concat([cssPath(frame)]), shadowPath: rootInfo.shadowPath.slice(), hostEl: null }
          roots.push(info)
          visit(info, depth + 1)
        } catch (e) {}
      })
      var all = safeQuery(root, '*')
      Array.prototype.forEach.call(all, function (el) {
        if (!el.shadowRoot || seen.has(el.shadowRoot)) return
        seen.add(el.shadowRoot)
        var info = { root: el.shadowRoot, framePath: rootInfo.framePath.slice(), shadowPath: rootInfo.shadowPath.concat([cssPath(el)]), hostEl: el }
        roots.push(info)
        visit(info, depth + 1)
      })
    }

    visit(roots[0], 0)
    return roots
  }

  function safeQuery(root, selector) {
    try { return root.querySelectorAll(selector) } catch (e) { return [] }
  }

  // ======================= 排除 / 弹窗范围 =======================

  function isExcluded(el, cfg) {
    if (!el || el.nodeType !== 1) return false
    for (var i = 0; i < cfg.excludedSelectors.length; i++) {
      if (composedClosest(el, cfg.excludedSelectors[i])) return true
    }
    if (cfg.excludedKeywords.length) {
      var text = txt(el)
      for (var j = 0; j < cfg.excludedKeywords.length; j++) {
        if (text && text.indexOf(cfg.excludedKeywords[j]) !== -1) return true
      }
    }
    return false
  }

  /** 跨 Shadow 边界向上匹配（第三方浮窗常把内容放在 open shadow root 里）。 */
  function composedClosest(el, selector) {
    var node = el
    var depth = 0
    while (node && depth < 40) {
      if (node.nodeType === 1) {
        try { if (node.matches(selector)) return node } catch (e) {}
      }
      var parent = node.parentElement
      if (!parent) {
        var root = node.getRootNode && node.getRootNode()
        parent = root && root.host ? root.host : null
      }
      node = parent
      depth++
    }
    return null
  }

  /** 第三方注入的固定悬浮窗（含 open shadow root 的宿主）。 */
  function isFloatingHost(el) {
    if (!el || el.nodeType !== 1) return false
    try {
      var st = getComputedStyle(el)
      if (st.position !== 'fixed' && st.position !== 'sticky') return false
      var z = parseInt(st.zIndex, 10) || 0
      if (z >= 1000000) return true
      var box = el.getBoundingClientRect()
      if (box.width * box.height < 200 * 200 && !el.querySelector('.el-form-item')) return true
    } catch (e) {}
    return false
  }

  /** 最上层的可见弹窗/抽屉（Element UI 后插入的在后面）。 */
  function findTopModal() {
    var sels = ['.el-dialog', '.el-drawer', '.el-message-box', '.ant-modal', '[role="dialog"]']
    var best = null
    var bestZ = -1
    sels.forEach(function (sel) {
      Array.prototype.forEach.call(safeQuery(document, sel), function (el) {
        if (!isVisible(el, 'loose')) return
        var z = 0
        try { z = parseInt(getComputedStyle(el).zIndex, 10) || 0 } catch (e) {}
        if (el.closest('.el-dialog__wrapper')) {
          try { z = Math.max(z, parseInt(getComputedStyle(el.closest('.el-dialog__wrapper')).zIndex, 10) || 0) } catch (e) {}
        }
        if (z >= bestZ) { bestZ = z; best = el }
      })
    })
    return best
  }

  // ======================= 控件识别 =======================

  function labelOf(fi) {
    var label = fi.querySelector('.el-form-item__label, label')
    return label ? txt(label) : ''
  }

  function isRequired(fi) {
    if (fi.classList.contains('is-required')) return true
    var label = fi.querySelector('.el-form-item__label, label')
    if (label && label.classList.contains('is-required')) return true
    if (fi.querySelector('.el-icon-asterisk')) return true
    var input = fi.querySelector('input[required], textarea[required], select[required]')
    return !!input
  }

  function isDisabled(fi) {
    return !!fi.querySelector(
      '.is-disabled, input[disabled]:not([type="hidden"]), textarea[disabled], ' +
      'select[disabled], [aria-disabled="true"]'
    )
  }

  function selectTypeOf(sel) {
    if (sel.querySelector('.el-tree')) return 'tree-select'
    if (sel.classList.contains('el-select--multiple') ||
        sel.querySelector('.el-select__tags, .el-tag, .el-select__selected-item--multiple')) return 'multiselect'
    return 'select'
  }

  /** 表单块内的控件（按优先级），第一个为主控件。 */
  function controlsOf(fi) {
    var content = fi.querySelector('.el-form-item__content') || fi
    var out = []
    var added = new Set()
    function add(el, type) {
      if (!el || added.has(el)) return
      added.add(el)
      out.push({ el: el, type: type })
    }

    Array.prototype.forEach.call(safeQuery(content, '.el-select'), function (el) { add(el, selectTypeOf(el)) })
    Array.prototype.forEach.call(safeQuery(content, '.el-cascader'), function (el) { add(el, 'tree-select') })
    Array.prototype.forEach.call(safeQuery(content, '.el-date-editor, .tsscdatepicker'), function (el) { add(el, 'date') })
    Array.prototype.forEach.call(safeQuery(content, '.el-switch'), function (el) { add(el, 'switch') })
    Array.prototype.forEach.call(safeQuery(content, '.el-upload'), function (el) { add(el, 'upload') })
    Array.prototype.forEach.call(safeQuery(content, '.el-radio-group'), function (el) { add(el, 'radio') })
    Array.prototype.forEach.call(safeQuery(content, '.el-checkbox-group'), function (el) { add(el, 'checkbox') })

    if (!content.querySelector('.el-radio-group')) {
      Array.prototype.forEach.call(safeQuery(content, '.el-radio'), function (el) { add(el, 'radio') })
    }
    if (!content.querySelector('.el-checkbox-group')) {
      Array.prototype.forEach.call(safeQuery(content, '.el-checkbox'), function (el) { add(el, 'checkbox') })
    }

    Array.prototype.forEach.call(safeQuery(content, 'textarea'), function (el) { add(el, 'textarea') })
    Array.prototype.forEach.call(safeQuery(content, 'input'), function (el) {
      if (String(el.type).toLowerCase() === 'hidden') return
      if (el.closest('.el-select, .el-cascader, .el-date-editor, .tsscdatepicker, .el-radio, .el-checkbox, .el-switch, .el-upload')) return
      add(el, String(el.type).toLowerCase() === 'number' ? 'number' : 'input')
    })

    if (!out.length) {
      var btn = content.querySelector('button')
      if (btn) out.push({ el: btn, type: 'button-group', inline: true })
    }
    return out
  }

  function dropdownOf(selectRoot, cfg) {
    try {
      var ids = [selectRoot.getAttribute('aria-controls'), selectRoot.getAttribute('aria-owns')].filter(Boolean)
      for (var i = 0; i < ids.length; i++) {
        var byId = document.getElementById(ids[i])
        if (byId) return byId.closest('.el-select-dropdown') || byId
      }
      var isOpen = selectRoot.classList.contains('is-focus') ||
        !!selectRoot.querySelector('input[aria-expanded="true"]')
      if (!isOpen) return null
      var opened = Array.prototype.filter.call(safeQuery(document, '.el-select-dropdown'), function (d) {
        return isVisible(d, 'loose')
      })
      if (opened.length === 1) return opened[0]
    } catch (e) {}
    return null
  }

  function optionsOf(control, cfg) {
    var el = control.el
    var type = control.type
    if (type === 'select' || type === 'multiselect' || type === 'tree-select') {
      var drop = dropdownOf(el, cfg)
      if (!drop) return []
      return Array.prototype.slice.call(safeQuery(drop, '.el-select-dropdown__item, .el-cascader-node'))
        .map(txt).filter(Boolean)
    }
    if (type === 'radio' || type === 'checkbox') {
      var sel = type === 'radio' ? '.el-radio' : '.el-checkbox'
      var host = el.classList && el.classList.contains('el-' + type) ? el.closest('.el-' + type + '-group') : el
      var scope = host || el
      if (scope.classList && (scope.classList.contains('el-radio') || scope.classList.contains('el-checkbox'))) {
        scope = scope.parentElement || scope
      }
      return Array.prototype.slice.call(safeQuery(scope, sel)).map(txt).filter(Boolean)
    }
    return []
  }

  function valueOf(control) {
    var el = control.el
    try {
      if (control.type === 'switch') return el.classList.contains('is-checked') || !!(el.querySelector('.is-checked'))
      if (control.type === 'select' || control.type === 'multiselect' || control.type === 'tree-select') {
        var input = el.querySelector('input')
        return input ? String(input.value || '') : txt(el)
      }
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return String(el.value || '')
      return ''
    } catch (e) { return '' }
  }

  function inlineButtonsOf(fi) {
    var out = []
    Array.prototype.forEach.call(safeQuery(fi, 'button'), function (btn) {
      var t = txt(btn)
      if (t && out.indexOf(t) === -1) out.push(t)
    })
    return out
  }

  function rectOf(host) {
    try {
      var box = host.getBoundingClientRect()
      if (!box || (!box.width && !box.height)) return null
      return {
        rect: { x: round3(box.left), y: round3(box.top), w: round3(box.width), h: round3(box.height) },
        rectNorm: {
          x1: round3(box.left / RECT_BASE.width),
          y1: round3(box.top / RECT_BASE.height),
          x2: round3((box.left + box.width) / RECT_BASE.width),
          y2: round3((box.top + box.height) / RECT_BASE.height)
        }
      }
    } catch (e) { return null }
  }

  // ======================= wire 定位 =======================

  function leafOf(type) {
    switch (type) {
      case 'input': case 'number': case 'date': return '//input'
      case 'textarea': return '//textarea'
      case 'select': case 'multiselect': case 'tree-select': return "//div[contains(@class,'el-select')]"
      case 'switch': return "//div[contains(@class,'el-switch')]"
      case 'radio': return '//input[@type="radio"]'
      case 'checkbox': return '//input[@type="checkbox"]'
      case 'upload': return "//div[contains(@class,'el-upload')]"
      default: return ''
    }
  }

  /**
   * 表单项的 wire XPath 候选（第 1 条即回放会用到的 primary）。
   * 与 robust-locators 一致：form-item + label 锚定，select 点容器，弹窗加作用域前缀。
   */
  function fieldXPaths(label, scopePrefix, type, index) {
    var out = []
    var lit = q(label)
    var loose = 'translate(normalize-space(.), ' + q(SPACES) + ", '')"
    var suffix = index ? '[' + index + ']' : ''
    var leaf = leafOf(type) + suffix
    if (!leaf) return out
    var prefix = scopePrefix || ''
    out.push(prefix + "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)=" + lit + ']]' + leaf)
    out.push(prefix + "//div[contains(@class,'el-form-item')][.//label[" + loose + '=' + lit + ']]' + leaf)
    if (prefix) {
      out.push("//div[contains(@class,'el-form-item')][.//label[normalize-space(.)=" + lit + ']]' + leaf)
    }
    return out
  }

  /** 按钮/链接/行内按钮：文本锚定（去空格精确匹配，规避 headed 下「查 询」）。 */
  function buttonXPaths(el, label, scopePrefix, formItemLabel) {
    var out = []
    var text = normLabel(txt(el))
    if (!text) return out
    var tag = el.tagName && el.tagName.toLowerCase() === 'a' ? 'a' : 'button'
    var loose = 'translate(normalize-space(.), ' + q(SPACES) + ", '')"
    var pred = '[' + loose + '=' + q(text) + ']'
    var predExact = '[normalize-space(.)=' + q(text) + ']'
    var prefix = scopePrefix || ''
    if (formItemLabel) {
      out.push(prefix + "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)=" +
        q(formItemLabel) + ']]//' + tag + pred)
    }
    out.push(prefix + '//' + tag + pred)
    out.push(prefix + '//' + tag + predExact)
    if (prefix) out.push('//' + tag + pred)
    return out
  }

  function scoreXPaths(doc, xpaths, limit) {
    var seen = {}
    var out = []
    for (var i = 0; i < xpaths.length; i++) {
      var xp = xpaths[i]
      if (!xp || seen[xp]) continue
      seen[xp] = 1
      var hit = evalCount(doc, xp)
      out.push({ xpath: xp, count: hit.count, visibleCount: hit.visibleCount })
      if (out.length >= (limit || 3)) break
    }
    return out
  }

  // ======================= 字段构建 =======================

  function buildField(fi, ctx) {
    var cfg = ctx.cfg
    var doc = fi.ownerDocument
    var chain = scopeChain(fi)
    var dialogScope = dialogScopeOf(chain)
    var controls = controlsOf(fi)
    var labelRaw = labelOf(fi)
    var label = normLabel(labelRaw)
    var primary = controls[0] || null
    var controlType = primary ? primary.type : 'readonly'
    var buttons = inlineButtonsOf(fi)
    var visible = isVisible(fi, cfg.visibility)
    var metrics = rectOf(fi)

    var actionable = false
    if (primary && controlType !== 'readonly') {
      if (controlType === 'button-group') actionable = true
      else if (primary.el.classList && primary.el.classList.contains('is-disabled')) actionable = false
      else if (primary.el.disabled === true) actionable = false
      else actionable = true
      // 纯只读 input（disabled）视为不可操作
      if (primary.el.tagName === 'INPUT' && (primary.el.disabled || primary.el.readOnly) &&
          controlType !== 'select' && controlType !== 'multiselect' && controlType !== 'tree-select' && controlType !== 'date') {
        actionable = false
      }
    }

    var action = 'skip'
    if (actionable) {
      if (controlType === 'input' || controlType === 'number' || controlType === 'textarea' || controlType === 'date') action = 'input'
      else if (controlType === 'select' || controlType === 'multiselect' || controlType === 'tree-select') action = 'select:click'
      else action = 'click'
    }

    var wireCandidates = []
    var controlsOut = []
    var inShadow = ctx.rootInfo.shadowPath.length > 0
    var inIframe = ctx.rootInfo.framePath.length > 0

    if (!inShadow && !inIframe && label && action !== 'skip') {
      if (controlType === 'button-group' && primary) {
        // 行内按钮字段（行业代码 / 企业规模 / 地址）：定位到 form-item 内的按钮
        var bScored = scoreXPaths(doc, buttonXPaths(primary.el, label, dialogScope ? dialogScope.prefix : '', label), cfg.wireCandidateLimit)
        wireCandidates = bScored
        controlsOut.push({
          controlType: 'button-group',
          wireXPath: bScored[0] ? bScored[0].xpath : '',
          wireCount: bScored[0] ? bScored[0].count : 0,
          wireCandidates: bScored
        })
      } else {
        var multi = controls.length > 1
        controls.forEach(function (c, i) {
          var xps = fieldXPaths(label, dialogScope ? dialogScope.prefix : '', c.type, multi ? i + 1 : 0)
          var scored = scoreXPaths(doc, xps, cfg.wireCandidateLimit)
          controlsOut.push({
            controlType: c.type,
            wireXPath: scored[0] ? scored[0].xpath : '',
            wireCount: scored[0] ? scored[0].count : 0,
            wireCandidates: scored
          })
          if (i === 0) wireCandidates = scored
        })
      }
    }

    var primaryHit = wireCandidates[0] || { xpath: '', count: 0, visibleCount: 0 }
    var options = primary ? optionsOf(primary, cfg) : []

    var wireOptionTemplate = ''
    if ((controlType === 'radio' || controlType === 'checkbox') && label) {
      wireOptionTemplate = (dialogScope ? dialogScope.prefix : '') +
        "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)=" + q(label) + ']]' +
        "//label[contains(@class,'el-" + controlType + "')][normalize-space(.)='{option}']"
    }

    var reviewReasons = []
    if (!label) reviewReasons.push('UNNAMED')
    if (inShadow) reviewReasons.push('SHADOW_UNSUPPORTED')
    if (inIframe) reviewReasons.push('IFRAME_UNSUPPORTED')
    if (controlType === 'unknown') reviewReasons.push('UNKNOWN_CONTROL')
    if (!visible) reviewReasons.push('HIDDEN')
    if (label && !inShadow && !inIframe && action !== 'skip') {
      if (primaryHit.count === 0) reviewReasons.push('WIRE_XPATH_NOT_FOUND')
      else if (primaryHit.count > 1) reviewReasons.push('WIRE_XPATH_AMBIGUOUS')
    }

    var field = {
      stableKey: hashKey((ctx.pageName || '') + '|' + chain.map(function (c) { return c.name }).join('>') + '|' + label + '|' + controlType),
      seq: 0,
      group: chain.length ? chain[chain.length - 1].name : (ctx.pageName || ''),
      groupPath: chain.map(function (c) { return c.name }),
      label: label,
      labelRaw: labelRaw,
      controlType: controlType,
      action: action,
      required: isRequired(fi),
      disabled: isDisabled(fi),
      actionable: actionable,
      hidden: !visible,
      value: primary ? valueOf(primary) : '',
      options: options,
      inlineButtons: buttons,
      controlCount: controls.length,
      controls: controlsOut,
      wireXPath: primaryHit.xpath,
      wireCount: primaryHit.count,
      wireVisibleCount: primaryHit.visibleCount,
      wireCandidates: wireCandidates,
      wireOptionTemplate: wireOptionTemplate,
      rect: metrics ? metrics.rect : null,
      rectNorm: metrics ? metrics.rectNorm : null,
      needsReview: reviewReasons.length > 0,
      reviewReasons: reviewReasons,
      inDialog: !!(dialogScope && dialogScope.type === 'dialog'),
      inDrawer: !!(dialogScope && dialogScope.type === 'drawer'),
      inPopover: !!(dialogScope && dialogScope.type === 'popover'),
      scopeTitle: dialogScope ? dialogScope.title : '',
      inIframe: inIframe,
      inShadow: inShadow,
      _band: dialogScope ? 1 : 0
    }

    if (cfg.format === 'full') {
      field.chain = chain
      field.css = cssPath(fi)
      field.framePath = ctx.rootInfo.framePath.slice()
      field.shadowPath = ctx.rootInfo.shadowPath.slice()
    }
    // 仅供页内标注使用：不可枚举，不会出现在 JSON / Playwright 返回值里
    Object.defineProperty(field, '_el', { value: fi, enumerable: false })
    return field
  }

  function buildButtonField(el, ctx) {
    var doc = el.ownerDocument
    var chain = scopeChain(el)
    var dialogScope = dialogScopeOf(chain)
    var label = normLabel(txt(el))
    var metrics = rectOf(el)
    var visible = isVisible(el, ctx.cfg.visibility)

    var xpaths = buttonXPaths(el, label, dialogScope ? dialogScope.prefix : '', '')
    var scored = (!ctx.rootInfo.shadowPath.length && !ctx.rootInfo.framePath.length && label)
      ? scoreXPaths(doc, xpaths, ctx.cfg.wireCandidateLimit)
      : []
    var primary = scored[0] || { xpath: '', count: 0, visibleCount: 0 }

    var reviewReasons = []
    if (!label) reviewReasons.push('UNNAMED')
    if (ctx.rootInfo.shadowPath.length) reviewReasons.push('SHADOW_UNSUPPORTED')
    if (ctx.rootInfo.framePath.length) reviewReasons.push('IFRAME_UNSUPPORTED')
    if (label && !ctx.rootInfo.shadowPath.length && !ctx.rootInfo.framePath.length) {
      if (primary.count === 0) reviewReasons.push('WIRE_XPATH_NOT_FOUND')
      else if (primary.count > 1) reviewReasons.push('WIRE_XPATH_AMBIGUOUS')
    }
    if (!visible) reviewReasons.push('HIDDEN')

    var field = {
      stableKey: hashKey((ctx.pageName || '') + '|' + chain.map(function (c) { return c.name }).join('>') + '|' + label + '|button'),
      seq: 0,
      group: chain.length ? chain[chain.length - 1].name : (ctx.pageName || ''),
      groupPath: chain.map(function (c) { return c.name }),
      label: label,
      labelRaw: txt(el),
      controlType: el.tagName && el.tagName.toLowerCase() === 'a' ? 'link' : 'button',
      action: 'click',
      required: false,
      disabled: el.disabled === true,
      actionable: el.disabled !== true,
      hidden: !visible,
      value: '',
      options: [],
      inlineButtons: [],
      controlCount: 1,
      controls: [],
      wireXPath: primary.xpath,
      wireCount: primary.count,
      wireVisibleCount: primary.visibleCount,
      wireCandidates: scored,
      wireOptionTemplate: '',
      rect: metrics ? metrics.rect : null,
      rectNorm: metrics ? metrics.rectNorm : null,
      needsReview: reviewReasons.length > 0,
      reviewReasons: reviewReasons,
      inDialog: !!(dialogScope && dialogScope.type === 'dialog'),
      inDrawer: !!(dialogScope && dialogScope.type === 'drawer'),
      inPopover: !!(dialogScope && dialogScope.type === 'popover'),
      scopeTitle: dialogScope ? dialogScope.title : '',
      inIframe: ctx.rootInfo.framePath.length > 0,
      inShadow: ctx.rootInfo.shadowPath.length > 0,
      _band: dialogScope ? 1 : 0
    }
    Object.defineProperty(field, '_el', { value: el, enumerable: false })
    return field
  }

  // ======================= 表格摘要 =======================

  function collectTables(cfg) {
    var out = []
    Array.prototype.forEach.call(safeQuery(document, '.el-table'), function (table) {
      if (!isVisible(table, 'loose')) return
      if (table.closest('.el-table__fixed, .el-table__fixed-right')) return
      if (isExcluded(table, cfg)) return

      var heads = Array.prototype.slice
        .call(safeQuery(table, '.el-table__header-wrapper th .cell, .el-table__header th .cell'))
        .map(txt)
      var headers = []
      heads.forEach(function (h) { if (h && headers.indexOf(h) === -1) headers.push(h) })

      var bodyRows = Array.prototype.filter
        .call(safeQuery(table, '.el-table__body-wrapper tbody tr, .el-table__body tbody tr'), function (tr) {
          return isVisible(tr, 'loose')
        })

      var rows = bodyRows.slice(0, Math.max(1, cfg.tableRowLimit)).map(function (tr) {
        return Array.prototype.map.call(safeQuery(tr, 'td .cell'), txt)
      })

      var rowActions = []
      var hasRowRadio = false
      var hasRowCheckbox = false
      if (bodyRows[0]) {
        Array.prototype.forEach.call(safeQuery(bodyRows[0], 'button, a'), function (act) {
          var t = txt(act)
          if (t && rowActions.indexOf(t) === -1) rowActions.push(t)
        })
        hasRowRadio = !!bodyRows[0].querySelector('.el-radio, input[type="radio"]')
        hasRowCheckbox = !!bodyRows[0].querySelector('.el-checkbox, input[type="checkbox"]')
      }

      var chain = scopeChain(table)
      var scope = dialogScopeOf(chain)

      out.push({
        title: scope ? scope.title : '',
        scope: scope ? scope.type : 'page',
        headers: headers,
        rowCount: bodyRows.length,
        rows: rows,
        hasRowRadio: hasRowRadio,
        hasRowCheckbox: hasRowCheckbox,
        rowActions: rowActions,
        rowActionXPathTemplates: rowActions.map(function (name) {
          return "//tr[contains(.,'{anchor}')]//button[translate(normalize-space(.), " +
            q(SPACES) + ", '')=" + q(normLabel(name)) + ']'
        })
      })
    })
    return out
  }

  // ======================= 主流程 =======================

  var lastInventory = null

  function scan(options) {
    var started = Date.now()
    var cfg = resolveConfig(options)
    // 标注层会污染扫描（里面有图例链接），每次扫描前先清理
    clearAnnotation()
    var pageName = pageNameOf()
    var modal = cfg.scope === 'modal' ? findTopModal() : null
    var roots = collectRoots()

    var fields = []
    var warnings = []
    var formItemTotal = 0
    var formItemCovered = 0
    var excluded = 0

    roots.forEach(function (rootInfo) {
      var root = rootInfo.root
      var ctx = { cfg: cfg, pageName: pageName, rootInfo: rootInfo }
      var doc = rootInfo.root.nodeType === 9 ? rootInfo.root : rootInfo.root.ownerDocument

      // 第三方固定悬浮窗（含 open shadow root）整体跳过
      if (rootInfo.hostEl && isFloatingHost(rootInfo.hostEl)) { excluded++; return }

      // ---- 1. 表单块：一个 .el-form-item = 一个字段 ----
      Array.prototype.forEach.call(safeQuery(root, '.el-form-item'), function (fi) {
        if (!fi.querySelector('.el-form-item__label, label')) return
        if (!isVisible(fi, cfg.visibility) && cfg.visibility !== 'none') return
        if (fi.closest('.el-table, table')) return
        if (isExcluded(fi, cfg)) { excluded++; return }
        if (modal && !modal.contains(fi)) return

        formItemTotal++
        try {
          var field = buildField(fi, ctx)
          if (!field.label) return
          fields.push(field)
          formItemCovered++
          pushFieldWarnings(field, warnings, cfg)
        } catch (e) {
          warnings.push({ code: 'FIELD_ERROR', message: String(e && e.message || e), css: cssPath(fi) })
        }
      })

      // ---- 2. 工具栏按钮 / 链接（不在表单块、不在表格内）----
      if (cfg.includeButtons) {
        var buttonSeen = new Set()
        Array.prototype.forEach.call(safeQuery(root, 'button, [role="button"], a, .el-button'), function (el) {
          var host = el.closest('button, .el-button, a, [role="button"]') || el
          if (buttonSeen.has(host)) return
          buttonSeen.add(host)
          if (host.closest('.el-form-item, .el-table, table, .el-select-dropdown, .el-picker-panel')) return
          if (!isVisible(host, cfg.visibility) && cfg.visibility !== 'none') return
          if (isExcluded(host, cfg)) { excluded++; return }
          if (modal && !modal.contains(host)) return
          try {
            var bf = buildButtonField(host, ctx)
            if (!bf.label) { excluded++; return } // 图标按钮无文本：不产出位置索引 XPath
            fields.push(bf)
            pushFieldWarnings(bf, warnings, cfg)
          } catch (e) {
            warnings.push({ code: 'BUTTON_ERROR', message: String(e && e.message || e) })
          }
        })
      }

      // ---- 3. 独立输入控件（不在表单块内）----
      Array.prototype.forEach.call(safeQuery(root, 'input, textarea, select'), function (el) {
        if (String(el.type || '').toLowerCase() === 'hidden') return
        if (el.closest('.el-form-item, .el-table, table, .el-select, .el-date-editor, .tsscdatepicker, .el-radio, .el-checkbox, .el-switch')) return
        if (!isVisible(el, cfg.visibility) && cfg.visibility !== 'none') return
        if (isExcluded(el, cfg)) { excluded++; return }
        if (modal && !modal.contains(el)) return
        var label = normLabel(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '')
        if (!label) return
        try {
          var chain = scopeChain(el)
          var ds = dialogScopeOf(chain)
          var type = el.tagName === 'TEXTAREA' ? 'textarea' : (String(el.type).toLowerCase() === 'number' ? 'number' : 'input')
          var xps = fieldXPaths(label, ds ? ds.prefix : '', type, 0)
          var scored = (!rootInfo.shadowPath.length && !rootInfo.framePath.length)
            ? scoreXPaths(doc, xps, cfg.wireCandidateLimit) : []
          var primary = scored[0] || { xpath: '', count: 0, visibleCount: 0 }
          var metrics = rectOf(el)
          var reasons = []
          if (!scored.length) reasons.push(rootInfo.shadowPath.length ? 'SHADOW_UNSUPPORTED' : 'IFRAME_UNSUPPORTED')
          else if (primary.count === 0) reasons.push('WIRE_XPATH_NOT_FOUND')
          else if (primary.count > 1) reasons.push('WIRE_XPATH_AMBIGUOUS')
          var standaloneField = {
            stableKey: hashKey((pageName || '') + '|' + chain.map(function (c) { return c.name }).join('>') + '|' + label + '|' + type),
            seq: 0,
            group: chain.length ? chain[chain.length - 1].name : (pageName || ''),
            groupPath: chain.map(function (c) { return c.name }),
            label: label,
            labelRaw: label,
            controlType: type,
            action: 'input',
            required: el.required === true,
            disabled: el.disabled === true,
            actionable: !el.disabled,
            hidden: !isVisible(el, cfg.visibility),
            value: String(el.value || ''),
            options: [],
            inlineButtons: [],
            controlCount: 1,
            controls: [],
            wireXPath: primary.xpath,
            wireCount: primary.count,
            wireVisibleCount: primary.visibleCount,
            wireCandidates: scored,
            wireOptionTemplate: '',
            rect: metrics ? metrics.rect : null,
            rectNorm: metrics ? metrics.rectNorm : null,
            needsReview: reasons.length > 0,
            reviewReasons: reasons,
            inDialog: !!(ds && ds.type === 'dialog'),
            inDrawer: !!(ds && ds.type === 'drawer'),
            inPopover: !!(ds && ds.type === 'popover'),
            scopeTitle: ds ? ds.title : '',
            inIframe: rootInfo.framePath.length > 0,
            inShadow: rootInfo.shadowPath.length > 0,
            _band: ds ? 1 : 0
          }
          Object.defineProperty(standaloneField, '_el', { value: el, enumerable: false })
          fields.push(standaloneField)
        } catch (e) {
          warnings.push({ code: 'INPUT_ERROR', message: String(e && e.message || e) })
        }
      })
    })

    // ---- 排序 + seq ----
    fields.sort(function (a, b) {
      if (a._band !== b._band) return a._band - b._band
      var ya = a.rect ? a.rect.y : Number.MAX_SAFE_INTEGER
      var yb = b.rect ? b.rect.y : Number.MAX_SAFE_INTEGER
      if (ya !== yb) return ya - yb
      return (a.rect ? a.rect.x : 0) - (b.rect ? b.rect.x : 0)
    })
    var truncated = false
    if (fields.length > cfg.maxFields) {
      fields = fields.slice(0, cfg.maxFields)
      truncated = true
    }
    fields.forEach(function (f, i) { f.seq = i + 1; delete f._band })

    // ---- 分组汇总 ----
    var groups = []
    var groupMap = {}
    fields.forEach(function (f) {
      var key = f.groupPath.join('>') || f.group
      if (!groupMap[key]) {
        groupMap[key] = { path: f.groupPath.slice(), name: f.group, count: 0 }
        groups.push(groupMap[key])
      }
      groupMap[key].count++
    })

    var tables = cfg.includeTables ? collectTables(cfg) : []
    var byAction = {}
    var byControl = {}
    fields.forEach(function (f) {
      byAction[f.action] = (byAction[f.action] || 0) + 1
      byControl[f.controlType] = (byControl[f.controlType] || 0) + 1
    })

    var uniqueWarnings = []
    var seenWarn = {}
    warnings.forEach(function (w) {
      var key = w.code + '|' + (w.label || w.message || '')
      if (seenWarn[key]) return
      seenWarn[key] = 1
      uniqueWarnings.push(w)
    })
    if (uniqueWarnings.length > cfg.maxWarnings) uniqueWarnings = uniqueWarnings.slice(0, cfg.maxWarnings)
    if (truncated) {
      uniqueWarnings.unshift({ code: 'FIELD_LIMIT', message: '字段数超过 maxFields=' + cfg.maxFields + '，已截断' })
    }
    if (excluded > 0) {
      uniqueWarnings.unshift({ code: 'EXCLUDED_ELEMENTS', message: '按排除规则跳过 ' + excluded + ' 个元素' })
    }

    var inventory = {
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      version: VERSION,
      url: typeof location !== 'undefined' ? location.href : '',
      route: typeof location !== 'undefined' ? (location.hash || location.pathname) : '',
      title: document.title || '',
      pageName: pageName,
      scope: modal ? 'modal' : 'page',
      scopeTitle: modal ? (titleFrom(modal.querySelector('.el-dialog__title, .el-drawer__title, .el-message-box__title')) || '') : '',
      scannedAt: Date.now(),
      elapsedMs: Date.now() - started,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        rectBase: { width: RECT_BASE.width, height: RECT_BASE.height }
      },
      stats: {
        fields: fields.length,
        formItems: formItemTotal,
        coverage: formItemTotal ? round3(formItemCovered / formItemTotal) : 1,
        required: fields.filter(function (f) { return f.required }).length,
        actionable: fields.filter(function (f) { return f.actionable }).length,
        hidden: fields.filter(function (f) { return f.hidden }).length,
        needsReview: fields.filter(function (f) { return f.needsReview }).length,
        wireBad: fields.filter(function (f) {
          return f.action !== 'skip' && !f.inShadow && !f.inIframe && f.wireCount !== 1
        }).length,
        excluded: excluded,
        tables: tables.length,
        roots: roots.length,
        byAction: byAction,
        byControl: byControl
      },
      warnings: uniqueWarnings,
      groups: groups,
      fields: fields,
      tables: tables
    }
    lastInventory = inventory
    return inventory
  }

  function pushFieldWarnings(field, warnings, cfg) {
    var reasons = field.reviewReasons || []
    if (reasons.indexOf('WIRE_XPATH_AMBIGUOUS') !== -1) {
      warnings.push({
        code: 'WIRE_XPATH_AMBIGUOUS',
        label: field.label,
        group: field.group,
        xpath: field.wireXPath,
        message: (field.group ? field.group + ' / ' : '') + field.label +
          ' 的 wire XPath 命中 ' + field.wireCount + ' 个节点，回放会静默取第一个'
      })
    } else if (reasons.indexOf('WIRE_XPATH_NOT_FOUND') !== -1) {
      warnings.push({
        code: 'WIRE_XPATH_NOT_FOUND',
        label: field.label,
        group: field.group,
        xpath: field.wireXPath,
        message: (field.group ? field.group + ' / ' : '') + field.label +
          ' 的 wire XPath 在当前状态命中 0 个节点，回放会超时'
      })
    } else if (reasons.indexOf('UNNAMED') !== -1) {
      warnings.push({ code: 'UNNAMED_ELEMENT', message: '存在无法命名的字段，已标记 needsReview' })
    }
  }

  // ======================= 稳定等待 =======================

  function waitForStable(options) {
    var cfg = options || {}
    var idle = typeof cfg.idle === 'number' ? cfg.idle : 300
    var timeout = typeof cfg.timeout === 'number' ? cfg.timeout : 3000
    return new Promise(function (resolve) {
      var done = false
      var timer = null
      var observer
      function finish() {
        if (done) return
        done = true
        try { observer.disconnect() } catch (e) {}
        if (timer) clearTimeout(timer)
        resolve()
      }
      try {
        observer = new MutationObserver(function () {
          if (timer) clearTimeout(timer)
          timer = setTimeout(finish, idle)
        })
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
      } catch (e) {
        finish()
        return
      }
      timer = setTimeout(finish, idle)
      setTimeout(finish, timeout)
    })
  }

  // ======================= 控制台辅助（无需 Node，F12 直接用） =======================

  /** 按 XPath 取唯一节点 + 命中数。 */
  function queryXPath(xpath) {
    if (!xpath) return { count: 0, el: null }
    try {
      var res = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
      return { count: res.snapshotLength, el: res.snapshotLength === 1 ? res.snapshotItem(0) : null }
    } catch (e) {
      return { count: -1, el: null }
    }
  }

  function multisetDiff(a, b) {
    var count = {}
    b.forEach(function (x) { count[x] = (count[x] || 0) + 1 })
    var onlyA = []
    a.forEach(function (x) {
      if (count[x]) count[x]--
      else onlyA.push(x)
    })
    return onlyA
  }

  /**
   * 页面内自检：L1 完整性对拍 + L2 定位回代。
   * 等价于 Playwright 版 scan-verify 的机器部分，只是不落文件。
   * @returns {{ok:boolean, L1:object, L2:object, issues:Array}}
   */
  function selfCheck(inventory) {
    var inv = inventory || currentInventory()

    // L1：独立枚举页面上的 .el-form-item 标签，与扫描结果对拍
    var domLabels = []
    Array.prototype.forEach.call(document.querySelectorAll('.el-form-item'), function (fi) {
      if (!fi.getClientRects().length) return
      var label = fi.querySelector('.el-form-item__label, label')
      if (!label) return
      var t = normLabel(txt(label))
      if (t) domLabels.push(t)
    })
    var scanFields = inv.fields.filter(function (f) {
      return f.controlType !== 'button' && f.controlType !== 'link' && !f.inShadow && !f.inIframe
    })
    var missing = multisetDiff(domLabels, scanFields.map(function (f) { return f.label }))
    var extra = multisetDiff(scanFields.map(function (f) { return f.label }), domLabels)

    // L2：每条 wireXPath 回代，核对命中数 + 落点标签/位置
    var issues = []
    missing.forEach(function (l) { issues.push({ level: 'hard', layer: 'L1', label: l, msg: '页面有、扫描漏了：' + l }) })
    extra.forEach(function (l) { issues.push({ level: 'hard', layer: 'L1', label: l, msg: '扫描有、页面没有：' + l }) })

    var targets = inv.fields.filter(function (f) { return f.wireXPath && f.action !== 'skip' })
    targets.forEach(function (f) {
      var r = queryXPath(f.wireXPath)
      if (r.count !== f.wireCount) {
        issues.push({ level: 'hard', layer: 'L2', label: f.label, msg: '命中数不一致：扫描 ' + f.wireCount + '，回代 ' + r.count })
        return
      }
      if (r.count === 0) { issues.push({ level: 'hard', layer: 'L2', label: f.label, msg: '回代命中 0，定位失效' }); return }
      if (r.count > 1) { issues.push({ level: 'soft', layer: 'L2', label: f.label, msg: '命中 ' + r.count + '，回放会取第一个（歧义）' }); return }
      var isBtn = f.controlType === 'button' || f.controlType === 'link'
      var semantic = isBtn ? String(r.el.innerText || '').replace(/\s+/g, ' ').trim() : normLabel(labelOfElement(r.el))
      if (semantic !== f.label) {
        issues.push({ level: 'hard', layer: 'L2', label: f.label, msg: '定位到了别的元素：「' + semantic + '」' })
        return
      }
      if (f.rect) {
        var host = (r.el.closest && r.el.closest('.el-form-item')) || r.el
        var box = host.getBoundingClientRect()
        var dx = Math.abs(box.left - f.rect.x)
        var dy = Math.abs(box.top - f.rect.y)
        if (dx > 2 || dy > 2) {
          issues.push({ level: 'soft', layer: 'L2', label: f.label, msg: '位置偏差 dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1) })
        }
      }
    })

    var hard = issues.filter(function (x) { return x.level === 'hard' }).length
    var soft = issues.length - hard
    var result = {
      ok: hard === 0,
      L1: { domFormItems: domLabels.length, scanFormItems: scanFields.length, missing: missing, extra: extra },
      L2: { checked: targets.length, hard: hard, soft: soft },
      issues: issues
    }

    console.log('%c[自检] 字段 ' + inv.stats.fields + '　coverage ' + inv.stats.coverage +
      '　wireBad ' + inv.stats.wireBad + '　L1 漏 ' + missing.length + ' / 多 ' + extra.length +
      '　L2 硬 ' + hard + ' / 软 ' + soft,
      'font-weight:bold;color:' + (hard ? '#c0392b' : '#1e8e3e'))
    if (issues.length) console.table(issues.map(function (x) {
      return { 级别: x.level, 层: x.layer, 字段: x.label, 说明: x.msg }
    }))
    return result
  }

  // ======================= 标注（实时跟随滚动） =======================

  var annotState = null

  /** 移除标注层并解绑监听。 */
  function clearAnnotation() {
    if (annotState) {
      try { annotState.cleanup() } catch (e) {}
      annotState = null
    }
    var old = document.getElementById('__scan_annot__')
    if (old) old.remove()
  }

  /**
   * 在页面上给每个字段画框 + 编号（编号 = report() 表格里的 #）。
   *
   * 框是 fixed 定位，并且每次滚动/尺寸变化都按元素**实时位置**重算，
   * 所以滚动时自动跟随，不需要重新执行；滚到视口外的字段会自动出现。
   *
   * annotate('off') 可移除。
   */
  function annotate(mode) {
    clearAnnotation()
    if (mode === 'off' || mode === false) {
      return { annotated: 0, visible: 0, offViewport: 0, removed: true }
    }

    // 每次标注重新扫描：元素是活的，rect 用 getBoundingClientRect 实时取
    var inv = scan()
    var items = []
    inv.fields.forEach(function (f) {
      if (!f._el || !f._el.isConnected || !f.rect) return
      if (f.inIframe || f.inShadow) return // 跨文档/影子树无法与视口坐标对齐
      items.push(f)
    })
    if (!items.length) {
      console.warn('[标注] 没有可标注的字段')
      return { annotated: 0, visible: 0, offViewport: 0 }
    }

    var host = document.createElement('div')
    host.id = '__scan_annot__'
    host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483647'
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host
    var style = document.createElement('style')
    style.textContent = '.box{position:fixed;box-sizing:border-box;pointer-events:none}' +
      '.tag{position:absolute;left:-1px;top:-14px;font:11px/14px monospace;padding:0 3px;border-radius:2px;color:#fff}' +
      '.legend{position:fixed;right:10px;top:10px;pointer-events:auto;background:rgba(0,0,0,.8);color:#fff;' +
      'font:12px/1.6 system-ui,sans-serif;padding:6px 10px;border-radius:6px;max-width:340px}'
    root.appendChild(style)

    var boxes = items.map(function (f) {
      var color = f.needsReview ? '#e6a23c' : (f.action === 'skip' ? '#909399' : '#f56c6c')
      var box = document.createElement('div')
      box.className = 'box'
      box.style.border = '1px solid ' + color
      box.style.background = f.action === 'skip' ? 'rgba(144,147,153,.06)' : 'rgba(245,108,108,.06)'
      var tag = document.createElement('span')
      tag.className = 'tag'
      tag.textContent = f.seq
      tag.style.background = color
      box.appendChild(tag)
      root.appendChild(box)
      return { el: f._el, box: box }
    })

    var legend = document.createElement('div')
    legend.className = 'legend'
    root.appendChild(legend)

    var state = { visible: -1, hidden: -1 }

    function renderLegend() {
      legend.innerHTML = '<b>扫描标注</b>　字段 ' + inv.stats.fields +
        '　视口内 ' + Math.max(0, state.visible) +
        (state.hidden > 0 ? '　视口外 ' + state.hidden : '') +
        '<br>红=可操作　灰=skip　橙=需复核' +
        '<br><span style="color:#9fd">框随滚动自动跟随，无需重新执行</span>' +
        '<br><a href="#" style="color:#7ec8ff">移除标注</a>'
      var a = legend.querySelector('a')
      if (a) a.addEventListener('click', function (e) { e.preventDefault(); annotate('off') })
    }

    function update() {
      var vw = window.innerWidth
      var vh = window.innerHeight
      var visible = 0
      var hidden = 0
      boxes.forEach(function (b) {
        var el = b.el
        if (!el || !el.isConnected) { b.box.style.display = 'none'; hidden++; return }
        var r
        try { r = el.getBoundingClientRect() } catch (e) { b.box.style.display = 'none'; hidden++; return }
        if (!r || (!r.width && !r.height)) { b.box.style.display = 'none'; hidden++; return }
        if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
          b.box.style.display = 'none'
          hidden++
          return
        }
        b.box.style.display = 'block'
        b.box.style.left = r.left + 'px'
        b.box.style.top = r.top + 'px'
        b.box.style.width = r.width + 'px'
        b.box.style.height = r.height + 'px'
        visible++
      })
      if (visible !== state.visible || hidden !== state.hidden) {
        state.visible = visible
        state.hidden = hidden
        renderLegend()
      }
    }

    var raf = 0
    function schedule() {
      if (raf) return
      raf = requestAnimationFrame(function () { raf = 0; update() })
    }

    document.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    var mo = null
    try {
      mo = new MutationObserver(schedule)
      mo.observe(document.documentElement, { childList: true, subtree: true })
    } catch (e) {}

    annotState = {
      cleanup: function () {
        document.removeEventListener('scroll', schedule, true)
        window.removeEventListener('resize', schedule)
        if (mo) { try { mo.disconnect() } catch (e) {} }
        if (raf) { try { cancelAnimationFrame(raf) } catch (e) {} }
      }
    }

    document.documentElement.appendChild(host)
    update()

    console.log('[标注] 共 ' + items.length + ' 个字段，视口内 ' + state.visible +
      (state.hidden ? '，视口外 ' + state.hidden + '（滚动时会自动出现）' : '') +
      '；框会跟随滚动，不需要重新执行')
    return { annotated: items.length, visible: state.visible, offViewport: state.hidden }
  }

  /** 控制台表格 + 返回 markdown（可直接贴进 plan.md）。 */
  function report(inventory) {
    var inv = inventory || currentInventory()
    var rows = inv.fields.map(function (f) {
      var st = f.action === 'skip' ? '跳过'
        : (f.reviewReasons && f.reviewReasons.length ? f.reviewReasons.join(',') : 'ok')
      return {
        '#': f.seq, 组: f.group, 字段: f.label, 类型: f.controlType, 动作: f.action,
        必填: f.required ? '是' : '', 选项: (f.options || []).join('/'),
        wireCount: f.wireCount, 状态: st
      }
    })
    if (console.table) console.table(rows)
    return toMarkdown(inv)
  }

  function toMarkdown(inv) {
    var lines = []
    lines.push('# 扫描盘点：' + (inv.pageName || inv.title))
    lines.push('')
    lines.push('- 路由：`' + inv.route + '`')
    lines.push('- 范围：' + inv.scope + (inv.scopeTitle ? '（' + inv.scopeTitle + '）' : ''))
    lines.push('- 字段 ' + inv.stats.fields + ' / 表单项 ' + inv.stats.formItems + ' / coverage ' + inv.stats.coverage)
    lines.push('- wireBad ' + inv.stats.wireBad + ' / needsReview ' + inv.stats.needsReview)
    lines.push('')
    lines.push('| # | 组 | 字段 | 类型 | 动作 | 必填 | 选项 | wireCount | 状态 |')
    lines.push('|---|---|---|---|---|---|---|---|---|')
    inv.fields.forEach(function (f) {
      var st = f.action === 'skip' ? '跳过'
        : (f.reviewReasons && f.reviewReasons.length ? f.reviewReasons.join(',') : 'ok')
      lines.push('| ' + [f.seq, f.group, f.label, f.controlType, f.action,
        f.required ? '是' : '', (f.options || []).join('/'), f.wireCount, st].join(' | ') + ' |')
    })
    return lines.join('\n') + '\n'
  }

  /** 下载当前 inventory（控制台用；Playwright 里请直接取返回值）。 */
  function download(filename) {
    var inv = currentInventory()
    var json = JSON.stringify(inv, null, 1)
    try {
      var blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      var url = URL.createObjectURL(blob)
      var a = document.createElement('a')
      a.href = url
      a.download = filename || ('scan-' + Date.now() + '.json')
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(function () { try { URL.revokeObjectURL(url) } catch (e) {} }, 1000)
      console.log('[下载] ' + a.download + '（' + (json.length / 1024).toFixed(1) + ' KB）')
      return json
    } catch (e) {
      console.warn('[下载] 失败，已输出到控制台：', e)
      console.log(json)
      return json
    }
  }

  function currentInventory() {
    return lastInventory || scan()
  }

  var labelOfElement = function (el) {
    if (!el) return ''
    var fi = el.closest && el.closest('.el-form-item')
    var label = fi && fi.querySelector('.el-form-item__label, label')
    return label ? txt(label) : txt(el)
  }

  // ======================= 对外 API =======================

  var PageScanner = {
    version: VERSION,
    schema: SCHEMA,
    schemaVersion: SCHEMA_VERSION,
    defaults: DEFAULTS,
    scan: scan,
    run: function (options) {
      return waitForStable(options).then(function () { return scan(options) })
    },
    // 控制台用：自检 / 画框 / 表格 / 下载
    selfCheck: selfCheck,
    annotate: annotate,
    report: report,
    download: download,
    getLastInventory: function () { return lastInventory },
    /** 供调试：只取某个选择器内的字段 */
    debug: {
      cssPath: cssPath,
      scopeChain: function (selector) {
        var el = document.querySelector(selector)
        return el ? scopeChain(el) : []
      }
    }
  }

  // 覆盖前先记下页面里已有的版本，便于发现「贴错旧版」
  var prevVersion = ''
  try {
    if (global.PageScanner && global.PageScanner.version) prevVersion = String(global.PageScanner.version)
  } catch (e) {}

  global.PageScanner = PageScanner

  try {
    console.log('%c[PageScanner] v' + VERSION + ' 已加载　scan / run / selfCheck / annotate / report / download',
      'color:#1e8e3e;font-weight:bold')
    if (prevVersion && prevVersion !== VERSION) {
      console.warn('[PageScanner] 页面里原有 v' + prevVersion + '，已被 v' + VERSION + ' 覆盖')
    }
  } catch (e) {}

  // Node 环境（单测）可用
  if (typeof module !== 'undefined' && module.exports) module.exports = PageScanner
})(typeof window !== 'undefined' ? window : globalThis)
