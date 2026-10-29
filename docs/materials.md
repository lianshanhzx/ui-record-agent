# materials/ — 客户资料与需求文档（不入库）

根目录只放**代码、配置、用例**；客户给的文档、截图、压缩包、解析产物统一收在 `materials/`。
资料体积大且含客户机密，**按下面约定结构逐项忽略**，不做整目录忽略：放进规定子目录的自动忽略，
放到别处会以**未跟踪**状态暴露出来（`git status` 里能看到），提醒归位——避免有人随手丢文件后整个目录被静默吞掉。

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

## 忽略规则（按结构，不是整目录）

`.gitignore` 里与 `materials/` 相关的只有这 9 条，一一对应上表：

| 路径 | 类型 |
|---|---|
| `materials/requirements/*.docx` | 需求分册 |
| `materials/screenshots/*.{png,jpg,jpeg,gif}` | 文档抽图 |
| `materials/catalog/*.json` | docx 解析产物 |
| `materials/archive/*.{zip,rar,7z,pdf}` | 压缩包 / 原件 |

**新增资料类别**（例如 `materials/recordings/`）：先建目录、加一条 `materials/recordings/*.ext` 忽略规则、
在本表补一行，再放文件。**不要**为了方便改成 `materials/` 整目录忽略。

同类处理（生成物目录也一样按结构忽略，散文件会露出来）：

| 目录 | 约定结构 | 忽略写法 |
|---|---|---|
| `work/` | `work/<批次>/` | `work/*/`（`work/*.*` 仅覆盖历史遗留散文件，P5 后删除） |
| `partner-wire/` | `partner-wire/<模块>/` | `partner-wire/*/`（`partner-wire/*.json` 同上） |
| `runs/` | `runs/<模块>/<批次>/` | `runs/*/` |
| `out/`、`replay-out/` | `out/<批次>/` | `out/*/`、`replay-out/*/` |

## 使用约定

| 事项 | 规则 |
|---|---|
| 新需求文档 | 放进 `materials/requirements/`，文件名保持 `<编号>天阳信贷管理系统-<模块>需求分册.docx`（`req-doc-record-steps` 靠文件名识别类型） |
| 文档抽图 | 解析脚本输出到 `materials/screenshots/`，不要散落在根目录的 `assets/` |
| 解析中间产物 | 放 `materials/catalog/`；一次性任务用的分节结果仍放 `work/<任务>/` |
| 压缩包 | 只保留一份在 `materials/archive/`，与 docx 重复的打包版不另存 |
| 入库 | **一律不入库**：资料目录已按结构忽略；`npm run check:layout` 会拦截任何形式的资料入库（含 `git add -f`） |

## 提交前校验

```bash
npm run check:layout          # 手动校验
node scripts/check-layout.mjs --verbose   # 附带 work/、partner-wire/ 散文件明细
```

校验内容（`.githooks/pre-commit` 每次提交自动跑）：

1. `materials/` 下**实际文件**是否都落在上表结构内 —— 乱放直接报错；
2. 被跟踪文件里是否有资料类文件（`docx/pdf/zip/xlsx…`）—— 资料不入库；
3. `work/ partner-wire/ runs/ out/ replay-out/ playwright-report/ test-results/` 是否有被跟踪文件 —— 生成物不入库；
4. 单文件是否超过 5MB —— 大文件不入库。

钩子安装：`npm install` 会自动执行 `prepare`（`git config core.hooksPath .githooks`）；
手动执行 `git config core.hooksPath .githooks` 亦可。绕过钩子（不建议）：`git commit --no-verify`。

## 不放这里的东西

| 内容 | 正确位置 | 原因 |
|---|---|---|
| `auth.json`（登录态） | 仓库根 | `playwright.config.ts` 与回放引擎默认读根目录；已在 `.gitignore` |
| `opencode.json`（模型 apiKey） | 仓库根 | `qwen-record-replay-vision` 脚本按根目录定位 |
| 回放截图 / 报告 | `work/`（后续 `runs/`） | 属生成物，可重跑 |
| 平台接口笔记 | `docs/platform/` | 人读知识，需入库 |
| 伙伴平台报文样例 | `docs/partner/samples/` | 需入库的小体积样例 |
