---
name: playwright-ui-recorder
description: 指引智能体端到端完成 UI 交易录制：需求拆分(原子交易)→页面探路(字段/弹窗/API)→Playwright spec(组件分块字段盘点+按序填充+弹窗子流程+API断言)→生成 partner wire 报文(page/popup/ele 三层结构)→回放引擎确定性验证。保证录制完整(每个组件全字段、列表全部查询框、弹窗层级区分)与脚本健壮(标签锚定 XPath+文本按钮+API 断言，界面小改后可自愈执行)，产物可直接用于数据填充、执行与案例编排。Use when 用户要求录制 UI 交易、录制测试用例、生成 wire 报文、录制某业务模块、wire 报文、回放验证。触发关键词：录制、交易录制、wire 报文、wire、用例录制、组件录制、弹窗录制、列表查询录制、回放验证。
---

# UI 交易录制（智能体全流程）

**图片查看统一规则**：录制准备、探路、录制和回放中需要理解截图或原型时，无论主模型是什么，必须先使用 [qwen-record-replay-vision](../qwen-record-replay-vision/SKILL.md)，通过其脚本调用 `opencode.json` 中的 `Qwen3.8-27B`，再依据文字分析继续；调用失败时报告，不自行看图或切换模型。

把「页面人工操作」沉淀为**可重复回放、可编排、可自愈**的 wire 交易报文。
核心不是 Playwright codegen（人工点击录制），而是**智能体驱动的引擎化录制**：
先探路摸清页面结构 → 用 fillEngine 逐字段引擎化填充并录取 → 落盘 wire 报文 → 用 replay-skill 回放验证闭环。

```
需求文档 ──► ①原子交易清单 ──► ②探路(probe) ──► ③spec 录制(fillEngine)
                                                       │ filllog JSON + values JSON
                                                       ▼
⑥回放验证(replay-skill) ◄── ⑤wire 报文生成(gen-wire) ◄─┘
```

## 目录与产物约定

| 路径 | 内容 |
|------|------|
| `tests/<module>/fillEngine.ts` | 录制引擎：`inspectPage` 组件盘点 + `runFillPlan` 逐项填充/断言/录取（跨交易复用，勿每交易重写） |
| `tests/<module>/fillSubflows.ts` | 弹窗/浮层子流程：地址联动弹窗、行业树 popover、引入弹窗、测算按钮等，每步返回 `DialogStep[]` |
| `tests/<module>/C<n>-<name>.spec.ts` | 每个原子交易一个 spec |
| `work/<task>/probe_*.js` | 探路脚本（headless，复用 auth 登录态） |
| `work/<task>/filllog-C<n>.json` | 引擎输出：逐项 {seq,group,label,req,type,action,value,ok,note,rect,steps}，wire 数据源 |
| `work/<task>/c<n>-values.json` | spec 落盘：本次实际录入值+rect（供 gen-wire 读，保证 wire 值=spec 值） |
| `work/<task>/gen-wire*.js` | filllog → wire 生成器 |
| `work/<task>/plan.md` | 交易清单表 + 探路技术结论 + 回放验证记录（**每步都要记**） |
| `partner-wire/<module>/C<n>-<name>.json` | 最终 wire 报文（交付物，文件名自然序=编排执行序） |
| `replay-skill/` | 回放引擎（**只读，禁改逻辑**，只能改 wire/profile） |
| `replay-skill/profiles/<profile>.json` | 平台回放配置（homeRoute/pages/popups/backButtonText/settle） |

## 阶段 0：环境准备

1. 环境自检：`powershell -File .opencode/skills/playwright-ui-recorder/scripts/check_env.ps1`
2. 登录态：`auth.json`（storageState，约 50 分钟有效）。过期时用 `work/<task>/login_direct.js` 模式刷新：
   chromium 直开登录页 → 录账号密码 → 跳到 homeRoute → `context.storageState({path:'auth.json'})`。
3. **视口必须 1440×900**，与回放 profile 一致。playwright.config 默认 Desktop Chrome=1280×720，
   所以 spec 开头要 `await page.setViewportSize({ width: 1440, height: 900 })`，否则 rect 全偏。
4. 内网装浏览器需镜像：`$env:PLAYWRIGHT_DOWNLOAD_HOST="https://cdn.npmmirror.com/binaries/playwright"; npx playwright install chromium`

## 阶段 1：需求 → 原子交易清单

