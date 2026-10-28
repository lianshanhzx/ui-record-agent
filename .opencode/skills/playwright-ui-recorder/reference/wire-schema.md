# Wire 报文 Schema（partner-wire）

回放引擎 `replay-skill` 消费的交易报文格式。每个文件 = 1 个原子交易。

## 顶层结构

```json
{
  "transcationEventTypeList": [
    {
      "transcId": "TBD",
      "pageId": "TBD",
      "transcationName": "C1 对公客户管理-列表查询",
      "systemId": "TBD",
      "projectId": "TBD",
      "transcationType": "web",
      "testFrame": "playwright",
      "transcationProperties": [ ...步骤数组... ]
    }
  ]
}
```

`transcId/pageId/systemId/projectId` 当前平台固定 `"TBD"`；`transcationType="web"`；`testFrame="playwright"`。

## 步骤节点（transcationProperties[]）

| 字段 | 说明 |
|------|------|
| `propertiesID` | 步 id，整单从 `"1"` 递增，字符串 |
| `propertiesPID` | 父步 id，构成层级树（见下） |
| `type` | `page` / `popup` / `ele` |
| `propertiesName` | 步名（业务语言：「客户编号」「新增客户校验」「行业节点-金融业」） |
| `eventTypeValue` | 动作：`click` / `input` / `select:click` |
| `eventTypeName` | 动作中文：`点击` / `输入` / `下拉框点击选择` / `树节点点击选择` / `日期输入` / `开关` |
| `mothed` | ele 步固定 `By.XPATH`；page/popup 步空串 |
| `elementType` | ele 步放 XPath；page/popup 步空串 |
| `objectValue` | 录入值/选中项文本；click 类空串 |
| `realLabel` | 真实标签（定位锚），一般=propertiesName |
| `rect` | 归一化坐标 JSON **字符串**：`"{\"x1\":0.019,\"y1\":0.236,\"x2\":0.247,\"y2\":0.271}"`（1440×900 基准）；page/popup 步空串 |
| `transcationType` | 固定 `playwright` |
| `options` | 空串 |
| `screenCapture` | 可选，截图 URL（page/popup 步常用，供 UI 展示） |

## 层级树规则（核心）

- 第一个节点必须是 `page` 步，`propertiesPID="0"`（根）。
- 页面内元素步：`propertiesPID` = 所属 page 步 id。
- 弹窗/抽屉/浮层：
  1. 触发元素 click 步（type=ele，pid=page 步 id）；
  2. 紧跟一个 `popup` 步，`propertiesPID` = 该 click 步 id，`rect` 填弹窗区域（可为空）；
  3. 弹窗内所有 ele 步 `propertiesPID` = popup 步 id。
- **场景导航**（列表→场景页、场景页→列表）：
  1. 触发导航的 click 步（如「保存」「返回」）；
  2. 紧跟新 `page` 步，`propertiesPID` = 触发 click 步 id（**不是 0**）；
  3. 新页面内元素步 pid = 新 page 步 id。
- 同一页面反复出现（场景页→列表→再进场景）就再插 page 步，pid 链到对应触发步。

```
1 page(列表) pid=0
2 ele 更多 pid=1
3 ele 客户编号 input pid=1
4 ele 客户分类 select:click pid=1
...
10 ele 查询 click pid=1
```

## 动作类型语义（回放引擎实现）

- `input`：XPath 定位 input/textarea → `fill(objectValue)`；
- `click`：XPath 定位 → 真实鼠标点击；
- `select:click`：XPath 定位字段（el-select 容器）→ 点开展开 → 在可见下拉里按 `objectValue` 文本找选项点击。
  **只适用于 el-select 下拉**；树节点虽然也用 `select:click`，但 XPath 直接定位到
  `el-tree-node__content`（叶子内容节点），引擎按文本匹配叶子。

## rect 规则

- 归一化：`x = 元素中心x / 1440`，`y = 元素中心y / 900`，取 3 位小数；x1<x2、y1<y2；
- 必须由 **1440×900 视口下**的 spec 实测（`boundingBox()` 换算）落盘到 values json，禁止手填/估填；
- ele 步无 rect = 校验失败（noRect）。

## 完整性校验（生成后必跑）

```js
const w = JSON.parse(fs.readFileSync('partner-wire/corp/C1-list-query.json', 'utf-8'));
const ps = w.transcationEventTypeList[0].transcationProperties;
const ids = new Set(); let dup = 0, badPID = 0, noRect = 0;
for (const p of ps) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log(`steps=${ps.length} dup=${dup} badPID=${badPID} noRect=${noRect}`);
// dup=0 badPID=0 noRect=0 才通过
```

## 编排约定（案例编排用）

- `partner-wire/<module>/` 目录**文件名自然序 = 执行序**（C1 → C10），replay.mjs 按序全量回放；
- 交易间前置依赖（C7 修改依赖 C4 建的数据）写在 `work/<task>/plan.md` 清单表，不编码进 wire；
- 数据刷新脚本（`refresh_wire_data.js`）在回放前**值级替换** wire 里的 objectValue（时间戳名/唯一码），
  定位与结构不动 → 同一套 wire 可反复编排执行。
