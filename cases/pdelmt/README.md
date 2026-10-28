# pdelmt — 产品库管理

| 项 | 值 |
|---|---|
| 来源 | `partner-wire/pdelmt` + `work/pdelmt` |
| wire | 20 笔（B1–B4、L1–L8 等） |
| 脚本 | `scripts/probe_01–29`（页面/树/弹窗/行操作探路）、`gen-wire-*.js`、`make-base-fixture.js`、`cleanup-elmt.js`、`verify-tree.js` |
| 文档 | `docs/`（3 份） |

## 验收基线（`report/replay-report.json`）

`total=8 pass=8 warn=0 fail=0` —— 全绿。

覆盖：L1 产品要素查询 / L2 重置查询 / L3 新增 / L4 修改 / L5 删除 / L6 删除引用拦截 / L7 删除未选行 / L8 修改未选行。

## 复跑

```bash
node replay-skill/replay.mjs cases/pdelmt/wire/B1-basic-view.json \
  --profile replay-skill/profiles/explore-cst-pdelmt.json --auth auth.json --out ./out/B1
```

## 前置数据

- 新增/删除类必须**净零**：新增的分类/产品要删掉，否则下一次跑"新增"会撞唯一性校验
- 删除引用拦截（L6）依赖一个**已被引用的产品**，用 `make-base-fixture.js` 造前置数据
- 树节点断言依赖节点顺序，上移/下移类 case 会改变顺序，跑完要复位

平台事实见 `.opencode/skills/tansun-recorder/SKILL.md` 的"模块二 pdelmt"章节。

## 已知边界

- `work/pdelmt` 下的 `probe_*_out.json`（约 3 MB 的 DOM dump）与 `shots/` 未入库