1. 读需求文档（docx/md 用 doc-requirement-analyst 系列 skill 切片），按功能点逐条映射。
   **推荐前置**：先用上游 skill `req-doc-record-steps` 生成原子交易操作步骤表（两列：交易名称|操作步骤描述，
   含界面原型解析+不录项），经用户确认后直接作为本阶段交易清单输入，跳过手工拆单。
2. **1 个 spec = 1 个原子操作**：有独立「保存/暂存/确定」动作或独立业务语义的动作各成一单
   （列表查询、列表重置、新增-场景A、修改、查看、弹窗内操作…）。
3. 组件分块规则：一个场景页按 `[aria-expanded]` 分节（如 对公客户概况/客户标签/股东及关联人信息/经营情况），
   **每个组件块 = 1 个独立原子操作**，各自盘点+填充+暂存，不混在一个 spec 里。
4. 在 `plan.md` 建交易清单表：`# / 交易名 / 覆盖需求点 / 前置依赖 / 状态(⬜待录|✅已录已回放)`。
5. 明确**不录项**及原因（外部依赖、不在范围），写入 plan.md。
6. **数据策略**（为后续案例编排服务，提前定好）：
   - 新建类：名称=前缀_场景_时间戳（`AT_潜客_YYYYMMDDHHmmss`），唯一码=随机生成（如 18 位 USCC，字符集 `0-9A-HJ-NP-RT-UW-XY`），**避免用例间数据依赖**；
   - 修改/查看/查询类：用**列表首行真实数据**（按表头映射读，见阶段 3），或固定存在的基准客户；
   - 唯一码**只能被消费一次**（提交即入库）→ 回放前必须刷新数据（见阶段 5）。

## 阶段 2：页面探路（录制前必做）

写 `work/<task>/probe_*.js`（模板见 `scripts/probe_template.js`），headless 复用 auth 登录态，逐项确认：

- [ ] 每个字段的**控件类型**：input / textarea / select(下拉) / date / switch / 按钮辅助（选择/获取地址/引入/测算）/ 只读反显
- [ ] select 的**全部可选项**（打开下拉枚举 innerText）
- [ ] 关键**API**：URL、method、请求体参数名、响应结构（`waitForResponse` 抓）
- [ ] 列表**表头与首行值**（哪些列有值、哪些恒空）
- [ ] **弹窗/浮层**：dialog / drawer / popover 的 DOM 结构、标题文本、是否多个同类浮层（如 12 个 popover）
- [ ] 场景页**路由规则**（URL 参数决定场景变体）
- [ ] 筛选参数**是否真的生效**（发两次请求对比 total）——有 API 会默默忽略参数

结论写进 plan.md「已确认技术事实」，例如：
`findCustCorporatList 忽略 rtgCstClId 参数 → 客户分类列恒空 → wire 里客户分类选固定选项「发展巩固类」`。
**探路没确认的，不许直接写 spec。**

## 阶段 3：spec 录制（核心）

复用模块的 `fillEngine.ts`（新模块参照 `tests/corp/fillEngine.ts` 移植，勿手抄重复代码）：

### 3.1 组件盘点（完整性保证的第一道关）

```ts
await openAllSections(page);            // 展开全部 [aria-expanded] 节（含隐藏的）
const plan = await inspectPage(page, '对公客户概况');  // 只盘点指定组件块
```

- `inspectPage` 输出 `FieldItem{seq, group, label, req, type, btns}`，按**视觉顺序**（top→left）排列；
- type 分类：`skip`（只读/系统反显）/ `input` / `textarea` / `select` / `date` / `switch` /
  `address`（行内按钮「选择/获取地址」）/ `industry`（行业树 popover）/ `import`（行内按钮「引入」）/ `calc`；
- **必须展开「更多/展开」类折叠区后再盘点**，否则漏字段；
- spec 里断言 `plan.length` 下限，防止字段静默丢失。

### 3.2 逐项填充（runFillPlan）

- 严格按盘点顺序逐项填 → **值回读断言**（`itemValue` 读回 == 录入值，不假设成功）→ 录 `rect`（归一化 1440×900）→ 写 `filllog-C<n>.json`；
- `DYN_GONE` 容错：前序选择会**动态移除/隐藏**某项（如 归属人=本人 → 姓名/身份证消失）→ 记 `ok=true, note=DYN_GONE`，不算失败；
- 每步前 `ensureDialogsClosed`：检测残留 dialog/message-box/popover 并强关，防止互相阻塞；
- spec 结束断言 `fillLog.filter(l => !l.ok).length === 0`。

### 3.3 弹窗/浮层子流程（fillSubflows）

