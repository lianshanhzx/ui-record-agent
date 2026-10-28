# 健壮定位规则（自愈核心）

目标：界面微调（类名 hash 变化、布局挪动、元素增删）时，wire 不改也能回放通过。
原则一句话：**只锚「语义」（标签文本/按钮文本/控件结构），不锚「位置」（序号/DOM 序/绝对坐标）**。

## 1. 表单项：标签锚定 XPath

```xpath
//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户名称']]//input
```

- 锚 = label 文本；`normalize-space` 容忍标签内换行/首尾空格/全角空格；
- select 字段尾部换 `//div[contains(@class,'el-select')]`（点容器，不点内部 input）；
- 弹窗/抽屉/浮层内：加前缀作用域，防止同名标签撞车：
  - 对话框 `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='城市']]//input`
  - 抽屉 `//div[contains(@class,'el-drawer')]...`
  - 浮层 `//div[contains(@class,'el-popover')]...`
- 同一页面同名标签多个（少见）时：再叠一层结构特征（所在 section 标题、相邻标签）。

## 2. 按钮：文本锚定

```xpath
//button[normalize-space()='查询']
//div[contains(@class,'el-drawer')]//button[normalize-space()='保存']
```

- 永远不用「第 N 个按钮」；文本相同多个按钮时用作用域前缀区分（抽屉内/弹窗内）；
- 带图标的按钮文本可能带全角空格 → `normalize-space()` 或 `contains(translate(normalize-space(.),' ',''),'新增')`；
- 小按钮变体：`//button[normalize-space()='暂存'][contains(@class,'el-button--small')]`（同页有多个「暂存」时）。

## 3. 禁止裸 .first()（DOM 序假设必翻车）

真实事故：
- 行业树：页面同时存在 **12 个** `.el-popover`（模板节点隐藏），文本过滤后 `.first()` 仍是隐藏节点 → 点击落空；
- 取消按钮：嵌套的隐藏模板 dialog 在 DOM 里排在全屏确认框**前面** → `.first()` 点到隐藏节点。

规则：
- 取元素前先**可见性过滤**：`offsetParent !== null` / `:visible`；
- 多个候选时用**文本 + 结构特征**精确定位到唯一节点（如树的**叶子**特征：无展开箭头 + 文本匹配）；
- 树节点点击 XPath：`//div[contains(@class,'el-popover')]//div[contains(@class,'el-tree-node__content')]` + `objectValue`=节点文本，
  引擎按「可见 + 文本匹配 + 叶子优先」自愈匹配。

## 4. 值回读断言（spec 侧）

- 填完立即读回：`itemValue(label)`（取该 form-item 内 input.value / select 显示文本）== 期望值，**不等即失败**；
- 回写类（地址/行业树确认）：`waitForFunction` 轮询字段值包含期望内容，15s 超时判败；
- switch 断言 before≠after（状态确实翻转）。

## 5. 跳转用 API，不用 sleep

```ts
const res = await Promise.all([
  page.waitForResponse(r => r.url().includes('/saveQZCustCorporat') && r.request().method() === 'POST'),
  btn.click(),
]);
expect(JSON.parse(await (await res[0]).text()).status).toBe(200);
```

- 页面跳转完成判据：`waitForFunction`（body 出现目标文案 **或** hash 离开当前页），再短 settle；
- 列表查询断言：请求体每个参数都在 + 响应 `data.total` 符合预期。

## 6. 动态显隐容错（DYN_GONE）

前序选择可能动态移除/隐藏后续字段（归属人=本人 → 姓名/身份证消失）：
- fillEngine 遇字段不存在 → 记 `action=skip, ok=true, note=DYN_GONE`，**不算失败**继续下一步；
- wire 侧：该字段步直接不生成（gen-wire 只录 ok 且非 skip 的步）。

## 7. 残留弹窗自清理

每步填充前 `ensureDialogsClosed`：枚举可见 `.el-dialog / .el-message-box / .el-popover`，
发现未预期弹窗 → 点关闭按钮/取消/Esc，返回 `{wasOpen, closed}`；子流程结束复查，关不掉记 `|MODAL_STUCK`。
防止一个弹窗卡死后续所有步骤（且失败日志里能直接定位）。

## 8. 数据与视口自愈

- 唯一码（USCC 等）消费一次即失效 → 回放前 `refresh_wire_data.js` 值级重生成；
- 视口三处一致：spec `setViewportSize(1440,900)` = 回放 profile viewport = rect 测量基准；
- 回放引擎内置自愈（route 直达页面、back 按钮回归列表、元素可见性过滤、settle 等待）——
  wire 只要**语义正确**（标签文本对、动作类型对、层级对），界面小改自动吸收。
