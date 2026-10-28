# 平台接口知识库

基址：`http://test.creditv5p2.tansun.com.cn/prod-api/tansun-tcp-app-pc`
所有接口均为 POST + JSON，需登录态（Cookie，复用 auth.json 即可）。
响应格式：`{ status: 200, description: "操作成功", data: {...} }`

## 1. 黑名单列表（黑名单管理页 ZJJK00098110）
`POST /tansun-tcp-cst/custBlack/page`
```json
{"pageNum":1,"pageSize":10,"cstNo":"","cstNm":"","crdtNo":"","crdtTp":"","blistTp":"","nmlstAfmTp":"","intcptGrdId":"","createUser":"","chnlSrcTp":"","createTime":null,"createInst":"","jnRsn":""}
```
响应 `data: { total, list[] }`，list 字段：
- id：主键；cstNo 客户编号；cstNm 客户名称；cstCgy 客户分类（10=对私/60=对公）
- crdtTp 证件类型（100=居民身份证/20111=营业执照）；crdtNo 证件号码
- blistTp 名单类型（A001=五级分类为次级/可疑/损失、A004=已核销贷款户 …）
- intcptGrdId 拦截等级（1=仅预警不阻断、5=…）；nmlstAfmTp 认定类型（2=人工）
- jnRsn 加入原因；chnlSrcTp 渠道来源（20304=信贷管理系统(新)）
- createUser/createInst/createTime 创建人/机构/时间；bsnNo 业务编号（CHD 开头）

## 2. 个人客户列表（个人客户管理页）
`POST /tansun-tcp-cst/custPersonal/queryUnion`
```json
{"usrNo":"","pageNum":1,"pageSize":10,"cstNo":"","cstNmLike":"","prvtCstSbdvsnTp":"","crdtTp":"","crdtNo":"","cstSt":"","orderBy":""}
```
响应 `data.list[]`：cstNo、cstNm、crdtTp、crdtNo、cstSt（客户状态：6=草稿客户等）、rgsInstNm 管户机构。总量约 271。

## 3. 对公客户列表（对公客户管理页）
`POST /tansun-tcp-cst/custCorporat/findCustCorporatList`
```json
{"pageNum":1,"pageSize":10,"cstNo":"","rtgCstClId":"","cstNmLike":"","crdtTp":"","crdtNo":"","cpctTp":"","cstSt":"","usrNm":""}
```
响应 `data.list[]`：cstNo、cstNm、crdtTp（20111=营业执照/20120=统一社会信用代码）、crdtNo、uscc、cstSt（2=信贷预客户/6=草稿客户）、cpctTp（601=企业类）。总量约 320。

## 4. 同业客户列表（同业客户管理页 smbsnCstMgtPg）
`POST /tansun-tcp-cst/custTrade/findCustTradeList`
表头：单选/客户编号/客户名称/证件类型/证件号码/客户类别/管户客户经理/管户机构/客户状态。
数据（2 条）：交通银行股份有限公司厦门分行 26051920431217102（同业, 信贷正式客户, 91350200855005712X）、福建农商行 26090315002805431（同业, 草稿客户, 91350200855005713X）。

## 5. 客户放大镜（黑名单新增-引入弹窗, 3 个 tab）
- 对私客户 tab：`POST /tansun-tcp-cst/custPersonal/queryPersonalMagnifierList`
- 对公客户 tab：`POST /tansun-tcp-cst/custCorporat/queryCustMagnifierList`
  表单：客户编号/客户名称/对公客户类型/证件类型/证件号码/客户状态；表头：单选/客户编号/客户名称/证件类型/证件号码/客户类型/客户状态/管户客户经理/管户机构
- 同业客户 tab：待探测（T2c）

## 6. 菜单树
`POST /tansun-tcp-sys/menu` body `{}` → data[] 为一级菜单（text/url/menuList 递归）。
`POST /tansun-tcp-common/sysLink/findUserMenu` body `{"rlEcd":"X0023","usrNo":"701994","menuNm":""}`。

## 取数脚本示例
在已登录页面上下文内 `fetch`（自动带 Cookie）：
```js
await page.evaluate(async () => (await fetch('/prod-api/tansun-tcp-app-pc/tansun-tcp-cst/custBlack/page',
  { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageNum: 1, pageSize: 50 }) })).json());
```
