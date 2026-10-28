# page-scanner.js — ui-agent1 页面盘点扫描器

**本项目独立维护的单文件扫描器**，只服务 `ui-agent1` 的「agent + Playwright 录制」链路：
探路（probe）→ 字段盘点（与 `inspectPage` 交叉校验）→ filllog 的 `xpathCount` / `xpathCandidates`。

> 早期规则参考过另一个扩展项目的做法，但本文件**不与任何外部项目同步**，
> 也没有"厂商包/适配层"之分；改动直接改这一个文件。

- 单文件、无依赖、不依赖 `chrome.*`，`addScriptTag` / `evaluate` 均可注入
- **不自动运行、不自动下载**：由调用方显式 `PageScanner.scan()`
- 一个 UI 状态扫一次，输出「字段清单 + 表格摘要 + wire 定位候选」
- 字段单位 = 一个 `.el-form-item`；工具栏按钮单独成条；表格单独进 `tables[]`

配套的测试/验证/探路工具已剥离到独立子项目 **`tools/page-scanner/`**
（本文件是**唯一运行时脚本**，测试侧按路径引用，不复制副本）：

| 位置 | 用途 |
|---|---|
| `tools/page-scanner/test/selftest.js` | 离线自测（48 项断言，无需登录） |
| `tools/page-scanner/bin/scan-verify.js` | 真实页面验证 CLI |
| `tools/page-scanner/bin/probe-template.js` | 多状态探路模板 |
| `tools/page-scanner/lib/scan-probe.js` | 采集 + 三层校验 + 标注截图 + 报告 |

用法与判定标准见 `tools/page-scanner/README.md`，本文下方 §8 为摘要。

---

## 1. 用法（Playwright）

```js
const fs = require('fs')
const SCANNER = '.opencode/skills/playwright-ui-recorder/scripts/page-scanner.js'

await page.addScriptTag({ content: fs.readFileSync(SCANNER, 'utf8') })

const inv = await page.evaluate(() => PageScanner.scan())      // 同步扫当前状态
const inv2 = await page.evaluate(() => PageScanner.run())      // 等 DOM 稳定再扫

fs.writeFileSync(`work/${task}/scans/${state}.json`, JSON.stringify(inv, null, 1), 'utf8')
```

- 建议在自己的 `settle()` 之后扫，避免半渲染。
- **视口必须 1440×900**（与 spec / 回放 profile 一致），否则 `rectNorm` 无意义。
- 每个状态（列表 / 弹窗 / 抽屉 / 页签）各扫一次；有弹窗时默认只扫弹窗（`scope: 'modal'`）。
- 没有 `download()`：直接拿返回值落盘，避免 Playwright 下载事件干扰。

```js
// 需要连隐藏字段一起盘（补录清单）
const invAll = await page.evaluate(() => PageScanner.scan({ visibility: 'none' }))
// 需要整页 + 弹窗一起盘
const invFull = await page.evaluate(() => PageScanner.scan({ scope: 'page' }))
```

---

## 1.1 直接在浏览器控制台测（不用装 Node）

这是最快的真实页面验证方式，适合人工核对：

1. 打开被测页面，`F12` → Console
2. 粘贴 `page-scanner.js` 全文（首次需先输入 `allow pasting`）
3. 依次执行：

```js
PageScanner.scan()       // 扫描当前状态，返回对象并缓存
PageScanner.annotate()   // 在页面上画框 + 编号（编号 = report 表里的 #）
PageScanner.report()     // 控制台表格 + 返回 markdown（可直接贴 plan.md）
PageScanner.selfCheck()  // L1 漏/多 + L2 定位回代（页内完成，不需要 Playwright）
PageScanner.download()   // 下载 inventory.json
```

**判读方式**：

| 现象 | 结论 |
|---|---|
| 页面上有表单项但**没有框** | 漏扫 |
| 红框 / 灰框 / 橙框 | 可操作 / skip（只读、禁用）/ 需复核 |
| 框编号与旁边标签不符 | XPath 落错了元素（`selfCheck` 会点名） |
| `selfCheck` 报 `L1 漏/多` | `missing` / `extra` 会列出具体标签 |
| `selfCheck` 报 `L2 硬失败` | 该字段 XPath 回代失效或落错元素 |
| `selfCheck` 报 `L2 软告警`（歧义/位置偏差） | 同名标签、单选组，通常预期内，逐条确认 |

