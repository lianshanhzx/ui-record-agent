---
name: atp-v3-push
description: 将已录制的 partner wire 转换为天阳 ATP 自动化平台 V3 报文，上传截图、按用户指定的项目 ID 和系统 ID 推送，并反查交易及节点字段。用于复用已验证录制结果或排查 ATP importDemand 导入；不负责重新录制业务操作。
---

# ATP V3 报文生成与推送

处理已录制的 wire 文件或包含 wire 的目录。保持源文件不变，生成独立报文、上传清单、请求回执和逐节点核验报告。

## 输入与入口

使用本 skill 的 `scripts/atp-v3.mjs`，需要 Node.js 20+，无第三方依赖。执行路径按本 skill 的实际安装位置展开，不依赖当前仓库。

用户需提供报文路径、目标项目 ID 和系统 ID；实际推送另需 access_token。平台地址默认 `http://test.atp.tansun.com.cn/`，用户未提起时直接使用默认设置，不追问地址；用户明确传入其他地址时使用 --platform 覆盖。系统/项目 ID 没有默认值，不沿用历史任务的 ID。用户只要求生成时运行 prepare；用户要求推送时可继续上传、推送和核验，无需重复确认同一已授权操作。

```powershell
node <skill目录>/scripts/atp-v3.mjs prepare --input <wire文件或目录> --out <输出目录> --project-id <项目ID> --system-id <系统ID>
node <skill目录>/scripts/atp-v3.mjs upload --out <同一输出目录> --token-file <用户提供的凭据文件>
node <skill目录>/scripts/atp-v3.mjs push --out <同一输出目录> --token-file <用户提供的凭据文件>
node <skill目录>/scripts/atp-v3.mjs verify --out <同一输出目录> --token-file <用户提供的凭据文件>
```

认证也支持进程环境变量 `ATP_ACCESS_TOKEN`。不要把 token 写入 skill、配置、回执或最终答复；不删除用户提供的凭据文件。若为本任务创建临时凭据文件，在任务结束后清理。网络沙箱限制按运行环境申请必要的网络权限，不以更换工具规避审批。

## 工作流

1. 确认源录制验证结果和用户任务范围。缺少录制验证时明确说明，不能将平台导入成功替代业务回放成功。
2. prepare 必须显式接收 project-id、system-id；省略 --platform 时使用默认平台，也支持 --platform <其他平台地址>。prepare 仅离线生成，不调用网络。后续 upload/push/verify 沿用该输出目录中已确定的平台地址。目录只读取顶层符合 envelope 的 JSON；脚本保留源文件 SHA-256 和导入标识。`preflight.json` 有 blockers 时先解决数据问题。
3. 本地页面/弹窗截图需上传或映射为可访问 URL；缺少弹窗 rect 时查看源截图，提供完整截图上的归一化矩形。附加配置和契约差异见 [references/contract.md](references/contract.md)。不要套用某个业务弹窗的固定坐标。
4. upload 使用 `/api/common/upload`，保存并检查截图 URL，再生成最终 payload。已有永久截图 URL 可直接配置，避免重复上传。
5. push 检查目标项目/系统和已有同名交易，提交一次。请求开始前落盘标记；超时、业务失败或部分写入都不会自动重试。失败后仍反查；结合回执按实际交易 ID 决定恢复方式，不能照搬历史任务中的修改、删除脚本。
6. verify 比较交易框架、节点数量、名称、定位、输入值、事件、顺序、父子关联、矩形、截图和 options。报告区分结构/动作一致、全部字段一致、平台执行验证；下拉 options 返回 null 仍算完整字段验证失败。

## 结果说明

交付 payload.json、preflight.json、receipts.json 和 verification.json，列出目标项目/系统、实际交易 ID、节点数量和剩余差异。本 skill 不自动修改已有交易、不清理远端记录、不配置或启动执行计划。

使用示例：“用 $atp-v3-push 将这批查询报文推送到 http://test.atp.tansun.com.cn/，项目 ID 123，系统 ID 456；先验证结果，再继续其他功能。”
