# 平台操作笔记

## 环境
- 平台：http://test.creditv5p2.tansun.com.cn/（天阳信贷一站式门户，Vue hash 路由）
- 账号 701994 / 密码 1；登录页只需账号+密码（图形验证码不校验，法人下拉自动选第一项"横州市农村信用合作联社"）
- 登录态：项目根 auth.json（storageState），**会话约 50 分钟过期**，过期后重跑 work/explore/login_auto.js（验证码随便填如 1234）
- 顶部菜单是 hover 展开的 el-menu，但**页面均可用直连路由访问，无需点菜单**

## 页面直连路由（hash 后）
| 页面 | 页面编码 | 路由 |
|---|---|---|
| 黑名单管理（主列表） | ZJJK00098110 | /cstMgt/nmlstMgt/blistMgt/blistMgtPg |
| 个人客户管理 | - | /cstMgt/csinfMnt/prvtCstMgt/idcstMgtPg |
| 对公客户管理 | - | /cstMgt/csinfMnt/cpctMgt/cpctMgtPg |
| 同业客户管理 | - | /cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg |
| 黑名单新增（整页） | - | /cstMgt/nmlstMgt/blistMgt/crtBlist/hostCstmgrCrtBlistInf/FS00004672HostCstmgrCrtBlistInf?avyEcd=UML00066184&fcnScnEcd=FS00004672 |
| 黑名单查看（只读整页） | - | /cstMgt/nmlstMgt/blistMgt/blistInf/hpermUsrEnqrBlistInf/FS00001444HpermUsrEnqrBlistInf?...&viewType=look&avyEcd=UML00005967&fcnScnEcd=FS00001444 |

## 黑名单管理页（主列表）
- 按钮：查询 / 重置 / 新增 / 修改 / 查看 / 删除 / 下载模板 / 导入名单
- 查询条件（对应 custBlack/page 入参）：客户编号 cstNo、客户名称 cstNm、证件号码 crdtNo、证件类型 crdtTp、名单类型 blistTp、认定类型 nmlstAfmTp、拦截等级 intcptGrdId、创建人 createUser、渠道来源 chnlSrcTp、创建日期 createTime、创建机构 createInst、加入原因 jnRsn
- 表格列：客户编号/客户名称/证件类型/证件号码/名单类型/拦截等级/认定类型/加入原因/渠道来源/创建人/创建日期/创建机构
- 代码生成参考截图：work/explore/blacklist_page.png、pvt_customer_page.png、pub_customer_page.png

## 每页/弹窗标准流程（准确性闭环）
1. 进入页面（或弹出弹窗/新页签）→ 全页截图 `work/shots/<页面>-<场景>.png`
2. 视觉分析截图（Read 图片）：确认布局、字段、按钮、表格列
3. 元素探测脚本：dump 表单项（label/input/下拉项）、按钮 outerHTML、表格结构 → 确定稳定定位器
4. 写/更新 Playwright 脚本 → headed 运行验证
5. 弹窗处理：`page.waitForEvent('dialog')` 或等待 `.el-dialog/.el-drawer` 可见 → 再截图分析 → 探测 → 操作
6. 经验沉淀回本文件与 apis.md

定位器经验（本页已验证）：
- el-button 的 getByRole('button', { name }) 中文匹配可能失效 → 用 `page.getByRole('button').filter({ hasText: '查询' })` 或 `button:has(span:text-is("查询"))`
- 按钮文本可能含空格（"取 消"/"确 定"）→ hasText 用不含空格的部分
- 页面微前端懒加载慢 → 先 `waitForResponse(列表API)` 再断言元素
- 表单 input 定位：`.el-form-item` filter hasText=标签名 → locator('input')
- el-message-box 的按钮文案受 i18n 影响（可能显示 OK/Cancel 或 确定/取消），**用类名定位**：`.el-message-box__btns .el-button--primary`（确认）、`.el-button--default`（取消）；提示正文是中文硬编码
- 表格行点选后必须断言 `input[type=radio]` toBeChecked，否则可能未选中（行渲染未稳定时 force-click 会丢）
- 行渲染稳定：API 响应后再 waitForTimeout(500) + 行 visible 断言