- **滚动时框会自动跟随**（每次滚动按元素实时位置重算），不需要重新执行；
  视口外的字段在滚到它时自动出现，图例会显示「视口内 N / 视口外 M」
- 移除标注：`PageScanner.annotate('off')`，或点右上角图例里的「移除标注」
- 控制台版没有标注截图/HTML 报告（那需要 Playwright，见 §8），但 `selfCheck` 的机器对拍能力相同
- 扫描包含**需要滚动才能看到**的字段（DOM 全量），所以标注也是全量的，不只是首屏
- 每次只扫**当前状态**：打开弹窗/抽屉后要重新 `scan()` + `annotate()`

---

## 2. 输出结构

```json
{
  "schema": "ui-agent1.scan-inventory",
  "schemaVersion": 1,
  "version": "2.0.0",
  "url": "http://test.creditv5p2.tansun.com.cn/#/...",
  "route": "#/cstMgt/...",
  "pageName": "客户管理-客户信息维护-对公客户管理",
  "scope": "modal",
  "scopeTitle": "新增客户",
  "viewport": { "width": 1440, "height": 900, "rectBase": { "width": 1440, "height": 900 } },
  "elapsedMs": 180,
  "stats": {
    "fields": 42, "formItems": 40, "coverage": 1,
    "required": 9, "actionable": 38, "hidden": 0,
    "needsReview": 2, "wireBad": 1,
    "excluded": 3, "tables": 1, "roots": 1,
    "byAction":  { "input": 20, "select:click": 10, "click": 8, "skip": 2 },
    "byControl": { "input": 18, "select": 10, "date": 4, "switch": 2, "readonly": 2 }
  },
  "warnings": [ { "code": "WIRE_XPATH_AMBIGUOUS", "label": "客户名称", "xpath": "...", "message": "..." } ],
  "groups": [ { "path": ["对公客户概况"], "name": "对公客户概况", "count": 21 } ],
  "fields": [ /* §2.1 */ ],
  "tables": [ /* §3 */ ]
}
```

`stats` 里几个用于门禁的指标：

| 指标 | 含义 | 期望 |
|---|---|---|
| `coverage` | 已产出字段的 `.el-form-item` / 视口内总数 | `1`（`<1` 表示被排除规则吃掉） |
| `wireBad` | 可操作字段里 `wireCount !== 1` 的数量 | `0`（非 0 必定要修 wire 再回放） |
| `needsReview` | 需要人确认的字段数 | 越小越好，逐条看 `reviewReasons` |

### 2.1 `fields[]`

| 字段 | 说明 |
|---|---|
| `stableKey` | 确定性主键 = hash(page + groupPath + label + controlType)，跨状态 diff / 门禁用 |
| `seq` | 视觉顺序（页面先、弹窗后；同作用域 top→left），与 `inspectPage` 口径一致 |
| `group` / `groupPath` | 组件块链（折叠节 / 页签 / 弹窗标题） |
| `label` / `labelRaw` | 标签；`label` 已按 fillEngine 口径去掉 `*` 与空白 |
| `controlType` | `input` `number` `textarea` `select` `multiselect` `tree-select` `date` `switch` `radio` `checkbox` `upload` `button` `button-group` `link` `readonly` |
| `action` | wire 动作：`input` / `select:click` / `click` / `skip` |
| `required` | `.is-required` / label 星号 / `.el-icon-asterisk` / 原生 required |
| `disabled` / `actionable` | `.is-disabled`、`aria-disabled`、原生 disabled；`actionable=false` → `skip` |
| `value` | 当前值（修改/查看类交易取证用） |
| `options` | 下拉/单选/多选的可选项文本（下拉需面板已渲染，见 §6） |
| `inlineButtons` | 字段内行内按钮（`选择` / `获取地址` / `引入` / `测算`）→ address/import/calc 分支 |
| `controlCount` / `controls[]` | 一个表单项内多个控件时（如日期区间），逐个给 `wireXPath` + 命中数（用 `[n]` 索引） |
| `wireXPath` | **可直接写进 wire `elementType` 的 XPath**（见 §4） |
| `wireCount` / `wireVisibleCount` | 命中数 / 其中可见数 → **filllog 的 `xpathCount`** |
| `wireCandidates` | 备选 XPath + 各自命中数（默认 3 条）→ **filllog 的 `xpathCandidates`** |
| `wireOptionTemplate` | 单选/多选按选项定位的骨架：`...[normalize-space(.)='{option}']` |
| `rect` / `rectNorm` | 表单项框（视口坐标）/ 1440×900 归一化，与 `fillEngine.norm()` 完全一致 |
| `needsReview` / `reviewReasons` | `UNNAMED` `WIRE_XPATH_NOT_FOUND` `WIRE_XPATH_AMBIGUOUS` `SHADOW_UNSUPPORTED` `IFRAME_UNSUPPORTED` `UNKNOWN_CONTROL` `HIDDEN` |
| `inDialog` / `inDrawer` / `inPopover` / `scopeTitle` | 作用域归属（wire `popup` 节点用） |

