const fs=require('node:fs'),path=require('node:path');
const run=__dirname,root=path.resolve(run,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(run,'recording-manifest.json')));
for(const row of manifest.filter(x=>x.status==='recorded')){
 const name=`R${row.id.slice(1).padStart(3,'0')}-rerecord.spec.ts`;
 fs.writeFileSync(path.join(root,'tests/corp',name),`import { test } from '@playwright/test';\nimport { replayRecordedCase } from './rerecordCase';\ntest(${JSON.stringify(row.id+' '+row.name)}, async () => {\n  test.setTimeout(300000);\n  await replayRecordedCase(${JSON.stringify(row.id)});\n});\n`);
}
console.log(JSON.stringify({specs:manifest.filter(x=>x.status==='recorded').length}));
