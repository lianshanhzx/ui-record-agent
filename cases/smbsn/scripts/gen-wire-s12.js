// gen-wire-s12.js - s12-values.json + rects-wire.json → partner-wire/smbsn/S12-image-upload.json
// S12 同业客户-影像资料上传：列表查询→选行→修改→影像资料tab→目录树选「客户管理」→上传(file:choose 系统文件框)→返回反查
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB12_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='影像资料']";
const TREE_NODE_X = "//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']";
const UP_BTN_X = "//button[normalize-space()='上传']";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";

const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's12-values.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'rects-wire.json'), 'utf8'));

const props = [];
let id = 0;
const nid = () => String(++id);
const push = (p) => { p.propertiesID = nid(); props.push(p); return p; };
const lastId = () => props[props.length - 1].propertiesID;
const pageStep = (name, pid) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'page', propertiesPID: pid || '0', realLabel: '', rect: '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });

// ---- 1) 列表页：客户编号查询 → 选行 → 修改 ----
pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', P(R.listModify));
const P1 = pageStep('同业客户详情-修改客户场景-影像资料', lastId()).propertiesID;

// ---- 2) 影像资料 tab → 目录树选「客户管理」→ 上传(file:choose) ----
eleStep('影像资料tab', TAB12_X, 'click', '点击', P1, '', P(vals.imgTabRect), '影像资料');
eleStep('客户管理目录节点', TREE_NODE_X, 'click', '点击', P1, '', P(vals.treeNodeRect), '客户管理');
eleStep('上传', UP_BTN_X, 'file:choose', '文件选择', P1, vals.filePath, P(vals.uploadBtnRect), '上传');

// ---- 3) 返回 → 列表反查 ----
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', P(R.sceneBack), '返回');
const L2 = pageStep('同业客户管理列表 - 天阳宏业', lastId()).propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', P(R.listQuery));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S12 同业客户管理-影像资料上传(列表查询→修改→影像资料tab→目录树选客户管理→file:choose上传→返回反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S12-image-upload.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S12 -> ' + outPath + ' total=' + props.length + ' steps');

// ---- 完整性校验 ----
const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
