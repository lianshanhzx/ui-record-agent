# ui-record-agent

基于 OpenCode skill + Playwright 的 **UI 交易录制与回放智能体**：把一次真实页面操作，录制为可确定性回放的 wire 报文（页面 / 弹窗 / 元素三层结构），并支持生成伙伴平台推送报文。

> 本仓库只包含**方法、技能、引擎与脚本**。录制产物（截图、回放报告、登录态、客户业务文档）不入库，见文末「数据策略」。

## 组成

```
.opencode/skills/                    所有 skill 的唯一位置（可被自动发现）
  playwright-ui-recorder/     通用录制流程：需求拆分 → 页面探路 → spec → wire → 回放验证
    scripts/page-scanner.js     页面盘点扫描器（自包含，产出 ui-agent1.scan-inventory）
    scripts/probe_template.js   多状态探路模板
  tansun-recorder/            天阳信贷 V5P2 平台专属知识库（模块级实测结论）
    reference/                  通用元素操作参考
    samples/                    原始录制报文样例（对公客户评级/管理页）
  req-doc-record-steps/       需求文档 → 原子交易录制步骤表
  qwen-record-replay-vision/  图片理解统一走 Qwen3.8-27B（禁止主模型视觉兜底）
  wire-replay/                wire 报文回放用法（引擎实现见 replay-skill/）
  atp-v3-push/                ATP 平台 V3 报文推送（token 走环境变量）
replay-skill/                 回放引擎（wire 解析 / 动作执行 / 登录态 / 报告）
tools/page-scanner/           扫描器的离线自测、真实页面校验、探路采集 CLI
tests/                        Playwright spec（每个原子交易一个 case；`_smoke/` 为免登录自检）
cases/                        **可复现材料包**：wire 报文 + 验收报告 + 生成/清理脚本 + 字段盘点基线
docs/                         人读文档：平台知识、伙伴平台契约与样例报文
materials/                    客户资料（docx / 抽图 / 解析产物 / 压缩包，按固定文件夹忽略，见「数据策略与目录规则」）
scripts/                      仓库维护脚本（check-layout.mjs：目录结构守卫）
.githooks/pre-commit          提交前结构校验（拦截资料与生成物入库）
```

`docs/` 下的分工：

```
docs/platform/                平台接口与操作笔记（apis.md / notes.md / 测试数据）
docs/partner/                 伙伴平台对接契约（接口说明、V3 接口参数）
docs/partner/samples/         样例报文（V3 可用报文、traj 828 实际推送报文）
```

