// gen-wire-s2.js - filllog-S2.json(两段合并) + s2-values.json + rects → partner-wire/smbsn/S2-edit.json
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const escX = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const itX = (label) => `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='${escX(label)}']]`;
const dlgX = (label) => `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='${escX(label)}']]`;
const RADIO_X = `//div[contains(@class,'el-dialog')]//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]`;
const RADIO_LIST_X = `//div[contains(@class,'el-table__body')]//label[contains(@class,'el-radio')]`;
const DATE_CLOSE_X = `//div[contains(@class,'el-form-item')][.//label[normalize-space(.)='客户编号']]//label[normalize-space(.)='客户编号']`;

const log = JSON.parse(fs.readFileSync(path.join(DIR, 'filllog-S2.json'), 'utf8'));
const vals = JSON.parse(fs.readFileSync(path.join(DIR, 's2-values.json'), 'utf8'));
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
const popupStep = (name, pid, rect) =>
  push({ propertiesName: name, eventTypeValue: 'click', eventTypeName: '点击', elementType: '', mothed: '', options: '', objectValue: '', transcationType: 'playwright', type: 'popup', propertiesPID: pid, realLabel: '', rect: rect || '' });
const eleStep = (name, xpath, evt, nameCn, pid, objVal, rect, realLabel) =>
  push({ options: '', elementType: xpath, eventTypeName: nameCn, eventTypeValue: evt, transcationType: 'playwright', objectValue: objVal || '', propertiesName: name, mothed: 'By.XPATH', type: 'ele', propertiesPID: pid, realLabel: realLabel || name, rect: rect || '' });
const dlgBtn = (t) => `//div[contains(@class,'el-dialog')]//button[normalize-space()='${escX(t)}']`;

// ---- 列表页查询选行进入(第 1 段) ----
pageStep('同业客户管理列表 - 天阳宏业');
const L1 = props[0].propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L1, vals.custNo, RS2.listNo);
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L1, '', R.listQuery);
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L1, '', RS2.rowRadio, '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L1, '', R.listModify);
const P1 = (pageStep('同业客户详情-修改客户场景(第1段:明文项全改)', props[props.length - 1].propertiesID)).propertiesID;

// ---- 填充渲染 ----
let fills = 0;
function renderFills(items, pagePid) {
  for (const it of items) {
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
      eleStep(L, itX(L) + '//input', 'input', '日期输入', pagePid, it.value, it.rect);
      eleStep('关闭日期面板（点客户编号栏）', DATE_CLOSE_X, 'click', '点击', pagePid, '', it.rect);
      fills++;
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
}

// ---- 第 1 段: 明文项(不含法代/地址/注册资本) ----
const V2L = new Set(['法定代表人/负责人姓名', '登记注册地址', '注册资本金额']);
const cut = log.items.findIndex((it) => V2L.has(it.label));
const visit1 = log.items.slice(0, cut);
const visit2 = log.items.slice(cut);
console.log('SPLIT visit1=' + visit1.length + ' visit2=' + visit2.length);
renderFills(visit1, P1);

// ---- 暂存#1 → 返回 → 列表重进(第 2 段) ----
eleStep('暂存', "//button[normalize-space()='暂存']", 'click', '点击', P1, '', R.sceneTempSave);
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P1, '', R.sceneBack);
const backPid1 = props[props.length - 1].propertiesID;
pageStep('同业客户管理列表 - 天阳宏业', backPid1);
const L2 = props[props.length - 1].propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L2, vals.custNo, RS2.listNo);
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L2, '', R.listQuery);
eleStep('首行记录单选', RADIO_LIST_X, 'click', '点击', L2, '', RS2.rowRadio, '首行记录单选');
eleStep('修改', "//button[normalize-space()='修改']", 'click', '点击', L2, '', R.listModify);
const P2 = (pageStep('同业客户详情-修改客户场景(第2段:法代引入→地址引入→注册资本)', props[props.length - 1].propertiesID)).propertiesID;
renderFills(visit2, P2);

// ---- 暂存#2 → 返回 → 列表反查 ----
eleStep('暂存', "//button[normalize-space()='暂存']", 'click', '点击', P2, '', R.sceneTempSave);
eleStep('返回', "//button[normalize-space()='返回']", 'click', '点击', P2, '', R.sceneBack);
const backPid2 = props[props.length - 1].propertiesID;
pageStep('同业客户管理列表 - 天阳宏业', backPid2);
const L3 = props[props.length - 1].propertiesID;
eleStep('客户编号', itX('客户编号') + '//input', 'input', '输入', L3, vals.custNo, RS2.listNo);
eleStep('查询', "//button[normalize-space()='查询']", 'click', '点击', L3, '', R.listQuery);

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S2 同业客户管理-修改客户(两段式: 明文项全改→暂存 → 重进 法代/地址/注册资本 → 暂存 → 反查)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S2-edit.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`WIRE S2 -> ${outPath} total=${props.length} steps, fills=${fills}, items_ok=${log.ok}/${log.total}`);

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
