const fs=require('node:fs'),path=require('node:path');const run=__dirname,out=path.join(run,'atp-project13-system110-20261013');
const previous=JSON.parse(fs.readFileSync(path.join(out,'push/manifest.json')));
const verification=JSON.parse(fs.readFileSync(path.join(out,'push/verification.json')));
const existing=new Set(verification.transactions.map(x=>x.name));
const absent=previous.sources.flatMap(s=>s.data.transcationEventTypeList).filter(t=>!existing.has(t.transcationName));
const dir=path.join(out,'input-absent-safe');fs.mkdirSync(dir,{recursive:true});
const allDir=path.join(out,'input-all-safe');fs.mkdirSync(allDir,{recursive:true});
for(const source of previous.sources.flatMap(s=>s.data.transcationEventTypeList)){const txn=JSON.parse(JSON.stringify(source));for(const p of txn.transcationProperties)p.propertiesName=p.propertiesName.replace(/[\\/:*?"<>|']/g,'_');const id=txn.transcationName.match(/^R(\d+)/)[1];fs.writeFileSync(path.join(allDir,'R'+id.padStart(3,'0')+'.json'),JSON.stringify({transcationEventTypeList:[txn]},null,2));}
const names=[],changes=[];
for(const source of absent){const txn=JSON.parse(JSON.stringify(source));for(const p of txn.transcationProperties){const normalized=p.propertiesName.replace(/[\\/:*?"<>|']/g,'_');if(normalized!==p.propertiesName)changes.push({transaction:txn.transcationName,node:p.propertiesID,before:p.propertiesName,after:normalized});p.propertiesName=normalized;}
 const id=txn.transcationName.match(/^R(\d+)/)[1];fs.writeFileSync(path.join(dir,'R'+id.padStart(3,'0')+'.json'),JSON.stringify({transcationEventTypeList:[txn]},null,2));names.push(txn.transcationName);}
const config={...previous.config,trajectoryIds:Object.fromEntries(JSON.parse(fs.readFileSync(path.join(out,'push/payload.json'))).transcationEventTypeList.map(x=>[x.transcationName,x.transcId]))};
fs.writeFileSync(path.join(out,'recovery-config.json'),JSON.stringify(config,null,2));
fs.writeFileSync(path.join(out,'recovery-plan.json'),JSON.stringify({reason:'First import code500: business object names cannot contain slash and other prohibited characters.',existingTransactions:verification.transactions,absentTransactions:names,displayNameChanges:changes,sourceLocatorsValuesActionsUnchanged:true,doNotRetryExisting:true},null,2));
console.log(JSON.stringify({existing:existing.size,absent:absent.length,displayNameChanges:changes.length}));
