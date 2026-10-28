# 对公客户评级重新录制

本轮以《对公客户评级_模块功能点拆分》中的13模块62功能点为索引。旧本地录制已移出活动目录，并保留在 `work/archive/corp-rating-before-full-rerecord-20261019-1046`。

- `coverage.md`：逐功能点覆盖、实际差异及未完成分支。
- `workflow-order.json`：61笔主流程报文的执行顺序。
- `branch-order.json`：11笔审批补充分支的执行顺序。
- `credit-order.json`：征信等待条件修正后的7笔独立复验，使用新建草稿并在末尾删除。
- `wire-validation.json`：ID、父子层级、坐标和截图检查。
- `result-*.json`、`checks-*.json`、`network-*.json`、`filllog-*.json`、`shots/`：本轮实录证据。
- `replay-full/`、`replay-branches/`、`replay-credit/`：只读回放引擎的独立执行结果及API反查证据；当前报文按SHA256匹配有效证据。
- `final-business-states.json`：本轮测试申请最终状态。已通过、否决和撤销的申请保留为测试证据，删除案例只删除其新建草稿。
- `business-verification.json`：关键接口及业务结果独立反查。
- `delivery-manifest.json`：72份当前wire的SHA256、步数和回放对应关系。

报文在 `partner-wire/corp-rating-full-20261019`。使用1440×900中文视口；审批账号沿用701994的已有客户经理角色。征信上传使用用户提供的测试附件。登录态和含登录配置的profile属于本地执行环境，交付时避免公开。

从项目根目录执行：

```powershell
node work/corp-rating-full-20261019/replay-full.mjs
node work/corp-rating-full-20261019/replay-full.mjs --branches
node work/corp-rating-full-20261019/replay-full.mjs --credit
node work/corp-rating-full-20261019/verify-final.mjs
node work/corp-rating-full-20261019/audit-replay.mjs
node work/corp-rating-full-20261019/build-report.mjs
node work/corp-rating-full-20261019/check-delivery.mjs
```

主流程和补充分支顺序运行，使用相同测试客户时避免并发产生在途冲突。回放从本轮wire创建新申请，动态替换业务号，并限制修改及删除为本次回放新建业务。失败即停，核对现场后可添加 `--resume` 继续。`replay-skill/src` 未修改。

UI回放通过表示报文能重现实际行为；征信报告未生成、模型未变更、第二法人不可用及超时未触发等受限分支仍按覆盖报告列示，不能视为完整业务验收通过。
