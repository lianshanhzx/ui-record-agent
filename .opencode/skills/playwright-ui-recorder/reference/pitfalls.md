# 已知坑清单（血泪记录）

按「现象 → 原因 → 对策」记。遇到新坑**必须补进本文件**。

## 日期

| 现象 | 原因 | 对策 |
|------|------|------|
| 日期填完后后续点击全部落空 | el-date-picker 面板填完 Enter 后**仍保持打开**，盖住下方字段 | wire 在日期步后插一个「关闭日期面板」click 步，XPath 点该字段的 **label**（`...//label`）；**不能点 form-item**（会落到 disabled 的输入框上，点不下面板） |
| 日期值读回不一致 | fill 后未等回写 | `page.keyboard.press('Enter')` + 短 settle 后回读断言 |

## 下拉/树

| 现象 | 原因 | 对策 |
|------|------|------|
| 行业树点击落空 | 页面 12 个 `.el-popover` 模板节点（多数隐藏），文本过滤后 `.first()` 还是隐藏节点 | 可见性过滤（offsetParent）+ 文本 + **叶子特征**（无展开箭头）精确定位 |
| 树里同名节点（分支 vs 叶子）点错 | 只有文本相同 | 叶子特征：节点无 `el-tree-node__expand-icon` 的 is-leaf 或无子节点；wire 用 `select:click` + 叶子 XPath |
| 用 `select:click` 点树失败 | `select:click` 语义=点字段→等下拉→选选项，树不是下拉 | 树 = `click` 打开 popover（点 `span.my-popover`，**合成事件无效必须真实鼠标**）+ 叶子 `select:click` |
| select 选中后值没回显 | 多个可见下拉同时打开 | 打开下拉后按**选项文本**过滤到含目标项的下拉再点（`filter({has: option}).last()`） |
| 默认 profile 下某页 select 20s 超时假失败 | 回放 profile 没有该页字段配置 | 回放必须 `--profile` 目标平台 profile（配 pages/popups） |

## 弹窗/浮层

| 现象 | 原因 | 对策 |
|------|------|------|
| 点到隐藏模板弹窗的「取消」 | 嵌套 dialog 模板在 DOM 序排在全屏框前面，`.first()` 命中隐藏节点 | XPath 加结构锚：`is-fullscreen` 类 + `dialog-footer` 作用域 |
| 弹窗确认按钮点了没反应 | 弹窗还在动画/异步数据未回 | 等 `.el-dialog:visible` 且含 input 再操作；确认后用 `waitForFunction` 等回写 |
| 某步后所有后续步骤卡死 | 上一步残留弹窗未关 | 每步前 `ensureDialogsClosed`；子流程结束复查记 `MODAL_STUCK` |
| radio 点到表头隐藏 radio | `.el-radio` 在表头也有（隐藏） | XPath 限定 `.el-table__body` |
| 小节头内嵌套按钮点不到/点错（button-in-button） | 「对公客户概况」等小节头内嵌小号文字按钮组（保存/暂存/返回）嵌套在小节头按钮内 → ARIA 树不独立暴露（`getByRole('button')` 拿不到）；`hasText` 模糊匹配会误中外部头按钮（点了**折叠小节**） | `page.evaluate + querySelectorAll('button')` 按 `innerText` **精确**匹配 + 可见性判断后 `.click()`；底部主按钮（返回/暂存）与节头同名小按钮**必须区分**（返回=底部 primary，y≈0.956）；小节可能默认折叠 → 先轮询 `aria-expanded=true`（~10s）再操作 |

## 视口/rect

| 现象 | 原因 | 对策 |
|------|------|------|
| rect 全偏/出现负值 | spec 用 playwright.config 默认 1280×720，profile 是 1440×900 | spec 开头 `setViewportSize({1440,900})`，与回放 profile 一致 |
| 「更多」展开前后 rect 对不上 | 布局变化 | rect 在**最终形态**（展开后）下测量落盘 |
| 抽屉里字段 rect 用页面坐标 | 测量作用域错 | 抽屉字段用抽屉内 `boundingBox`（相对视口即可，抽屉固定右半屏） |

## 数据/接口

| 现象 | 原因 | 对策 |
|------|------|------|
| 客户分类筛选无效果 | `findCustCorporatList` **忽略 `rtgCstClId` 参数**（前后 total 均不变） | 探路发两次请求对比 total 验证；无效参数 → wire 里该字段选固定选项，不指望它过滤 |
| 列表「客户分类」列恒空 | 接口 list[] 不返回该字段 | 首行取值时允许空；select 类查询框用固定选项兜底 |
| 回放查不到新建数据 / 名称已存在 | 唯一码（USCC）被上次运行消费；时间戳名重复 | 回放前必跑 refresh_wire_data.js（**值级替换** objectValue）+ login_direct.js 刷 auth；**失败运行也会消费唯一码** |
| auth 中途过期 | storageState 约 50 分钟有效 | 全量回放前刷新；单交易调试可复用 |
| 修改/查看用固定客户，客户被删/状态变 | 数据被其他测试动了 | 优先用列表**首行真实值**（readFirstRow 按表头映射）现查现用 |

## 其他

| 现象 | 原因 | 对策 |
|------|------|------|
| label 锚定找不到 | 标签含换行/全角空格 | XPath 一律 `normalize-space(.)` |
| 字段盘点漏项 | 折叠节未展开 / 「更多」未点 | `openAllSections` + 展开更多后再 `inspectPage`；spec 断言 plan.length 下限 |
| codegen 下浏览器超时 | 内网直连 cdn.playwright.dev 超时 | `PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright` |
| npm 报包名非法 | 工作目录中文名 | package.json name 固定 `ui-recorder-agent`，勿改回中文 |