`format: 'full'` 时额外带 `chain`、`css`、`framePath`、`shadowPath`（排障用，正常不需要）。

---

## 3. `tables[]`

```json
{
  "title": "", "scope": "page",
  "headers": ["客户编号", "客户名称", "操作"],
  "rowCount": 2,
  "rows": [["C0001", "甲公司", "查看修改"], ["C0002", "乙公司", "查看修改"]],
  "hasRowRadio": true, "hasRowCheckbox": false,
  "rowActions": ["查看", "修改"],
  "rowActionXPathTemplates": ["//tr[contains(.,'{anchor}')]//button[translate(normalize-space(.),' ','')='查看']"]
}
```

用于列表类交易：表头→列映射、首行真实数据、行操作文案、是否行单选。
表体元素**不**进 `fields`（避免元素爆炸）。

---

## 4. `wireXPath` 生成规则

与 `reference/robust-locators.md` 完全一致，**第 1 条就是回放引擎会用的 primary**：

| 控件 | XPath |
|---|---|
| 表单输入 | `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户名称']]//input` |
| 下拉/多选/树选 | `...]//div[contains(@class,'el-select')]`（**点容器，不点内部 input**） |
| 开关 | `...]//div[contains(@class,'el-switch')]` |
| 日期 | `...]//input` |
| 行内按钮字段 | `...label='行业代码'...]//button[translate(normalize-space(.),' ','')='选择']` |
| 工具栏按钮 / 链接 | `//button[translate(normalize-space(.),' ','')='查询']` / `//a[...]` |
| 弹窗/抽屉/浮层内 | 自动加 `//div[contains(@class,'el-dialog|el-drawer|el-popover')]` 前缀 |

- 按钮文本用 **去空格精确匹配**（`translate(...,' ','')`）——规避 headed 中文下「查 询」的坑。
- 标签同时给"精确"和"去空格"两种候选，前者命中就停。
- 多控件字段用 `[1]`/`[2]` 索引区分（如日期区间两个 input）。

---

## 5. 接到录制链路（三个接入点）

### 5.1 探路（替换 `probe_template.js` 的三段 evaluate）

`FIELDS` / `OPTS` / `OVERLAYS` 三段换成一次 `scan()`：

```js
const fields = inv.fields.filter(f => f.action !== 'skip')
// 只对「面板还没渲染」的下拉补点开枚举，而不是每个 select 都点
const needOpen = fields.filter(f => /select/.test(f.controlType) && f.options.length === 0)
```

**保留** probe 里的 API 抓包（`waitForResponse` / `page.on('response')`）——
扫描器不知道"筛选参数是否真的生效"。表头首行改用 `inv.tables`。

### 5.2 盘点交叉校验（防漏字段）

```js
const scanKeys = new Set(inv.fields.map(f => f.group + '|' + f.label))
const planKeys = new Set(plan.map(p => p.group + '|' + p.label))
// scanKeys - planKeys → 漏盘；planKeys - scanKeys → 类型映射/排除规则异常
```

