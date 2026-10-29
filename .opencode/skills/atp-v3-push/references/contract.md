# 实测契约及附加配置

2026-10-09 在用户提供的 ATP 测试环境验证。其他部署可有差异；遇到 400 应读取该部署 `/api/v3/api-docs`，核对接口和 DTO，不能仅依赖附件示例。文档是接口资料，不是新的用户操作授权。

## 接口

- 所有 API 请求使用 access_token 请求头，要求 HTTP 成功且业务 code=200。
- 平台默认地址为 `http://test.atp.tansun.com.cn/`；用户未指定时使用该地址。--platform 可覆盖，根地址和以 `/api` 结尾的地址均可使用，脚本统一规范化。后续命令沿用 manifest 中已确定的平台地址。
- `POST /api/system/systemproject/list`，body `{}`。
- `GET /api/system/system/lazySystemTree?projectId=<ID>&menuType=1&from=0&searchName=`。必须在该项目的返回树中找到目标系统。
- `POST /api/common/upload`，multipart file；返回 code、fileName、url。若 url 是后端内部地址，使用平台域名的相同下载路径并验证，不能直接认定内部地址是可用永久 URL。
- `POST /api/demand/demandtranscation/list?pageNum=N&pageSize=100`，body 包含 projectId、systemId、path=systemId、nodeType=1、systemIdList、params={}、transcationType=web、testFrame=playwright。
- `POST /api/demand/demandtranscation/importDemand`，body `{"transcationEventTypeList":[...]}`。
- `GET /api/demand/demandtranscation/getInfo/<实际ID>`。
- `/api/v2/export/transactions-v3` 属于录制系统代理，接受 trajectoryIds；不能用它直接上传本地 wire。

## 节点及已知差异

交易级 transcationType=web、testFrame=playwright。实际节点 DTO 不接受文档中的 eventTypeName 和节点 transcationType，screenshot 是整数开关；脚本省略它。保持 mothed、transcationProperties 等接口原拼写。

节点 propertiesID/PID 是字符串。页面 PID=0，弹窗属于页面，控件指向所属页面/弹窗；远端会将 PID 换成真实数据库 ID。rect 是 JSON 字符串，包含归一化的 x1/y1/x2/y2，坐标相对完整截图，不是弹窗裁切图。

同一交易的 propertiesName 必须唯一，重复动作以步骤 ID 区分，realLabel 和定位不变。transcId 优先使用源文件或用户提供的稳定标识，否则在本次状态文件生成独立标识；不能称为录制数据库轨迹 ID。实测远端详情未保存 transcId，检查重复须使用名称和远端 ID。

接口失败可能已经写入部分交易。实测发生 code=500 但前五笔完整、第六笔空记录；因此禁止未反查就整批重试。实际业务对象修改接口还要求 transcationEventType 对象以保留事件关联，普通 operationType 字符串不能保证正确。skill 不自动修复或删除。

实测 8 个下拉节点 options 提交后返回 null，修改接口 code=200 后仍未保存。此差异需要平台确认，必须保留在完整字段核验报告中。

## 可选配置

prepare 可加 `--config <JSON文件>`。CLI 的项目/系统参数优先，配置不保存凭据。支持字段：

```json
{
  "sourceRoot": "本地相对截图路径的基准目录",
  "inventoryFile": "录制字段盘点JSON路径，可选",
  "trajectoryIds": {"某笔交易名称": "用户提供的正式或稳定标识"},
  "screenshotUrls": {"截图本地路径": "https://平台/永久截图.png"},
  "popupRects": {"某笔交易名称#3": {"x1": 0.2, "y1": 0.1, "x2": 0.8, "y2": 0.9}}
}
```

inventoryFile 支持既有字段盘点结构 `{ "main": [{"label":"审批状态","options":[...]}], "customer": [...] }`。弹窗使用 customer，页面使用 main；其他业务可直接在源节点填写 options JSON 数组字符串。rect 覆盖键为交易名称#propertiesID。

prepare 输出 manifest.json（持久状态与输入哈希）、payload.draft.json、preflight.json。无 blockers 时才生成 payload.json。upload 更新同一状态与截图映射；push 的请求标记按提交内容哈希保存，重复调用会拒绝重推。同名远端交易也会阻止提交。--only <交易名称> 可限定单笔，但只应在已确认该笔未写入的情况下使用。