每个「行内按钮」类字段走子流程，返回 `{ok, note, steps: DialogStep[]}`，`DialogStep{dialog, action, target, value, rect}`：
- 地址五级联动弹窗（省份预填→城市→区/县→详细地址→确认→回写断言）；
- 行业代码树（popover 内 el-tree：真实鼠标点击打开、树内搜索框+查询、**叶子节点**精确点击）；
- 引入弹窗（对私客户查询：输入→查询→确认空查）；
- 测算按钮（点击→断言结果回显）。
子流程的 steps 是 wire 里 popup 节点内部步骤的**唯一数据源**。

### 3.4 断言要求（健壮性核心）

- **关键跳转用 API 断言**：`page.waitForResponse(urlMatcher)` 断请求参数+响应 code/total，禁止固定 sleep 等页面；
- 初始化断言：默认带出/应显隐的字段（如 客户状态 默认=信贷预客户）；
- 暂存/保存：断 API 200 + **列表反查**（用创建的名称查询，total=1 且首行=该客户）；
- 查询类：断请求体**每个参数都发出** + 响应 total。

### 3.5 数据填充落盘（为案例编排服务）

- spec 开头生成 `ctx`（FillCtx：uscc/phone/addrDetail/tag…），**生成规则写进 plan.md 数据策略节**；
- spec 结束把「本次实际录入值 + rect」写 `work/<task>/c<n>-values.json` → gen-wire 读它，
  保证 wire 里的值与 spec 真实录入值一致（修改/查看类的值来自列表首行，同样落盘）；
- 列表首行取值 helper：按**表头文字**映射列（`readFirstRow`），不依赖列序号。

## 阶段 4：wire 报文生成（案例编排交付物）

用 `work/<task>/gen-wire*.js` 从 filllog(+values json) 生成 `partner-wire/<module>/C<n>-<name>.json`。
**完整 schema、PID 层级树规则、字段说明见 `reference/wire-schema.md`。** 要点：

### 4.1 三层结构（层级区分）

- `type=page`：页面结构步，`propertiesPID="0"`。**场景切换（进入场景页/返回列表）必须插 page 步**；
- `type=popup`：弹窗/抽屉/浮层结构步，`propertiesPID` = 触发它的 click 步 id；弹窗**内部**步骤的 pid = popup 步 id；
- `type=ele`：元素操作（`click`/`input`/`select:click`），`mothed=By.XPATH`，XPath 放 `elementType`，值放 `objectValue`；
- **导航后**：新 page 步的 `propertiesPID` = 触发导航的那个 click 步 id（不是 0）；
- `propertiesID` 从 "1" 起整单递增；rect 为归一化 `{"x1","y1","x2","y2"}` JSON 字符串。

### 4.2 定位规则（自愈核心，详见 `reference/robust-locators.md`）

- 表单项：`//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='<标签>']]//input`（select 换 `//div[contains(@class,'el-select')]`）——**标签锚定**，类名/顺序变化不影响；
- 弹窗内：前缀 `//div[contains(@class,'el-dialog')]`；抽屉 `//div[contains(@class,'el-drawer')]`；浮层 `//div[contains(@class,'el-popover')]`；
- 按钮：`//button[normalize-space()='<文本>']`——文本锚定，不用按钮顺序。

### 4.3 完整性校验（生成后必跑）

```js
// dup=0 badPID=0 noRect=0 才算通过
```
- `dup`：propertiesID 无重复；`badPID`：每个 PID 指向一个**更早存在**的 id；`noRect`：ele 步必须有 rect；
- 步数对账：wire 步数 = filllog 有效步 + 结构步，打印 `fills=N/M`。

## 阶段 5：回放验证（独立闭环）

```powershell
node replay-skill/replay.mjs partner-wire/<module> --profile replay-skill/profiles/<profile>.json --out partner-wire/<module>/replay-out
node replay-skill/replay.mjs partner-wire/<module> --profile <p> --only "交易名关键字"   # 单交易调试
```

- **回放前必做**：① 刷新数据（`refresh_wire_data.js` 模式：重新生成时间戳名+随机码，**值级替换** wire 里的 objectValue）；
  ② 刷新 auth（`login_direct.js`）。即使上次运行失败，唯一码也可能已被消费，**每次回放前都要刷新**。
- **必须用目标平台的 profile**（默认 profile 没有该页字段配置会 20s 超时假失败）。profile 要配 homeRoute、
  pages（路由→页面映射）、popups（弹窗标题匹配）、backButtonText、settle 等待。
