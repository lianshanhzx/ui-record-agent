// gen-wire-tree.js - record_tree_out.json → partner-wire/pdelmt/T*.json
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const ROOT = path.resolve(DIR, '..', '..');
const OUTDIR = path.join(ROOT, 'partner-wire', 'pdelmt');
const src = JSON.parse(fs.readFileSync(path.join(DIR, 'record_tree_out.json'), 'utf8'));

const TITLES = {
  T1: 'T1 树关键字搜索',
  T2: 'T2 树节点折叠与展开',
  T3: 'T3 树选中类型节点',
  T4: 'T4 树选中组件节点',
  T5: 'T5 树新增组件',
  T6: 'T6 树删除组件',
  T7: 'T7 树新增类型',
  T8: 'T8 树删除类型',
};
const FILE = {
  T1: 'T1-tree-search.json',
  T2: 'T2-tree-expand.json',
  T3: 'T3-tree-select-type.json',
  T4: 'T4-tree-select-component.json',
  T5: 'T5-tree-add-component.json',
  T6: 'T6-tree-delete-component.json',
  T7: 'T7-tree-add-type.json',
  T8: 'T8-tree-delete-type.json',
};
// 需要 popup 结构步的交易：触发弹窗的元素步骤名 → popup 步名
const POPUP_TRIGGER = {
  T5: { step: '打开新增组件', popup: '要素组件弹窗' },
  T6: { step: '打开删除确认', popup: '删除确认弹窗' },
  T7: { step: '打开新增类型', popup: '要素类型弹窗' },
  T8: { step: '打开删除确认', popup: '删除确认弹窗' },
};

fs.mkdirSync(OUTDIR, { recursive: true });
let allOk = true;

for (const key of Object.keys(TITLES)) {
  const tx = src.txs[key];
  if (!tx || !tx.steps || !tx.steps.length) throw new Error(`${key} 无步骤`);
  const props = [];
  let id = 0;
  const nextId = () => String(++id);
  const push = (o) => { props.push(o); return o.propertiesID; };

  const pageId = push({
    propertiesID: nextId(),
    propertiesPID: '0',
    type: 'page',
    propertiesName: '产品要素库',
    eventTypeValue: 'click',
    eventTypeName: '',
    mothed: '',
    elementType: '',
    objectValue: '',
    realLabel: '产品要素库',
    rect: '',
    transcationType: 'playwright',
    options: '',
    screenCapture: '',
  });

  const trig = POPUP_TRIGGER[key];
  let popupId = null;
  for (const s of tx.steps) {
    const isTrigger = trig && s.name === trig.step;
    const rect = s.rect ? JSON.stringify({ x1: s.rect.x1, y1: s.rect.y1, x2: s.rect.x2, y2: s.rect.y2 }) : '';
    const pid = s.popup && popupId ? popupId : pageId;
    const stepId = push({
      propertiesID: nextId(),
      propertiesPID: pid,
      type: 'ele',
      propertiesName: s.name,
      eventTypeValue: s.action,
      eventTypeName: s.action === 'input' ? '输入' : '点击',
      mothed: 'By.XPATH',
      elementType: s.xpath,
      objectValue: s.value || '',
      realLabel: s.name,
      rect,
      transcationType: 'playwright',
      options: '',
      screenCapture: '',
    });
    if (isTrigger) {
      popupId = push({
        propertiesID: nextId(),
        propertiesPID: stepId,
        type: 'popup',
        propertiesName: trig.popup,
        eventTypeValue: 'click',
        eventTypeName: '',
        mothed: '',
        elementType: '',
        objectValue: '',
        realLabel: trig.popup,
        rect: '',
        transcationType: 'playwright',
        options: '',
        screenCapture: '',
      });
    }
  }

  const wire = {
    transcationEventTypeList: [{
      transcId: 'TBD',
      pageId: 'TBD',
      transcationName: TITLES[key],
      systemId: 'TBD',
      projectId: 'TBD',
      transcationType: 'web',
      testFrame: 'playwright',
      transcationProperties: props,
    }],
  };

  // 完整性校验
  const ids = new Set(); let dup = 0, badPID = 0, noRect = 0;
  for (const p of props) {
    if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
    if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
    if (p.type === 'ele' && !p.rect) noRect++;
  }
  if (dup || badPID || noRect) { allOk = false; console.error(`${key} FAIL dup=${dup} badPID=${badPID} noRect=${noRect}`); }
  fs.writeFileSync(path.join(OUTDIR, FILE[key]), JSON.stringify(wire, null, 2));
  console.log(`${key} → ${FILE[key]} steps=${props.length} dup=${dup} badPID=${badPID} noRect=${noRect}`);
}
console.log(allOk ? 'WIRE_OK' : 'WIRE_FAIL');
