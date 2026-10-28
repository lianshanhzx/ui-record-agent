// gen-wire-basic-list.js - 基本信息(B1-B4) + 产品要素列表(L1-L8) → partner-wire/pdelmt
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const OUTDIR = path.join(ROOT, 'partner-wire', 'pdelmt');
const basic = JSON.parse(fs.readFileSync(path.join(DIR, 'record_basic_out.json'), 'utf8'));
const list = JSON.parse(fs.readFileSync(path.join(DIR, 'record_list_out.json'), 'utf8'));

const DEFS = [
  ['B1', 'B1 基本信息查看', basic.txs.B1, 'B1-basic-view.json', null],
  ['B2', 'B2 基本信息修改名称', basic.txs.B2, 'B2-basic-edit-name.json', null],
  ['B3', 'B3 基本信息修改序号', basic.txs.B3, 'B3-basic-edit-seq.json', null],
  ['B4', 'B4 基本信息保存校验', basic.txs.B4, 'B4-basic-validate.json', null],
  ['L1', 'L1 产品要素查询', list.txs.L1, 'L1-elmt-query.json', null],
  ['L2', 'L2 产品要素重置查询', list.txs.L2, 'L2-elmt-reset.json', null],
  ['L3', 'L3 产品要素新增', list.txs.L3, 'L3-elmt-add.json', { step: '点击新增', popup: '选择要素弹窗' }],
  ['L4', 'L4 产品要素修改', list.txs.L4, 'L4-elmt-modify.json', { step: '点击修改', popup: '选择要素弹窗' }],
  ['L5', 'L5 产品要素删除', list.txs.L5, 'L5-elmt-delete.json', { step: '点击删除', popup: '删除确认弹窗' }],
  ['L6', 'L6 产品要素删除引用拦截', list.txs.L6, 'L6-elmt-delete-blocked.json', null],
  ['L7', 'L7 产品要素删除未选行', list.txs.L7, 'L7-elmt-delete-norow.json', null],
  ['L8', 'L8 产品要素修改未选行', list.txs.L8, 'L8-elmt-modify-norow.json', null],
];

let allOk = true;
const popupIds = {};
for (const [key, title, tx, file, trig] of DEFS) {
  if (!tx || !tx.steps || !tx.steps.length) throw new Error(key + ' 无步骤');
  if (tx.checks && tx.checks.passed !== true) throw new Error(key + ' 录制未通过');
  const props = [];
  let id = 0;
  const nextId = () => String(++id);
  const push = (o) => { props.push(o); return o.propertiesID; };
  const pageId = push({
    propertiesID: nextId(), propertiesPID: '0', type: 'page', propertiesName: '产品要素库',
    eventTypeValue: 'click', eventTypeName: '', mothed: '', elementType: '', objectValue: '',
    realLabel: '产品要素库', rect: '', transcationType: 'playwright', options: '', screenCapture: '',
  });
  let popupId = null;
  const nameCount = new Map();
  for (const s of tx.steps) {
    const isTrigger = trig && s.name === trig.step;
    const rect = s.rect ? JSON.stringify({ x1: s.rect.x1, y1: s.rect.y1, x2: s.rect.x2, y2: s.rect.y2 }) : '';
    const pid = s.popup && popupId ? popupId : pageId;
    // 名称唯一化（同一交易内重复步骤名加序号后缀）
    let nm = s.name;
    const n = (nameCount.get(nm) || 0) + 1;
    nameCount.set(nm, n);
    if (n > 1) nm = `${nm}（步骤${n}）`;
    const stepId = push({
      propertiesID: nextId(), propertiesPID: pid, type: 'ele', propertiesName: nm,
      eventTypeValue: s.action, eventTypeName: s.action === 'input' ? '输入' : (s.action === 'select:click' ? '下拉框点击选择' : '点击'),
      mothed: 'By.XPATH', elementType: s.xpath, objectValue: s.value || '',
      realLabel: nm, rect, transcationType: 'playwright', options: '', screenCapture: '',
    });
    if (isTrigger) {
      popupId = push({
        propertiesID: nextId(), propertiesPID: stepId, type: 'popup', propertiesName: trig.popup,
        eventTypeValue: 'click', eventTypeName: '', mothed: '', elementType: '', objectValue: '',
        realLabel: trig.popup, rect: '', transcationType: 'playwright', options: '', screenCapture: '',
      });
      popupIds[key] = popupId;
    }
  }
  const wire = { transcationEventTypeList: [{ transcId: 'TBD', pageId: 'TBD', transcationName: title, systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props }] };
  const ids = new Set(); let dup = 0, badPID = 0, noRect = 0;
  for (const p of props) {
    if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
    if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
    if (p.type === 'ele' && !p.rect) noRect++;
  }
  if (dup || badPID || noRect) { allOk = false; console.error(`${key} FAIL dup=${dup} badPID=${badPID} noRect=${noRect}`); }
  fs.writeFileSync(path.join(OUTDIR, file), JSON.stringify(wire, null, 2));
  console.log(`${key} → ${file} steps=${props.length} popup=${popupId || '-'} dup=${dup} badPID=${badPID} noRect=${noRect}`);
}
fs.writeFileSync(path.join(DIR, 'atp', 'popup-ids.json'), JSON.stringify(popupIds, null, 2));
console.log(allOk ? 'WIRE_OK' : 'WIRE_FAIL');
