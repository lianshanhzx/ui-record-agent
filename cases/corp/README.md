# corp — 对公客户管理（录制工具链最全的一包）

| 项 | 值 |
|---|---|
| 来源 | `partner-wire/corp` + `work/corp-rerecord-20261012`（2026-10-12/13） |
| wire | 122 笔（R01–R185） |
| 报告 | 6 个批次，见下表 |
| 工具链 | `scripts/recorder.cjs`、`session.cjs`、`build-*.cjs`、`prepare-replay.cjs`、`diagnose-wire.mjs` 等 30 个 |
| 录制链 | `scripts/recording-chain/001–034-*.js`（分场景录制/填充脚本） |
| 盘点基线 | `inventory/`：68 个（`*-inventory.json`、`tab-*.json`、`tables-*.json`、`R*-dialog-inventory.json`） |
| 填入值 | `values/r*-values.json` 129 个 |
| 文档 | `docs/README.md`、`docs/atomic-steps.md`（原子步骤 70 KB）、`docs/coverage.md`、`docs/acceptance.json`、`docs/baseline.json`、`docs/delivery-manifest.json`、`docs/profile.json` |

## 验收基线（`report/`，均为历史批次，**非全绿**）

| 批次 | total | pass | warn | fail |
|---|---|---|---|---|
| `replay-main-out` | 83 | 79 | 0 | **4** |
| `replay-extra-out` | 34 | 33 | 0 | **1** |
| `replay-final-out` | 12 | 11 | 0 | **1** |
| `replay-smoke-out` | 11 | 10 | 0 | **1** |
| `replay-repair-out` | 4 | 4 | 0 | 0 |
| `replay-ocr-repair-out` | 3 | 2 | 1 | 0 |

失败与 warn 的具体 case 名都在对应报告里（`results[].errors`）。复现时请**对齐同一批次的数字**，不要拿 83 笔的基线去比对 12 笔的批次。

## 复跑

```bash
# 单笔
node replay-skill/replay.mjs cases/corp/wire/R01.json \
  --profile cases/corp/docs/profile.json --auth auth.json --out ./out/R01

# 整批（对齐 main 批次）
for f in cases/corp/wire/R*.json; do
  node replay-skill/replay.mjs "$f" --profile cases/corp/docs/profile.json --auth auth.json --out "./out/$(basename "$f" .json)"
done
```

> `tests/corp/R*.spec.ts` + `rerecordCase.ts` 就是这套批次的 Playwright 入口，默认从 `work/corp-rerecord-20261012/delivery-input` 取 wire —— 该目录与 `cases/corp/wire` 内容一致（122 份），可把 `CORP_WIRE_DIR` 指到本目录复用。

## 前置数据

- 新增/保存类（R06–R11、R30–R97 等）会创建客户或子实体，**不是净零**，重复回放前需清理由当轮创建的数据（`scripts/016-delete.js`、`scripts/029-readonly-flows.js` 里有删除链）
- 潜在客户 → 正式客户的转换（R10）依赖上一步的潜客记录
- 影像类（R160–R177）依赖前一笔上传的影像

## 已知边界

- 原始录制文件（`R##-recording.json` 6.7 MB）与 `filllog`（1.4 MB）未入库：它们是 `scripts/recording-chain` + `recorder.cjs` 的产物，可重生成
- 原型图（8 张 `prototype-sheet-*.png`）、截图、`replay-summary.json`（874 KB）、`coverage.json`（343 KB）、`requirements.json`（276 KB）等聚合产物未入库
