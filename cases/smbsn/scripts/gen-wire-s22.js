// gen-wire-s22.js - s22-values.json + s16 + rects-wire.json → partner-wire/smbsn/S22-advanced-query.json
// S22 高级查询：列表→caret展开→客户编号+证件号码+客户状态=草稿客户(cstSt=6)→查询→重置→caret收起
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";
const CARET_EXPAND = "//button[.//i[contains(@class,'el-icon-caret-bottom')]]";
const CARET_COLLAPSE = "//button[.//i[contains(@class,'el-icon-caret-top')]]";

const s22 = JSON.parse(fs.readFileSync(path.join(DIR, 's22-values.json'), 'utf8'));
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

pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, s22.custNo, P(s16.listNoRect));
eleStep('高级查询展开', CARET_EXPAND, 'click', '点击', L1, '', P(s22.caretRect));
eleStep('证件号码', itX('证件号码') + '//input', 'input', '输入', L1, '914501005QBUAEFCJ8', P(s22.crdtRect));
eleStep('客户状态', itX('客户状态') + `//div[contains(@class,'el-select')]`, 'select:click', '下拉选择', L1, '草稿客户', P(s22.stRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('重置', "//button[normalize-space()='重置']", 'click', '点击', L1, '', P(s22.resetRect));
eleStep('高级查询收起', CARET_COLLAPSE, 'click', '点击', L1, '', P(s22.caretRect));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S22 同业客户管理-高级查询(caret展开→客户编号+证件号码+客户状态=草稿客户→查询→重置→caret收起)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S22-advanced-query.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S22 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
