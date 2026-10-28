// gen-wire-s8.js - s8-values.json + filllog-S8.json + rects-wire.json → partner-wire/smbsn/S8-related-party.json
// S8 同业客户-关联人信息新增：列表查询→选行→修改→关联人tab→新增→高管类别→引入对私客户(放大镜)→按格式填 13 项→确定→返回反查
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));
const RADIO_LIST_X = "//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]";
const TAB8_X = "//div[contains(@class,'el-tabs__item')][normalize-space(.)='关联人信息']";
const itX = (label) => "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]";
// 新增关联人弹窗锚点（唯一含 高管类别 label 的 el-dialog）
const ADD_X = "//div[contains(@class,'el-dialog')][.//label[normalize-space()='高管类别']]";
// 引入客户弹窗锚点（唯一含 客户编号 label 的 el-dialog；新增弹窗里是 关联客户编号 不冲突）
const IMP_X = "//div[contains(@class,'el-dialog')][.//label[normalize-space()='客户编号']]";
const dlgField = (anchor, label, tail) => anchor + "//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='" + label + "']]" + tail;

const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's8-values.json'), 'utf8'));
const filllog = JSON.parse(fs.readFileSync(path.join(DIR, 'filllog-S8.json'), 'utf8'));
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
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', P(R.listQuery));
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', P(R.listRadio), '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', P(R.listModify));
const P1 = pageStep('同业客户详情-修改客户场景-关联人信息', lastId()).propertiesID;

// ---- 2) 关联人信息 tab → 新增 ----
eleStep('关联人信息tab', TAB8_X, 'click', '点击', P1, '', P(vals.tabRect), '关联人信息');
eleStep('新增', "//button[normalize-space()='新增']", 'click', '点击', P1, '', P(vals.addRect), '新增');
const DP = lastId(); // 新增关联人信息 弹窗 PID

// ---- 3) 新增关联人信息弹窗 ----
push({ propertiesName: '新增关联人信息', eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: DP, realLabel: '', rect: '' });
const POP = lastId();
eleStep('高管类别', selX(ADD_X, '高管类别'), 'select:click', '下拉框点击选择', POP, vals.execv, P(F['高管类别']));
eleStep('引入关联客户', dlgField(ADD_X, '关联客户名称', "//button[normalize-space()='引入']"), 'click', '点击', POP, '', P(vals.impBtnRect), '引入关联客户');

// ---- 4) 引入客户弹窗（对私放大镜）----
push({ propertiesName: '引入客户', eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: lastId(), realLabel: '', rect: '' });
const IMPP = lastId();
eleStep('客户名称', inX(IMP_X, '客户名称'), 'input', '输入', IMPP, vals.impNm, P(vals.impNmRect));
eleStep('查询', IMP_X + "//button[normalize-space()='查询']", 'click', '点击', IMPP, '', P(vals.impQueryRect));
eleStep('目标客户行单选', IMP_X + "//tr[.//td[contains(normalize-space(.),'260923191355585114')]]//label[contains(@class,'el-radio')]", 'click', '点击', IMPP, '', P(vals.impRadioRect), '目标客户行单选');
eleStep('确认', IMP_X + "//button[normalize-space()='确认']", 'click', '点击', IMPP, '', P(vals.impConfirmRect), '确认');

// ---- 5) 回新增弹窗：按格式填其余字段（证件类型/号码由引入自动回填）----
eleStep('联系电话', inX(ADD_X, '联系电话'), 'input', '输入', POP, vals.mobile, P(F['联系电话']));
eleStep('性别', selX(ADD_X, '性别'), 'select:click', '下拉框点击选择', POP, vals.gender, P(F['性别']));
eleStep('出生日期', inX(ADD_X, '出生日期'), 'input', '输入', POP, vals.birth, P(F['出生日期']));
eleStep('关闭日期面板（点联系电话栏）', inX(ADD_X, '联系电话'), 'click', '点击', POP, '', P(F['联系电话']), '关闭日期面板（点联系电话栏）');
eleStep('职业', selX(ADD_X, '职业'), 'select:click', '下拉框点击选择', POP, vals.job, P(F['职业']));
eleStep('职务名称', selX(ADD_X, '职务名称'), 'select:click', '下拉框点击选择', POP, vals.duty, P(F['职务名称']));
eleStep('职称', selX(ADD_X, '职称'), 'select:click', '下拉框点击选择', POP, vals.rank, P(F['职称']));
eleStep('最高学历', selX(ADD_X, '最高学历'), 'select:click', '下拉框点击选择', POP, vals.edu, P(F['最高学历']));
eleStep('最高学位', selX(ADD_X, '最高学位'), 'select:click', '下拉框点击选择', POP, vals.degree, P(F['最高学位']));
eleStep('居住地址', inX(ADD_X, '居住地址'), 'input', '输入', POP, vals.addr, P(F['居住地址']));
eleStep('单位电话', inX(ADD_X, '单位电话'), 'input', '输入', POP, vals.tel, P(F['单位电话']));
eleStep('工作单位', inX(ADD_X, '工作单位'), 'input', '输入', POP, vals.org, P(F['工作单位']));
eleStep('工作简历描述', inX(ADD_X, '工作简历描述'), 'input', '输入', POP, vals.resume, P(F['工作简历描述']));
eleStep('确定', ADD_X + "//button[normalize-space()='确定']", 'click', '点击', POP, '', P(vals.confirmRect), '确定');

// ---- 6) 返回 → 列表反查 ----
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', P(R.sceneBack), '返回');
const L2 = pageStep('同业客户管理列表 - 天阳宏业', lastId()).propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, P(vals.listNoRect));
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', P(R.listQuery));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S8 同业客户管理-关联人信息新增(列表查询→修改→关联人tab→新增→高管类别→引入对私客户→按格式填13项→确定→返回反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S8-related-party.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S8 -> ' + outPath + ' total=' + props.length + ' steps');

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