## 录制分工
- 智能体：启动 codegen（headed，load-storage auth.json）、生成脚本、回放测试、生成伙伴报文
- 用户：在录制器里按逐步清单操作页面
- 查数据过程不进最终脚本；取数一律走 knowledge/apis.md 中的接口

## 已验证行为
- 重置按钮**只清空输入框，不自动重新查询**；需再点一次查询才恢复全量（T1 已验证）
- **重置后立即点查询可能仍带旧条件**：输入框 DOM 已清空但组件表单状态异步复位（T1 回归实测：重置+查询仍返回 cstNm=厦门 的 2 行）。做法：重置后等 ~1s（或断言查询请求体条件字段为空）再点查询
- el-table 固定列会复制一份 tbody → 行数断言必须用 `.el-table__body-wrapper .el-table__body tbody tr`
- 页面加载等待用 `waitForResponse('.../custBlack/page')`，不要固定 sleep

## T7 导入名单（2026-09-21）
- 导入弹窗组件 `ZJJK00099512`（chunk 375597）：el-dialog 标题"黑名单导入弹窗"，`input[type=file]`（exts xls|xlsx，≤1MB），按钮 选择文件/取消/确认；formData（getParams 传入）随 multipart 一起 append，file 键名 `file`
- 导入 API：`POST /tansun-tcp-app-pc/tansun-tcp-cst/custBlack/importData`（formdata）；成功返回 status 200，失败 code/status=100 + description 带全局/系统流水号与异常栈
- **服务端缺陷**：`static/files/blackTemplate.xlsx` 与 `grayTemplate.xlsx` 均缺失（downloadTemplate 200 但 0 字节；直连 9527 源站也是 SPA index.html）。导入解析的期望列格式无从获得：6 种布局变体（9列/7列表头、标题行、无表头、Sheet 名、.xls BIFF8）+ 已存在客户诊断 → 全部 `CstListsBlackServiceImpl.impr:484 "导入的文件数据为空！"`
- 菜单接口：`POST /prod-api/tansun-tcp-app-pc/tansun-tcp-sys/menu`，树节点字段 `text/url/id/menuList`；潜在风险客户名单管理 = `/cstMgt/nmlstMgt/greyMgt/ptntlRskCslsMgtPg`
- 失败时：异常信息走 `.el-notification`（可点"展开"看异常栈），导入弹窗保持打开；成功时弹 `#tsscMutilDialog` 结果框
- T7 断言策略同 T6：UI 契约（弹窗→选文件→确认→importData 200）+ 对已知环境缺陷做记录不硬失败；拿到真实模板后改 `work/make_import_xlsx.js` 的 HEADERS/ROW 重新生成 import_test.xlsx，同一脚本自动走成功路径（列表 1 行）

## 待办
- [x] T1 查询录制（tests/blacklist/T1-query.spec.ts 已通过；2026-09-21 全量回归 8/8 通过。曾修：重置后查询带旧条件→等 1s 并断言查询体 cstNm 为空；全量行数用下界+轮询断言）
- [x] T2 新增：T2a 对私(王静平) / T2b 对公(杭州云测九一五) / T2c 同业(交通银行厦门分行)
- [x] T3 修改（对公杭州云测九一五）/ T4 查看（王静平只读）/ T5 删除（T2c 同业）
- [x] T6 下载模板（服务端模板缺失，断言 UI 契约）
- [ ] ~~T7 导入名单~~ **用户免录（2026-09-21："导入不用录制了"）**，T7 脚本已删除；探测结论保留在上方 T7 小节备查
- [x] 伙伴报文：8 份全部完成（T1/T2a/T2b/T2c/T3/T4/T5/T6，partner-wire/，check_wire.js 校验通过：ID 无重复、PID 链合法、截图引用齐全；T2 系列 pageId 统一 ZJJK00105226）
- [ ] 伙伴报文 transcId/systemId/projectId 取值（需伙伴平台接口 token）
