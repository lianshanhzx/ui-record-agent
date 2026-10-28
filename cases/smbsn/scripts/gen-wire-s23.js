// gen-wire-s23.js - s23-values.json → partner-wire/smbsn/S23-list-pagination.json
// S23 列表分页：列表(默认10/页15条2页)→点页码2→点页码1→每页条数20/页→每页条数10/页→下一页→上一页
// 跳页(需回车提交, 引擎无键盘动作)不入 wire，spec 已验证
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const P = (r) => (typeof r === 'string' ? JSON.parse(r) : (r || {}));

const s23 = JSON.parse(fs.readFileSync(path.join(DIR, 's23-values.json'), 'utf8'));
const PAGE2 = "//div[contains(@class,'el-pagination')]//li[contains(@class,'number')][normalize-space(.)='2']";
const PAGE1 = "//div[contains(@class,'el-pagination')]//li[contains(@class,'number')][normalize-space(.)='1']";
const SIZE = "//span[contains(@class,'el-pagination__sizes')]//div[contains(@class,'el-select--mini')]";
const NEXT = "//div[contains(@class,'el-pagination')]//button[contains(@class,'btn-next')]";
const PREV = "//div[contains(@class,'el-pagination')]//button[contains(@class,'btn-prev')]";

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
eleStep('翻页-第2页', PAGE2, 'click', '点击', L1, '', P(s23.page2Rect));
eleStep('翻页-第1页', PAGE1, 'click', '点击', L1, '', P(s23.page1Rect));
eleStep('每页条数', SIZE, 'select:click', '下拉选择', L1, '20条/页', P(s23.sizeRect));
eleStep('每页条数恢复', SIZE, 'select:click', '下拉选择', L1, '10条/页', P(s23.sizeRect));
eleStep('下一页', NEXT, 'click', '点击', L1, '', P(s23.nextRect));
eleStep('上一页', PREV, 'click', '点击', L1, '', P(s23.prevRect));

const out = {
  transcationEventTypeList: [
    {
      transcId: 'TBD', pageId: 'TBD',
      transcationName: 'S23 同业客户管理-列表分页(点页码2→页码1→每页条数20/页→10/页→下一页→上一页)',
      systemId: 'TBD', projectId: 'TBD', transcationType: 'web', testFrame: 'playwright', transcationProperties: props,
    },
  ],
};
const outPath = path.join(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S23-list-pagination.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log('WIRE S23 -> ' + outPath + ' total=' + props.length + ' steps');

const ids = new Set();
let dup = 0, badPID = 0, noRect = 0;
for (const p of props) {
  if (ids.has(p.propertiesID)) dup++; else ids.add(p.propertiesID);
  if (p.propertiesPID !== '0' && !ids.has(p.propertiesPID)) badPID++;
  if (p.type === 'ele' && !p.rect) noRect++;
}
console.log('CHECK steps=' + props.length + ' dup=' + dup + ' badPID=' + badPID + ' noRect=' + noRect);
if (dup || badPID || noRect) process.exit(1);
