// gen-wire-s18.js - s18-values.json + rects-wire.json + s16(listNoRect) → partner-wire/smbsn/S18-netcheck-view.json
// S18 联网核查信息-查看：列表查询→选行→【联网核查信息】dialog→核查结果=核查通过(tssc-multi-select, inspRsltId=1)→查询→重置→取消
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";
const D = `//div[contains(@class,'el-dialog')][.//button[normalize-space()='发起实时核查']]`;

const s18 = JSON.parse(fs.readFileSync(path.join(DIR, 's18-values.json'), 'utf8'));
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
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, s18.custNo, P(s16.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('联网核查信息', "//button[normalize-space()='联网核查信息']", 'click', '点击', L1, '', P(s18.netcheckBtnRect));
const G1 = popupStep('联网核查信息', lastId()).propertiesID;
eleStep('核查结果', D + `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='核查结果']]//div[contains(@class,'tssc-multi-select')]//div[contains(@class,'el-select')]`, 'select:click', '下拉选择', G1, '核查通过', P(s18.netRsltRect));
eleStep('查询', D + `//button[normalize-space()='查询']`, 'click', '点击', G1, '', P(s18.netDlgQueryRect));
eleStep('重置', D + `//button[normalize-space()='重置']`, 'click', '点击', G1, '', P(s18.netDlgResetRect));
eleStep('取消', D + `//button[normalize-space()='取消']`, 'click', '点击', G1, '', P(s18.netDlgCancelRect));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S18 同业客户管理-联网核查信息查看(选行→联网核查信息→核查结果筛选查询→重置→取消)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S18-netcheck-view.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S18 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
