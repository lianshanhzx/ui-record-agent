# wire-replay — 录制报文回放引擎

按录制的伙伴报文（wire JSON）确定性回放 UI 交易：**纯脚本执行（Playwright），无模型参与**。
给定报文 + 平台 profile，从第一步到最后一步跑通，产出逐步报告与截图。

## 架构（设计模式）

```
replay.mjs                      CLI 入口：解析参数 → 加载 Profile → 收集报文 → 回放 → 汇报
└─ src/
   ├─ config/
   │  ├─ CliArgs.js             参数解析（值对象）
   │  └─ Profile.js             平台配置加载 + 默认值合并
   ├─ wire/
   │  ├─ WireRepository.js      仓储：报文发现/加载/过滤（目录自然序）
   │  ├─ WireTransaction.js     领域模型：一笔交易（节点按 propertiesID 排序）
   │  └─ StepNode.js            领域模型：单个步骤节点
   ├─ browser/
   │  ├─ BrowserSession.js      门面：浏览器/登录态/导航（会话过期自动登录）
   │  ├─ PlatformLogin.js       策略：平台登录流程（profile.login 驱动）
   │  └─ playwright.js          Playwright 入口适配（playwright → @playwright/test）
   ├─ engine/
   │  ├─ ReplayOrchestrator.js  编排器：逐笔回放主流程 + 报告汇总
   │  ├─ StepRunner.js          模板方法：单笔交易骨架（执行→错误提示采集→截图→失败即停）
   │  ├─ StepContext.js         执行上下文（page/session/profile/下载队列/警告）
   │  ├─ executors/
   │  │  ├─ StepExecutor.js     策略基类
   │  │  ├─ PageExecutor.js     页面节点：根页直达/子页跳转校验(自愈)/下载完成校验
   │  │  ├─ PopupExecutor.js    弹窗节点：健壮 visible 等待
   │  │  ├─ EleExecutor.js      元素节点：委派 ActionFactory
   │  │  └─ StepExecutorFactory.js  工厂：node.type → 执行器
   │  └─ actions/
   │     ├─ ElementAction.js    策略基类
   │     ├─ InputAction.js      输入（input/textarea）
   │     ├─ SelectClickAction.js 下拉选择（el-select 弹层）
   │     ├─ ClickAction.js      普通点击 + 「断言N行」行数断言
   │     ├─ DownloadAction.js   下载捕获落盘
   │     ├─ RadioRowAction.js   单选行选中（行可见+强制点首列+断言 checked）
   │     └─ ActionFactory.js    工厂：动作类型+目标特征 → 动作
   ├─ web/PageHelpers.js         通用页面工具（可见等待/沉降/截图/行数/错误提示）
   ├─ report/
   │  ├─ ReportBuilder.js        建造者：报告模型 + JSON 落盘
   │  └─ ConsoleReporter.js      控制台汇报
   └─ util/log.js
profiles/tansun-credit.json      平台 profile（天阳信贷 test 环境）
```

## 用法

```
node replay.mjs <wire.json|目录> [--profile x] [--auth x] [--base url]
                [--headed] [--out dir] [--only kw] [--strict] [--step-timeout ms] [--list]
```

退出码：0=全部通过（WARN 允许），1=有失败，2=用法/环境错误。

## 报文规范（可回放范围）

- `transcationEventTypeList[].transcationProperties[]`，`propertiesID` 升序 = 操作顺序
- 节点 `type`：
  - `page`（PID=0 为根页面；其余为跳转检查点；`objectValue` 以 `.xlsx` 结尾 = 下载完成校验节点）
  - `popup`（弹窗可见检查点，selector 由 profile.popups 按页名匹配）
  - `ele`（`mothed=By.XPATH`，`elementType`=XPATH，`objectValue`=输入/选项值）
- ele 动作 `eventTypeValue`：`input` / `select:click` / `click`
  - click 子策略（按顺序判定）：profile.downloadTriggers 命中 → 下载动作；XPATH 含 `el-radio` → 单选行动作；否则普通点击
  - 步骤名含「断言…N 行」→ 点击后断言表格行数 = N

## 平台 profile 字段

见 `.opencode/skills/wire-replay/SKILL.md`「平台 profile 字段」。核心：`pages[{match,urlPattern,readySelector?,route?}]`
（页面节点名关键字 → URL 校验正则；`route` 有值时未自然跳转可自愈直达；`readySelector` 是表单挂载完成信号，解决微前端 URL 先到、内容后到）。

## 已知设计决策

- **弹窗健壮等待**：`filter({visible:true})` 轮询任一可见实例，规避残留隐藏 `.el-dialog` 导致 `.first()` 空等
- **单选行选中**：radio span 可能 hidden（el-table 固定列复制），改为"行可见 → 强制点首列 td → 断言 radio checked"
- **点击沉降**：networkidle(≤3s) + `settleAfterClickMs`，覆盖"重置后表单状态异步复位、立即查询带旧条件"一类时序问题
- **导航自愈**：报文可能漏录导航动作（如保存后「返回」未录）；页面节点 URL 不匹配时先点 profile.backButtonText 按钮返回，失败再直达注册 route，均记警告
- **下载文件名前缀匹配**：平台下载名带随机数字后缀（blackTemplate1339….xlsx）
- **错误提示哨兵**：每步后采集 `.el-message--error/.el-notification--error`，出现即记警告（strict 模式判失败）

## 依赖

Node ≥ 18，playwright（含 chromium）。首次：`npm run setup`。
