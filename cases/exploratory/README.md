# exploratory — 平台框架层探路（登录 / 工作台 / 待办 / 客户总览）

| 项 | 值 |
|---|---|
| 来源 | `work/exploratory/modules`（2026-09 首次探路） |
| wire | 6 笔：W01 工作台作业入口查询 / W02 待办任务（主键搜索+流程跟踪+树过滤+转交）/ P01 集群客户 / P02 总集团客户 / P03 集团客户 / P04 同业客户 |
| 登录 | `login/steps.md`（登录步骤）、`login/SUMMARY.md`、`login/elements.json`（登录页元素） |
| 工具 | `scripts/element_walk.js`（DOM 遍历）、`netwatch.js`（网络监听）、`page_probe.js`（页面探针） |

## 验收基线（`report/`）

| case | 结果 |
|---|---|
| W01 工作台 | pass 1/1 |
| W02 待办任务 | pass 1/1 |
| P01 集群客户 | warn 1/1（已知服务端缺陷：导入模板 0 字节） |
| P02 总集团客户 | pass 1/1 |
| P03 集团客户 | pass 1/1 |
| P04 同业客户 | pass 1/1 |

## 为什么单独一包

这 6 笔是**平台框架本身的探路**（登录、菜单、列表、待办、流程跟踪、树选择），不是某个业务模块的原子交易。任何新模块开始录制前，先跑通这里的 W01/W02，能确认：登录态可用、路由可达、列表 API 正常、弹窗/抽屉选择器没变。

## 复跑

```bash
node replay-skill/replay.mjs cases/exploratory/wire/01-workbench/W01-作业入口查询.json \
  --profile replay-skill/profiles/explore-workbench.json --auth auth.json --out ./out/W01
```

## 注意

- 这一批的 profile 与业务模块不同：`explore-workbench.json`、`explore-tasks.json`、`explore-cst-*.json`
- `login/` 里的元素清单只描述登录页结构，**不含账号密码**
