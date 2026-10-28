const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const run=__dirname;execFileSync(process.execPath,[path.join(run,'prepare-replay.cjs'),'--reuse','--extra'],{stdio:'inherit'});
const ids=['R94','R95','R96','R97','R104','R106','R109','R181','R182','R183','R184','R185'];
const dir=path.join(run,'replay-final-input');fs.mkdirSync(dir,{recursive:true});
for(const name of fs.readdirSync(dir).filter(x=>/^R\d+\.json$/.test(x)))fs.unlinkSync(path.join(dir,name));
for(const id of ids){const file=path.join(run,'replay-extra-input',id+'.json');if(fs.existsSync(file))fs.copyFileSync(file,path.join(dir,id+'.json'));}
console.log(JSON.stringify({finalCases:fs.readdirSync(dir).filter(x=>/^R\d+\.json$/.test(x)).length}));