`stats.coverage < 1` 说明有 `.el-form-item` 被排除规则吃掉，先查 `stats.excluded`。

### 5.3 filllog 的 `xpathCount` / `xpathCandidates`

```ts
const hit = inv.fields.find(f => f.group === group && f.label === label)
entry.xpath = hit.wireXPath
entry.xpathCount = hit.wireCount
entry.xpathCandidates = hit.wireCandidates     // [{xpath, count, visibleCount}]
```

gen-wire 消费规则：

| `xpathCount` | 回放表现 | 处理 |
|---|---|---|
| `1` | 正常 | 放行 |
| `0` | `waitForVisible` 超时 | 拒绝出报文 |
| `>1` | `PageHelpers.byXpath` 是 `.first()`，**静默取第一个**（可能点到隐藏模板/同名框） | 拒绝，用 `wireCandidates` 挑 `count===1` 的替换 |

> `filllog` 里那条 XPath 必须和 gen-wire 最终写进 `elementType` 的字符串**完全一致**，否则测的不是同一条路径。

---

## 6. 配置

```js
window.PAGE_SCANNER_CONFIG = { /* 全局默认 */ }
PageScanner.scan({ /* 单次覆盖 */ })
```

| 项 | 默认 | 说明 |
|---|---|---|
| `format` | `inventory` | `full` 时额外输出 `chain/css/framePath/shadowPath` |
| `scope` | `modal` | `modal`：有可见弹窗时只扫该弹窗；`page`：整页 |
| `visibility` | `strict` | `strict` / `loose`（忽略 opacity:0）/ `none`（含隐藏，做补录清单） |
| `includeTables` | `true` | 输出表格摘要 |
| `tableRowLimit` | `3` | 摘要保留行数 |
| `includeButtons` | `true` | 是否输出工具栏按钮/链接 |
| `wireCandidateLimit` | `3` | 每字段候选 XPath 数 |
| `maxFields` | `800` | 超过则截断并告警 |
| `excludedSelectors` | 见文件 | 第三方浮窗（含 shadow 内）、分页组件 |
| `excludedKeywords` | `[]` | 按文本排除（如「上一页」） |

兼容别名：`scanOpenModalOnly:false` → `scope:'page'`；`visibilityMode` → `visibility`。

自动排除的第三方浮窗：`position: fixed/sticky` 且（`z-index ≥ 1000000` 或 面积 < 200×200 且内部无表单项）的 shadow 宿主，整体跳过。

---

## 7. 能力边界

- **下拉选项**：面板未渲染时 `options` 为空。补法：probe 点开一次再扫第二遍，或只对 `options.length === 0` 的 select 枚举。
- **静态唯一 ≠ 回放唯一**：`wireCount` 是扫描时点的结果；弹窗叠加、行数据变化、隐藏模板都会改变它。所以 wire 预检必须在**录制时点的状态**做（这正是把 `xpathCount` 写进 filllog 的原因）。
- **Shadow DOM / 跨域 iframe**：无法生成 wire XPath，标 `SHADOW_UNSUPPORTED` / `IFRAME_UNSUPPORTED`，不要硬接。
- **业务语义不猜**：`industry` / `calc` / `address` / `import` 的判定仍由 `fillEngine` 按 label 规则决定；扫描器只提供 `inlineButtons` 等事实。
- 不替代 `runFillPlan`（值、回读断言、`DYN_GONE`、子流程点击序列）。
- 表格内的控件不进 `fields`（统一走 `tables[]`）。

---

## 8. 怎么验证「扫得对不对」

fixture 自测只能证明"代码没退化"；**真实页面 + 多状态**才是有说服力的验收。
所以验证分两层：**回归自测（fixture）** + **真实页面核对（标注图 + 对拍）**。

判断正确性依赖三个来源，互相之间不是同一份实现：

| 来源 | 作用 |
|---|---|
| **A 页面视觉**（标注截图） | 人眼最终裁决：页面上有没有字段没被框住 |
| **B 扫描器输出**（fields） | 待验证对象 |
| **C Playwright 独立枚举** | 机器对拍：漏字段 / 多字段 / 定位歧义 |
| D 接口返回（列表页） | 表头、首行、total 的独立来源 |

