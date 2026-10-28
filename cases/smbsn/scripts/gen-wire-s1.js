// gen-wire-s1.js - filllog-S1.json + s1-values.json + rects-wire.json → partner-wire/smbsn/S1-new.json
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const escX = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const itX = (label) => `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='${escX(label)}']]`;
const dlgX = (label) => `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='${escX(label)}']]`;
const drawerX = (label) => `//div[contains(@class,'el-drawer')]//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='${escX(label)}']]`;
const RADIO_X = `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]`;
const DATE_CLOSE_X = `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//label[normalize-space(.)='客户编号']`;

const log = JSON.parse(fs.readFileSync(path.join(DIR, 'filllog-S1.json'), 'utf8'));
const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's1-values.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'rects-wire.json'), 'utf8'));

const props = [];
let id = 0;
const nid = () => String(++id);
const push = (p) => { p.propertiesID = nid(); props.push(p); return p; };
const pageStep = (name, pid = '0') =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'page', propertiesPID: pid, realLabel: '', rect: '' });
const popupStep = (name, pid, rect) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: pid, realLabel: '', rect: rect || '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });

// ---- 1. 列表页 ----
pageStep('同业客户管理列表 - 天阳宏业');
const listPid = props[0].propertiesID;
eleStep('新增', "//button[normalize-space()='新增']", 'click', '点击', listPid, '', R.listNew);
const newPid = props[props.length - 1].propertiesID;

// ---- 2. 新增抽屉 ----
popupStep('新增客户抽屉', newPid, R.drawerRect);
const drawerPid = props[props.length - 1].propertiesID;
eleStep('证件类型', drawerX('证件类型') + "//div[contains(@class,'el-select')]", 'select:click', '下拉框点击选择', drawerPid, '营业执照', R.drawerType);
eleStep('证件号码', drawerX('证件号码') + '//input', 'input', '输入', drawerPid, vals.uscc, R.drawerNo);
eleStep('客户名称', drawerX('客户名称') + '//input', 'input', '输入', drawerPid, vals.name, R.drawerNm);
eleStep('保存', "//div[contains(@class,'el-drawer')]//button[normalize-space()='保存']", 'click', '点击', drawerPid, '', R.drawerSave);
const savePid = props[props.length - 1].propertiesID;

// ---- 3. 场景页 ----
pageStep('同业客户详情-新增客户场景', savePid);
const pagePid = props[props.length - 1].propertiesID;

const dlgBtn = (t) => `//div[contains(@class,'el-dialog')]//button[normalize-space()='${escX(t)}']`;
let fills = 0;

for (const it of log.items) {
  if (!it.ok) { console.log(`WARN skip non-ok seq=${it.seq} ${it.label} (${it.note})`); continue; }
  if (it.type === 'skip' || it.action === 'skip') continue;
  const L = it.label;
  if (it.type === 'input') {
    eleStep(L, itX(L) + '//input', 'input', '输入', pagePid, it.value, it.rect); fills++;
  } else if (it.type === 'textarea') {
    eleStep(L, itX(L) + '//textarea', 'input', '输入', pagePid, it.value, it.rect); fills++;
  } else if (it.type === 'select') {
    eleStep(L, itX(L) + "//div[contains(@class,'el-select')]", 'select:click', '下拉框点击选择', pagePid, it.value, it.rect); fills++;
  } else if (it.type === 'date') {
    eleStep(L, itX(L) + '//input', 'input', '日期输入', pagePid, it.value, it.rect); fills++;
    eleStep('关闭日期面板（点客户编号栏）', DATE_CLOSE_X, 'click', '点击', pagePid, '', it.rect);
  } else if (it.type === 'switch') {
    eleStep(L, itX(L) + "//div[contains(@class,'el-switch')]", 'click', '开关', pagePid, it.value, it.rect); fills++;
  } else if (it.type === 'import') {
    const s = it.steps || [];
    const open = s.find((x) => x.action === 'click' && x.target.startsWith('打开'));
    const dlgName = (s.find((x) => x.dialog && x.dialog !== '引入') || {}).dialog || '引入弹窗';
    const tr = eleStep(L + '-引入', itX(L) + "//button[normalize-space()='引入']", 'click', '点击', pagePid, '', open ? open.rect : it.rect, '引入');
    popupStep(dlgName, tr.propertiesID, '');
    const dlgPid = props[props.length - 1].propertiesID;
    const radioRect = dlgName === '调查机构查询' ? R.orgRadio : dlgName === '客户放大镜' ? R.persRadio : '';
    let radioPushed = false;
    const pushRadio = () => {
      if (!radioPushed && radioRect) {
        eleStep('首行记录单选', RADIO_X, 'click', '点击', dlgPid, '', radioRect, '首行记录单选');
        radioPushed = true;
      }
    };
    for (const st of s) {
      if (st.action === 'input') {
        eleStep(st.target, dlgX(st.target) + '//input', 'input', '输入', dlgPid, st.value, st.rect);
      } else if (st.action === 'select') {
        eleStep(st.target, dlgX(st.target) + "//div[contains(@class,'el-select')]", 'select:click', '下拉框点击选择', dlgPid, st.value, st.rect);
      } else if (st.action === 'click' && !st.target.startsWith('打开')) {
        if (st.target === '确认') pushRadio();
        eleStep(st.target, dlgBtn(st.target), 'click', '点击', dlgPid, '', st.rect);
      }
    }
    pushRadio();
    fills++;
  } else {
    console.log(`WARN unknown type seq=${it.seq} ${it.label} type=${it.type}`);
  }
}

// ---- 4. 暂存 / 返回 / 列表反查 ----
eleStep('暂存', "//button[normalize-space()='暂存']", 'click', '点击', pagePid, '', R.sceneTempSave);
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', pagePid, '', R.sceneBack);
const backPid = props[props.length - 1].propertiesID;
pageStep('同业客户管理列表 - 天阳宏业', backPid);
const listPid2 = props[props.length - 1].propertiesID;
eleStep('客户名称', itX('客户名称') + '//input', 'input', '输入', listPid2, vals.name, R.listNm);
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', listPid2, '', R.listQuery);

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD', transcationName: 'S1 同业客户管理-新增客户(抽屉录入→场景页全量填充→暂存→列表反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S1-new.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`WIRE S1 -> ${outPath} total=${props.length} steps, fills=${fills}/${log.total}, items_ok=${log.ok}/${log.total}`);

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
