// fix-row-xpath.js - 选择行改用固定列 radio（可见可点，避免主表 td 被 fixed 拦截）
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const WIRE = path.resolve(DIR, '..', '..', 'partner-wire', 'pdelmt');
const NEW = `//div[@id='pane-second'][count(.//div[contains(@class,'el-table__fixed')]//tbody/tr//label[contains(@class,'el-radio')])=1]//div[contains(@class,'el-table__fixed')]//tbody/tr//label[contains(@class,'el-radio')]`;
const files = ['L4-elmt-modify.json', 'L5-elmt-delete.json', 'L6-elmt-delete-blocked.json'];
for (const f of files) {
  const p = path.join(WIRE, f);
  const w = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const s of w.transcationEventTypeList[0].transcationProperties) {
    if (s.propertiesName === '选择行') { s.elementType = NEW; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(w, null, 2));
  console.log(f, 'patched', n);
}
