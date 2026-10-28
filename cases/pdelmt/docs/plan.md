# 产品要素库 - 左侧动态树录制（plan）

- 页面：`/#/pdMgt/pdElmtMgt/elmtgroupOfIndex`（产品管理 > 产品要素管理 > 产品要素库）
- 录制日期：2026-10-26
- 平台/账号：test.creditv5p2.tansun.com.cn / 701994
- 视口：1440×900（spec、profile、rect 三处一致）
- 交付 wire：`partner-wire/pdelmt/T1~T8`

## 1. 定位策略（按本次约束执行）

| 约束 | 落地方式 |
| --- | --- |
| XPath 不含节点名称/版本/数量等动态文本 | 树节点 XPath 只用容器（`.el-tree`）+ 角色（`@role='treeitem'`）+ 内容节点（`.el-tree-node__content`）+ 叶子标记（`is-leaf`）+ 内联 `display:none` 过滤；名称不进入 XPath |
| 名称作为可参数化查询数据 | 名称只出现在 `objectValue`（搜索框输入）与 `search` 数据字典中；wire 输入步的值来自录制 values |
| 优先稳定业务标识 | 先查 `prodElmtGrpgInf/list` 取 `elmtGrpgNo` 作为期望值；点击后比对「基本信息-组件编号」+ `prodElmtInf/query` 的 `elmtGrpgNo` |
| 无业务标识时先检索缩小结果 | 先输入业务名称 → 点搜索图标（实测 fill 不过滤，必须点图标）→ 树收窄 |
| 树容器/节点角色/叶子结构定位 | `node`（全树恰好 1 个可见节点）/ `nodeLeaf`（搜索保留祖先链时，用叶子结构把命中节点筛成 1 个） |
| 点击前断言数量=1 且可见 | 录制器 `single()`：`total!==1 || visible!==1` 直接抛错；wire XPath 内嵌 `count(...)=1` 守卫，不满足时回放直接失败而不是点错 |
| 禁止 `[1]` / `.first()` / 固定序号掩盖歧义 | 未使用任何序号谓词；歧义（同名/祖先链）用叶子结构消歧；`.first()` 仅在 count==1 断言之后 |
| 点击后验证选中对象 | 每次节点点击后读「基本信息-组件编号」与期望 `elmtGrpgNo` 比对；组件节点额外断言「产品要素」页签出现 + 列表接口 `elmtGrpgNo` 一致 |

### 关键 XPath（wire 实际值）

```
搜索框   //div[contains(@class,'shrink-search-input')]//input[@placeholder='搜索关键字']
搜索图标 //div[contains(@class,'shrink-search-input')]//i[contains(@class,'el-icon-search')]

节点(唯一) //div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')])=1]
           //div[@role='treeitem'][not(contains(@style,'display: none'))]/div[contains(@class,'el-tree-node__content')]

节点(叶子消歧) //div[contains(@class,'el-tree')][count(.//div[@role='treeitem'][not(contains(@style,'display: none'))]
           /div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]])=1]
           //div[@role='treeitem'][not(contains(@style,'display: none'))]
           /div[contains(@class,'el-tree-node__content')][.//span[contains(@class,'is-leaf')]]

展开箭头 （同上节点前缀）//span[contains(@class,'el-tree-node__expand-icon')]

新增类型 //div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-folder-add')]
新增组件 //div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-document-add')]
删除     //div[contains(@class,'shrink-button-group')]//a[contains(@class,'el-icon-delete')]

弹窗字段 //div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space()='组件名称']]//input
保存/取消 //div[contains(@class,'el-dialog')]//button[translate(normalize-space(.),' ','')='保存']
确认删除 //div[contains(@class,'el-message-box')]//button[translate(normalize-space(.),' ','')='确定' or translate(normalize-space(.),' ','')='OK']
```

> 为什么需要 `display:none` 过滤：搜索/折叠用 v-show，隐藏节点仍留在 DOM（实测搜索「产品公共要素」后 all=19、可见=1），不过滤会命中隐藏副本。
> 为什么需要 `nodeLeaf`：搜索会保留命中节点的祖先链（实测「KB测要素类型-20261023-elem」可见 3 个：公共要素根 + 个性化要素根 + 命中节点），按叶子结构过滤后恰好 1 个。
> 双语按钮：headed 为中文（两字按钮含空格「保 存/确 定」），headless 为英文 OK/Cancel → `translate` 去空格 + `or` 双文案。

## 2. 交易清单与回放结果

| # | 交易 | wire | 步骤 | 前置 | headless | headed |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | 树关键字搜索 | T1-tree-search.json | 3 | 无 | ✅ | ✅ |
| T2 | 树节点折叠与展开 | T2-tree-expand.json | 5 | 无 | ✅ | ✅ |
| T3 | 树选中类型节点（公共要素根） | T3-tree-select-type.json | 4 | 无 | ✅ | ✅ |
| T4 | 树选中组件节点（渠道） | T4-tree-select-component.json | 5 | 无 | ✅ | ✅ |
| T5 | 树新增组件（AT_ 数据） | T5-tree-add-component.json | 9 | 选中公共要素根 | ✅ | ✅ |
| T6 | 树删除组件（自清理） | T6-tree-delete-component.json | 7 | T5 数据 | ✅ | ✅ |
| T7 | 树新增类型（AT_ 数据） | T7-tree-add-type.json | 9 | 选中个性化类型 ZJLX6083 | ✅ | ✅ |
| T8 | 树删除类型（自清理） | T8-tree-delete-type.json | 7 | T7 数据 | ✅ | ✅ |

