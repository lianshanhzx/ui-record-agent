// gen-wire-s10.js - s10-values.json + rects-wire.json → partner-wire/smbsn/S10-related-party-view.json
// S10 同业客户-关联人信息查看：列表查询→选行→修改→关联人信息tab→选行→查看→只读弹窗(17项)→取消
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB10_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='关联人信息']";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";

const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's10-values.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'rects-wire.json'), 'utf8'));

const props = [];
let id = 0;
const nid = () => String(++id);
const push = (p) => { p.propertiesID = nid(); props.push(p); return p; };
const lastId = () => props[props.length - 1].propertiesID;
const pageStep = (name, pid) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'page', propertiesPID: pid || '0', realLabel: '', rect: '' });
const popupStep = (name, pid, rect) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: pid, realLabel: '', rect: rect || '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });

// ---- 1) 列表页：客户编号查询 → 选行 → 修改 ----
pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', P(R.listModify));
const P1 = pageStep('同业客户详情-修改客户场景-关联人信息', lastId()).propertiesID;

// ---- 2) 关联人信息 tab → 选行 radio → 查看 ----
eleStep('关联人信息tab', TAB10_X, 'click', '点击', P1, '', P(vals.tabRect), '关联人信息');
eleStep('关联人表首行单选', RADIO_LIST_X, 'click', '点击', P1, '', P(vals.rpRadioRect), '关联人表首行单选');
const viewStep = eleStep('查看', "//div[contains(@class,'el-tab-pane')]//button[normalize-space()='查看']", 'click', '点击', P1, '', P(vals.viewBtnRect), '查看');

// ---- 3) 查看弹窗（.el-dialog 只读 17 项，profile 现有「关联人」条目命中）→ 取消 ----
const D = popupStep('查看关联人信息', viewStep.propertiesID, '').propertiesID;
eleStep('取消', "//div[contains(@class,'el-dialog')]//button[normalize-space()='取消']", 'click', '点击', D, '', P(vals.cancelRect), '取消');

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S10 同业客户管理-关联人信息查看(列表查询→修改→关联人信息tab→选行→查看→只读弹窗17项→取消关闭)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S10-related-party-view.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S10 -> ' + outPath + ' total=' + props.length + ' steps');

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
