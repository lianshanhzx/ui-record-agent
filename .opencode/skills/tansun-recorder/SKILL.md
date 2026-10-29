---
name: tansun-recorder
description: 天阳信贷 V5P2（test.creditv5p2.tansun.com.cn）平台交易录制的平台专属知识库，覆盖四个已交付模块。模块四 cpctRtg 对公客户评级（v2 2026-10-16 重录 L01 查询/L02 重置查询/L03 高级查询/L04 分页/L05 选择客户查询/L06 查看详情/L07 流程轨迹/L08 评级重评全流程→审批中/L09 评级申请建单全流程→审批中/L10 建单删除自包含净零，10/10 回放 PASS；修改页 viewType=modify 可编辑无 tabs 单页 6 折叠面板默认全展开，业务编号=PJ20261016020105 基准待发起单精确过滤 1 行→radio→修改，M01-M06 逐面板代表操作(客户详情→360 页两级子页/一键添加征信幂等/测算回填 C/结论保存/评价保存/历年只读) scoped-到-collapse-item 的 wait:text 断言命中具体值 6/6 回放 PASS×2 净零，保存静默无通知须断字段留存+profile 补对公客户360 条目；征信信息面板全 6 操作 M07-M11(上传授权书/获取最新征信报告/查看征信报告=本环境 NO-OP 零网络→选行+点击+断言状态保持弱烟测；新增征信查询客户=引入弹窗[新增 dialog 与 magnifier 均 .el-dialog 但 body 下 siblings 互非后代，按独有按钮锚定 .//button[引入] vs .//button[对公客户]]+radio 按行文本选 AT_SCAN+引入回填 4 字段[证件到期日/授权日期/查询事由/查询类型]+save；删除=radio 按行文本选 AT_SCAN+删除+MB[OK/确定 双语]，M10→M11 顺序净零) 11/11 回放 PASS 净零；M12-M26 修改页 step2 影像资料组件全 15 操作(上传/预览/打印/下载/批量下载/图册查看/目录检索/文件搜索/装订成册/电子验印·扫描仪·高拍仪=NO-OP 烟测/行移动/行删除自包含+清理，M12→M26 净零链) **全量 36/36 回放 PASS**；M27 修改页 step3 风险阻断刷新(探路 probe_201-203：总校验结果 readonly input=通过+规则表 8 列基准单 0 行+按钮[重试,刷新,上一步,下一步,返回]，**刷新≡重试**均触发 ipcIntlgCtrl/scmExec 风险复检只录刷新，净零只读可重复，headless+headed 1/1 PASS)；M28 修改向导 step4 签署信息 流程提交(探路 probe_205-213：字段 流程操作[el-select 仅选项下一步]+意见详情[textarea]+审批历史表 8 列+按钮[上一页,返回,流程提交,流程撤销,流程轨迹]，step4 流程轨迹=#tsscMutilDialog+getDiagram≠L07 列表行入口 el-dialog+track，流程撤销 st=1→MB「请确认是否撤销」取消=净零，**流程提交前置=系统评级结论+客户综合评价**[getCnclsnInf/getCprsvAssInf 预读]缺失则**静默 no-op** 无 dialog/notify bsnSt 不变，前置齐备→queryNextTaskList→scmExec→workflowTree→弹流程选人[与 L08/L09 同款 张某某 135292]→done→**审批中 st=2**，wire=自包含一次性单 建单→返回→定位→修改→step1 25 指标/测算/结论/评价→step4 流程提交→选人，64 节点 headless+headed 1/1 PASS)；**⚠️同类单守卫**=createRating 对已有 bsnSt∈{1,2} 在途流程的客户→code=100 BizException「该客户已发起评级流程」+「异常信息」alert(全局/系统流水号+异常栈)→L08/L09/L10/M28 残留单阻塞同客户后续建单，复跑前 probe_195_preclean.js 清(已含 AT_SCAN/KB/壹品 26082800042380410 三客户 st∈{1,2})；影像表**无 fixed-right** 行操作在主表 body 按行文件名 scoped(每 op 内外 2 层 span)/预览打印后行操作隐藏/打印仅 preview API 无 UI/deleteFileInf body={id} 非 fileNo/page 检查点名避 profile pages 关键词否则 step2 等 .el-form-item 必超时；⚠️L08/L09 状态依赖=宿主未结单(bsnSt∈{1 待发起,2 在途}，中断跑残留 st=1 同样阻塞)致重评 drawer 不弹/建单不跳任务页，UI 不可删(该审批状态数据不可删除)但 **API deleteBsnInf {id} 软删可清**(probe_195 双状态过滤)，复跑前清两宿主客户；⚠️zh headed 两字按钮含空格(「确 定」)xpath 须 translate 去空格；⚠️headed 行打印触发原生打印对话框冻结 renderer(print 调用在 iframe/新窗口，主窗口运行时桩无效)→引擎 BrowserSession.addInitScript 全局 stub window.print；⚠️探针上传后清理挂死留孤儿影像记录污染后续全量行数断言，probe_182 API 直删(pageFileInf→deleteFileInf {id})；⚠️时钟偏移=服务器系统日 2026-10-14 客户端快 2 天→save 校验授权日≤系统日，{{TODAY/YESTERDAY}} 太新被拒，授权日期须固定过去日 2026-01-01、证件到期日固定未来 2030-01-01(引擎无日期偏移 token)；(作废的查看页 V01-V06 viewType=look 已删)；列表行操作有 handle-container 须锚定；评级申请 drawer 客户下拉=select:scroll(v2，与 grpRtg 同款，v1 select:type 弃用)；任务页与 grpRtg 同构(bsnTp="1"，4 步)但征信节多「获取/查看征信报告」2 按钮(v2 全流程不含征信节操作=阶段二未录)；L08/L09 全流程=建单→任务页 25 指标(7 数字+18 select)→暂存→测算(确定性 D/50.4)→结论/综合评价保存→流程提交→流程选人(树选 张某某 135292)→done→审批中，接受审批中残留+回放非幂等(审批中单申请人无法改/删/撤，重跑须换干净客户)；引擎新增 wait:text 动作(等文本回填，防结论保存在测算前=静默 no-op 竞态)+profile popups 补评级重评/流程选人+login 凭据补全(登录态过期自动登录)；关键坑=流程选人 done 按钮非 primary(default 普通按钮，须双语文本 xpath done/确定/OK/完成)/流程选人 trigger=弹窗唯一可见 input/SelectClickAction 精确匹配优先防子串误选）。模块三 grpRtg 集团客户评级（G01 评级申请 drawer 建单→任务页 / G02 列表查询 / G03 高级查询 / G04 查看详情 / G05 流程轨迹 / G06 评级重评负向 / G07 重置查询 / G08 选择客户查询 / G09 风险阻断刷新 / G10 修改指标暂存 / G11 系统评级结论保存 / G12 客户综合评价保存 / G13 影像图册查看 / G14 一键添加征信查询对象 / G15 新增征信查询客户（引入弹窗三条件非空+引擎 fill 可查+授权日期须早于回放日）/ G16 删除记录，16/16 回放 PASS，自包含净零；驱动引擎新增 select:scroll 动作：teleport 面板 + h=0 隐藏数据行 DOM click 直选中 + 懒渲染滚底异步挂载须等 sh 增长 + 组件内双语分页翻页；列表行操作=表上工具栏按钮无 handle-container；radio label hidden 须点行首列 td force；重复守卫静默失败 drawer 不关；建议等级 ±2 级范围+请先进行测算+结论双必填）。模块一 smbsn 同业客户管理（S1 同业客户新增 / S2 修改 两段式+干净单次版 / S3 股东新增 / S4 股东修改 / S5 股东删除 / S6 股东查看 / S7 获取股东信息 / S8 关联人新增 / S9 关联人修改 / S10 关联人查看 / S11 关联人删除 / S12 影像上传 / S13 影像查看 / S14 影像删除 / S15 影像目录检索 / S16 其他信息历史修改记录 / S17 列表查看 viewType=look / S18 联网核查查看 / S19 联网核查查看详情 / S20 发起实时核查 / S21 法院信息查看 / S22 高级查询 / S23 列表页分页 / S24 影像下载 / S25 图册查看 / S26 影像移动 / S27 影像批量下载 / S28 客户保存暂存口径，27 笔实测交付，S4 股东修改+S29 装订成册 因环境/后端限制不可录）。模块二 pdlib 产品库管理（P01 查看分类 / P02 查看产品 / P03 搜索产品树 / P04 刷新产品树 / P05 产品历史 / P06 配置视图 / P07 新增一级分类 / P08 新增分类 / P09 新增产品 / P10 修改分类 / P11 修改产品 / P12 启用产品 / P13 产品克隆 / P14 上移 / P15 下移 / P16 删除产品 / P17 删除分类，17 笔实测交付）。含三模块共用的平台登录态与视口约定、smbsn 列表页(含联网核查/法院信息/高级查询)/场景页/3 引入弹窗/股东删除 message-box/关联人对私放大镜引入与 saveFamily 结构与 API、pdlib 左产品树+右详情表单双节点(leafNodeInd 0/1)/7 个 icon 工具栏定位/shrink-search-input 搜索/pdSt 状态机与可删性/禁用下架完整流程/del() guard/cloneProduct 结构与 API、平台组件坑（日期 picker 失焦提交/validateDate 业务校验/引入确认回滚规则/message-box 确认按钮 locale 漂移须双语 xpath/成功通知是 .el-notification 非 .el-message/tssc-multi-select 多选下拉延迟+须 Esc/引入放大镜三条件非空/dialog 锚定防 wrapper-body 子串误匹配/locale 双轨 headed=zh headless=en wire 恒中文/el-dialog 标题是 span 非 div/disableBtn class 是 red herring 实际可点/正式保存本环境 no-op 仅暂存可用/file:choose 系统文件框/批量下载前端 zip blob/Playwright 下载无需 grantPermissions）、数据策略、wire 生成与回放命令、ATP 平台同步。Use when 在天阳信贷/Tiansun/creditv5p2 平台录制交易，或录同业客户、客户管理、股东信息、股东删除/查看/获取、关联人、影像、联网核查、法院信息、高级查询、smbsn 模块，或录产品库、产品树、新增产品/新增分类/一级分类、产品克隆、启用/禁用产品、产品历史、配置视图、产品上移下移、删除产品/删除分类、pdlib 模块，或录集团客户评级、grpRtg 模块，或录对公客户评级、cpctRtg 模块，或回放该平台 wire。触发关键词：天阳、天阳信贷、Tiansun、creditv5p2、同业客户、smbsn、客户录制、股东、关联人、影像、上传、查看、检索、删除、获取、联网核查、法院信息、高级查询、分页、图册、影像移动、批量下载、客户保存、暂存、装订成册、S1-S29、产品库、产品库管理、pdlib、产品树、新增产品、新增分类、一级分类、产品克隆、启用产品、禁用产品、产品历史、配置视图、上移、下移、删除产品、删除分类、pdSt、产品状态、grpRtg、集团客户评级、集团评级、评级管理、评级申请、评级重评、建议等级、系统评级、指标暂存、综合评价、征信查询对象、图册查看、风险阻断、流程轨迹、选择客户、征信查询客户、新增征信查询客户、引入弹窗、G01-G16、cpctRtg、对公客户评级、对公评级、L01-L10、M01-M28、风险阻断刷新、总校验结果、scmExec、签署信息、流程提交、流程选人、流程撤销、同类单守卫、该客户已发起评级流程、影像资料、影像预览、影像打印、影像下载、文件搜索、目录检索、电子验印、装订成册、移动目录、deleteBsnInf、征信报告、平台录制。通用录制流程（探路→spec/capture→gen-wires→回放六阶段）见 playwright-ui-recorder skill，本 skill 只记平台事实。
---

# 天阳信贷 V5P2 平台录制知识库（smbsn 同业客户管理 + pdlib 产品库管理 + grpRtg 集团客户评级 + cpctRtg 对公客户评级 + cpctMgt 对公客户管理）

> 本 skill 由 `tansun-cst-recorder`（smbsn 同业客户管理，S1-S29）、`tansun-pdlib-recorder`（pdlib 产品库管理，P01-P17）、grpRtg 集团客户评级（G01-G16）与 cpctRtg 对公客户评级（L01-L10）合并而成；四模块同属天阳信贷 V5P2 平台（`test.creditv5p2.tansun.com.cn`），共用登录态/视口/组件约定（见各模块「1. 平台与环境」）。grpRtg 与 cpctRtg 同属「评级管理」，任务页结构同构（bsnTp 3=集团/1=对公），差异见模块四。
>
> **通用流程、wire schema、定位原则不在此重复** → 见 `playwright-ui-recorder` skill（含 `reference/wire-schema.md`、`reference/robust-locators.md`、`reference/pitfalls.md`）。本文件只记**平台实测事实**，与通用规则冲突时以本文件为准（本平台实测）。
## 模块一：smbsn 同业客户管理（S1-S29）

基于 S1（新增客户）/ S2（修改客户，两段式 + 干净单次版）/ S3（股东新增）/ S4（股东修改，暂停）/ S5（股东删除）/ S6（股东查看，只读） / S7（获取股东信息，只读） / S8（关联人新增）/ S9（关联人修改） / S10（关联人查看）/ S11（关联人删除）/ S12（影像资料上传）/ S13（影像资料查看，只读）/ S14（影像资料删除，消耗型）/ S15（影像目录检索，只读）/ S16（其他信息-查看历史修改记录，只读）/ S17（列表查看，只读）/ S18（联网核查-查看，只读）/ S19（联网核查-查看详情，只读）/ S20（发起实时核查，数据增长型）/ S21（法院信息-查看，只读）/ S22（高级查询，只读幂等）二十一笔录制沉淀。
**通用流程、wire schema、定位原则不在此重复** → 见 `playwright-ui-recorder` skill（含 `reference/wire-schema.md`、`reference/robust-locators.md`、`reference/pitfalls.md`）。本文件只记**平台实测事实**，与通用规则冲突时以本文件为准（本平台实测）。

### 1. 平台与环境

| 项 | 值 |
|---|---|
| 平台 | `http://test.creditv5p2.tansun.com.cn`（天阳信贷 V5P2，微前端，element-ui 系） |
| 登录 | 账号 `701994` / 密码 `1` / 图形验证码 `1234`（写死在 profile）；**图形验证码不校验**（值任意，2026-09-30 改版后 captcha 图已动态化但仍不校验）；**登录按钮 DOM 文本是「登 录」（带空格）** → 引擎 `PlatformLogin.js` 已改为白空格容忍正则（逐字间 `\s*`）；**2026-09-30 登录页改版新增「请输入手机验证码 + 发送验证码」SMS 字段，但非强制**（账号/密码/验证码即可登录成功；**切勿点「发送验证码」以免触发真实短信**） |
| 登录态 | `auth.json`（仓库根，storageState，约 50 分钟有效）；刷新：`node work/smbsn/refresh-auth.mjs`（**注意：其"会话仍有效"判定可能误报**——SPA 重定向延迟时漏判过期；真正兜底是回放引擎 auth 过期时**自动登录**）；引擎自动登录成功的新态存 `replay-out/auth-refreshed.json`（**不覆盖根 auth.json**，属引擎既有行为）→ 手动回放前若根 auth 已失效，可 `cp replay-out/auth-refreshed.json auth.json` 刷新 |
| 视口 | **必须 1440×900**（profile/spec/rect 量取三处一致；playwright.config 默认 1280×720，spec 开头要 `setViewportSize`） |
| 回放 profile | `replay-skill/profiles/explore-cst-smbsn.json`（smbsn 模块；homeRoute=列表页，pages 2 条，popups 9 条【核查确认/关联人/引入/联网核查/查看详情/法院信息/股东信息/新增/删除确认，联网核查·查看详情·法院信息 用 :has 内容锚定】，backButtonText=返回，settle 2500/500ms） |
| 回放命令 | `node replay-skill/replay.mjs partner-wire/smbsn/<wire>.json --profile replay-skill/profiles/explore-cst-smbsn.json [--headed]` |

其他模块已有 profile（扩展录制时直接用或参照新建）：`explore-cst-group / explore-cst-cluster / explore-cst-totgroup / tansun-credit-corp(-watch) / tansun-credit-private(-slow) / tansun-credit / explore-tasks / explore-workbench`。

### 2. 可复用资产（勿重写）

| 路径 | 用途 |
|---|---|
| `tests/smbsn/fillEngine.ts` | 引擎：`inspectPage`（字段盘点，type=skip/input/textarea/select/date/switch/address/import）+ `runFillPlan`（按序填充+值回读断言+rect 录取）+ `openAllSections` + `itemValue` + `randUscc`；**edit 模式** `modValue()` 自动派生"必然不同"新值 |
| `tests/smbsn/fillSubflows.ts` | `fillImport` 引入子流程（打开弹窗→条件查询→首行单选→确认，返回 `DialogStep[]`） |
| `tests/smbsn/S1-new / S2-edit / S2-clean / S3-shareholder / S4-shareholder-edit / S5-shareholder-delete / S6-shareholder-view / S7-shareholder-fetch / S8-related-party / S9-related-party-edit / S10-related-party-view / S11-related-party-delete / S12-image-upload / S13-image-view / S14-image-delete / S15-catalog-search / S16-other-info-history / S17-view / S18-netcheck-view / S19-netcheck-detail / S20-netcheck-run / S21-court-view / S22-advanced-query.spec.ts` | 二十一笔 spec 模板（新交易抄结构） |
| `work/smbsn/gen-wire-s1/s2/s2c/s3/s5/s6/s7/s8/s9/s10/s11/s12/s13/s14/s15/s16/s17/s18/s19/s20/s21/s22.js` | wire 生成器模板（filllog+values+rects → wire，含完整性校验 dup/badPID/noRect） |
| `work/smbsn/refresh-wire-data(-s3).js` | 回放前数据刷新模板（值级替换 objectValue） |
| `work/smbsn/rects-wire.json` | 列表层/场景按钮 rect 缓存（listNo/listQuery/listModify/rowRadio/sceneTempSave/sceneBack/orgRadio/persRadio…） |
| `work/smbsn/plan.md` | 交易清单 + 探路结论 + 回放记录（**每笔新交易都要记**） |
| `partner-wire/smbsn/*.json` | 已交付 wire（二十笔）：S1-new(89) / S2-edit(94) / S2-clean(69) / S3-shareholder(23) / S5-shareholder-delete(11) / S6-shareholder-view(11) / S7-shareholder-fetch(12) / S8-related-party(34) / S9-related-party-edit(21) / S10-related-party-view(11) / S11-related-party-delete(11) / S12-image-upload(13) / S13-image-view(14) / S14-image-delete(15) / S15-catalog-search(10) / S16-other-info-history(10) / S17-view(7) / S18-netcheck-view(10) / S19-netcheck-detail(11) / S20-netcheck-run(11) / S21-court-view(10) / S22-advanced-query(8) |

### 3. smbsn 模块结构（实测）

- 列表路由 `/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg`；客户代码 cstCgy/cstTp=80（同业），avyEcd=UML00005754
- 列表 API `POST /tansun-tcp-cst/custTrade/findCustTradeList`，body `{pageNum,pageSize,cstNo,cstNm,...}`，resp `{code,data:{total,list}}`；表头 8 列
- **列表操作链**（修改/查看类交易入口，已入 wire）：客户编号输入→【查询】→首行记录 Radio（XPath 限定 `.el-table__body`，表头有隐藏 radio）→【修改】→ 场景页（`getCustTrade` 回显）
- 新增：列表【新增】→ **drawer（非 dialog）** 3 字段（证件类型默认营业执照/证件号码/客户名称）→【保存】→ `checkCustTrade` 查重（crdtTp='20111'）返回新 cstNo → 自动跳场景页
- **列表页 4 个未录入口（S17-S22 已录）**：工具栏全量 = 查询/重置/caret 展开 + 新增/修改/**查看/联网核查信息/法院信息**
  - **查看（S17，只读）**：选行→【查看】→**场景页 view 模式**（同 mdfSmbsnCst 路由，URL `viewType=look`；编辑态是 `viewType=edit`）；6 tab/5 段全在但**按钮只剩【返回】**（无引入/保存/暂存，字段无保存入口）；API `getCustTrade`×2+`getRatingResult`+`ipcFcnScnInf/hit`
  - **联网核查信息（S18/S19/S20）**：选行→无标题 `.el-dialog`；查询表单 核查时间(input)/核查结果(**tssc-multi-select**：核查通过/核查不通过→`inspRsltId` "1"/"2") + 工具栏【查询/重置/发起实时核查/查看详情】+ 表格 7 列（首列 Radio/核查时间/客户编号/客户名称/证件类型/证件号码/核查结果/核查结果信息）+【取消/确认】；API `custCorporatNetworkCheckBasic/page {cstNo,createTime,inspRsltId,pageNum,pageSize}`
    - **查看详情（S19，只读）**：表格行 Radio→【查看详情】→子 `.el-dialog` **50 项只读**按钮仅【返回】；API `custCorporatNetworkCheckBasic/get {id}`
    - **发起实时核查（S20，数据增长型）**：【发起实时核查】→ message-box「您确定发起[实时]联网核查吗?」→OK→ `custCorporat/networkCheck {cstNo,cstNm,uscc,crdtTp,crdtNo,ntwrkgInsp:'1',id:null,chkTp:'1'}` 200（`{rslt:'1',inspRstinf:'要素核查匹配正确'}`，~5-8s）→重查**行 +1**（首行=当天时间戳）
  - **法院信息（S21，只读）**：选行→无标题 `.el-dialog`；查询表单 法院信息类型(select **涉诉/失信被执行/限制消费被执行**→`courtInfTp` "1"/…)/是否有效(**tssc-multi-select 多选**) +【查询/重置】+ 表格 7 列（首列 Radio/法院信息类型/客户编号/客户名称/证件号码/是否存在法院信息/登记人/登记日期）+【取消】**无确认**；API `custCourtInfApi/page {cstNo,crdtNo,courtInfTp,vldInd,pageNum,pageSize}`
  - **高级查询（S22，只读幂等）**：查询区 **caret 图标独立 `<button>`**（`el-icon-caret-bottom`↔`caret-top`；`.first()` 会误中证件类型 select 箭头→必须 `button:has(i.el-icon-caret-bottom)`）展开 3 字段 证件号码/管户客户经理/客户状态；查询 body 增 `crdtNo`/`usrNo`/`cstSt`（**客户状态 1=信贷正式客户，6=草稿客户**）；管户客户经理=用户 select（92 用户池）
- 场景页 5 折叠段（默认全展开）：基本信息(0-21)/法定代表人信息(22-25)/组织机构信息(26-35)/经营信息(36-45)/财务信息(46-70)，共 71 字段，**15 只读(skip)**：客户编号/名称/证件类型号码/客户类别/是否法人行/企业规模/法代 4 项/认定等级评分/评级认定与到期日期
- 6 Tab（基本信息/股东信息/关联人信息/影像资料/其他信息 已录；业务信息 未录——评级 0 行/限额 0 行无数据）；页面按钮：引入/保存/暂存/返回
- 暂存 `saveCustTrade {prsvInd:'0', smbsnCstBaseInf{...}, cstSt:'6'}` → **草稿 cstSt=6；暂存不做必填校验**（空表也成功）
- 3 引入（行内【引入】按钮）：
  | 字段 | 弹窗 | API |
  |---|---|---|
  | 调查机构 | 机构查询（条件:机构编号/名称） | `orgClient/findAllOrgPage` |
  | 法定代表人/负责人姓名（dis） | 客户放大镜（条件:客户编号/名称/证件类型/证件号码） | `custPersonal/queryPersonalMagnifierList` |
  | 登记注册地址（dis） | 五级联动（省/市/区县/乡镇街道/行政村社区 select + 详细地址 input，无查询） | 无 |
 - 股东信息 Tab：表格 12 列；pane 工具栏按钮：新增/修改/查看/**删除**/获取股东信息（**查看/修改/删除 选行 radio 后才 enabled；获取股东信息 不依赖选行**，tab 打开即可用）
   - 【新增】是 **.el-dialog（非 drawer）** 12 项；保存 `custCorporatRelatedParty/save`
   - 查询 `custCorporatRelatedParty/queryCustCorporatRelatedParty {cstNo, rltvTp:'0', pageNum, pageSize}` → `{data:{total,list:[{id,...}]}}`
   - **删除** `custCorporatRelatedParty/delete` body `{"id":"<股东行id>"}` → `{status:200,description:"操作成功"}`；确认弹窗 = **`.el-message-box`**（title=「Message」，msg=「确认是否删除当前选择的数据？」，按钮 **Cancel/OK 英文**，OK=`.el-button--primary`）
   - **查看**（S6，只读）：`custCorporatRelatedParty/get {id}` 回显；打开**只读 `.el-dialog`**（class `dialog706`，无标题）12 项**全 disabled**（备注=disabled textarea），按钮【引入】【取消】；12 项 labels 序：股东类型/股东名称/股东客户编号/证件类型/证件号码/币种/持股比例/出资方式/出资时间/认缴出资额(元)/实缴出资额（元）/备注；只读不消耗数据可任意重放；wire popup 步名「查看股东信息」命中现有 profile 条目「股东信息→.el-dialog」，**无需改 profile**
    - **获取股东信息**（S7，只读）：无弹窗无新 tab；前端可见序列 = `POST custCorporat/networkCheck {cstNo,cstNm,uscc,lglRprsNm,lglRprsCrdtNo,chkTp:'0',type:'1'}` 200（本测试客户 resp `data:{rslt:'1',inspRstinf:'要素核查匹配正确'}`）→ 重查 `queryCustCorporatRelatedParty`（total 不变）→ **`.el-notification`「操作成功」**（右上角，~4s 自动消失；**断言/监听用 .el-notification，profile 的 errorToastSelector 只有 .el-message 抓不到它**）；本测试客户（假 USCC）无外部股东数据源命中，行数不变——真实客户可能增行，届时需按数据源返回核对
  - **关联人信息 Tab**（S8）：与股东**共用表/API** `custCorporatRelatedParty/*`，查询 body `rltvTp:'2'`（S5 股东 tab 查询是 `'0'`，同表不同 rltvTp）；表格 6 列：关联方客户编号/关联客户名称/关联人类型/证件类型/证件号码/职务名称；工具栏 新增/修改/查看/删除（新增不依赖选行）
    - **新增**（S8）：无标题 `.el-dialog`（class dialog467 动态）**17 项**；**关联客户名称/关联客户编号 disabled**（名称带【引入】，居住地址也有【引入】按钮）；**高管类别 = `tssc-multi-select` 自定义多选组件**（选项 董事长/总经理/财务负责人/董事/监事/其他高管/财务总监，**点选项后下拉不自动收，须 Esc**——引擎 SelectClickAction 已加"仍可见则 Esc"兜底）
    - **引入客户子弹窗 = 对私放大镜**：`custPersonal/queryPersonalMagnifierList`（同法代引入 API）；条件 客户编号/客户名称/证件类型/证件号码，**三者不可同时为空**（toast「客户编号、客户名称和证件号码不能同时为空!」，空查询不发 API）；表头 客户编号/客户名称/证件类型/证件号码/客户类型/客户类型细分/客户状态/管户客户经理/管户机构；**关联人必须指向真实对私客户**；【确认】后**自动回填** 关联客户名称/关联客户编号/证件类型(居民身份证)/证件号码
    - **保存 = `custCorporatRelatedParty/saveFamily`**（非 save！）200；删除 = `custCorporatRelatedParty/delete`（body 含 id/cstNo/crdtTp/crdtNo/rltvCstNo/rltvCstNm/rltvCstCgy/relpartyTp…），确认框 `.el-message-box`「您确定删除这条记录吗?」Cancel/OK 英文
    - **平台不拦唯一**：同客户+同高管类别可重复新增（实测 2 行并存）；每回放 S8 +1 行
    - **修改**（S9）：pane 工具栏【修改】（选行后作用于选中行）开「修改关联人信息」弹窗（dialog043 动态）17 项回显；**可改 13 项 / 禁用 4 项**（关联客户名称[disabled+引入]/关联客户编号/证件类型/证件号码）；**出生日期预填干净日期**（无时分秒，不同于 S4 股东编辑弹窗）；保存同 `saveFamily`，**无 S4「注册资本不能为空」校验**（关联人对私客户）；改值须**异值**（同值不产生变更），出生日期建议不动（保身份证自洽）
    - **查看**（S10）：选行后点【查看】开「查看关联人信息」只读弹窗（dialog312/042 动态）17 项**全 disabled 纯 input**（select 类字段也渲染为禁用 input）；按钮 引入×2/取消（无确定）；**无 get API**（数据直接来自列表行对象，不同于 S6 股东查看走 `custCorporatRelatedParty/get`）；17 项顺序=高管类别/关联客户名称/关联客户编号/证件类型/证件号码/联系电话/性别/出生日期/职业/职务名称/职称/最高学历/最高学位/居住地址/单位电话/工作单位/工作简历描述；**纯只读幂等**
     - **删除**（S11）：选行后点【删除】→ `.el-message-box`「**您确定删除这条记录吗?**」（关联人 pane 措辞；股东 pane 是「确认是否删除当前选择的数据」，断言放宽 `toContain('删除')`）→ OK(`el-button--primary`) → `custCorporatRelatedParty/delete` 200「操作成功」→ requery total 行-1；**数据消耗型**：每回放 -1 行，清零后 S9/S10/S11 重放前须先 S8 回放补行
   - **影像资料 Tab**（S12）：文件管理组件 `file-catalog-container`（cmpt-ecd=ZJJK00090203「维护影像信息」），非表单 CRUD；左侧目录搜索框+目录树（`filesCtlgManage/listCtlgInf`，40+ 目录：数字信贷→影像资料/电子协议/股东会决议/电子协议模板，客户管理→营业执照/财务报表，对公授信调查报告→集团/同业/合作方调查报告…），右侧文件列表（`filesFileManage/pageFileInf`，body `{pageNum,pageSize,fileNm,cstNo,bsnNo,ctlgNo}`，列：文件名/类型/上传人/上传时间）+ 工具栏 **刷新/批量操作/装订成册/扫描仪/上传/图册查看/视图预览**（空列表下全 enabled）
     - **上传**（S12）：点【上传】→ **系统文件选择框**（隐藏 `input[type=file]`，无自定义弹窗；Playwright `page.on('filechooser')`+`setFiles` 可驱动）→ 选完即**自动上传** `filesFileManage/upload`（multipart）200 返回 `fileNo` → 自动回查 pageFileInf total+1 行回显，**无确认弹窗无表单**；**数据增长型**每回放 +1 文件（同名不去重）；【扫描仪】依赖硬件**排除录制**；目录树一级节点默认可见直接点，子节点须先展开 caret

### 4. 平台组件坑（S1-S8 实测，录制前必知）

#### 4.1 日期 picker（最高频坑）
- `fill` **仅设 parsedValue，面板保持打开**；**失焦（Enter/点别处）才提交 model 并关面板**（probe39 实证）→ spec 填日期后必须主动失焦；wire 里日期 input 步后必须插「关闭日期面板」click 步（**点某 label，不能点 form-item**——会落 disabled input；常用锚点=「客户编号」label）
- **编辑弹窗日期预填带时分秒**（"2026-09-01 00:00:00"）：填**同值**不产生变更（不提交）→ 修改类交易日期必须填**异值**；回读用 `String(m).slice(0,10)` 取日期段比较（probe42 实证）
- S3 教训：出资时间超营业日期 → 前端 `validateDate` **清空字段**并先报"出资日期不能大于营业日期"、再报"请选择出资时间"（误导，以为没填）

#### 4.2 业务校验（前端 validateDate，ZJJK00105742）
- 出资时间 必须 ≤ `localStorage.businessDate`（营业日期，本客户=**2026-9-23**）且 ≥ `rgsRgstDt`（登记注册日期，本客户=**2025-06-18**）→ 安全取 **9 月 1 日**这类中间值
- 持股比例：表单输**百分比**（"10"），blur 后转小数（0.10，0.1 步进）
- **异常 alert ≠ toast**：后端 BizException 走 alert 弹窗（"异常信息"），**不是** `.el-message`/`.el-form-item__error` → 重试逻辑盯 toast 会看不见；要盯 alert 或 API 响应 `code≠200`

#### 4.3 引入确认回滚规则（S2 探针 V1-V16 实证，修改类交易设计依据）
- **R1**：引入确认把**之前改过的** 组织机构/经营/财务 明文项回滚到进表初始快照（非暂存值）；基本信息组与引入字段不受影响
- **R2**：{经营范围,主营范围,登记注册有效期} 在引入已改后填 → 回滚引入
- **M-A**：地址引入确认时注册资本已改 → 法代回滚；**法代引入无条件回滚已改地址** → 顺序必须 法代→地址
- 引入后安全填：金融许可证号/地税/国税/营业执照/注册资本；引入后填经营/财务段 → 回滚法代
- **两种解法**：
  1. **两段式**（S2-edit，覆盖全部 56 项）：第 1 段明文项(含调查机构引入)改完【暂存】落库 → 重进刷新快照 → 第 2段 法代→地址→注册资本 引入（回滚到的快照已是新值，无感）
  2. **干净单次版**（S2-clean，53 明文项）：只改明文项（type∈input/select/date/textarea/switch），**跳过全部引入(address/import)** → 无回滚，单次 搜索→查询→选行→修改→改→暂存→反查，1 分钟跑完
- 已知应用行为（非脚本缺陷）：编辑态 法代/地址 引入重挂接在【暂存】后回滚（仅改显示，法代联动留 N/A、地址底层省市区码未更新）

#### 4.4 S4 卡点（股东"修改"路径，暂停原因，恢复方向）
- 现象：股东编辑弹窗 12 项全填 OK，【确定】保存被 `custCorporatRelatedParty/save`(viewType=edit) 挡，alert「**注册资本不能为空！**」code=100（服务 tansun-tcp-cst）
- 实锤：预填值**不改**直接确定也报 → 既有校验；主客户注册资本=10 亿非空且 postData 不含注册资本 → 后端**反查股东的关联客户**（rltvCstNo/crdtNo）的注册资本；关联到本同业客户或假证件号都查不到 → **股东必须指向一个真实的对公法人客户**（对公客户表里有注册资本）
- 对照：**S3"新增"路径无此校验**（已交付）
- 恢复方向：找一个对公法人客户编号+其营业执照号 作为股东的 股东客户编号/证件号码；`work/smbsn/probe_smbsn_47.js` 已写未跑（抓 save postData+响应实锤查表方式）
- 日期修复已入 S4 spec：出资时间取异值 `${(bizDate||TS).slice(0,4)}-08-15`，readDateModel 取 slice(0,10)

#### 4.5 删除确认 message-box（S5 实测）
- 确认框是 **`.el-message-box`**（不是 .el-dialog/.el-drawer）：title=「Message」，msg=「确认是否删除当前选择的数据？」
- 按钮文案 **locale 漂移**：headless=en（Cancel/OK）、headed=zh（取消/确定），同框两种都实测过；OK/确定 的 class 含 `el-button--primary`
- **坑1**：`getByRole('button').filter({hasText:/^OK$/})` 在该按钮上 count=0（a11y 名不可靠）→ spec 用 `mb.locator('button.el-button--primary')` class 锚定（locale 免疫）
- **坑2**：wire XPath 必须**双语兼容**（headed 回放=zh，只写 `='OK'` 会元素未可见超时，S11 首跑因此失败已修）：`//div[contains(@class,'el-message-box')]//button[normalize-space()='OK' or normalize-space()='确定']`
- 回放 profile popups 已含 `{match:["删除确认"],selector:".el-message-box"}`（popupFallbackSelector 本身也含 .el-message-box 兜底）

#### 4.6 关联人信息新增（S8 实测）
- **tssc-multi-select 自定义多选下拉**（高管类别）：内部包 `.el-select`，点开/选选项方式与普通 select 相同，**但选完下拉不自动收起** → spec 须 `Escape`；wire 侧引擎 `SelectClickAction` 已加兜底（选项点完后 dropdown 仍 visible 则自动 Esc，单选型无感）
- **引入放大镜三条件校验**：客户编号/客户名称/证件号码**不可同时为空**（toast 拦截，空查询不发 API；console 报平台自身 `serchHandel` undefined，无害）
- **引入自动回填**：确认关联客户后 关联客户名称/关联客户编号(disabled input)/证件类型/证件号码 自动带出 → wire/spec **不填**这 4 项（填了也是 disabled 无效）
- **保存接口是 `saveFamily`**（不是股东/法代的 `save`）；监听保存响应按 `custCorporatRelatedParty` + 排除 query/get 过滤
- **wire 双弹窗锚点**（无标题 dialog 靠唯一 label 区分）：新增弹窗 `//div[contains(@class,'el-dialog')][.//label[normalize-space()='高管类别']]`；引入弹窗 `//div[...][.//label[normalize-space()='客户编号']]`（新增弹窗里叫「关联客户编号」，精确匹配不冲突）；引入行 Radio 按 cstNo 文本定位 `tr[.//td[...]]`
- **profile popup 顺序**：`{match:["关联人"]}` / `{match:["引入"]}` 两条 → `.el-dialog`，**必须排在 `{match:["新增"]}`(.el-drawer) 之前**（否则「新增关联人信息」误落 drawer 超时）
- **列表反查断言用 DOM 不用响应体**：返回后点【查询】的 `findCustTradeList` 响应体 `data.total` 可能取不到（抓到非目标响应/结构差异）→ 断言「列表出现该 cstNo 行可见」更稳（S8 实证）
- **修改弹窗日期预填干净**（关联人 出生日期="1985-01-23" 无时分秒）：与 S4 股东编辑弹窗（带 00:00:00）不同，修改类交易仍守「异值才提交」通则（S9：改 6 项异值，出生日期不动）
- **修改类 wire 幂等设计**：改值固定写死 → 重放时预填已是新值，填同值=无变更，save 仍 200，可无限重放（S9 实证）
- **查看类弹窗 body 异步渲染**：「查看」类只读弹窗 **shell（.el-dialog）先出现、表单项后渲染** → `toBeVisible(dlg)` 通过后立刻 count/取 label 会得 0（S10 首跑失败原因；probe 带 sleep 会掩盖）；须先 `await expect(dlg.locator('.el-form-item').first()).toBeVisible({timeout:10_000})` 再做断言
- **同值行无法用表格文本区分**（S11）：关联人表 6 列不含联系电话/居住地址等，S8/S9 两行**表格文本完全相同** → 删除/修改后「剩余行不包含被删行文本」断言误杀；行数变化以 **requery total** 为权威断言，行文本只打日志。同理：验证「哪一行被改了」须进【查看】弹窗读不在列中的字段值（S9 用联系电话定位行）

#### 4.7 影像上传（S12 实测）
- **系统文件框 = 引擎新动作 `file:choose`**（wire eventTypeValue=`file:choose`，objectValue=**文件绝对路径**）：`replay-skill/src/engine/actions/FileChooseAction.js`——byXpathVisible 定位触发按钮 → `page.waitForEvent('filechooser')` **先挂监听后点击** → `fc.setFiles(path)` → settle；文件不存在提前抛错。spec 侧同模式：`Promise.all([page.waitForEvent('filechooser').then(fc=>fc.setFiles(F)), btn.click()])`
- **上传无确认**：setFiles 后平台自动发 `filesFileManage/upload`（multipart，200 返回 `{data:{fileNo}}`）并自动回查 `pageFileInf`——spec/wire 无需再点任何确认按钮；断言用 upload 响应 200+fileNo 与回查 total+1
- **目录树节点 xpath**：`//div[contains(@class,'el-tree-node__content')][normalize-space(.)='<节点名>']`（content 只含 expand-icon+label span，子节点文本不在内，精确匹配安全）
- **文件列表断言**：行 innerText 含文件名即可（列无 radio/checkbox 之外的操作列，操作走顶部【批量操作】）
- 测试文件放 `work/smbsn/`（入库，wire objectValue 存绝对路径，回放机须同路径或改 wire）

#### 4.8 影像查看/删除/目录检索（S13/S14/S15 实测）
- **文件列表双显示模式**：表格模式（工具栏含【视图预览】）↔ 卡片/预览模式（工具栏含【返回列表】），**单一切换按钮随模式换名**；**模式服务端持久化**（新会话停在上次模式）→ **不变式：spec/wire 必须以表格模式收尾**（末尾点【返回列表】，进入时先做模式守卫）
- **行操作列 = el-table fixed-right 固定列**（预览/下载/删除/移动/打印，`el-button--text` 按钮）：主表 body 内 span 为**隐藏副本**（9 个「预览」span 仅 6 可见）→ spec 用 `.filter({visible:true})` 或 `evaluate` 找 `offsetParent!==null` 实例；wire 引擎 `byXpathVisible` 同语义自动跳过，xpath `//span[normalize-space()='预览']` / `//span[normalize-space()='删除']` 直接可用
- **查看（S13，只读）**：表格模式点首行【预览】→ 行内 viewer（列表切卡片模式+中央图片查看器 缩放/旋转 工具条+右侧**属性面板**：文件名/文件大小(b)/作者/类型/更新时间），`filesFileManage/preview` 200 → 点【返回列表】（`//button[normalize-space()='返回列表']`，文本干净无空格）回表格模式；断言不依赖图片字节加载（模式切换+属性面板含文件名+preview 200）
- **删除（S14，消耗型）**：首行【删除】→ `.el-message-box`「**是否删除该档案**」（措辞区别于股东「确认是否删除当前选择的数据」/关联人「您确定删除这条记录吗?」）→ 确认（恒为 `button.el-button--primary`）→ `filesFileManage/deleteFileInf` 200 → 自动回查 total-1
- **⚠ message-box 按钮 locale 会话漂移**：同一删除确认框两次实测文案不同（「提示/取消/确定」中文 ↔ 「Message/Cancel/OK」英文）→ wire 确认步 xpath 必须**双文案兼容**：`//div[contains(@class,'el-message-box')]//button[normalize-space()='确定' or normalize-space()='OK']`；spec 侧 class 锚定 `el-button--primary` 免疫
- **【批量操作】= 批量下载**（未选中 toast「请选择要下载的数据」），**不是**删除菜单；删除只走行操作列
- **【图册查看】** = 全屏「档案书册」dialog（自带左侧目录树，选目录才显示内容）——未录，扩展时先探
- **目录检索（S15，只读幂等）**：搜索框 = 左侧 `.leftContent` 内**首个** `input[placeholder=请输入]`，容器是 **`div.el-input.el-input--small.el-input--prefix`（div 非 span，首版 `span.el-input` 定位失败）**；xpath `//div[contains(@class,'leftContent')]//input[@placeholder='请输入']`；输入关键词→树过滤为命中路径，清空→恢复；**树懒渲染**：初始可见节点数不稳定（15），搜索周期后全量 17 → 断言用「稳定轮询基线 + 清空后 ≥ 基线且 > 过滤后」
- **文件列表右栏须先选目录才渲染**（不选节点时右侧空、无工具栏）；【刷新/批量操作/装订成册/扫描仪/上传/图册查看】工具栏在选目录后出现
- **数据依赖链**：S13 需目录 ≥1 文件 / S14 消耗 -1 文件 / S15 无依赖；当前客户管理目录基线=**0**（重放 S13/S14 前先跑 S12 补文件）

#### 4.9 其他信息（S16 实测，团队新增/删除被业务规则封锁不可录）
- **3 折叠段**（右侧目录确认）：① 维护客户管理团队【新增/删除】 ② 查看历史修改记录 ③ 查看登记信息；打开 tab 自动加载 3 API：`custPermision/findCustTeam {cstNo,pageNum,pageSize}` / `ICstTradeMdfHistApi/page {cstNo,pageNum,pageSize}` / `custPersonal/getRegistInfo {cstNo}`
- **团队管理**：9 个存量客户全部 =1 行「管户权 701994 黄某某」。**新增** dialog 5 项全 dis（管理类型固定「业务权」），【引入】= 系统用户放大镜（`usermg/userAndOrgRel/selector`，92 用户/13+ 机构）→选行回填→确定→save code:100 静默失败（**无 message-box 无 toast，dialog 保持打开**）：后端「同一个农合机构下，只能有一个客户经理」（BizException）→ 凡已有团队行（=全部客户）必拒。**删除**：message-box「您确定删除这条记录吗?」（locale 漂移 Cancel/OK）→确认→**前端 `checkDel` 守卫对管户权行返回 false**：框关闭但零 API、数据不变（console「调用checkDel结果为false」静默拦截）
- **历史修改记录（S16 已录，只读幂等）**：表 7 列（客户编号/被修改信息项/修改日期/修改前值/修改后值/修改人名称/修改人编号），10 行/页，基线 total=297；唯一交互=分页；**分页定位用折叠项作用域 xpath**：`//div[contains(@class,'el-collapse-item')][.//div[contains(@class,'el-collapse-item__header')][contains(.,'查看历史修改记录')]]//li[contains(@class,'number') and normalize-space(.)='N']`；**分页初始在 900 视口下方，rect 测量前须 scrollIntoViewIfNeeded**
- **登记信息**：7 项全 dis 纯展示（含「日期」=当天，无 API 无操作）→ 不独立成交易，断言并入 S16

#### 4.10 其他
- **客户草稿无删除入口**（UI/接口均无）：cstSt=6 草稿客户越积越多，属已知残留，不阻塞；**股东行有删除入口**（S5 已录，可清残留股东）
- 删除类交易**数据依赖**：S5 删「首行」，回放前股东表须 ≥1 行（目录级顺序回放 S3 先于 S5 天然满足；单独重放 S5 前先跑 S3）
- API 可能默默忽略筛选参数 → 探路时发两次请求对比 total 验证筛选真实生效
- 唯一码（USCC/客户名）**消费一次即入库** → 每次回放前刷新数据+auth（失败运行也算消费）

#### 4.11 列表页入口（S17-S22 实测）
- **dialog 锚定防子串误匹配**：`contains(@class,'el-dialog')` 会同时命中 `el-dialog__wrapper`/`el-dialog`/`el-dialog__body`（strict 模式 3 命中报错）→ **spec 侧用 `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`**；wire 侧沿用 `//div[contains(@class,'el-dialog')][.//button[...]]`（末端内容锚定保证唯一元素，S2 起已验证）
- **message-box 确认按钮 locale 漂移（实锤，S20 首跑失败）**：同一平台同一天出现 Cancel/OK（S5/S14）与 取消/确定（S20）两种 → **wire 确认步一律双语 xpath**：`//div[contains(@class,'el-message-box')]//button[normalize-space()='OK' or normalize-space()='确定']`；spec 侧 class 锚定 `el-button--primary` 免疫。按钮 textContent 带换行缩进（`"\n          OK\n        "`）→ anchored 正则 `/^OK$/` 失配，必须 normalize-space
- **tssc-multi-select 下拉打开有延迟**（S18 核查结果）：click 后立查 `.el-select-dropdown:visible` 为 false（自定义 dropdown class 带随机后缀 `custom-select-dropdownNNN`）→ spec 用 `page.locator('.el-select-dropdown').filter({hasText:'核查通过'}).last()` + waitFor visible 再点选项
- **dialog 内表格行异步加载**（S18）：打开 dialog/点查询后行数立查为 0 → 先 `waitForResponse(PAGE_API)` + 首行 waitFor 再断言
- **profile popups 支持 :has 内容锚定 CSS**：PopupExecutor `waitForVisible` 走 `page.locator(selector).filter({visible:true})`，故 `{match:["联网核查"],selector:".el-dialog:has(button:has-text('发起实时核查'))"}` 可直接用（S18/S19/S21 三条已改此形式；多 dialog 同屏时比 .el-dialog 泛匹配稳）
- **行 innerText 前导空格**（S19）：radio 列空单元格带前导空格 → split 错位，先 `.trim()` 再断言
- **findCustTradeList 响应行数组键 = `data.list`**（PageHelper 全套：total/list/pageNum/pages/…，S22 实证），非 records/rows
- **禁用「断言N行」**（多表格页面）：tableRowSelector 全局计数不可靠，行数断言放 spec 的 API 层（waitForResponse total）

#### 4.12 登录页改版（2026-09-30 实锤，曾致 S1 回放失败）
- **登录按钮 DOM 文本 =「登 录」（带空格）**：`getByRole('button').filter({hasText:'登录'})` 精确子串匹配不到 → 引擎自动登录 30s 超时（S1 回放卡登录页根因）。**已修 `replay-skill/src/browser/PlatformLogin.js`**：`new RegExp(loginButtonText.trim().split('').join('\\s*'))`（「登录」→`/登\s*录/`，兼容带/不带空格，对所有 11 个 profile 向后兼容）。`refresh-auth.mjs` 原本就用 `/登\s*录/` 正则（早已兼容），仅引擎侧漏改
- **新增 SMS 手机验证码字段（非强制）**：登录页改版加了「请输入手机验证码 + 发送验证码」，但**只填账号/密码/图形验证码即可登录成功**（实测 `LOGIN_OK=true` 直达 `/#/home`）；**切勿点「发送验证码」**（会向真实手机发短信）；图形验证码本环境不校验（`captchaValue` 任意，改版后 captcha 图虽动态化但服务端不比对）
- **`refresh-auth.mjs` "会话仍有效" 可能误报**：SPA 过期重定向有延迟，轮询窗口内未落到 /login 就误判有效、直接存旧 auth → 真正兜底是**回放引擎 auth 过期自动登录**（`BrowserSession.goto` 检测 /login → `PlatformLogin.login`）；引擎自动登录成功的新态存 `replay-out/auth-refreshed.json`（**不覆盖根 auth.json**）→ 手动回放前若根 auth 失效，`cp replay-out/auth-refreshed.json auth.json`

#### 4.13 影像下载/批量/移动/客户保存（S23-S28 实测）
- **Locale 双轨（关键）**：**headed（回放）→ zh-CN；headless（spec/probe）→ en-US**。业务按钮文案两 locale 都中文（保存/暂存/查询/批量操作/确认选择 等）；**仅分页框架文案随 locale 变**（「共 N 条 / 前往 / 页」zh ↔ 英文）。**wire 必须中文**（回放恒 headed）；spec 里分页相关断言用 headless 实见文案（英文）或 locale 无关结构
- **el-dialog 标题是 `<span class="el-dialog__title">`（非 div）**（S26 移动目录 dialog）：锚定 title 用 `//span[contains(@class,'el-dialog__title')][normalize-space(.)='移动目录']`；勿假设 `<div>`
- **`disableBtn` class 是 red herring**（S28）：修改场景页 保存/暂存/返回 **均带** `el-button disableBtn ...` 但**实际可点**（暂存/返回 正常触发）→ 勿据 class 判断按钮禁用；以实际 API/导航为准
- **正式保存【保存】本环境 no-op**（S28 多探针实锤）：干净/脏表单/暂存后 点击【保存】均**零 API/零导航/零 toast**；列表页亦无 提交/正式/生效/审核 入口；全部客户 cstSt=6 草稿 → **正式保存不可录**，客户保存类交易一律走【暂存】（`saveCustTrade` prsvInd=0, cstSt 保持 6）
- **装订成册【装订成册】本环境 no-op**（S29 实锤，不可录）：影像资料 tab 工具栏按钮 `el-button--text el-button--small` **enabled 且可点**，但点击（无论是否先全选文件）→ **零 API/零弹窗/零 toast/零下载/零 console**（18s 全网络监控 + 点击落点验证，按钮 class 无 pressed 态变化）；工具栏无其他装订入口。与正式保存同性质=**功能未接线**（疑后台服务/feature-flag 测试环境未启用）
- **smbsn 收尾**：27 笔交付（S1-S28 除 S4）；**S4**（股东修改，后端「注册资本不能为空」）+ **S29**（装订成册 no-op）因环境/后端限制不可录
- **改字段后点【暂存】须 `Tab` 失焦 + 等 2500ms**（S28 踩坑）：`fill` 后立即点暂存，1000ms 时 Vue dirty-flag 未注册 → 暂存 **no-op 不触发 saveCustTrade**；`page.keyboard.press('Tab')` 触发 blur + `waitForTimeout(2500)` 后暂存稳定 200。**wire 侧**首回放因值≠当前值天然脏（可触发），重放幂等（值同→no-op 但点击仍成功）
- **el-checkbox 结构**（S27 批量下载）：原生 `input[type=checkbox]` 隐藏 0×0（click 超时），**可见可点=`label.el-checkbox`(14×23)/`.el-checkbox__inner`(14×14)**；header 全选=1 个 label，行=每行 1 个；空列表 checkbox 列不渲染（0 个）。全选 xpath=`//div[contains(@class,'el-tab-pane')]//div[contains(@class,'el-table__header-wrapper')]//label[contains(@class,'el-checkbox')]`
- **批量下载=前端 zip blob**（S27）：后端 `download` API/文件×N，前端合成**单个 .zip**（时间戳名如 1790738852846.zip，blob URL）→ 落盘 1 个 zip 非 N 个文件；profile `downloadTriggers` 已含 `["下载","批量操作"]`
- **Playwright 下载无需 `grantPermissions(['downloads'])`**（S27 踩坑）：加它报 `Unknown permission: downloads`；`page.waitForEvent('download')` 直接可用
- **分页定位**（S23）：折叠项作用域 xpath `//div[contains(@class,'el-collapse-item')][.//div[contains(@class,'el-collapse-item__header')][contains(.,'标题')]]//li[contains(@class,'number') and normalize-space(.)='N']`；首末页 `disabled`；**rect 须先 `scrollIntoViewIfNeeded`**（分页初始在 900 视口下方 y>1，boundingBox 越界）

### 5. 数据策略（已验证可用）

| 项 | 规则 |
|---|---|
| 客户名称 | `AT_SMB_<yyyymmddHHMMSS>`（过 checkCustTrade 查重） |
| 证件号码/机构USCC | 18 位随机统一社会信用代码（`randUscc()`，crdtTp=20111） |
| 联系电话 | `139` + 8 位随机 |
| 地址详情 | `AT引入测试路1号`（省份选广西-崇左-凭祥 有数据） |
| 基准客户（S2/S3/S4 编辑对象） | cstNo=`260924144929974126`，cstNm=`AT_SMB_20260924144917`，USCC=`91450100F17X0KGD0C`，注册资本=1,000,000,000.00，cstSt=6 草稿 |
| 营业日期/登记注册日期 | 2026-9-23 / 2025-06-18（日期类字段取值约束，见 4.2） |
| 股东行 | 股东名称 `AT_SMB股东_<ts>`，**基线=1 行**（S5 交付后清剩 1 行 AT_SMB股东_20260928144411；S5 回放会删掉，重放前须先跑 S3 补行） |
| 关联人行（S8/S9） | **引入真实对私客户** AT_正式_20260923110954（cstNo=260923191355585114，身份证 110101198501239591：17 位奇数→男性、出生日期 1985-01-23，数据与证件自洽）；**数据增长型**：每回放 S8 +1 行，平台不拦同客户同高管重复（当前基线客户=2 行，S9 已把首行改为 联系电话 13988158429/职称 一般员工 等 6 项新值）；清理=关联人 tab 选行【删除】→message-box OK |
| 影像文件（S12-S15） | 测试文件 `work/smbsn/AT_test_image_upload.png`（同名不去重）；客户管理目录基线=**0 文件**：S12 每回放 +1（增长型）/ S14 每回放 -1（消耗型）/ S13 只读需 ≥1 / S15 无依赖；目录内清零后重放 S13/S14 前**先跑 S12 补文件** |
| 其他信息（S16） | 只读幂等无数据依赖：历史修改记录基线 total=297（10 行/页 30 页，任何保存操作都会 +1 行属正常）；团队表恒 1 行管户权（新增/删除被业务规则封锁，见 4.9） |
| 列表页（S17-S22） | S17/S18/S19/S21/S22 只读幂等无数据依赖（S19 需联网核查表 ≥1 行，基线客户满足）；**S20 数据增长型**：每回放联网核查表 +1 行（基线 7 行→spec 8→回放 9，持续增长不清理）；核查行「核查通过/要素核查匹配正确」，法院表基线 1 行（涉诉/701994） |

### 6. 标准作业流（本平台落地版，通用原理见 playwright-ui-recorder）

1. **probe**（`work/smbsn/probe_*.js`，headless 复用 auth）：控件类型/选项枚举/API 请求响应/弹窗结构/路由/筛选生效性 → 结论写 plan.md，**没探清不写 spec**
2. **spec**（`tests/smbsn/S<n>-<name>.spec.ts`）：列表层走 API 断言（waitForResponse 查 total/行）；场景页 `openAllSections`→`inspectPage`→断言 plan 下限→`runFillPlan`→改后复读断言（新值≠原值，数值按数值比）→【暂存】断 saveCustTrade 200+postData.cstNo→【返回】→客户编号反查 total=1；落盘 `filllog-S<n>.json` + `s<n>-values.json`
3. **wire**：`node work/smbsn/gen-wire-s<n>.js` → `partner-wire/smbsn/S<n>-<name>.json`；生成器尾部必跑完整性校验 `dup=0 badPID=0 noRect=0`；日期步后插「关闭日期面板」；引入弹窗内插「首行记录单选」
4. **回放**：先 `refresh-wire-data`（换时间戳名/随机码）+ 刷 auth，再 `node replay-skill/replay.mjs <wire> --profile explore-cst-smbsn.json`（可 `--headed` 给用户回显）；失败分诊：数据依赖→刷数据重放 / 定位→修 wire / 引擎语义→换 eventTypeValue；**replay-skill 引擎已有动作语义禁改**，但允许**新增动作类型**（已有先例：SelectClickAction 多选 Esc 兜底、`file:choose` FileChooseAction（S12 上传））
5. **落库验证**：反查 total=1 + 抽查 3-5 个字段值 == wire 值（股东类查表格行数/行存在）
6. **plan.md** 记：交易行、探路结论、filllog/wire 步数、回放 N/N+耗时、落库抽查、已知残留

### 7. 二十七笔交付状态（2026-09-30）

| 交易 | wire | 状态 |
|---|---|---|
| S1 新增客户 | S1-new.json 89步 | ✅ 回放 89/89 102s，落库验证过 |
| S2 修改（两段式，56 项） | S2-edit.json 94步 | ✅ 回放 94/94 112s，落库验证过 |
| S2-clean 修改（干净单次，53 明文项） | S2-clean.json 69步 | ✅ 回放 69/69 75s |
| S3 股东新增 | S3-shareholder.json 23步 | ✅ 回放 23/23 34.5s，落库验证过 |
| S4 股东修改 | — | ⏸ 暂停：保存被后端「注册资本不能为空」挡，恢复方向见 4.4 |
| S5 股东删除 | S5-shareholder-delete.json 11步 | ✅ 回放 11/11 25s，落库验证过（行 2→1；删 `custCorporatRelatedParty/delete`） |
| S6 股东查看（只读） | S6-shareholder-view.json 11步 | ✅ 回放 11/11 23s（`custCorporatRelatedParty/get`，12 项全 dis，可任意重放） |
| S7 获取股东信息（只读） | S7-shareholder-fetch.json 12步 | ✅ 回放 12/12 26s（`custCorporat/networkCheck` + .el-notification 成功通知，表不变，可任意重放） |
| S8 关联人新增 | S8-related-party.json 34步 | ✅ 回放 34/34 53s（引入对私客户放大镜→自动回填→填 13 项→`saveFamily` 200；每回放 +1 行，落库验证过） |
| S9 关联人修改 | S9-related-party-edit.json 21步 | ✅ 回放 21/21 34.7s（编辑弹窗 17 项回显改 6 项异值→`saveFamily` 200；查看逐行核对持久化；幂等可重放） |
| S10 关联人查看 | S10-related-party-view.json 11步 | ✅ 回放 11/11 25.2s（只读弹窗 17 项全 dis 断言+5 列值==行值；无 get API；纯只读幂等） |
| S11 关联人删除 | S11-related-party-delete.json 11步 | ✅ 回放 11/11 23.5s（选行→删除→message-box「您确定删除这条记录吗?」→OK→`delete` 200 行-1；数据消耗型，清零后须 S8 补行） |
| S12 影像上传 | S12-image-upload.json 13步 | ✅ 回放 13/13 28.6s（目录树选客户管理→`file:choose` 系统文件框→`upload` 200 自动落列表；引擎新增 file:choose 动作；数据增长型每回放 +1 文件） |
| S13 影像查看（只读） | S13-image-view.json 14步 | ✅ 回放 14/14 30.9s（模式守卫→首行预览=行内 viewer+属性面板 `preview` 200→返回列表；双显示模式服务端持久化，wire 以表格模式收尾） |
| S14 影像删除 | S14-image-delete.json 15步 | ✅ 回放 15/15 31.9s（首行删除→message-box「是否删除该档案」→`deleteFileInf` 200 文件-1；确认按钮 locale 漂移，xpath 双文案兼容；数据消耗型，目录当前=0） |
| S15 影像目录检索（只读） | S15-catalog-search.json 10步 | ✅ 回放 10/10 20.5s（左侧 `.leftContent` 目录搜索框 div.el-input 输入「营业执照」过滤树 17→2→清空恢复；树懒渲染基线不稳，断言用稳定轮询；无数据依赖可任意重放） |
| S16 其他信息-查看历史修改记录（只读） | S16-other-info-history.json 10步 | ✅ 回放 10/10 25.2s（其他信息 tab 三段加载断言：团队 1 行/历史 total=297/登记 7 项；历史分页 2→1 往返；重进 297 不变；无数据依赖可任意重放；团队新增/删除被业务规则封锁不录，见 4.9） |
| S17 列表-查看（只读） | S17-view.json 7步 | ✅ 回放 7/7 16.6s（选行→【查看】→场景页 viewType=look，按钮仅剩【返回】不可持久化；6 tab 断言；无数据依赖可任意重放） |
| S18 联网核查-查看（只读） | S18-netcheck-view.json 10步 | ✅ 回放 10/10 23.6s（核查 dialog 锚 `button=发起实时核查`；核查结果 tssc-multi-select=核查通过→`inspRsltId='1'`；dialog 表格行异步加载须先等 API；无数据依赖） |
| S19 联网核查-查看详情（只读） | S19-netcheck-detail.json 11步 | ✅ 回放 11/11 23.4s（首行 Radio→【查看详情】子 dialog 50 项只读，`custCorporatNetworkCheckBasic/get`；需核查表 ≥1 行） |
| S20 联网核查-发起实时核查（数据增长型） | S20-netcheck-run.json 11步 | ✅ 回放 11/11 24.9s（message-box 确认→`custCorporat/networkCheck` ntwrkgInsp=1 rslt=1→重查行 +1；**locale 漂移实锤**，确认按钮双语 xpath OK/确定；每回放 +1 核查行） |
| S21 法院信息-查看（只读） | S21-court-view.json 10步 | ✅ 回放 10/10 23.7s（法院 dialog 锚 `label=法院信息类型`；法院信息类型=涉诉→`courtInfTp='1'`；表格 7 列+是否有效 tssc-multi-select；按钮仅 取消；无数据依赖） |
| S22 高级查询（只读幂等） | S22-advanced-query.json 8步 | ✅ 回放 8/8 20.2s（caret 独立 button 展开→证件号码+客户状态=草稿客户(cstSt=6)→查询 body 断言→重置→caret 收起；`data.list` 键；无数据依赖可任意重放） |
| S23 列表页分页（只读幂等） | S23-list-pagination.json 7步 | ✅ 回放 7/7（折叠项作用域 xpath 定位页码 `li`；首末页 disabled；rect 先 `scrollIntoViewIfNeeded` 分页初始在 900 视口下方 y>1；无数据依赖） |
| S24 影像下载（数据消耗型） | S24-image-download.json 10步 | ✅ 回放 10/10（行操作【下载】=`.el-table__fixed-right` 固定列 span；profile `downloadTriggers` 含「下载」→引擎 DownloadAction `waitForEvent('download')`+`saveAs`；每回放 -1 文件） |
| S25 图册查看（只读） | S25-album-view.json 11步 | ✅ 回放 11/11（行操作【图册查看】→图册弹窗图片轮播；只读查看） |
| S26 影像移动 | S26-image-move.json 12步 | ✅ 回放 12/12 41s（行操作【移动】→「移动目录」dialog 目录树平铺 16 顶级节点→选 贷后管理→`moveCtlg` 200→文件从 客户管理 移至 贷后管理；`el-dialog__title` 是 **span** 非 div；确认=`//button[normalize-space()='确认选择']`） |
| S27 影像批量下载（数据消耗型） | S27-image-batch-download.json 12步 | ✅ 回放 12/12 29s（表格 header 全选+行 checkbox：原生 input 隐藏 0×0，可见可点=`label.el-checkbox`；【批量操作】未选 toast「请选择要下载的数据」→选中→后端 `download`/文件×N→前端合成**单个 zip blob**（时间戳名）；profile `downloadTriggers` 增「批量操作」；**Playwright 下载无需 `grantPermissions(['downloads'])`** 会报 Unknown permission） |
| S28 客户保存-暂存口径 | S28-customer-save.json 12步 | ✅ 回放 12/12 24s（**正式保存【保存】本环境 no-op**：干净/脏表单/暂存后均不触发 API/跳转/toast，列表页无 提交/正式/生效 入口，全部客户 cstSt=6；唯一可用=**【暂存】**→`saveCustTrade` prsvInd=0 cstSt 保持 6；单字段改 客户简称，区别 S2 全改；**改字段后点暂存须 `Tab` 失焦+等 2500ms**（1000ms 时 Vue dirty-flag 未注册→暂存 no-op）） |
| S29 装订成册 | — | ⛔ 不录：影像资料工具栏【装订成册】enabled 可点但点击零 API/弹窗/toast/下载（18s 全网络监控+点击落点验证），功能本环境未接线（同正式保存性质）；smbsn 收尾 |

### 8. 扩展到其他模块

1. 选/建 profile（`replay-skill/profiles/` 已有 9 个）；新模块补 pages（match 关键字→urlPattern/route/readySelector）+ popups（**标题匹配顺序敏感**：更具体的 match 放前面，如"股东信息"必须先于"新增"，否则落错 .el-drawer 超时）
2. 字段引擎/子流程直接 import `tests/smbsn/fillEngine.ts`、`fillSubflows.ts`（跨模块通用 element-ui 约定），spec 放 `tests/<module>/`，work 目录 `work/<task>/`
3. 新模块的组件坑按第 4 节格式补进本文件（平台事实持续沉淀在这）


---

## 模块二：pdlib 产品库管理（P01-P17）

基于 P01–P17 十七笔录制沉淀（`tests/pdlib/capture.js` 17/17 通过 + `partner-wire/pdlib` 17/17 回放 PASS + 0 孤儿清理验证）。
**通用流程、wire schema、定位原则不在此重复** → 见 `playwright-ui-recorder` skill。本文件只记 **pdlib 模块实测事实**，与通用规则冲突时以本文件为准（本平台实测）。

### 1. 平台与环境

| 项 | 值 |
|---|---|
| 平台 | `http://test.creditv5p2.tansun.com.cn`（天阳信贷 V5P2，微前端，element-ui 系） |
| 模块路由 | `/#/pdMgt/pdInfMgt/pdMgtMgtPg`（产品管理 > 产品信息管理 > 产品库管理） |
| 视口 | **必须 1440×900**（capture/profile/rect 量取三处一致） |
| 登录 | 账号 `701994` / 密码 `1` / 图形验证码 `1234`（写死在 profile）；图形验证码**不校验**（值任意）；登录按钮 DOM 文本「登 录」带空格（引擎白空格正则容忍）；**切勿点「发送验证码」** |
| 登录态 | `auth.json`（仓库根，storageState，**几十分钟有效**，过期即重定向 `/login`）；刷新：`node work/pdlib/refresh-auth.js`（重写根 `auth.json`）；引擎过期自动登录新态存 `replay-out/auth-refreshed.json`（**不覆盖根**）→ `cp work/pdlib/replay-out/auth-refreshed.json auth.json` 可手动刷新 |
| 回放 profile | `replay-skill/profiles/explore-cst-pdlib.json`（homeRoute=产品库页，`tableReadySelector=.el-tree`，popups 1 条【确认→`.el-message-box`】，backButtonText=返回） |
| 回放命令 | `node replay-skill/replay.mjs partner-wire/pdlib --profile replay-skill/profiles/explore-cst-pdlib.json [--headed]` |

**⚠ 会话稳定性（本平台回放最大坑）**：`auth.json` 有效期短，回放中途可能过期。引擎**只在每笔的根页 `goto` 时**检查 `/login` 并自动登录；**中途过期**会让当前页跳到 `/login`，后续 `waitForVisible` 的 `count()` 在坏页上**挂起**（曾见单步卡 16 分钟直到浏览器死）。**解法**：回放前 `node work/pdlib/refresh-auth.js` 刷新，**并直接链式** `node refresh-auth.js && node replay.mjs ...`（**中间不要插其他浏览器启动**，避免会话抖动），可稳定跑完 17 笔（~3 分钟）。引擎自动登录要能成，`profile.login` 必须用真实选择器：`input[name='username']` / `input[name='password']` + `input[placeholder*='图形']` + 法人下拉 `input[placeholder*='法人']`（**不是** `placeholder='用户名'`——那是别的模块的错配，会让自动登录 `fill` 拿 `undefined` 失败）。

### 2. 可复用资产（勿重写）

| 路径 | 用途 |
|---|---|
| `tests/pdlib/capture.js` | 17 笔 capture 主脚本：逐笔 fresh page（对齐回放）+ 录 rect + 断言 + 净零 sweep 收尾（含 `disableProduct`+`apiDelete` 的 0 孤儿兜底）。产出 `work/pdlib/pdlib-values.json` |
| `work/pdlib/gen-wires.js` | 由 `pdlib-values.json` 生成 `partner-wire/pdlib` 17 笔可回放 wire（对齐回放引擎 WireTransaction/StepNode 形状） |
| `work/pdlib/pdlib-values.json` | capture 产出：各步 rect（归一化 x1/y1/x2/y2）+ 动态值（cat1/cat2/prod/clone/seq*） |
| `work/pdlib/refresh-auth.js` | 重新登录天阳 test，重写根 `auth.json`（登录态过期后跑） |
| `work/pdlib/state.js` | 查当前 `AT_产品库` 残留节点（净零核对） |
| `work/pdlib/cleanup.js` | 清理 `AT_产品库` 残留至 0（可重复跑）：叶子产品 pdSt=1→UI 删 / pdSt=2→禁用+API 删 / pdSt=3→API 删；空分类→UI 删 |
| `partner-wire/pdlib/` | P01–P17 十七笔 wire（`P01-view-cat.json`…`P17-del-cat.json`） |
| `replay-skill/profiles/explore-cst-pdlib.json` | pdlib 回放 profile |
| `work/pdlib/atp-import.js` | 把 17 笔 wire 转 V3 推送到 ATP 伙伴平台（目标 智能化2.0→产品库管理，见 §9）；DRY / `--push` 两模式 |
| `work/pdlib/atp-verify.js` | 校验 17 笔已同步（POST `demandtranscation/list` 按 systemId/projectId 过滤，统计 `产品库管理-*` 交易） |

其他模块 profile（参照新建/扩展）：`explore-cst-pdstg / explore-cst-smbsn / explore-cst-cpdm / tansun-credit / …`。

### 3. pdlib 模块结构（实测）

左侧「**产品树**」+ 右侧「**节点详情表单**」。**两种节点，表单不同**：

#### 分类节点（`leafNodeInd=0`，如 `金融新产品`）
- 表单字段（5）：`分类编号`(disabled) / `分类目录` / `分类名称*` / `序号*` / `分类描述`(textarea)
- 按钮：`保存`
- 加载 API：`prodPdInf/get`

#### 产品节点（`leafNodeInd=1`，如 `ziranrenceshichanp006`）
- 表单字段（16）：`产品编号`(disabled) / `产品目录` / `产品名称*` / `产品发布版本号`(disabled) / `产品状态`(disabled select) / `序号` / `额度类型`(select) / `产品生效日期`(date) / `产品失效日期`(date) / `产品建立日期`(disabled) / `产品类型`(select) / `征信产品类型`(select) / `征信组别大类`(select) / `征信组别小类`(select) / `产品描述与简介` / `备注`
- 按钮：`保存` / `启用`（启用后变「禁用」）/ `产品克隆` / `配置视图` / `产品历史`
- 加载 API：`prodPdInf/get`

#### 左树工具栏（7 个 icon-only `<a class="el-tooltip">`，**按 icon class 定位**，勿靠 tooltip 文本）
| icon class | 动作 | 定位 |
|---|---|---|
| `el-icon-folder-add` | 新增一级分类 / 新增分类 | `[1]`=一级，`[2]`=子分类（**需先选中父节点**） |
| `el-icon-document-add` | 新增产品 | `[1]`（**需先选中父分类**） |
| `el-icon-delete` | 删除 | `[1]` |
| `el-icon-top` | 上移 | `[1]` |
| `el-icon-bottom` | 下移 | `[1]` |
| `el-icon-refresh` | 刷新产品树 | `[1]`（**需先选中节点**才出现） |

#### 搜索框
- 定位：`//div[contains(@class,'shrink-search-input')]//input`（输入）+ `//div[contains(@class,'shrink-search-input')]//div[contains(@class,'input-icon')]`（提交）
- **必须点 `input-icon` 提交，不是 Enter**；点 icon 后树过滤（隐藏非匹配节点），可定位深层产品。

#### 弹窗结构（全部 `.el-dialog`，**XPath 须锚定 `.el-dialog` 防 wrapper-body 子串误匹配**）
- **新增一级分类 / 新增分类**（title「产品」，4 字段）：`分类编号`(disabled)/`分类目录`(自动带父)/`分类名称*`(Input)/`序号`(Input)；按钮 `确 定`/`取 消`
- **新增产品**（title「产品」，5 字段）：`产品编号`(disabled)/`分类目录`/`产品名称*`(Input)/`序号`(Input)/`产品描述`(textarea)；按钮 `确 定`/`取 消`
- **产品克隆**（title「产品克隆」，4 字段）：`原产品编号`/`原产品名称`/`新产品编号`/`新产品名称`(Input)；打开触发 `prodPdInf/genEcd`；按钮 `确 定`/`取 消`
- **产品历史**：版本历史表（列：Radio/产品发布版本号/产品状态/创建时间/禁用理由）；按钮 查看/取消

#### 关键 API（前缀 `prod-api/tansun-tcp-app-pc/tansun-tcp-prod/`）
- `prodPdInf/tree`（产品树加载/刷新）、`prodPdInf/get`（节点详情）
- `prodPdInf/save`（新增一级分类/新增分类/新增产品/修改分类保存）
- `prodPdInf/delete`（删除，body `{id, pdSt}`）
- `prodPdInf/cloneProduct`（**产品克隆走这个，不是 save**）
- `prodPdInf/genEcd`（克隆打开时生成新产品编号）
- `prodPdInf/list`（`del()` 查子节点用；有子则阻止删除）
- `prodPdInf/checkPdInf`（禁用流程校验）、`updateStatusFunc`（状态切换落库）

### 4. 平台组件坑（P01–P17 实测，录制前必知）

#### 4.1 `pdSt` 状态机与可删性（**本模块最核心事实**）
产品/分类的 `del()` 源码 guard：`if (leafNodeInd=="1" && pdSt!="1") return error("产品不是未启用，不能删除")`。据此：

| `pdSt` | 含义 | UI 删除 | API 删除（`prodPdInf/delete`） |
|---|---|---|---|
| `"1"` | 未启用（新建产品默认态） | ✅ 可删（**唯一 UI 可删态**） | ✅ 可删 |
| `"2"` | 启用 | ❌ 阻止（guard 触发） | ⚠️ 返回 `status:200 操作成功` 但 **no-op**（不实际删，节点仍在） |
| `"3"` | 禁用 | ❌ 阻止（同 guard，`pdSt!="1"`） | ✅ 可删（`status:200`，实际删） |

- **启用不可逆（UI 维度）**：一旦 `启用`（P12），产品 `pdSt` 1→2，UI 永远删不掉；其父分类因「含不可删子节点」也删不掉 → **环境留 2 孤儿（PROD + 其 CAT1）**。
- **禁用不恢复 UI 可删性**：启用→禁用（pdSt 2→3）后 UI 仍被 guard 阻止；但 **API 可删**。
- **0 孤儿兜底路径（已验证）**：`pdSt=1`→UI 删；`pdSt=2`→**先禁用(→3) 再 API 删**；`pdSt=3`→API 删。见 `work/pdlib/cleanup.js` / `capture.js` sweep。

#### 4.2 禁用（下架）完整流程（P12 反向，曾卡点，已解）
对**已启用**产品点「禁用」：
1. 点「禁用」按钮 → 打开 `.el-dialog`（含 `tssc-multi-select`「禁用理由」）。
2. 选理由（如「其他原因」）→ `model.downShelfRsn` 提交。
3. **确定按钮被 overlay 遮挡** → 不点 UI，直接调 `ElmtgroupIndex` 的 `productDownFun()`（`document` 全节点找 `__vue__.$options.name==='ElmtgroupIndex'` 再调 `v.productDownFun()`）。
4. `productDownFun` → `validate`（`$refs.proDown.$refs.eleForm`）→ 把 `model` 字段复制到 `this.formData` → `this.updateStauts("3")`。
5. `updateStauts("3")` → **第二个确认**：`$tssc.confirm("确定执行此操作？")` message-box → 点 OK（**漏这步是早期卡死主因**）。
6. → `prodPdInf/checkPdInf`（formData）→（若返回 msg 则再来一次 confirm）→ `updateStatusFunc("3")` → `pdSt` 变 `"3"`。
> 成功通知是 `.el-notification`（非 `.el-message`）。message-box 确认按钮 locale 漂移，XPath 恒用双语 + 空格：`//div[contains(@class,'el-message-box')]//button[normalize-space()='OK' or normalize-space()='确定' or normalize-space()='确 定']`。

#### 4.3 `del()` 删除确认
选节点 → 点删除 icon → `$confirm` message-box → 点确认 → `prodPdInf/delete {id, pdSt}`。分类有子节点时 `prodPdInf/list` 检查命中 → 阻止（报「存在子节点，不能删除」类）。

#### 4.4 P11 修改产品 = 纯 UI（产品表单【保存】本环境 no-op）
产品详情表单的「保存」不落库（no-op）；P11 只录**交互**（选产品 → 改「备注」→ 点保存），**不 assert save 响应**（只 assert 无错误提示）。改字段后点保存前 `Tab` 失焦 + ~2000ms。

#### 4.5 P13 产品克隆走 `cloneProduct`（非 save）
点「产品克隆」→ 弹窗填「新产品名称」→ 点确定 → 触发 `prodPdInf/cloneProduct`（**不是 save**）。clone 落**同父节点**（`prnHierPdNo` 同原产品）。capture 用 `confirmClone` 等待 `cloneProduct` 响应（lenient，非 200 只告警不抛）。

#### 4.6 P14/P15 上移/下移后树重渲染
点 上移/下移 后**树重新渲染**，原节点 rect 失效 → **必须重新 `searchTree(CLONE)` 过滤定位**再断言（capture 里 `selectNode` 后再 `searchTree` + `boundingBox` 守卫，避免 `boundingBox` 在空 locator 上超时）。

#### 4.7 新增子节点需先选中父（隐式 `prnHierPdNo`）
`新增分类`/`新增产品` 挂到**当前选中的树节点**下（`save` body 带 `prnHierPdNo`），**无放大镜**，靠选中态隐式传递。capture 层级：`CAT1 → {CAT2, PROD, CLONE}`（PROD/CLONE 挂 CAT1 下，非 CAT2 下）。

#### 4.8 通用定位约定
- `L(x)` = `page.locator('xpath='+x).filter({visible:true}).first()`（防残留隐藏实例）。
- 节点 XPath：`//*[contains(@class,'el-tree-node__content')][not(ancestor-or-self::div[contains(@class,'el-dialog')])][contains(normalize-space(.), 'name')]`（`not(ancestor...)` 排除弹窗内同名）。
- 表单按钮 XPath 恒双语 + 空格：`//button[normalize-space()='确 定' or normalize-space()='确定']`、`'保 存' or '保存'`、`'启 用' or '启用'`。

### 5. 数据策略（已验证可用）
- **净零命名**：`AT_产品库_{一级|子|产品|克隆}_<TS>`（`TS` = capture 起始时间戳，整轮共享 → 跨交易依赖靠共享名）。
- **稳定锚点**：`金融新产品`（分类）、`ziranrenceshichanp006`（产品）——只读交易（P01/P02/P04/P05/P06）固定选这两个，不新建。
- **序号**：CAT1=`1` / CAT2=`2` / PROD=`3`。
- **改值**：`AT_改_<TS>`（分类描述）、`AT_备注_<TS>`（产品备注）。
- **跨交易数据依赖**：P08 需 P07 的 CAT1；P09 需 CAT1；P10 需 CAT2；P11/P12/P13 需 PROD；P14/P15/P16 需 CLONE（P13 克隆出）。**回放引擎每笔新 page 但共享 context + 库内数据**，按 P01→P17 顺序回放即承接依赖。
- **残留兜底**：`capture.js` finally 有全量 sweep（`AT_产品库`）；`cleanup.js` 可独立把环境清到 0。**wire 回放不留 sweep**（P16/P17 只删 CLONE/CAT2，PROD+CAT1 留作环境孤儿）→ **重放前务必先 `cleanup.js` 或 `state.js` 确认 0 残留**，否则固定名冲突。

### 6. 标准作业流（本平台落地版，通用原理见 playwright-ui-recorder）
1. **探路**：`work/pdlib/probe_*.js`（读源码/行为，确认 pdSt guard、禁用流程、API）。
2. **capture**：`node tests/pdlib/capture.js`（17 笔 fresh page + rect + 断言 + 净零 sweep）→ 产出 `work/pdlib/pdlib-values.json`。
3. **gen-wires**：`node work/pdlib/gen-wires.js` → `partner-wire/pdlib/P01…P17`。
4. **回放**：`node work/pdlib/refresh-auth.js && node replay-skill/replay.mjs partner-wire/pdlib --profile replay-skill/profiles/explore-cst-pdlib.json`（**链式**，保会话稳定）→ 读 `work/pdlib/replay-out/replay-report.json`（期望 17/17 PASS）。
5. **净零**：`node work/pdlib/cleanup.js`（清 `AT_产品库` 至 0）→ `node work/pdlib/state.js` 复核。

### 7. 十七笔交付状态（capture 17/17 + 回放 17/17 PASS）
| # | 交易 | 类型 | 关键 API / 事实 |
|---|---|---|---|
| P01 | 查看分类 | 只读 | 选 `金融新产品` → 分类表单（`prodPdInf/get`） |
| P02 | 查看产品 | 只读 | 选 `ziranrenceshichanp006` → 产品表单 |
| P03 | 搜索产品树 | 只读 | 搜索框 + 点 `input-icon` 提交（非 Enter） |
| P04 | 刷新产品树 | 只读 | 选节点后点 `refresh` icon → `prodPdInf/tree` 再触发 |
| P05 | 产品历史 | 只读 | 选产品 → 点「产品历史」→ 版本表弹窗 |
| P06 | 配置视图 | 只读 | 选产品 → 点「配置视图」→ 导航到 `pdCfgVw` 路由 |
| P07 | 新增一级分类 | 变更 | `folder-add[1]` → 弹窗 → `prodPdInf/save`（CAT1） |
| P08 | 新增分类 | 变更 | 选 CAT1 → `folder-add[2]` → 弹窗 → save（CAT2，`prnHierPdNo`=CAT1） |
| P09 | 新增产品 | 变更 | 选 CAT1 → `document-add[1]` → 弹窗 → save（PROD） |
| P10 | 修改分类 | 变更 | 选 CAT2 → 改「分类描述」→ 保存（save） |
| P11 | 修改产品 | 纯 UI | 选 PROD → 改「备注」→ 保存（**no-op**，不 assert save） |
| P12 | 启用产品 | 状态 | 选 PROD → 点「启用」→ message-box 确认 → pdSt 1→2（**不可逆**） |
| P13 | 产品克隆 | 特殊 | 选 PROD → 「产品克隆」→ 填新产品名称 → **`cloneProduct`**（CLONE 落同父） |
| P14 | 上移 | 排序 | 选 CLONE → `top` icon → **须 searchTree 重定位** |
| P15 | 下移 | 排序 | 选 CLONE → `bottom` icon → 须 searchTree 重定位 |
| P16 | 删除产品 | 净零 | 选 CLONE → `delete` → 确认 → `prodPdInf/delete`（CLONE pdSt=1 可删） |
| P17 | 删除分类 | 净零 | 选 CAT2 → `delete` → 确认 → delete（CAT2 已无子） |

> 净零：P16/P17 各删一个新建节点；**PROD（已启用 pdSt=2）+ CAT1（含 PROD）** 留作 2 环境孤儿（UI 不可逆），由 `cleanup.js`（禁用+API）兜底到 0。

### 8. 扩展到其他模块
- 新交易：抄 `tests/pdlib/capture.js` 对应 P 段结构（`freshPage` → `selectNode`/`clickTB` → 断言 → 录 `V.*Rect`），再在 `gen-wires.js` 加对应 emit 块。
- 新产品库子模块（如产品工厂 pdstg 已有 `explore-cst-pdstg`）：复用本 profile 骨架，改 `homeRoute` + `tableReadySelector` + `pages`/`popups`。
- **会话过期**：任何 pdlib 回放失败先 `refresh-auth.js`；引擎中途过期会 hang（见 §1）。
- **删除/启用受限**：新增「删除已启用产品」类交易时，UI 删不掉，须走 §4.2 禁用 + API 删（wire 无法纯 UI 表达 API 删，需 capture 侧或 cleanup 兜底）。

### 9. ATP 平台同步（智能化2.0，已交付）
把 17 笔 wire 同步到 ATP 伙伴平台 `http://test.atp.tansun.com.cn/demandAnalysis/deal`，挂到 **智能化2.0（projectId 13）→ 天阳信贷平台 > 产品管理 > 产品库管理（systemId 1018）**。

- **命令**（`TOK`=ATP 的 SSO JWT，`~50min` 有效，登录 `test.atp.tansun.com.cn` 后任意 API 请求头 `access_token`）：
  ```
  TOK=<jwt> node work/pdlib/atp-import.js                 # DRY: 解析项目/节点 + 生成 *-v3.json
  TOK=<jwt> node work/pdlib/atp-import.js --push          # 推送 17 笔
  TOK=<jwt> node work/pdlib/atp-verify.js                 # 校验: 节点 1018 下 产品库管理-* 应 >=17
  ```
- **⚠ API base 坑**：`docs/partner/伙伴平台接口说明.md` 里写的默认 `http://172.20.101.162:11001/api` **已连不上（connection refused，主机在线但端口关）**；必须走 web 同源 `PARTNER_API_BASE=http://test.atp.tansun.com.cn/api`（import 脚本默认值仍写死旧 IP，**跑前先 export/传这个 env**，或改脚本默认）。
- **接口**：`POST /system/systemproject/list`（取 projectId）→ `GET /system/system/lazySystemTree?projectId&menuType=1&from=0[&parentId]`（BFS 取 systemId）→ `POST /demand/demandtranscation/importDemand`（推送，body=`transcationEventTypeList`）。
- **校验接口**：`POST /demand/demandtranscation/list?...&orderMenuType=1`，body `{"systemId":"1018","projectId":"13","nodeType":0}`（**按选中项目/节点作用域，不是 URL 过滤**；节点下既有 9 笔存量，+17 笔本模块 = 26）。
- **wire 格式已对齐**：`work/pdlib/gen-wires.js` 直出伙伴 V3 字段（`eventTypeValue`/`eventTypeName`/`mothed`/`propertiesPID`/`realLabel`），`atp-import.js` 的 `buildV3` 直接读 `eventTypeValue`，无需转换（与 pdstg `atp-import.js` 同源）。
- **重同步**：节点下会叠加（同名交易重复推送）。重推前先确认是否要清理，或换新 `transcationName`。


## 模块三：grpRtg 集团客户评级（G01-G16）

基于 G01–G16 十六笔录制沉淀（`partner-wire/grpRtg` **16/16 回放 PASS**，自包含净零，回放后列表恢复空）。
**通用流程、wire schema、定位原则不在此重复** → 见 `playwright-ui-recorder` skill。本文件只记 **grpRtg 模块实测事实**，与通用规则冲突时以本文件为准（本平台实测）。完整设计见 `work/grpRtg/plan.md`。

### 1. 平台与环境

| 项 | 值 |
|---|---|
| 平台 | `http://test.creditv5p2.tansun.com.cn`（天阳信贷 V5P2，微前端，element-ui 系） |
| 模块路由 | `/#/rtgMgt/grpcstRtg/grpcstRtgAplyMgtPg`（评级管理 > 集团客户评级） |
| 任务页 | `.../newGrpcstRtg/cstmgrIttGrpcstRtg/FS00020695HostCstmgrIttGrpcstRtg?...`（SPA 4 步，URL 不变靠 下一步/返回 切；查看详情=`viewType=look`，修改=`viewType=modify`，评级申请创建后无 viewType 但 URL 含 `pcsEcd=wf_rating_005`） |
| 视口 | **必须 1440×900** |
| 登录态 | 根 `auth.json`（~50 分钟有效）；探路脚本用 `work/grpRtg/scan-lib.js`（自动登录态检查，AUTH_EXPIRED 时 refresh） |
| 回放 profile | `replay-skill/profiles/explore-cst-grpRtg.json`（pages：评级详情查看/评级修改/评级任务页【pcsEcd=】；popups：评级申请 `.el-drawer`/选择客户·新增征信查询客户·流程轨迹 `.el-dialog`/删除确认 `.el-message-box`） |
| 回放命令 | `node replay-skill/replay.mjs partner-wire/grpRtg --profile replay-skill/profiles/explore-cst-grpRtg.json`（整目录按文件名序=回放序） |

### 2. 可复用资产（勿重写）

| 路径 | 用途 |
|---|---|
| `work/grpRtg/gen-wires.js` | 16 笔 wire 生成器（makeWire/EVT/subpageWire/ROW 模板；改后 `rm -f partner-wire/grpRtg/*.json` 重跑） |
| `work/grpRtg/plan.md` | 完整设计：探路事实/后端规则/select 机制/净零策略/16 笔表/坑/回放史 |
| `work/grpRtg/scan-lib.js` | 探路公共库（launch+auth+scanner+API 收集，自动去列表页） |
| `work/grpRtg/probe_*.js` | 探路脚本：probe_12 图册 / probe_15 空列表建单 / probe_16-19 drawer 下拉+建议等级懒加载 / probe_20-21 查列表+删残留 / **probe_22-50 新增征信查询客户引入弹窗专攻**（ZJJK 组件/三条件非空/fill 兼容/授权日期规则/保存 API）/ probe_51-52 清残留+净零验证 |
| `partner-wire/grpRtg/` | G01–G16 十六笔 wire（`01-aply.json`…`23-delete.json`，含 `20-creditcust.json`） |
| `replay-skill/profiles/explore-cst-grpRtg.json` | 回放 profile |
| `replay-skill/src/engine/actions/SelectScrollAction.js` | **引擎新增动作 `select:scroll`**（本模块驱动开发，ActionFactory 已注册） |

### 3. 模块结构（实测）

**列表页**：搜索区=业务编号(input)+客户编号/客户名称(**disabled** input)+「客户名称」放大镜**按钮**(=选择客户入口)+查询/重置；高级查询=**caret 按钮**(`//button[.//i[contains(@class,'el-icon-caret-bottom')]]`)展开→审批状态/评级发生类型/日期区间。行操作=**表上工具栏 6 按钮**（**无 `.handle-container`**）：评级申请/修改/删除/查看详情/流程轨迹/**评级重评**（注意不是「重新评级」）；先选中行（行首 radio，**label 常 hidden**→点可见行首列 td force+断言 `input[type=radio]` checked）。列表 API `IRtgAplyBsnInfApi/pageBsnInf`（bsnTp:"3"），**bsnNo DESC 新建单恒首行**。

**评级申请**：空列表/未选行**可直接点「评级申请」开 drawer**（probe_15）→ drawer 客户名称 select（`custGroup/queryGroup`，**组件内分页** 5 项/页：page1 含 RK001测试集团改 grpNo=261012042653563213，分页按钮在 dropdown 内，headless 文案 `Prev Page`/`Next Page`）→ 下一步（风险阻断 `scmExec` FKFA000004009 总校验结果=通过）→ 确定（`createRating`+`startProcess`，直接跳任务页）。

**任务页 4 步**：step1=评级基本信息(只读)+评级等级测算(**表格布局**，指标行 xpath `//tr[.//div[contains(@class,'cell')][normalize-space(.)='资产负债率']]//input`，测算/暂存)+系统评级结论(**默认展开**，勿点 header)+征信信息(一键添加征信查询对象/新增征信查询客户/删除)+历年评级+客户综合评价(textarea+保存)；step2(NEXT×1)=影像(图册查看→「档案书册」el-dialog X 可关)；step3(NEXT×2)=风险阻断(总校验结果=通过+**刷新**)；step4(NEXT×3)=意见信息。

**新增征信查询客户弹窗**（step1 征信节「新增征信查询客户」按钮→el-dialog 720×630 居中）：字段=客户名称/**客户类型**/**证件类型**/证件号码（均 **disabled，引入后自动回填**）+**证件到期日**/授权日期（el-date-editor，fill 直接填 yyyy-MM-dd）+查询事由(select 8 项：贷后管理/贷款审批/信用卡审批/担保资格审查/特约商户实名审查/法人代表、负责人、高管等资信审查/客户准入资格审查/资信审查)+查询类型(select 仅「人行数据」)；按钮=引入/取消/确认。
**引入子弹窗「客户选择」**（点引入再开一个**同尺寸同位置** el-dialog，z 2003 盖父弹窗 z 2001，单 v-modal z=2002）：低代码组件 **`ZJJK00109101`**（qiankun sandbox，方法 `[native code]` 源码不可读）；字段=客户编号/客户名称/证件类型/证件号码 + 对私/对公 tab 按钮（`disableBtn` class 是 red herring，可点）+查询/重置/取消/确认；查询 API=person 默认 `custPersonal/queryPersonalMagnifierList`（body `cstNmLike` 模糊）/对公 `custCorporat/queryCustMagnifierList`/集团 `custGroup/queryGroupMagnifierList`；行 radio 选中→确认→父弹窗四字段回填+子弹窗关。保存=`ICstCreditInvApi/save`（body 含 cstNm/cstCgy/crdtTp/crdtNo/crdtExdt/crAhnTm/crEnqrRsnTp/dataEnqrmod/ftmEnqrCodt=授权日期+30 天/cstNo/bsnNo）。

### 4. 后端校验规则（实测）

1. **重复守卫（静默失败）**：同客户已有**待发起**单再发起评级申请 → 无新记录无 toast，**drawer 不自动关闭**（wire 用「软关 drawer」+任务页 URL checkpoint 兜住）。01-aply 前置=环境无该客户待发起单。
2. **请先进行测算**：结论保存前必须指标已暂存（`13-indicator` 强制先于 `14-conclusion`）。
3. **±2 级范围**：`saveOrUpdateCnclsnInf` 校验建议等级须在系统评级 ±2 内；资产负债率=55 暂存→系统评级 D→建议等级选 **D**（=系统评级必过）。
4. **结论双必填**：建议等级+理由说明。
5. **引入放大镜三条件非空**：客户选择弹窗点查询时 客户编号/客户名称/证件号码 **不可同时为空**，否则 `search()` 同步返回 false、**零网络请求**（console `调用search结果为false`）。**引擎 `fill()` 可触发查询**（probe_46 验证；JS native setter+dispatch 无效）。
6. **征信查询客户保存**：`ICstCreditInvApi/save` **授权日期必须早于回放日**（=今日 → code=100 静默拒、弹窗不关，极易误判成功；=昨日 → `{"status":200,"description":"操作成功"}` 弹窗自动关）。征信客户随 bsnNo 级联删。

### 5. tssc 下拉交互机制（`select:scroll` 动作，本模块驱动开发）

任务页「建议等级」(32 项) 与 drawer「客户名称」(分页) 共同特征：
- form-item 内联 dropdown 副本**恒 disp=none**；真展开的是 **body 级 teleport 副本**（页面上 20+ 个 `.el-select-dropdown` 实例，须找 `display!=none && width>0` 那个）。
- **打开**：`mouse.move(中心)→down→up`（普通 locator.click 无效）。
- **可见行是独立渲染元素**；`.el-select-dropdown__item` 是**隐藏数据行（h=0 全堆叠）**——实测对 h=0 数据行 **DOM `it.click()` 即选中**（回填+收起）→ **在 DOM 即直点，勿做视口/高度检查**（旧版视口检查在 drawer 下拉上 0↔120 振荡必挂）。
- **建议等级懒渲染**：初始仅 20 项在 DOM，`scrollHeight` 只含已挂载项；**滚到底才异步挂载后续（~1-2.5s 后 sh 692→1100、n 20→32）**→ 触底须等 sh 增长（≤6 轮×350ms）再继续下滚，立即回顶/判败则 index>19 的项（如 D）永远找不到。
- **客户名称分页**：目标不在当前页 → 点 dropdown 内「下一页/Next Page」（locale 双语）；翻过未中回「上一页」重扫。
- 选中后**仅当面板仍可见才 Esc**（无条件 Esc 会误关 drawer）。
- 选项异步加载（n=0）时空转等待。

### 6. 16 笔原子交易（文件名序=回放序，自包含净零）

| # | 文件 | 交易 | 说明 | 净零 |
|---|------|------|------|------|
| 1 | 01-aply | 评级申请 | 空列表直接开 drawer→客户=RK001测试集团改(select:scroll)→下一步→确定→任务页 checkpoint(pcsEcd=) | +1 |
| 2 | 02-query | 列表查询 | 查询→断言首行 | 只读 |
| 3 | 03-advquery | 高级查询 | caret 展开→审批状态=待发起+评级发生类型=新增→查询 | 只读 |
| 4 | 04-view | 查看详情 | 选首行→查看详情(look 页) | 只读 |
| 5 | 05-track | 流程轨迹 | 选首行→流程轨迹→取消 | 只读 |
| 6 | 09-rerating | 评级重评(负向) | 待发起单选行→评级重评→前端静默守卫（无已通过集团单，正向不可录） | 只读 |
| 7 | 10-reset | 重置查询 | 业务编号='PJ2026'→查询→重置 | 只读 |
| 8 | 11-selectcustomer | 选择客户查询 | 放大镜→弹窗 集团名称→查询→选行→确认 | 只读 |
| 9 | 12-riskrefresh | 风险阻断刷新 | step3(NEXT×2) 刷新 | 改(被删) |
| 10 | 13-indicator | 修改指标暂存 | 资产负债率=55→暂存→系统=D | 改(被删) |
| 11 | 14-conclusion | 系统评级结论保存 | 建议等级=D(select:scroll)+理由说明→保存(结论) | 改(被删) |
| 12 | 15-evalsave | 客户综合评价保存 | 综合评价→保存 | 改(被删) |
| 13 | 17-imgview | 影像图册查看 | step2(NEXT×1) 图册查看→关档案书册 | 改(被删) |
| 14 | 19-creditobj | 一键添加征信查询对象 | step1 直接动作 | 改(被删) |
| 15 | 20-creditcust | 新增征信查询客户 | step1 新增征信查询客户→引入→客户名称=AT_正式(fill)→查询→选行→确认(四字段回填)→证件到期日=2031-07-22+授权日期=2026-10-14(**须早于回放日**)→查询事由=贷款审批+查询类型=人行数据(select:click)→确认(save) | 改(被删) |
| 16 | 23-delete | 删除记录 | 选首行(01 单)→删除→message-box 确定(双语 OK/确定)；征信客户随单级联删 | -1 |

> **净零自包含**：不依赖任何存量记录（早期「只读锚点=辰指集团 PJ20260903016005」方案在 replay-01 链漂移时被 23-delete 误删而作废）。只读 wire 一律定位**首行**（01 新建单）；23-delete 删首行收尾。未录：影像上传/删除（硬件依赖）、发起评级（审批流推进）。

### 7. 坑（grpRtg 特有）

1. **tssc 下拉三机制**（teleport 面板 + h=0 隐藏数据行直点 + 懒渲染滚底异步挂载 + 组件内双语分页）→ `select:scroll` 全覆盖；旧「视口内才点」策略在 h=0 行上死循环。
2. **列表无 handle-container**：行操作=表上工具栏按钮，`//button[normalize-space()='…']` 直取。
3. **radio label hidden**：点「所在 tr 可见」radio 之行首列 td force + 断言 checked（引擎 `RadioRowAction` 已实现）。
4. **重复守卫静默失败**：01-aply 前必须无该客户待发起单；**部分回放（如 `--only 01-aply`）后残留单会让下次全量 01 静默失败**（drawer 不关+任务页 checkpoint 挂）→ 跑全量前先查列表清残留。
5. **删除 message-box headless 英文 Cancel/OK**，双语 xpath。
6. **系统评级结论 collapse 默认展开**，勿点 header。
7. **测算节是表格非 form-item**；**选择客户入口是查询区放大镜按钮**非独立按钮。
8. **新增征信查询客户引入弹窗**：父/子弹窗同尺寸同位置（720×630，z 2003>2001）→ 按钮 xpath **按字段锚定 dialog**（父按「证件到期日」、子按「客户编号」），裸 `//div[.el-dialog]//button[确认]` 会误命中父弹窗确认。查询三条件全空 → `search()` 返回 false **零请求**（probe_27/30/42）；低代码组件 `ZJJK00109101` 方法 `[native code]` 不可读源码，须 console/performance/网络三通道交叉验证。**引擎 `fill()` 可触发查询**（probe_46；JS native setter 无效 probe_45 前）。**授权日期=今日 → save code=100**（无弹窗不关，极易误判）；=昨日 → 200 成功（probe_49/50 对照）。wire 授权日期固定 2026-10-14，回放日须晚于它。

## 模块四：cpctRtg 对公客户评级（v2：L01-L10）

> **2026-10-16 v2 重新录制**：弃用旧 20 笔 C01-C23（备份 `work/cpctRtg-v2/old-wires-20261015/`），分阶段重录；阶段一 = L01-L10（列表页 + 建单/删除）。其后 **L08（评级重评）/L09（评级申请建单）升级为任务页 4 步向导全流程（→审批中）**，L10 重设计为**自包含净零**（建单→返回→删除）。接受审批中残留 + 回放非幂等。
> **与 grpRtg（模块三）同属「评级管理」，任务页 4 步同构（bsnTp 3=集团/1=对公）** → 通用平台事实/引入弹窗/征信保存规则直接引用模块三，本节只记 cpct v2 差异与实测。完整设计见 `work/cpctRtg-v2/plan.md`。

### 1. 平台与环境（差异项）

| 项 | 值 |
|---|---|
| 模块路由 | `/#/rtgMgt/cpctRtg/cpctRtgAplyMgtPg`（评级管理 > 对公客户评级） |
| 任务页/修改页 | `.../newCpctRtg/cstmgrIttCpctRtg/FS00005854HostCstmgrIttCpctRtgAply?...`（profile urlPattern=`FS00005854HostCstmgrIttCpctRtgAply`、readySelector=`.el-form-item`；查看详情=`viewType=look`、**修改=`viewType=modify`**） |
| pageBsnInf | `bsnTp:"1"`（对公；grpRtg="3"），bsnNo DESC 新建单恒首行 |
| 回放 profile | `replay-skill/profiles/explore-cst-cpctRtg.json`（pages：评级详情查看(look)/评级修改(modify)/评级任务页/**对公客户360**(urlPattern FS00008308CstmgrExmCst360Vw, ready .el-tabs__item，M01 两级子页)；popups：评级申请/**评级重评** `.el-drawer`/选择客户·流程轨迹/**流程选人** `.el-dialog`/删除确认 `.el-message-box`；**login 凭据已补全** 701994/1/captcha 1234/法人下拉，登录态过期自动登录） |
| 回放命令 | `node replay-skill/replay.mjs partner-wire/cpctRtg --profile replay-skill/profiles/explore-cst-cpctRtg.json`（文件名序=回放序；`--only <关键字>` 单文件；`--api-log <f>` 记 save 诊断） |
| 生成器 | `work/cpctRtg-v2/gen-wire.js`（L01-L10，单文件改后重跑覆盖）+ `gen-wire-m.js`（修改页 M01-M11，per-wire 干净 seq）+ `gen-wire-m2.js`（修改页 step2 影像资料 M12-M26 全操作，ROW_ASSERT 断言步/rowOp 行 scoped 锚定/imgPrefix 公共前缀）+ `gen-wire-m3.js`（修改页 step3 风险阻断 M27 刷新，riskPrefix 公共前缀+wait:text 总校验结果断言）+ `gen-wire-m4.js`（修改向导 step4 签署信息 M28 流程提交全流程 64 节点，自包含壹品一次性单，复用 gen-wire.js 的 X/T 锚点+25 指标值） |
| 探路资产 | `work/cpctRtg/scan-lib.js`（`S.run(fn)`+`scan()`，**CommonJS require，非 ESM**）、`work/cpctRtg-v2/probe_101-194`（144-153=修改页 6 面板/154-164=征信面板/165-194=影像资料组件：178 树+上传/181 行操作 DOM 定论无 fixed-right/183-188 预览-打印-下载-移动-删除/190 目录检索/191 文件搜索/192-193 deleteBsnInf 在途单清理/194 终态/201-203=修改页 step3 风险阻断：201 结构+按钮+表+刷新 API/202 总校验结果=通过+重试≡刷新/203 总校验结果 xpath/205-207=step4 签署信息结构+流程轨迹 tsscMutilDialog+流程撤销 MB/208-210=建单全路径+流程提交前置校验(静默 no-op)+流程选人/211-213=headed 建单诊断+createRating 响应捕获(同类单守卫 BizException 实锤)) |

### 2. 与 grpRtg 的差异（v2 实测）

1. **列表行操作有 `.handle-container`**（grpRtg 用表上工具栏按钮无 handle-container）：行操作按钮锚定 `//div[contains(@class,'handle-container')]//button[normalize-space()='X']`，裸 `//button[X]` 会误命中工具栏。按钮集：评级申请/修改/删除/查看详情/流程轨迹/评级重评。
2. **评级申请 drawer 客户下拉 = `select:scroll`**（v2 与 grpRtg 同款；v1 曾用 `select:type` 已弃）：input readonly，mouse down/up 展开，本地全量 55 户全渲染可滚动，引擎 `select:scroll` 按 innerText.trim()===val 精确匹配。
3. **主表 radio 坑**：`label.el-radio` 在首列（非尾列）且 Playwright `.el-table__body-wrapper .el-radio:visible`=0（怪癖）；spec 用 `page.locator('.el-radio:visible').first().click()`；wire 走引擎 RadioRowAction（可见行→强制点首列 td→断言 checked）。
4. **选择客户弹窗确认语义**：确认 = 关弹窗 + **回填列表 disabled 字段**（客户编号/客户名称），**须再点列表「查询」才过滤**（pageBsnInf body cstNo 生效）。
5. **任务页征信节 4 按钮**：一键添加征信查询对象 / 获取最新征信报告 / 查看征信报告 / 新增征信查询客户（后 2 个 grpRtg 无，依赖后端征信报告）。**v2 L08/L09 全流程不含征信节操作**（=阶段二，未录）。
6. **SelectClickAction 精确匹配优先、子串兜底**：18 指标下拉有 AA/AAA 类子串陷阱，须精确匹配优先防误选（引擎已改，向后兼容其它模块）。

### 3. 10 笔原子交易（v2，文件名序=回放序）

| # | 文件 | 交易 | 说明 | 数据 |
|---|------|------|------|------|
| L01 | L01-query | 列表查询 | 业务编号=PJ20261015020102→查询 | 只读 |
| L02 | L02-reset | 重置查询 | 业务编号=PJ20261015020102→查询→重置 | 只读 |
| L03 | L03-advquery | 高级查询 | 展开 caret→审批状态=通过→查询 | 只读 |
| L04 | L04-pagination | 列表分页 | pager li「2」 | 只读 |
| L05 | L05-selectcustomer | 选择客户查询 | 选择客户→客户名称(弹窗)=AT_1015_A3V5→查询(弹窗)→radio(弹窗)→确认→**查询(列表)** | 只读 |
| L06 | L06-view | 查看详情 | 展开→审批状态=通过→查询→radio→查看详情→page(look) | 只读 |
| L07 | L07-track | 流程轨迹 | 展开→审批状态=通过→查询→radio→流程轨迹→关闭 | 只读 |
| L08 | L08-rerating | 评级重评**全流程→审批中** | 业务编号=通过行→查询→radio→评级重评→drawer(预填+readonly)→下一步(风险校验)→确定(建重评单)→**任务页全流程** | +1 审批中 |
| L09 | L09-apply | 评级申请建单**全流程→审批中** | 评级申请(首行)→drawer→**select:scroll 客户**→下一步(风险校验)→确定创建→**任务页全流程** | +1 审批中 |
| L10 | L10-delete | 建单删除**自包含净零** | 评级申请→drawer→select:scroll 客户=壹品视觉传媒工作室→下一步→确定创建→任务页→**返回**→选择客户(壹品)→待发起→查询→radio→删除→MB OK | 净零 |

> **编排**：L01-L07 只读可任意序；**L08/L09 各自独立**（各建一张审批中单，非幂等）；L10 自包含（建单即删，不依赖 L08/L09）。**未录（阶段二）**：任务页征信节操作（一键添加征信查询对象/新增·删除征信查询客户/获取·查看征信报告）、影像图册、修改。（~~风险阻断刷新~~ 已录 **M27**，走修改向导 step3，2026-10-18；~~签署信息 tab 流程提交~~ 已录 **M28**，走修改向导 step4，2026-10-18。）

### 3b. 修改页 6 折叠面板代表操作（M01-M06，2026-10-16）

> **纠正**：6 面板交易**不走「查看详情」(viewType=look 只读)**，改走**「修改」(viewType=modify 可编辑)**进入，每笔执行该面板下的**代表操作**。原 V01-V06（查看详情方案）作废删除。

修改页 = 同路由 `FS00005854HostCstmgrIttCpctRtgAply` 但 `viewType=modify`（**可编辑，无 tabs、无 4 步向导，单页 6 `el-collapse-item` 默认全展开**）。**确定性定位**：列表 `业务编号` input → 填 **PJ20261016020105**（基准**待发起**单，AT_正式_20261015095323 / 261015175334494281）→查询→唯一 1 行→radio→**修改**。

| # | 文件 | 面板 | 代表操作 | 断言（wait:text，scoped 到面板） | 步数 |
|---|------|------|------|------|------|
| M01 | M01-basinfo-custdetail | 评级基本情况 | **客户详情**→客户 360 页（两级子页） | 360 body 含 客户名称=AT_正式_20261015095323 + 客户编号=261015175334494281 | 10 |
| M02 | M02-credit-add | 征信信息 | **一键添加征信查询对象**（幂等） | 征信面板含 征信查询对象/借款企业/AT_正式_20261015095323/法定代表人/赵磊杰 | 12 |
| M03 | M03-calc-measure | 评级等级测算 | **测算**（确定性回填） | 结论面板 系统评级等级=C + 此次评级建议等级=C | 9 |
| M04 | M04-concl-save | 系统评级结论 | 填理由说明→**保存**(结论) | 理由说明字段**留存**=修改页结论保存校验 | 9 |
| M05 | M05-history-view | 历年评级情况 | **只读**（待发起 0 行，无操作按钮） | 历年面板含表头 模型名称/申请日期/评级状态 | 9 |
| M06 | M06-cprsv-save | 客户综合评价 | 填综合评价→**保存**(评价) | 综合评价字段**留存**=修改页评价保存校验 | 9 |

- **操作行为（关键）**：
  - **测算**（API `saveScor`）确定性回填 此次评级建议等级=C + 理由说明=采用系统评级结论（可重跑幂等）。
  - **一键添加征信查询对象**（`saveAndSelect`+`findCreditObj`）**幂等**：征信表已 2 行，点前后仍 2 行。
  - **结论/评价 保存**（`saveOrUpdateCnclsnInf`/`saveOrUpdateCprsvAssInf`）**静默无通知**（8s 轮询无 `.el-notification`/`.el-message`）→ 断言改用「**填入值字段留存**」(wait:text)，probe_152 确认保存后字段值留存。
  - **客户详情**=**跨模块新导航**到客户 360 视图页 `FS00008308CstmgrExmCst360Vw`（viewType=look&disabled，**非弹窗**）；360 页**无「返回」按钮**（仅 查询/重置），浏览器 goBack 可回修改页，但交易在 360 页断言后结束**无需返回**。
- **xpath 锚定**：面板 `mPanel(t)=//div[...el-collapse-item][.//div[...el-collapse-item__header][contains(.,'标题')]]`；字段 `${面板}//div[...el-form-item][.//label[contains(.,'标签')]]//input|textarea`；**按钮 `${面板}//button[normalize-space()='按钮']`（scoped 避免顶栏重名按钮误点：客户详情/一键添加/测算/保存 顶栏与面板各一）**。
- **profile**：复用「评级修改」(match 评级修改, urlPattern viewType=modify, readySelector .el-form-item)；**新增「对公客户360」**(match 对公客户360, urlPattern FS00008308CstmgrExmCst360Vw, readySelector .el-tabs__item) 供 M01 两级子页。页面名避用「评级详情」子串（防与查看页条目 includes 冲突）。
- **生成器**：`work/cpctRtg-v2/gen-wire-m.js`（per-wire 干净 seq；不触碰 gen-wire.js 的 L01-L10）。
- **数据影响**：测算/一键添加幂等；结论/评价保存覆盖写（可重跑）。**无建单/删除，净零**，可重复回放。
- 6/6 PASS ×2（headless `--only M`，0 警告，82s/78s）：断言全命中具体值（AT_正式_20261015095323/261015175334494281/赵磊杰/C），wait:text 快命中 29-51ms。

### 3c. 征信信息面板全 6 操作（M07-M11，2026-10-16）

> 补充征信信息折叠面板**所有**操作为交易。面板 6 按钮=一键添加征信查询对象(M02 已含)/上传授权书/获取最新征信报告/查看征信报告/新增征信查询客户/删除 → 新增 M07-M11。基准单同 PJ20261016020105。

| # | 文件 | 操作 | 断言 | 步数 |
|---|------|------|------|------|
| M07 | M07-credit-upload | **上传授权书**（本环境 NO-OP） | 借款企业行保留 + 上传授权书按钮在 | 10 |
| M08 | M08-credit-fetchreport | **获取最新征信报告**（NO-OP） | 借款企业行保留 + 获取按钮在 | 10 |
| M09 | M09-credit-viewreport | **查看征信报告**（NO-OP） | 借款企业行保留 + 查看按钮在 | 10 |
| M10 | M10-credit-add | **新增征信查询客户**：新增→引入→对公客户→客户名称=AT→查询→radio(AT_SCAN 行)→确认→证件到期日=2030-01-01→授权日期=2026-01-01→查询事由=其他原因(select:click)→查询类型=人行数据(select:click)→确认 | 征信面板含 AT_SCAN_对公测试公司1015（行已加，征信查询对象=其他） | 22 |
| M11 | M11-credit-delete | **删除**：radio(AT_SCAN 行)→删除→MB 确认[OK/确定] | AT_SCAN 行隐藏(wait:hidden) + 借款企业行保留 | 12 |

- **3 NO-OP（M07/M08/M09，probe_155/156/157）**：上传授权书/获取最新征信报告/查看征信报告，选行 radio 有效(checked=true)+按钮 enabled(dis:false)，但点击后**零网络请求/无通知/无弹窗/无 fileChooser/无 file input**→后端征信报告/文件服务依赖未满足。只能录「选行+点击+断言状态保持」弱烟测（断言借款企业行 CUST_NAME 仍在 + 按钮仍在，确认未崩）。
- **新增征信查询客户（M10，引入弹窗）**：
  - Dialog1(新增) 字段=客户名称/客户类型/证件类型/证件号码/证件到期日(date)/授权日期(date)/查询事由(select)/查询类型(select)，按钮[引入,取消,确认]；点引入→Dialog2(magnifier，同 L05 客户选择) search=客户编号/客户名称/证件类型/证件号码，表 9 列，按钮[对私客户,对公客户,查询,重置,取消,确认]。
  - **引入回填**自动填 客户名称/客户类型/证件类型/证件号码（4 项），需手填 证件到期日/授权日期/查询事由/查询类型。
  - **⚠️嵌套弹窗 scoped（probe_164 关键）**：新增 dialog 与 magnifier **同时 open**，均为 body 下 `.el-dialog` 且 **siblings（互非后代，parentIsDialog=false）**。按各自**独有按钮**锚定互不串扰：新增 dialog=`//div[contains(@class,'el-dialog')][.//button[normalize-space()='引入']]`；magnifier=`//div[contains(@class,'el-dialog')][.//button[normalize-space()='对公客户']]`。确认(引入)后 magnifier 关、新增 dialog 仍在→后续填字段步仍 scoped 到新增 dialog。
  - **radio 按行文本选特定行**：magnifier 搜「AT」返 4 对公行（AT_1015_A3D/HOST AT_正式_20261015095323/AT_SCAN_对公测试公司1015/AT_潜客_20260923012641），须选 **AT_SCAN**（避 HOST）→xpath `${magnifier}//tr[.//td[contains(.,'AT_SCAN_对公测试公司1015')]]//label[el-radio]`（引擎 RadioRowAction 取首个可见行 radio→点首列 td→断言 checked，行文本 scoped 即定位该行）。
  - **save payload**（`ICstCreditInvApi/save`）：cstNm/cstCgy=60/crdtTp=20111/crdtNo/crdtExdt(证件到期日)/crAhnTm(授权日期)/crEnqrRsnTp=04(其他原因)/dataEnqrmod=2/cstNo/ftmEnqrCodt(=授权日期+30d 前端自动算)/bsnNo/crEnqrObjTp=8；成功→行 征信查询对象=其他。
- **删除（M11）**：radio 按行文本选 AT_SCAN→删除→`.el-message-box`「您确定删除这条记录吗?」按钮 [Cancel/OK](headless=en) 或 [取消/确定](headed=zh)→`deleteCreditInv`+`findCreditObj`→行消失。MB 确认 xpath 双语：`//div[contains(@class,'el-message-box')]//button[normalize-space()='OK' or normalize-space()='确定']`。
- **⚠️时钟偏移（重大，probe_161）**：save 校验「授权日 crAhnTm ≤ 系统当前日期」。**服务器系统日=2026-10-14，客户端日=2026-10-16（客户端快 2 天）**。故 2026-10-15 被拒（"授权日大于系统当前日期"）、2026-10-14 过、**2026-01-01（旧日期）过（无下限拒绝，ftmEnqrCtofDayLtCurTmInd=1 仅指示非阻断）**。→ `{{TODAY/YESTERDAY/TOMORROW}}` 全部太新会失败；**授权日期用固定过去日 2026-01-01、证件到期日用固定未来日 2030-01-01**（引擎 StepNode 仅 {{TODAY/YESTERDAY/TOMORROW}} 本地日期 token，无 +365/偏移）。
- **引擎事实（本次确认）**：`popup` 节点=声明弹窗（PopupExecutor 按 node.name.includes(profile.popups[].match) 取 selector 等可见；新增征信查询客户/客户选择 均 selector=.el-dialog 通用→magnifier 另加 `wait:text`(dlgMag,'对公客户') 精确等渲染）；`select:click`（SelectClickAction）=点开 el-select→`.el-select-dropdown:visible` last→选项精确匹配优先→DOM click，dialog 内可用；`wait:hidden`（WaitHiddenAction）**尽力等待不抛错**（超时静默放行）→仅确认用非严格断言，M11 严格性靠 radio(AT_SCAN 必存在)+MB 确认。
- **净零/依赖**：M10 引入 AT_SCAN 加第 3 行→M11 删该行回 2 行。**M10→M11 顺序回放净零可重跑**；M11 依赖 M10（AT_SCAN 须存在）；M10 单独非幂等（AT_SCAN 已存则重复，同 L09/L10 局限）。M07-M09 无数据变更。
- 生成器：`work/cpctRtg-v2/gen-wire-m.js`（新增 `popup` 节点构造 + `creditRowRadioByName`/`dlgNew`/`dlgMag`/`dIn`/`dSel`/`dBtn`/`MB_OK` 锚定 + M07-M11 build/wireDefs；ACTION_CN 补 select:click/wait:hidden）。
- **回放验证**：全 M 系列 **11/11 PASS**（headless `--only M`，0 警告 0 失败，164s）；M10(22 步 26s)/M11(12 步 16s)；M11 wait:hidden 26ms 确认 AT_SCAN 消失；最终净零 probe_162 征信回 2 行（无 AT_SCAN）。

### 3d. 影像资料组件全操作（M12-M26，2026-10-17）

> 修改页 4 步向导 **step2 影像资料**（左 el-tree 目录树 + 右文件列表 + toolbar）的**每个操作**都录成交易：toolbar 12 操作（上传/预览/打印/下载/批量下载/图册查看/目录检索/文件搜索/装订成册/电子验印/扫描仪/高拍仪）+ 行内 移动/删除。探路 probe_165-194，生成器 `work/cpctRtg-v2/gen-wire-m2.js`。

| # | 文件 | 操作 | 断言 |
|---|------|------|------|
| M12 | M12-img-upload | 上传(file:choose) | wait:text 影像行出现 |
| M13 | M13-img-preview | 行预览→`click:soft` 关 viewer | viewer 软关兜底 |
| M14 | M14-img-print | 行打印 | — |
| M15 | M15-img-download | 行下载 | — |
| M16 | M16-img-batchdownload | 表头全选→批量下载 | — |
| M17 | M17-img-album | 图册查看→关档案书册 | — |
| M18 | M18-img-catalogsearch | 目录检索=数字信贷→清空 | — |
| M19 | M19-img-filesearch | 文件搜索=AT_test→搜索→清空 | 断言1行(ROW_ASSERT) |
| M20 | M20-img-bindbook | 装订成册 | — |
| M21 | M21-img-sealcheck | 电子验印(NO-OP) | 断言影像行保留 |
| M22 | M22-img-scanner | 扫描仪(NO-OP) | 断言影像行保留 |
| M23 | M23-img-webcam | 高拍仪(NO-OP) | 断言影像行保留 |
| M24 | M24-img-move | 行移动→「移动目录」dialog→选叶子(贷后管理/检查报告文档)→确认选择 | 重选影像资料 断言0行 |
| M25 | M25-img-delete | **自包含**：上传→行删除→MB 确认 | 断言0行 |
| M26 | M26-img-cleanup | 清理 M24 移动文件（选检查报告文档→删除→MB 确认） | 断言0行 |

- **组件入口**：修改页 step1 点「下一步」→step2；左树默认 16 顶级全折叠，**先点「数字信贷」展开图标**再选「影像资料」(leaf, ctlgNo=`ticpAplFile`) 才触发 `pageFileInf`。**非叶子顶级节点点击不重查**（仅 is-current+展开）；无 ctlgNo 默认列表=全部文件且行操作仅 预览/下载/打印（无 删除/移动）→**移动/删除只出现在叶子目录列表**。
- **⚠️行操作 DOM（probe_181）**：影像文件表**无 `.el-table__fixed-right`**（与列表页/征信表不同！旧「fixed-right」记录有误），行操作 span 仅在主表 body 且每 op 有内外 2 层 span 副本→锚定**按行文件名 scoped**：`//div[el-table__body-wrapper]//tr[.//td[contains(.,'AT_test_image_upload')]]//span[normalize-space()='预览']`（引擎 byXpathVisible 可见优先，取外层 40×32 span，点击穿透内层 OK）。
- **预览**：`preview` 200→`.el-image-viewer` overlay（Element UI el-image→image-viewer）；**新文件须服务端 ~30s 备快照才开 viewer**（M12 上传→M13 紧接着预览的跨 wire 时序足够）；**已被打印过的文件 viewer 不再开**（服务端状态，单 wire 内不复现）→关 viewer 用 `click:soft`（4s 窗口无则静默跳过，viewer 未现时 no-op 放行）。
- **打印**：仅 `preview` 200，**无 viewer/无 window.print(headless override 计数=0)/无 dialog/tab**。**预览/打印 后行操作变隐藏**（组件状态 offsetParent=null）→wire 内预览/打印之后不再用行操作；跨 wire 无影响（每笔独立重进页面）。**⚠️headed 打印冻结（2026-10-17 实锤）**：headed 下行打印会触发**原生打印对话框**（调用发生在 iframe/新窗口，主窗口运行时桩抓不到）→renderer 冻结，点击卡 `performing click action` 30s 超时。修复=引擎 `BrowserSession.start()` 加 `context.addInitScript` 全局 stub `window.print`+`document.execCommand('Print')`（app JS 前、覆盖全部文档；probe_200 验证 92ms 点中）。headless 行为不变。
- **删除**：行删除→`.el-message-box`「是否删除该档案」→**`deleteFileInf` body=`{"id":"<row id>"}`**（行 id 非 fileNo，fileNo 契约 500）→列表自动重查 -1。
- **移动**：「移动目录」dialog 内树同主树，选**叶子**+「确认选择」→`moveCtlg` 200。
- **图册查看**=「档案书册」dialog（`el-dialog__headerbtn` 关）；**装订成册**=`snapshotCreate` 200；**目录检索**=左 `leftContent` **客户端过滤**（无 API）；**文件搜索**=右 `placeholder=请输入文件名` input+**第 2 个**「搜索」按钮（`(//button[normalize-space()='搜索'])[2]`）→`pageFileInf` fileNm；**电子验印/扫描仪/高拍仪**=NO-OP（零网络）→「点击+断言行保留」弱烟测。
- **公共前缀**（每笔 10 步）：业务编号=PJ20261016020105→查询→radio→修改→page 评级修改→下一步→**page「影像资料步检查点」**→展开 数字信贷→选 影像资料。⚠️**page 检查点名不可含 profile pages 关键词**（如「评级修改」）：PageExecutor resolveEntry 按 name.includes(kw) 命中后会等该页 readySelector（评级修改=`.el-form-item`），而 step2 表单已隐藏→15s 超时必失败；未注册名=仅 settle(800)+截图，安全。
- **净零依赖链（自然序）**：M12 +1→M13-M23 消费→M24 移到检查报告文档→M25 自包含 0→M26 -1，全链 0 残留。
- **回放验证（2026-10-17）**：`--only img` **15/15 PASS**（334s）；全量 `partner-wire/cpctRtg` **36/36 PASS**（773s，0 警告）；影像净零=pageFileInf 无过滤 total=0（含移动目录）。**headed 全量（--headed --step-timeout 120000）**：r1 33/36→三修复→r2 33/36（L08/L09/M14 过，M19/M24/M25 败于孤儿影像记录）→清孤儿后 rerun5（M12/M19/M24/M25/M26）**5/5**→r3 34/36（仅 L08/L09 被 r2 残留单阻塞，其余 34 全过）→清残留后 rerunL 补验 L08/L09。
- **⚠️孤儿影像记录坑**：被 kill 的探针上传后清理步骤挂死未删→残留记录污染后续全量（M19 期望 1 行实际 2；M24/M25 期望 0 行实际 1）。清理=`work/cpctRtg-v2/probe_182_cleanup.js`（pageFileInf 列出→`deleteFileInf {id}`→复验 0）。**探针清理必须 try/finally 或 API 直删**（UI 点击可被冻结页卡死）。

### 3e. 风险阻断 step3（M27，2026-10-18）

> 修改页 4 步向导 **step3 风险阻断** tab（基本信息→影像资料→**风险阻断**→签署信息），探路 probe_201-203，生成器 `work/cpctRtg-v2/gen-wire-m3.js`。

- **结构**：字段 `总校验结果`（**readonly input**，值=通过，外壳 tssc-multi-select）+ 规则表 8 列（规则大类/规则名称/预警规则编号/规则校验结果/风控措施/风险解除状态/规则提示信息/相关制度要求，基准单 0 行）；按钮 `[重试, 刷新, 上一步, 下一步, 返回]`。
- **刷新 ≡ 重试**：均触发 `POST .../ipcIntlgCtrl/scmExec` 200（风险复检，短暂 el-loading-mask 后撤销）→**只录刷新**（模块惯例=grpRtg G09/旧 12-riskrefresh；重试同 API 冗余不重复录）。
- **总校验结果 xpath**：`//div[contains(@class,'el-form-item')][.//label[normalize-space()='总校验结果']]//input`（wait:text 断言「通过」）。
- **wire M27-riskrefresh（13 步，平铺 pid=1）**：对公客户评级(page)→业务编号=PJ20261016020105→查询→radio→修改→评级修改(page)→下一步(影像资料步)→影像资料步检查点(page)→下一步(风险阻断步)→风险阻断步检查点(page)→断言 总校验结果=通过(wait:text)→**刷新(click)**→断言 复检后 总校验结果=通过(wait:text)。
- **净零**：刷新=只读复检，不改单据状态/影像/流程；基准单 PJ20261016020105（st=1）回放前后不变，可重复。
- **回放验证（2026-10-18）**：headless `--only riskrefresh` **1/1 PASS**（19.2s）；headed 同命令 **1/1 PASS**（19.3s）。

### 3f. 签署信息 step4（M28 流程提交，2026-10-18）

> 修改页 4 步向导 **step4 签署信息** tab（基本信息→影像资料→风险阻断→**签署信息**），探路 probe_205-213，生成器 `work/cpctRtg-v2/gen-wire-m4.js`。

- **结构**：字段 `流程操作`（el-select，**选项仅 [下一步]**）+ `意见详情`（textarea 0/500）；**审批历史表** 8 列（节点名称/处理时间/处理人/处理机构/处理状态/审批耗时/操作/审批意见，基准单 1 行：信贷调查/黄某某/待处理）；按钮 `[上一页, 返回, 流程提交, 流程撤销, 流程轨迹]`。
- **step4 流程轨迹 ≠ L07**：step4 入口开 `#tsscMutilDialog`（drag-drop 多 dialog，API=`workflow/process/diagram/getDiagram`），关闭=`.el-dialog__headerbtn`(X)；L07（列表行入口）是常规 el-dialog「流程轨迹」+`tcp/workflow/track`+[取消]。
- **流程撤销（st=1）**：点→`.el-message-box`「请确认是否撤销」[Cancel,OK]；取消=净零无 API（OK 未在基准单确认）。
- **流程提交前置校验（关键）**：无 系统评级结论+客户综合评价 时（新单未测算）→**静默 no-op**（仅 `getCnclsnInf`+`getCprsvAssInf` 预读，无 dialog/notify/submitProcess，bsnSt 不变，probe_209 实锤）。前置齐备（25 指标→暂存→测算回填 D→结论保存→评价保存）后 → `queryNextTaskList`→`scmExec`→`workflowTree`→**弹 流程选人**（下一节点审批人，与 L08/L09 任务页入口同款）→选人(张某某 135292)→done → **审批中 st=2**（probe_210 实锤）。
- **wire M28-flowsubmit（64 节点，平铺 pid=1）**：对公客户评级(page)→评级申请→评级申请drawer(popup)→客户名称=壹品视觉传媒工作室(select:scroll)→下一步(风险校验)→确定创建→评级任务页(page)→返回→选择客户→客户名称(弹窗)→查询(弹窗)→选中客户行(弹窗)→确认(弹窗)→展开高级查询→审批状态=待发起(select:click)→查询(列表)→选中记录行(radio)→修改→评级修改(page)→25 指标(7 input+18 select:click，值与 gen-wire.js/L09 逐字一致)→暂存→测算→等待系统评级等级回填(wait:text 非空)→理由说明→保存(结论)→综合评价→保存(评价)→下一步(step1→2)→影像资料步(page)→下一步(step2→3)→风险阻断步(page)→下一步(step3→4)→签署信息步(page)→**流程操作=下一步**(select:click)→**意见详情**(input)→**流程提交**(click)→**流程选人**(popup)→选人trigger→选审批人(张某某)→**done(确定选人)**。
- **一次性客户**：壹品视觉传媒工作室（cstNo=26082800042380410，L10 沿用）。**残留口径**：每回放留 1 张壹品 审批中 单（同 L08/L09），**复跑前必须 `probe_195_preclean.js`**（已扩展含 壹品 cstNo，AT_SCAN/KB/壹品 三客户 st∈{1,2} 清理）。
- **⚠️同类单守卫（残留守卫根因）**：`createRating` 对已有 bsnSt∈{1,2} 在途流程的客户 → `code=100 BizException「该客户已发起评级流程，请等待流程完成后再进行评级」`+「异常信息」alert（全局/系统流水号+异常栈）。→ M28 残留（壹品 st=2）会阻塞后续 **L10 建单**与 **M28 复跑**；probe_195 清理后恢复。首轮 headed 2 连败根因=前次 headless 残留 st=2 触发该守卫（非 UI/导航问题）。
- **回放验证（2026-10-18）**：headless `--only flowsubmit` **1/1 PASS**（80.5s/64 步，PJ20261018020135 st=2）；headed `--only flowsubmit --headed --step-timeout 120000` **1/1 PASS**（78.9s，PJ20261018020136 st=2）。两次残留均已 deleteBsnInf 清理（壹品在库 0）。

### 4. 任务页 4 步向导全流程（L08/L09 核心）

1. **建单**：L09=drawer `select:scroll` 客户→下一步(scmExec 风险校验，总校验结果=通过)→确定(createRating)；L08=重评 drawer（客户**预填+readonly+disabled，无需 select**）→下一步→确定(建重评单)。
2. **25 指标**（评级等级测算 collapse，`tbody tr` 锚指标名 cell）：
   - 7 数字 input：资产负债率 55 / 自主收入占比 30 / 或有负债率 10 / 经费自给率 80 / 收支盈余率 20 / 净资产增长率 15 / 总收入增长率 18
   - 18 select（select:click 精确匹配优先防子串误选）：业务往来及使用/资金归社行情况/发展前景/到期信用偿还记录/政府支持力度/利息偿还记录/领导者素质信誉和还款意愿/领导者素质文化水平或技术职称/领导者素质经营管理能力/领导者素质从事本行业年限/贷款资产形态/管理者素质财务制度/管理者素质商誉/管理者素质管理制度/管理者素质产权组织结构/开户情况/其他信用记录/税费缴纳情况
3. **暂存→测算**：测算确定性（填齐→暂存→测算→**系统评级等级=D/评分=50.4** 只读自动回填）；理由说明空需填。
4. **结论/评价**：保存(系统评级结论)→综合评价→保存(客户综合评价)。
5. **step4 流程**：下一步×3→流程操作=下一步(select)→意见详情→流程提交→**流程选人弹窗**→选人 trigger(弹窗唯一可见 input)→树选 张某某(135292)→**done**→submitProcess→**审批中**。

### 5. 引擎/profile 增强（v2 新增）

- **新引擎动作 `wait:text`**（`replay-skill/src/engine/actions/WaitTextAction.js` + `ActionFactory.js` 注册）：轮询 xpath 所有实例→inputValue()/innerText()→含 node.value（**空 value=非空即过**）→400ms 间隔→ctx.stepTimeout 超时抛错。用于等测算后系统评级等级回填（防「结论保存在测算完成前=静默 no-op」竞态）。
- **profile popups 补**：`{match:["评级重评"],selector:".el-drawer"}`、`{match:["流程选人"],selector:".el-dialog"}`。
- **profile login 补全**：username=701994/password=1/captcha 1234/法人下拉（原缺凭据，登录态过期自动登录会 crash）。
- **2026-10-17 headed 引擎增强**：① `BrowserSession.start()` 加 `context.addInitScript` 全局 stub `window.print`+`document.execCommand('Print')`（headed 打印对话框冻结 renderer 的根治，见 M14 打印坑）；② `PageHelpers.byXpathVisible` 把 stepTimeout 透传 `waitForNoLoadingMask`（原默认 10s，慢服务端下表级 el-loading-mask 未撤会拦截点击）；③ gen-wire-m2.js 行操作 wire（M13-M16/M24）前置 `wait:text` 等影像行加载（防御性，实测 step2 自动加载 46ms 即过）。

### 6. 回放史

- 2026-10-16 阶段一：L01-L10 **10/10 PASS**（headless，0 警告，链式 L09→L10 净零）。
- 2026-10-16 午后**全流程升级**：**L08（51 步 60s）PASS**→PJ20261016020114（AT_SCAN_对公测试公司1015）**审批中/重新评级/D/测算次数 1**；**L09（49 步 61s）PASS**→PJ20261016020113（KB测客户-V21J-0900）**审批中/新增/D/测算次数 1**；**L10（20 步 32s）PASS**→建单后删除净零。L01-L07 无回归（7/7 PASS）。
- 首跑 L09 失败于流程选人 done（误判 primary）→ 改双语文本 xpath 后通过；失败残留的待发起单（PJ20261016020112）重跑前 probe_140 删除净零。
- ~~2026-10-16 查看页 6 面板 V01-V06 6/6 PASS~~（**作废**：用户纠正入口应为「修改」非「查看详情」，已删除）。
- 2026-10-16 修改页 6 面板代表操作：**M01-M06 6/6 PASS ×2**（headless `--only M`，0 警告 0 失败，82s/78s；断言全命中具体数据值 AT_正式_20261015095323/赵磊杰/C；净零可重跑）。
- 2026-10-16 征信信息面板全 6 操作：**全 M 系列 11/11 PASS**（headless `--only M`，0 警告 0 失败，164s；M07-M09 NO-OP 烟测、M10 新增引入 AT_SCAN、M11 删除；M10→M11 净零回 2 行）。
- 2026-10-17 影像资料组件全操作：**M12-M26 15/15 PASS**（headless `--only img`，334s）→**全量 36/36 PASS**（773s，0 警告）；影像净零 0 文件（含移动目录）。
- 2026-10-17 晚 **headed 全量回放**（`--headed --step-timeout 120000`，连字符 flag，camelCase 被忽略）：r1 33/36（L08/L09=zh「确 定」两字按钮含空格致 done 步未点中→卡死留 st=1 残留；M14=打印对话框冻结）→修复（gen-wire pickDone 改 `translate(normalize-space(.),' ','')` + 引擎 print 桩 + probe_195 双状态清理）→r2 33/36（L08/L09/M14 全过；M19/M24/M25 败于孤儿影像记录）→probe_182 清孤儿→**rerun5 5/5 PASS**→r3 34/36（仅 L08/L09 被 r2 残留单阻塞，其余 34 全过）→probe_195 清残留→rerunL 补验。**三修复后全 36 交易均已在 headed 下 PASS**。
- 2026-10-18 修改页 step3 风险阻断：**M27-riskrefresh 1/1 PASS ×2**（headless + headed `--only riskrefresh`，19s；13 步；净零=刷新只读复检，基准单 st=1 不变）。
- 2026-10-18 修改向导 step4 签署信息：**M28-flowsubmit 1/1 PASS ×2**（headless 80.5s + headed 78.9s，`--only flowsubmit`；64 节点；自包含壹品一次性单 建单→step1 指标/测算/结论/评价→step4 流程提交→选人→审批中 st=2）。**⚠️残留**：每回放留 1 张壹品 审批中 单（同 L08/L09 口径），复跑前必须 probe_195_preclean.js（已含壹品）。首轮 headed 2 连败=前次 headless 残留 st=2 触发同类单守卫（createRating BizException「该客户已发起评级流程」），清残留后一次通过。目录现 **38 笔**。
- 2026-10-18 **全量 headless 38/38 PASS**（0 警告，919s，首次含 M27+M28 的全量回归）：前置 probe_195 清残留（3 客户在途 0）→全量→后置 probe_195 清 L08/L09/M28 三张审批中残留单（PJ20261018020137/38/40）→终态 3 客户在途 0、基准单完好。M28 自然序居末（L10 先建删壹品净零→M28 再建壹品），全量无相互干扰，**38 笔全量复跑安全实锤**。
- **⚠️zh locale 两字按钮空格**：headed=zh 时 Element UI 在两汉字间插空格（「确 定」「取 消」）→按钮文本 xpath 须 `translate(normalize-space(.),' ','')`（gen-wire.js pickDone 已修）；headless=en 无此坑，但 wire 恒中文锚定故统一加 translate。
- **状态残留与清理**：L08/L09 各留一张审批中单，**UI 不可删**（「该审批状态数据，不可删除」）但 **API 可软删**：`POST /prod-api/tansun-tcp-app-pc/tansun-tcp-rtg/IRtgAplyBsnInfApi/deleteBsnInf` body=`{"id":"<pageBsnInf 行 id>"}`→200。复跑全量前先清宿主客户未结单：L08 宿主 AT_SCAN_对公测试公司1015(261015110003594239)、L09/L10/M28 客户 KB测客户-V21J-0900(260927090722408137)、**M28/L10 客户 壹品视觉传媒工作室(26082800042380410)**。**⚠️阻塞条件=bsnSt∈{1 待发起, 2 在途}（2026-10-17 修正）**：中断跑残留的 st=1 待发起单同样阻塞（旧"仅 st=2"判断曾致清理误报"无在途单"）；清理脚本 `probe_195_preclean.js` 已改双状态过滤（2026-10-18 扩为三客户：AT_SCAN/KB/壹品）。基准单 PJ20261016020105（st=1，客户 261015175334494281）不在清理客户内，天然安全。不清则 L08 重评 drawer 不弹/L09 确定创建后不跳任务页（后端静默拒绝）。**⚠️同类单守卫（2026-10-18 实锤，probe_213）**：`createRating` 对已有 bsnSt∈{1,2} 在途流程的客户 → `code=100 BizException「该客户已发起评级流程，请等待流程完成后再进行评级」`+「异常信息」alert（全局/系统流水号+异常栈，`RtgAplyBsnInfServiceImpl.isRating`）→ 阻塞同客户 L09/L10/M28 建单。

### 7. 关键坑（v2 全流程）

- **流程选人 done 按钮非 primary**：footer 的 cancel/done 均为 **default 普通按钮**（非 `el-button--primary`），class 定位匹配不到，须**双语文本 xpath**：`//button[normalize-space(.)='done' or normalize-space(.)='确定' or normalize-space(.)='OK' or normalize-space(.)='完成']`（headless=en done/cancel、正文中文）。Search 按钮才是 primary 但文案不同不会误匹配。
- **流程选人树**：trigger=弹窗内唯一可见 `input.el-input__inner`；click 后树 popover 出现，点含「张某某」的 `el-tree-node__content`→trigger 回填「客户经理-张某某(135292)」；审批人固定张某某(135292)。
- **非幂等+清理法**：审批中单 UI 不可删（「该审批状态数据，不可删除」）→但 `deleteBsnInf {"id":行id}` API 软删成功（2026-10-17 验证）→L08/L09 复跑前先 API 清宿主客户在途单（见回放史），不再须换客户。
- **wait:text 快命中(46ms)**：系统评级等级测算后空→非空(D)很快，wait:text 正确捕获；结论保存在测算之后，无竞态。
- **列表查询表单**：业务编号(input 启用)/客户编号(disabled)/客户名称(disabled)；API bsnNo/cstNo 真过滤、cstNm 忽略。
- **共享环境并发建单**：定位全部走「客户/编号过滤」而非裸首行。

## 模块五：cpctMgt 对公客户管理（C1-C19 已交付，C20 待录）

> 客户信息维护/对公客户管理。C1-C10=列表页(8 查询框查询/高级查询/重置)+新增担保公司(C4)+新增正式客户(C6)+修改(C7)+查看(C8)+法院信息(C9)+影像资料(C10)；C11-C15=股东表 5 笔；C16-C19=关联人表 4 笔。工作目录 `work/a02-corp/`（plan.md=总清单），wire `partner-wire/corp/`，profile `replay-skill/profiles/tansun-credit-corp.json`，spec `tests/corp/`。

### 1. 平台与环境

- 同平台同登录（profile login：701994/1/captcha 1234）；spec 与回放同视口 1440×900（openList 里 setViewportSize，否则 Desktop Chrome 1280x720 下 rect 全偏）。
- 列表页 `#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg`；修改场景页 URL 含 `crtCpctInf`（正式客户 cstSt=6 直接进；预信贷 cstSt=2 须先【客户转正】，视图切换不持久 URL FcnScnEcd FS00005518→FS00004007）。
- 回放前必查 auth.json 年龄（~50min 有效），过期 `node work/a02-corp/login_direct.js` 刷新（direct nav 到列表页存 storageState）。

### 2. 场景页子表结构（probe45/46/48/50 实证）

- 「股东及关联人信息」组件下 4 子表（股东信息/关联人信息/与其他客户关联信息/受益人信息），各带工具条[新增,修改,查看,删除]（股东组另有【获取股东信息】）。
- **按钮组按 title 锚定**（4 组同构，勿用 nth）：`TITLE(t)=//*[contains(@class,'title') and normalize-space(.)='t']`；`GRP(t)=TITLE(t)/following::div[contains(@class,'el-button-group') and contains(@class,'handle-container')][1]`；`GRP_B(t,b)=GRP(t)//button[normalize-space()='b']`（probe58：grp 恒 1 命中、4 按钮各 1）。股东组另有唯一锚=含【获取股东信息】的 `.el-button-group.handle-container`（场景页 8 个「新增」按钮跨多子表，form 级 xpath 不能消歧）。
- dialog=预渲染实例，隐藏=wrapper display:none；可见锚点=`el-dialog__wrapper 无 none + 精确 ' el-dialog ' class token`（开 1 关 0）。
- dialog 内 select 字段 `//div[contains(@class,'el-select')]` 3 命中（嵌套 div）取 .first()（C7/C11 已回放验证）。
- 行 radio：主表 radio 列 is-hidden，固定层副本承载真实点击→引擎 RadioRowAction（td.first force + isChecked）；列表行选择按**客户编号**锚定（客户名称查询模糊匹配+空占位行恒 1 数据行）。
- 日期 picker fill 后面板不关会拦【确定】→ 插「关日期面板」click 步（**须点 label**，点 form-item/input 不关）。
- 删除确认=`.el-message-box`（非 .el-dialog；popup 节点关键字无匹配→引擎 fallback `.el-dialog, .el-message-box`）。

### 3. 交付状态

| 批次 | 交易 | wire（gen 脚本） | 回放 |
|---|---|---|---|
| C1-C10 | 列表 8 查询框查询/高级查询/重置 + 新增担保公司/正式客户(暂存) + 修改 + 查看 + 法院信息 + 影像资料 | gen-wire.js + gen-wire-c12.js（filllog 流程） | PASS（详见 plan.md） |
| C11-C15 | 股东表 新增/修改/查看/删除/获取股东信息 | gen-wire-p10.js（28/14/15/28/11 步） | 5/5 PASS×2 |
| C16-C19 | 关联人表 新增/修改/查看/删除 | gen-wire-p11.js（37/15/15/37 步） | 4/4 PASS×3（headless×2+headed） |

- **C11-C15 事实**：save=`custCorporatRelatedParty/save`（viewType=add；edit 含 id/createUser/updateTime/version）；股东删除 body=`{id}`；股东删除确认 message-box「确认是否删除当前选择的数据?」；持股比例 quirk=输入 10 存 2.00（前端格式化，不断言显示值）；获取股东信息=`networkCheck` API 只读可重复。

### 4. 关联人表（C16-C19，probe48-61 实证，page61_wireanchors.json 全状态命中数验证）

- 与 smbsn 关联人（S8）同 API 族 `custCorporatRelatedParty/*`（查询 rltvTp='2'），但 **cpctMgt 关联人 save=`/save`**（≠ smbsn 的 `saveFamily`）；**关联人 delete body=完整行记录**（含 id/version/delInd/tsRowIndex，≠ 股东表 {id}）。
- **新增=两步向导**：步1 仅 关联方类型 select[法定代表人家族成员]→选中后按钮变[下一步,取消]→步2 表单按钮[引入,确定,取消]。**步1/步2 两个 el-dialog 同时可见**→wrapper 按 label 谓词区分：步1=含 label 关联方类型 **且不含** 关联客户编号；步2/修改/查看=含 label 关联客户编号（各状态恒 1 命中）。
- **引入=对私放大镜** `custPersonal/queryPersonalMagnifierList`（≠对公 `custCorporat/queryCustMagnifierList`）；条件 客户编号/客户名称/证件类型/证件号码，**须按客户编号查**（客户名称查无数据）；**环境唯一可引入对私客户=赵磊杰**（cstNo=26072917073423563，居民身份证=140300199709064115）；行 radio force click→【确认】→自动回填 4 只读字段[关联客户名称/关联客户编号/证件类型/证件号码]；放大镜 wrapper 锚点=含 label 客户编号+客户名称（放大镜精确 label「客户编号」≠向导「关联客户编号」，无歧义）；放大镜【确认】按钮 zh 含空格→translate 去空格。
- 字段字典（probe56 全枚举）：关联人家庭成员关系类型[配偶,父母,子女,兄弟姐妹]；性别[未知的性别,男性,女性,未说明的性别]；职务名称[中级,初级,无,高级领导…,一般员工,公务员职务级别,…]；最高学位[名誉博士,博士,硕士,学士,无学位,未知,其他]；最高学历[研究生教育…,大学本科毕业…]；注册资本币种[人民币,…]。
- save body 字段：relpartyTp=2, famMbrRelId(关系码，子女=24), rltvCstNm/No, crdtTp=100, crdtNo, gnd(男=1/女=2), postNm(码，一般员工=438), hgstDgr(硕士=3), hgstEddgr(大学本科毕业=21), ctcTel, telno, famEntpOrcd, wrkBusiRgsRgstNo, ccy=CNY, rgstCaptlfundAmt, rmrk, cstNo。
- **⚠️ FAM_ENTP_ORCD（家族企业名称）列限长**：9 个中文字符（AT_关联_9527）→ `Data too long` 拒；≤8 字符（AT_A9527）过。
- 关联人删除确认 message-box 文案「**提示您确定删除这条记录吗?**」（≠股东表「确认是否删除当前选择的数据?」；smbsn 关联人=「您确定删除这条记录吗?」；宽松断言用公共子串「确定删除这条记录」）。
- **⚠️ el-select-dropdown 为 position:fixed→offsetParent===null**：probe 里判可见性须 `getComputedStyle(x).display!=='none' && getBoundingClientRect().height>0`（probe55 根因，probe56 修正后 6 字典全枚举）。
- 数据基线：正式客户 AT_正式_20260923012641（cstNo=26092309301985195，cstSt=6）关联人表常驻基准行 1 条（AT_潜客_20260923110953 / 260923191235308113 / 法定代表人家族成员 / 居民身份证 110101198507136286 / 手机 13900000023）；C16/C19 自包含净零（新增赵磊杰行→删除）；C17 职务名称幂等改 一般员工(438)。

### 5. 可复用资产（勿重写）

- spec helper：`tests/corp/shareholder.ts`（openCorpModify/dlgSelect/dlgFill/dlgConfirm/dlgCancel/toast/confirmMessageBox/SH_SAVE_API/SH_DELETE_API/FORMAL_CST/PRE_CST 客户常量）、`tests/corp/rltp.ts`（rTable/waitRTable/rRowTexts/rRowCount/expectRRows/rGroup/clickRBtn/pickRRow/rDialog/magDialog/magPickCorp/wizardImport/openRScene + BASE_RLTP/MAG_CST(赵磊杰)/R_* 常量/R_MAG_API/R_DEL_HINT，re-export 股东侧函数+FORMAL_CST/PRE_CST）；spec C11-C15/C16-C19 同名文件。
- wire 生成器：`work/a02-corp/gen-wire-p10.js`（股东表）/ `gen-wire-p11.js`（关联人表：GRP/D1W/D2W/MW 锚点构造 + entry/addWizardRow/deleteRow 复用函数 + 校验器 dup/badPID/noRect）。
- 回放：`cd replay-skill && node replay.mjs ../partner-wire/corp --only rltp- --profile profiles/tansun-credit-corp.json --auth ../auth.json --out <dir>`（`--list` 先验解析；`--headed` 切有头）。
- 探路脚本：`work/a02-corp/probe_page_42-47`（股东表 radio/按钮组/锚点/列表行）、`probe_page_48-61`（关联人表 结构/字典/向导/放大镜/wire 锚点）。

### 6. 回放史

- 2026-10-19 **C11-C15 股东表**：5/5 PASS×2（headless，首轮 2 FAIL=出资时间日期面板拦截【确定】→插关面板步复绿）。
- 2026-10-19 **C16-C19 关联人表**：4/4 PASS×3（R1 headless 117.6s / R2 headless 108.3s / R3 headed 111.1s，0 警告 0 失败，首轮即全绿无修复；C16=38.3s/C17=19.7s/C18=19.8s/C19=39.2s）。
- 待录：C20=其他客户关联信息+受益人信息 其余 2 子表（各 新增/修改/查看/删除）；C21 经营情况/C22 客户标签 不录（用户确认：正式客户场景均「同担保公司」引用无独立内容）。
