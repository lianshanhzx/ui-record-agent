// gen-wire-s3.js - filllog-S3.json(12项) + s3-values.json + rects-wire.json → partner-wire/smbsn/S3-shareholder.json
// S3 同业客户-股东信息新增：列表查询→选行→修改→股东信息tab→新增→弹窗12项全量填写→确定
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const escX = (s) => String(s).split('\\').join('\\\\').split("'").join("\\'");
const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + escX(label) + "']]";
const dlgX = (label) => "//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + escX(label) + "']]";
const dlgLabel = (label) => "//div[contains(@class,'el-dialog')]//label[normalize-space(.)='" + escX(label) + "']";
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='股东信息']";
const dlgBtn = (t) => "//div[contains(@class,'el-dialog')]//button[normalize-space()='" + escX(t) + "']";

const log = JSON.parse(fs.readFileSync(path.join(DIR, 'filllog-S3.json'), 'utf8'));
const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's3-values.json'), 'utf8'));
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
// 修改 → 自然跳 mdfSmbsnCst（profile 匹配 同业客户详情，等 readySelector，不强跳固定路由）
const P1 = pageStep('同业客户详情-修改客户场景-股东信息', lastId()).propertiesID;

// ---- 2) 股东信息 tab → 新增 ----
eleStep('股东信息tab', TAB_X, 'click', '点击', P1, '', P(vals.tabRect), '股东信息');
const addStep = eleStep('新增', "//button[normalize-space()='新增']", 'click', '点击', P1, '', P(vals.addRect), '新增');

// ---- 3) 新增股东信息弹窗（.el-dialog，profile 需含 股东信息→.el-dialog 条目）----
const D = popupStep('新增股东信息', addStep.propertiesID, '').propertiesID;

// ---- 4) 弹窗 12 项全量填写（按盘点顺序）----
let fills = 0;
for (const it of log.items) {
  if (!it.ok) { console.log('WARN skip non-ok seq=' + it.seq + ' ' + it.label + ' (' + it.note + ')'); continue; }
  const L = it.label, rect = P(it.rect);
  if (it.type === 'input') {
    eleStep(L, dlgX(L) + '//input', 'input', '输入', D, it.value, rect); fills++;
  } else if (it.type === 'textarea') {
    eleStep(L, dlgX(L) + '//textarea', 'input', '输入', D, it.value, rect); fills++;
  } else if (it.type === 'select') {
    eleStep(L, dlgX(L) + "//div[contains(@class,'el-select')]", 'select:click', '下拉框点击选择', D, it.value, rect); fills++;
  } else if (it.type === 'date') {
    eleStep(L, dlgX(L) + '//input', 'input', '日期输入', D, it.value, rect);
    // 引擎 input 仅 fill 不 Enter：fill 只设 parsedValue 且面板保持打开；
    // 点首行「股东名称」标签（y~0.23，不被面板遮挡）→ 日期 input 失焦 → 提交 model 且关面板（probe39 实证）
    eleStep('关闭日期面板（点股东名称标签失焦）', dlgLabel('股东名称'), 'click', '点击', D, '', rect, '关闭日期面板');
    fills++;
  } else {
    console.log('WARN unknown type seq=' + it.seq + ' ' + it.label + ' type=' + it.type);
  }
}

// ---- 5) 弹窗确定 ----
eleStep('确定', dlgBtn('确定'), 'click', '点击', D, '', P(vals.confirmRect), '确定');

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S3 同业客户管理-股东信息新增(列表查询→修改→股东信息tab→新增→弹窗12项全量填写→确定保存)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S3-shareholder.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S3 -> ' + outPath + ' total=' + props.length + ' steps, fills=' + fills + ', items_ok=' + log.ok + '/' + log.total);

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