客户资料（需求分册、文档截图、压缩包）**不入库**，统一放 `materials/`，规则见下文[「数据策略与目录规则」](#数据策略与目录规则)。

## cases/ 解决什么问题

**A 在这里录制成功，B 拿同样的材料也能成功。** 每个模块一包 wire + report + scripts + inventory，
`report/` 里的 `pass/warn/fail` 就是"成功"的判定标准。详见 [`cases/README.md`](cases/README.md)。

| 模块 | wire | 历史基线 |
|---|---|---|
| `blacklist` 黑名单 | 8 | 3 pass / 5 warn（均为已知非逻辑原因） |
| `smbsn` 同业客户 | 28 | 报告仅覆盖 S11（1/1） |
| `corp` 对公客户 | 122 | 6 批次，非全绿（见包内 README） |
| `corp-rating` 对公评级 | 72 | **全绿** 61+11+7+5 |
| `pdelmt` 产品库 | 20 | **全绿** 8/8 |
| `private` 对私客户 | 9 | 8 pass / 1 warn（引擎自愈） |
| `exploratory` 框架探路 | 6 | 4 pass / 1 warn |

## 快速开始

```bash
npm install

# 1) 配置图片理解模型（skill 依赖）
cp opencode.example.json opencode.json      # 填入自己的 apiKey / baseURL

# 2) 生成登录态（storageState，约 50 分钟过期，过期需重新生成）
npx playwright codegen --save-storage=auth.json http://<your-test-host>

# 3) 回放一个 wire 报文（产物写进 runs/，该目录已被忽略）
node replay-skill/replay.mjs <path-to-wire.json> \
  --profile replay-skill/profiles/<profile>.json \
  --auth auth.json --out runs/replay-out
```

## 已知依赖与限制

- `tests/` 中的 case 通过 `replay-skill/replay.mjs` 执行，依赖 **本地录制产物**（`work/`、`partner-wire/`）作为输入，仓库不含这些数据，直接 `npx playwright test` 需要先自备对应批次。
- **源码与批次分离**：`tests/corp-rating` 引用的流程代码在 `cases/corp-rating/scripts/flows/`（入库），批次数据仍在 `work/corp-rating-full-20261019/`（不入库）；删 `work/` 只影响可执行性，不再丢代码。
- 批次目录可用环境变量改指向：`CORP_RUN_DIR`、`CORP_WIRE_DIR`、`RATING_OUT`、`RATING_WIRES`。
- `tests/_smoke/` 是不依赖登录态的自检用例（显式忽略全局 `storageState`），可单独执行：`npx playwright test tests/_smoke`。
- `tests/corp/rerecordCase.ts` 内的 `PLAYWRIGHT_BROWSERS_PATH` 与工作目录仍是本机实测路径，换机器请用环境变量覆盖。
- `docs/platform/`、`tests/`、`tansun-recorder/samples/` 内含测试环境业务数据，仓库须为**私有**。

## 数据策略与目录规则

根目录只放**代码、配置、用例**。客户资料与生成物按**固定文件夹**存放，`.gitignore` 只忽略这些文件夹，不写 `*.docx` 这类全局后缀规则。

### 固定文件夹

| 文件夹 | 放什么 | 入库 |
|---|---|---|
| `materials/requirements/` | 需求分册 docx（`req-doc-record-steps` 的输入，文件名 `<编号>天阳信贷管理系统-<模块>需求分册.docx`） | 否 |
| `materials/screenshots/` | 从 docx 抽出的界面原型图（`img_000N.png/jpg`） | 否 |
| `materials/catalog/` | docx 解析产物（章节树 + 图片映射） | 否 |
| `materials/archive/` | 压缩包 / 原件（与 docx 重复的打包版只留一份） | 否 |
| `work/<批次>/` | 历史录制批次产物；`work/_legacy/` 存历史散文件（P5 迁 `runs/`） | 否 |
| `partner-wire/<模块>/` | 历史 wire 报文（P5 迁 `runs/`） | 否 |
| `runs/<模块>/<批次>/` | 生成物目标目录（报告 / 截图 / 下载） | 否 |
| `out/`、`replay-out/` | 文档示例里的默认输出目录 | 否 |
| `docs/platform/`、`docs/partner/` | 平台接口笔记、伙伴契约与样例报文 | 是 |
| `cases/<模块>/` | 可复现材料包：`wire/ report/ scripts/ inventory/ values/ docs/` | 是 |

### 规则

1. **只按固定文件夹忽略**：放对文件夹的文件自动忽略；放到别处会以**未跟踪**状态出现在 `git status`，提醒归位——避免有人随手丢文件后整个目录被静默吞掉。
2. **新增资料类别**：建文件夹 → `.gitignore` 加一行文件夹规则 → 本表补一行 → 再放文件。
3. **凭据与垃圾**走跨目录规则：`auth.json`、`opencode.json`、`.env*`、`*.pem`、`*.key`、`node_modules/`、`*.log`、`~$*`。
4. 需求分册 docx 不入库（体积 + 客户机密），`req-doc-record-steps` 需要时由使用者自备放到 `materials/requirements/`，识别规则见 `doc-types/tansun-credit/DOC-TYPE.md`。

### 提交前校验

```bash
npm run check:layout
```

`npm install` 会自动执行 `prepare`（`git config core.hooksPath .githooks`），此后每次提交都跑同一份校验；手动安装亦可，绕过不建议（`git commit --no-verify`）。
校验四项：`materials/` 下文件是否都在固定文件夹内、资料类文件是否入库、生成物目录是否入库、单文件是否超 5MB。

## 说明

- 字段名 `transcation*` / `mothed` 是伙伴平台的既定契约（少 `i`、`method` 拼作 `mothed`），**刻意保留**，勿"纠正"。
- 回放引擎不依赖模型；模型只在"看截图 / 看原型图"时参与。
