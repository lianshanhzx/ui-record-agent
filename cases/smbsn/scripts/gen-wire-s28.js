// gen-wire-s28.js - s28-values.json → partner-wire/smbsn/S28-customer-save.json
// S28 同业客户-客户保存(暂存口径)：列表查询→选行→修改→改 客户简称(单字段)→【暂存】saveCustTrade→返回→反查 total=1
// 说明：正式保存【保存】本环境 no-op；唯一可用保存=【暂存】(草稿 prsvInd=0, cstSt 保持 6)。区别于 S2 的 40+ 明文项全改。
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const s28 = JSON.parse(fs.readFileSync(path.join(DIR, 's28-values.json'), 'utf8'));
const CUST_NO = '260924144929974126';
const JC_VAL = 'AT_S28暂存';

const X_NO = "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//input";
const X_QUERY = "//button[normalize-space()='查询']";
const X_RADIO = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const X_EDIT = "//button[normalize-space()='修改']";
const X_JC = "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户简称']]//input";
const X_TEMP = "//button[normalize-space()='暂存']";
const X_BACK = "//button[normalize-space()='返回']";

const R = {
  no: { x1: 0.0194, y1: 0.1958, x2: 0.2472, y2: 0.2313 },
  query: { x1: 0.744, y1: 0.236, x2: 0.806, y2: 0.271 },
  radio: { x1: 0.022, y1: 0.396, x2: 0.031, y2: 0.414 },
  edit: { x1: 0.075, y1: 0.294, x2: 0.136, y2: 0.329 },
  jc: s28.jcRect,
  temp: s28.tempSaveRect,
  back: s28.backRect,
};

const props = [];
let id = 0;
const nid = () => String(++id);
const push = (p) => { p.propertiesID = nid(); props.push(p); return p; };
const lastId = () => props[props.length - 1].propertiesID;
const pageStep = (name, pid) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'page', propertiesPID: pid || '0', realLabel: '', rect: '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });

pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', X_NO, 'input', '输入', L1, CUST_NO, R.no);
eleStep('查询', X_QUERY, 'click', '点击', L1, '', R.query);
eleStep('首行记录单选', X_RADIO, 'click', '点击', L1, '', R.radio);
eleStep('修改', X_EDIT, 'click', '点击', L1, '', R.edit);
const M = lastId();
pageStep('同业客户详情-修改客户场景(客户保存-暂存口径)', M);
const S1 = lastId();
eleStep('客户简称', X_JC, 'input', '输入', S1, JC_VAL, R.jc);
eleStep('暂存', X_TEMP, 'click', '点击', S1, '', R.temp);
eleStep('返回', X_BACK, 'click', '点击', S1, '', R.back);
const B = lastId();
pageStep('同业客户管理列表 - 天阳宏业(反查)', B);
const L2 = lastId();
eleStep('客户编号', X_NO, 'input', '输入', L2, CUST_NO, R.no);
eleStep('查询', X_QUERY, 'click', '点击', L2, '', R.query);

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S28 同业客户管理-客户保存(暂存口径: 改客户简称→暂存 saveCustTrade→返回→反查 total=1)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S28-customer-save.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S28 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
