const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const run=__dirname,root=path.resolve(run,'../..'),manifest=JSON.parse(fs.readFileSync(path.join(run,'recording-manifest.json')));
const errors=[],bounds=[];let screenshots=0;
for(const item of manifest){const record=JSON.parse(fs.readFileSync(path.join(run,item.id+'-recording.json')));for(const s of record.steps){screenshots++;if(s.type==='ele'){const r=JSON.parse(s.rect);if(Object.values(r).some(v=>v<0||v>1))bounds.push({id:item.id,step:s.propertiesID,rect:r});}}
 const file=path.join(root,'partner-wire/corp',item.id+'.json');if((item.status==='recorded')!==fs.existsSync(file))errors.push(item.id+':活动报文与状态不符');
}
const engine=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())walk(target);else if(entry.isFile())engine.push({path:path.relative(root,target),sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex'),mtime:fs.statSync(target).mtime.toISOString()});}}
walk(path.join(root,'replay-skill'));
const requirement=JSON.parse(fs.readFileSync(path.join(run,'requirements.json')));
const oldSpecs=fs.readdirSync(path.join(root,'tests/corp')).filter(x=>/^C\d.*\.spec\.ts$/.test(x));
if(oldSpecs.length)errors.push('旧C系列spec仍在活动目录');
const evidence={date:new Date().toISOString(),cases:manifest.length,screenshots,coordinateBounds:bounds,errors,oldActiveSpecs:oldSpecs,oldActiveWires:fs.readdirSync(path.join(root,'partner-wire/corp')).filter(x=>/^C\d/.test(x)),requirementSha256:requirement.sourceSha256,engineFiles:engine,engineFilesModifiedDuringRun:engine.filter(x=>new Date(x.mtime)>=new Date('2026-10-12T00:00:00+08:00')).map(x=>x.path)};
fs.writeFileSync(path.join(run,'final-audit.json'),JSON.stringify(evidence,null,2));
console.log(JSON.stringify({cases:evidence.cases,screenshots,bounds:bounds.length,errors,engineFiles:engine.length,engineModified:evidence.engineFilesModifiedDuringRun,oldWires:evidence.oldActiveWires,oldSpecs}));
if(errors.length||bounds.length)process.exitCode=1;
