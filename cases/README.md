# cases — 可复现的录制材料

这个目录解决的问题是：**A 在这里录制成功，B 拿同样的材料也要能录制/回放成功。**

不是"示例展示"，而是**离线材料包 + 验收基线**。每个模块一包：

```
cases/<module>/
  wire/       可直接回放的 wire 报文（replay.mjs 的唯一输入）
  report/     当时的回放报告 —— 这就是"成功"的判定标准
  scripts/    生成 / 探路 / 清理脚本（换页面版本后可重跑）
  inventory/  字段盘点基线（判断页面漂移）
  values/     录制时填入的字段值（复现"相同输入"）
  docs/       plan / README / 验收清单 / profile
```

## 复跑顺序（七个模块通用）

```bash
# 0) 登录态（不入库，每人自备）
npx playwright codegen --save-storage=auth.json http://<host>

# 1) 先跑一个最小 case，确认环境通
node replay-skill/replay.mjs cases/pdelmt/wire/B1-basic-view.json \
  --profile replay-skill/profiles/tansun-credit.json \
  --auth auth.json --out ./out/smoke

# 2) 对比 report/ 里的基线（pass/warn/fail 三元组）
#    一致 → 环境等价，可以整批回放
#    不一致 → 先查 docs 里的"已知坑"，再查页面是否改版

# 3) 整批
for f in cases/<module>/wire/*.json; do
  node replay-skill/replay.mjs "$f" --profile <profile> --auth auth.json --out "./out/$(basename "$f" .json)"
done
```

## 基线数字怎么读

| 现象 | 含义 |
|---|---|
| `fail>0` | 该批次**没有全绿**，见模块 README 的"历史批次"说明，不要当成回归失败 |
| `warn>0` | 大多是页面未自然跳转（引擎自愈）或已知服务端缺陷（如下载模板 0 字节），**不是逻辑错误** |
| `pass+fail+warn < wire 数` | 该模块历史报告只覆盖了部分 case，缺的需自行补批次 |

## 不在本目录里的东西

- **截图**：原始 1025 张 139 MB，未入库；报告里的 `screenshot` 字段是当时文件名，仅作追溯
- **Chrome profile / auth.json**：登录态，绝不入库
- **原始录制文件**（`R##-recording.json`、`filllog`）：体积大且可由 `scripts/` 重新生成

## 前置数据提醒

这个平台的用例对**前置数据状态**敏感，不是"脚本跑起来就行"：

- 残留的待发起/在途单据会**静默阻塞**新建（如评级"同类单守卫"直接抛 `该客户已发起评级流程`）
- 影像类操作依赖前一笔留下的记录，跑第二遍要先用 `scripts/` 里的清理脚本
- 日期类校验与**服务器系统时间**绑定，跨天复跑可能触发"授权日期不得晚于系统日"

具体到每个模块的清理入口，见各模块 README。
