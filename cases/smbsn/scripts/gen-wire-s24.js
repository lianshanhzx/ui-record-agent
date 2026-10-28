// gen-wire-s24.js - s24-values.json → partner-wire/smbsn/S24-image-download.json
// S24 影像资料下载：列表查询→选行→修改→影像资料tab→目录客户管理→上传造文件(file:choose)→首行下载(断言 download)
// 下载 span 在固定右列容器 .el-table__fixed-right 内(主表动作列 cell 为 is-hidden)；xpath 精确命中该可见 span
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));

const s24 = JSON.parse(fs.readFileSync(path.join(DIR, 's24-values.json'), 'utf8'));
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const CUST_NO = '260924144929974126';

const X_NO = "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//input";
const X_QUERY = "//button[normalize-space()='查询']";
const X_RADIO = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const X_EDIT = "//button[normalize-space()='修改']";
const X_TAB = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='影像资料']";
const X_TREE = "//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']";
const X_UPLOAD = "//button[normalize-space()='上传']";
const X_DL = "//div[contains(@class,'el-table__fixed-right')]//span[normalize-space()='下载']";

// rects（复用 S12/S13 同页面元素 + 下载用 X1 实测 box x1238 y312 w28 h16 → 1440x900）
const R = {
  no: { x1: 0.0194, y1: 0.1958, x2: 0.2472, y2: 0.2313 },
  query: { x1: 0.744, y1: 0.236, x2: 0.806, y2: 0.271 },
  radio: { x1: 0.022, y1: 0.396, x2: 0.031, y2: 0.414 },
  edit: { x1: 0.075, y1: 0.294, x2: 0.136, y2: 0.329 },
  tab: { x1: 0.2181, y1: 0.1689, x2: 0.2847, y2: 0.2222 },
  tree: { x1: 0.0111, y1: 0.6539, x2: 0.1938, y2: 0.6939 },
  upload: { x1: 0.7375, y1: 0.2478, x2: 0.7688, y2: 0.2833 },
  dl: { x1: 0.8597, y1: 0.3467, x2: 0.8792, y2: 0.3644 },
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
eleStep('首行下载', X_DL, 'click', '点击', S1, '', R.dl, '下载');

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S24 同业客户管理-影像资料下载(列表查询→修改→影像资料→客户管理→上传造文件→首行下载)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S24-image-download.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S24 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