- 失败分诊（先判类再动手）：
  | 类别 | 特征 | 处理 |
  |------|------|------|
  | 数据依赖 | 数据已存在/被消费/查不到 | 刷新数据重放，不改 wire |
  | wire 定位 | 元素找不到/选错 | 修 wire 的 XPath/值/动作类型 |
  | 引擎语义 | 动作类型不匹配场景（如树用了 select:click） | 换 wire 的 eventTypeValue，**不改引擎** |
- **铁律：replay-skill 引擎代码一律不改，只能改 wire 和 profile。**
- 全绿后：plan.md 记回放结果（N/N、耗时、时间戳），交易状态打 ✅。

## 完整性 Checklist（交付前逐条过）

- [ ] 页面所有 `.el-form-item` 已盘点（含折叠节、「更多」展开后、只读项标 skip）
- [ ] 列表查询的**每个查询框**都录入（含折叠区内的），不只做主流程
- [ ] 每个组件块独立 spec，各带保存/暂存动作
- [ ] 所有弹窗/浮层有对应 `popup` 步 + 内部 ele 步（抽屉/对话框/树 popover/日期面板）
- [ ] 每个暂存/保存有 API 断言 + 列表反查
- [ ] 初始化断言（默认值/显隐）
- [ ] wire 校验 dup=0 / badPID=0 / noRect=0
- [ ] 回放前刷新了数据+auth，回放 N/N 全绿
- [ ] plan.md 记录了不录项及原因、探路结论、回放结果

## 健壮性/自愈原则（详见 `reference/robust-locators.md`）

1. 标签锚定 XPath（`normalize-space` 容忍换行/空格）——不依赖 id/序号/类名 hash；
2. 按钮文本锚定，不用第 N 个按钮；
3. 不用裸 `.first()`：DOM 序假设会翻车（隐藏模板节点、重复文本），先语义过滤再取；
4. 值回读断言代替「假设成功」；页面跳转用 `waitForResponse` 代替 sleep；
5. DYN_GONE 容错（动态显隐字段跳过不报错）+ 残留弹窗自清理；
6. 数据自更新（时间戳+随机唯一码，回放前批量刷新）；视口 1440×900 三处一致；
7. 回放引擎自带自愈（路由直达/返回按钮回归/可见性过滤/settle 等待）——**wire 只需语义正确**，
   界面微调（类名改、布局挪）只要标签文本不变就能自愈。

## 已知坑（摘要，全表见 `reference/pitfalls.md`）

- 日期填完 picker 不自动关，挡后续点击 → wire 插「关日期面板」click 步（点 label，**不能点 form-item**，会落 disabled input）；
- 行业树：页面有 12 个 popover，过滤后 `.first()` 还是隐藏节点 → 用文本+叶子特征精确定位；
- `select:click` 语义=点字段→等下拉→选选项，**不适用于树**；树用 `click` 开 + 叶子 `select:click`；
- 嵌套隐藏模板弹窗（取消按钮 DOM 序在前）→ 用 `is-fullscreen`+`dialog-footer` 锚定；
- radio 的 XPath 限定 `.el-table__body`（表头有隐藏 radio）；
- spec 视口 1280×720 ≠ profile 1440×900 → rect 偏移/负值；
- API 可能忽略筛选参数 → 探路验证筛选真实生效，否则选固定选项；
- 唯一码消费一次 → 回放前必刷新（失败运行也消费）；
- label 含空格/换行 → XPath 用 `normalize-space(.)`；「更多」展开前后布局不同 → rect 在**最终形态**下量。

## 附录：人工 codegen 录制（辅助手段）

仅当用户明确要求「人工操作录制」时用；智能体录制（上文 6 阶段）不依赖它。

```powershell
npx playwright codegen -b chromium --target playwright-test -o tests/<name>.spec.ts --load-storage auth.json <url>
```

- 阻塞到用户关闭录制窗口，bash timeout 给 `1800000`；运行前告诉用户：正常操作页面→侧边栏实时出码→点 Save 再关窗口。
- 常用参数：`--viewport-size 1440,900`、`--proxy-server`、`--ignore-https-errors`、`--save-storage auth.json`（首录登录）。
- 录完整理：核对步骤完整 → 关键步补断言 → 文案/数据抽变量 → 标题改业务语言 → `npx playwright test` 验证。
- 注意：npm 包名固定 `ui-recorder-agent`（中文目录名非法）；iframe/弹窗先切焦点再操作。
