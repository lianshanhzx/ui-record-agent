// stage-bl.js - 只保留 B/L wire 到独立输入目录，并给 select:click 补 options
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const SRC = path.resolve(DIR, '..', '..', 'partner-wire', 'pdelmt');
const DST = path.join(DIR, 'atp', 'wire-bl');
fs.mkdirSync(DST, { recursive: true });
const files = fs.readdirSync(SRC).filter((f) => /^[BL]\d+.*\.json$/.test(f));
const TP_OPTIONS = ['下拉数据字典', '文本', '列表', '单选数据字典', '复选数据字典', '区间'];
for (const f of files) {
  const w = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  for (const s of w.transcationEventTypeList[0].transcationProperties) {
    if (s.eventTypeValue === 'select:click') s.options = JSON.stringify(TP_OPTIONS);
  }
  fs.writeFileSync(path.join(DST, f), JSON.stringify(w, null, 2));
  console.log('staged', f);
}
console.log('TOTAL', files.length);
