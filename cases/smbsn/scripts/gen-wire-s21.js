// gen-wire-s21.js - s21-values.json + s16 + rects-wire.json → partner-wire/smbsn/S21-court-view.json
// S21 法院信息-查看：列表查询→选行→【法院信息】dialog→法院信息类型=涉诉(courtInfTp=1)→查询→重置→取消
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";
const D = `//div[contains(@class,'el-dialog')][.//label[normalize-space()='法院信息类型']]`;

const s21 = JSON.parse(fs.readFileSync(path.join(DIR, 's21-values.json'), 'utf8'));
const s16 = JSON.parse(fs.readFileSync(path.join(DIR, 's16-values.json'), 'utf8'));
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
const popupStep = (name, pid) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: pid, realLabel: '', rect: '' });

pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, s21.custNo, P(s16.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('法院信息', "//button[normalize-space()='法院信息']", 'click', '点击', L1, '', P(s21.courtBtnRect));
const G1 = popupStep('法院信息', lastId()).propertiesID;
eleStep('法院信息类型', D + `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='法院信息类型']]//div[contains(@class,'el-select')]`, 'select:click', '下拉选择', G1, '涉诉', P(s21.courtTpRect));
eleStep('查询', D + `//button[normalize-space()='查询']`, 'click', '点击', G1, '', P(s21.courtQueryRect));
eleStep('重置', D + `//button[normalize-space()='重置']`, 'click', '点击', G1, '', P(s21.courtResetRect));
eleStep('取消', D + `//button[normalize-space()='取消']`, 'click', '点击', G1, '', P(s21.courtCancelRect));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S21 同业客户管理-法院信息查看(选行→法院信息→法院信息类型筛选查询→重置→取消)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S21-court-view.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S21 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
