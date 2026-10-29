# materials/ — 客户资料与需求文档（不入库）

根目录只放**代码、配置、用例**；客户给的文档、截图、压缩包、解析产物统一收在 `materials/`。
整个目录被 `.gitignore` 忽略（体积大 + 客户机密），换机器时需自备。

## 目录结构

```
materials/
├─ requirements/             需求分册 docx（req-doc-record-steps 的输入）
│    A01天阳信贷管理系统-客户管理需求分册【公共功能】.docx
│    A02天阳信贷管理系统-客户管理需求分册【对公客户管理】.docx
│    A03天阳信贷管理系统-客户管理需求分册【集团集群管理】.docx
│    B01天阳信贷管理系统-评级管理需求分册.docx
│    K01天阳信贷管理系统-产品管理需求分册_cleaned.docx
├─ screenshots/              从 docx 抽出的界面原型图（img_000N.png/jpg，142 张）
├─ catalog/                  docx 解析中间产物
│    A01-catalog.json        章节树 + 图片映射（src 指向 materials/screenshots/）
└─ archive/                  压缩包 / 重复打包版
     客户管理+评级管理.zip
```

## 使用约定

| 事项 | 规则 |
|---|---|
| 新需求文档 | 放进 `materials/requirements/`，文件名保持 `<编号>天阳信贷管理系统-<模块>需求分册.docx`（`req-doc-record-steps` 靠文件名识别类型） |
| 文档抽图 | 解析脚本输出到 `materials/screenshots/`，不要散落在根目录的 `assets/` |
| 解析中间产物 | 放 `materials/catalog/`；一次性任务用的分节结果仍放 `work/<任务>/` |
| 压缩包 | 只保留一份在 `materials/archive/`，与 docx 重复的打包版不另存 |
| 入库 | **一律不入库**。`.gitignore` 已包含 `materials/`；老路径 `assets/`、`*.docx`、`*.zip`、`work_catalog_*.json` 作为兜底保留 |

## 不放这里的东西

| 内容 | 正确位置 | 原因 |
|---|---|---|
| `auth.json`（登录态） | 仓库根 | `playwright.config.ts` 与回放引擎默认读根目录；已在 `.gitignore` |
| `opencode.json`（模型 apiKey） | 仓库根 | `qwen-record-replay-vision` 脚本按根目录定位 |
| 回放截图 / 报告 | `work/`（后续 `runs/`） | 属生成物，可重跑 |
| 平台接口笔记 | `docs/platform/` | 人读知识，需入库 |
| 伙伴平台报文样例 | `docs/partner/samples/` | 需入库的小体积样例 |