- 全量 headless：**8/8 PASS，0 警告，122s**
- 全量 headed：**8/8 PASS，0 警告，125s**（中文 locale 下按钮/确认框正常）
- 后置校验 `work/pdelmt/verify-tree.js`：**VERIFY_OK**
  - AT_ 节点净零（T6/T8 已清理）
  - root1 / ZJLX2066（渠道）/ ZJLX6083 固定业务标识存在
  - 选根 → 组件编号=root1 且无产品要素页签
  - 选组件 → 组件编号=ZJLX2066、产品要素页签出现、`prodElmtInf/query` 返回行 `elmtGrpgNo=ZJLX2066`

## 3. 录制产物

| 文件 | 说明 |
| --- | --- |
| `work/pdelmt/probe_17_tree_attrs.js` | 树节点属性实测：仅 role/tabindex/class，无业务 ID 属性 → 走检索+结构 |
| `work/pdelmt/probe_18_tree_record.js` | 录制器：结构定位 + 数量/可见断言 + 点击后业务校验 + rect/步骤落盘 |
| `work/pdelmt/record_tree_out.json` | 录制结果（每步 xpath/value/rect + 各交易 checks） |
| `work/pdelmt/gen-wire-tree.js` | wire 生成器（含 dup/badPID/noRect 校验） |
| `partner-wire/pdelmt/T1~T8-*.json` | 交付 wire |
| `replay-skill/profiles/explore-cst-pdelmt.json` | 本页回放 profile（pages/popups/login/readySelector） |
| `work/pdelmt/verify-tree.js` | 回放后置校验（业务编号 + 接口 + 净零） |

## 4. 数据策略

- 新增类一律 `AT_TREE_<yyyymmddHHMMSS>` / `AT_TYPE_<yyyymmddHHMMSS>`，序号 99/98（正整数、非零）。
- T5→T6、T7→T8 成对自清理，回放后 AT_ 节点净零；重复回放同名不冲突（平台不校验重名）。
- 查询/选中类固定业务数据：`产品公共要素`(root1)、`渠道`(ZJLX2066)、`KB测要素类型-20261023-elem`(ZJLX6083)。
- 若固定数据被环境改动：verify-tree 会先报「固定业务标识存在」失败，需重新选唯一命名的节点并更新 values。

## 5. 基本信息 / 产品要素列表（B/L 系列）

| # | 交易 | wire | 步骤 | 回放 | ATP |
| --- | --- | --- | --- | --- | --- |
| B1 | 基本信息查看 | B1-basic-view.json | 4 | ✅ | 1643 |
| B2 | 基本信息修改名称 | B2-basic-edit-name.json | 6 | ✅ | 1644 |
| B3 | 基本信息修改序号 | B3-basic-edit-seq.json | 6 | ✅ | 1645 |
| B4 | 基本信息保存校验 | B4-basic-validate.json | 8 | ✅ | 1646 |
| L1 | 产品要素查询 | L1-elmt-query.json | 7 | ✅ | 1647 |
| L2 | 产品要素重置查询 | L2-elmt-reset.json | 9 | ✅ | 1648 |
| L3 | 产品要素新增 | L3-elmt-add.json | 11 | ✅ | 1649 |
| L4 | 产品要素修改 | L4-elmt-modify.json | 12 | ✅ | 1650 |
| L5 | 产品要素删除 | L5-elmt-delete.json | 11 | ✅ | 1651 |
| L6 | 产品要素删除引用拦截 | L6-elmt-delete-blocked.json | 9 | ✅ | 1652 |
| L7 | 产品要素删除未选行 | L7-elmt-delete-norow.json | 6 | ✅ | 1653 |
| L8 | 产品要素修改未选行 | L8-elmt-modify-norow.json | 6 | ✅ | 1654 |

- B 系列回放：4/4 PASS（headless，61s）
- L 系列回放：8/8 PASS（headless，162s；修复「选择行」为固定列 radio 后）
- ATP 推送：12 笔 / 95 节点，结构核验通过、failures=[]；2 处已知差异 = select:click 的 options 平台返回 null（平台不持久化 options，见 atp-v3-push 契约说明）
- 数据：L3→L4→L5 自清理；B fixture `AT_BASE_LIST`（ZJLX6132）常驻



## 6. 已知事实/坑

- 搜索框 `fill` 不触发过滤，必须点搜索图标（实测 afterFill=17、afterIconClick=1）。
- 搜索后命中节点默认 `is-expanded=true`，展开箭头第一下是折叠 → T2 录成「折叠→展开」两步，保证首尾状态一致。
- 点击节点内容同时会选中并切换展开态（expand-on-click-node=true），不影响工具栏按钮但会改变展开状态。
- 同名节点真实存在（`年龄限制` = ZJLX4003/ZJLX0011；`产品个性化要素` 有 3 个），所以 T4 选「渠道」、T7 选唯一命名的类型，避免名称歧义。
- 树横向没有业务 ID 属性，业务编号只能从接口 `prodElmtGrpgInf/list` 关联，再用「基本信息-组件编号」回读校验。
