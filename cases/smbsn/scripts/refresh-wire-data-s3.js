// refresh-wire-data-s3.js - 为 S3-shareholder.json 注入一组新的唯一数据（股东名称/股东客户编号/证件号码/备注），供回放执行
const fs = require('fs');
const path = require('path');
const WIRE = path.resolve(__dirname, '..', '..', 'partner-wire', 'smbsn', 'S3-shareholder.json');

const USCC_CHARS = '0123456789ABCDEFGHJKLMNPQRTUWXY';
const W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
function genUscc() {
  const body = '91450100' + Array.from({ length: 9 }, () => USCC_CHARS[Math.floor(Math.random() * USCC_CHARS.length)]).join('');
  const sum = Array.from(body).reduce((s, c, i) => s + USCC_CHARS.indexOf(c) * W[i], 0);
  return body + USCC_CHARS[(31 - (sum % 31)) % 31];
}
const now = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const ts = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;

const w = JSON.parse(fs.readFileSync(WIRE, 'utf8'));
const props = w.transcationEventTypeList[0].transcationProperties;

const data = {
  shName: `AT_SMB股东_${ts}`,
  shCustNo: String(Math.floor(1e19 + Math.random() * 8e19)),
  shUscc: genUscc(),
  remark: `AT_SMB股东测试备注_${ts.slice(8, 14)}`,
};

let n = 0;
for (const p of props) {
  if (p.type !== 'ele') continue;
  if (p.propertiesName === '股东名称') { p.objectValue = data.shName; n++; }
  if (p.propertiesName === '股东客户编号') { p.objectValue = data.shCustNo; n++; }
  if (p.propertiesName === '证件号码') { p.objectValue = data.shUscc; n++; }
  if (p.propertiesName === '备注') { p.objectValue = data.remark; n++; }
}
fs.writeFileSync(WIRE, JSON.stringify(w, null, 2), 'utf8');
console.log('REFRESH n=' + n, JSON.stringify(data));
