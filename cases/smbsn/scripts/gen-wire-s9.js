// gen-wire-s9.js - s9-values.json + filllog-S9.json + s8-values.json(列表层) + rects-wire.json → partner-wire/smbsn/S9-related-party-edit.json
// S9 同业客户-关联人信息修改：列表查询→选行→修改→关联人tab→选行→修改弹窗改 6 项(异值)→确定(saveFamily)→返回反查
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB8_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='关联人信息']";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";
// 关联人表首行 radio（visible 过滤：其他 tab pane 的表隐藏）
const RPROW_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
// 修改关联人弹窗锚点（与新增同结构，唯一含 高管类别 label 的可见 el-dialog）
const ED_X = "//div[contains(@class,'el-dialog')][.//label[normalize-space()='高管类别']]";
const dlgField = (anchor, label, tail) => anchor + "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]" + tail;

const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's9-values.json'), 'utf8'));
const s8 = JSON.parse(fs.readFileSync(path.join(DIR, 's8-values.json'), 'utf8'));
const filllog = JSON.parse(fs.readFileSync(path.join(DIR, 'filllog-S9.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'rects-wire.json'), 'utf8'));
const F = {};
for (const it of filllog.items) F[it.label] = it.rect;

const props = [];
let id = 0;
const nid = () => String(++id);
const push = (p) => { p.propertiesID = nid(); props.push(p); return p; };
const lastId = () => props[props.length - 1].propertiesID;
const pageStep = (name, pid) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'page', propertiesPID: pid || '0', realLabel: '', rect: '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });
const selX = (anchor, label) => dlgField(anchor, label, "//div[contains(@class,'el-select')]");
const inX = (anchor, label) => dlgField(anchor, label, "//input");

// ---- 1) 列表页：客户编号查询 → 选行 → 修改 ----
pageStep('同业客户管理列表 - 天阳宏业');
const L1 = lastId();
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, P(s8.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', P(R.listModify));
const P1 = pageStep('同业客户详情-修改客户场景-关联人信息', lastId()).propertiesID;

// ---- 2) 关联人信息 tab → 选行 → 修改 ----
eleStep('关联人信息tab', TAB8_X, 'click', '点击', P1, '', P(vals.tabRect), '关联人信息');
eleStep('关联人行单选', RPROW_X, 'click', '点击', P1, '', P(vals.rpRadioRect), '关联人行单选');
eleStep('修改', "//div[contains(@class,'el-tab-pane')]//button[normalize-space()='修改']", 'click', '点击', P1, '', P(vals.editBtnRect), '修改');

// ---- 3) 修改关联人信息弹窗：改 6 项（异值）----
push({ propertiesName: '修改关联人信息', eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: lastId(), realLabel: '', rect: '' });
const POP = lastId();
eleStep('联系电话', inX(ED_X, '联系电话'), 'input', '输入', POP, vals.new.mobile, P(F['联系电话']));
eleStep('居住地址', inX(ED_X, '居住地址'), 'input', '输入', POP, vals.new.addr, P(F['居住地址']));
eleStep('职称', selX(ED_X, '职称'), 'select:click', '下拉框点击选择', POP, vals.new.rank, P(F['职称']));
eleStep('单位电话', inX(ED_X, '单位电话'), 'input', '输入', POP, vals.new.tel, P(F['单位电话']));
eleStep('工作单位', inX(ED_X, '工作单位'), 'input', '输入', POP, vals.new.org, P(F['工作单位']));
eleStep('工作简历描述', inX(ED_X, '工作简历描述'), 'input', '输入', POP, vals.new.resume, P(F['工作简历描述']));
eleStep('确定', ED_X + "//button[normalize-space()='确定']", 'click', '点击', POP, '', P(vals.confirmRect), '确定');

// ---- 4) 返回 → 列表反查 ----
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', P(R.sceneBack), '返回');
const L2 = pageStep('同业客户管理列表 - 天阳宏业', lastId()).propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, P(s8.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', P(R.listQuery));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S9 同业客户管理-关联人信息修改(列表查询→修改→关联人tab→选行→修改弹窗改6项异值→确定saveFamily→返回反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S9-related-party-edit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S9 -> ' + outPath + ' total=' + props.length + ' steps');

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
