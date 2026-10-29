---
name: wire-replay
description: 根据录制的伙伴报文（wire JSON，transcationEventTypeList 格式）一键确定性回放 UI 交易。Use when 用户说"回放/一键回放/replay/跑一下报文/按报文回放/用插件回放"并提供 wire JSON 文件（如 cases/*/wire/*.json、docs/partner/samples/*.json）或目录。纯脚本执行（Playwright），不重写任何业务脚本，产出逐步报告+截图。
---

# Wire 回放（wire-replay）

**图片查看统一规则**：需要理解回放截图、失败截图或对比图片时，所有主模型必须使用 [qwen-record-replay-vision](../qwen-record-replay-vision/SKILL.md)，调用项目 `opencode.json` 中的 `Qwen3.8-27B` 获取文字分析；调用失败时报告，不自行看图或切换模型。纯脚本回放无需额外逐步读图，回放引擎逻辑保持只读。

按录制的报文从头到尾确定性回放。引擎是纯脚本（无模型参与逻辑），模型只负责**一条命令调用 + 结果汇报**，禁止重写/改写回放逻辑。

> 本 skill 只描述用法；回放引擎实现位于仓库根目录 `replay-skill/`（下文记作 `<engine_dir>`），本目录不放引擎代码。

## 用法

```
node <engine_dir>/replay.mjs <wire.json 或 目录> [选项]
```

| 选项 | 说明 |
|---|---|
| `--profile <json>` | 平台配置（默认 `<engine_dir>/profiles/tansun-credit.json`） |
| `--auth <auth.json>` | 登录态 storageState（默认当前目录 `auth.json`；没有则自动登录并刷新。登录态统一放仓库根，后续 `runs/.auth/` 由 P5 迁移接管） |
| `--base <url>` | 覆盖平台地址 |
| `--headed` | 有头浏览器（默认 headless） |
| `--out <dir>` | 输出目录（默认 `<报文目录>/replay-out`） |
| `--only <关键字>` | 只回放文件名/交易名包含关键字的报文 |
| `--strict` | 警告（已知服务端缺陷）也判失败 |
| `--step-timeout <ms>` | 单步元素等待（默认 20000） |
| `--list` | 只列出将回放的交易，不执行 |

## 首次使用（换机器时）

```
cd <engine_dir> && npm run setup
# = npm i playwright && npx playwright install chromium
```

## 结果判定

- 退出码 `0` = 全部通过（WARN 允许）；`1` = 有失败；`2` = 用法/环境错误
- 产物：`<out>/replay-report.json`（逐步结果）、`<out>/shots/`（每步截图，失败步有 `*_FAIL.png`）、`<out>/downloads/`（下载文件）、`<out>/auth-refreshed.json`（刷新后的登录态，可复用作 `--auth`）
- 失败处理：把 report 中 fail 步骤的 `error` + 对应 FAIL 截图反馈给用户，不要自行改引擎逻辑

## 可回放的报文范围（前提）

1. 报文 schema：`transcationEventTypeList[].transcationProperties[]`，节点 `type` ∈ {page, popup, ele}，ele 动作 ∈ {click, input, select:click}，定位 `mothed=By.XPATH`
2. 平台：需有匹配的 `profiles/*.json`（现自带：天阳信贷 test 环境）。换平台/环境 → 换或新增 profile
3. 前端：element-ui 系（el-table/el-select/el-dialog/el-message-box）
4. 数据依赖：目录整体按自然序回放（如 T1→T2a→T2b→T2c→T3→T4→T5→T6），不要单独抽跑有前置依赖的报文

## 平台 profile 字段（换平台时配置）

`baseUrl` / `homeRoute` / `viewport` / `login{username,password,选择器,captchaValue}` /
`pages[{match[], urlPattern, readySelector?, route?}]`（页名关键字→URL 规则；route 有值时未自然跳转可自愈直达）/
`popups[{match[], selector}]` / `backButtonText`（报文漏录导航动作时，引擎先点此按钮返回再直达路由）/
`tableRowSelector` / `tableReadySelector` / `selectDropdownItemSelector` /
`errorToastSelector` / `downloadTriggers[]` / `downloads.knownEmptyFiles[]` / `settleAfterClickMs` / `settleAfterInputMs`
