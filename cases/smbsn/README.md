# smbsn — 同业客户管理（最完整的一包）

| 项 | 值 |
|---|---|
| 来源 | `partner-wire/smbsn` + `work/smbsn` |
| wire | 28 笔（S1–S28，覆盖新增/修改/股东/关联人/影像/联网核查/法院/高级查询/分页/图册/批量下载） |
| 脚本 | `scripts/gen-wire-s*.js` 28 个生成器 + `scripts/probe_*.js` 页面探路 + `verify_* / cleanup_img / check_cust` |
| 数据 | `data/s*-values.json`（填入值）、`data/s*-plan.json`（填充计划）、`data/filllog-*.json`（填充记录） |

## 验收基线（`report/replay-report.json`）

`total=1 pass=1 warn=0 fail=0` —— **只覆盖 S11**。

> 其余 27 笔的回放记录未随本批次保留。完整 case 脚本在 `tests/smbsn/S*.spec.ts`，需要自行准备批次后跑，跑通标准同样是 `fail=0`。

## 复跑

```bash
node replay-skill/replay.mjs cases/smbsn/wire/S11-related-party-delete.json \
  --profile replay-skill/profiles/explore-cst-smbsn.json --auth auth.json --out ./out/S11
```

## 前置数据与清理（关键）

- **影像类**（S12–S15、S24–S27）：每跑一次就多一批影像记录，重复回放前用 `scripts/cleanup_img.js` 清理，否则行数断言会失败
- **股东 / 关联人**（S3–S11）：依赖某个已存在的同业客户，新增后要删除才能净零
- **联网核查**（S18–S20）、**法院信息**（S21）：只做查看/发起，不改变客户主数据

平台事实、组件结构、API 与坑位见 `.opencode/skills/tansun-recorder/SKILL.md` 的"模块一 smbsn"章节。
