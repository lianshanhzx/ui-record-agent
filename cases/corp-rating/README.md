# corp-rating — 对公客户评级（唯一全绿的一包）

| 项 | 值 |
|---|---|
| 来源 | `partner-wire/corp-rating-full-20261019` + `work/corp-rating-full-20261019`（2026-10-19） |
| wire | 72 笔（M01–M28 等） |
| 脚本 | `scripts/*.js`（探路/生成）+ `scripts/probes/PROBE-{approval,submit,tasks}.json` |
| 流程源码 | `scripts/flows/*.mjs`（10 个 `flows-*.mjs` + `common/engine/role-switch`，被 `tests/corp-rating/record.spec.ts` 引用，**已入库**） |
| 盘点基线 | `inventory/` 60 个 `*-inventory.json` |
| 文档 | `docs/README.md`、`docs/plan.md`、`docs/coverage.md`、`docs/credit-wire-guard.md`、`docs/revoke-wire-guard.md`、`docs/profile.json`、`docs/人工确认交易清单.md` |

## 验收基线（`report/`，**全绿**）

| 批次 | total | pass | warn | fail |
|---|---|---|---|---|
| `replay-full` | 61 | 61 | 0 | 0 |
| `replay-branches` | 11 | 11 | 0 | 0 |
| `replay-credit` | 7 | 7 | 0 | 0 |
| `replay-M01-0_1-5_` | 5 | 5 | 0 | 0 |

合计 84 条 pass 记录（部分 case 在多批次中重复）。判定标准：`fail=0` 且 `warn=0`。

## 复跑

```bash
node replay-skill/replay.mjs cases/corp-rating/wire/M01-01.json \
  --profile cases/corp-rating/docs/profile.json --auth auth.json --out ./out/M01-01
```

## 前置数据（这一包最容易"跑不起来"）

1. **同类单守卫**：目标客户已有 `bsnSt ∈ {1 待发起, 2 在途}` 的评级流程时，建单接口直接返回
   `code=100 BizException「该客户已发起评级流程」`，并弹「异常信息」框（**UI 不可删**，但 `deleteBsnInf {id}` 软删可清）。
   建单前先确认宿主客户无在途单，或跑清理。
2. **流程提交前置**：step4「流程提交」要求先有系统评级结论 + 客户综合评价，否则**静默 no-op**（无 dialog、无通知、`bsnSt` 不变）。
3. **征信节**：上传授权书 / 获取征信报告在本环境是 **NO-OP**（零网络请求），只做弱烟测，别指望断言状态变化。
4. **日期**：服务器系统日与客户端可能偏移，授权日期用固定过去日、证件到期日用固定未来日，别用"今天"。

细节见 `.opencode/skills/tansun-recorder/SKILL.md` 的"模块四 cpctRtg / 模块三 grpRtg"章节。

## 已知边界

- `work/` 下的 `replay-*/shots`、`atp-project13-system1026`（ATP 平台交付包）未入库
- `scripts/flows/` 里的流程代码依赖 `work/corp-rating-full-20261019/` 中的 `profile.json`、`fixture-*.json`（批次数据，不入库）；缺批次时只能读代码，不能直接跑 `tests/corp-rating/record.spec.ts`
- 批次目录可用环境变量改指向：`RATING_OUT` / `RATING_WIRES`
- `grpRtg`（集团评级）与 `cpctRtg` L01–L10 的探路资产（`scan-lib.js`、`probe_*`）在本工作副本中**已不存在**，无法随仓库提供
