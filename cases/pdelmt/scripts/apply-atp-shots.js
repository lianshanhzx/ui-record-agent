// apply-atp-shots.js - 给 wire 的 page/popup 步补 screenCapture（ATP prepare 要求）
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const WIRE = path.resolve(DIR, '..', '..', 'partner-wire', 'pdelmt');
const shots = JSON.parse(fs.readFileSync(path.join(DIR, 'atp', 'shots.json'), 'utf8'));
const page = shots.shots.page;
const popupShot = { T5: shots.shots.T5, T6: shots.shots.T6, T7: shots.shots.T7, T8: shots.shots.T8 };
const map = {
  'T1-tree-search.json': null,
  'T2-tree-expand.json': null,
  'T3-tree-select-type.json': null,
  'T4-tree-select-component.json': null,
  'T5-tree-add-component.json': popupShot.T5,
  'T6-tree-delete-component.json': popupShot.T6,
  'T7-tree-add-type.json': popupShot.T7,
  'T8-tree-delete-type.json': popupShot.T8,
};
for (const [file, popup] of Object.entries(map)) {
  const p = path.join(WIRE, file);
  const w = JSON.parse(fs.readFileSync(p, 'utf8'));
  const props = w.transcationEventTypeList[0].transcationProperties;
  let nPage = 0, nPopup = 0;
  for (const s of props) {
    if (s.type === 'page') { s.screenCapture = page; nPage++; }
    if (s.type === 'popup') { if (!popup) throw new Error(file + ' 需要 popup 截图'); s.screenCapture = popup; nPopup++; }
  }
  fs.writeFileSync(p, JSON.stringify(w, null, 2));
  console.log(`${file} page=${nPage} popup=${nPopup}`);
}
