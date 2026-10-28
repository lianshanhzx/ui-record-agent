// gen-wire-s26.js - s26-values.json → partner-wire/smbsn/S26-image-move.json
// S26 影像资料移动：列表查询→修改→影像资料→客户管理→上传造文件→行【移动】→「移动目录」dialog 选「贷后管理」→【确认选择】→moveCtlg 200
// 移动=行操作 .el-table__fixed-right span；移动目录 dialog 树=顶级目录平铺；确认选择=dialog 内 el-button--primary
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const s26 = JSON.parse(fs.readFileSync(path.join(DIR, 's26-values.json'), 'utf8'));
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const CUST_NO = '260924144929974126';
const TARGET = '贷后管理';

const X_NO = "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//input";
const X_QUERY = "//button[normalize-space()='查询']";
const X_RADIO = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const X_EDIT = "//button[normalize-space()='修改']";
const X_TAB = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='影像资料']";
const X_TREE = "//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']";
const X_UPLOAD = "//button[normalize-space()='上传']";
const X_MOVE = "//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='移动']";
const X_MOVE_NODE = "//div[contains(@class,'el-dialog')][.//span[contains(@class,'el-dialog__title')][normalize-space(.)='移动目录']]//div[contains(@class,'el-tree-node__content')][normalize-space(.)='" + TARGET + "']";
const X_CONFIRM = "//div[contains(@class,'el-dialog')][.//span[contains(@class,'el-dialog__title')][normalize-space(.)='移动目录']]//button[normalize-space()='确认选择']";

const R = {
  no: { x1: 0.0194, y1: 0.1958, x2: 0.2472, y2: 0.2313 },
  query: { x1: 0.744, y1: 0.236, x2: 0.806, y2: 0.271 },
  radio: { x1: 0.022, y1: 0.396, x2: 0.031, y2: 0.414 },
  edit: { x1: 0.075, y1: 0.294, x2: 0.136, y2: 0.329 },
  tab: { x1: 0.2181, y1: 0.1689, x2: 0.2847, y2: 0.2222 },
  tree: { x1: 0.0111, y1: 0.6539, x2: 0.1938, y2: 0.6939 },
  upload: { x1: 0.7375, y1: 0.2478, x2: 0.7688, y2: 0.2833 },
  move: s26.moveRect,
  moveNode: s26.moveNodeRect,
  confirm: s26.confirmRect,
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
pageStep('同业客户详情-修改客户场景-影像资料', M);
const S1 = lastId();
eleStep('影像资料tab', X_TAB, 'click', '点击', S1, '', R.tab);
eleStep('客户管理目录节点', X_TREE, 'click', '点击', S1, '', R.tree);
eleStep('上传', X_UPLOAD, 'file:choose', '文件选择', S1, FILE_PATH, R.upload);
eleStep('移动', X_MOVE, 'click', '点击', S1, '', R.move);
eleStep('选择目标目录-贷后管理', X_MOVE_NODE, 'click', '点击', S1, '', R.moveNode);
eleStep('确认选择', X_CONFIRM, 'click', '点击', S1, '', R.confirm);

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S26 同业客户管理-影像资料移动(上传造文件→移动目录→选贷后管理→确认选择 moveCtlg 200)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S26-image-move.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S26 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
