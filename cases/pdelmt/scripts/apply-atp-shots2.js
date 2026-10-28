// apply-atp-shots2.js - 给 B/L wire 的 page/popup 步补 screenCapture
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const WIRE = path.resolve(DIR, '..', '..', 'partner-wire', 'pdelmt');
const s = JSON.parse(fs.readFileSync(path.join(DIR, 'atp', 'shots2.json'), 'utf8'));
const page = s.shots.page;
const popupShot = { L3: s.shots.L3, L4: s.shots.L4, L5: s.shots.L5 };
const map = {
  'B1-basic-view.json': null, 'B2-basic-edit-name.json': null, 'B3-basic-edit-seq.json': null, 'B4-basic-validate.json': null,
  'L1-elmt-query.json': null, 'L2-elmt-reset.json': null,
  'L3-elmt-add.json': popupShot.L3,
  'L4-elmt-modify.json': popupShot.L4,
  'L5-elmt-delete.json': popupShot.L5,
  'L6-elmt-delete-blocked.json': null, 'L7-elmt-delete-norow.json': null, 'L8-elmt-modify-norow.json': null,
};
for (const [file, popup] of Object.entries(map)) {
  const p = path.join(WIRE, file);
  const w = JSON.parse(fs.readFileSync(p, 'utf8'));
  let np = 0, nPop = 0;
  for (const st of w.transcationEventTypeList[0].transcationProperties) {
    if (st.type === 'page') { st.screenCapture = page; np++; }
    if (st.type === 'popup') { if (!popup) throw new Error(file + ' 缺 popup 截图'); st.screenCapture = popup; nPop++; }
  }
  fs.writeFileSync(p, JSON.stringify(w, null, 2));
  console.log(`${file} page=${np} popup=${nPop}`);
}
const cfg = { sourceRoot: process.cwd().replace(/\\/g, '/'), popupRects: s.popupRects };
fs.writeFileSync(path.join(DIR, 'atp', 'config-basic-list.json'), JSON.stringify(cfg, null, 2));
console.log('CONFIG', JSON.stringify(cfg));
