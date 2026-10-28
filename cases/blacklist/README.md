# blacklist — 黑名单管理

| 项 | 值 |
|---|---|
| 来源 | `partner-wire/`（2026-09-21 录制） |
| wire | 8 笔：T1 查询 / T2 新增对私 / T2b 新增对公 / T2c 新增同业 / T3 修改 / T4 查看 / T5 删除 / T6 下载模板 |
| 脚本 | 无（早期手工录制，未沉淀生成脚本） |

## 验收基线（`report/replay-report.json`）

`total=8 pass=3 warn=5 fail=0`

5 个 warn 全部来自**非逻辑原因**，复现时预期一致：

| case | warn 原因 |
|---|---|
| T2 / T2b / T2c / T3 | 保存后页面「未自然跳转」（报文未录导航动作），引擎点击「返回」自愈 |
| T6 | 已知服务端缺陷：下载模板 0 字节（接口与文件名契约正常） |

## 复跑

```bash
node replay-skill/replay.mjs cases/blacklist/wire/T1-query.json \
  --profile replay-skill/profiles/tansun-credit.json --auth auth.json --out ./out/T1
```

## 注意

- 新增类 case（T2 系列）每跑一次会**新增一条黑名单记录**，重复回放需先处理上一轮数据；删除类 case 用的是当轮新增的记录
- 平台路由与接口见 `knowledge/notes.md`、`knowledge/apis.md`
