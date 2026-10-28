// refresh-wire-data.js - 为 S1-new.json 注入一组新的唯一数据（客户名称/USCC/机构USCC/电话），供回放执行
const fs = require('fs');
const path = require('path');
const WIRE = path.resolve(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S1-new.json');

const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
function genUscc() {
  const body = '91450100' + Array.from({ length: 9 }, () => USCC_CHARS[Math.floor(Math.random() * USCC_CHARS.length)]).join('');
  const sum = Array.from(body).reduce((s, c, i) => s + USCC_CHARS.indexOf(c) * W[i], 0);
  return body + USCC_CHARS[(31 - (sum % 31)) % 31];
}
const now = new Date();
const ts = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'), String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'), String(now.getSeconds()).padStart(2, '0')].join('');

const w = JSON.parse(fs.readFileSync(WIRE, 'utf8'));
const props = w.transcationEventTypeList[0].transcationProperties;

const data = { name: `AT_SMB_${ts}`, uscc: genUscc(), instUscc: genUscc(), phone: '139' + String(Math.floor(10000000 + Math.random() * 89999999)) };

let n = 0;
for (const p of props) {
  if (p.propertiesName === '证件号码' && p.type === 'ele') { p.objectValue = data.uscc; n++; }
  if (p.propertiesName === '客户名称' && p.type === 'ele' && p.objectValue.startsWith('AT_SMB_')) { p.objectValue = data.name; n++; }
  if (p.propertiesName === '机构统一社会信用代码' && p.type === 'ele') { p.objectValue = data.instUscc; n++; }
  if (p.propertiesName === '联系电话' && p.type === 'ele') { p.objectValue = data.phone; n++; }
}
fs.writeFileSync(WIRE, JSON.stringify(w, null, 2), 'utf8');
console.log(`REFRESH n=${n}`, JSON.stringify(data));
