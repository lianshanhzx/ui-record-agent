# private — 对私客户管理

| 项 | 值 |
|---|---|
| 来源 | `partner-wire/private` |
| wire | 9 笔：P1 列表查询 / P2 重置 / P3 新增保存校验 / P4 新增潜客 / P5 潜在转正式 / P6 修改 / P7 查看只读 / P8 法院信息 / P9 影像资料 |
| 脚本 | 无独立脚本；填充引擎在 `tests/private/fillEngine.ts`、`idgen.ts`、`privateListFields.ts` |

## 验收基线（`report/replay-report.json`）

`total=9 pass=8 warn=1 fail=0`

唯一 warn：`P5-new-formal` 保存后页面「未自然跳转」，引擎**自愈直达路由**后断言通过 —— 属预期行为，不是失败。

## 复跑

```bash
node replay-skill/replay.mjs cases/private/wire/P1-list-query.json \
  --profile replay-skill/profiles/tansun-credit-private.json --auth auth.json --out ./out/P1
```

## 前置数据

- P3 是**负向用例**（故意触发保存校验），断言的是校验文案，不产生数据
- P4 → P5 是链式：潜客新增后转正式，重复回放前需清理上轮潜客
- P9 影像类：每跑一次多一批影像记录，需先清理
- 客户编号由 `tests/private/idgen.ts` 生成，避免与既有客户冲突