### 8.1 一条命令：真实页面标注核对

```bash
node tools/page-scanner/bin/scan-verify.js \
  --url "http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg" \
  --state 列表 --fill 3
```

产物在 `work/scans/verify/`：

| 文件 | 用途 |
|---|---|
| `<state>.html` | **核对页**：标注图 + 汇总 + 字段表（图上编号 = 表里 `#`） |
| `<state>.annotated.png` | 标注截图：每个字段画框并编号；灰=skip，橙=需复核，红=可操作 |
| `<state>.inventory.json` | 完整扫描结果（可直接喂 fillEngine / gen-wire） |
| `<state>.verify.json` | L1 漏/多、L2 硬失败与软告警、L3 结果 |
| `<state>.md` | 表格版核对清单（贴进 plan.md 用） |

**看图的判定逻辑**（这是替代"JSON 逐条对页面"的关键）：

- 页面上有表单项但**没有框** → 漏扫（最典型的漏字段）
- 表里有编号但图上没框 → 元素在视口外，或定位异常
- 框的编号与标签对不上 → XPath 落到了别的字段
- 灰框（skip）本该是输入框 → 控件类型/disabled 判定错

> 标注图是**按视口**截的（本平台多是内部容器滚动，整页截图会对不准）。
> 视口外的字段会在报告里注明数量；滚动后对该区域再 `capture` 一次即可。

### 8.2 多状态：在探路脚本里逐状态采集（推荐）

真实页面不是单张，录制会经过列表、抽屉、弹窗、二级弹窗、页签……最可靠的做法是
**在探路/录制脚本里，每到一幕就扫一次**，最后自动汇总：

```js
const { capture, writeIndex } = require(
  require('path').resolve(process.cwd(), 'tools/page-scanner/lib/scan-probe'))

const page = await ctx.newPage()
await page.goto(URL)
await capture(page, '01-列表', { outDir: 'work/<task>/scans', fill: 3 })

await page.getByRole('button', { name: '新增' }).click()
await capture(page, '02-新增抽屉', { outDir: 'work/<task>/scans' })

await page.locator('.el-drawer').getByRole('button', { name: '引入' }).click()
await capture(page, '03-引入弹窗', { outDir: 'work/<task>/scans' })

await writeIndex('work/<task>/scans', null, { task: '<task>' })
```

生成的 `work/<task>/scans/index.html` 是**汇总页**：每个状态一行，点进去就是该状态的标注图 + 字段表，
硬失败/软告警数量直接列出来。一次探路跑完，全部状态一次性核对。

### 8.3 判定标准

| 级别 | 指标 | 通过线 |
|---|---|---|
| 硬 | L1 `missing` / `extra` | 都为 0 |
| 硬 | `stats.coverage` | `= 1` |
| 硬 | L2 `hard`（含 XPath 落错字段、命中数不符） | 0 |
| 硬 | L3 抽样填充 | 全 ok |
| 软 | `wireBad` / L2 `soft` | 逐条确认：单选组、同名标签属预期；其余要修 |
| 软 | `needsReview` 原因 | `UNNAMED`（图标按钮）、`WIRE_XPATH_NOT_FOUND`（label 不符）需处理 |

### 8.4 fixture 自测（回归用，不替代真实页面验收）

```bash
node tools/page-scanner/test/selftest.js --report work/_selftest.txt
```

48 项断言，覆盖：必填/只读/禁用、`switch`/`radio`/`select`/`button-group`、下拉选项、
行内按钮、第三方浮窗排除、表格内控件排除、shadow 标记、弹窗作用域前缀、同名标签歧义、XPath 回代。

| fixture | 覆盖点 |
|---|---|
| `tools/page-scanner/test/fixtures/scan-fixture.html` | 表单语义、表格摘要、排除规则、shadow 字段 |
| `tools/page-scanner/test/fixtures/scan-modal-fixture.html` | 弹窗作用域、`scopeTitle`、同名字段（弹窗内唯一 / 页面层歧义） |

改动扫描器后先跑这个（秒级），再到真实页面跑 `scan-verify.js` / `capture()`。
