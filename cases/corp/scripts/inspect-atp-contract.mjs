import fs from 'node:fs';import path from 'node:path';
const out=path.join(import.meta.dirname,'atp-project13-system110-20261013');
const token=fs.readFileSync(process.argv[2],'utf8').trim();
const response=await fetch('http://test.atp.tansun.com.cn/api/v3/api-docs',{headers:{access_token:token},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('API契约读取失败 '+response.status);
const doc=await response.json();fs.writeFileSync(path.join(out,'api-contract.json'),JSON.stringify(doc,null,2));
const selected=Object.entries(doc.paths||{}).filter(([name])=>/lazySystemTree|system\/system\/\{|system\/system\/getInfo|importDemand/.test(name));
console.log(JSON.stringify(selected,null,2).slice(0,18000));
