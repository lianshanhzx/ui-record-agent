// gen-wire-s14.js - s14-values.json + rects-wire.json → partner-wire/smbsn/S14-image-delete.json
// S14 同业客户-影像资料删除：列表查询→选行→修改→影像资料tab→目录树选「客户管理」→首行【删除】→删除确认(确定/OK，locale漂移双兼容)→返回反查
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB14_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='影像资料']";
const TREE_NODE_X = "//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']";
const DELETE_X = "//span[normalize-space()='删除']";
// 确认按钮 locale 漂移实证（probe71b=中文「确定」/ S14 spec=英文「OK」）：双文案兼容
const CONFIRM_X = "//div[contains(@class,'el-message-box')]//button[normalize-space()='确定' or normalize-space()='OK']";
const CONFIRM_RECT = { x1: 0.5901, y1: 0.5278, x2: 0.6319, y2: 0.5633 }; // 同 S11 message-box primary 按钮位
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";

const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's14-values.json'), 'utf8'));
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
const popupStep = (name, pid, rect) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: pid, realLabel: '', rect: rect || '' });

// ---- 1) 列表页：客户编号查询 → 选行 → 修改 ----
pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', P(R.listModify));
const P1 = pageStep('同业客户详情-修改客户场景-影像资料', lastId()).propertiesID;

// ---- 2) 影像资料 tab → 目录树选「客户管理」→ 首行【删除】→ 删除确认 ----
eleStep('影像资料tab', TAB14_X, 'click', '点击', P1, '', P(vals.imgTabRect), '影像资料');
eleStep('客户管理目录节点', TREE_NODE_X, 'click', '点击', P1, '', P(vals.treeNodeRect), '客户管理');
const delStep = eleStep('首行删除', DELETE_X, 'click', '点击', P1, '', P(vals.deleteSpanRect), '删除');
popupStep('删除确认', delStep.propertiesID, '');
const M = lastId();
eleStep('删除确认-确定', CONFIRM_X, 'click', '点击', M, '', CONFIRM_RECT, '确定/OK');

// ---- 3) 返回 → 列表反查 ----
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', P(R.sceneBack), '返回');
const L2 = pageStep('同业客户管理列表 - 天阳宏业', lastId()).propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', P(R.listQuery));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S14 同业客户管理-影像资料删除(列表查询→修改→影像资料tab→目录树选客户管理→首行删除→确认→返回反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S14-image-delete.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S14 -> ' + outPath + ' total=' + props.length + ' steps');

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
