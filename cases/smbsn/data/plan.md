# 同业客户管理（smbsn）录制计划

平台：test.creditv5p2.tansun.com.cn（天阳信贷 V5P2，微前端）
模块路由：`/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg`
客户代码：cstCgy/cstTp=80（同业），avyEcd=UML00005754
探路产物：probe1.out（列表+抽屉）/ probe2.out（抽屉保存→场景页 API 序列）/ probe3.out（场景页选项+空暂存）/ probe4.out（3 引入弹窗）/ scene_dump.json（场景页 71 字段全量盘点）

## 原子交易清单

| 交易名称 | 操作步骤描述 |
|---|---|
| S1 同业客户-新增客户 | 列表页点【新增】→ 抽屉录入 证件类型(营业执照)/证件号码/客户名称 → 点【保存】(checkCustTrade 查重通过,生成 cstNo) → 进入客户场景页(5 折叠段,71 字段) → 全量填充(含 3 个引入子流程:调查机构/法定代表人/登记注册地址) → 点【暂存】(saveCustTrade, prsvInd=0) → 点【返回】回列表 → 按客户名称查询反查 total=1 且行存在 |
| S2 同业客户-修改客户(全量改值) | 列表页按客户编号查询(命中 S1 落库草稿 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页(编辑态,5 折叠段 71 字段,56 可改) → **两段式改值**(第1段:全部明文项含调查机构引入换行→【暂存】→【返回】；第2段:重进表单 法代引入→地址引入→注册资本→【暂存】→【返回】) → 按客户编号反查 total=1。两段式是破解"引入确认回滚"的关键:第1段暂存把明文项落库刷新快照,第2段引入确认回滚到已落库新值=无感 |
| S3 同业客户-股东信息新增 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【股东信息】tab → 点【新增】开「新增股东信息」弹窗(12 项) → **按顺序全量填写**(股东类型/股东名称/股东客户编号/证件类型/证件号码/币种/持股比例/出资方式/出资时间/认缴出资额/实缴出资额/备注,股东名称直接输入不引入) → 点【确定】保存(validateDate 业务校验:出资时间≤营业日期 且 ≥登记注册日期) → 断言表格 +1 |
| S4 同业客户-股东信息修改 | 列表页按客户编号查询 → 行 Radio 选中 → 点【修改】进场景页 → 点【股东信息】tab → 行 Radio 选中 → 点【修改】开「修改股东信息」弹窗(预填回显) → 改明文项 → 点【确定】保存。**暂停**：save(viewType=edit) 后端 BizException「注册资本不能为空！」(100)——修改路径反查关联客户注册资本，需股东指向真实对公法人客户（详见 skill tansun-cst-recorder） |
| S5 同业客户-股东信息删除 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【股东信息】tab → 股东表行 Radio 选中(首行) → 点【删除】(选行后可用) → 「Message」message-box 确认弹窗(msg=确认是否删除当前选择的数据？, 按钮 Cancel/OK 英文) → 点【OK】(custCorporatRelatedParty/delete {id}) → 断言表格行 -1 且被删行消失。**数据依赖**：删除前股东表须 ≥1 行（S3 先建或残留行） |
| S6 同业客户-股东信息查看 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【股东信息】tab → 股东表行 Radio 选中(首行) → 点【查看】(选行后可用) → 只读 .el-dialog 弹窗(12 项全 disabled，值=行值；custCorporatRelatedParty/get {id}) → 点【取消】关闭。只读交易，可重复回放 |
| S7 同业客户-获取股东信息 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【股东信息】tab → 点【获取股东信息】(**不依赖选行**,tab 打开即可用) → 后端 `custCorporat/networkCheck`(body 含 cstNo/cstNm/uscc/法代 4 要素, chkTp=0 type=1) 200 → 前端重查股东表 + `.el-notification`「操作成功」(右上,~4s 自动消失) → 【返回】→ 客户编号反查 total=1。**只读**：本测试客户无外部股东数据源命中，行数不变；可重复回放 |
| S8 同业客户-关联人信息新增 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【关联人信息】tab → 点【新增】开「新增关联人信息」弹窗(17 项, 无标题 .el-dialog) → 高管类别(select, tssc-multi-select 多选组件, 选项后须 Esc 收起) → 点【引入】开「引入客户」子弹窗(**对私放大镜** `custPersonal/queryPersonalMagnifierList`, 客户编号/名称/证件号码三条件不可同时为空) → 按客户名称查询 → 目标行 Radio → 【确认】(**自动回填** 关联客户名称/关联客户编号[disabled]/证件类型=居民身份证/证件号码) → 按格式填余 13 项(联系电话/性别/出生日期/职业/职务名称/职称/最高学历/最高学位/居住地址/单位电话/工作单位/工作简历描述, 性别与出生日期从引入客户身份证 17 位奇偶/出生日期推导) → 点【确定】(`custCorporatRelatedParty/saveFamily` 200) → 断言关联人表 +1 → 【返回】→ 客户编号反查命中。**数据增长型**：每回放 +1 行(同客户同高管可重复,平台不拦唯一)；删除清理走 pane 工具栏【删除】+message-box OK(`custCorporatRelatedParty/delete`) |
| S9 同业客户-关联人信息修改 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【关联人信息】tab → 关联人表行 Radio 选中(首行) → 点【修改】开「修改关联人信息」弹窗(17 项回显, 4 项禁用: 关联客户名称[disabled+引入]/关联客户编号/证件类型/证件号码, 出生日期预填干净日期无时分秒) → **改 6 项异值**(同值不产生变更; 联系电话/居住地址/职称/单位电话/工作单位/工作简历描述, 出生日期不动保身份证自洽) → 点【确定】(`custCorporatRelatedParty/saveFamily` 200, 同新增接口, 无 S4 注册资本校验) → 点【查看】逐行核对持久化(两行同名列无法区分, 按联系电话==新值定位) → 【返回】→ 客户编号反查命中。**幂等可重放**：改值固定, 重放填同值=无变更, save 仍 200 |
| S10 同业客户-关联人信息查看 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【关联人信息】tab → 关联人表行 Radio 选中(首行) → 点【查看】开「查看关联人信息」只读弹窗(**17 项全 disabled 纯 input**, select 也渲染为禁用 input; 按钮 引入×2/取消, 无确定) → 断言 17 项 label 顺序 + 全禁用 + 5 个可映射列(关联客户编号/关联客户名称/证件类型/证件号码/职务名称)弹窗值==行值 → 点【取消】关闭 → 【返回】→ 客户编号反查。**只读幂等**：无数据变更, 无限重放 |
| S11 同业客户-关联人信息删除 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【关联人信息】tab → 关联人表首行 Radio 选中 → 点【删除】→ `.el-message-box`「**您确定删除这条记录吗?**」(关联人措辞, 与股东删除「确认是否删除当前选择的数据」不同) → 点【OK】(`custCorporatRelatedParty/delete` 200「操作成功」) → 断言 requery total 行-1 → 【返回】→ 客户编号反查。**数据消耗型**：每回放 -1 行, 关联人表清零后重放前须先 S8 补行 |
| S12 同业客户-影像资料上传 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【影像资料】tab(文件管理组件 file-catalog-container, 左目录树+右文件列表) → 目录树选中「客户管理」节点(`filesFileManage/pageFileInf` 按 cstNo+bsnNo+ctlgNo=clientMtrl 查询) → 点【上传】→ **系统文件选择框**(filechooser, 无自定义弹窗)选测试图片 → **自动上传**(`filesFileManage/upload` multipart 200 返回 fileNo, 无需确认) → 断言文件列表 +1 且行含文件名(列: 文件名/类型/上传人/上传时间) → 【返回】→ 重进场景验证文件持久化。**数据增长型**：每回放 +1 文件 |
| S13 同业客户-影像资料查看 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【影像资料】tab → 目录树选中「客户管理」节点 → **模式守卫**(若当前为卡片/预览模式则先点【返回列表】切回表格模式, 显示模式**服务端持久化**) → 点首行【预览】(fixed-right 行操作列, el-button--text) → **行内 viewer**: 列表切卡片模式+中央图片查看器(缩放/旋转工具条)+右侧属性面板(文件名/文件大小(b)/作者/类型/更新时间), `filesFileManage/preview` 200 → 断言【返回列表】可见+属性面板含文件名 → 点【返回列表】退回表格模式 → 【返回】→ 重进场景验证文件仍在(total 不变)。**只读幂等**：需目录 ≥1 文件(清零后先 S12) |
| S14 同业客户-影像资料删除 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【影像资料】tab → 目录树选中「客户管理」节点 → **模式守卫**切表格模式 → 点首行【删除】(fixed-right 行操作列) → `.el-message-box`「是否删除该档案」(**按钮 locale 漂移**: probe71b=中文「取消/确定」, S14 spec=英文「Cancel/OK」, 确认键恒为 el-button--primary) → 点【确定/OK】(`filesFileManage/deleteFileInf` 200) → 断言回查 total-1 → 【返回】→ 重进场景验证删除持久化。**数据消耗型**：每回放 -1 文件, 清零后重放前须先 S12 补文件 |
| S15 同业客户-影像目录检索 | 列表页按客户编号查询(命中 cstNo=260924144929974126) → 行 Radio 选中 → 点【修改】进场景页 → 点【影像资料】tab(左侧目录搜索框+目录树, 无需选节点) → 目录搜索框(pane 内 `.leftContent` 首个 `input[placeholder=请输入]`, **div.el-input 非 span**)输入「营业执照」→ 断言目录树过滤(17→2 可见节点: 客户管理+营业执照 命中路径) → 清空搜索 → 断言树恢复(≥进入时, 懒渲染基线 15→全量 17) → 【返回】。**只读幂等**：不依赖文件数据, 无限重放 |

## 探路技术结论

### 列表页
- API：`POST /tansun-tcp-cst/custTrade/findCustTradeList`，body `{pageNum,pageSize,cstNo,cstNm,crdtTp,crdtNo,usrNo,cstSt}`，resp `{code,data:{total,list}}`
- 表头：客户编号/客户名称/证件类型/证件号码/客户类别/管户客户经理/管户机构/客户状态
- 查询反查用 客户名称(cstNm) 条件即可唯一命中

### 新增抽屉（.el-drawer，非 dialog）
- 3 字段：证件类型(select, 默认已选 营业执照, 选项枚举未展开但默认值可用) / 证件号码(input) / 客户名称(input)
- 底部按钮：保存 / 取消
- 点【保存】→ `checkCustTrade {crdtTp:'20111',crdtNo,cstNm,cstNo:'',avyEcd:'UML00005754'}` → data 含新 cstNo/id → 前端路由跳场景页

### 场景页
- URL：`/#/cstMgt/csinfMnt/smbsnCstMgt/mdfSmbsnCst/hostCstmgrMdfSmbsnCsinf/FS00001388HostCstmgrMdfSmbsnCsinf?newtag=true&crdtTp=20111&crdtNo=...&cstNm=...&cstNo=...&avyEcd=UML00005754&id=...&bsnTp=80&cstTp=80&fcnScnEcd=FS00001388...`
- 进入时 `ipcFcnScnInf/hit` + `getCustTrade`（回显）+ `getRatingResult`
- 5 折叠段（默认全部展开）：基本信息(0-21) / 法定代表人信息(22-25) / 组织机构信息(26-35) / 经营信息(36-45) / 财务信息(46-70)
- 6 Tab：基本信息/股东信息/关联人信息/影像资料/业务信息/其他信息（仅录基本信息 Tab）
- 页面按钮：引入 / 保存 / 暂存 / 返回
- 暂存 → `saveCustTrade {prsvInd:'0', smbsnCstBaseInf{cstNo,cstNm,crdtTp,crdtNo,cstCgy:'80',...}, lglRprs, inst, cstOprtInf, smbsnCstFncInf, cstSt:'6'}`，**暂存不做必填校验**（空表暂存成功 msg=''）
- 只读/系统反显字段（dis）：客户编号/客户名称/证件类型/证件号码/客户类别/是否为XXX法人行/企业规模/法定代表人 4 项/认定等级/认定评分/评级认定日期/评级到期日期 → 盘点为 skip
- 3 个引入（btns=引入）：调查机构 / 法定代表人·负责人姓名(dis) / 登记注册地址(dis)

### 场景页 select 选项（probe3 实测枚举）
- 所在地区行政区划：崇左/来宾/河池/贺州/百色/玉林/贵港/钦州/防城港/北海/梧州/桂林/柳州/西海 市
- 同业客户类型：银行业存款类金融机构/保险公司类/证券公司类/银行业非存款金融公司类/其他类
- 机构类别：20 项（含 股份制商业银行/城市商业银行/政策性银行/大型商业银行…）
- 组织形式：总行/总行营业部/一级分行/一级分行营业部/二级分行/二级分行营业部/支行/其他机构
- 平均资产总额：15 档（10亿元（含）至100亿元（不含）…40000亿元（含）以上）
- 中征码状态：有效/暂停/注销/吊销
- 上市公司标志：否/是
- 评级等级（外部）：未评级/AAA/…
- 控股经济成分类型：10 项（国有/集体/私人/港澳台/外商 × 相对/绝对控股）

### 3 引入弹窗（probe4 实测）
| 字段 | API | 条件字段 | 表格列 | 按钮 |
|---|---|---|---|---|
| 调查机构 | `orgClient/findAllOrgPage` | 机构编号/机构名称 | 机构码/上级机构编码/机构名称/所属法人机构码/Radio | 查询/重置/取消/确认 |
| 法定代表人/负责人姓名 | `custPersonal/queryPersonalMagnifierList` | 客户编号/客户名称/证件类型(select)/证件号码 | 客户编号/客户名称/证件类型/证件号码/客户类型/客户类型细分/客户状态/管户客户经理/管户机构/Radio | 查询/重置/取消/确认 |
| 登记注册地址 | 无查询(级联下拉) | 省份/城市/区/县/乡镇/街道/行政村/社区(5级 select) + 详细地址(input) | 无 | 取消/确认 |

### 股东信息 tab（S3）
- 场景页(mdfSmbsnCst)内 6 Tab 之一；表格列：股东类型/股东客户编号/股东名称/证件类型/证件号码/币种/认缴出资额/实缴出资额/持股比例/出资方式/出资时间/备注
- 【新增】弹窗为 `.el-dialog`（**非 drawer**）12 项：股东类型(select) / 股东名称(input) / 股东客户编号(input) / 证件类型(select) / 证件号码(input) / 币种(select) / 持股比例(input) / 出资方式(select) / 出资时间(date) / 认缴出资额(元) / 实缴出资额（元） / 备注(textarea)
- 保存 API：`custCorporatRelatedParty/save`
- **validateDate 业务校验**（ZJJK00105742）：出资时间 > `localStorage.businessDate`（营业日期）→ toast「出资日期不能大于营业日期」并**清空字段**（随后必填报「请选择出资时间」）；出资时间 < `rgsRgstDt`（登记注册日期，本客户=2025-06-18）→「保存失败，出资日期不应小于登记注册日期！」。本客户营业日期=2026-9-23 → 出资时间取 **9 月 1 日**（用户指定）
- **持股比例**：表单输百分比，blur 后转小数（"10"→"0.10"，0.1 步进）
- **日期组件** ElDatePicker→TsscMultiDatePicker→ElFormItem：`fill` 仅设 parsedValue 且面板保持打开；**失焦（Enter/点别处）才提交 model 且关面板**（probe39 实证）

## 数据策略
- 客户名称 = `AT_SMB_<yyyymmddHHMMSS>`（唯一,防 checkCustTrade 重复）
- 证件号码 = 18 位随机统一社会信用代码（crdtTp=20111）
- 机构统一社会信用代码(instUscc) = 另一 18 位随机码
- 联系电话 = 139 开头随机 11 位
- 登记注册地址详细地址 = `AT引入测试路1号`
- 已验证数据（探路期）：AT_SMB_20260924060756 / 444RK406MW5GDEDJQU / cstNo=260924140815083115（草稿）

## 回放记录

### S1 新增客户 —— 全链路 GREEN（2026-09-24）
- **filllog**：`work/smbsn/filllog-S1.json` total=71 ok=71（spec `tests/smbsn/S1-new.spec.ts` 通过，两阶段：抽屉保存→场景暂存）
- **wire**：`partner-wire/smbsn/S1-new.json`（89 步：page×3 / popup×4 / ele×82；dup=0 badPID=0 noRect=0）
  - 生成器 `work/smbsn/gen-wire-s1.js`（filllog + s1-values + rects-wire.json → wire）
  - 数据刷新 `work/smbsn/refresh-wire-data.js`（客户名称/USCC/机构USCC/电话 5 处换新，回放前执行）
  - 关键步：3 个引入弹窗各插「首行记录单选」click 步（XPath 含 `el-radio` → 引擎 RadioRowAction 自动走行选+断言）；每个日期步后插「关闭日期面板」click 步（点客户编号 label，防 picker 遮挡）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S1-new.json --profile replay-skill/profiles/explore-cst-smbsn.json`
  - 结果 **PASS 1/1，89/89 步，102s，0 警告 0 失败**（headless，auth 过期时引擎自动登录）
  - 落库验证：列表按客户名称 `AT_SMB_20260924145809` 反查 `findCustTradeList` → **total=1**，cstNo=260924150047691127，cstSt=6；抽查字段全部正确（USCC=914501006BUT0BH3G2、调查机构/地址反显、登记注册地址=广西崇左凭祥综合保税区AT引入测试路1号、中征码 3 项、财务 20 项）
- **已知残留**：模块无删除入口（UI/接口均无），探路期 10 个 AT_* 草稿 + 回放产生的草稿（cstSt=6）留在列表，需后台清理

### S2 修改客户(全量改值) —— 全链路 GREEN（2026-09-24）
- **编辑对象**：S1 落库草稿 cstNo=`260924144929974126`（cstNm=`AT_SMB_20260924144917`）；场景页 5 折叠段 71 字段，**56 可改 / 15 只读(skip)**
- **filllog**：`work/smbsn/filllog-S2.json` total=73 ok=73（spec `tests/smbsn/S2-edit.spec.ts` 通过，**两段式**，2.1min）
  - 第1段 visit1=68~70 项(全部明文项含调查机构引入换行)→【暂存】→【返回】；第2段 visit2=3 项(法代引入→地址引入→注册资本)→【暂存】→【返回】
  - 改后全量复读 `REREAD_SILENT_REVERT=[]`（56 项页面当前值全部 ≠ 改前值）；重进表单 `REOPEN_BAD=[]`
- **wire**：`partner-wire/smbsn/S2-edit.json`（94 步：page×6 / popup×3 / ele×85；dup=0 badPID=0 noRect=0）
  - 生成器 `work/smbsn/gen-wire-s2.js`（filllog-S2 两段合并 + s2-values + rects-wire.json + 列表层 rect 实测 → wire）
  - 关键步：列表层「客户编号→查询→首行记录单选→修改」入 wire（RADIO_LIST_X 走引擎 RadioRowAction）；3 引入弹窗各插「首行记录单选」；日期步后插「关闭日期面板」
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S2-edit.json --profile replay-skill/profiles/explore-cst-smbsn.json`
  - 结果 **PASS 1/1，94/94 步，112s，0 警告 0 失败**（headless，auth 过期时引擎自动登录）
  - 落库验证：反查 `findCustTradeList` total=1；明文项(客户简称/金融许可证号/联系人姓名/投资总额等)与调查机构引入均持久化

### S2 引入回滚规则（探针 V1–V16 + probe2/3/4 实证，两段式设计的依据）
- **R1**：引入确认会把**之前改过的** 组织机构/经营信息/财务信息 明文项**回滚到本次进表初始快照**（非暂存值）；基本信息组与引入字段不受影响
- **R2**：{经营范围,主营范围,登记注册有效期} 在引入已改之后填充 → 回滚引入
- **M-A**：地址引入确认时**注册资本已改** → 法代回滚；注册资本干净时不回滚
- 法代引入确认**无条件回滚已改的地址** → 法代必须在地址引入之前
- 引入后安全填充：金融许可证号/地税/国税/营业执照/注册资本；引入后经营/财务段填充会回滚法代
- **解法=两段式**：明文项(含调查机构引入)在第1段全部改完并【暂存】落库 → 重进表单刷新快照 → 第2段按 法代→地址→注册资本 顺序做引入；引入确认回滚到的快照已是新值，无感
- **已知应用行为（非脚本缺陷，仅记录）**：编辑态下 法代/地址 引入重挂接在【暂存】后会回滚（引入仅改显示，法代联动字段留 N/A、地址底层省市区编码未更新）；明文项与调查机构引入持久化正常

### S3 股东信息新增 —— 全链路 GREEN（2026-09-28）
- **spec**：`tests/smbsn/S3-shareholder.spec.ts` 通过（35.4s，12/12 字段 ok，表格 0→1），filllog `work/smbsn/filllog-S3.json` total=12 ok=12
  - 出资时间 = **9 月 1 日**（2026-09-01，用户指定）；踩坑：初选当日(2026-09-28) 超营业日期被 validateDate 清空→误报「请选择出资时间」，probe37 抓 `validateDate` 源码定位，probe38 测得 businessDate=2026-9-23 / rgsRgstDt=2025-06-18
  - 持股比例输百分比 "10"（blur 转小数 0.10）
- **wire**：`partner-wire/smbsn/S3-shareholder.json`（23 步：page×2 / popup×1 / ele×20；`CHECK steps=23 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s3.js`；回放前数据刷新 `work/smbsn/refresh-wire-data-s3.js`（换股东名称/股东客户编号/证件号码/备注 4 处唯一值）
  - **关键步**：出资时间 input 步后插「点股东名称标签失焦」—— 引擎 input 仅 fill 不 Enter，fill 只设 parsedValue 且面板保持打开，失焦才提交 model 且关面板（probe39 实证）；若点被面板遮挡的「认缴出资额」标签→点击被 intercept 30s 超时
  - profile `explore-cst-smbsn.json` popups 增 `{match:["股东信息"],selector:".el-dialog"}`（新增股东信息是 dialog 非 drawer；须先于「新增」匹配，否则落 .el-drawer 超时）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S3-shareholder.json --profile replay-skill/profiles/explore-cst-smbsn.json`
  - 结果 **PASS 1/1，23/23 步，34.5s，0 警告 0 失败**
  - 落库验证（`work/smbsn/verify_s3.js`）：反查股东信息表 SH_ROWS=2，回放新增 AT_SMB股东_20260928111735 存在
- **已知残留**：spec + 回放各建 1 个股东（AT_SMB股东_20260928110708 / _20260928111735）留存列表（**后已被 S5 删除清掉**）
- **待办/风险**：S1/S2/S3/S5/S6/S7/S8/S9/S10/S11/S12/S13/S14/S15/S16 十五笔已交付（smbsn 除 S4 外全部录完）；S4 暂停（见清单）

### S5 股东信息删除 —— 全链路 GREEN（2026-09-28）
- **删除入口**（probe48 探明）：股东信息 tab pane 工具栏【删除】按钮（新增/修改/查看/**删除**/获取股东信息），**选行 radio 后 enabled**；确认弹窗 = **`.el-message-box`**（非 .el-dialog），title=「Message」，msg=「确认是否删除当前选择的数据？」，按钮 **Cancel / OK 英文**（element-ui 默认 en locale；Playwright `getByRole('button')` 对该 OK 按钮不可靠，用 `button.el-button--primary` class 锚定）
- **API**：查询 `custCorporatRelatedParty/queryCustCorporatRelatedParty {cstNo, rltvTp:'0', pageNum, pageSize}` → `{data:{total,list}}`；删除 `custCorporatRelatedParty/delete` body `{"id":"<股东行id>"}` → `{status:200, description:"操作成功"}`
- **spec**：`tests/smbsn/S5-shareholder-delete.spec.ts` 通过（28.4s，股东表 2→1，断言行 -1 且被删行消失 + 删除 API 200），值落盘 `work/smbsn/s5-values.json`
- **wire**：`partner-wire/smbsn/S5-shareholder-delete.json`（11 步：page×2 / popup×1 / ele×8；`CHECK steps=11 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s5.js`（s5-values + rects-wire.json → wire）
  - profile `explore-cst-smbsn.json` popups 增 `{match:["删除确认"],selector:".el-message-box"}`
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S5-shareholder-delete.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，11/11 步，25s，0 警告 0 失败**
  - 落库验证：回放后反查股东表 total 0（S5 回放删掉最后一行）→ 再跑 S3 spec 补 1 行回基线（AT_SMB股东_20260928144411）
- **数据依赖**：S5 删「首行」，回放前股东表须 ≥1 行——目录级顺序回放（S3 先于 S5）天然满足；单独重放 S5 前须先跑 S3

### S6 股东信息查看 —— 全链路 GREEN（2026-09-28）
- **查看入口**（probe50 探明）：股东表选行 radio 后 pane 工具栏【查看】enabled；打开**只读 `.el-dialog`**（class `dialog706`，无标题）12 项**全 disabled**（备注是 disabled textarea），按钮【引入】【取消】；API `custCorporatRelatedParty/get {id}` → 回显值
- **spec**：`tests/smbsn/S6-shareholder-view.spec.ts` 通过（20.2s，12 项 labels 序=股东类型/股东名称/股东客户编号/证件类型/证件号码/币种/持股比例/出资方式/出资时间/认缴出资额(元)/实缴出资额（元）/备注；8 个 input/textarea 值 == 行值；取消后弹窗关闭；返回反查 total=1）
- **wire**：`partner-wire/smbsn/S6-shareholder-view.json`（11 步：page×2 / popup×1 / ele×8；`CHECK steps=11 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s6.js`；**无需改 profile**：popup 步名「查看股东信息」命中现有 `{match:["股东信息"],selector:".el-dialog"}` 条目
  - 引擎 `waitForVisible` 按 visible 过滤 XPath 多匹配（其他隐藏 tab 的同名【查看】按钮被过滤）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S6-shareholder-view.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，11/11 步，23s，0 警告 0 失败**（--headed 回显过）
- **数据依赖**：同 S5，股东表须 ≥1 行；**只读交易**不消耗数据，可任意重放

### S7 获取股东信息 —— 全链路 GREEN（2026-09-28）
- **行为探明**（probe51/52）：【获取股东信息】按钮**不依赖选行**（tab 打开即 enabled）；点击后无弹层、无新 tab，前端可见序列 = `POST custCorporat/networkCheck {cstNo,cstNm,uscc,lglRprsNm,lglRprsCrdtNo,chkTp:'0',type:'1'}` 200（本客户 resp `data:{rslt:'1',inspRstinf:'要素核查匹配正确'}`）→ 重查 `queryCustCorporatRelatedParty`（total 不变）→ `.el-notification`「操作成功」（右上角，~4s 自动消失，**注意 .el-message 选择器抓不到，要 .el-notification**）
- **spec**：`tests/smbsn/S7-shareholder-fetch.spec.ts` 通过（21.9s，断言 networkCheck body.cstNo + resp 200 + 成功通知 + 重查 total 不变 + 表格行数不变 + 返回反查 total=1）
- **wire**：`partner-wire/smbsn/S7-shareholder-fetch.json`（12 步：page×3 / ele×9；`CHECK steps=12 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s7.js`；无需改 profile（无弹窗）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S7-shareholder-fetch.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，12/12 步，26s，0 警告 0 失败**（--headed 回显过）
- **数据依赖**：无（只读，本测试环境不增行）；可任意重放

### S8 关联人信息新增 —— 全链路 GREEN（2026-09-28）
- **结构探明**（probe55/56/56c/57e）：
  - 关联人与股东**共用表/API** `custCorporatRelatedParty/*`，body `rltvTp:'2'`（S5 股东 tab 查询是 `'0'`，同表不同 rltvTp）；保存接口 = **`custCorporatRelatedParty/saveFamily`**（非 save）；删除 = `custCorporatRelatedParty/delete`（body 含 id/cstNo/crdtTp/crdtNo/rltvCstNo/rltvCstNm/rltvCstCgy/relpartyTp…），确认框 = `.el-message-box`「您确定删除这条记录吗?」Cancel/OK 英文（probe58 实证）
  - 「新增关联人信息」弹窗：无标题 `.el-dialog`（class dialog467 动态），17 项；**关联客户名称/关联客户编号 disabled**（名称带【引入】按钮，居住地址也有引入按钮）；**高管类别 = tssc-multi-select 自定义多选组件**（选项：董事长/总经理/财务负责人/董事/监事/其他高管/财务总监），**点选项后下拉不收，须 Esc**
  - 「引入客户」子弹窗 = **对私放大镜**（`custPersonal/queryPersonalMagnifierList`）：字段 客户编号/客户名称/证件类型/证件号码，**三条件不可同时为空**（toast「客户编号、客户名称和证件号码不能同时为空!」，空查询不发 API）；**关联人必须指向真实对私客户**
  - 引入【确认】后**自动回填**：关联客户名称/关联客户编号/证件类型(居民身份证)/证件号码
- **数据（按格式要求，非随机）**：引入对象 = 对私客户 AT_正式_20260923110954（cstNo=260923191355585114，身份证 110101198501239591 → 17 位奇数=男性、出生日期 1985-01-23，与证件自洽）；高管类别=董事长；联系电话 13988158428（11 位手机）/单位电话 0771-1234568（区号+7 位固话，仿 S1 惯例）；职业=专业技术人员/职务名称=其他/职称=中级/最高学历=大学本科毕业/最高学位=学士；居住地址/工作单位/工作简历描述=AT 前缀测试值
- **spec**：`tests/smbsn/S8-related-party.spec.ts` 通过（51.3s；13 项 fill 全 ok，引入回填断言，saveFamily 200，行数 +1 且新行值正确，返回反查 DOM 可见——**响应体 total 断言不可靠已弃用**，改 DOM）
- **wire**：`partner-wire/smbsn/S8-related-party.json`（34 步：page×3 / popup×2 / ele×29；`CHECK steps=34 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s8.js`（s8-values + filllog-S8 逐项 rect + rects-wire.json）
  - **双弹窗锚点**：新增弹窗 = `//div[contains(@class,'el-dialog')][.//label[normalize-space()='高管类别']]`；引入弹窗 = `//div[...el-dialog...][.//label[normalize-space()='客户编号']]`（新增弹窗里是「关联客户编号」，精确 label 不冲突）；引入行 Radio 按 cstNo 文本定位 tr
  - profile popups **新增两条且须先于「新增」**：`{match:["关联人"],selector:".el-dialog"}` / `{match:["引入"],selector:".el-dialog"}`（否则「新增关联人信息」误匹配「新增」→.el-drawer 超时）
  - 引擎 `SelectClickAction` 增兜底：选项点击后下拉仍 visible 则 Esc（多选型 tssc-multi-select 需要；单选型已自收，行为不变）
  - 出生日期 input 步后插「关闭日期面板（点联系电话栏）」（引擎 input 仅 fill 不 Enter，同 S3 经验）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S8-related-party.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，34/34 步，53s，0 警告 0 失败**（--headed 回显过）
  - 落库验证（probe59）：回放后关联人表出现目标行 `["",260923191355585114,AT_正式_20260923110954,高管,居民身份证,110101198501239591,其他]`
- **数据依赖/增长**：每回放 +1 行（平台**不拦**同客户同高管重复）；当前基线客户关联人表 = 2 行（spec 绿跑 + 回放各 1）；清理 = 关联人 tab 选行【删除】→ message-box OK；删除 API 同股东（rltvTp 无关，按 id）

### S9 关联人信息修改 —— 全链路 GREEN（2026-09-28）
- **结构探明**（probe60）：关联人 tab 选行 radio 后 pane 工具栏【修改】enabled（实际不选行也 enabled，选行后作用于选中行）；「修改关联人信息」弹窗 = 无标题 `.el-dialog`（class dialog043 动态）**17 项回显**：**可改 13 项**（高管类别/联系电话/性别/出生日期/职业/职务名称/职称/最高学历/最高学位/居住地址/单位电话/工作单位/工作简历描述），**禁用 4 项**（关联客户名称[disabled+引入]/关联客户编号/证件类型/证件号码）；**出生日期预填为干净日期**（"1985-01-23" 无时分秒，与 S4 股东编辑弹窗不同）；按钮 引入×2/确定/取消
- **保存 API = `custCorporatRelatedParty/saveFamily`**（同新增），toast「操作成功」；关联人指向对私客户，**无** S4 股东修改那种「注册资本不能为空」后端校验
- **改值策略（S4 经验：同值不产生变更）**：改 6 项异值且格式合规——联系电话 13988158429 / 居住地址 广西壮族自治区南宁市西乡塘区测试路2号 / 职称 一般员工（选项无简单"高级"，有完整行政级别长文案）/ 单位电话 0771-1234569 / 工作单位 AT测试商业银行股份有限公司 / 工作简历描述 AT测试关联人修改后工作简历描述；**出生日期不动**（与身份证 1985-01-23 自洽，避免破坏证件一致性）
- **spec**：`tests/smbsn/S9-related-party-edit.spec.ts` 通过（41.4s；回显断言=现值，6 项改值回读一致，saveFamily 200+成功 toast，**查看弹窗逐行核对持久化**（两行同名无法用表格列区分，按联系电话==新值定位行），返回反查 DOM）
- **wire**：`partner-wire/smbsn/S9-related-party-edit.json`（21 步：page×3 / popup×1 / ele×17；`CHECK steps=21 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s9.js`（s9-values[含 rpRadioRect 由 probe61 补量] + filllog-S9 + s8-values 列表层 + rects-wire.json）
  - **无需改 profile**：popup 步名「修改关联人信息」命中现有 `{match:["关联人"]}` 条目；弹窗锚点同 S8（高管类别 label）；**wire 幂等**：改值固定，重放时填同值=无变更，save 仍 200
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S9-related-party-edit.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，21/21 步，34.7s，0 警告 0 失败**（--headed 回显过）
- **数据现状**：关联人表 2 行——首行（S8 spec 建的）已被 S9 改为新值，次行（S8 回放建的）仍为 S8 原值

### S10 关联人信息查看 —— 全链路 GREEN（2026-09-28）
- **结构探明**（probe62/63）：「查看关联人信息」弹窗 = 无标题 `.el-dialog`（dialog312/042 动态）17 项**全 disabled 纯 input**（select 类字段也渲染为禁用 input，值即展示文本）；按钮 **引入×2 + 取消**（无确定，纯只读）；**无 get API 调用**（查看数据直接来自列表行对象，S6 股东查看则走 `custCorporatRelatedParty/get`）
- **17 项 label 顺序**：高管类别/关联客户名称/关联客户编号/证件类型/证件号码/联系电话/性别/出生日期/职业/职务名称/职称/最高学历/最高学位/居住地址/单位电话/工作单位/工作简历描述
- **新坑（spec 首跑失败原因）**：查看弹窗 **shell 先出现、body 表单项异步渲染** → `expect(dlg).toBeVisible()` 通过后立刻 `count('.el-form-item:visible')` 得 0；须**先 `expect(dlg.locator('.el-form-item').first()).toBeVisible()`** 再 count/断言（probe 有 3s sleep 掩盖了该时序）
- **spec**：`tests/smbsn/S10-related-party-view.spec.ts` 通过（23.3s；17 项顺序+全禁用+5 列弹窗值==行值+高管类别非空，取消关闭，返回反查 total=1）
- **wire**：`partner-wire/smbsn/S10-related-party-view.json`（11 步：page×2 / popup×1 / ele×8；`CHECK steps=11 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s10.js`（s10-values + rects-wire.json）
  - **无需改 profile**：popup 步名「查看关联人信息」命中现有 `{match:["关联人"]}` 条目
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S10-related-party-view.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，11/11 步，25.2s，0 警告 0 失败**（--headed 回显过）
- **数据影响**：无（只读，幂等可无限重放）

### S11 关联人信息删除 —— 全链路 GREEN（2026-09-28）
- **删除链路**（镜像 S5 股东删除）：pane 工具栏【删除】→ `.el-message-box`「**您确定删除这条记录吗?**」（关联人 pane 措辞；S5 股东 pane 是「确认是否删除当前选择的数据」→ spec 断言放宽为 `toContain('删除')`）→ 按钮 Cancel/OK（OK=`el-button--primary`）→ `custCorporatRelatedParty/delete` 200「操作成功」→ requery total 行-1
- **新坑（spec 首跑失败原因）**：两行关联人**表格 6 列完全同值**（联系电话等改动字段不在表格列中）→ 删除首行后剩余行文本与被删行相同，`not.toContain(被删行文本)` 误杀；改为只断言行数（requery total 为权威）+ 日志。S5 无此问题（单行+名称唯一）
- **数据管理**：spec 跑时 2→1→（补行 S8×2 → 3… 实际执行序列）首跑删 1 行后 spec 断言失败但删除已生效（剩 1）；重跑 spec 删至 0；随后 **S8 回放×2 补 2 行**；wire 回放再删 1 → **当前关联人表 = 1 行**（S8 新建数据）。**重放依赖**：关联人表清零后，S9/S10/S11 重放前须先 S8 回放补行
- **spec**：`tests/smbsn/S11-related-party-delete.spec.ts` 通过（24.9s；2→1 行，delete 200，返回反查 total=1）
- **wire**：`partner-wire/smbsn/S11-related-party-delete.json`（11 步：page×2 / popup×1(删除确认) / ele×8；`CHECK steps=11 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s11.js`（由 gen-wire-s5.js sed 改写 + 修正：tab xpath/步名/rects 键 rpRadioRect）
  - **无需改 profile**：「删除确认」条目已存在
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S11-related-party-delete.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，11/11 步，23.5s，0 警告 0 失败**（--headed 回显过）
- **数据现状**：关联人表 = 1 行（S8 补行数据：联系电话 13988158428 等 S8 原值）

### S12 影像资料上传 —— 全链路 GREEN（2026-09-28）
- **页面结构**（probe64/65/66/67/68）：影像资料 tab = 文件管理组件（`file-catalog-container`，cmpt-ecd=ZJJK00090203「维护影像信息」）；左侧目录搜索框+目录树（`filesCtlgManage/listCtlgInf`，40+ 目录：数字信贷→影像资料/电子协议/股东会决议，客户管理→营业执照/财务报表，对公授信调查报告→同业调查报告 等）；右侧文件列表（`filesFileManage/pageFileInf`，body: pageNum/pageSize/fileNm/cstNo/bsnNo/ctlgNo，列：文件名/类型/上传人/上传时间）+ 工具栏 **刷新/批量操作/装订成册/扫描仪/上传/图册查看/视图预览**（空列表下全 enabled）
- **上传链路**：点【上传】→ **系统文件选择框**（页面隐藏 `input[type=file]`，无自定义弹窗，filechooser 可驱动）→ 选完即**自动上传** `filesFileManage/upload`（multipart）200 返回 `fileNo` → 自动回查 pageFileInf total+1 → 行回显。**无确认弹窗、无表单**
- **引擎扩展（新能力）**：`replay-skill/src/engine/actions/FileChooseAction.js` + ActionFactory 注册 `file:choose` 动作——byXpathVisible 定位触发按钮 → `page.waitForEvent('filechooser')` 先挂后点 → `fc.setFiles(node.value)`（value=文件绝对路径）→ settle；文件不存在时提前抛错
- **测试文件**：`work/smbsn/AT_test_image_upload.png`（134KB png，已入库，wire objectValue 存绝对路径）
- **spec**：`tests/smbsn/S12-image-upload.spec.ts` 通过（42.1s；pre=1→post=2，upload 200+fileNo，行含文件名，**返回重进场景验证持久化**）
- **wire**：`partner-wire/smbsn/S12-image-upload.json`（13 步：page×3 / ele×10 含 1 个 `file:choose`；`CHECK steps=13 dup=0 badPID=0 noRect=0`）
  - 生成器 `work/smbsn/gen-wire-s12.js`（s12-values + rects-wire.json）
  - 目录树节点 xpath：`//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']`（一级节点默认可见，无需展开）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S12-image-upload.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，13/13 步，28.6s，0 警告 0 失败**（--headed 回显过）
- **数据现状**：客户管理目录 = **0 个文件**（原 3 个：probe68 + S12 spec + S12 回放，后被 S14 spec 删 1、S14 回放再删 1、S14 spec 前 probe71b 删 1 清空；重放 S12/S13/S14 前数据状态见各节）
- **后续交易**：S13 影像查看 / S14 影像删除 / S15 目录检索 → 均已交付（见下）

### S13 影像资料查看 —— 全链路 GREEN（2026-09-29）
- **交互形态**（probe69/70/71/71b）：文件列表**双显示模式**——表格模式（工具栏含【视图预览】，行操作列=el-table **fixed-right 固定列**：预览/下载/移动/打印/删除，el-button--text）↔ 卡片/预览模式（工具栏含【返回列表】，卡片带 checkbox+中央图片 viewer）；**模式服务端持久化**（新会话停在上次模式）→ **不变式：spec/wire 必须以表格模式收尾**（末尾点【返回列表】）
- **查看链路**：表格模式点首行【预览】→ 列表切卡片模式+中央图片查看器（缩放/旋转工具条）+右侧**属性面板**（文件名/文件大小(b)/作者/类型/更新时间），`filesFileManage/preview` 200 → 点【返回列表】回表格模式。**无 dialog 无新页，只读**
- **fixed-right 定位**：主表 body 内行操作 span 为隐藏副本（9 个「预览」span 仅 6 可见）；spec 用 `.filter({visible:true})`，wire 引擎 `PageHelpers.byXpathVisible` 同语义自动跳过隐藏副本
- **spec**：`tests/smbsn/S13-image-view.spec.ts` 通过（52.7s；pre=2，属性面板含文件名，preview 200，**返回重进验证 total 不变**）
- **wire**：`partner-wire/smbsn/S13-image-view.json`（14 步：page×2 / ele×12；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s13.js`（s13-values + rects-wire.json）
  - 关键 xpath：首行预览 `//span[normalize-space()='预览']`（fixed 列可见副本）；返回列表 `//button[normalize-space()='返回列表']`（probe76 实证文本干净）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S13-image-view.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，14/14 步，30.9s，0 警告 0 失败**（--headed 回显过）
- **数据依赖**：只读，需客户管理目录 ≥1 文件（当前 0，重放前须先 S12 上传）

### S14 影像资料删除 —— 全链路 GREEN（2026-09-29）
- **删除链路**（probe71b 实证）：表格模式点首行【删除】→ `.el-message-box`「**是否删除该档案**」（**非**股东/关联人的 message-box 措辞）→ 点确认（el-button--primary）→ `filesFileManage/deleteFileInf` 200 → 自动回查 pageFileInf total-1
- **⚠ 确认按钮 locale 漂移**：同一 message-box 两次实测文案不同——probe71b=「提示/取消/确定」中文，S14 spec 跑=「Message/Cancel/OK」英文（平台 i18n 会话态漂移）；**wire xpath 双文案兼容**：`//div[contains(@class,'el-message-box')]//button[normalize-space()='确定' or normalize-space()='OK']`；spec 侧用 class 锚定 `button.el-button--primary` 免疫
- **批量操作≠删除入口**（probe70 探明）：【批量操作】=**批量下载**（未选中 toast「请选择要下载的数据」），删除只走行操作列【删除】
- **spec**：`tests/smbsn/S14-image-delete.spec.ts` 通过（42.7s；pre=2→post=1，deleteFileInf 200，**返回重进验证 total 持久=postTotal**）
- **wire**：`partner-wire/smbsn/S14-image-delete.json`（15 步：page×2 / popup×1（删除确认，命中 profile popups `match:["删除确认"]`→`.el-message-box`）/ ele×12；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s14.js`（s14-values + rects-wire.json）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S14-image-delete.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，15/15 步，31.9s，0 警告 0 失败**（--headed 回显过）
- **数据现状**：客户管理目录 = **0 个文件**（spec 2→1 + 回放 1→0 消耗完）；**数据消耗型**：重放前须先 S12 补文件

### S15 影像目录检索 —— 全链路 GREEN（2026-09-29）
- **交互形态**（probe70/74）：影像资料 tab 左侧 = 目录搜索框 + 目录树（`filesCtlgManage/listCtlgInf`）；搜索框 = `.file-catalog-container .sidebar-container .leftContent` 内**首个 `input[placeholder=请输入]`**，容器是 **`div.el-input.el-input--small.el-input--prefix`（div 非 span！probe74 实证，首版 span 定位失败）**，xpath `//div[contains(@class,'leftContent')]//input[@placeholder='请输入']`
- **检索行为**：输入「营业执照」→ 树过滤为命中路径（可见节点 15/17→2：客户管理+营业执照）→ 清空 → 树恢复。**只读幂等，不依赖文件数据**
- **树懒渲染坑**：进入 tab 初始可见节点数不稳定（15，渲染未完），搜索周期后为全量 17 → spec 断言用「稳定轮询基线 + 清空后 ≥ 基线且 > 过滤后」，不断言精确相等
- **spec**：`tests/smbsn/S15-catalog-search.spec.ts` 通过（29.6s；full=15 filtered=2 restored=17）
- **wire**：`partner-wire/smbsn/S15-catalog-search.json`（10 步：page×1 / ele×9；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s15.js`（s15-values + rects-wire.json）
  - 清空步 = 同 xpath `input` 事件 objectValue=''（引擎 InputAction `fill('')`）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S15-catalog-search.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
   - 结果 **PASS 1/1，10/10 步，20.5s，0 警告 0 失败**（--headed 回显过）

 ### 其他信息 tab 分析 + 交易拆分（2026-09-29，probe77/78/79/80/81/82b/83/84/85）
 - **tab 结构**：3 折叠段（右侧目录）：① 维护客户管理团队【新增/删除】 ② 查看历史修改记录（无按钮） ③ 查看登记信息（无按钮）
 - **① 客户管理团队**：表格（Radio/管理类型/管理人员编号/管理人员名称/管理人员所属机构），API `custPermision/findCustTeam {cstNo,pageNum,pageSize}` tab 打开自动加载；**9 个存量客户（基线+8 个 AT_* 草稿）全部 = 1 行「管户权 701994 黄某某」**
   - **新增**（probe78/79/80/81）：dialog（管理类型 dis-select **固定「业务权」** + 管理人员名称/编号/所属机构/联系电话 全 dis，引入后自动回填）→【引入】= **系统用户放大镜**（用户名称/用户编号 查询，total=92，13+ 机构，API `usermg/userAndOrgRel/selector` req `{pageNum,pageSize,usrNm,usrNo}`）→ 选行【确认】回填（含联系电话）→【确定】→ save API
     - **后端规则（80/81 实证）**：「**同一个农合机构下，只能有一个客户经理**」（BizException；save 返回 code:100，**无 message-box 无 toast，新增 dialog 保持打开**）→ 凡已有团队行的客户（=全部）新增必被拒；用户机构不同也会被拒（机构=客户法人维度）
   - **删除**（probe78/84）：选行 radio →【删除】（未选行 toast「请选择有效数据」）→ message-box「您确定删除这条记录吗?」（locale 漂移：中文「确定」↔ 英文 OK；首个空文本按钮=headerbtn 关闭钮）→ 确认
     - **前端 checkDel 守卫（84 实证）**：管户权行返回 false → **框关闭但零 API、数据不变**（console「调用checkDel结果为false」，静默拦截）
   - → **新增/删除对存量客户双重封锁（后端一客户经理规则 + 前端 checkDel 禁删管户权），不可执行 → 不可录**（同 S4 挂起性质；无空团队客户可做往返，业务权行创建不出来）
 - **② 查看历史修改记录**（probe77）：只读表格（客户编号/被修改的信息项/修改日期/修改前的值/修改后的值/修改人名称/修改人编号），API `ICstTradeMdfHistApi/page {cstNo,pageNum,pageSize}` tab 打开自动加载；**基线客户 total=297**（10/页有分页），牺牲客户=0 行 → 唯一交互 = **分页翻页**
 - **③ 查看登记信息**（probe77/85）：只读表单（登记人名称/登记机构/登记日期/更新人/更新机构/更新日期/**日期**，7 项全 disabled；「日期」= 当天数据日期 2026-09-29，纯展示无 API）；API `custPersonal/getRegistInfo {cstNo}` 自动加载 → **无操作，不独立成交易**
 - **业务信息 tab（顺带，probe77）**：客户评级信息 0 行 + 限额与额度信息 0 行 +【明细】（需选中行）→ 无数据，不可录
 - **交易拆分**：
   - **S16 其他信息-查看客户历史修改记录（只读+分页）**：查询列表→选行→修改→其他信息 tab→断言三段加载（团队 1 行 / 历史 total=297 / 登记信息 7 项）→ 历史分页点第 2 页 → 断言第 2 页数据 → 返回；数据依赖基线客户（297 条历史）
   - 团队-新增 / 团队-删除：**不录**（双重封锁，见上）
   - 登记信息 / 业务信息：**无操作不录**（登记信息断言并入 S16）

 ### S16 其他信息-查看历史修改记录 —— 全链路 GREEN（2026-09-29）
 - **交互形态**：其他信息 tab 打开自动加载三段 API（`custPermision/findCustTeam` 团队 / `ICstTradeMdfHistApi/page` 历史 / `custPersonal/getRegistInfo` 登记信息）；历史表 10 行/页（基线 total=297，30 页），唯一交互=分页
 - **分页定位**：折叠项作用域 xpath `//div[contains(@class,'el-collapse-item')][.//div[contains(@class,'el-collapse-item__header')][contains(.,'查看历史修改记录')]]//li[contains(@class,'number') and normalize-space(.)='N']`——团队表 1 行无「2」页码，作用域内唯一；**rect 须先 scrollIntoViewIfNeeded**（分页初始在 900 视口下方，y>1）
 - **spec**：`tests/smbsn/S16-other-info-history.spec.ts` 通过（45.1s；团队 1 行 / 历史 total=297 / 登记信息 7 项 / 第 2 页 pageNum=2 首行≠第 1 页 / 回第 1 页首行恢复 / 重进 297 不变）
 - **wire**：`partner-wire/smbsn/S16-other-info-history.json`（10 步：page×2 / ele×8；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s16.js`
 - **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S16-other-info-history.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
   - 结果 **PASS 1/1，10/10 步，25.2s，0 警告 0 失败**（--headed 回显过）
  - **坑**：spec 初版 rectEval 的 y2 误写 /1440（应 /900）→ page2Rect y=1.03 出界，已修；引擎点击纯 xpath+自动滚动，rect 仅元数据

 ### 列表页未录入口分析 + 交易拆分（2026-09-29，probe86/87b/88/89）
 列表页工具栏全量 = 查询/重置/caret 展开 + **新增/修改/查看/联网核查信息/法院信息**（前两个已录于 S1/S2）；查询表单 = 客户编号/客户名称/证件类型 + caret 展开 3 字段（证件号码/管户客户经理/客户状态）。**4 个未录入口全部探明**：
 - **查看**（probe87b）：选行→【查看】→**场景页 view 模式**（同 mdfSmbsnCst 路由，URL `viewType=look`，编辑态是 `viewType=edit`）；6 tab/5 段全在；**按钮只剩【返回】**（无 引入/保存/暂存，不可持久化）；字段 input 均无 is-disabled（白底，但无保存入口）；API `custTrade/getCustTrade`×2 + `getRatingResult` + `ipcFcnScnInf/hit`
 - **联网核查信息**（probe87b/88/89）：选行→无标题 `.el-dialog`（dialog512 动态）；查询表单 核查时间(input)/核查结果(dis-select) + 工具栏【查询/重置/发起实时核查/查看详情】+ 表格 7 列（首列 Radio/核查时间/客户编号/客户名称/证件类型/证件号码/核查结果/核查结果信息）+【取消/确认】；API `custCorporatNetworkCheckBasic/page {cstNo,pageNum,pageSize,createTime,inspRsltId}`；基线 7 行「核查通过/要素核查匹配正确」（S7+回放累积）
   - **查看详情**：表格行 Radio 选中后【查看详情】→ 子 `.el-dialog`（dialog335 动态）**50 项只读**（核查时间/客户名称/客户编号/证件号码/发起清算行/核查结果信息/股东出资信息统计/…/业务拒绝码/创建时间 等）按钮仅【返回】；API `custCorporatNetworkCheckBasic/get {id}`
   - **发起实时核查**：【发起实时核查】→ message-box「**您确定发起[实时]联网核查吗?**」（Cancel/OK，locale 漂移同删除框）→OK→ `custCorporat/networkCheck {cstNo,cstNm,uscc,crdtTp,crdtNo,ntwrkgInsp:'1',id:null,chkTp:'1'}` 200（`{rslt:'1',inspRstinf:'要素核查匹配正确'}`，**约 7.5s**，无 toast/notification）→ 重新【查询】后 **行 +1**（首行=当天时间戳+证件类型/号码补齐）；**数据增长型**
 - **法院信息**（probe87b/88）：选行→无标题 `.el-dialog`（dialog140 动态）；查询表单 法院信息类型(select: **涉诉/失信被执行/限制消费被执行**)/是否有效(**tssc-multi-select 多选**，同高管类别) +【查询/重置】+ 表格 7 列（首列 Radio/法院信息类型/客户编号/客户名称/证件号码/是否存在法院信息/登记人/登记日期）+【取消】（无确认）；API `custCourtInfApi/page {cstNo,cstNm,crdtNo,pageNum,pageSize,courtInfTp,vldInd}`；基线 **1 行**（涉诉/是/701994/2026-09-24）
 - **高级查询**（probe86/87b/89）：查询区 caret 图标按钮（`el-icon-caret-bottom`↔`caret-top`）展开 3 字段；客户状态选项 信贷正式客户/草稿客户 → 请求 `cstSt`（**1=信贷正式客户，6=草稿**）；管户客户经理=用户 select（同 92 用户池）
 - **拆分**：S17 查看 / S18 联网核查-查看 / S19 联网核查-查看详情 / S20 联网核查-发起实时核查（数据增长型）/ S21 法院信息-查看 / S22 高级查询 —— 用户确认**全录 6 笔**
  - **wire 注意**：无标题 dialog 用**内容锚定 xpath** 区分（核查 dialog 含 `button[.='发起实时核查']`、详情 dialog 含 `label[.='核查结果信息']`、法院 dialog 含 `label[.='法院信息类型']`）；profile popups 已有 联网核查/查看详情/法院信息→.el-dialog；S20 确认框需补 profile `{match:["核查确认"],selector:".el-message-box"}`（否则 fallback 命中已开的 .el-dialog 立即通过）；**禁用「断言N行」**（多表格页面 tableRowSelector 全局计数不可靠，行数断言放 spec）

### S17 列表页-查看 —— 全链路 GREEN（2026-09-29）
- **交互形态**：列表选行→【查看】→**场景页 view 模式**（同 mdfSmbsnCst 路由，URL `viewType=look`）；6 tab/5 段全在；**按钮只剩【返回】**（无 引入/保存/暂存，字段虽可显示但无保存入口）；API `getCustTrade`×2 + `getRatingResult` + `ipcFcnScnInf/hit`
- **spec**：`tests/smbsn/S17-view.spec.ts` 通过（16.2s；场景按钮=仅【返回】断言 + 6 tab 断言 + 返回反查 total=1）
- **wire**：`partner-wire/smbsn/S17-view.json`（7 步：page×2 / ele×5；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s17.js`（s17-values + s16.listNoRect + rects-wire.json）
- **replay**：`node replay-skill/replay.mjs partner-wire/smbsn/S17-view.json --profile replay-skill/profiles/explore-cst-smbsn.json --headed`
  - 结果 **PASS 1/1，7/7 步，16.6s，0 警告 0 失败**（--headed 回显过）
- **数据依赖**：无（只读幂等，可任意重放）

### S18 联网核查信息-查看 —— 全链路 GREEN（2026-09-29）
- **交互形态**：列表选行→【联网核查信息】→无标题 dialog（锚 `button[.='发起实时核查']`）；查询表单 核查时间(input)/核查结果(**tssc-multi-select** 多选：核查通过/核查不通过 → `inspRsltId` "1"/"2")；表格 7 列（首列 Radio/核查时间/客户编号/客户名称/证件类型/证件号码/核查结果/核查结果信息）；API `custCorporatNetworkCheckBasic/page {cstNo,createTime,inspRsltId,pageNum,pageSize}`
- **坑**：① dialog xpath 用 `contains(@class,'el-dialog')` 会误匹配 `el-dialog__wrapper/__body`（strict 3 命中）→ spec 用 `//div[@role='dialog'][.//button[normalize-space()='发起实时核查']]`；② **表格行异步加载**：点查询后须 `waitForResponse(PAGE_API)` + 首行 waitFor 再断言行数（否则 count=0）；③ **tssc-multi-select 下拉打开有延迟**：`.el-select-dropdown:visible` 立查为 false → 用 `.el-select-dropdown` filter(hasText='核查通过').last() + waitFor visible（自定义 dropdown class 带随机后缀 custom-select-dropdownNNN）
- **spec**：`tests/smbsn/S18-netcheck-view.spec.ts` 通过（15.7s；选 核查结果=核查通过 后 `body.inspRsltId='1'` 断言 + 行 7 列断言 + 取消关闭）
- **wire**：`partner-wire/smbsn/S18-netcheck-view.json`（10 步：page×2 / popup×1 / ele×7；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s18.js`
  - profile popups 更新为**内容锚定 CSS**：`{match:["联网核查"],selector:".el-dialog:has(button:has-text('发起实时核查'))"}`（PopupExecutor `waitForVisible` 按 visible 过滤，支持 :has 锚定）
- **replay**：结果 **PASS 1/1，10/10 步，23.6s，0 警告 0 失败**（--headed）
- **数据依赖**：无（只读幂等）

### S19 联网核查信息-查看详情 —— 全链路 GREEN（2026-09-29）
- **交互形态**：核查 dialog 内表格首行 Radio→【查看详情】→子 dialog（锚 `label[.='核查结果信息']`）**50 项只读**（核查时间/客户名称/…/业务拒绝码/创建时间 等，业务状态=621）按钮仅【返回】；API `custCorporatNetworkCheckBasic/get {id}`
- **坑**：行 innerText 首格（radio 列）带前导空格 → split 错位，先 `.trim()`
- **spec**：`tests/smbsn/S19-netcheck-detail.spec.ts` 通过（13.5s；50 项 label 计数 + 返回关详情 + 取消关核查 dialog）
- **wire**：`partner-wire/smbsn/S19-netcheck-detail.json`（11 步：page×2 / popup×2 / ele×7；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s19.js`
  - profile popups 增 `{match:["查看详情"],selector:".el-dialog:has(label:has-text('核查结果信息'))"}`
- **replay**：结果 **PASS 1/1，11/11 步，23.4s，0 警告 0 失败**（--headed）
- **数据依赖**：核查表须 ≥1 行（基线客户多行，只读不消耗）

### S20 联网核查信息-发起实时核查 —— 全链路 GREEN（2026-09-29）
- **交互形态**：核查 dialog【发起实时核查】→ message-box「**您确定发起[实时]联网核查吗?**」→ OK → `custCorporat/networkCheck {cstNo,cstNm,uscc,crdtTp,crdtNo,ntwrkgInsp:'1',id:null,chkTp:'1'}` ~5-8s 200（`{rslt:'1',inspRstinf:'要素核查匹配正确'}`）→ 重新【查询】后**行 +1**（首行=当天时间戳）
- **坑**：① message-box 按钮 textContent 带换行缩进（`"\n          OK\n        "`）→ anchored 正则失配，必须 normalize-space xpath；② **locale 漂移实锤**：S20 wire 首跑确认框按钮=「取消/确定」中文（截图 `S20-netcheck-run_08_发起核查确认框.png`），此前 S5/S14 实测过英文 Cancel/OK → **wire 确认步一律双语 xpath**：`//div[contains(@class,'el-message-box')]//button[normalize-space()='OK' or normalize-space()='确定']`（S5 生成器已同步升级）
- **spec**：`tests/smbsn/S20-netcheck-run.spec.ts` 通过（19.7s；rowsBefore=7→OK→networkCheck 200 rslt=1→重查 rowsAfter=8 且首行为当天）
- **wire**：`partner-wire/smbsn/S20-netcheck-run.json`（11 步：page×2 / popup×2(核查dialog+核查确认message-box) / ele×7；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s20.js`
  - profile popups 增 `{match:["核查确认"],selector:".el-message-box"}`
- **replay**：结果 **PASS 1/1，11/11 步，24.9s，0 警告 0 失败**（--headed；双语 xpath 修复后）
- **数据增长型**：每回放核查表 +1 行（基线 7 → spec 后 8 → 回放后 9）

### S21 法院信息-查看 —— 全链路 GREEN（2026-09-29）
- **交互形态**：列表选行→【法院信息】→无标题 dialog（锚 `label[.='法院信息类型']`）；查询表单 法院信息类型(select: **涉诉/失信被执行/限制消费被执行** → `courtInfTp` "1"/…)/是否有效(**tssc-multi-select 多选**)；表格 7 列（首列 Radio/法院信息类型/客户编号/客户名称/证件号码/是否存在法院信息/登记人/登记日期）；API `custCourtInfApi/page {cstNo,crdtNo,courtInfTp,vldInd,pageNum,pageSize}`；按钮 查询/重置/**取消（无确认）**
- **基线**：1 行 涉诉|260924144929974126|AT_SMB_20260924144917|914501005QBUAEFCJ8|是|701994|2026-09-24
- **spec**：`tests/smbsn/S21-court-view.spec.ts` 通过（15.5s；选 法院信息类型=涉诉 后 `body.courtInfTp='1'` 断言 + 行 7 列断言 + 取消关闭）
- **wire**：`partner-wire/smbsn/S21-court-view.json`（10 步：page×2 / popup×1 / ele×7；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s21.js`
  - profile popups 增 `{match:["法院信息"],selector:".el-dialog:has(label:has-text('法院信息类型'))"}`
- **replay**：结果 **PASS 1/1，10/10 步，23.7s，0 警告 0 失败**（--headed）
- **数据依赖**：无（只读幂等；法院表行数依赖平台存量，查询断言不锁定行数）

### S22 列表页-高级查询 —— 全链路 GREEN（2026-09-29）
- **交互形态**：查询区 **caret 图标独立 `<button>`**（含 `i.el-icon-caret-bottom`↔展开后 `caret-top`；注意 `.first()` 会误中证件类型 select 的箭头 → 必须 `button:has(i.el-icon-caret-bottom)`）展开 3 字段：证件号码/管户客户经理/客户状态；查询 body 增 `crdtNo`/`usrNo`/`cstSt`（**客户状态：1=信贷正式客户，6=草稿客户**）；管户客户经理=用户 select（92 用户池，选项 NS0109/YG0002/YG0002/YG0001/YH1900）
- **坑**：`findCustTradeList` 响应行数组键 = **`data.list`**（PageHelper 全套字段 total/list/pageNum/…），非 records/rows
- **spec**：`tests/smbsn/S22-advanced-query.spec.ts` 通过（15.8s；展开→填 客户编号+证件号码+客户状态=草稿客户→查询 body 断言（cstSt=6,crdtNo）+ total=1 + `data.list[0].cstNo==基准`→重置→caret 收起；管户客户经理只读选项不选）
- **wire**：`partner-wire/smbsn/S22-advanced-query.json`（8 步：page×1 / ele×7；`CHECK dup=0 badPID=0 noRect=0`）；生成器 `work/smbsn/gen-wire-s22.js`
  - caret 展开/收起 xpath `//button[.//i[contains(@class,'el-icon-caret-bottom'/'-top')]]`；收起步复用展开 rect（按钮位置不变仅图标换）
- **replay**：结果 **PASS 1/1，8/8 步，20.2s，0 警告 0 失败**（--headed）
- **数据依赖**：无（查询/重置幂等，可任意重放）

### 列表页 6 笔小结（2026-09-29）
- **交付**：S17(7步) / S18(10步) / S19(11步) / S20(11步) / S21(10步) / S22(8步) 全部 spec 绿 + wire 生成 + 有头回放 PASS；smbsn 模块 **21 笔交付**（S1-S22 除 S4 外全部录完）
- **profile 累计更新**：popups 增 核查确认(.el-message-box)；联网核查/查看详情/法院信息 3 条改**内容锚定 CSS**（:has(button/label)）
- **通用教训**（已同步 SKILL.md）：message-box 确认按钮 locale 漂移 → 双语 xpath；dialog 锚定防 `el-dialog__wrapper/__body` 子串误匹配（spec 用 @role='dialog'，wire 内容锚定 xpath 末端唯一元素仍可用 contains）；tssc-multi-select 下拉延迟等待；dialog 表格行异步加载先等 API；引擎 PopupExecutor 支持 :has 内容锚定选择器

### S1 重跑 + 登录页改版修复（2026-09-30）
- **背景**：用户指令「s1 回放」。首跑 FAIL——回放被重定向到登录页，引擎自动登录卡在「waiting for 登录按钮」30s 超时
- **登录页改版实锤**（probe_login.js / test_login.js）：
  - 登录按钮 **DOM 文本 =「登 录」（带空格）** → 引擎 `PlatformLogin.js` 的 `hasText:'登录'` 精确子串匹配不到（`refresh-auth.mjs` 早已用 `/登\s*录/` 正则，仅引擎侧漏改）
  - **新增「请输入手机验证码 + 发送验证码」SMS 字段，但非强制**：只填账号/密码/图形验证码即可登录成功（实测直达 `/#/home`）；切勿点「发送验证码」（触发真实短信）；图形验证码本环境仍不校验（captcha 图虽动态化但服务端不比对）
  - `refresh-auth.mjs` "会话仍有效" 判定**误报**（SPA 重定向延迟漏判过期）→ 真正兜底是回放引擎自动登录
- **修复**：`replay-skill/src/browser/PlatformLogin.js` 登录按钮改白空格容忍正则 `new RegExp(loginButtonText.trim().split('').join('\\s*'))`（「登录」→`/登\s*录/`，对全部 11 个 profile 向后兼容）
- **端到端验证**：置失效 auth → 跑只读 S17 → 引擎自动登录成功（新态存 `replay-out/auth-refreshed.json`）→ S17 PASS 7/7
- **S1 重跑**：先 `refresh-wire-data.js`（AT_SMB_20260930092212 / USCC 91450100KWQ7LQLXQJ / 机构 91450100Q2H8GK1F7T / 13970132378）+ 有效 auth → `--headed` 回放 **PASS 1/1，89/89 步，115.5s**
- **落库验证**（verify_s1.js）：`findCustTradeList` 按客户名称 AT_SMB_20260930092212 → total=1，cstNo=**260930092649839164**，cstSt=6 草稿，crdtNo=91450100KWQ7LQLXQJ（与刷新后 USCC 一致）

### 列表页 6 笔：分页 / 影像下载 / 图册 / 移动 / 批量下载 + 客户保存（2026-09-30）
- **交付**：S23 列表页分页(7步) / S24 影像下载(10步) / S25 图册查看(11步) / S26 影像移动(12步) / S27 影像批量下载(12步) / S28 客户保存-暂存口径(12步)，全部 spec 绿 + wire 生成 + 有头回放 PASS；smbsn 模块 **27 笔交付**（S1-S28 除 S4 外全部录完）
- **S23 分页**：折叠项作用域 xpath 定位页码 `li`；首末页 disabled；rect 先 `scrollIntoViewIfNeeded`（分页初始在 900 视口下方 y>1）
- **S24 影像下载**：行操作【下载】=`.el-table__fixed-right` 固定列 span（主表 is-hidden / file-card 0×0 双陷阱）；profile `downloadTriggers` 含「下载」→ 引擎 DownloadAction `waitForEvent('download')`+`saveAs`
- **S25 图册查看**：行操作【图册查看】→ 图册弹窗（图片轮播）；只读查看
- **S26 影像移动**：行操作【移动】→「移动目录」dialog（`el-dialog__title` 是 **span** 非 div）目录树平铺 16 顶级节点→选目标节点→`moveCtlg` API(200)→文件从 客户管理 移至 贷后管理；确认=`...//button[normalize-space()='确认选择']`
- **S27 影像批量下载**：表格 header 全选 + 行 checkbox（原生 input 隐藏 0×0，可见可点=`label.el-checkbox` 14×23）；【批量操作】未选 toast「请选择要下载的数据」；选中→后端 `download`/文件×N→前端合成**单个 zip blob**（时间戳名）；profile `downloadTriggers` 增「批量操作」；**Playwright 下载无需 `grantPermissions(['downloads'])`**（会报 Unknown permission）
- **S28 客户保存（暂存口径）**：
  - **正式保存【保存】按钮本环境 no-op**（干净/脏表单/暂存后均不触发任何 API/跳转/toast），列表页亦无 提交/正式/生效 替代入口；所有客户均草稿 cstSt=6
  - 唯一可用保存=**【暂存】**→ `saveCustTrade`(prsvInd=0, cstSt 保持 6)；`disableBtn` class 是 red herring（暂存/返回/保存 均带该类但实际可点）
  - 本笔=单字段最小保存（改 客户简称），区别于 S2 的 40+ 明文项全改
  - **踩坑**：改字段后点【暂存】须 `Tab` 失焦 + 等 **2500ms**（1000ms 时 Vue dirty-flag 未注册→暂存 no-op 不触发 saveCustTrade）
- **S29 装订成册 — ⛔ blocked（功能本环境未启用，不录）**：
  - 影像资料 tab 工具栏【装订成册】按钮（`el-button--text el-button--small`）**enabled 且可点**，但点击（无论是否先全选文件）→ **零 API/零弹窗/零 toast/零下载/零 console**（18s 全网络监控 + 点击落点验证，按钮 class 无 pressed 态变化）
  - 与 S28 正式保存【保存】同性质：按钮存在可点但**功能未接线**（疑后台服务/feature-flag 测试环境未启用）；影像资料工具栏无其他装订入口
  - 结论：S29 不可录，smbsn 模块收尾
- **smbsn 收尾（2026-09-30）**：**27 笔交付**（S1-S28 除 S4）；**S4**（股东修改，后端「注册资本不能为空」挡）与 **S29**（装订成册 no-op）因环境/后端限制不可录；其余全部 spec 绿 + wire + 有头回放 PASS
