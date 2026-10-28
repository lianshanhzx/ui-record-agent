// gen-wire-s25.js - s25-values.json → partner-wire/smbsn/S25-album-view.json
// S25 影像资料图册查看：列表查询→修改→影像资料→客户管理→上传造文件→【图册查看】→全屏「档案书册」dialog→关闭
// 图册查看=toolbar span(父 button.el-button--text)；档案书册 title 是 span.el-dialog__title(非 div)；关闭=button.el-dialog__headerbtn
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const s25 = JSON.parse(fs.readFileSync(path.join(DIR, 's25-values.json'), 'utf8'));
const FILE_PATH = path.join(DIR, 'AT_test_image_upload.png');
const CUST_NO = '260924144929974126';

const X_NO = "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//input";
const X_QUERY = "//button[normalize-space()='查询']";
const X_RADIO = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const X_EDIT = "//button[normalize-space()='修改']";
const X_TAB = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='影像资料']";
const X_TREE = "//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']";
const X_UPLOAD = "//button[normalize-space()='上传']";
const X_ALBUM = "//span[normalize-space()='图册查看']";
const X_CLOSE = "//div[contains(@class,'el-dialog')][.//span[contains(@class,'el-dialog__title')][normalize-space(.)='档案书册']]//button[contains(@class,'el-dialog__headerbtn')]";

const R = {
  no: { x1: 0.0194, y1: 0.1958, x2: 0.2472, y2: 0.2313 },
  query: { x1: 0.744, y1: 0.236, x2: 0.806, y2: 0.271 },
  radio: { x1: 0.022, y1: 0.396, x2: 0.031, y2: 0.414 },
  edit: { x1: 0.075, y1: 0.294, x2: 0.136, y2: 0.329 },
  tab: { x1: 0.2181, y1: 0.1689, x2: 0.2847, y2: 0.2222 },
  tree: { x1: 0.0111, y1: 0.6539, x2: 0.1938, y2: 0.6939 },
  upload: { x1: 0.7375, y1: 0.2478, x2: 0.7688, y2: 0.2833 },
  album: s25.albumRect,
  close: s25.closeRect,
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
eleStep('图册查看', X_ALBUM, 'click', '点击', S1, '', R.album);
eleStep('关闭档案书册', X_CLOSE, 'click', '点击', S1, '', R.close);

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S25 同业客户管理-影像资料图册查看(上传造文件→图册查看→档案书册dialog→关闭)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S25-album-view.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S25 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
