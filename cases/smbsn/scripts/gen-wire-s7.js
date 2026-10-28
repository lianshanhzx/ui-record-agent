// gen-wire-s7.js - s7-values.json + rects-wire.json → partner-wire/smbsn/S7-shareholder-fetch.json
// S7 同业客户-获取股东信息：列表查询→选行→修改→股东信息tab→点【获取股东信息】(networkCheck+成功通知)→返回→反查
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='股东信息']";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";

const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's7-values.json'), 'utf8'));
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
const P1 = pageStep('同业客户详情-修改客户场景-股东信息', lastId()).propertiesID;

// ---- 2) 股东信息 tab → 获取股东信息（networkCheck + 成功通知，只读不改表）----
eleStep('股东信息tab', TAB_X, 'click', '点击', P1, '', P(vals.tabRect), '股东信息');
eleStep('获取股东信息', "//button[normalize-space()='获取股东信息']", 'click', '点击', P1, '', P(vals.fetchRect), '获取股东信息');

// ---- 3) 返回 → 列表反查 ----
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', P(R.sceneBack), '返回');
const L2 = pageStep('同业客户管理列表 - 天阳宏业', lastId()).propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', P(R.listQuery));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S7 同业客户管理-获取股东信息(列表查询→修改→股东信息tab→获取股东信息→networkCheck成功通知→返回反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S7-shareholder-fetch.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S7 -> ' + outPath + ' total=' + props.length + ' steps');

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
