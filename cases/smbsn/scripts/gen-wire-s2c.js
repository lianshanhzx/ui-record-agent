// gen-wire-s2c.js - filllog-S2c.json(干净单次版) + s2c-values.json + rects → partner-wire/smbsn/S2-clean.json
// 链路: 列表(客户编号→查询→选行→修改) → 场景(明文项全改→暂存) → 返回 → 列表反查
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const escX = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const itX = (label) => `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='${escX(label)}']]`;
const RADIO_LIST_X = `//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]`;
const DATE_CLOSE_X = `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//label[normalize-space(.)='客户编号']`;

const log = JSON.parse(fs.readFileSync(path.join(DIR, 'filllog-S2c.json'), 'utf8'));
const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's2c-values.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'rects-wire.json'), 'utf8'));
const RS2 = {
  listNo: JSON.parse('{"x1":0.019,"y1":0.196,"x2":0.247,"y2":0.231}'),
  rowRadio: JSON.parse('{"x1":0.022,"y1":0.356,"x2":0.031,"y2":0.374}'),
};

const props = [];
let id = 0;
const nid = () => String(++id);
const push = (p) => { p.propertiesID = nid(); props.push(p); return p; };
const pageStep = (name, pid = '0') =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'page', propertiesPID: pid, realLabel: '', rect: '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });

// ---- 列表页: 客户编号搜索 → 查询 → 选行 → 修改 ----
pageStep('同业客户管理列表 - 天阳宏业');
const L1 = props[0].propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, RS2.listNo);
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', R.listQuery);
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', RS2.rowRadio, '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', R.listModify);

// ---- 场景页: 明文项全改(单次, 无引入) ----
const P1 = (pageStep('同业客户详情-修改客户场景(干净单次: 明文项全改)', props[props.length - 1].propertiesID)).propertiesID;
let fills = 0;
for (const it of log.items) {
  if (!it.ok) { console.log(`WARN skip non-ok seq=${it.seq} ${it.label} (${it.note})`); continue; }
  if (it.type === 'skip' || it.action === 'skip') continue;
  const L = it.label;
  if (it.type === 'input') {
    eleStep(L, itX(L) + '//input', 'input', '输入', P1, it.value, it.rect); fills++;
  } else if (it.type === 'textarea') {
    eleStep(L, itX(L) + '//textarea', 'input', '输入', P1, it.value, it.rect); fills++;
  } else if (it.type === 'select') {
    eleStep(L, itX(L) + "//div[contains(@class,'el-select')]", 'select:click', '下拉框点击选择', P1, it.value, it.rect); fills++;
  } else if (it.type === 'date') {
    eleStep(L, itX(L) + '//input', 'input', '日期输入', P1, it.value, it.rect);
    eleStep('关闭日期面板（点客户编号栏）', DATE_CLOSE_X, 'click', '点击', P1, '', it.rect);
    fills++;
  } else if (it.type === 'switch') {
    eleStep(L, itX(L) + "//div[contains(@class,'el-switch')]", 'click', '开关', P1, it.value, it.rect); fills++;
  } else if (it.type === 'import' || it.type === 'address') {
    throw new Error(`干净版 S2 不应含引入/地址项: ${L} (${it.type})`);
  } else {
    throw new Error(`未知类型 seq=${it.seq} ${L} type=${it.type}`);
  }
}

// ---- 暂存 → 返回 → 列表反查 ----
eleStep('暂存', "//button[normalize-space()='暂存']", 'click', '点击', P1, '', R.sceneTempSave);
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', R.sceneBack);
const backPid = props[props.length - 1].propertiesID;
pageStep('同业客户管理列表 - 天阳宏业', backPid);
const L2 = props[props.length - 1].propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, RS2.listNo);
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', R.listQuery);

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S2 同业客户管理-修改客户(干净单次: 客户编号搜索→查询→选行→修改→明文项全改→暂存→反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S2-clean.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`WIRE S2-clean -> ${outPath} total=${props.length} steps, fills=${fills}, items_ok=${log.ok}/${log.total}`);

// ---- 完整性校验 ----
const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log(`CHECK steps=${props.length} dup=${dup} badPID=${badPID} noRect=${noRect}`);
if (dup || badPID || noRect) process.exit(1);
