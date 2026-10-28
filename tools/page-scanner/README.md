# page-scanner 测试工具

`page-scanner.js` 的**测试与验证**子项目。录制的运行时脚本不在这里——它在技能目录：

```
.opencode/skills/playwright-ui-recorder/scripts/page-scanner.js   ← 唯一运行时脚本（单真源）
tools/page-scanner/                                               ← 本子项目（测试/验证/探路）
```

**为什么运行时脚本不搬进来**：录制时 agent 要把它注入被测页面，技能目录必须自包含；
两份副本会漂移。所以这里只按路径引用（`lib/resolve-scanner.js`），需要时可显式指定：

```powershell
node bin/scan-verify.js --scanner "D:\path\to\page-scanner.js" --url "..."
$env:PAGE_SCANNER_PATH="D:\path\to\page-scanner.js"
```

---

## 目录

```
tools/page-scanner/
├─ package.json
├─ lib/
│  ├─ resolve-scanner.js     # 定位运行时脚本（env / --scanner / 向上查找）
│  └─ scan-probe.js          # 采集 + 三层校验 + 标注截图 + 报告
├─ bin/
│  ├─ scan-verify.js         # 单页面验证 CLI
│  └─ probe-template.js      # 多状态探路模板（复制到 work/<task>/ 改配置用）
└─ test/
   ├─ selftest.js            # 离线回归自测（48 项断言）
   └─ fixtures/*.html        # 自测页面
```

---

## 常用命令（在项目根目录执行）

| 目的 | 命令 |
|---|---|
| 代码回归（秒级，改扫描器后跑） | `node tools/page-scanner/test/selftest.js` |
| 单页面验证 | `node tools/page-scanner/bin/scan-verify.js --url "http://.../#/route" --state 列表 --fill 3` |
| 多状态探路 | 复制 `bin/probe-template.js` 到 `work/<task>/probe_scan.js`，改顶部 CONFIG 后运行 |
| 在本目录用 npm | `npm test`、`npm run verify -- --url "..."` |

产物默认落在**执行目录**下：`work/scans/verify/`（单页）或 `work/<task>/scans/`（多状态）。

---

## 验证模型

| 层 | 内容 | 失败表现 |
|---|---|---|
| L1 完整性 | Playwright 独立枚举 `.el-form-item` 标签与 `fields` 对拍 | 漏 / 多 |
| L2 定位 | 每条 `wireXPath` 回代：命中数 == `wireCount`，且落点标签 + 坐标一致 | 命中 0 / 数不符 / 落错字段 |
| L3 语义 | 抽样 `fill()` + 读回 | 填不进 / 读回不一致 |
| 视觉 | 标注截图（框 + 编号，编号=表格 `#`） | 页面上有字段却没框 |

标注图按**视口**截（平台多为内部容器滚动），视口外字段会在报告里注明数量。

---

## 输出物

| 文件 | 用途 |
|---|---|
| `<state>.html` | 核对页：标注图 + 汇总 + 字段表 |
| `<state>.annotated.png` | 标注截图（红=可操作，灰=skip，橙=需复核） |
| `<state>.inventory.json` | 扫描结果，可直接喂 fillEngine / gen-wire |
| `<state>.verify.json` | L1/L2/L3 结果 |
| `<state>.md` | 表格版清单（贴进 plan.md） |
| `index.html` | 多状态汇总页 |

---

## 通过标准

```
L1 漏 0 / 多 0      stats.coverage = 1      L2 硬失败 0      L3 全 ok
软告警逐条确认：单选组歧义、同名标签属预期；其余需修
```

退码：`0` 无硬失败，`1` 有硬失败，`2` 运行异常。

---

## 依赖

复用仓库根的 `node_modules/playwright`（Node 会向上查找），本目录不装依赖。
若独立运行（不在本仓库内），需自行 `npm i playwright` 或设置 `NODE_PATH`。
